/**
 * api.ts — API client for Portfolio Dashboard Backend
 * ────────────────────────────────────────────────────
 * Provides hooks and utilities to fetch real MF NAVs and stock prices
 * from the FastAPI backend running at http://localhost:8000
 *
 * Features:
 *   • Batch fetching (fetch multiple NAVs/prices in one request)
 *   • Error handling and fallback to cached values
 *   • Response caching to reduce API calls
 *   • TypeScript types for all responses
 */

const API_BASE = "http://localhost:8000";
const CACHE_DURATION_MS = 5 * 60 * 1000; // Cache for 5 minutes

// ─── Response Types ───────────────────────────────────────────────────────────

export interface MFNavResponse {
  nav: number;
  isin: string;
  date: string;
  name: string;
}

export interface StockPriceResponse {
  price: number;
  ticker: string;
  date: string;
  currency: string;
}

export interface BatchMFResponse {
  data: Record<string, number>; // isin -> nav
  errors: Record<string, string>;
  timestamp: string;
}

export interface BatchStockResponse {
  data: Record<string, number>; // ticker -> price
  errors: Record<string, string>;
  timestamp: string;
}

export interface PortfolioSnapshotResponse {
  mf_navs: Record<string, number>;
  stock_prices: Record<string, number>;
  errors: Record<string, string>;
  timestamp: string;
}

// ─── Cache mechanism ──────────────────────────────────────────────────────────

interface CacheEntry {
  data: any;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_DURATION_MS) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCached<T>(key: string, data: T) {
  cache.set(key, { data, timestamp: Date.now() });
}

// ─── Health Check ─────────────────────────────────────────────────────────────

export async function checkBackendHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/health`, { method: "GET" });
    return res.ok;
  } catch {
    return false;
  }
}

// ─── Single Requests ──────────────────────────────────────────────────────────

/** Fetch a single MF NAV by ISIN */
export async function fetchMFNav(isin: string): Promise<number | null> {
  try {
    const cacheKey = `mf-nav-${isin}`;
    const cached = getCached<number>(cacheKey);
    if (cached !== null) return cached;

    const res = await fetch(`${API_BASE}/api/mf-nav/${isin}`);
    if (!res.ok) {
      console.warn(`Failed to fetch MF NAV for ${isin}: ${res.statusText}`);
      return null;
    }

    const data: MFNavResponse = await res.json();
    setCached(cacheKey, data.nav);
    return data.nav;
  } catch (error) {
    console.error(`Error fetching MF NAV for ${isin}:`, error);
    return null;
  }
}

/** Fetch a single stock price by ticker */
export async function fetchStockPrice(ticker: string): Promise<number | null> {
  try {
    let tickerNorm = ticker;
    if (!tickerNorm.endsWith(".NS") && !tickerNorm.endsWith(".BO")) {
      tickerNorm = `${tickerNorm}.NS`;
    }

    const cacheKey = `stock-price-${tickerNorm}`;
    const cached = getCached<number>(cacheKey);
    if (cached !== null) return cached;

    const res = await fetch(`${API_BASE}/api/stock-price/${tickerNorm}`);
    if (!res.ok) {
      console.warn(`Failed to fetch stock price for ${tickerNorm}: ${res.statusText}`);
      return null;
    }

    const data: StockPriceResponse = await res.json();
    setCached(cacheKey, data.price);
    return data.price;
  } catch (error) {
    console.error(`Error fetching stock price for ${ticker}:`, error);
    return null;
  }
}

// ─── Batch Requests ───────────────────────────────────────────────────────────

/** Fetch NAVs for multiple MFs */
export async function fetchMFNavBatch(isins: string[]): Promise<BatchMFResponse> {
  if (isins.length === 0) {
    return { data: {}, errors: {}, timestamp: new Date().toISOString() };
  }

  try {
    const cacheKey = `mf-batch-${isins.sort().join(",")}`;
    const cached = getCached<BatchMFResponse>(cacheKey);
    if (cached) return cached;

    const res = await fetch(`${API_BASE}/api/mf-navs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(isins),
    });

    if (!res.ok) {
      console.warn(`Batch MF fetch failed: ${res.statusText}`);
      return { data: {}, errors: { _global: res.statusText }, timestamp: new Date().toISOString() };
    }

    const data: BatchMFResponse = await res.json();
    setCached(cacheKey, data);
    return data;
  } catch (error) {
    console.error("Error in batch MF fetch:", error);
    return {
      data: {},
      errors: { _global: String(error) },
      timestamp: new Date().toISOString(),
    };
  }
}

/** Fetch prices for multiple stocks */
export async function fetchStockPriceBatch(tickers: string[]): Promise<BatchStockResponse> {
  if (tickers.length === 0) {
    return { data: {}, errors: {}, timestamp: new Date().toISOString() };
  }

  try {
    const tickerNorm = tickers.map(t =>
      !t.endsWith(".NS") && !t.endsWith(".BO") ? `${t}.NS` : t
    );

    const cacheKey = `stock-batch-${tickerNorm.sort().join(",")}`;
    const cached = getCached<BatchStockResponse>(cacheKey);
    if (cached) return cached;

    const res = await fetch(`${API_BASE}/api/stock-prices`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(tickerNorm),
    });

    if (!res.ok) {
      console.warn(`Batch stock fetch failed: ${res.statusText}`);
      return { data: {}, errors: { _global: res.statusText }, timestamp: new Date().toISOString() };
    }

    const data: BatchStockResponse = await res.json();
    setCached(cacheKey, data);
    return data;
  } catch (error) {
    console.error("Error in batch stock fetch:", error);
    return {
      data: {},
      errors: { _global: String(error) },
      timestamp: new Date().toISOString(),
    };
  }
}

// ─── Portfolio Snapshot (fetch all prices at once) ────────────────────────────

export async function fetchPortfolioSnapshot(
  mfIsins: string[],
  stockTickers: string[]
): Promise<PortfolioSnapshotResponse> {
  try {
    const cacheKey = `portfolio-${mfIsins.sort().join(",")}|${stockTickers.sort().join(",")}`;
    const cached = getCached<PortfolioSnapshotResponse>(cacheKey);
    if (cached) return cached;

    const tickerNorm = stockTickers.map(t =>
      !t.endsWith(".NS") && !t.endsWith(".BO") ? `${t}.NS` : t
    );

    const res = await fetch(`${API_BASE}/api/portfolio-snapshot`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mf_isins: mfIsins,
        stock_tickers: tickerNorm,
      }),
    });

    if (!res.ok) {
      console.warn(`Portfolio snapshot fetch failed: ${res.statusText}`);
      return {
        mf_navs: {},
        stock_prices: {},
        errors: { _global: res.statusText },
        timestamp: new Date().toISOString(),
      };
    }

    const data: PortfolioSnapshotResponse = await res.json();
    setCached(cacheKey, data);
    return data;
  } catch (error) {
    console.error("Error fetching portfolio snapshot:", error);
    return {
      mf_navs: {},
      stock_prices: {},
      errors: { _global: String(error) },
      timestamp: new Date().toISOString(),
    };
  }
}

// ─── Clear cache (useful for manual refresh) ──────────────────────────────────

export function clearCache() {
  cache.clear();
  console.log("API cache cleared");
}
