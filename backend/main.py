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
        },
        "note": "All data sourced from mftool (AMFI) and yfinance (NSE)"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
