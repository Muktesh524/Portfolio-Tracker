/**
 * TerminalShared.tsx
 * ──────────────────
 * Centralised module for:
 *   • Design token re-exports (TC, GRID_BG, gainColor, gainSymbol)
 *   • Domain types (Holding, ComputedHolding)
 *   • Static portfolio data (HOLDINGS, SECTOR_COLORS)
 *   • Shared formatters (fmtINR, fmtPct, …)
 *   • Shared UI primitives (SectionLabel, TRow, Td, PanelHeader, …)
 *
 * All screen components import exclusively from this file so design changes
 * propagate from a single location.
 */

import React from "react";
import { ChevronUp, ChevronDown } from "lucide-react";

// ─── Re-export tokens ─────────────────────────────────────────────────────────
// Screens import `TC` from here — they never need to know about tokens.ts.

export {
  TC, GRID_BG, gainColor, gainSymbol,
  COLOR, FONT, FS, SPACE, RADIUS, Z, TRACKING, TRANSITION, CHART_COLORS,
} from "../../tokens";

export type { TCKey } from "../../tokens";

// Import locally so we can use in this file
import { TC, GRID_BG } from "../../tokens";

// ─── Sector colours ───────────────────────────────────────────────────────────

export const SECTOR_COLORS: Record<string, string> = {
  'Flexi Cap': TC.green,
  'Large Cap': '#44FF88',
  'Small Cap': TC.amber,
  'Index':     TC.blue,
  'Mid Cap':   '#88FF44',
  'Contra':    TC.purple,
  'ELSS':      '#FF8844',
  'Energy':    '#FF6644',
  'IT':        '#4499FF',
  'Banking':   '#FFDD44',
};

// ─── Domain types ─────────────────────────────────────────────────────────────

export interface Holding {
  id: number;
  type: 'MF' | 'Stock';
  name: string;
  shortName: string;
  identifier: string;
  units: number;
  avgCost: number;
  currentNav: number;
  sector: string;
  invested: number;
  notes: string;
}

export interface ComputedHolding extends Holding {
  currentValue: number;
  gainLoss: number;
  gainLossPct: number;
}

// ─── Static portfolio data ────────────────────────────────────────────────────

export const HOLDINGS: Holding[] = [
  { id:1,  type:'MF',    name:'Parag Parikh Flexi Cap Fund – Dir Gr',  shortName:'PP Flexi Cap',    identifier:'122655',      units:36.42,  avgCost:82.37,   currentNav:92.14,   sector:'Flexi Cap', invested:2999.0,  notes:'Core holding' },
  { id:2,  type:'MF',    name:'UTI Nifty 50 Index Fund – Dir Gr',      shortName:'UTI Nifty 50',    identifier:'120716',      units:18.03,  avgCost:138.66,  currentNav:152.34,  sector:'Index',     invested:2500.0,  notes:'SIP ₹500/mo' },
  { id:3,  type:'MF',    name:'Mirae Asset Large Cap Fund – Dir Gr',   shortName:'Mirae Large Cap', identifier:'118989',      units:18.41,  avgCost:108.64,  currentNav:118.92,  sector:'Large Cap', invested:1999.0,  notes:'' },
  { id:4,  type:'MF',    name:'Axis Small Cap Fund – Dir Gr',          shortName:'Axis Small Cap',  identifier:'125494',      units:15.74,  avgCost:95.33,   currentNav:88.44,   sector:'Small Cap', invested:1500.0,  notes:'High risk' },
  { id:5,  type:'MF',    name:'HDFC Mid-Cap Opportunities – Dir Gr',   shortName:'HDFC Mid Cap',    identifier:'118825',      units:22.24,  avgCost:112.38,  currentNav:128.66,  sector:'Mid Cap',   invested:2499.0,  notes:'' },
  { id:6,  type:'MF',    name:'SBI Contra Fund – Dir Gr',              shortName:'SBI Contra',      identifier:'100025',      units:20.13,  avgCost:89.44,   currentNav:98.77,   sector:'Contra',    invested:1800.0,  notes:'' },
  { id:7,  type:'MF',    name:'Nippon India Small Cap Fund – Dir Gr',  shortName:'Nippon Small Cap',identifier:'118550',      units:23.77,  avgCost:84.15,   currentNav:89.22,   sector:'Small Cap', invested:2000.0,  notes:'' },
  { id:8,  type:'MF',    name:'DSP Tax Saver Fund (ELSS) – Dir Gr',    shortName:'DSP Tax Saver',   identifier:'102885',      units:14.31,  avgCost:104.77,  currentNav:112.34,  sector:'ELSS',      invested:1499.0,  notes:'80C lock-in' },
  { id:9,  type:'MF',    name:'Canara Robeco Emerging Equities – Dir', shortName:'Canara Robeco EE',identifier:'101230',      units:9.53,   avgCost:188.88,  currentNav:204.12,  sector:'Mid Cap',   invested:1800.0,  notes:'' },
  { id:10, type:'MF',    name:'Motilal Oswal Nifty 500 Index – Dir',   shortName:'MO Nifty 500',    identifier:'147663',      units:108.37, avgCost:22.14,   currentNav:24.88,   sector:'Index',     invested:2399.0,  notes:'Broad market' },
  { id:11, type:'Stock', name:'Reliance Industries Ltd',                shortName:'RELIANCE',        identifier:'RELIANCE.NS', units:1,      avgCost:2847.50, currentNav:3142.60, sector:'Energy',    invested:2847.50, notes:'Long term' },
  { id:12, type:'Stock', name:'Infosys Ltd',                            shortName:'INFY',            identifier:'INFY.NS',     units:3,      avgCost:1542.30, currentNav:1648.90, sector:'IT',        invested:4626.90, notes:'' },
  { id:13, type:'Stock', name:'HDFC Bank Ltd',                          shortName:'HDFCBANK',        identifier:'HDFCBANK.NS', units:1,      avgCost:1623.40, currentNav:1724.40, sector:'Banking',   invested:1623.40, notes:'' },
];

// ─── Portfolio computation helpers ────────────────────────────────────────────

export function computeHoldings(holdings: Holding[]): ComputedHolding[] {
  return holdings.map(h => {
    const currentValue  = h.units * h.currentNav;
    const gainLoss      = currentValue - h.invested;
    const gainLossPct   = (gainLoss / h.invested) * 100;
    return { ...h, currentValue, gainLoss, gainLossPct };
  });
}

export const totalValue    = (h: ComputedHolding[]) => h.reduce((s, x) => s + x.currentValue, 0);
export const totalInvested = (h: ComputedHolding[]) => h.reduce((s, x) => s + x.invested,     0);

// ─── Formatters ───────────────────────────────────────────────────────────────

/** Format a number as Indian-locale INR with optional decimal places. */
export function fmtINR(n: number, dec = 0): string {
  return '₹' + Math.abs(n).toLocaleString('en-IN', {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  });
}

export const fmtINR2 = (n: number): string => fmtINR(n, 2);

/** Format a percentage with sign prefix. */
export function fmtPct(n: number): string {
  return (n >= 0 ? '+' : '') + n.toFixed(2) + '%';
}

// ─── Shared UI primitives ─────────────────────────────────────────────────────

/** Tiny ALL-CAPS dim section label — used above every data group. */
export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      color:          TC.text4,
      fontSize:       '9px',
      letterSpacing:  '0.16em',
      fontFamily:     TC.font,
      textTransform:  'uppercase',
    }}>
      {children}
    </div>
  );
}

/** MF / Stock type badge. */
export function TypeBadge({ type }: { type: 'MF' | 'Stock' }) {
  const isMF = type === 'MF';
  return (
    <span style={{
      display:       'inline-block',
      fontSize:      '8px',
      padding:       '1px 5px',
      borderRadius:  '1px',
      background:    isMF ? '#001A3A' : '#001A0A',
      color:         isMF ? TC.blue   : TC.green,
      border:        `1px solid ${isMF ? TC.blue + '44' : TC.green + '44'}`,
      fontFamily:    TC.font,
      letterSpacing: '0.04em',
      whiteSpace:    'nowrap',
    }}>
      {type}
    </span>
  );
}

/** Gain/loss display: ▲▼ + amount + optional percentage. */
export function GainCell({
  value, pct, compact = false,
}: {
  value: number; pct: number; compact?: boolean;
}) {
  const color  = value >= 0 ? TC.green : TC.red;
  const symbol = value >= 0 ? '▲' : '▼';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color, fontFamily: TC.font, fontSize: '11px' }}>
      <span style={{ fontSize: '9px', lineHeight: 1 }}>{symbol}</span>
      {compact
        ? <span>{fmtINR2(Math.abs(value))}</span>
        : <>
            <span>{fmtINR2(Math.abs(value))}</span>
            <span style={{ color: color + 'BB', fontSize: '10px' }}>({Math.abs(pct).toFixed(2)}%)</span>
          </>
      }
    </span>
  );
}

/** Sortable table header <th>. */
export function ThSort({
  label, sortKey, activeSortKey, dir, onSort, align = 'right',
}: {
  label:        string;
  sortKey:      string;
  activeSortKey: string;
  dir:          'asc' | 'desc';
  onSort:       (k: string) => void;
  align?:       'left' | 'right';
}) {
  const active = sortKey === activeSortKey;
  return (
    <th
      onClick={() => onSort(sortKey)}
      style={{
        color:         active ? TC.text2 : TC.text4,
        fontSize:      '9px',
        letterSpacing: '0.12em',
        padding:       '6px 10px',
        textAlign:     align,
        cursor:        'pointer',
        whiteSpace:    'nowrap',
        userSelect:    'none',
        fontFamily:    TC.font,
        background:    TC.bg1,
        position:      'sticky',
        top:           0,
        zIndex:        2,
        borderBottom:  `1px solid ${TC.border}`,
        transition:    'color 80ms',
      }}
    >
      {label}
      {active && (
        dir === 'asc'
          ? <ChevronUp   className="inline w-2.5 h-2.5 ml-0.5" />
          : <ChevronDown className="inline w-2.5 h-2.5 ml-0.5" />
      )}
    </th>
  );
}

/** Non-sortable table header <th>. */
export function ThFixed({
  label, align = 'right',
}: { label: string; align?: 'left' | 'right' }) {
  return (
    <th style={{
      color:         TC.text4,
      fontSize:      '9px',
      letterSpacing: '0.12em',
      padding:       '6px 10px',
      textAlign:     align,
      whiteSpace:    'nowrap',
      fontFamily:    TC.font,
      background:    TC.bg1,
      position:      'sticky',
      top:           0,
      zIndex:        2,
      borderBottom:  `1px solid ${TC.border}`,
    }}>
      {label}
    </th>
  );
}

/** Zebra-striped, hover-highlighted table row with left-border accent. */
export function TRow({
  index, children, onClick,
}: {
  index:     number;
  children:  React.ReactNode;
  onClick?:  () => void;
}) {
  const [hovered, setHovered] = React.useState(false);
  const base = index % 2 === 0 ? TC.bg0 : TC.bg1;
  return (
    <tr
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background:   hovered ? '#141E14' : base,
        borderBottom: `1px solid ${TC.border2}`,
        cursor:       onClick ? 'pointer' : 'default',
        transition:   'background 80ms',
        borderLeft:   hovered ? `2px solid ${TC.green}` : '2px solid transparent',
      }}
    >
      {children}
    </tr>
  );
}

/** Standard table data cell — right-aligned by default. */
export function Td({
  children, align = 'right', style, colSpan,
}: {
  children:  React.ReactNode;
  align?:    'left' | 'right' | 'center';
  style?:    React.CSSProperties;
  colSpan?:  number;
}) {
  return (
    <td
      colSpan={colSpan}
      style={{
        padding:    '5px 10px',
        textAlign:  align,
        fontFamily: TC.font,
        fontSize:   '11px',
        color:      TC.text,
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {children}
    </td>
  );
}

/** Amber overexposure alert pill — sector + weight vs 25% threshold. */
export function AlertPill({ sector, pct }: { sector: string; pct: number }) {
  return (
    <div style={{
      display:       'inline-flex',
      alignItems:    'center',
      gap:           '6px',
      background:    '#150B00',
      border:        `1px solid ${TC.amber}44`,
      padding:       '3px 10px',
      borderRadius:  '1px',
      fontFamily:    TC.font,
      fontSize:      '10px',
      color:         TC.amber,
    }}>
      ⚠ <strong>{sector.toUpperCase()}</strong> {pct.toFixed(1)}% &gt; 25%
    </div>
  );
}

/** Consistent panel header bar used at the top of every section. */
export function PanelHeader({
  title, right,
}: {
  title:  string;
  right?: React.ReactNode;
}) {
  return (
    <div style={{
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'space-between',
      padding:        '5px 12px',
      background:     TC.bg1,
      borderBottom:   `1px solid ${TC.border}`,
      flexShrink:     0,
    }}>
      <span style={{ color: TC.text4, fontSize: '9px', letterSpacing: '0.16em', fontFamily: TC.font }}>
        {title}
      </span>
      {right && <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>{right}</div>}
    </div>
  );
}

/** Terminal-styled text input. */
export function TermInput({
  value, onChange, placeholder, type = 'text', style,
}: {
  value:        string | number;
  onChange:     (v: string) => void;
  placeholder?: string;
  type?:        string;
  style?:       React.CSSProperties;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        background:   TC.bg0,
        border:       `1px solid ${TC.border}`,
        color:        TC.text,
        padding:      '5px 8px',
        borderRadius: '1px',
        fontSize:     '11px',
        fontFamily:   TC.font,
        outline:      'none',
        width:        '100%',
        ...style,
      }}
      onFocus={e => { e.target.style.borderColor = TC.green + '66'; }}
      onBlur={e  => { e.target.style.borderColor = TC.border; }}
    />
  );
}

/** Terminal-styled button with ghost / primary / danger variants. */
export function TermBtn({
  children, onClick, variant = 'ghost', disabled,
}: {
  children:  React.ReactNode;
  onClick?:  () => void;
  variant?:  'ghost' | 'primary' | 'danger';
  disabled?: boolean;
}) {
  const variantStyles: Record<string, React.CSSProperties> = {
    ghost:   { background: TC.bg2,   color: TC.green, border: `1px solid ${TC.green}33` },
    primary: { background: TC.green, color: TC.bg0,   border: 'none', fontWeight: 600 },
    danger:  { background: '#1A0505', color: TC.red,  border: `1px solid ${TC.red}33` },
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display:     'inline-flex',
        alignItems:  'center',
        gap:         '5px',
        padding:     '4px 10px',
        borderRadius:'1px',
        fontSize:    '10px',
        fontFamily:  TC.font,
        letterSpacing:'0.08em',
        cursor:      disabled ? 'not-allowed' : 'pointer',
        opacity:     disabled ? 0.5 : 1,
        transition:  'opacity 80ms',
        ...variantStyles[variant],
      }}
    >
      {children}
    </button>
  );
}
