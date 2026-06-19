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
import yfinance as yf
from mftool import Mftool

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
    Fetch latest stock price via yfinance.

    Args:
        ticker: NSE ticker with .NS suffix (e.g., "RELIANCE.NS")

    Returns:
        {"price": float, "ticker": str, "date": str, "currency": "INR"}
    """
    try:
        # Normalize ticker — ensure it has .NS for NSE
        if not ticker.endswith(".NS"):
            ticker = f"{ticker}.NS"

        stock = yf.Ticker(ticker)
        data = stock.history(period="1d")

        if data.empty:
            raise HTTPException(status_code=404, detail=f"Ticker {ticker} not found")

        latest = data.iloc[-1]
        return {
            "price": float(latest["Close"]),
            "ticker": ticker,
            "date": str(data.index[-1].date()),
            "currency": "INR"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching stock price: {str(e)}")


@app.post("/api/stock-prices")
def get_multiple_stock_prices(tickers: list[str]):
    """
    Fetch prices for multiple stocks in batch.

    Args:
        tickers: List of NSE tickers (e.g., ["RELIANCE.NS", "INFY.NS"])

    Returns:
        {"data": {"ticker": price, ...}, "errors": {"ticker": "error_message", ...}}
    """
    from datetime import datetime

    results = {}
    errors = {}

    for ticker in tickers:
        try:
            if not ticker.endswith(".NS"):
                ticker = f"{ticker}.NS"

            stock = yf.Ticker(ticker)
            data = stock.history(period="1d")

            if not data.empty:
                latest = data.iloc[-1]
                results[ticker] = float(latest["Close"])
            else:
                errors[ticker] = "No data available"
        except Exception as e:
            errors[ticker] = str(e)

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
    for ticker in stock_tickers:
        try:
            if not ticker.endswith(".NS"):
                ticker = f"{ticker}.NS"

            stock = yf.Ticker(ticker)
            data = stock.history(period="1d")

            if not data.empty:
                latest = data.iloc[-1]
                stock_prices[ticker] = float(latest["Close"])
            else:
                errors[ticker] = "No stock data"
        except Exception as e:
            errors[ticker] = str(e)

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
        entry = {
            "label": label,
            "symbol": symbol,
            "value": 0.0,
            "change": 0.0,
            "changePct": 0.0,
            "up": True,
            "error": None,
        }
        try:
            ticker = yf.Ticker(symbol)
            info = ticker.fast_info

            current = float(info.last_price)
            prev_close = float(info.previous_close)
            change = current - prev_close
            change_pct = (change / prev_close * 100) if prev_close != 0 else 0.0

            entry["value"] = round(current, 2)
            entry["change"] = round(change, 2)
            entry["changePct"] = round(change_pct, 2)
            entry["up"] = change >= 0

        except Exception as e:
            entry["error"] = str(e)

        results.append(entry)

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
