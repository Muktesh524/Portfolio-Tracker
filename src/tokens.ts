/**
 * Bloomberg Terminal Design Tokens
 * ─────────────────────────────────
 * Single source of truth for all visual constants.
 * Import TC (alias for TOKENS) into any component.
 *
 * Naming convention
 *   bg0–bg4   : backgrounds, darkest → lightest
 *   text–text5: foregrounds, brightest → most muted
 *   border/border2: divider lines
 *   green/red/amber/blue/purple: semantic signal colours
 */

// ─── Colour palette ───────────────────────────────────────────────────────────

export const COLOR = {
  // Signal colours
  green:  '#00FF9F',   // positive P&L, primary accent
  red:    '#FF433D',   // negative P&L, danger
  amber:  '#FB8B1E',   // warning, overexposure, moderate-risk
  blue:   '#00CCFF',   // mutual fund, info
  purple: '#BB44FF',   // contra / alternative

  // Backgrounds (darkest → lightest)
  bg0:    '#0A0A0A',   // app root / main canvas
  bg1:    '#111111',   // panels, cards
  bg2:    '#161616',   // elevated surfaces, dropdowns
  bg3:    '#1C1C1C',   // hover states, tooltips
  bg4:    '#222222',   // highest elevation surface

  // Borders / dividers
  border:  '#2A2A2A',  // primary divider
  border2: '#1E1E1E',  // subtle row separator

  // Foregrounds (brightest → most muted)
  text:   '#E4E4E4',   // primary readable text
  text2:  '#999999',   // secondary labels
  text3:  '#666666',   // tertiary / dimmed values
  text4:  '#444444',   // column headers, sub-labels
  text5:  '#3A3A3A',   // keyboard hints, ghost text (raised from #333 for accessibility)
} as const;

// ─── Typography ───────────────────────────────────────────────────────────────

export const FONT = {
  mono: "'IBM Plex Mono', 'Roboto Mono', 'Courier New', monospace",
  /** Base size for the terminal canvas. All sizes below are relative to this. */
  base: '13px',
} as const;

// ─── Font sizes (px values used in inline styles) ─────────────────────────────

export const FS = {
  xs:   '8px',    // tick labels, kbd hints
  sm:   '9px',    // column headers, section labels
  base: '10px',   // secondary values, tooltips
  md:   '11px',   // primary table cells, body text
  lg:   '12px',   // card titles
  xl:   '13px',   // secondary metric values
  xxl:  '22px',   // primary metric values (e.g. ₹32,717)
  hero: '40px',   // gauge readout
} as const;

// ─── Spacing (px values) ──────────────────────────────────────────────────────

export const SPACE = {
  px1:  '1px',
  px2:  '2px',
  px3:  '3px',
  px4:  '4px',
  px5:  '5px',
  px6:  '6px',
  px8:  '8px',
  px10: '10px',
  px12: '12px',
  px14: '14px',
  px16: '16px',
  px20: '20px',
  px24: '24px',
} as const;

// ─── Border radius ────────────────────────────────────────────────────────────

/** Bloomberg Terminal uses near-zero radii — sharp, not rounded. */
export const RADIUS = {
  none:  '0px',
  sharp: '1px',   // standard Bloomberg pill / badge / card
  soft:  '2px',   // maximum softness used anywhere
} as const;

// ─── Z-index scale ────────────────────────────────────────────────────────────

export const Z = {
  base:    0,
  raised:  1,
  sticky:  2,    // sticky table headers / footer rows
  overlay: 10,   // modals, drawers
  toast:   20,   // Sonner toasts
} as const;

// ─── Letter spacing ───────────────────────────────────────────────────────────

export const TRACKING = {
  tight:  '-0.02em',  // large hero numbers
  normal: '0em',
  wide:   '0.06em',   // command bar text
  wider:  '0.08em',   // brand / ticker labels
  widest: '0.14em',   // section label caps
  ultra:  '0.16em',   // column headers
} as const;

// ─── Transition ───────────────────────────────────────────────────────────────

export const TRANSITION = {
  fast:   '80ms',
  normal: '120ms',
  slow:   '200ms',
} as const;

// ─── Semantic aliases ─────────────────────────────────────────────────────────

/**
 * TC (Terminal Colors) — flat alias object kept for ergonomic inline usage.
 * Import `TC` wherever you need quick access to colours + font.
 */
export const TC = {
  ...COLOR,
  font: FONT.mono,
} as const;

export type TCKey = keyof typeof TC;

// ─── Chart palette (ordered for recharts Cell assignments) ────────────────────

export const CHART_COLORS = [
  COLOR.green,
  COLOR.amber,
  COLOR.red,
  COLOR.blue,
  COLOR.purple,
  '#44FF88',
  '#FF8844',
  '#FFDD44',
  '#4499FF',
  '#88FF44',
] as const;

// ─── Gain/loss semantic helpers ───────────────────────────────────────────────

export const gainColor  = (n: number): string => n >= 0 ? COLOR.green : COLOR.red;
export const gainSymbol = (n: number): string => n >= 0 ? '▲' : '▼';

// ─── Grid background texture ──────────────────────────────────────────────────

import type { CSSProperties } from 'react';

export const GRID_BG: CSSProperties = {
  backgroundImage:
    'linear-gradient(rgba(255,255,255,0.022) 1px, transparent 1px),' +
    'linear-gradient(90deg, rgba(255,255,255,0.022) 1px, transparent 1px)',
  backgroundSize: '24px 24px',
};
