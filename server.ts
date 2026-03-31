import express from "express";
import cors from "cors";
import { createServer as createViteServer } from "vite";
import { Prisma, PrismaClient } from "@prisma/client";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";
import { OAuth2Client } from "google-auth-library";
import multer from "multer";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import {
  cancelPolymarketOrder,
  getPolymarketConnectionStatus,
  getPolymarketMarketById,
  getPolymarketOrderBook,
  listPolymarketMarkets,
  listPolymarketTags,
  listPolymarketOpenOrders,
  listPolymarketTrades,
  placePolymarketLimitOrder,
  placePolymarketMarketOrder,
} from "./polymarket";

const prisma = new PrismaClient();
const app = express();
const PORT = Number(process.env.PORT) || 3000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const HIDDEN_MARKET_CATEGORY = "__hidden_market__";

async function isPolyMarketHiddenFromFeed(marketId: string): Promise<boolean> {
  if (!marketId.startsWith("poly_")) return false;
  const row = await prisma.market.findUnique({
    where: { id: marketId },
    select: { category: true },
  });
  return row?.category === HIDDEN_MARKET_CATEGORY;
}

async function isPolyPublishedToFeed(polyId: string): Promise<boolean> {
  if (!polyId.startsWith("poly_")) return true;
  const row = await prisma.market.findUnique({
    where: { id: polyId },
    select: { publishedToFeed: true },
  });
  return Boolean(row?.publishedToFeed);
}

/** Non-admin users only see poly markets that are published to the app feed. Sends 404 when blocked. */
async function assertPolyPublicFeedAccess(
  polyId: string,
  req: AuthenticatedRequest,
  res: express.Response
): Promise<boolean> {
  if (!polyId.startsWith("poly_")) return true;
  if (await isPolyMarketHiddenFromFeed(polyId)) {
    res.status(404).json({ error: "Market not found" });
    return false;
  }
  if (req.auth?.role === "ADMIN") return true;
  if (!(await isPolyPublishedToFeed(polyId))) {
    res.status(404).json({ error: "Market not found" });
    return false;
  }
  return true;
}

const uploadsDir = path.join(process.cwd(), "public", "uploads");
fs.mkdirSync(uploadsDir, { recursive: true });
const JWT_SECRET = process.env.JWT_SECRET || "";
const JWT_EXPIRES_IN = "7d";
const NOWPAYMENTS_IPN_SECRET = process.env.NOWPAYMENTS_IPN_SECRET || "";

const MAX_DEPOSIT_AMOUNT = Math.min(1_000_000, Math.max(1, Number(process.env.MAX_DEPOSIT_AMOUNT || "100000")));

const PAYMENT_WEBHOOK_INTERIM_STATUSES = new Set([
  "waiting",
  "confirming",
  "confirmed",
  "sending",
  "partially_paid",
  "failed",
  "refunded",
  "expired",
]);

const ADMIN_EMAIL_SET: Set<string> = new Set(
  (process.env.ADMIN_EMAILS || "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean)
);

function isAdminEmail(email: string): boolean {
  return ADMIN_EMAIL_SET.has(String(email).trim().toLowerCase());
}

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 80,
  standardHeaders: true,
  legacyHeaders: false,
});

const paymentCreateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
});

const analyticsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

const waitlistLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

/** Public feed / Polymarket proxy — limit scraping (BL-065). */
const marketsListLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});

const polymarketPublicLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 90,
  standardHeaders: true,
  legacyHeaders: false,
});

const healthLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

function mapPrismaClientError(error: unknown): { status: number; error: string } | null {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return { status: 409, error: "Resource already exists" };
    }
    if (error.code === "P2025") {
      return { status: 404, error: "Record not found" };
    }
  }
  return null;
}

type AuthenticatedRequest = express.Request & {
  auth?: {
    userId: string;
    role: string;
  };
  rawBody?: string;
};

function signAuthToken(user: { id: string; role: string }) {
  if (!JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured");
  }
  return jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
    algorithm: "HS256",
  });
}

async function resolveAuthUser(req: AuthenticatedRequest, strict: boolean) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    if (strict) {
      return { error: "Authorization header is required", status: 401 as const };
    }
    return { user: null };
  }

  const [scheme, token] = authHeader.split(" ");
  if (scheme !== "Bearer" || !token) {
    return { error: "Invalid authorization header format", status: 401 as const };
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] }) as jwt.JwtPayload;
    const userId = payload.sub ? String(payload.sub) : "";
    if (!userId) {
      return { error: "Invalid token payload", status: 401 as const };
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    });
    if (!user) {
      return { error: "User not found for token", status: 401 as const };
    }
    return { user };
  } catch {
    return { error: "Invalid or expired token", status: 401 as const };
  }
}

async function requireAuth(req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) {
  if (!JWT_SECRET) {
    return res.status(500).json({ error: "JWT auth is not configured on server" });
  }
  const result = await resolveAuthUser(req, true);
  if ("error" in result) {
    return res.status(result.status).json({ error: result.error });
  }
  req.auth = { userId: result.user!.id, role: result.user!.role };
  next();
}

async function attachAuthIfPresent(req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) {
  if (!JWT_SECRET) return next();
  const hasAuthHeader = Boolean(req.headers.authorization);
  if (!hasAuthHeader) return next();

  const result = await resolveAuthUser(req, false);
  if ("error" in result) {
    // Optional auth: bad/expired Bearer must not break public routes (feed, etc.)
    return next();
  }
  if (result.user) {
    req.auth = { userId: result.user.id, role: result.user.role };
  }
  next();
}

function requireAdmin(req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) {
  if (!req.auth) {
    return res.status(401).json({ error: "Authentication required" });
  }
  if (req.auth.role !== "ADMIN") {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}

function requireSelfOrAdmin(paramName = "id") {
  return (req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) => {
    if (!req.auth) {
      return res.status(401).json({ error: "Authentication required" });
    }
    if (req.auth.role === "ADMIN" || req.params[paramName] === req.auth.userId) {
      return next();
    }
    return res.status(403).json({ error: "Forbidden" });
  };
}

const videoUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || "").toLowerCase() || ".mp4";
      const safeExt = [".mp4", ".mov", ".webm"].includes(ext) ? ext : ".mp4";
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${safeExt}`);
    },
  }),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const mime = (file.mimetype || "").toLowerCase();
    const allowed = mime.startsWith("video/") || mime === "application/octet-stream";
    if (!allowed) {
      cb(new Error("Unsupported video format"));
      return;
    }
    cb(null, true);
  },
});

/** If `CORS_ORIGINS` is set (comma-separated), enable CORS for browser clients on another origin. Use `*` to reflect any `Origin` (dev only). If unset, same-origin only (unchanged). */
function buildCorsMiddleware(): express.RequestHandler | null {
  const raw = process.env.CORS_ORIGINS?.trim() ?? "";
  if (!raw) return null;
  const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) return null;

  const common = {
    methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    maxAge: 86400 as number,
  };

  if (parts.includes("*")) {
    return cors({ ...common, origin: true });
  }

  return cors({
    ...common,
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      callback(null, parts.includes(origin));
    },
  });
}

const corsMiddleware = buildCorsMiddleware();
if (corsMiddleware) {
  app.use(corsMiddleware);
}

app.use((req, res, next) => {
  if (req.url.startsWith('/api')) {
    console.log(`${req.method} ${req.url}`);
  }
  next();
});

app.use(express.json({
  limit: "10mb",
  verify: (req: AuthenticatedRequest, _res, buf) => {
    if (req.originalUrl === "/api/payments/webhook") {
      req.rawBody = buf.toString("utf8");
    }
  },
}));
app.use(express.urlencoded({ limit: "10mb", extended: true }));
app.use("/uploads", express.static(uploadsDir));
app.use(attachAuthIfPresent);

function parseBoolean(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value.toLowerCase() === "true") return true;
    if (value.toLowerCase() === "false") return false;
  }
  return fallback;
}

// Ensure a Polymarket market has a shadow record in the DB for likes/saves/comments
async function ensureMarketExists(marketId: string) {
  const existing = await prisma.market.findUnique({ where: { id: marketId } });
  if (existing) return existing;

  if (!marketId.startsWith('poly_')) return null;

  try {
    const poly = await getPolymarketMarketById(marketId);
    if (!poly) return null;
    return await prisma.market.create({
      data: {
        id: marketId,
        title: (poly as any).title || 'Polymarket Event',
        description: (poly as any).description || '',
        category: (poly as any).category || 'Polymarket',
        imageUrl: (poly as any).imageUrl || '',
        yesPercent: (poly as any).yesPercent ?? 50,
        noPercent: (poly as any).noPercent ?? 50,
        totalPool: (poly as any).totalPool ?? 0,
        expiresAt: (poly as any).expiresAt ? new Date((poly as any).expiresAt) : new Date('2030-01-01'),
        creatorId: 'system',
        publishedToFeed: false,
      }
    });
  } catch (e) {
    // Might race with another request — try to find again
    return await prisma.market.findUnique({ where: { id: marketId } });
  }
}

/** Merge custom video (and createdAt for admin UI) from shadow Market rows onto Polymarket list payloads */
async function mergePolyShadowMedia(polyMarkets: any[]) {
  if (!polyMarkets.length) return polyMarkets;
  const ids = polyMarkets
    .map((m: any) => m.id)
    .filter((id: unknown): id is string => typeof id === "string" && id.startsWith("poly_"));
  if (!ids.length) return polyMarkets;

  const shadows = await prisma.market.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      videoUrl: true,
      createdAt: true,
      skipNeedsVideoQueue: true,
      publishedToFeed: true,
    },
  });
  const map = new Map(shadows.map((s) => [s.id, s]));

  return polyMarkets.map((m: any) => {
    const s = map.get(m.id);
    const raw = s?.videoUrl;
    const overlay =
      raw != null && String(raw).trim().length > 0 ? String(raw).trim() : undefined;
    return {
    ...m,
      ...(overlay ? { videoUrl: overlay } : {}),
      skipNeedsVideoQueue: Boolean(s?.skipNeedsVideoQueue),
      publishedToFeed: Boolean(s?.publishedToFeed),
      createdAt: m.createdAt ?? (s?.createdAt ? s.createdAt.toISOString() : m.expiresAt),
    };
  });
}

// Config endpoint (public client config)
app.get("/api/config", (req, res) => {
  res.json({
    googleClientId: process.env.GOOGLE_CLIENT_ID || "",
  });
});

// Polymarket API Routes
app.get("/api/polymarket/status", requireAuth, requireAdmin, async (req, res) => {
  res.json(getPolymarketConnectionStatus());
});

app.get("/api/polymarket/markets", polymarketPublicLimiter, async (req, res) => {
  try {
    const markets = await listPolymarketMarkets({
      limit: Number(req.query.limit ?? 50),
      offset: Number(req.query.offset ?? 0),
      active: parseBoolean(req.query.active, true),
      closed: parseBoolean(req.query.closed, false),
      search: typeof req.query.search === "string" ? req.query.search : undefined,
      tagId: typeof req.query.tagId === "string" ? req.query.tagId : undefined,
      includePast: parseBoolean(req.query.includePast, false),
    });
    res.json(markets);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(502).json({ error: `Failed to fetch Polymarket markets: ${message}` });
  }
});

app.get("/api/polymarket/tags", polymarketPublicLimiter, async (req, res) => {
  try {
    const limit = Number(req.query.limit ?? 200);
    const tags = await listPolymarketTags(limit);
    res.json(tags);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(502).json({ error: `Failed to fetch Polymarket tags: ${message}` });
  }
});

app.get("/api/polymarket/markets/:id", polymarketPublicLimiter, async (req: AuthenticatedRequest, res) => {
  try {
    const raw = String(req.params.id || "").trim();
    if (!raw) {
      return res.status(400).json({ error: "Market id is required" });
    }
    // One canonical app id for DB hidden-check and Gamma fetch (getPolymarketMarketById strips poly_)
    const canonicalPolyId = raw.startsWith("poly_") ? raw : `poly_${raw}`;
    if (!(await assertPolyPublicFeedAccess(canonicalPolyId, req, res))) return;
    const market = await getPolymarketMarketById(canonicalPolyId);
    if (!market) {
      return res.status(404).json({ error: "Polymarket market not found" });
    }
    res.json(market);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(502).json({ error: `Failed to fetch Polymarket market: ${message}` });
  }
});

app.get("/api/polymarket/orderbook/:tokenId", polymarketPublicLimiter, async (req, res) => {
  try {
    const orderbook = await getPolymarketOrderBook(req.params.tokenId);
    res.json(orderbook);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(502).json({ error: `Failed to fetch orderbook: ${message}` });
  }
});

app.get("/api/polymarket/orders/open", requireAuth, requireAdmin, async (req, res) => {
  try {
    const orders = await listPolymarketOpenOrders();
    res.json(orders);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(400).json({ error: `Failed to fetch open orders: ${message}` });
  }
});

app.get("/api/polymarket/trades", requireAuth, requireAdmin, async (req, res) => {
  try {
    const trades = await listPolymarketTrades();
    res.json(trades);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(400).json({ error: `Failed to fetch trades: ${message}` });
  }
});

app.post("/api/polymarket/orders/limit", requireAuth, requireAdmin, async (req, res) => {
  const { tokenId, side, price, size, orderType, tickSize, negRisk, expiration } = req.body;
  if (!tokenId || !side || typeof price !== "number" || typeof size !== "number") {
    return res.status(400).json({
      error: "tokenId, side, price(number), and size(number) are required",
    });
  }
  if (!["BUY", "SELL"].includes(side)) {
    return res.status(400).json({ error: "side must be BUY or SELL" });
  }

  try {
    const response = await placePolymarketLimitOrder({
      tokenId,
      side,
      price,
      size,
      orderType,
      tickSize,
      negRisk,
      expiration,
    });
    res.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(400).json({ error: `Failed to place limit order: ${message}` });
  }
});

app.post("/api/polymarket/orders/market", requireAuth, requireAdmin, async (req, res) => {
  const { tokenId, side, amount, price, orderType, tickSize, negRisk } = req.body;
  if (!tokenId || !side || typeof amount !== "number" || typeof price !== "number") {
    return res.status(400).json({
      error: "tokenId, side, amount(number), and price(number) are required",
    });
  }
  if (!["BUY", "SELL"].includes(side)) {
    return res.status(400).json({ error: "side must be BUY or SELL" });
  }

  try {
    const response = await placePolymarketMarketOrder({
      tokenId,
      side,
      amount,
      price,
      orderType,
      tickSize,
      negRisk,
    });
    res.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(400).json({ error: `Failed to place market order: ${message}` });
  }
});

app.delete("/api/polymarket/orders/:orderId", requireAuth, requireAdmin, async (req, res) => {
  try {
    const response = await cancelPolymarketOrder(req.params.orderId);
    res.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(400).json({ error: `Failed to cancel order: ${message}` });
  }
});

// API Routes
app.get("/api/health", healthLimiter, async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", database: "connected" });
  } catch (error) {
    const isDev = process.env.NODE_ENV === "development";
    res.status(500).json({
      status: "error",
      message: isDev && error instanceof Error ? error.message : "unavailable",
    });
  }
});

app.get("/api/markets", marketsListLimiter, async (req: AuthenticatedRequest, res) => {
  try {
    const { search, limit, offset } = req.query;

    let polyMarkets: any[] = [];
    try {
      polyMarkets = await listPolymarketMarkets({
        limit: Number(limit) || 100,
        offset: Number(offset) || 0,
        active: true,
        search: search ? String(search) : undefined,
      });
    } catch (e) {
      console.error("Polymarket fetch failed:", e);
    }

    // Exclude markets that admin removed from the feed.
    if (polyMarkets.length > 0) {
      const hidden = await prisma.market.findMany({
        where: { category: HIDDEN_MARKET_CATEGORY },
        select: { id: true },
      });
      const hiddenSet = new Set(hidden.map(m => m.id));
      polyMarkets = polyMarkets.filter((m: any) => !hiddenSet.has(m.id));
    }

    polyMarkets = await mergePolyShadowMedia(polyMarkets);

    const polyIds = polyMarkets.map((m: any) => m.id).filter((id: string) => typeof id === "string" && id.startsWith("poly_"));
    if (polyIds.length > 0) {
      const publishedRows = await prisma.market.findMany({
        where: { id: { in: polyIds }, publishedToFeed: true },
        select: { id: true },
      });
      const publishedSet = new Set(publishedRows.map((r) => r.id));
      polyMarkets = polyMarkets.filter((m: any) => publishedSet.has(m.id));
    }

    // Enrich with user's likes/saves from shadow records
    const userId = req.auth?.userId;
    if (userId && polyMarkets.length > 0) {
      const polyIds = polyMarkets.map((m: any) => m.id);
      const [userLikes, userSaves, counts] = await Promise.all([
        prisma.like.findMany({ where: { userId: String(userId), marketId: { in: polyIds } } }),
        prisma.save.findMany({ where: { userId: String(userId), marketId: { in: polyIds } } }),
        prisma.like.groupBy({ by: ['marketId'], where: { marketId: { in: polyIds } }, _count: true }),
      ]);
      const likedSet = new Set(userLikes.map(l => l.marketId));
      const savedSet = new Set(userSaves.map(s => s.marketId));
      const countMap = new Map(counts.map(c => [c.marketId, c._count]));

      polyMarkets = polyMarkets.map((m: any) => ({
        ...m,
        userLiked: likedSet.has(m.id),
        userSaved: savedSet.has(m.id),
        _count: { ...m._count, likes: countMap.get(m.id) || m._count?.likes || 0 },
      }));
    }

    res.json(polyMarkets);
  } catch (error) {
    console.error("Error fetching markets:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/markets/:id", async (req: AuthenticatedRequest, res) => {
  try {
    // Route Polymarket markets — merge with local social data
    if (req.params.id.startsWith('poly_')) {
      const market = await getPolymarketMarketById(req.params.id);
      if (!market) return res.status(404).json({ error: "Polymarket market not found" });

      const userId = req.auth?.userId;
      // Check for shadow record with social data
      const shadow = await prisma.market.findUnique({
        where: { id: req.params.id },
        include: {
          comments: { include: { user: { select: { id: true, handle: true, avatar: true } } }, orderBy: { createdAt: 'desc' }, take: 50 },
          _count: { select: { bets: true, likes: true, comments: true } },
          likes: userId ? { where: { userId: String(userId) } } : false,
          saves: userId ? { where: { userId: String(userId) } } : false,
        }
      });

      if (await isPolyMarketHiddenFromFeed(req.params.id)) {
        return res.status(404).json({ error: "Market not found" });
      }
      if (!(await assertPolyPublicFeedAccess(req.params.id, req, res))) return;

      const vRaw = shadow?.videoUrl;
      const overlayVideo =
        vRaw != null && String(vRaw).trim().length > 0 ? String(vRaw).trim() : undefined;

      return res.json({
        ...market,
        ...(overlayVideo ? { videoUrl: overlayVideo } : {}),
        comments: shadow?.comments || [],
        _count: shadow?._count || { bets: 0, likes: 0, comments: 0 },
        userLiked: shadow?.likes ? (shadow.likes as any[]).length > 0 : false,
        userSaved: shadow?.saves ? (shadow.saves as any[]).length > 0 : false,
      });
    }

    const userId = req.auth?.userId;
  const market = await prisma.market.findUnique({
    where: { id: req.params.id },
    include: {
      comments: {
          include: { user: { select: { id: true, handle: true, avatar: true } } },
        orderBy: { createdAt: 'desc' },
        take: 20
      },
        priceHistory: {
          orderBy: { createdAt: 'asc' },
          take: 50
        },
      _count: {
          select: { bets: true, likes: true, comments: true }
      },
      likes: userId ? {
        where: { userId: String(userId) }
      } : false,
      saves: userId ? {
        where: { userId: String(userId) }
      } : false
    }
  });

    if (!market) return res.status(404).json({ error: "Market not found" });

    const formattedMarket = {
      ...market,
      userLiked: market.likes ? market.likes.length > 0 : false,
      userSaved: market.saves ? market.saves.length > 0 : false,
      likes: undefined,
      saves: undefined
    };

  res.json(formattedMarket);
  } catch (error) {
    console.error("Error fetching market detail:", error);
    const mapped = mapPrismaClientError(error);
    if (mapped) {
      return res.status(mapped.status).json({ error: mapped.error });
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/markets/:id/comments", requireAuth, async (req: AuthenticatedRequest, res) => {
  const { content } = req.body;
  const userId = req.auth!.userId;
  const marketId = req.params.id;

  try {
    const text = typeof content === "string" ? content.trim() : "";
    if (!text) return res.status(400).json({ error: "Comment cannot be empty" });
    if (text.length > 4000) return res.status(400).json({ error: "Comment is too long" });

    await ensureMarketExists(marketId);

    if (await isPolyMarketHiddenFromFeed(marketId)) {
      return res.status(404).json({ error: "Market not found" });
    }
    if (marketId.startsWith("poly_") && !(await assertPolyPublicFeedAccess(marketId, req, res))) return;

    const comment = await prisma.comment.create({
      data: { userId, marketId, content: text },
      include: { user: { select: { id: true, handle: true, avatar: true } } }
    });
    res.json(comment);
  } catch (error) {
    console.error("Comment error:", error);
    const mapped = mapPrismaClientError(error);
    if (mapped) {
      return res.status(mapped.status).json({ error: mapped.error });
    }
    res.status(500).json({ error: "Failed to post comment" });
  }
});

app.post("/api/bets", requireAuth, async (req: AuthenticatedRequest, res) => {
  const rawMarketId = req.body?.marketId;
  const rawSide = req.body?.side;
  const { amount } = req.body;
  const userId = req.auth!.userId;
  const numAmount = Number(amount);

  if (typeof rawMarketId !== "string" || !rawMarketId.trim()) {
    return res.status(400).json({ error: "marketId is required" });
  }
  const marketId = rawMarketId.trim();
  if (typeof rawSide !== "string" || !rawSide.trim()) {
    return res.status(400).json({ error: "side is required" });
  }
  const side = rawSide.trim();

  try {
    const userExists = await prisma.user.findUnique({ where: { id: userId } });
    if (!userExists) return res.status(401).json({ error: "Session expired. Please log in again." });

    if (!Number.isFinite(numAmount) || numAmount <= 0) {
      return res.status(400).json({ error: "Amount must be a positive number" });
    }

    // --- Polymarket bet flow ---
    if (marketId.startsWith('poly_')) {
      try {
        if (await isPolyMarketHiddenFromFeed(marketId)) {
          return res.status(404).json({ error: "Market not found" });
        }
        if (!(await assertPolyPublicFeedAccess(marketId, req, res))) return;

        const polyMarket = await getPolymarketMarketById(marketId);
        if (!polyMarket) return res.status(400).json({ error: "Polymarket market not found" });

        const outcomes: string[] = (polyMarket as any).outcomes ?? ['Yes', 'No'];
        const prices: number[] = (polyMarket as any).outcomePrices ?? [];
        const tokenIds: string[] = (polyMarket as any).tokenIds ?? [];

        const outcomeIndex = outcomes.findIndex(
          (o: string) => o.toLowerCase() === side.toLowerCase()
        );
        const tokenId = tokenIds[outcomeIndex >= 0 ? outcomeIndex : 0];
        const price = prices[outcomeIndex >= 0 ? outcomeIndex : 0] ?? 0.5;
        const odds = 1 / Math.max(0.01, price);

        if (!tokenId) return res.status(400).json({ error: "No token ID for selected outcome" });

        // 1. Reserve funds atomically (balance >= amount)
        const reserved = await prisma.user.updateMany({
          where: { id: userId, balance: { gte: numAmount } },
          data: { balance: { decrement: numAmount } },
        });
        if (reserved.count !== 1) {
          return res.status(400).json({ error: "Insufficient balance" });
        }

        // 2. Place order on Polymarket
        let orderResult: any;
        try {
          orderResult = await placePolymarketMarketOrder({
            tokenId,
            side: "BUY",
            amount: numAmount,
            price,
            tickSize: (polyMarket as any).tickSize,
            negRisk: (polyMarket as any).negRisk,
          });
        } catch (orderErr: any) {
          await prisma.user.updateMany({
        where: { id: userId },
            data: { balance: { increment: numAmount } },
          });
          console.error("Polymarket order failed, refunded:", orderErr);
          return res.status(500).json({ error: `Order failed: ${orderErr?.message || 'Unknown'}. Balance refunded.` });
        }

        // 3. Record bet — if DB fails, refund local balance (CLOB order may still exist; ops must reconcile)
        let bet;
        try {
          bet = await prisma.bet.create({
            data: {
              userId,
              externalMarketId: marketId,
              polymarketOrderId: orderResult?.orderID || null,
              amount: numAmount,
              side,
              odds,
              status: "pending",
            },
          });
        } catch (betErr) {
          console.error("Bet create failed after Polymarket order:", betErr);
          await prisma.user.updateMany({
            where: { id: userId },
            data: { balance: { increment: numAmount } },
          });
          return res.status(500).json({
            error:
              "Could not record bet; app balance was refunded. If funds moved on Polymarket, contact support with this timestamp.",
          });
        }

        const u = await prisma.user.findUnique({ where: { id: userId }, select: { balance: true } });
        return res.json({
          bet,
          balance: u?.balance ?? 0,
          polymarketOrder: orderResult,
        });
      } catch (e: any) {
        console.error("Polymarket bet error:", e);
        return res.status(500).json({ error: `Bet failed: ${e?.message || 'Unknown error'}` });
      }
    }

    // --- Internal market bet flow ---
    const sideUpper = side.toUpperCase();
    if (sideUpper !== "YES" && sideUpper !== "NO") {
      return res.status(400).json({ error: "side must be YES or NO" });
    }
    const sideNorm = sideUpper as "YES" | "NO";

    const marketExists = await prisma.market.findUnique({ where: { id: marketId } });
    if (!marketExists) return res.status(400).json({ error: "Market not found." });

    const result = await prisma.$transaction(async (tx) => {
      const dec = await tx.user.updateMany({
        where: { id: userId, balance: { gte: numAmount } },
        data: { balance: { decrement: numAmount } },
      });
      if (dec.count !== 1) {
        throw new Error("INSUFFICIENT_BALANCE");
      }

      const market = await tx.market.findUnique({ where: { id: marketId } });
      if (!market) {
        throw new Error("MARKET_NOT_FOUND");
      }

      const bet = await tx.bet.create({
        data: { userId, marketId, amount: numAmount, side: sideNorm },
      });

      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user) throw new Error("USER_MISSING");

      const totalPool = market.totalPool + numAmount;
      const impact = (numAmount / (totalPool || 1)) * 40;
        
        let newYes = market.yesPercent;
        let newNo = market.noPercent;

      if (sideNorm === "YES") {
          newYes = Math.min(99, market.yesPercent + impact);
          newNo = 100 - newYes;
        } else {
          newNo = Math.min(99, market.noPercent + impact);
          newYes = 100 - newNo;
        }

      const updatedMarket = await tx.market.update({
          where: { id: marketId },
          data: {
            totalPool,
            yesPercent: newYes,
            noPercent: newNo,
          bettorsCount: { increment: 1 },
        },
        include: {
          _count: {
            select: { bets: true, comments: true, likes: true },
          },
          priceHistory: {
            orderBy: { createdAt: "asc" },
            take: 50,
          },
        },
      });

      await tx.pricePoint.create({
        data: {
          marketId,
          value: newYes,
        },
      });

      return { bet, balance: user.balance, market: updatedMarket };
    });

    res.json(result);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "INSUFFICIENT_BALANCE") {
        return res.status(400).json({ error: "Insufficient balance" });
      }
      if (error.message === "MARKET_NOT_FOUND" || error.message === "USER_MISSING") {
        return res.status(400).json({ error: "Market not found" });
      }
    }
    console.error("Bet error:", error);
    const mapped = mapPrismaClientError(error);
    if (mapped) {
      return res.status(mapped.status).json({ error: mapped.error });
    }
    res.status(500).json({ error: "Failed to place bet" });
  }
});

app.post("/api/waitlist", waitlistLimiter, async (req: AuthenticatedRequest, res) => {
  try {
    const emailRaw = req.body?.email;
    if (typeof emailRaw !== "string" || !emailRaw.trim()) {
      return res.status(400).json({ error: "Valid email is required" });
    }
    const email = emailRaw.trim().slice(0, 254);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "Invalid email format" });
    }
    let intendedAmount = Number(req.body?.intendedAmount);
    if (!Number.isFinite(intendedAmount) || intendedAmount < 0) {
      intendedAmount = 0;
    }
    const userId = req.auth?.userId;
  const entry = await prisma.waitlist.create({
      data: { email, intendedAmount, userId },
  });
  res.json(entry);
  } catch (error) {
    console.error("Waitlist error:", error);
    const mapped = mapPrismaClientError(error);
    if (mapped) {
      return res.status(mapped.status).json({ error: mapped.error });
    }
    res.status(500).json({ error: "Failed to join waitlist" });
  }
});

app.post("/api/markets/:id/like", requireAuth, async (req: AuthenticatedRequest, res) => {
  const userId = req.auth!.userId;
  const marketId = req.params.id;
  
  try {
    await ensureMarketExists(marketId);

    if (await isPolyMarketHiddenFromFeed(marketId)) {
      return res.status(404).json({ error: "Market not found" });
    }
    if (marketId.startsWith("poly_") && !(await assertPolyPublicFeedAccess(marketId, req, res))) return;

    const existing = await prisma.like.findUnique({
      where: { userId_marketId: { userId, marketId } }
    });

    if (existing) {
      await prisma.like.delete({
        where: { id: existing.id }
      });
      res.json({ liked: false });
    } else {
      await prisma.like.create({
        data: { userId, marketId }
      });
      res.json({ liked: true });
    }
  } catch (error) {
    console.error("Like error:", error);
    const mapped = mapPrismaClientError(error);
    if (mapped) {
      return res.status(mapped.status).json({ error: mapped.error });
    }
    res.status(500).json({ error: "Failed to toggle like" });
  }
});

app.post("/api/markets/:id/save", requireAuth, async (req: AuthenticatedRequest, res) => {
  const userId = req.auth!.userId;
  const marketId = req.params.id;
  
  try {
    await ensureMarketExists(marketId);

    if (await isPolyMarketHiddenFromFeed(marketId)) {
      return res.status(404).json({ error: "Market not found" });
    }
    if (marketId.startsWith("poly_") && !(await assertPolyPublicFeedAccess(marketId, req, res))) return;

    const existing = await prisma.save.findUnique({
      where: { userId_marketId: { userId, marketId } }
    });

    if (existing) {
      await prisma.save.delete({
        where: { id: existing.id }
      });
      res.json({ saved: false });
    } else {
      await prisma.save.create({
        data: { userId, marketId }
      });
      res.json({ saved: true });
    }
  } catch (error) {
    console.error("Save error:", error);
    const mapped = mapPrismaClientError(error);
    if (mapped) {
      return res.status(mapped.status).json({ error: mapped.error });
    }
    res.status(500).json({ error: "Failed to toggle save" });
  }
});

app.post("/api/analytics", analyticsLimiter, async (req: AuthenticatedRequest, res) => {
  try {
    const eventName = req.body?.eventName;
    const metadata = req.body?.metadata;

    if (typeof eventName !== "string" || !eventName.trim() || eventName.length > 128) {
      return res.status(400).json({ error: "Invalid eventName" });
    }

    let metaStr: string | null = null;
    if (metadata !== undefined && metadata !== null) {
      if (typeof metadata === "string") {
        metaStr = metadata.slice(0, 8000);
      } else {
        try {
          metaStr = JSON.stringify(metadata).slice(0, 8000);
        } catch {
          return res.status(400).json({ error: "Invalid metadata" });
        }
      }
    }

    const validUserId = req.auth?.userId ?? null;

  const event = await prisma.analyticsEvent.create({
      data: { eventName: eventName.trim(), userId: validUserId, metadata: metaStr },
  });
  res.json(event);
  } catch (error) {
    console.error("Analytics error:", error);
    const mapped = mapPrismaClientError(error);
    if (mapped) {
      return res.status(mapped.status).json({ error: mapped.error });
    }
    res.status(500).json({ error: "Failed to log event" });
  }
});

// Proposal Endpoints
app.post("/api/proposals", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { title, description, category, imageUrl, videoUrl } = req.body;
    const userId = req.auth!.userId;

    const proposal = await prisma.marketProposal.create({
      data: { title, description, category, imageUrl, videoUrl, userId }
    });
    res.json(proposal);
  } catch (error) {
    console.error("Proposal creation error:", error);
    const mapped = mapPrismaClientError(error);
    if (mapped) {
      return res.status(mapped.status).json({ error: mapped.error });
    }
    res.status(500).json({ error: "Failed to create proposal" });
  }
});

app.get("/api/proposals", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const proposals = await prisma.marketProposal.findMany({
      orderBy: { createdAt: 'desc' },
      include: { user: true }
    });
    res.json(proposals);
  } catch (error) {
    console.error("Error fetching proposals:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/proposals/:id/approve", requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await prisma.$transaction(async (tx) => {
      const proposal = await tx.marketProposal.update({
        where: { id },
        data: { status: "APPROVED" }
      });

      const market = await tx.market.create({
        data: {
          title: proposal.title,
          description: proposal.description,
          category: proposal.category,
          imageUrl: proposal.imageUrl || "https://picsum.photos/seed/market/1200/675",
          videoUrl: proposal.videoUrl,
          creatorId: proposal.userId,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // Default 7 days
        }
      });

      return market;
    });
    res.json(result);
  } catch (error) {
    console.error("Approve proposal error:", error);
    const mapped = mapPrismaClientError(error);
    if (mapped) {
      return res.status(mapped.status).json({ error: mapped.error });
    }
    res.status(500).json({ error: "Failed to approve proposal" });
  }
});

app.post("/api/proposals/:id/reject", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const proposal = await prisma.marketProposal.update({
      where: { id },
      data: { status: "REJECTED" }
    });
    res.json(proposal);
  } catch (error) {
    console.error("Proposal rejection error:", error);
    res.status(500).json({ error: "Failed to reject proposal" });
  }
});

app.delete("/api/proposals/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.marketProposal.delete({
      where: { id }
    });
    res.json({ success: true });
  } catch (error) {
    console.error("Proposal deletion error:", error);
    res.status(500).json({ error: "Failed to delete proposal" });
  }
});

app.delete("/api/markets/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    if (id.startsWith("poly_")) {
      const existing = await ensureMarketExists(id);
      if (!existing) {
        return res.status(404).json({ error: "Market not found" });
      }
      await prisma.market.update({
        where: { id },
        data: { category: HIDDEN_MARKET_CATEGORY },
      });
      return res.json({ success: true, hidden: true });
    }

    // Delete related records first to avoid foreign key constraints in some DBs
    // though Prisma usually handles this if configured, but let's be safe
    await prisma.pricePoint.deleteMany({ where: { marketId: id } });
    await prisma.bet.deleteMany({ where: { marketId: id } });
    await prisma.comment.deleteMany({ where: { marketId: id } });
    await prisma.like.deleteMany({ where: { marketId: id } });
    await prisma.save.deleteMany({ where: { marketId: id } });
    
    await prisma.market.delete({
      where: { id }
    });
    res.json({ success: true });
  } catch (error) {
    console.error("Market deletion error:", error);
    res.status(500).json({ error: "Failed to delete market" });
  }
});

app.post("/api/uploads/video", requireAuth, (req, res) => {
  videoUpload.single("video")(req, res, (err: any) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({ error: "Video size too large. Max 50MB." });
      }
      return res.status(400).json({ error: err.message || "Video upload failed" });
    }

    const file = (req as express.Request & { file?: Express.Multer.File }).file;
    if (!file) {
      return res.status(400).json({ error: "Video file is required" });
    }

    const videoUrl = `/uploads/${file.filename}`;
    res.json({ url: videoUrl });
  });
});

// Demo/debug only: do not expose self-serve balance reset (was requireSelfOrAdmin).
app.post("/api/users/:id/refill", requireAuth, requireAdmin, async (req, res) => {
  try {
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { balance: 10000 }
    });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: "Failed to refill balance" });
  }
});

// Static path must be registered before `/api/users/:id` or `rankings` is captured as :id.
app.get("/api/users/rankings", async (req, res) => {
  try {
  const users = await prisma.user.findMany({
      orderBy: { totalWinnings: "desc" },
    select: {
      id: true,
      handle: true,
      avatar: true,
      balance: true,
        totalWinnings: true,
        _count: {
          select: { bets: true },
        },
      },
    });
    res.json(users);
  } catch (error) {
    console.error("Rankings error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/users/:id", requireAuth, requireSelfOrAdmin("id"), async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        handle: true,
        avatar: true,
        balance: true,
        email: true,
        role: true
      }
    });
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// Admin: full feed event list (Polymarket) + optional search; higher limit than public feed
// ?needsVideo=true — only events without a custom videoUrl overlay (scans a larger pool then slices)
app.get("/api/admin/feed-events", requireAuth, requireAdmin, async (req, res) => {
  try {
    const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 200));
    const offset = Math.max(0, Number(req.query.offset) || 0);
    const search = typeof req.query.search === "string" && req.query.search.trim()
      ? String(req.query.search).trim()
      : undefined;
    const needsVideo = parseBoolean(req.query.needsVideo, false);

    let fetchLimit = limit;
    let fetchOffset = offset;
    if (needsVideo) {
      fetchLimit = Math.min(500, offset + limit + 120);
      fetchOffset = 0;
    }

    let polyMarkets = await listPolymarketMarkets({
      limit: fetchLimit,
      offset: fetchOffset,
      active: true,
      search,
    });

    const hidden = await prisma.market.findMany({
      where: { category: HIDDEN_MARKET_CATEGORY },
      select: { id: true },
    });
    const hiddenSet = new Set(hidden.map(m => m.id));
    polyMarkets = polyMarkets.filter((m: any) => !hiddenSet.has(m.id));
    polyMarkets = await mergePolyShadowMedia(polyMarkets);

    if (needsVideo) {
      polyMarkets = polyMarkets.filter((m: any) => {
        const v = m.videoUrl;
        const noCustomVideo = v == null || String(v).trim() === "";
        if (!noCustomVideo) return false;
        if (m.skipNeedsVideoQueue) return false;
        if (m.publishedToFeed) return false;
        return true;
      });
      polyMarkets = polyMarkets.slice(offset, offset + limit);
    }

    res.json(polyMarkets);
  } catch (error) {
    console.error("admin feed-events:", error);
    res.status(500).json({ error: "Failed to load feed events" });
  }
});

// Admin: video overlay, publish to public feed, skip-needs-video flag (Polymarket shadow rows)
app.patch("/api/admin/markets/:id/video", requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  if (!id.startsWith("poly_")) {
    return res.status(400).json({ error: "Only Polymarket events (poly_*) support feed video overlay" });
  }

  const body = req.body as {
    videoUrl?: string | null;
    skipNeedsVideoQueue?: boolean;
    publishedToFeed?: boolean;
  };
  const data: {
    videoUrl?: string | null;
    skipNeedsVideoQueue?: boolean;
    publishedToFeed?: boolean;
  } = {};

  if ("videoUrl" in body) {
    const videoUrl = body.videoUrl;
    if (videoUrl !== null && videoUrl !== undefined && typeof videoUrl !== "string") {
      return res.status(400).json({ error: "videoUrl must be a string or null" });
    }
    if (videoUrl === null || videoUrl === undefined) {
      data.videoUrl = null;
    } else {
      const t = String(videoUrl).trim();
      if (t.length === 0) {
        data.videoUrl = null;
      } else if (/^https?:\/\//i.test(t) || t.startsWith("/uploads/")) {
        data.videoUrl = t;
      } else {
        return res.status(400).json({ error: "videoUrl must be http(s) URL or /uploads/ path" });
      }
    }
  }

  if ("skipNeedsVideoQueue" in body) {
    if (typeof body.skipNeedsVideoQueue !== "boolean") {
      return res.status(400).json({ error: "skipNeedsVideoQueue must be a boolean" });
    }
    data.skipNeedsVideoQueue = body.skipNeedsVideoQueue;
  }

  if ("publishedToFeed" in body) {
    if (typeof body.publishedToFeed !== "boolean") {
      return res.status(400).json({ error: "publishedToFeed must be a boolean" });
    }
    data.publishedToFeed = body.publishedToFeed;
  }

  if (Object.keys(data).length === 0) {
    return res.status(400).json({
      error: "Provide videoUrl, skipNeedsVideoQueue, and/or publishedToFeed",
    });
  }

  try {
    const shadow = await ensureMarketExists(id);
    if (!shadow) {
      return res.status(404).json({ error: "Polymarket market not found" });
    }

    let nextVideo: string | null =
      shadow.videoUrl != null && String(shadow.videoUrl).trim() !== ""
        ? String(shadow.videoUrl).trim()
        : null;
    if ("videoUrl" in body) {
      nextVideo =
        data.videoUrl != null && String(data.videoUrl).trim() !== ""
          ? String(data.videoUrl).trim()
          : null;
    }

    if ("videoUrl" in body) {
      const cleared =
        data.videoUrl === null ||
        (typeof data.videoUrl === "string" && data.videoUrl.trim() === "");
      if (cleared) {
        data.publishedToFeed = false;
      }
    }

    if (data.publishedToFeed === true) {
      if (!nextVideo) {
        return res.status(400).json({
          error: "Upload a loop video before publishing to the public feed",
        });
      }
    }

    const updated = await prisma.market.update({
      where: { id },
      data,
      select: { id: true, videoUrl: true, skipNeedsVideoQueue: true, publishedToFeed: true },
    });
    console.log("[admin] poly feed media updated", id, {
      hasVideo: Boolean(updated.videoUrl && String(updated.videoUrl).trim()),
      publishedToFeed: updated.publishedToFeed,
    });
    res.json(updated);
  } catch (error) {
    console.error("admin market video:", error);
    res.status(500).json({ error: "Failed to update event video" });
  }
});

// Admin User Management
app.get("/api/admin/users", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { search, page = "1", limit = "10" } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const where = search ? {
      OR: [
        { handle: { contains: String(search) } },
        { email: { contains: String(search) } }
      ]
    } : {};

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          handle: true,
          email: true,
          avatar: true,
          balance: true,
          role: true,
          createdAt: true,
      _count: {
        select: { bets: true }
      }
        }
      }),
      prisma.user.count({ where })
    ]);

    res.json({ users, total, pages: Math.ceil(total / take) });
  } catch (error) {
    console.error("Admin users error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/admin/users/:id/balance", requireAuth, requireAdmin, async (req, res) => {
  try {
    const amount = Number(req.body?.amount);
    if (!Number.isFinite(amount) || amount === 0) {
      return res.status(400).json({ error: "Amount must be a non-zero number" });
    }
    if (amount < 0) {
      const u = await prisma.user.findUnique({
        where: { id: req.params.id },
        select: { balance: true },
      });
      if (!u) return res.status(404).json({ error: "User not found" });
      if (u.balance + amount < 0) {
        return res.status(400).json({ error: "Adjustment would make balance negative" });
      }
    }
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { balance: { increment: amount } },
    });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: "Failed to update balance" });
  }
});

app.post("/api/admin/users/:id/winnings", requireAuth, requireAdmin, async (req, res) => {
  try {
    const amount = Number(req.body?.amount);
    if (!Number.isFinite(amount) || amount === 0) {
      return res.status(400).json({ error: "Amount must be a non-zero number" });
    }
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { totalWinnings: { increment: amount } }
    });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: "Failed to update winnings" });
  }
});

app.post("/api/admin/users/:id/role", requireAuth, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { role } = req.body;
    if (!["ADMIN", "USER"].includes(role)) {
      return res.status(400).json({ error: "Role must be ADMIN or USER" });
    }
    if (req.params.id === req.auth!.userId && role !== "ADMIN") {
      return res.status(400).json({ error: "Cannot revoke your own admin role" });
    }
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { role }
    });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: "Failed to update role" });
  }
});

app.get("/api/users/:id/bets", requireAuth, requireSelfOrAdmin("id"), async (req, res) => {
  try {
  const bets = await prisma.bet.findMany({
    where: { userId: req.params.id },
    include: { market: true },
    orderBy: { createdAt: 'desc' }
  });
  res.json(bets);
  } catch (error) {
    console.error("User bets error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/users/:id/saves", requireAuth, requireSelfOrAdmin("id"), async (req, res) => {
  try {
    const saves = await prisma.save.findMany({
      where: { userId: req.params.id },
      include: {
        market: {
          include: {
            _count: {
              select: { bets: true, comments: true, likes: true }
            }
          }
        }
      },
      orderBy: { id: "desc" }
    });
    res.json(saves.map(s => s.market));
  } catch (error) {
    console.error("User saves error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
// Payment Endpoints
app.post("/api/payments/create", requireAuth, paymentCreateLimiter, async (req: AuthenticatedRequest, res) => {
  const { amount, currency = "USD" } = req.body;
  const userId = req.auth!.userId;
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: "User not found" });
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ error: "Amount must be a positive number" });
    }
    if (numericAmount > MAX_DEPOSIT_AMOUNT) {
      return res.status(400).json({ error: `Maximum deposit is ${MAX_DEPOSIT_AMOUNT} USD` });
    }

    const orderId = `order_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

    const payment = await prisma.payment.create({
      data: {
        userId,
        amount: numericAmount,
        currency,
        orderId,
        status: "waiting",
      },
    });

    const apiKey = process.env.NOWPAYMENTS_API_KEY;
    const allowMock =
      process.env.NODE_ENV !== "production" || process.env.ALLOW_MOCK_PAYMENTS === "true";

    if (!apiKey) {
      if (!allowMock) {
        await prisma.payment.delete({ where: { id: payment.id } }).catch(() => {});
        return res.status(503).json({ error: "Payments are not configured" });
      }
      return res.json({
        payment_url: `https://nowpayments.io/payment/?order_id=${orderId}&amount=${numericAmount}`,
        mock: true,
        payment_id: "mock_id_" + orderId,
      });
    }

    const response = await fetch("https://api.nowpayments.io/v1/invoice", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        price_amount: numericAmount,
        price_currency: currency,
        ipn_callback_url: `${process.env.APP_URL}/api/payments/webhook`,
        order_id: orderId,
        order_description: `Top up for ${user.handle}`,
        success_url: `${process.env.APP_URL}`,
        cancel_url: `${process.env.APP_URL}`,
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error("NOWPayments invoice HTTP error:", response.status, data);
      await prisma.payment.delete({ where: { id: payment.id } }).catch(() => {});
      return res.status(502).json({ error: "Payment provider error" });
    }

    if (data.id) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { paymentId: String(data.id) },
      });
    }

    const payUrl = data.invoice_url || data.payment_url;
    if (!payUrl || typeof payUrl !== "string") {
      await prisma.payment.delete({ where: { id: payment.id } }).catch(() => {});
      return res.status(502).json({ error: "Invalid payment provider response" });
    }

    res.json({
      payment_url: payUrl,
      payment_id: data.id,
    });
  } catch (error) {
    console.error("Payment creation error:", error);
    res.status(500).json({ error: "Failed to create payment" });
  }
});

app.post("/api/payments/webhook", async (req: AuthenticatedRequest, res) => {
  if (!NOWPAYMENTS_IPN_SECRET) {
    return res.status(503).send("Webhook is disabled: NOWPAYMENTS_IPN_SECRET is missing");
  }
  const hmacHeader = String(req.headers["x-nowpayments-sig"] || "").trim();
  if (!hmacHeader) {
    return res.status(401).send("Missing signature");
  }

  const rawPayload = req.rawBody || JSON.stringify(req.body || {});
  const expectedSig = crypto.createHmac("sha512", NOWPAYMENTS_IPN_SECRET).update(rawPayload).digest("hex");

  try {
    const expectedBuffer = Buffer.from(expectedSig, "hex");
    const receivedBuffer = Buffer.from(hmacHeader, "hex");
    if (expectedBuffer.length !== receivedBuffer.length || !crypto.timingSafeEqual(expectedBuffer, receivedBuffer)) {
      return res.status(401).send("Invalid signature");
    }
  } catch {
    return res.status(401).send("Invalid signature");
  }

  const { payment_status, order_id } = req.body;

  try {
    const payment = await prisma.payment.findUnique({
      where: { orderId: order_id },
      include: { user: true }
    });

    if (!payment) return res.status(404).send('Payment not found');
    const webhookPaymentId = req.body?.payment_id ? String(req.body.payment_id) : null;
    if (payment.paymentId && webhookPaymentId && payment.paymentId !== webhookPaymentId) {
      return res.status(400).send("Payment id mismatch");
    }

    if (payment.status === "finished") {
      return res.send("OK");
    }

    if (payment_status === "finished") {
      const reported = Number(
        req.body?.price_amount ?? req.body?.actually_paid ?? req.body?.pay_amount
      );
      if (!Number.isFinite(reported)) {
        await prisma.payment.update({
          where: { id: payment.id },
          data: { status: "finished_unverified_amount" },
        });
        console.warn("IPN finished but no verifiable amount field; not crediting", order_id);
        return res.send("OK");
      }
      if (Math.abs(reported - payment.amount) > 0.02) {
        await prisma.payment.update({
          where: { id: payment.id },
          data: { status: "amount_mismatch" },
        });
        console.warn("IPN amount mismatch", { order_id, reported, expected: payment.amount });
        return res.send("OK");
      }

      const payCurRaw = req.body?.pay_currency ?? req.body?.price_currency;
      if (payCurRaw != null && String(payCurRaw).trim() !== "") {
        const payCur = String(payCurRaw).trim().toLowerCase();
        const expectedCur = String(payment.currency || "usd").trim().toLowerCase();
        if (payCur !== expectedCur) {
          await prisma.payment.update({
            where: { id: payment.id },
            data: { status: "currency_mismatch" },
          });
          console.warn("IPN currency mismatch", { order_id, payCur, expectedCur });
          return res.send("OK");
        }
      }

      await prisma.$transaction(async (tx) => {
        const locked = await tx.payment.updateMany({
          where: { id: payment.id, status: { not: "finished" } },
          data: { status: "finished" },
        });
        if (locked.count === 0) return;
        await tx.user.update({
          where: { id: payment.userId },
          data: { balance: { increment: payment.amount } },
        });
      });
    } else {
      const st = String(payment_status ?? "");
      const safe = PAYMENT_WEBHOOK_INTERIM_STATUSES.has(st) ? st : "provider_status_unknown";
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: safe },
      });
    }

    res.send("OK");
  } catch (error) {
    console.error("Webhook error:", error);
    res.status(500).send('Internal Server Error');
  }
});

// --- Auth: Email + Password ---
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;

app.post("/api/auth/register", authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !email.includes("@")) return res.status(400).json({ error: "Valid email required" });
    if (!password || password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({ error: "Registration could not be completed" });
    }

    const handle = email.split("@")[0].replace(/[^a-zA-Z0-9_]/g, "") + "_" + Math.floor(Math.random() * 10000);
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        provider: "email",
        handle,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${handle}`,
        balance: 0,
        role: isAdminEmail(email) ? "ADMIN" : "USER",
      },
    });

    const { password: _, ...safeUser } = user;
    const token = signAuthToken({ id: user.id, role: user.role });
    res.json({ ...safeUser, token, isNewUser: true });
  } catch (error) {
    console.error("Register error:", error);
    const mapped = mapPrismaClientError(error);
    if (mapped) {
      return res.status(mapped.status).json({ error: mapped.error });
    }
    res.status(500).json({ error: "Registration failed" });
  }
});

app.post("/api/auth/login", authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email and password required" });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(400).json({ error: "Invalid email or password" });

    if (user.provider === "google" && !user.password) {
      return res.status(400).json({ error: "This account uses Google Sign-In" });
    }

    const valid = await bcrypt.compare(password, user.password || "");
    if (!valid) return res.status(400).json({ error: "Invalid email or password" });

    const { password: _, ...safeUser } = user;
    const token = signAuthToken({ id: user.id, role: user.role });
    res.json({ ...safeUser, token, isNewUser: false });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Login failed" });
  }
});

// --- Auth: Google Sign-In ---
app.post("/api/auth/google", authLimiter, async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) return res.status(400).json({ error: "Google credential required" });
    if (!googleClient) {
      return res.status(503).json({ error: "Google auth is not configured" });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();

    if (!payload?.email || !payload?.sub || payload.email_verified !== true) {
      return res.status(400).json({ error: "Invalid Google token payload" });
    }

    let isNewUser = false;
    let user = await prisma.user.findUnique({ where: { email: payload.email } });

    if (user && user.provider === "email") {
      return res.status(409).json({
        error: "This email is registered with a password. Sign in with email or use a Google-only account.",
      });
    }

    if (!user) {
      isNewUser = true;
      const name = payload.name || payload.email.split("@")[0];
      const handle = name.replace(/[^a-zA-Z0-9_]/g, "").toLowerCase() + "_" + Math.floor(Math.random() * 10000);
      user = await prisma.user.create({
        data: {
          email: payload.email,
          provider: "google",
          handle,
          avatar: payload.picture || `https://api.dicebear.com/7.x/avataaars/svg?seed=${handle}`,
          balance: 0,
          role: isAdminEmail(payload.email) ? "ADMIN" : "USER",
        },
      });
    }

    const { password: _, ...safeUser } = user as any;
    const token = signAuthToken({ id: user.id, role: user.role });
    res.json({ ...safeUser, token, isNewUser });
  } catch (error) {
    console.error("Google auth error:", error);
    res.status(500).json({ error: "Google authentication failed" });
  }
});

// Legacy mock endpoint (redirect to login)
app.post("/api/auth/mock", async (req, res) => {
  return res.status(410).json({ error: "Mock auth is disabled" });
});

// --- Withdrawal ---
const WITHDRAWAL_FEE_PERCENT = 5;
const WITHDRAWAL_FEE_MIN = 1;
const WITHDRAWAL_MIN = 10;

app.get("/api/withdrawal-info", (req, res) => {
  res.json({ feePercent: WITHDRAWAL_FEE_PERCENT, feeMin: WITHDRAWAL_FEE_MIN, minAmount: WITHDRAWAL_MIN });
});

app.post("/api/withdrawals", requireAuth, async (req: AuthenticatedRequest, res) => {
  const { amount, address } = req.body;
  const userId = req.auth!.userId;
  try {
    if (!amount || !address) return res.status(400).json({ error: "amount and wallet address required" });
    const numAmount = Number(amount);
    if (numAmount < WITHDRAWAL_MIN) return res.status(400).json({ error: `Minimum withdrawal is $${WITHDRAWAL_MIN}` });

    const fee = Math.max(WITHDRAWAL_FEE_MIN, numAmount * WITHDRAWAL_FEE_PERCENT / 100);
    const totalDeducted = numAmount + fee;
    const payout = numAmount;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(401).json({ error: "User not found" });
    if (user.balance < totalDeducted) {
      return res.status(400).json({
        error: `Insufficient balance. Need $${totalDeducted.toFixed(2)} (amount + ${WITHDRAWAL_FEE_PERCENT}% fee)`,
      });
    }

    const withdrawal = await prisma.$transaction(async (tx) => {
      const dec = await tx.user.updateMany({
        where: { id: userId, balance: { gte: totalDeducted } },
        data: { balance: { decrement: totalDeducted } },
      });
      if (dec.count !== 1) {
        throw new Error("INSUFFICIENT_BALANCE");
      }
      return tx.withdrawal.create({
        data: { userId, amount: payout, address: String(address).trim(), status: "pending" },
      });
    });

    res.json({ ...withdrawal, fee, totalDeducted });
  } catch (error) {
    if (error instanceof Error && error.message === "INSUFFICIENT_BALANCE") {
      return res.status(400).json({ error: "Insufficient balance" });
    }
    console.error("Withdrawal error:", error);
    res.status(500).json({ error: "Withdrawal request failed" });
  }
});

app.get("/api/users/:id/withdrawals", requireAuth, requireSelfOrAdmin("id"), async (req, res) => {
  const withdrawals = await prisma.withdrawal.findMany({
    where: { userId: req.params.id },
    orderBy: { createdAt: 'desc' }
  });
  res.json(withdrawals);
});

// Admin: process withdrawal
app.post("/api/admin/withdrawals/:id/process", requireAuth, requireAdmin, async (req, res) => {
  const { status } = req.body; // "completed" or "rejected"
  try {
    const withdrawal = await prisma.withdrawal.findUnique({ where: { id: req.params.id } });
    if (!withdrawal) return res.status(404).json({ error: "Not found" });
    if (withdrawal.status !== "pending") return res.status(400).json({ error: "Already processed" });

    if (status === "rejected") {
      const originalAmount = withdrawal.amount;
      const refundFee = Math.max(WITHDRAWAL_FEE_MIN, (originalAmount * WITHDRAWAL_FEE_PERCENT) / 100);
      const refundTotal = originalAmount + refundFee;
      await prisma.$transaction([
        prisma.withdrawal.update({ where: { id: withdrawal.id }, data: { status: "rejected", processedAt: new Date() } }),
        prisma.user.update({ where: { id: withdrawal.userId }, data: { balance: { increment: refundTotal } } }),
      ]);
    } else if (status === "completed") {
      await prisma.withdrawal.update({
        where: { id: withdrawal.id },
        data: { status: "completed", processedAt: new Date() },
      });
    } else {
      return res.status(400).json({ error: 'status must be "completed" or "rejected"' });
    }
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to process withdrawal" });
  }
});

// --- Market Resolution (Polymarket) ---
app.post("/api/admin/resolve-bets", requireAuth, requireAdmin, async (req, res) => {
  // Check and resolve pending Polymarket bets
  try {
    const pendingBets = await prisma.bet.findMany({
      where: { status: "pending", externalMarketId: { not: null } },
      distinct: ['externalMarketId'],
    });

    const marketIds = [...new Set(pendingBets.map(b => b.externalMarketId!))];
    let resolved = 0;

    for (const extId of marketIds) {
      try {
        const market = await getPolymarketMarketById(extId);
        if (!market) continue;
        const isClosed = (market as any).closed === true;
        if (!isClosed) continue;

        // Market is closed — determine winning outcome
        const outcomes: string[] = (market as any).outcomes ?? ['Yes', 'No'];
        const prices: number[] = (market as any).outcomePrices ?? [];

        // Winning outcome has price ~1.0, losing has ~0.0
        const winningIdx = prices.indexOf(Math.max(...prices));
        const winningOutcome = winningIdx >= 0 ? outcomes[winningIdx] : null;
        if (!winningOutcome || Math.max(...prices) < 0.9) continue; // Not yet fully resolved

        // Resolve all bets on this market
        const betsOnMarket = await prisma.bet.findMany({
          where: { externalMarketId: extId, status: "pending" }
        });

        for (const bet of betsOnMarket) {
          const won = bet.side.toLowerCase() === winningOutcome.toLowerCase();
          const payout = won ? bet.amount * bet.odds : 0;

          await prisma.$transaction([
            prisma.bet.update({
              where: { id: bet.id },
              data: { status: won ? "won" : "lost", payout, resolvedAt: new Date() }
            }),
            ...(won ? [
              prisma.user.update({
                where: { id: bet.userId },
                data: {
                  balance: { increment: payout },
                  totalWinnings: { increment: payout - bet.amount }
                }
              })
            ] : [])
          ]);
          resolved++;
        }
      } catch (e) {
        console.error(`Failed to resolve market ${extId}:`, e);
      }
    }

    res.json({ checked: marketIds.length, resolved });
  } catch (error) {
    console.error("Resolve bets error:", error);
    res.status(500).json({ error: "Resolution failed" });
  }
});

async function startServer() {
  console.log("Starting server...");
  try {
    if (!JWT_SECRET) {
      throw new Error("JWT_SECRET is required");
    }
    if (!GOOGLE_CLIENT_ID) {
      console.warn("GOOGLE_CLIENT_ID is not configured. Google auth endpoint will return 503.");
    }
    if (!NOWPAYMENTS_IPN_SECRET) {
      console.warn("NOWPAYMENTS_IPN_SECRET is not configured. Payment webhook endpoint is disabled.");
    }

    console.log("Testing database connection...");
    await prisma.$connect();
    console.log("Database connected successfully.");

  if (process.env.NODE_ENV !== "production") {
      console.log("Initializing Vite in middleware mode...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
      console.log("Vite middleware initialized.");
  } else {
      const distPath = path.join(process.cwd(), "dist");
      app.use(express.static(distPath));
    app.get("*", (req, res) => {
        res.sendFile(path.join(distPath, "index.html"));
    });
  }

    const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
    server.on("error", (err: any) => {
      if (err?.code === "EADDRINUSE") {
        console.error(`Port ${PORT} is already in use. Stop the other process or change PORT.`);
      } else {
        console.error("Server listen error:", err);
      }
      process.exit(1);
    });

    const shutdown = () => {
      console.log("Shutting down...");
      server.close(async () => {
        await prisma.$disconnect().catch(() => {});
        process.exit(0);
      });
      setTimeout(() => process.exit(1), 3000);
    };
    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("Global error handler:", err);
  const isDev = process.env.NODE_ENV === "development";
  res.status(500).json({
    error: isDev ? err.message || "Internal Server Error" : "Internal Server Error",
    stack: isDev ? err.stack : undefined,
  });
});

startServer();
