# Bloomberg Terminal — Design System Guidelines

## Aesthetic Principles

* **Ultra-dark canvas.** Background never lighter than `#0A0A0A`. No white or light-grey surfaces.
* **Neon signal colours on dark.** Green (`#00FF9F`) for gains / primary CTA. Amber (`#FB8B1E`) for warnings / moderate risk. Red (`#FF433D`) for losses / danger. Blue (`#00CCFF`) for info / mutual funds.
* **Monospace everywhere.** Font: `IBM Plex Mono` → `Roboto Mono` → `monospace`. No sans-serif body text.
* **Information density first.** Favour tight padding, 9–11px text, and dense grid layouts over whitespace.
* **Sharp edges.** Border radius ≤ 2px everywhere. Bloomberg has no soft cards.
* **Minimal motion.** Transitions max 200ms, `ease` or `linear`. No bounces, springs, or decorative animations.

## Colour Token Rules

All colours are defined in `src/tokens.ts` and mirrored as CSS variables in `src/styles/theme.css`.

| Token | Hex | Usage |
|---|---|---|
| `green` | `#00FF9F` | Gains, primary accent, active states |
| `red` | `#FF433D` | Losses, destructive actions |
| `amber` | `#FB8B1E` | Warnings, overexposure, MODERATE+ risk |
| `blue` | `#00CCFF` | Mutual funds, info badge |
| `purple` | `#BB44FF` | Contra / alternative strategies |
| `bg0` | `#0A0A0A` | App root canvas |
| `bg1` | `#111111` | Panel backgrounds |
| `bg2` | `#161616` | Elevated surfaces |
| `bg3` | `#1C1C1C` | Hover backgrounds |
| `border` | `#2A2A2A` | Primary dividers |
| `text` | `#E4E4E4` | Primary readable text |
| `text4` | `#444444` | Column headers, section labels |
| `text5` | `#3A3A3A` | Ghost text, keyboard hints |

* **Never hard-code hex values in components.** Import from `TerminalShared` (`TC.green`, `TC.bg0`, etc.).
* **Opacity suffixes** — `TC.green + '18'` = 18% alpha on green background. `TC.green + '44'` = 27% border.

## Typography Rules

* Base size: 13px (`--font-size` in `:root`).
* Section labels: 9px, `letter-spacing: 0.16em`, colour `TC.text4`, `text-transform: uppercase`.
* Column headers: 9px, `letter-spacing: 0.12em`, colour `TC.text4`.
* Primary cell values: 11px, colour `TC.text`.
* Metric hero values: 22px, `letter-spacing: -0.02em`.
* Gauge readout: 40px, signal colour.

## Component Rules

* **SectionLabel** — above every data group. Use `<SectionLabel>` from `TerminalShared`.
* **PanelHeader** — top of every scrollable section. Consistent height & style.
* **TRow** — all table rows. Provides zebra + hover + left-border green accent.
* **ThSort / ThFixed** — all `<th>` elements. Sticky, correct z-index.
* **TermBtn** — all interactive buttons. Three variants: `ghost` / `primary` / `danger`.
* **TypeBadge** — `MF` or `Stock` label in tables.
* **AlertPill** — overexposure sectors only.

## Layout Rules

* Use CSS Grid with `gap: '1px'` and a border-coloured background for Bloomberg "grid-line" panel separators.
* Sidebar width: 178px open / 38px collapsed. Transition: `width 200ms`.
* Header bar: 38px fixed height. Command bar: 26px fixed height.
* Scrollable regions: `overflow-y: auto` on the inner scroll container, never on the outer shell.
* Desktop-first. Minimum viewport: 1280px wide.

## Keyboard Shortcuts (mandatory)

| Key | Action |
|---|---|
| F1 | Overview tab |
| F2 | Holdings tab |
| F3 | Analysis tab |
| F4 | Recommendations tab |
| R | Refresh live data |
| `\` | Toggle sidebar |

## Adding New Screens

1. Create `src/app/components/<NameScreen>.tsx`.
2. Import `TC`, `GRID_BG`, shared UI from `TerminalShared`.
3. Apply `style={{ fontFamily: TC.font, background: TC.bg0, ...GRID_BG }}` to the root `<div>`.
4. Add a `PanelHeader` at the top.
5. Register the tab in `App.tsx` `TABS` array and add the `{tab === "name" && <NameScreen />}` conditional.

## Do Not

* Do not use `border-radius` > 2px.
* Do not use colours not in the token set without documenting the reason in a comment.
* Do not import `TC` from `tokens.ts` directly in screen components — always go through `TerminalShared`.
* Do not add any sans-serif font for body text.
* Do not use `z-index` > 20 (use the `Z` scale from tokens).
* Do not add CSS animations longer than 300ms.
