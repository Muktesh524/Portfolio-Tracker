# Bloomberg Terminal — Portfolio Dashboard

A high-fidelity, Bloomberg Terminal-inspired portfolio tracking dashboard built with React, TypeScript, and Recharts. Designed as both a functional personal investment tracker for the Indian market and a professional portfolio piece demonstrating advanced frontend engineering, financial UI/UX design, and reactive state management.

> **Educational project** — All market data, correlations, Monte Carlo projections, and index prices are simulated. Clearly labelled with amber **SIM** badges throughout the UI. This is not financial advice.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 18.3 + TypeScript |
| Bundler | Vite 6.3 with code splitting (`React.lazy`) |
| Styling | Tailwind CSS v4 + custom design tokens (`tokens.ts`) |
| Charts | Recharts 2.15 (Pie, Bar, Area, Line, sparklines) |
| UI Primitives | Radix UI / shadcn/ui (headless components) |
| Icons | Lucide React |
| Notifications | Sonner (toast system) |
| State | Custom reactive store using `useSyncExternalStore` + `localStorage` |
| Font | IBM Plex Mono (Google Fonts) |

Zero backend dependencies — the entire app runs as a static SPA.

## Features

### Overview Screen (F1)
- **Animated index ticker** — NIFTY 50, SENSEX, NIFTY MIDCAP, USD/INR scrolling with CSS animation
- **Market status badge** — detects NSE trading hours (09:15–15:30 IST) and shows OPEN/CLOSED
- **Five primary KPI tiles** — Current Value, Invested, Gain/Loss, MF split, Stock split
- **Three-panel chart row** — Asset allocation donut, Sector exposure bar chart, Performance trend area chart (7D/30D/90D toggle)
- **Holdings table** — Sortable columns, per-row sparkline charts, consolidated G/L cell with both absolute and percentage values
- **Live IST clock** — Updates every second, displayed in the header bar

### Holdings Manager (F2)
- **Inline editing** — Click units, avg cost, or notes cells to edit in-place (Enter to save, Escape to cancel)
- **Drag-and-drop reordering** — Grab the grip icon to reorder rows
- **Add/Edit side panel** — Full form with MF scheme search helper and auto-calculate (units x avgCost)
- **CSV import** — Parse uploaded .csv files with validation, duplicate detection, and error reporting
- **CSV export** — Download the full portfolio as a .csv file
- **localStorage persistence** — All changes persist across browser reloads
- **Reset to Demo Data** — One-click restore of the 13-instrument demo portfolio
- **Empty state** — Clean UI when no holdings are present

### Risk & Analysis (F3)
- **SVG risk gauge** — Semi-circular gauge with coloured zones (Conservative → Aggressive)
- **Profile assessment** — 6-point checklist evaluating equity allocation, diversification, index exposure, etc.
- **Sector breakdown table** — All sectors with value, weight %, status badges (OK/OVER), and mini bars
- **Correlation matrix heatmap** — NxN sector correlation grid with heat colouring (simulated)
- **What-If allocation simulator** — Sliders to adjust sector weights, with projected risk score, estimated CAGR, and Sharpe proxy
- **Historical drawdown chart** — 90-day peak-to-trough drawdown area chart (simulated)

### Recommendations Engine (F4)
- **Reactive recommendation cards** — 4–6 cards dynamically generated from actual portfolio state (debt gap, sector concentration, small-cap overweight, index underweight, diversification)
- **Severity indicators** — HIGH (red), MODERATE (amber), LOW (green) with metric badges
- **Monte Carlo simulation** — 500-path GBM projection with 1Y/3Y/5Y horizons, showing median, P10, P90, and probability of profit
- **Rebalancing calculator** — Current vs target allocation table with editable targets, gap %, exact trade amounts (BUY/SELL), and equal-weight default

### Global Features
- **Reactive sidebar** — Portfolio value, gain, return %, allocations, and risk profile update instantly when holdings change
- **Keyboard shortcuts** — F1–F4 for tabs, R to refresh, `\` to toggle sidebar
- **Code splitting** — Each screen loads on demand via `React.lazy` + `Suspense`
- **Loading skeleton** — Bloomberg-style pulsing bars shown while screen chunks load
- **Custom scrollbars** — 5px wide, dark track, green thumb on hover
- **Focus rings** — Amber `:focus-visible` outlines for keyboard navigation
- **Command bar** — Bottom bar with shortcut hints, data source label, and version

## Getting Started

### Prerequisites
- Node.js 18+ (LTS recommended)
- npm, pnpm, or yarn

### Install & Run

```bash
# Clone or download the project
cd "Bloomberg-Inspired Portfolio Dashboard"

# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in a modern browser (Chrome, Edge, Firefox, Safari).

### Production Build

```bash
npm run build
```

Outputs a static bundle to `dist/`. Deploy to any static hosting provider.

### Browser Requirements
- Desktop-first layout (minimum 1280px viewport width)
- Modern browser with ES2020+ support
- localStorage enabled (for holdings persistence)

## Project Structure

```
src/
├── main.tsx                          Entry point — createRoot + StrictMode
├── tokens.ts                         Design token system (colors, fonts, spacing)
├── app/
│   ├── App.tsx                       Shell — tabs, sidebar, keyboard shortcuts, lazy loading
│   ├── store.ts                      Reactive global store (useSyncExternalStore)
│   └── components/
│       ├── TerminalShared.tsx         Shared types, data, formatters, UI primitives
│       ├── OverviewScreen.tsx         F1 — metrics, charts, ticker, sparklines
│       ├── HoldingsScreen.tsx         F2 — CRUD table, inline edit, DnD, CSV
│       ├── AnalysisScreen.tsx         F3 — gauge, correlation, what-if, drawdown
│       ├── RecommendationsScreen.tsx  F4 — dynamic recs, Monte Carlo, rebalancing
│       ├── SparklineCell.tsx          60×24px inline sparkline per holding
│       ├── PerformanceTrendChart.tsx  7D/30D/90D area chart with window toggle
│       └── figma/
│           └── ImageWithFallback.tsx  Figma asset helper (legacy)
├── styles/
│   ├── index.css                     Import chain
│   ├── fonts.css                     Google Fonts (IBM Plex Mono)
│   ├── tailwind.css                  Tailwind v4 source
│   ├── theme.css                     CSS custom properties (mirrors tokens.ts)
│   └── globals.css                   Resets, scrollbar, focus rings, utilities
└── ...
```

### Key Files

| File | Purpose |
|---|---|
| `tokens.ts` | Single source of truth for all design tokens (colours, fonts, sizes, spacing, radii, z-index, transitions) |
| `store.ts` | Global reactive store — `useHoldings()`, `useHoldingActions()`, `usePortfolioSummary()` |
| `TerminalShared.tsx` | Re-exports tokens + contains domain types (`Holding`, `ComputedHolding`), static data, formatters (`fmtINR`, `fmtPct`), and shared UI components (`SectionLabel`, `TRow`, `Td`, `PanelHeader`, `TermBtn`, etc.) |

## Data Sources & Simulation

**All data in this dashboard is simulated or static.**

| Data | Source | Status |
|---|---|---|
| Holdings (names, NAVs, units) | Static demo dataset (13 instruments) | Editable via F2 |
| Market indices (NIFTY, SENSEX) | Hardcoded placeholder values | Labelled **SIM** |
| Performance trend | Seeded pseudo-random walk, ending at actual portfolio value | Labelled **SIM** |
| Sparklines | Seeded PRNG per holding, drift matches actual G/L% | Labelled **SIM** |
| Correlation matrix | Seeded random correlations in [-0.3, 0.95] | Labelled **SIM** |
| Monte Carlo paths | 500-path Geometric Brownian Motion with Box-Muller normals | Labelled **SIM** |
| Drawdown chart | Derived from simulated performance series | Labelled **SIM** |
| Rebalancing trades | Computed from current vs target allocation (not executable) | Indicative only |

**Persistence:** Holdings are stored in `localStorage` under the key `bloomberg-portfolio-holdings`. Editing, adding, deleting, reordering, or importing holdings from CSV all persist immediately. Use "RESET DEMO" on the Holdings screen to restore the original 13-instrument dataset.

## How It Works (Architecture)

### Reactive Store

The app uses a zero-dependency reactive store built on React 18's `useSyncExternalStore`:

```
store.ts
  ├── External module-level state (Holding[])
  ├── localStorage read/write on every mutation
  ├── Listener set for subscriber notifications
  └── Three hooks:
      ├── useHoldings()          → Holding[]
      ├── useHoldingActions()    → { set, add, update, remove, reset, clear }
      └── usePortfolioSummary()  → derived totals, percentages, counts
```

When `HoldingsScreen` calls `actions.update(id, { units: 40 })`:
1. The store updates the module-level `holdings` array
2. Persists to `localStorage`
3. Notifies all listeners
4. Every component using `useHoldings()` or `usePortfolioSummary()` re-renders
5. Sidebar stats, Overview metrics, Analysis charts, and Recommendations all update instantly

Cross-tab sync is supported via the `storage` event listener.

### Code Splitting

Each screen is loaded via `React.lazy()`:
```typescript
const OverviewScreen = lazy(() =>
  import("./components/OverviewScreen").then(m => ({ default: m.OverviewScreen }))
);
```

A `<Suspense fallback={<ScreenSkeleton />}>` wrapper shows Bloomberg-style pulsing bars while the chunk loads. Initial JS payload is ~203 kB (down from ~706 kB before splitting).

## Bloomberg Terminal Design

### Principles

1. **Ultra-dark canvas** — Background never lighter than `#0A0A0A`. No white or light surfaces.
2. **Neon signal colours on dark** — Green (`#00FF9F`) for gains, Red (`#FF433D`) for losses, Amber (`#FB8B1E`) for warnings, Blue (`#00CCFF`) for info.
3. **Monospace everywhere** — IBM Plex Mono, no sans-serif body text.
4. **Information density** — Tight padding, 9–11px text, dense grid layouts over whitespace.
5. **Sharp edges** — Border radius capped at 2px. No soft cards.
6. **Minimal motion** — Transitions max 200ms, `ease` or `linear`. No decorative animations.

### Colour Tokens

| Token | Hex | Usage |
|---|---|---|
| `green` | `#00FF9F` | Gains, primary accent |
| `red` | `#FF433D` | Losses, danger |
| `amber` | `#FB8B1E` | Warnings, overexposure |
| `blue` | `#00CCFF` | Mutual funds, info |
| `purple` | `#BB44FF` | Contra / alternative |
| `bg0` | `#0A0A0A` | Root canvas |
| `bg1` | `#111111` | Panel backgrounds |
| `text` | `#E4E4E4` | Primary readable text |
| `border` | `#2A2A2A` | Dividers |

All tokens are defined in `src/tokens.ts` and mirrored as CSS variables in `src/styles/theme.css`.

## Keyboard Shortcuts

| Key | Action |
|---|---|
| `F1` | Switch to Overview |
| `F2` | Switch to Holdings |
| `F3` | Switch to Analysis |
| `F4` | Switch to Recommendations |
| `R` | Refresh portfolio data |
| `\` | Toggle sidebar |

Shortcuts are disabled when focus is inside an input, textarea, or select element.

## Deployment

### Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

Or connect the GitHub repository to [vercel.com](https://vercel.com) for automatic deployments on push.

### Netlify

```bash
# Install Netlify CLI
npm i -g netlify-cli

# Build and deploy
npm run build
netlify deploy --prod --dir=dist
```

### GitHub Pages

```bash
npm run build
# Push the dist/ folder to a gh-pages branch
```

### Any Static Host

The `dist/` folder after `npm run build` contains a fully self-contained static site (HTML + JS + CSS). Upload to any web server, S3 bucket, or CDN.

## Future Improvements

- **Live data backend** — Python FastAPI service wrapping `mftool` (AMFI mutual fund NAVs) and `yfinance` (NSE stock prices) to replace simulated data with real-time values
- **Mobile responsive layout** — Current design is desktop-first (1280px minimum); a responsive breakpoint system would extend reach
- **Dark/light theme toggle** — Infrastructure exists in `theme.css` (`.dark` class); a light Bloomberg-like theme could be added
- **Authentication + cloud sync** — Replace localStorage with a user account and cloud database for cross-device access
- **PDF report export** — Generate a formatted PDF portfolio report from the current state
- **WebSocket live ticker** — Real-time index price updates via a WebSocket connection to a market data provider
- **Performance attribution** — Break down portfolio return by sector, asset type, and time period
- **Tax-loss harvesting** — Identify holdings in loss that could be sold for tax benefits

## License & Disclaimer

This project is an **educational portfolio piece** built by Muktesh Puligar (IIIT-H, B.Tech final year) for IIM MBA applications and finance internship demonstrations.

- **Not financial advice.** All recommendations, simulations, and projections are for educational purposes only.
- **Simulated data.** Market indices, correlations, Monte Carlo paths, and performance charts use seeded pseudo-random data, not live feeds.
- **No warranty.** Provided as-is for demonstration and learning purposes.

---

Built with React + TypeScript + Recharts. Designed to the Bloomberg Terminal aesthetic.
