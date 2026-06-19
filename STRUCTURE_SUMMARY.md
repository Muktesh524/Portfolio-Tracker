# Project Structure

```
Portfolio Tracker/
│
├── README.md                          ← Main documentation
├── STRUCTURE_SUMMARY.md               ← This file
├── .gitignore
│
├── backend/                           ← FastAPI REST Server
│   ├── main.py                       ← 6 API endpoints
│   ├── requirements.txt              ← Python dependencies
│   ├── start.sh / start.bat          ← Launcher scripts
│   ├── .env                          ← Configuration
│   └── .gitignore
│
├── frontend/                          ← React + TypeScript Dashboard
│   ├── src/
│   │   ├── main.tsx                  ← Entry point
│   │   ├── tokens.ts                 ← Design tokens (colors, fonts, spacing)
│   │   ├── app/
│   │   │   ├── App.tsx               ← Root component (tabs, sidebar, ticker)
│   │   │   ├── api.ts                ← API client with 5-min cache
│   │   │   ├── store.ts              ← Global state (useSyncExternalStore)
│   │   │   └── components/
│   │   │       ├── OverviewScreen.tsx
│   │   │       ├── HoldingsScreen.tsx
│   │   │       ├── RecommendationsScreen.tsx
│   │   │       ├── TerminalShared.tsx ← Types, formatters, static data
│   │   │       ├── SparklineCell.tsx
│   │   │       ├── PerformanceTrendChart.tsx
│   │   │       └── ui/               ← 35+ shadcn/Radix primitives
│   │   └── styles/
│   │       ├── index.css
│   │       ├── fonts.css
│   │       ├── tailwind.css
│   │       ├── theme.css
│   │       └── globals.css
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   ├── .config/                      ← PostCSS, pnpm workspace
│   ├── .docs/                        ← Frontend docs
│   └── guidelines/                   ← Design reference
│
└── venv/                              ← Python virtual environment (git-ignored)
```

## Quick Start

```bash
# Terminal 1: Backend
cd backend
pip install -r requirements.txt
python main.py                    # http://localhost:8000

# Terminal 2: Frontend
cd frontend
npm install
npm run dev                       # http://localhost:5173
```
