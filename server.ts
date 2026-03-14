import express from "express";
import { createServer as createViteServer } from "vite";
import { PrismaClient } from "@prisma/client";
import path from "path";
import crypto from "crypto";

const prisma = new PrismaClient();
const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// API Routes
app.get("/api/health", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", database: "connected" });
  } catch (error) {
    res.status(500).json({ status: "error", message: error instanceof Error ? error.message : String(error) });
  }
});

app.get("/api/markets", async (req, res) => {
  try {
    const { userId, category } = req.query;
    const where: any = {};
    if (category) {
      where.category = String(category);
    }

    const markets = await prisma.market.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { bets: true, comments: true, likes: true }
        },
        priceHistory: {
          orderBy: { createdAt: 'asc' },
          take: 50
        },
        likes: userId ? {
          where: { userId: String(userId) }
        } : false,
        saves: userId ? {
          where: { userId: String(userId) }
        } : false
      }
    });

    const formattedMarkets = markets.map(m => ({
      ...m,
      userLiked: m.likes ? m.likes.length > 0 : false,
      userSaved: m.saves ? m.saves.length > 0 : false,
      likes: undefined,
      saves: undefined
    }));

    res.json(formattedMarkets);
  } catch (error) {
    console.error("Error fetching markets:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/markets/:id", async (req, res) => {
  try {
    const { userId } = req.query;
    const market = await prisma.market.findUnique({
      where: { id: req.params.id },
      include: {
        comments: {
          include: { user: true },
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
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/markets/:id/comments", async (req, res) => {
  const { userId, content } = req.body;
  const marketId = req.params.id;

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(401).json({ error: "User not found" });

    const comment = await prisma.comment.create({
      data: { userId, marketId, content },
      include: { user: true }
    });
    res.json(comment);
  } catch (error) {
    res.status(500).json({ error: "Failed to post comment" });
  }
});

app.post("/api/bets", async (req, res) => {
  const { userId, marketId, amount, side } = req.body;
  
  try {
    // Check if user and market exist first
    const userExists = await prisma.user.findUnique({ where: { id: userId } });
    if (!userExists) return res.status(401).json({ error: "Session expired. Please log in again." });
    
    const marketExists = await prisma.market.findUnique({ where: { id: marketId } });
    if (!marketExists) return res.status(400).json({ error: "Market not found." });

    if (userExists.balance < amount) {
      // Auto-refill for demo purposes to ensure smooth testing
      await prisma.user.update({
        where: { id: userId },
        data: { balance: { increment: 10000 } }
      });
      const updatedUser = await prisma.user.findUnique({ where: { id: userId } });
      if (updatedUser) {
        userExists.balance = updatedUser.balance;
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create the bet
      const bet = await tx.bet.create({
        data: { userId, marketId, amount, side }
      });

      // 2. Update user balance
      const user = await tx.user.update({
        where: { id: userId },
        data: { balance: { decrement: amount } }
      });

      // 3. Update market stats
      const market = await tx.market.findUnique({ where: { id: marketId } });
      if (market) {
        const totalPool = market.totalPool + amount;
        const impact = (amount / (totalPool || 1)) * 40;
        
        let newYes = market.yesPercent;
        let newNo = market.noPercent;

        if (side === "YES") {
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
            bettorsCount: { increment: 1 }
          },
          include: {
            _count: {
              select: { bets: true, comments: true, likes: true }
            },
            priceHistory: {
              orderBy: { createdAt: 'asc' },
              take: 50
            }
          }
        });

        // 4. Record price history point
        await tx.pricePoint.create({
          data: {
            marketId,
            value: newYes,
          }
        });

        return { bet, balance: user.balance, market: updatedMarket };
      }

      return { bet, balance: user.balance };
    });

    res.json(result);
  } catch (error) {
    console.error("Bet error:", error);
    res.status(500).json({ error: "Failed to place bet" });
  }
});

app.post("/api/waitlist", async (req, res) => {
  try {
    const { email, intendedAmount, userId } = req.body;
    const entry = await prisma.waitlist.create({
      data: { email, intendedAmount, userId }
    });
    res.json(entry);
  } catch (error) {
    console.error("Waitlist error:", error);
    res.status(500).json({ error: "Failed to join waitlist" });
  }
});

app.post("/api/markets/:id/like", async (req, res) => {
  const { userId } = req.body;
  const marketId = req.params.id;
  
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(401).json({ error: "User not found" });

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
    res.status(500).json({ error: "Failed to toggle like" });
  }
});

app.post("/api/markets/:id/save", async (req, res) => {
  const { userId } = req.body;
  const marketId = req.params.id;
  
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(401).json({ error: "User not found" });

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
    res.status(500).json({ error: "Failed to toggle save" });
  }
});

app.post("/api/analytics", async (req, res) => {
  try {
    const { eventName, userId, metadata } = req.body;
    
    // Validate userId if provided
    let validUserId = userId;
    if (userId) {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) validUserId = null; // Don't fail the event, just detach from user
    }

    const event = await prisma.analyticsEvent.create({
      data: { eventName, userId: validUserId, metadata: JSON.stringify(metadata) }
    });
    res.json(event);
  } catch (error) {
    console.error("Analytics error:", error);
    res.status(500).json({ error: "Failed to log event" });
  }
});

// Proposal Endpoints
app.post("/api/proposals", async (req, res) => {
  try {
    const { title, description, category, imageUrl, videoUrl, userId } = req.body;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(401).json({ error: "User not found" });

    const proposal = await prisma.marketProposal.create({
      data: { title, description, category, imageUrl, videoUrl, userId }
    });
    res.json(proposal);
  } catch (error) {
    console.error("Proposal creation error:", error);
    res.status(500).json({ error: "Failed to create proposal" });
  }
});

app.get("/api/proposals", async (req, res) => {
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

app.post("/api/proposals/:id/approve", async (req, res) => {
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
    res.status(500).json({ error: "Failed to approve proposal" });
  }
});

app.post("/api/proposals/:id/reject", async (req, res) => {
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

app.delete("/api/proposals/:id", async (req, res) => {
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

app.delete("/api/markets/:id", async (req, res) => {
  try {
    const { id } = req.params;
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

app.post("/api/users/:id/refill", async (req, res) => {
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

app.get("/api/users/:id", async (req, res) => {
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

// Admin User Management
app.get("/api/admin/users", async (req, res) => {
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

app.post("/api/admin/users/:id/balance", async (req, res) => {
  try {
    const { amount } = req.body;
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { balance: { increment: Number(amount) } }
    });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: "Failed to update balance" });
  }
});

app.post("/api/admin/users/:id/winnings", async (req, res) => {
  try {
    const { amount } = req.body;
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { totalWinnings: { increment: Number(amount) } }
    });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: "Failed to update winnings" });
  }
});

app.post("/api/admin/users/:id/role", async (req, res) => {
  try {
    const { role } = req.body;
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { role }
    });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: "Failed to update role" });
  }
});

app.get("/api/users/rankings", async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { totalWinnings: 'desc' },
      select: {
        id: true,
        handle: true,
        avatar: true,
        balance: true,
        totalWinnings: true,
        _count: {
          select: { bets: true }
        }
      }
    });
    res.json(users);
  } catch (error) {
    console.error("Rankings error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/users/:id/bets", async (req, res) => {
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

app.get("/api/users/:id/saves", async (req, res) => {
  try {
    const saves = await prisma.save.findMany({
      where: { userId: req.params.id },
      include: { market: {
        include: {
          _count: {
            select: { bets: true, comments: true, likes: true }
          }
        }
      } },
      orderBy: { id: 'desc' }
    });
    res.json(saves.map(s => s.market));
  } catch (error) {
    console.error("User saves error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Payment Endpoints
app.post("/api/payments/create", async (req, res) => {
  const { userId, amount, currency = "USD" } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: "User not found" });

    const orderId = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Create payment record in DB
    const payment = await prisma.payment.create({
      data: {
        userId,
        amount: Number(amount),
        currency,
        orderId,
        status: "waiting"
      }
    });

    const apiKey = process.env.NOWPAYMENTS_API_KEY;
    if (!apiKey) {
      // For demo purposes if API key is missing, we'll just mock the redirect
      return res.json({
        payment_url: `https://nowpayments.io/payment/?order_id=${orderId}&amount=${amount}`,
        mock: true,
        payment_id: "mock_id_" + orderId
      });
    }

    const response = await fetch("https://api.nowpayments.io/v1/payment", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        price_amount: amount,
        price_currency: currency,
        pay_currency: "btc",
        ipn_callback_url: `${process.env.APP_URL}/api/payments/webhook`,
        order_id: orderId,
        order_description: `Top up for ${user.handle}`
      })
    });

    const data = await response.json();
    
    if (data.payment_id) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { paymentId: String(data.payment_id) }
      });
    }

    res.json(data);
  } catch (error) {
    console.error("Payment creation error:", error);
    res.status(500).json({ error: "Failed to create payment" });
  }
});

app.post("/api/payments/webhook", async (req, res) => {
  const hmacHeader = req.headers['x-nowpayments-sig'];
  const ipnSecret = process.env.NOWPAYMENTS_IPN_SECRET;
  
  // Verify signature if secret is provided
  if (ipnSecret && hmacHeader) {
    const hmac = crypto.createHmac('sha512', ipnSecret);
    const sortedData = Object.keys(req.body).sort().reduce((obj: any, key) => {
        obj[key] = req.body[key];
        return obj;
    }, {});
    const hmacData = JSON.stringify(sortedData);
    const calculatedHmac = hmac.update(hmacData).digest('hex');
    
    if (calculatedHmac !== hmacHeader) {
      return res.status(400).send('Invalid signature');
    }
  }

  const { payment_status, order_id } = req.body;

  try {
    const payment = await prisma.payment.findUnique({
      where: { orderId: order_id },
      include: { user: true }
    });

    if (!payment) return res.status(404).send('Payment not found');

    if (payment_status === 'finished' && payment.status !== 'finished') {
      await prisma.$transaction([
        prisma.payment.update({
          where: { id: payment.id },
          data: { status: 'finished' }
        }),
        prisma.user.update({
          where: { id: payment.userId },
          data: { balance: { increment: payment.amount } }
        })
      ]);
    } else {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: payment_status }
      });
    }

    res.send('OK');
  } catch (error) {
    console.error("Webhook error:", error);
    res.status(500).send('Internal Server Error');
  }
});

// Auth Mock (Simple)
app.post("/api/auth/mock", async (req, res) => {
  try {
    const { email, handle } = req.body;
    
    // Check if user exists by handle or email
    let isNewUser = false;
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { handle },
          { email }
        ]
      }
    });

    if (!user) {
      isNewUser = true;
      user = await prisma.user.create({
        data: {
          email,
          handle,
          avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${handle}`,
          balance: 0, // Start with 0 as requested to force top-up
          role: email === "hello@zerocoder.com" ? "ADMIN" : "USER"
        }
      });
    } else if (user.handle !== handle) {
      // Handle exists but email doesn't match, or vice versa
      // For mock auth, let's just return the existing user if email matches
      // but if handle is taken by another email, we should error
      if (user.email !== email) {
        return res.status(400).json({ error: "Handle or Email already taken" });
      }
    }
    
    res.json({ ...user, isNewUser });
  } catch (error) {
    console.error("Auth error:", error);
    res.status(500).json({ error: "Authentication failed" });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("Global error handler:", err);
  res.status(500).json({ 
    error: err.message || "Internal Server Error",
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

startServer();
