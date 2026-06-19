# Frontend Project Structure

## Clean Organization

```
Bloomberg-Inspired Portfolio Dashboard/
│
├── 📂 src/                    ← SOURCE CODE (everything here)
│   ├── 📂 app/               ← Application logic
│   │   ├── api.ts           ← API client with caching
│   │   ├── store.ts         ← Global state management
│   │   ├── App.tsx          ← Root component
│   │   └── 📂 components/   ← All UI components
│   │       ├── OverviewScreen.tsx
│   │       ├── HoldingsScreen.tsx
│   │       ├── RecommendationsScreen.tsx
│   │       ├── SparklineCell.tsx
│   │       ├── PerformanceTrendChart.tsx
│   │       ├── TerminalShared.tsx
│   │       └── ui/          ← Radix UI components
│   │
│   ├── 📂 styles/           ← CSS & Tailwind
│   │   ├── index.css
│   │   ├── fonts.css
│   │   ├── tailwind.css
│   │   ├── theme.css
│   │   └── globals.css
│   │
│   ├── tokens.ts            ← Design tokens (colors, fonts, spacing)
│   └── main.tsx             ← Entry point
│
├── 📂 public/               ← Static assets (if any)
│
├── 📂 .config/              ← Build & config files (hidden)
│   ├── postcss.config.mjs
│   ├── default_shadcn_theme.css
│   ├── pnpm-workspace.yaml
│   └── .gitignore
│
├── 📂 .docs/                ← Documentation (hidden)
│   ├── FRONTEND.md
│   ├── STRUCTURE.md         ← This file
│   └── ATTRIBUTIONS.md
│
├── 📂 .git/                 ← Git repository (hidden)
│
├── 📂 node_modules/         ← Dependencies (ignored by git)
│
├── 📂 dist/                 ← Production build (ignored by git)
│
├── ⚙️  Configuration Files (Root)
│   ├── package.json         ← Dependencies & scripts
│   ├── package-lock.json    ← Lock file
│   ├── vite.config.ts       ← Vite bundler config
│   ├── tsconfig.json        ← TypeScript config
│   ├── .gitignore           ← Git ignore rules
│   └── index.html           ← HTML template
│
└── 📂 guidelines/           ← Design guidelines (reference)
```

## File Organization Principles

### Root Level (Minimal)
Only essential build/config files:
- `package.json` — Dependencies
- `vite.config.ts` — Build tool
- `tsconfig.json` — TypeScript
- `index.html` — Entry HTML
- `.gitignore` — Git rules

### `/src` (All Code)
Everything the app needs:
- `app/` — Application logic & components
- `styles/` — Styling
- `tokens.ts` — Design system
- `main.tsx` — Bootstrap

### `/.config` (Hidden Build Files)
Non-essential config:
- `postcss.config.mjs`
- `pnpm-workspace.yaml`
- `default_shadcn_theme.css`

### `/.docs` (Hidden Documentation)
Reference docs:
- `FRONTEND.md` — Frontend-specific docs
- `ATTRIBUTIONS.md` — Credits
- `STRUCTURE.md` — This file

### `/public` (Optional)
Static assets:
- Images
- Icons
- Static files

## What to Ignore (Git)

Automatically ignored (see `.gitignore`):
- `node_modules/` — Dependencies
- `dist/` — Build output
- `.venv/` — Virtual env
- `*.log` — Log files
- `.DS_Store` — Mac files

## Quick Reference

| Folder | Purpose | What's Inside |
|--------|---------|----------------|
| `src/app/` | Application logic | React components, state, API |
| `src/app/components/` | UI components | Screen components, UI helpers |
| `src/styles/` | Styling | CSS files, Tailwind, theme |
| `public/` | Static assets | Images, fonts, etc |
| `.config/` | Build config | Build & tool config files |
| `.docs/` | Documentation | Guides and references |

## Development Workflow

1. **Edit code** → in `src/` folder
2. **Import components** → from `src/app/components/`
3. **Use tokens** → from `src/tokens.ts`
4. **Style** → in `src/styles/` or with Tailwind classes
5. **Build** → `npm run build` creates `dist/`
6. **Deploy** → push `dist/` folder to hosting

## IDE View (VS Code Explorer)

**Compact (Folded)**
```
Bloomberg-Inspired Portfolio Dashboard/
 ├─ src/
 ├─ public/
 ├─ package.json
 ├─ vite.config.ts
 └─ index.html
```

**Expanded (Full)**
```
Bloomberg-Inspired Portfolio Dashboard/
 ├─ src/
 │  ├─ app/
 │  │  ├─ api.ts
 │  │  ├─ store.ts
 │  │  ├─ App.tsx
 │  │  └─ components/
 │  ├─ styles/
 │  ├─ tokens.ts
 │  └─ main.tsx
 ├─ public/
 ├─ .config/
 ├─ .docs/
 ├─ node_modules/
 ├─ dist/
 ├─ package.json
 ├─ vite.config.ts
 ├─ tsconfig.json
 ├─ index.html
 └─ .gitignore
```

## File Count

- **Source files** (`.tsx`, `.ts`): ~20 files
- **Style files** (`.css`): 5 files
- **Config files**: 4 files
- **Documentation**: 3 files
- **Dependencies**: ~500+ (in node_modules)

## Pro Tips

1. **Keep `src/` clean** — All user-facing code lives here
2. **Use `src/tokens.ts`** — Never hardcode colors or sizes
3. **Component hierarchy** — Each screen has a folder: `components/OverviewScreen.tsx`
4. **Avoid root clutter** — Config belongs in `.config/`, docs in `.docs/`
5. **Build is ignored** — `dist/` is in `.gitignore`, never commit it

---

**Total Structure: Clean, Professional, Scalable** ✨
