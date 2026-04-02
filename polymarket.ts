import { ClobClient, OrderType, Side, type TickSize } from "@polymarket/clob-client";
import { Wallet } from "ethers";

// Configure HTTP CONNECT proxy for Polymarket CLOB (geo-restricted from RU)
import { HttpsProxyAgent } from "https-proxy-agent";
import axios from "axios";

const CLOB_PROXY = process.env.CLOB_PROXY_URL || "";
if (CLOB_PROXY) {
  const agent = new HttpsProxyAgent(CLOB_PROXY);
  // Make agent non-serializable to avoid circular JSON errors
  Object.defineProperty(agent, 'toJSON', { value: () => '[Proxy]', enumerable: false });

  axios.interceptors.request.use((config) => {
    const url = (config.url || "") + (config.baseURL || "");
    if (url.includes("clob.polymarket.com")) {
      config.httpsAgent = agent;
      config.proxy = false;
    }
    return config;
  });

  // Also patch JSON.stringify to handle circular refs from agent
  const origStringify = JSON.stringify;
  JSON.stringify = function(value: any, replacer?: any, space?: any) {
    try {
      return origStringify(value, replacer, space);
    } catch (e: any) {
      if (e.message?.includes('circular')) {
        return origStringify(value, (key, val) => {
          if (val && typeof val === 'object' && val.constructor?.name === 'HttpsProxyAgent') return '[Proxy]';
          if (key === 'httpAgent' || key === 'httpsAgent') return undefined;
          return typeof replacer === 'function' ? replacer(key, val) : val;
        }, space);
      }
      throw e;
    }
  };

  console.log(`[polymarket] CLOB proxy: ${CLOB_PROXY ? "<configured>" : "off"}`);
}

const DEFAULT_GAMMA_URL = "https://gamma-api.polymarket.com";
const DEFAULT_CLOB_URL = "https://clob.polymarket.com";
const DEFAULT_CHAIN_ID = 137;
const DEFAULT_MARKETS_TTL_SEC = 20;

type GammaMarket = {
  id: string | number;
  question?: string;
  description?: string;
  image?: string;
  icon?: string;
  outcomes?: string | string[];
  outcomePrices?: string | string[];
  volumeClob?: number;
  volume?: string | number;
  liquidityClob?: number;
  liquidity?: string | number;
  active?: boolean;
  closed?: boolean;
  endDate?: string;
  category?: string;
  tags?: Array<{ label?: string }>;
  clobTokenIds?: string | string[];
  orderPriceMinTickSize?: number;
  negRisk?: boolean;
  spread?: number;
  oneDayPriceChange?: number;
};

type GammaTag = {
  id: string | number;
  label?: string;
  slug?: string;
};

type MarketCache = {
  expiresAt: number;
  key: string;
  value: unknown;
};

type PlaceLimitOrderInput = {
  tokenId: string;
  side: "BUY" | "SELL";
  price: number;
  size: number;
  orderType?: "GTC" | "GTD";
  tickSize?: TickSize;
  negRisk?: boolean;
  expiration?: number;
};

type PlaceMarketOrderInput = {
  tokenId: string;
  side: "BUY" | "SELL";
  amount: number;
  price: number;
  orderType?: "FOK" | "FAK";
  tickSize?: TickSize;
  negRisk?: boolean;
};

let marketCache: MarketCache | null = null;
let tradingClientPromise: Promise<ClobClient> | null = null;

function getEnv(name: string, fallback?: string): string {
  const value = process.env[name];
  return value && value.length > 0 ? value : fallback ?? "";
}

function getChainId(): number {
  const chainId = Number(getEnv("POLYMARKET_CHAIN_ID", String(DEFAULT_CHAIN_ID)));
  return Number.isFinite(chainId) && chainId > 0 ? chainId : DEFAULT_CHAIN_ID;
}

function getGammaUrl(): string {
  return getEnv("POLYMARKET_GAMMA_URL", DEFAULT_GAMMA_URL);
}

function getClobUrl(): string {
  return getEnv("POLYMARKET_CLOB_URL", DEFAULT_CLOB_URL);
}

function getTtlMs(): number {
  const ttlSec = Number(
    getEnv("POLYMARKET_MARKETS_TTL_SEC", String(DEFAULT_MARKETS_TTL_SEC)),
  );
  if (!Number.isFinite(ttlSec) || ttlSec <= 0) return DEFAULT_MARKETS_TTL_SEC * 1000;
  return ttlSec * 1000;
}

function parseMaybeJsonArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item));
  }
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => String(item));
    }
  } catch {
    // Return empty array when payload is malformed.
  }
  return [];
}

function toNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function inferCategory(market: GammaMarket): string {
  if (market.category && market.category.trim().length > 0) {
    return market.category;
  }
  const firstTag = market.tags?.find((t) => t?.label && t.label.trim().length > 0);
  if (firstTag?.label) return firstTag.label;

  const q = ((market.question ?? "") + " " + (market.description ?? "")).toLowerCase();
  if (/nba|nfl|ufc|soccer|football|sport|game\b|match\b|league|cup\b|win\b.*vs|vs\b.*win|lakers|celtics|warriors|spurs|hawks|magic|rockets|suns|lol:|esport|brentford|rayo|madrid|bilibili|gen\.g|jazz|kings|nuggets|76ers|cavaliers|champion/.test(q)) return "Sports";
  if (/war\b|ukraine|russia|china|iran|israel|nato|strike|regime|military|cease|peace|netanyahu|putin|zelensky|hamas|hezbollah/.test(q)) return "World";
  if (/fed\b|interest rate|inflation|gdp|s&p|nasdaq|dow|treasury|bond|recession|tariff|stock/.test(q)) return "Finance";
  if (/trump|biden|obama|elect|president|vote|senat|congress|governor|democrat|republican|primary|nominee|nomination|politic|parliament|minister|musk.*tweet/.test(q)) return "Politics";
  if (/bitcoin|crypto|eth\b|btc|token|defi|solana|polygon|binance|coinbase|nft/.test(q)) return "Crypto";
  if (/\bai\b|openai|google|apple|tech|software|microsoft|meta\b|tesla|spacex|chip|semiconductor/.test(q)) return "Tech";
  if (/climate|weather|temperature|hurricane|earthquake|nasa|space|science/.test(q)) return "Science";
  if (/oscar|grammy|movie|music|album|artist|netflix|disney|celebrity/.test(q)) return "Culture";
  return "Event";
}

function mapGammaMarket(market: GammaMarket) {
  const outcomes = parseMaybeJsonArray(market.outcomes);
  const prices = parseMaybeJsonArray(market.outcomePrices).map((p) => toNumber(p));
  const yesOutcomeIndex = outcomes.findIndex((o) => o.toLowerCase() === "yes");
  const noOutcomeIndex = outcomes.findIndex((o) => o.toLowerCase() === "no");
  const yesPrice =
    yesOutcomeIndex >= 0 ? prices[yesOutcomeIndex] : toNumber(prices[0], 0.5);
  const noPrice = noOutcomeIndex >= 0 ? prices[noOutcomeIndex] : Math.max(0, 1 - yesPrice);
  const clobTokenIds = parseMaybeJsonArray(market.clobTokenIds);

  return {
    id: `poly_${market.id}`,
    externalId: String(market.id),
    source: "polymarket",
    title: market.question ?? "Untitled market",
    description: market.description ?? "",
    category: inferCategory(market),
    imageUrl: market.image ?? market.icon ?? "",
    yesPercent: yesPrice * 100,
    noPercent: noPrice * 100,
    totalPool: toNumber(market.liquidityClob ?? market.liquidity),
    bettorsCount: Math.round(toNumber(market.volumeClob ?? market.volume) / 5000),
    expiresAt: market.endDate ?? null,
    active: market.active ?? false,
    closed: market.closed ?? false,
    volume: toNumber(market.volumeClob ?? market.volume),
    liquidity: toNumber(market.liquidityClob ?? market.liquidity),
    spread: toNumber(market.spread),
    oneDayPriceChange: toNumber(market.oneDayPriceChange),
    outcomes,
    outcomePrices: prices,
    tokenIds: clobTokenIds,
    tickSize: String(market.orderPriceMinTickSize ?? "0.01"),
    negRisk: Boolean(market.negRisk),
    _count: { bets: 0, comments: 0, likes: 0 },
    userLiked: false,
    userSaved: false,
    comments: [],
  };
}

async function gammaFetch<T>(pathname: string, params?: Record<string, string>) {
  const query = new URLSearchParams(params ?? {}).toString();
  const url = `${getGammaUrl()}${pathname}${query ? `?${query}` : ""}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Gamma API request failed: ${response.status} ${response.statusText}`);
  }
  return (await response.json()) as T;
}

function buildCacheKey(pathname: string, params?: Record<string, string>): string {
  const sorted = Object.entries(params ?? {})
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
  return `${pathname}?${sorted}`;
}

async function cachedGammaFetch<T>(pathname: string, params?: Record<string, string>) {
  const key = buildCacheKey(pathname, params);
  const now = Date.now();
  if (marketCache && marketCache.key === key && marketCache.expiresAt > now) {
    return marketCache.value as T;
  }
  const value = await gammaFetch<T>(pathname, params);
  marketCache = { key, value, expiresAt: now + getTtlMs() };
  return value;
}

export async function listPolymarketMarkets(input: {
  limit?: number;
  offset?: number;
  active?: boolean;
  closed?: boolean;
  search?: string;
  tagId?: string;
  includePast?: boolean;
}) {
  const normalizedLimit = Math.min(500, Math.max(1, input.limit ?? 100));
  const normalizedOffset = Math.max(0, input.offset ?? 0);
  const baseParams: Record<string, string> = {
    active: String(input.active ?? true),
    closed: String(input.closed ?? false),
    order: "volume24hr",
    ascending: "false",
  };
  const searchTerm = input.search?.trim().toLowerCase() ?? "";
  if (input.tagId && input.tagId.trim().length > 0) {
    baseParams.tag_id = input.tagId.trim();
  }

  const includePast = Boolean(input.includePast);
  const now = Date.now();
  const isRelevantByDate = (market: ReturnType<typeof mapGammaMarket>) => {
    if (includePast) return true;
    if (!market.expiresAt) return true;
    const endTs = Date.parse(market.expiresAt);
    if (!Number.isFinite(endTs)) return true;
    return endTs >= now;
  };

  // Fetch multiple pages from Gamma API to get enough markets
  const maxPages = searchTerm ? 3 : 5;
  const pageSize = 100;
  let offset = normalizedOffset;
  let pagesScanned = 0;
  const collected: ReturnType<typeof mapGammaMarket>[] = [];
  const searchWords = searchTerm ? searchTerm.split(/\s+/).filter(Boolean) : [];

  while (collected.length < normalizedLimit && pagesScanned < maxPages) {
    const params = { ...baseParams, limit: String(pageSize), offset: String(offset) };
    const page = pagesScanned === 0 && !searchTerm
      ? await cachedGammaFetch<GammaMarket[]>("/markets", params)
      : await gammaFetch<GammaMarket[]>("/markets", params);
    if (!Array.isArray(page) || page.length === 0) break;

    const mapped = page.map(mapGammaMarket).filter((m) => {
      if (!isRelevantByDate(m)) return false;
      if (searchWords.length > 0) {
        const haystack = `${m.title} ${m.description} ${m.category}`.toLowerCase();
        return searchWords.some((w) => haystack.includes(w));
      }
      return true;
    });
    collected.push(...mapped);
    offset += page.length;
    pagesScanned += 1;
  }

  return collected.slice(0, normalizedLimit);
}

export async function listPolymarketTags(limit = 200) {
  const params: Record<string, string> = {
    limit: String(Math.min(500, Math.max(1, limit))),
  };
  const tags = await cachedGammaFetch<GammaTag[]>("/tags", params);
  return tags
    .filter((t) => t.label && String(t.label).trim().length > 0)
    .map((t) => ({
      id: String(t.id),
      label: String(t.label),
      slug: t.slug ? String(t.slug) : "",
    }));
}

export async function getPolymarketMarketById(idOrSlug: string) {
  const id = idOrSlug.replace(/^poly_/, "");
  const isNumericId = /^[0-9]+$/.test(id);
  const pathname = isNumericId ? `/markets/${id}` : `/markets/slug/${id}`;
  const payload = await gammaFetch<GammaMarket | GammaMarket[]>(pathname);
  const market = Array.isArray(payload) ? payload[0] : payload;
  if (!market) return null;
  return mapGammaMarket(market);
}

export async function getPolymarketOrderBook(tokenId: string) {
  const clobClient = new ClobClient(getClobUrl(), getChainId());
  return clobClient.getOrderBook(tokenId);
}

function isTradingConfigured() {
  const privateKey = getEnv("POLYMARKET_PRIVATE_KEY");
  if (!privateKey) return false;

  const apiKey = getEnv("POLYMARKET_API_KEY");
  const apiSecret = getEnv("POLYMARKET_API_SECRET");
  const apiPassphrase = getEnv("POLYMARKET_API_PASSPHRASE");
  if (apiKey && apiSecret && apiPassphrase) return true;

  // If only private key exists we can derive credentials lazily.
  return true;
}

function getTradingConfigStatus() {
  const privateKey = Boolean(getEnv("POLYMARKET_PRIVATE_KEY"));
  const apiKey = Boolean(getEnv("POLYMARKET_API_KEY"));
  const apiSecret = Boolean(getEnv("POLYMARKET_API_SECRET"));
  const apiPassphrase = Boolean(getEnv("POLYMARKET_API_PASSPHRASE"));
  const funder = Boolean(getEnv("POLYMARKET_FUNDER_ADDRESS"));

  return {
    tradingConfigured: isTradingConfigured(),
    privateKey,
    apiCredsConfigured: apiKey && apiSecret && apiPassphrase,
    funderConfigured: funder,
  };
}

export function getPolymarketConnectionStatus() {
  return {
    gammaUrl: getGammaUrl(),
    clobUrl: getClobUrl(),
    chainId: getChainId(),
    marketsCacheTtlSec: Math.floor(getTtlMs() / 1000),
    ...getTradingConfigStatus(),
  };
}

async function createTradingClient() {
  const privateKey = getEnv("POLYMARKET_PRIVATE_KEY");
  if (!privateKey) {
    throw new Error("POLYMARKET_PRIVATE_KEY is required for trading endpoints");
  }

  const signer = new Wallet(privateKey);
  const chainId = getChainId();
  const clobUrl = getClobUrl();
  const signatureType = Number(getEnv("POLYMARKET_SIGNATURE_TYPE", "0")) || 0;
  const funder = getEnv("POLYMARKET_FUNDER_ADDRESS", signer.address);

  const apiKey = getEnv("POLYMARKET_API_KEY");
  const apiSecret = getEnv("POLYMARKET_API_SECRET");
  const apiPassphrase = getEnv("POLYMARKET_API_PASSPHRASE");

  let creds:
    | { key: string; secret: string; passphrase: string }
    | undefined;

  if (apiKey && apiSecret && apiPassphrase) {
    creds = { key: apiKey, secret: apiSecret, passphrase: apiPassphrase };
  } else {
    const tempClient = new ClobClient(clobUrl, chainId, signer);
    creds = await tempClient.createOrDeriveApiKey();
  }

  return new ClobClient(clobUrl, chainId, signer, creds, signatureType, funder);
}

async function getTradingClient() {
  if (!tradingClientPromise) {
    tradingClientPromise = createTradingClient().catch((error) => {
      tradingClientPromise = null;
      throw error;
    });
  }
  return tradingClientPromise;
}

function toSide(side: "BUY" | "SELL") {
  return side === "BUY" ? Side.BUY : Side.SELL;
}

function toOrderType(orderType: "GTC" | "GTD" | "FOK" | "FAK") {
  if (orderType === "GTD") return OrderType.GTD;
  if (orderType === "FOK") return OrderType.FOK;
  if (orderType === "FAK") return OrderType.FAK;
  return OrderType.GTC;
}

export async function listPolymarketOpenOrders() {
  const client = await getTradingClient();
  return client.getOpenOrders();
}

export async function listPolymarketTrades() {
  const client = await getTradingClient();
  return client.getTrades();
}

export async function cancelPolymarketOrder(orderId: string) {
  const client = await getTradingClient();
  return client.cancelOrder({ orderID: orderId });
}

export async function placePolymarketLimitOrder(input: PlaceLimitOrderInput) {
  const client = await getTradingClient();
  const tickSize = input.tickSize ?? (await client.getTickSize(input.tokenId));
  const negRisk =
    typeof input.negRisk === "boolean"
      ? input.negRisk
      : Boolean(await client.getNegRisk(input.tokenId));

  const orderArgs: {
    tokenID: string;
    side: Side;
    price: number;
    size: number;
    expiration?: number;
  } = {
    tokenID: input.tokenId,
    side: toSide(input.side),
    price: input.price,
    size: input.size,
  };
  if (input.expiration) {
    orderArgs.expiration = input.expiration;
  }

  return client.createAndPostOrder(
    orderArgs,
    { tickSize, negRisk },
    input.orderType === "GTD" ? OrderType.GTD : OrderType.GTC,
  );
}

export async function placePolymarketMarketOrder(input: PlaceMarketOrderInput) {
  const client = await getTradingClient();
  const tickSize = input.tickSize ?? (await client.getTickSize(input.tokenId));
  const negRisk =
    typeof input.negRisk === "boolean"
      ? input.negRisk
      : Boolean(await client.getNegRisk(input.tokenId));

  const signedOrder = await client.createMarketOrder(
    {
      tokenID: input.tokenId,
      side: toSide(input.side),
      amount: input.amount,
      price: input.price,
    },
    { tickSize, negRisk },
  );

  return client.postOrder(signedOrder, toOrderType(input.orderType ?? "FOK"));
}
