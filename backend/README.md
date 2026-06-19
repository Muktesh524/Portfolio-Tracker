# Portfolio Dashboard Backend

FastAPI service providing real-time market data for the Bloomberg Terminal-style portfolio dashboard.

## Setup

### Prerequisites
- Python 3.9+
- pip or poetry

### Installation

```bash
cd backend
pip install -r requirements.txt
```

### Running the Backend

```bash
# Development server (auto-reload)
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Or directly
python main.py
```

The API will be available at `http://localhost:8000`

### API Documentation

Once running, visit:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## API Endpoints

### Health Check
```
GET /health
```

### Mutual Fund NAVs

**Single MF**
```
GET /api/mf-nav/{isin}
```
Example: `GET /api/mf-nav/122655`

**Batch MF**
```
POST /api/mf-navs
{
  "isins": ["122655", "120716", "118989"]
}
```

### Stock Prices

**Single Stock**
```
GET /api/stock-price/{ticker}
```
Example: `GET /api/stock-price/RELIANCE.NS`

**Batch Stocks**
```
POST /api/stock-prices
{
  "tickers": ["RELIANCE.NS", "INFY.NS", "HDFCBANK.NS"]
}
```

### Portfolio Snapshot

Fetches all holdings prices in one request:
```
POST /api/portfolio-snapshot
{
  "mf_isins": ["122655", "120716"],
  "stock_tickers": ["RELIANCE.NS", "INFY.NS"]
}
```

## Data Sources

| Type | Source | Coverage |
|------|--------|----------|
| **Mutual Funds** | mftool (AMFI) | All AMFI-registered funds |
| **Stocks** | yfinance | NSE and BSE via Yahoo Finance |
| **Rates** | yfinance | Real-time via Yahoo Finance |

## CORS Configuration

The backend is configured to accept requests from:
- `http://localhost:5173` (Vite dev server)
- `http://127.0.0.1:5173`
- `http://localhost:3000` (alternative dev port)

Update `CORSMiddleware` in `main.py` for production deployments.

## Frontend Integration

The React frontend uses the API like this:

```typescript
// Fetch MF NAV
const navResponse = await fetch('http://localhost:8000/api/mf-nav/122655');
const { nav } = await navResponse.json();

// Batch fetch portfolio prices
const portResponse = await fetch('http://localhost:8000/api/portfolio-snapshot', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    mf_isins: ['122655', '120716'],
    stock_tickers: ['RELIANCE.NS', 'INFY.NS']
  })
});
const { mf_navs, stock_prices } = await portResponse.json();
```

## Troubleshooting

### MF NAV not found
- Verify the ISIN code is correct (check AMFI website)
- Some newer/older funds may not be available in mftool

### Stock price fetch fails
- Ensure ticker has `.NS` (NSE) or `.BO` (BSE) suffix
- Check that the company is listed and has recent trading data

### CORS errors in browser
- Verify backend is running and `http://localhost:8000` is accessible
- Check CORS origins in `main.py`

## Deployment Notes

### Production Setup
1. Use a production ASGI server like Gunicorn + Uvicorn
2. Add proper authentication/API keys if needed
3. Implement request rate limiting
4. Cache frequently-requested data to reduce API calls
5. Add monitoring and error logging

### Docker (Optional)
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["python", "main.py"]
```

## Future Enhancements

- [ ] Caching layer (Redis) for frequently-fetched data
- [ ] WebSocket support for real-time price updates
- [ ] Portfolio performance analytics
- [ ] Tax loss harvesting suggestions
- [ ] Historical data export
- [ ] Authentication + user sessions
