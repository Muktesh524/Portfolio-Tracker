# 📊 Portfolio Dashboard

A professional Bloomberg Terminal-inspired portfolio tracking application with real-time data sourcing from AMFI (Mutual Funds) and NSE/BSE (Stocks).

## 🚀 Quick Start (5 Minutes)

### Prerequisites
- Python 3.9+
- Node.js 16+
- Internet connection

### Run Locally

```bash
# Terminal 1: Start Backend
cd backend
pip install -r requirements.txt
python main.py

# Terminal 2: Start Frontend (new terminal)
cd frontend
npm install
npm run dev

# Browser: Open http://localhost:5173
# Click F2 → REFRESH PRICES to fetch live data
```

**Done!** You now have live prices from AMFI and NSE updating in real-time.

---

## 📁 Project Structure

```
Portfolio Tracker/
│
├── frontend/                   React + TypeScript Dashboard
│   ├── src/
│   │   ├── app/
│   │   │   ├── api.ts         ← API client with caching
│   │   │   ├── store.ts       ← Global state management
│   │   │   ├── App.tsx        ← Root component
│   │   │   └── components/    ← All UI components
│   │   ├── styles/            ← CSS & Tailwind
│   │   ├── tokens.ts          ← Design tokens
│   │   └── main.tsx
│   ├── public/                ← Static assets
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── index.html
│
├── backend/                    FastAPI REST Server
│   ├── main.py               ← 6 REST API endpoints
│   ├── requirements.txt       ← Python dependencies
│   ├── .env                  ← Configuration
│   ├── start.sh              ← Unix launcher
│   └── start.bat             ← Windows launcher
│
└── README.md                 ← This file
```

---

## ✨ Features

### Holdings Manager (F2)
- ✅ Add/edit/delete holdings
- ✅ Inline editing with auto-save
- ✅ Drag-and-drop reordering
- ✅ CSV import/export
- ✅ **REFRESH PRICES** — Live data from AMFI + NSE

### Overview (F1)
- ✅ Portfolio value & gain/loss
- ✅ Asset allocation breakdown
- ✅ Performance trends
- ✅ Sector exposure analysis
- ✅ Holdings table with sparklines

### Recommendations (F3)
- ✅ Dynamic recommendations
- ✅ Monte Carlo simulations
- ✅ Risk analysis
- ✅ Portfolio insights

### Global
- ✅ Bloomberg Terminal design (dark + neon green)
- ✅ Monospace font (IBM Plex Mono)
- ✅ Keyboard shortcuts (F1-F3, R, \)
- ✅ Responsive grid layout

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18 + TypeScript + Vite |
| **Styling** | Tailwind CSS v4 + custom tokens |
| **Charts** | Recharts |
| **Notifications** | Sonner |
| **Backend** | FastAPI + Uvicorn |
| **MF Data** | mftool (AMFI) |
| **Stock Prices** | yfinance (NSE/BSE) |
| **State** | localStorage + useSyncExternalStore |

---

## 🔌 API Endpoints

Backend runs at `http://localhost:8000`

```
GET  /health                      Health check
GET  /api/mf-nav/{isin}          Single MF NAV
POST /api/mf-navs                Batch MF NAVs
GET  /api/stock-price/{ticker}   Single stock price
POST /api/stock-prices           Batch stock prices
POST /api/portfolio-snapshot     All holdings at once
```

**Interactive API Docs**: http://localhost:8000/docs (Swagger UI)

---

## 📊 Data Sources

| Type | Source | Identifier | Update |
|------|--------|------------|--------|
| **Mutual Funds** | mftool (AMFI) | ISIN code (e.g., "122655") | Daily |
| **Stocks** | yfinance | NSE ticker (e.g., "RELIANCE.NS") | Real-time |
| **Indices** | Static | NIFTY, SENSEX, etc | Labeled SIM |

---

## ⌨️ Keyboard Shortcuts

| Key | Action |
|-----|--------|
| F1 | Overview tab |
| F2 | Holdings tab |
| F3 | Recommendations tab |
| R | Refresh data |
| \ | Toggle sidebar |

---

## 📦 Installation Guide

### Backend Setup

```bash
cd backend

# Create virtual environment (recommended)
python -m venv venv
source venv/bin/activate          # Mac/Linux
# or
venv\Scripts\activate             # Windows

# Install dependencies
pip install -r requirements.txt

# Configure (optional)
# Edit .env file for custom settings

# Run
python main.py
# Server runs at http://localhost:8000
```

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Run development server
npm run dev
# App runs at http://localhost:5173

# Build for production
npm run build
# Creates dist/ folder ready for deployment
```

---

## 🎮 How to Use

### 1. Add Holdings
- Click F2 (Holdings Manager)
- Click "+ ADD"
- Fill in: Type, Name, Identifier, Units, Avg Cost, Sector
- Click "Save"

### 2. Refresh Prices
- Click F2 (Holdings Manager)
- Click "REFRESH PRICES" button
- Wait 1-3 seconds
- See toast: "Prices refreshed: X/Y holdings updated"
- View updated prices in table

### 3. Analyze Portfolio
- Click F1 (Overview) → See portfolio metrics
- Click F3 (Recommendations) → Get insights
- Edit target % in F3 to see rebalancing suggestions

### 4. Export/Import
- Click F2 (Holdings Manager)
- "EXPORT" → Download current holdings as CSV
- "IMPORT CSV" → Upload new holdings from CSV

---

## 🚀 Deployment

### Frontend

**Vercel (Recommended):**
```bash
npm run build
vercel
```

**Netlify:**
```bash
npm run build
netlify deploy --prod --dir=dist
```

**AWS S3:**
```bash
npm run build
aws s3 sync dist/ s3://your-bucket/
```

### Backend

**Heroku:**
```bash
git push heroku main
```

**AWS EC2:**
```bash
# SSH to instance
pip install -r requirements.txt
gunicorn -w 4 -k uvicorn.workers.UvicornWorker main:app
```

**Docker:**
```bash
docker build -t portfolio-backend .
docker run -p 8000:8000 portfolio-backend
```

---

## 🆘 Troubleshooting

### Backend won't start
**Error**: `ModuleNotFoundError: No module named 'fastapi'`
```bash
cd backend
pip install -r requirements.txt
```

### Port already in use (8000)
**Windows:**
```bash
netstat -ano | findstr :8000
taskkill /PID <PID> /F
```

**Mac/Linux:**
```bash
lsof -i :8000 | grep LISTEN | awk '{print $2}' | xargs kill -9
```

### CORS errors
- Ensure frontend is at `http://localhost:5173` (not 5174, 3000, etc.)
- Restart backend after changing CORS settings

### Prices won't update
- Check internet connection
- Verify backend is running: `curl http://localhost:8000/health`
- Check browser console (F12) for errors
- Verify ISIN/ticker format (e.g., "122655" or "RELIANCE.NS")

### ISIN/Ticker not found
- For MF: Check AMFI code at https://www.mfaindia.com/
- For Stocks: Use NSE ticker with `.NS` suffix (e.g., RELIANCE.NS)
- Check at https://www1.nseindia.com/

---

## 📈 Features Showcase

### Real-Time Price Refresh
- Single click to update ALL holdings prices
- Smart caching (5-minute TTL reduces API calls)
- Automatic portfolio recalculation
- User-friendly toast notifications

### Bloomberg Terminal UI
- Ultra-dark theme (#0A0A0A)
- Neon green accents (#00FF9F)
- Monospace typography
- Information-dense layouts
- Professional appearance

### Portfolio Analytics
- Current value & gain/loss tracking
- Sector allocation breakdown
- Risk profiling
- Monte Carlo simulations
- Recommendation engine

### Data Management
- Add/edit/delete holdings
- Inline editing with keyboard shortcuts
- Drag-and-drop reordering
- CSV import for bulk operations
- CSV export for backup/sharing

---

## 🛡️ Security Notes

- **Development**: No authentication needed
- **Production**: Add API key authentication
- **Data**: Holdings stored in browser localStorage (not secure for sensitive data)
- **CORS**: Configure for your domain in production

---

## 📝 Environment Variables

### Backend (.env)

```env
FASTAPI_HOST=0.0.0.0
FASTAPI_PORT=8000
FRONTEND_URL=http://localhost:5173
LOG_LEVEL=info
```

### Frontend (.env)

```env
VITE_API_URL=http://localhost:8000
```

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test locally
5. Submit a pull request

---

## 📄 License & Disclaimer

Educational portfolio project by Muktesh Puligar (IIIT-H, B.Tech Final Year).

- **Not financial advice** — Educational purposes only
- **Simulated data** — Where labeled with SIM badge
- **No warranty** — Provided as-is for demonstration

---

## 📞 Support

| Issue | Solution |
|-------|----------|
| **Setup issues** | Follow "Installation Guide" above |
| **API errors** | Check backend logs in terminal |
| **CORS problems** | Verify localhost:5173 is used |
| **Price won't update** | Check internet & ISIN/ticker format |
| **Build errors** | Delete node_modules, npm install |

---

## 🎯 Next Steps

1. **Run it locally** → Follow "Quick Start" above
2. **Explore features** → Use Holdings Manager to add/refresh
3. **Understand code** → Read comments in `frontend/src/app/api.ts`
4. **Deploy** → Follow "Deployment" section
5. **Customize** → Modify design tokens in `frontend/src/tokens.ts`

---

## ✅ Production Checklist

- [ ] All dependencies installed
- [ ] Backend runs without errors
- [ ] Frontend loads at localhost:5173
- [ ] REFRESH PRICES button works
- [ ] Portfolio values calculate correctly
- [ ] No console errors (F12)
- [ ] CSV import/export working
- [ ] Keyboard shortcuts functional

---

## 📊 Performance

| Metric | Value |
|--------|-------|
| **Frontend Bundle** | 484 kB JS (191 kB gzipped) |
| **Initial Load** | ~500ms |
| **Price Refresh** | 1-3 seconds (batch request) |
| **Cache Hit** | <10ms |
| **Code Splitting** | Per-screen chunks (19-44 kB each) |

---

## 🎨 Design System

**Colors** (Tokens in `frontend/src/tokens.ts`):
- `green`: #00FF9F (gains, primary)
- `red`: #FF433D (losses)
- `amber`: #FB8B1E (warnings)
- `blue`: #00CCFF (info)
- `bg0`: #0A0A0A (canvas)
- `bg1`: #111111 (panels)

**Typography**:
- Font: IBM Plex Mono (monospace)
- Base size: 11px
- Weights: Regular (400), Bold (600)

**Spacing**:
- Grid: 1px separators between panels
- Padding: 8-14px inside panels
- Gap: 6-12px between elements

---

## 📈 Version History

| Version | Date | Changes |
|---------|------|---------|
| **1.0.0** | Jun 2024 | ✅ Initial release |
| | | ✅ Real AMFI + NSE integration |
| | | ✅ Complete Bloomberg UI |
| | | ✅ All features working |
| | | ✅ Production ready |

---

## 🎉 You're All Set!

Your portfolio dashboard is ready to use. Start with **Quick Start** above and enjoy!

**Questions?** Check this README, check code comments, or review the error in browser console (F12).

---

**Built with ❤️ using React, FastAPI, and Bloomberg Terminal design principles.**

Status: ✅ Production Ready | Version: 1.0.0 | Last Updated: June 2024
