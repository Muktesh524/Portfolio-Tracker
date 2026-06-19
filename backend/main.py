"""
FastAPI backend for Bloomberg Terminal Portfolio Dashboard
─────────────────────────────────────────────────────────────

Provides real-time data sourcing for:
  • Mutual Fund NAVs (via mftool)
  • Stock prices (via yfinance)
  • Portfolio calculations
"""

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import logging
import yfinance as yf
from mftool import Mftool

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("portfolio-api")

# Initialize FastAPI app
app = FastAPI(title="Portfolio Dashboard API", version="1.0.0")

# Add CORS middleware so React frontend can call from localhost:5173
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize mftool for MF data
mf = Mftool()


# ─── Reliable Stock Price Helper ─────────────────────────────────────────────

def normalize_ticker(ticker: str) -> str:
    """Ensure Indian stock tickers have .NS suffix for NSE."""
    if not ticker.endswith(".NS") and not ticker.endswith(".BO"):
        return f"{ticker}.NS"
    return ticker


def fetch_stock_price_reliable(ticker: str) -> tuple[Optional[float], Optional[str]]:
    """
    Fetch a stock price using multiple methods with fallback.

    Returns (price, error_message). On success error_message is None.
    On failure price is None and error_message describes what went wrong.
    """
    t = yf.Ticker(ticker)

    # Method 1: history(period="5d") — more reliable than 1d on holidays/weekends
    try:
        hist = t.history(period="5d")
        if hist is not None and not hist.empty and "Close" in hist.columns:
            price = float(hist["Close"].dropna().iloc[-1])
            if price > 0:
                logger.info(f"[{ticker}] fetched via history(5d): ₹{price:.2f}")
                return price, None
    except Exception as e:
        logger.warning(f"[{ticker}] history(5d) failed: {e}")

    # Method 2: fast_info
    try:
        fi = t.fast_info
        last = getattr(fi, "last_price", None)
        if last is not None and float(last) > 0:
            price = float(last)
            logger.info(f"[{ticker}] fetched via fast_info: ₹{price:.2f}")
            return price, None
    except Exception as e:
        logger.warning(f"[{ticker}] fast_info failed: {e}")

    # Method 3: info dict
    try:
        info = t.info
        for key in ("regularMarketPrice", "currentPrice", "previousClose"):
            val = info.get(key)
            if val is not None and float(val) > 0:
                price = float(val)
                logger.info(f"[{ticker}] fetched via info['{key}']: ₹{price:.2f}")
                return price, None
    except Exception as e:
        logger.warning(f"[{ticker}] info dict failed: {e}")

    err = f"All methods failed for {ticker}"
    logger.error(f"[{ticker}] {err}")
    return None, err


def fetch_index_price(symbol: str) -> tuple[float, float, Optional[str]]:
    """
    Fetch current value and previous close for an index/currency symbol.

    Returns (current, previous_close, error_message).
    """
    t = yf.Ticker(symbol)

    # Method 1: fast_info (usually works well for indices)
    try:
        fi = t.fast_info
        current = float(fi.last_price)
        prev = float(fi.previous_close)
        if current > 0 and prev > 0:
            logger.info(f"[{symbol}] index via fast_info: {current:.2f}")
            return current, prev, None
    except Exception as e:
        logger.warning(f"[{symbol}] fast_info failed: {e}")

    # Method 2: history fallback
    try:
        hist = t.history(period="5d")
        if hist is not None and not hist.empty and len(hist) >= 1:
            current = float(hist["Close"].iloc[-1])
            prev = float(hist["Close"].iloc[-2]) if len(hist) >= 2 else current
            if current > 0:
                logger.info(f"[{symbol}] index via history(5d): {current:.2f}")
                return current, prev, None
    except Exception as e:
        logger.warning(f"[{symbol}] history fallback failed: {e}")

    # Method 3: info dict
    try:
        info = t.info
        current = float(info.get("regularMarketPrice", 0))
        prev = float(info.get("regularMarketPreviousClose", info.get("previousClose", 0)))
        if current > 0:
            logger.info(f"[{symbol}] index via info dict: {current:.2f}")
            return current, prev if prev > 0 else current, None
    except Exception as e:
        logger.warning(f"[{symbol}] info dict failed: {e}")

    return 0.0, 0.0, f"All methods failed for {symbol}"


# ─── Mutual Fund Search ──────────────────────────────────────────────────────

_mf_scheme_cache: dict[str, str] | None = None


def _get_scheme_codes() -> dict[str, str]:
    global _mf_scheme_cache
    if _mf_scheme_cache is None:
        raw = mf.get_scheme_codes()
        _mf_scheme_cache = {k: v for k, v in raw.items() if k != "Scheme Code"}
        logger.info(f"Loaded {len(_mf_scheme_cache)} MF scheme codes")
    return _mf_scheme_cache


@app.get("/api/mf/search")
def search_mf_schemes(q: str = Query(..., min_length=2)):
    """
    Search mutual fund schemes by name or scheme code.

    Returns up to 20 matching results sorted by relevance.
    """
    schemes = _get_scheme_codes()
    q_lower = q.lower()
    tokens = q_lower.split()

    results = []
    for code, name in schemes.items():
        name_lower = name.lower()
        if code == q:
            results.append({"code": code, "name": name, "score": 1000})
        elif all(t in name_lower for t in tokens):
            score = 100
            if "direct" in name_lower:
                score += 50
            if "growth" in name_lower:
                score += 30
            if name_lower.startswith(tokens[0]):
                score += 20
            penalty = len(name) - len(q)
            score -= penalty * 0.1
            results.append({"code": code, "name": name, "score": score})

        if len(results) > 200:
            break

    results.sort(key=lambda x: x["score"], reverse=True)
    top = results[:20]

    return {
        "query": q,
        "count": len(top),
        "results": [{"code": r["code"], "name": r["name"]} for r in top],
    }


@app.get("/api/mf/nav/{scheme_code}")
def get_mf_nav_by_code(scheme_code: str):
    """
    Fetch latest NAV for a mutual fund by scheme code.
    Returns NAV, scheme name, and date.
    """
    try:
        data = mf.get_scheme_quote(scheme_code)
        if not data:
            raise HTTPException(status_code=404, detail=f"Scheme {scheme_code} not found")
        return {
            "code": scheme_code,
            "name": data.get("scheme_name", ""),
            "nav": float(data.get("nav", 0)),
            "date": data.get("date", ""),
            "category": data.get("scheme_category", ""),
            "type": data.get("scheme_type", ""),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching NAV: {str(e)}")


# ─── Stock Search ────────────────────────────────────────────────────────────

NSE_STOCKS = [
    ("RELIANCE", "Reliance Industries Ltd", "Energy"),
    ("TCS", "Tata Consultancy Services Ltd", "IT"),
    ("HDFCBANK", "HDFC Bank Ltd", "Banking"),
    ("INFY", "Infosys Ltd", "IT"),
    ("ICICIBANK", "ICICI Bank Ltd", "Banking"),
    ("HINDUNILVR", "Hindustan Unilever Ltd", "FMCG"),
    ("ITC", "ITC Ltd", "FMCG"),
    ("SBIN", "State Bank of India", "Banking"),
    ("BHARTIARTL", "Bharti Airtel Ltd", "Telecom"),
    ("KOTAKBANK", "Kotak Mahindra Bank Ltd", "Banking"),
    ("LT", "Larsen & Toubro Ltd", "Infrastructure"),
    ("AXISBANK", "Axis Bank Ltd", "Banking"),
    ("ASIANPAINT", "Asian Paints Ltd", "Consumer"),
    ("MARUTI", "Maruti Suzuki India Ltd", "Automobile"),
    ("TITAN", "Titan Company Ltd", "Consumer"),
    ("SUNPHARMA", "Sun Pharmaceutical Industries Ltd", "Pharma"),
    ("BAJFINANCE", "Bajaj Finance Ltd", "Finance"),
    ("WIPRO", "Wipro Ltd", "IT"),
    ("ULTRACEMCO", "UltraTech Cement Ltd", "Cement"),
    ("HCLTECH", "HCL Technologies Ltd", "IT"),
    ("NESTLEIND", "Nestle India Ltd", "FMCG"),
    ("TATAMOTORS", "Tata Motors Ltd", "Automobile"),
    ("ADANIENT", "Adani Enterprises Ltd", "Conglomerate"),
    ("ADANIPORTS", "Adani Ports & SEZ Ltd", "Infrastructure"),
    ("POWERGRID", "Power Grid Corporation of India Ltd", "Power"),
    ("NTPC", "NTPC Ltd", "Power"),
    ("TATASTEEL", "Tata Steel Ltd", "Metals"),
    ("ONGC", "Oil & Natural Gas Corporation Ltd", "Energy"),
    ("JSWSTEEL", "JSW Steel Ltd", "Metals"),
    ("M&M", "Mahindra & Mahindra Ltd", "Automobile"),
    ("COALINDIA", "Coal India Ltd", "Mining"),
    ("BAJAJFINSV", "Bajaj Finserv Ltd", "Finance"),
    ("TECHM", "Tech Mahindra Ltd", "IT"),
    ("HDFCLIFE", "HDFC Life Insurance Company Ltd", "Insurance"),
    ("SBILIFE", "SBI Life Insurance Company Ltd", "Insurance"),
    ("DIVISLAB", "Divi's Laboratories Ltd", "Pharma"),
    ("DRREDDY", "Dr. Reddy's Laboratories Ltd", "Pharma"),
    ("CIPLA", "Cipla Ltd", "Pharma"),
    ("BRITANNIA", "Britannia Industries Ltd", "FMCG"),
    ("EICHERMOT", "Eicher Motors Ltd", "Automobile"),
    ("APOLLOHOSP", "Apollo Hospitals Enterprise Ltd", "Healthcare"),
    ("INDUSINDBK", "IndusInd Bank Ltd", "Banking"),
    ("GRASIM", "Grasim Industries Ltd", "Cement"),
    ("TATACONSUM", "Tata Consumer Products Ltd", "FMCG"),
    ("DABUR", "Dabur India Ltd", "FMCG"),
    ("PIDILITIND", "Pidilite Industries Ltd", "Chemicals"),
    ("HAVELLS", "Havells India Ltd", "Consumer"),
    ("HEROMOTOCO", "Hero MotoCorp Ltd", "Automobile"),
    ("BAJAJ-AUTO", "Bajaj Auto Ltd", "Automobile"),
    ("ZOMATO", "Zomato Ltd", "Internet"),
    ("IRCTC", "Indian Railway Catering & Tourism Corporation Ltd", "Travel"),
    ("DMART", "Avenue Supermarts Ltd (DMart)", "Retail"),
    ("PAYTM", "One 97 Communications Ltd (Paytm)", "Fintech"),
    ("NYKAA", "FSN E-Commerce Ventures Ltd (Nykaa)", "E-Commerce"),
    ("POLICYBZR", "PB Fintech Ltd (PolicyBazaar)", "Fintech"),
    ("ATGL", "Adani Total Gas Ltd", "Gas"),
    ("HAL", "Hindustan Aeronautics Ltd", "Defence"),
    ("BEL", "Bharat Electronics Ltd", "Defence"),
    ("DIXON", "Dixon Technologies (India) Ltd", "Electronics"),
    ("TRENT", "Trent Ltd", "Retail"),
]


@app.get("/api/stocks/search")
def search_stocks(q: str = Query(..., min_length=1)):
    """
    Search NSE stocks by symbol or company name.

    Returns up to 15 matching results.
    """
    q_lower = q.lower()

    results = []
    for symbol, name, sector in NSE_STOCKS:
        sym_lower = symbol.lower()
        name_lower = name.lower()
        if sym_lower == q_lower:
            results.append({"symbol": f"{symbol}.NS", "name": name, "sector": sector, "score": 1000})
        elif sym_lower.startswith(q_lower):
            results.append({"symbol": f"{symbol}.NS", "name": name, "sector": sector, "score": 500})
        elif q_lower in sym_lower or q_lower in name_lower:
            score = 100
            if sym_lower.startswith(q_lower):
                score += 50
            results.append({"symbol": f"{symbol}.NS", "name": name, "sector": sector, "score": score})

    results.sort(key=lambda x: x["score"], reverse=True)
    top = results[:15]

    return {
        "query": q,
        "count": len(top),
        "results": [{"symbol": r["symbol"], "name": r["name"], "sector": r["sector"]} for r in top],
    }


# ─── Pydantic Models ──────────────────────────────────────────────────────────

class PriceData(BaseModel):
    identifier: str
    currentNav: float
    currency: str = "INR"
    lastUpdated: str


class PriceListResponse(BaseModel):
    data: dict[str, float]
    errors: dict[str, str] = {}
    timestamp: str


# ─── Health Check ─────────────────────────────────────────────────────────────

@app.get("/health")
def health_check():
    """Health check endpoint"""
    return {"status": "ok", "version": "1.0.0"}


# ─── Mutual Fund NAVs ─────────────────────────────────────────────────────────

@app.get("/api/mf-nav/{isin}")
def get_mf_nav(isin: str):
    """
    Fetch latest NAV for a mutual fund by ISIN code.

    Args:
        isin: AMFI code (e.g., "122655" for Parag Parikh Flexi Cap)

    Returns:
        {"nav": float, "isin": str, "date": str}
    """
    try:
        # Fetch from mftool — returns dict with 'nav' and date info
        scheme_data = mf.get_scheme_quote(isin)
        if not scheme_data:
            raise HTTPException(status_code=404, detail=f"MF with ISIN {isin} not found")

        return {
            "nav": float(scheme_data.get("nav", 0)),
            "isin": isin,
            "date": scheme_data.get("date", ""),
            "name": scheme_data.get("scheme_name", "")
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching MF NAV: {str(e)}")


@app.post("/api/mf-navs")
def get_multiple_mf_navs(isins: list[str]):
    """
    Fetch NAVs for multiple mutual funds in batch.

    Args:
        isins: List of AMFI codes

    Returns:
        {"data": {"isin": nav, ...}, "errors": {"isin": "error_message", ...}}
    """
    from datetime import datetime

    results = {}
    errors = {}

    for isin in isins:
        try:
            scheme_data = mf.get_scheme_quote(isin)
            if scheme_data:
                results[isin] = float(scheme_data.get("nav", 0))
            else:
                errors[isin] = "Not found"
        except Exception as e:
            errors[isin] = str(e)

    return {
        "data": results,
        "errors": errors,
        "timestamp": datetime.now().isoformat()
    }


# ─── Stock Prices ─────────────────────────────────────────────────────────────

@app.get("/api/stock-price/{ticker}")
def get_stock_price(ticker: str):
    """
    Fetch latest stock price via yfinance with multi-method fallback.

    Args:
        ticker: NSE ticker (e.g., "RELIANCE" or "RELIANCE.NS")

    Returns:
        {"price": float, "ticker": str, "date": str, "currency": "INR"}
    """
    from datetime import datetime

    ticker = normalize_ticker(ticker)
    price, error = fetch_stock_price_reliable(ticker)

    if price is None:
        raise HTTPException(status_code=404, detail=error or f"Ticker {ticker} not found")

    return {
        "price": round(price, 2),
        "ticker": ticker,
        "date": datetime.now().strftime("%Y-%m-%d"),
        "currency": "INR"
    }


@app.post("/api/stock-prices")
def get_multiple_stock_prices(tickers: list[str]):
    """
    Fetch prices for multiple stocks in batch with fallback logic.

    Args:
        tickers: List of NSE tickers (e.g., ["RELIANCE.NS", "INFY.NS"])

    Returns:
        {"data": {"ticker": price, ...}, "errors": {"ticker": "error_message", ...}}
    """
    from datetime import datetime

    results = {}
    errors = {}

    for raw_ticker in tickers:
        ticker = normalize_ticker(raw_ticker)
        price, error = fetch_stock_price_reliable(ticker)
        if price is not None:
            results[ticker] = round(price, 2)
        else:
            errors[ticker] = error or "No data available"

    return {
        "data": results,
        "errors": errors,
        "timestamp": datetime.now().isoformat()
    }


# ─── Portfolio Endpoint (fetches all current prices for a portfolio) ────────────

@app.post("/api/portfolio-snapshot")
def get_portfolio_snapshot(holdings: dict):
    """
    Fetch current prices for all holdings in a portfolio.

    Args:
        holdings: {
            "mf_isins": ["122655", "120716"],
            "stock_tickers": ["RELIANCE.NS", "INFY.NS"]
        }

    Returns:
        {
            "mf_navs": {"122655": 92.14, ...},
            "stock_prices": {"RELIANCE.NS": 3142.60, ...},
            "errors": {...},
            "timestamp": "..."
        }
    """
    from datetime import datetime

    mf_isins = holdings.get("mf_isins", [])
    stock_tickers = holdings.get("stock_tickers", [])

    mf_navs = {}
    stock_prices = {}
    errors = {}

    # Fetch MF NAVs
    for isin in mf_isins:
        try:
            scheme_data = mf.get_scheme_quote(isin)
            if scheme_data:
                mf_navs[isin] = float(scheme_data.get("nav", 0))
            else:
                errors[isin] = "MF not found"
        except Exception as e:
            errors[isin] = str(e)

    # Fetch stock prices
    for raw_ticker in stock_tickers:
        ticker = normalize_ticker(raw_ticker)
        price, error = fetch_stock_price_reliable(ticker)
        if price is not None:
            stock_prices[ticker] = round(price, 2)
        else:
            errors[ticker] = error or "No stock data"

    return {
        "mf_navs": mf_navs,
        "stock_prices": stock_prices,
        "errors": errors,
        "timestamp": datetime.now().isoformat()
    }


# ─── Monte Carlo Simulation ──────────────────────────────────────────────────

class MonteCarloRequest(BaseModel):
    start_value: float
    annual_return: float      # e.g. 0.12 for 12%
    annual_volatility: float  # e.g. 0.18 for 18%
    years: int                # 1, 3, 5, 10
    num_simulations: int = 2000
    num_sample_paths: int = 5

class PercentilePoint(BaseModel):
    month: int
    p10: float
    p25: float
    p50: float
    p75: float
    p90: float

class MonteCarloResponse(BaseModel):
    sample_paths: list[list[float]]
    percentile_series: list[dict]
    final_distribution: list[float]
    histogram_bins: list[dict]
    median: float
    p10: float
    p25: float
    p75: float
    p90: float
    mean: float
    prob_profit: float
    prob_double: float
    max_drawdown_median: float
    sharpe_estimate: float
    months: int
    assumptions: dict


@app.post("/api/monte-carlo")
def run_monte_carlo(req: MonteCarloRequest):
    """
    Run a Monte Carlo simulation using Geometric Brownian Motion.

    Performs num_simulations independent GBM paths over the specified
    time horizon, then returns:
      - Sample paths for visualisation
      - Percentile series (p10/p25/p50/p75/p90 at each month)
      - Final value distribution with histogram bins
      - Summary statistics: median, mean, percentiles, prob of profit/doubling
      - Estimated Sharpe ratio and median max drawdown
    """
    import math
    import random
    from datetime import datetime

    months = req.years * 12
    monthly_r = req.annual_return / 12
    monthly_v = req.annual_volatility / math.sqrt(12)
    drift = monthly_r - 0.5 * monthly_v * monthly_v

    random.seed(42 + int(req.start_value) ^ req.years)

    all_paths: list[list[float]] = []

    for _ in range(req.num_simulations):
        path = [req.start_value]
        val = req.start_value
        for _ in range(months):
            shock = random.gauss(0, 1)
            val = val * math.exp(drift + monthly_v * shock)
            path.append(round(val, 2))
        all_paths.append(path)

    sample_paths = all_paths[:req.num_sample_paths]

    percentile_series = []
    for m in range(months + 1):
        vals_at_m = sorted([p[m] for p in all_paths])
        n = len(vals_at_m)
        percentile_series.append({
            "month": m,
            "p10": round(vals_at_m[int(n * 0.10)], 2),
            "p25": round(vals_at_m[int(n * 0.25)], 2),
            "p50": round(vals_at_m[int(n * 0.50)], 2),
            "p75": round(vals_at_m[int(n * 0.75)], 2),
            "p90": round(vals_at_m[int(n * 0.90)], 2),
        })

    finals = sorted([p[-1] for p in all_paths])
    n = len(finals)

    mean_final = sum(finals) / n
    profitable = sum(1 for v in finals if v > req.start_value)
    doubled = sum(1 for v in finals if v >= req.start_value * 2)

    max_drawdowns = []
    median_path = [percentile_series[m]["p50"] for m in range(months + 1)]
    peak = median_path[0]
    worst_dd = 0.0
    for v in median_path:
        if v > peak:
            peak = v
        dd = (peak - v) / peak if peak > 0 else 0
        if dd > worst_dd:
            worst_dd = dd
    max_drawdowns.append(worst_dd)

    total_return = (mean_final / req.start_value) - 1
    annualised_return = (1 + total_return) ** (1 / max(req.years, 1)) - 1
    sharpe = annualised_return / req.annual_volatility if req.annual_volatility > 0 else 0

    num_bins = 30
    min_val = finals[0]
    max_val = finals[-1]
    bin_width = (max_val - min_val) / num_bins if max_val > min_val else 1
    histogram_bins = []
    for i in range(num_bins):
        lo = min_val + i * bin_width
        hi = lo + bin_width
        count = sum(1 for v in finals if lo <= v < hi) if i < num_bins - 1 else sum(1 for v in finals if lo <= v <= hi)
        histogram_bins.append({
            "bin_start": round(lo, 2),
            "bin_end": round(hi, 2),
            "bin_label": f"₹{lo/1000:.0f}k",
            "count": count,
            "frequency": round(count / n * 100, 2),
            "above_start": lo >= req.start_value,
        })

    return {
        "sample_paths": sample_paths,
        "percentile_series": percentile_series,
        "final_distribution": [round(v, 2) for v in finals],
        "histogram_bins": histogram_bins,
        "median": round(finals[int(n * 0.50)], 2),
        "p10": round(finals[int(n * 0.10)], 2),
        "p25": round(finals[int(n * 0.25)], 2),
        "p75": round(finals[int(n * 0.75)], 2),
        "p90": round(finals[int(n * 0.90)], 2),
        "mean": round(mean_final, 2),
        "prob_profit": round(profitable / n * 100, 1),
        "prob_double": round(doubled / n * 100, 1),
        "max_drawdown_median": round(worst_dd * 100, 1),
        "sharpe_estimate": round(sharpe, 2),
        "months": months,
        "assumptions": {
            "annual_return": req.annual_return,
            "annual_volatility": req.annual_volatility,
            "years": req.years,
            "num_simulations": req.num_simulations,
            "model": "Geometric Brownian Motion",
        },
        "timestamp": datetime.now().isoformat(),
    }


# ─── Market Indices ──────────────────────────────────────────────────────────

INDICES = {
    "NIFTY 50":   "^NSEI",
    "SENSEX":     "^BSESN",
    "BANK NIFTY": "^NSEBANK",
    "USD/INR":    "USDINR=X",
}


@app.get("/api/indices")
def get_indices():
    """
    Fetch live values for major Indian market indices via yfinance.

    Returns a list of index objects, each containing:
      - label: Display name (e.g. "NIFTY 50")
      - value: Current price / level
      - change: Absolute change from previous close
      - changePct: Percentage change from previous close
      - up: Boolean — true if positive or flat

    Indices that fail to fetch are returned with zeroed fallback values
    and an error field so the frontend can degrade gracefully.
    """
    from datetime import datetime

    results = []

    for label, symbol in INDICES.items():
        current, prev_close, error = fetch_index_price(symbol)
        change = current - prev_close
        change_pct = (change / prev_close * 100) if prev_close != 0 else 0.0

        results.append({
            "label": label,
            "symbol": symbol,
            "value": round(current, 2),
            "change": round(change, 2),
            "changePct": round(change_pct, 2),
            "up": change >= 0,
            "error": error,
        })

    return {
        "indices": results,
        "timestamp": datetime.now().isoformat(),
    }


# ─── Root endpoint ───────────────────────────────────────────────────────────

@app.get("/")
def root():
    """API documentation"""
    return {
        "name": "Portfolio Dashboard Backend",
        "version": "1.0.0",
        "endpoints": {
            "health": "GET /health",
            "mf_search": "GET /api/mf/search?q=query",
            "mf_nav": "GET /api/mf/nav/{scheme_code}",
            "stock_search": "GET /api/stocks/search?q=query",
            "mf_single": "GET /api/mf-nav/{isin}",
            "mf_batch": "POST /api/mf-navs",
            "stock_single": "GET /api/stock-price/{ticker}",
            "stock_batch": "POST /api/stock-prices",
            "portfolio": "POST /api/portfolio-snapshot",
            "monte_carlo": "POST /api/monte-carlo",
            "indices": "GET /api/indices",
        },
        "note": "All data sourced from mftool (AMFI) and yfinance (NSE)"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
