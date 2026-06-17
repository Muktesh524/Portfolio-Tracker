/**
 * AnalysisScreen.tsx — Bloomberg Terminal Risk & Analysis (F3)
 * ─────────────────────────────────────────────────────────────
 * Layout (top → bottom):
 *   [1] Risk gauge + Profile assessment     (existing, now reactive)
 *   [2] Sector breakdown table + bar chart  (existing, now reactive)
 *   [3] Correlation matrix heatmap          (NEW — simulated)
 *   [4] What-If allocation simulator        (NEW — interactive sliders)
 *   [5] Historical drawdown chart           (NEW — simulated)
 *
 * All data is now reactive via the global store.
 * Simulated sections are clearly labelled with a "SIM" badge.
 */

import { useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  AreaChart, Area, ReferenceLine,
} from "recharts";
import { CheckCircle, AlertTriangle, Info } from "lucide-react";
import {
  TC, GRID_BG, computeHoldings, totalValue,
  SECTOR_COLORS, fmtINR,
  SectionLabel, AlertPill, PanelHeader,
} from "./TerminalShared";
import { useHoldings } from "../store";

// ─── Risk zone configuration ──────────────────────────────────────────────────

const RISK_ZONES = [
  { label: "CONSERVATIVE", range: "0–40%",   start: 0,   end: 72,  color: TC.green,  desc: "Low-risk, capital-preservation focus" },
  { label: "MODERATE",     range: "40–70%",  start: 72,  end: 126, color: "#88FF44",  desc: "Balanced growth and risk" },
  { label: "MODERATE+",    range: "70–85%",  start: 126, end: 153, color: TC.amber,   desc: "Growth-oriented, higher volatility" },
  { label: "AGGRESSIVE",   range: "85–100%", start: 153, end: 180, color: TC.red,     desc: "Maximum equity, high risk" },
];

// ─── SVG gauge helpers ────────────────────────────────────────────────────────

function polarToXY(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, r: number, a1: number, a2: number) {
  const s = polarToXY(cx, cy, r, a1 - 90);
  const e = polarToXY(cx, cy, r, a2 - 90);
  const large = a2 - a1 > 180 ? 1 : 0;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
}

// ─── SIM badge ────────────────────────────────────────────────────────────────

function SimBadge() {
  return (
    <span style={{
      color: TC.amber, fontSize: '8px', letterSpacing: '0.12em',
      background: TC.amber + '0E', border: `1px solid ${TC.amber}22`,
      padding: '1px 5px', borderRadius: '1px', marginLeft: '8px',
      verticalAlign: 'middle',
    }}>
      SIM
    </span>
  );
}

// ─── Correlation matrix ───────────────────────────────────────────────────────

function seededRNG(seed: number) {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; };
}

function generateCorrelationMatrix(sectors: string[]): number[][] {
  const n   = sectors.length;
  const rng = seededRNG(42);
  const mat: number[][] = [];
  for (let i = 0; i < n; i++) {
    mat[i] = [];
    for (let j = 0; j < n; j++) {
      if (i === j) { mat[i][j] = 1.0; continue; }
      if (j < i) { mat[i][j] = mat[j][i]; continue; }
      // Generate correlation between -0.3 and 0.95 — most equity sectors are positively correlated
      mat[i][j] = Math.round(((rng() * 0.8 + 0.15) * (rng() > 0.15 ? 1 : -1)) * 100) / 100;
      // Ensure it's in [-1, 1]
      mat[i][j] = Math.max(-1, Math.min(1, mat[i][j]));
    }
  }
  return mat;
}

function corrColor(v: number): string {
  if (v >= 0.7) return TC.green;
  if (v >= 0.3) return '#88FF44';
  if (v >= 0)   return TC.text4;
  if (v >= -0.3) return TC.amber;
  return TC.red;
}

function corrBg(v: number): string {
  const abs = Math.abs(v);
  const alpha = Math.round(abs * 30).toString(16).padStart(2, '0');
  if (v >= 0) return TC.green + alpha;
  return TC.red + alpha;
}

function CorrelationPanel({ sectors }: { sectors: string[] }) {
  const matrix = useMemo(() => generateCorrelationMatrix(sectors), [sectors.join(",")]);
  const labels = sectors.map(s => s.length > 8 ? s.slice(0, 7) + "…" : s);

  return (
    <div style={{ background: TC.bg0, padding: '14px' }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <SectionLabel>SECTOR CORRELATION MATRIX</SectionLabel>
        <SimBadge />
      </div>

      <div style={{ overflowX: 'auto', marginTop: '10px' }}>
        <table style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ padding: '3px 6px', fontSize: '8px', color: TC.text5, fontFamily: TC.font }} />
              {labels.map((l, i) => (
                <th key={i} style={{
                  padding: '3px 4px', fontSize: '7px', color: TC.text4, fontFamily: TC.font,
                  letterSpacing: '0.06em', textAlign: 'center', whiteSpace: 'nowrap',
                  writingMode: 'vertical-rl', transform: 'rotate(180deg)',
                  height: '60px',
                }}>
                  {l}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.map((row, i) => (
              <tr key={i}>
                <td style={{
                  padding: '2px 6px', fontSize: '8px', color: TC.text3, fontFamily: TC.font,
                  whiteSpace: 'nowrap', textAlign: 'right',
                }}>
                  {labels[i]}
                </td>
                {row.map((v, j) => (
                  <td key={j} style={{
                    padding: '0', textAlign: 'center', width: '28px', height: '22px',
                    background: corrBg(v), border: `1px solid ${TC.bg2}`,
                  }}>
                    <span style={{
                      color: i === j ? TC.text5 : corrColor(v),
                      fontSize: '8px', fontFamily: TC.font,
                    }}>
                      {i === j ? '1.0' : v.toFixed(2)}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
        {[
          { label: "HIGH +VE (>0.7)", color: TC.green },
          { label: "MOD +VE (0.3–0.7)", color: '#88FF44' },
          { label: "LOW (±0.3)", color: TC.text4 },
          { label: "NEGATIVE (<-0.3)", color: TC.red },
        ].map(l => (
          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div style={{ width: 8, height: 8, background: l.color, borderRadius: '1px', opacity: 0.6 }} />
            <span style={{ color: TC.text5, fontSize: '8px' }}>{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── What-If simulator ────────────────────────────────────────────────────────

interface WhatIfState {
  [sector: string]: number;  // allocation % (0–100)
}

function WhatIfPanel({ sectorData }: {
  sectorData: { name: string; pct: number; value: number }[];
}) {
  const initial: WhatIfState = {};
  sectorData.forEach(s => { initial[s.name] = Math.round(s.pct * 10) / 10; });

  const [allocs, setAllocs] = useState<WhatIfState>(initial);
  const totalAlloc = Object.values(allocs).reduce((s, v) => s + v, 0);

  // Simulated risk score: weighted sum of sector "risk factors"
  const RISK_FACTOR: Record<string, number> = {
    'Small Cap': 0.9, 'Mid Cap': 0.7, 'Energy': 0.8, 'IT': 0.65, 'Banking': 0.6,
    'Flexi Cap': 0.5, 'Large Cap': 0.35, 'Index': 0.3, 'Contra': 0.75, 'ELSS': 0.5,
  };

  const riskScore = Object.entries(allocs).reduce((s, [name, pct]) => {
    return s + (pct / 100) * (RISK_FACTOR[name] ?? 0.5);
  }, 0);

  const expectedReturn = Object.entries(allocs).reduce((s, [name, pct]) => {
    const rf = RISK_FACTOR[name] ?? 0.5;
    return s + (pct / 100) * (rf * 18 + 4);  // rough CAPM-like: higher risk = higher return
  }, 0);

  const riskLabel = riskScore > 0.7 ? "AGGRESSIVE" : riskScore > 0.55 ? "MOD+" : riskScore > 0.35 ? "MODERATE" : "CONSERV";
  const riskColor = riskScore > 0.7 ? TC.red : riskScore > 0.55 ? TC.amber : riskScore > 0.35 ? '#88FF44' : TC.green;

  return (
    <div style={{ background: TC.bg0, padding: '14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <SectionLabel>WHAT-IF ALLOCATION SIMULATOR</SectionLabel>
          <SimBadge />
        </div>
        <button
          onClick={() => setAllocs(initial)}
          style={{
            background: 'none', border: `1px solid ${TC.border}`, color: TC.text4,
            fontSize: '8px', padding: '2px 8px', borderRadius: '1px', cursor: 'pointer',
            fontFamily: TC.font, letterSpacing: '0.08em',
          }}
        >
          RESET
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px', gap: '20px', marginTop: '10px' }}>
        {/* Sliders */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {sectorData.map(s => (
            <div key={s.name} style={{ display: 'grid', gridTemplateColumns: '80px 1fr 50px', gap: '8px', alignItems: 'center' }}>
              <span style={{ color: TC.text3, fontSize: '9px', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {s.name}
              </span>
              <input
                type="range"
                min={0} max={50} step={0.5}
                value={allocs[s.name] || 0}
                onChange={e => setAllocs(a => ({ ...a, [s.name]: parseFloat(e.target.value) }))}
                style={{
                  width: '100%', height: '4px',
                  accentColor: TC.green,
                  cursor: 'pointer',
                }}
              />
              <span style={{
                color: (allocs[s.name] || 0) > 25 ? TC.amber : TC.text,
                fontSize: '10px', fontFamily: TC.font, textAlign: 'right',
              }}>
                {(allocs[s.name] || 0).toFixed(1)}%
              </span>
            </div>
          ))}

          {/* Total allocation bar */}
          <div style={{
            marginTop: '6px', padding: '5px 8px', borderTop: `1px solid ${TC.border}`,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span style={{ color: TC.text4, fontSize: '9px', letterSpacing: '0.1em' }}>TOTAL ALLOCATION</span>
            <span style={{
              color: Math.abs(totalAlloc - 100) < 0.5 ? TC.green : TC.amber,
              fontSize: '11px', fontFamily: TC.font,
            }}>
              {totalAlloc.toFixed(1)}%
              {Math.abs(totalAlloc - 100) >= 0.5 && (
                <span style={{ color: TC.amber, fontSize: '9px', marginLeft: '4px' }}>
                  ({totalAlloc > 100 ? "OVER" : "UNDER"})
                </span>
              )}
            </span>
          </div>
        </div>

        {/* Projected metrics */}
        <div style={{
          display: 'flex', flexDirection: 'column', gap: '12px',
          padding: '10px 14px', background: TC.bg1, border: `1px solid ${TC.border}`, borderRadius: '1px',
        }}>
          <div>
            <SectionLabel>PROJECTED RISK</SectionLabel>
            <div style={{ color: riskColor, fontSize: '18px', letterSpacing: '-0.01em', marginTop: '4px' }}>
              {riskLabel}
            </div>
            <div style={{ color: TC.text4, fontSize: '9px', marginTop: '2px' }}>
              Score: {(riskScore * 100).toFixed(0)}/100
            </div>
          </div>
          <div>
            <SectionLabel>EST. ANNUAL RETURN</SectionLabel>
            <div style={{ color: TC.green, fontSize: '18px', letterSpacing: '-0.01em', marginTop: '4px' }}>
              {expectedReturn.toFixed(1)}%
            </div>
            <div style={{ color: TC.text4, fontSize: '9px', marginTop: '2px' }}>
              Simulated CAGR estimate
            </div>
          </div>
          <div>
            <SectionLabel>SHARPE PROXY</SectionLabel>
            <div style={{
              color: (expectedReturn / (riskScore * 20 + 1)) > 0.8 ? TC.green : TC.amber,
              fontSize: '18px', letterSpacing: '-0.01em', marginTop: '4px',
            }}>
              {(expectedReturn / (riskScore * 20 + 1)).toFixed(2)}
            </div>
            <div style={{ color: TC.text4, fontSize: '9px', marginTop: '2px' }}>
              Return / Risk ratio
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Drawdown chart ───────────────────────────────────────────────────────────

function DrawdownPanel({ totalVal, totalGainPct }: { totalVal: number; totalGainPct: number }) {
  const data = useMemo(() => {
    const days = 90;
    const costBasis = totalVal / (1 + totalGainPct / 100);
    const totalGain = totalVal - costBasis;

    let rngState = Math.round(totalVal) ^ 7919;
    const rng = () => { rngState = (rngState * 1664525 + 1013904223) & 0xffffffff; return (rngState >>> 0) / 0xffffffff; };

    const values: number[] = [];
    for (let i = 0; i <= days; i++) {
      const t = i / days;
      const trend = costBasis + totalGain * Math.pow(t, 0.85);
      const noise = i < days ? (rng() - 0.49) * (totalVal * 0.006) : 0;
      values.push(i === days ? totalVal : trend + noise);
    }

    // Compute drawdown from running peak
    let peak = values[0];
    const now = new Date();
    return values.map((v, i) => {
      if (v > peak) peak = v;
      const dd = ((v - peak) / peak) * 100;
      const d = new Date(now);
      d.setDate(now.getDate() - (days - i));
      return {
        label: i % 30 === 0 || i === days
          ? d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })
          : "",
        drawdown: Math.round(dd * 100) / 100,
      };
    });
  }, [totalVal, totalGainPct]);

  const maxDD = Math.min(...data.map(d => d.drawdown));

  return (
    <div style={{ background: TC.bg0, padding: '14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <SectionLabel>HISTORICAL DRAWDOWN — 90 DAYS</SectionLabel>
          <SimBadge />
        </div>
        <div style={{ display: 'flex', gap: '16px' }}>
          <div>
            <span style={{ color: TC.text4, fontSize: '8px', letterSpacing: '0.1em' }}>MAX DRAWDOWN </span>
            <span style={{ color: TC.red, fontSize: '11px' }}>{maxDD.toFixed(2)}%</span>
          </div>
          <div>
            <span style={{ color: TC.text4, fontSize: '8px', letterSpacing: '0.1em' }}>CURRENT DD </span>
            <span style={{
              color: data[data.length - 1].drawdown < -0.5 ? TC.red : TC.green,
              fontSize: '11px',
            }}>
              {data[data.length - 1].drawdown.toFixed(2)}%
            </span>
          </div>
        </div>
      </div>

      <div style={{ marginTop: '8px' }}>
        <ResponsiveContainer width="100%" height={100}>
          <AreaChart data={data} margin={{ top: 2, right: 4, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="ddGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={TC.red} stopOpacity={0.02} />
                <stop offset="100%" stopColor={TC.red} stopOpacity={0.18} />
              </linearGradient>
            </defs>
            <ReferenceLine y={0} stroke={TC.border} strokeWidth={1} />
            <XAxis
              dataKey="label"
              tick={{ fill: TC.text4, fontSize: 8, fontFamily: 'IBM Plex Mono' }}
              axisLine={false} tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fill: TC.text4, fontSize: 8, fontFamily: 'IBM Plex Mono' }}
              tickFormatter={v => `${v.toFixed(0)}%`}
              axisLine={false} tickLine={false} width={32}
            />
            <Tooltip
              contentStyle={{
                background: TC.bg2, border: `1px solid ${TC.border}`,
                borderRadius: '1px', fontFamily: TC.font, fontSize: '10px',
              }}
              formatter={(v: number) => [`${v.toFixed(2)}%`, 'Drawdown']}
            />
            <Area
              type="monotone" dataKey="drawdown"
              stroke={TC.red} strokeWidth={1}
              fill="url(#ddGrad)" dot={false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AnalysisScreen() {
  const rawHoldings = useHoldings();
  const computed    = computeHoldings(rawHoldings);
  const totVal      = totalValue(computed);
  const totInv      = computed.reduce((s, h) => s + h.invested, 0);
  const totGain     = totVal - totInv;
  const totGainPct  = totInv > 0 ? (totGain / totInv) * 100 : 0;

  const EQUITY_PCT = 100;

  // Sector aggregation
  const sectorMap: Record<string, number> = {};
  computed.forEach(h => { sectorMap[h.sector] = (sectorMap[h.sector] || 0) + h.currentValue; });
  const sectorData = Object.entries(sectorMap)
    .map(([name, val]) => ({ name, value: val, pct: (val / (totVal || 1)) * 100 }))
    .sort((a, b) => b.pct - a.pct);

  const overexposed = sectorData.filter(s => s.pct > 25);
  const sectors     = sectorData.map(s => s.name);

  const active = RISK_ZONES.find(z => EQUITY_PCT / 100 * 180 > z.start && EQUITY_PCT / 100 * 180 <= z.end) || RISK_ZONES[3];
  const needleDeg = (EQUITY_PCT / 100) * 180 - 90;
  const needleEnd = polarToXY(130, 120, 78, needleDeg);

  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ fontFamily: TC.font, background: TC.bg0, ...GRID_BG }}>
      <PanelHeader title="RISK & SECTOR ANALYSIS — EQUITY EXPOSURE DEEP DIVE" />

      {/* ── Row 1: Gauge + Assessment ──────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', background: TC.border, flex: 'none' }}>

        {/* Gauge panel */}
        <div style={{ background: TC.bg0, padding: '16px' }}>
          <SectionLabel>EQUITY EXPOSURE GAUGE</SectionLabel>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '24px', marginTop: '14px' }}>
            <svg width="260" height="150" viewBox="0 0 260 150">
              <path d={arcPath(130, 120, 90, 0, 180)} fill="none" stroke={TC.border} strokeWidth="20" />
              {RISK_ZONES.map(z => (
                <path key={z.label} d={arcPath(130, 120, 90, z.start, z.end)} fill="none" stroke={z.color} strokeWidth="20" opacity="0.75" />
              ))}
              <path d={arcPath(130, 120, 90, 0, 180)} fill="none" stroke={TC.bg0} strokeWidth="6" />
              {[0, 45, 90, 135, 180].map(deg => {
                const inner = polarToXY(130, 120, 78, deg - 90);
                const outer2 = polarToXY(130, 120, 95, deg - 90);
                return <line key={deg} x1={inner.x} y1={inner.y} x2={outer2.x} y2={outer2.y} stroke={TC.border} strokeWidth="1.5" />;
              })}
              <line x1="130" y1="120" x2={needleEnd.x} y2={needleEnd.y} stroke={TC.text} strokeWidth="2.5" strokeLinecap="round" />
              <circle cx="130" cy="120" r="6" fill={active.color} />
              <circle cx="130" cy="120" r="3" fill={TC.bg0} />
              <text x="28" y="130" fill={TC.text4} fontSize="9" fontFamily="IBM Plex Mono">0%</text>
              <text x="117" y="26" fill={TC.text4} fontSize="9" fontFamily="IBM Plex Mono">50%</text>
              <text x="218" y="130" fill={TC.text4} fontSize="9" fontFamily="IBM Plex Mono">100%</text>
            </svg>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingTop: '4px', minWidth: '140px' }}>
              <div>
                <SectionLabel>EQUITY EXPOSURE</SectionLabel>
                <div style={{ color: active.color, fontSize: '40px', letterSpacing: '-0.02em', lineHeight: 1, marginTop: '4px' }}>{EQUITY_PCT}%</div>
              </div>
              <div>
                <SectionLabel>INFERRED PROFILE</SectionLabel>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  marginTop: '5px', padding: '4px 10px', borderRadius: '1px',
                  background: active.color + '18', border: `1px solid ${active.color}55`,
                  color: active.color, fontSize: '12px', letterSpacing: '0.06em',
                }}>
                  {active.label}
                </div>
                <div style={{ color: TC.text3, fontSize: '10px', marginTop: '6px', lineHeight: 1.6, maxWidth: '160px' }}>
                  {active.desc}. 100% equity — no debt or liquid buffer.
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '10px' }}>
            {RISK_ZONES.map(z => (
              <div key={z.label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <div style={{ width: 8, height: 8, background: z.color, borderRadius: '1px', opacity: 0.85 }} />
                <span style={{ color: TC.text4, fontSize: '9px' }}>{z.label} {z.range}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Assessment panel */}
        <div style={{ background: TC.bg0, padding: '16px' }}>
          <SectionLabel>PROFILE ASSESSMENT</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0', marginTop: '12px' }}>
            {[
              { ok: false, label: "EQUITY ALLOCATION",   val: "100%  —  No debt buffer",           detail: TC.amber },
              { ok: true,  label: "DIVERSIFICATION",     val: `${sectorData.length} sectors covered`,     detail: TC.green },
              { ok: false, label: "DEBT ALLOCATION",     val: "0%  —  Adds volatility risk",       detail: TC.amber },
              { ok: true,  label: "INDEX EXPOSURE",
                val: `${((sectorData.find(s => s.name === 'Index')?.pct || 0)).toFixed(1)}%  —  Passive core`,
                detail: TC.green },
              { ok: (sectorData.find(s => s.name === 'Small Cap')?.pct || 0) < 20,
                label: "SMALL CAP WEIGHT",
                val: `${(sectorData.find(s => s.name === 'Small Cap')?.pct || 0).toFixed(1)}%`,
                detail: (sectorData.find(s => s.name === 'Small Cap')?.pct || 0) >= 20 ? TC.amber : TC.green },
              { ok: true, label: "LARGE/FLEX EXPOSURE",
                val: `${((sectorData.find(s => s.name === 'Large Cap')?.pct || 0) + (sectorData.find(s => s.name === 'Flexi Cap')?.pct || 0)).toFixed(1)}%  —  Well anchored`,
                detail: TC.green },
            ].map(row => (
              <div
                key={row.label}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '7px 0', borderBottom: `1px solid ${TC.border2}`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {row.ok
                    ? <CheckCircle style={{ width: 12, height: 12, color: TC.green, flexShrink: 0 }} />
                    : <AlertTriangle style={{ width: 12, height: 12, color: TC.amber, flexShrink: 0 }} />}
                  <span style={{ color: TC.text3, fontSize: '10px', letterSpacing: '0.08em' }}>{row.label}</span>
                </div>
                <span style={{ color: row.detail, fontSize: '10px' }}>{row.val}</span>
              </div>
            ))}
          </div>

          <div style={{
            marginTop: '14px', padding: '10px 12px',
            background: '#001A0A', border: `1px solid ${TC.green}22`, borderRadius: '1px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '5px' }}>
              <Info style={{ width: 12, height: 12, color: TC.green }} />
              <span style={{ color: TC.green, fontSize: '9px', letterSpacing: '0.12em' }}>ALIGNMENT NOTE</span>
            </div>
            <p style={{ color: TC.text3, fontSize: '10px', lineHeight: 1.7, margin: 0 }}>
              Allocation aligns with a <strong style={{ color: active.color }}>{active.label}</strong> profile.
              Consider adding 10–15% debt/liquid funds (e.g. SBI Magnum Ultra Short or overnight fund)
              to improve drawdown resilience and maintain a rebalancing pool.
            </p>
          </div>
        </div>
      </div>

      {/* ── Row 2: Sector table + chart ────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', background: TC.border, marginTop: '1px' }}>
        <div style={{ background: TC.bg0 }}>
          <PanelHeader title="SECTOR BREAKDOWN TABLE" />
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: TC.bg1, borderBottom: `1px solid ${TC.border}` }}>
                {["SECTOR", "VALUE ₹", "WEIGHT %", "STATUS", "BAR"].map((h, i) => (
                  <th key={h} style={{
                    padding: '5px 10px', color: TC.text4, fontSize: '9px', letterSpacing: '0.12em',
                    fontFamily: TC.font, textAlign: i === 0 ? 'left' : 'right', whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sectorData.map((s, i) => {
                const over = s.pct > 25;
                return (
                  <tr key={s.name} style={{ background: i % 2 === 0 ? TC.bg0 : TC.bg1, borderBottom: `1px solid ${TC.border2}` }}>
                    <td style={{ padding: '5px 10px', color: TC.text, fontSize: '11px', fontFamily: TC.font }}>{s.name}</td>
                    <td style={{ padding: '5px 10px', color: TC.text3, fontSize: '11px', fontFamily: TC.font, textAlign: 'right' }}>{fmtINR(s.value)}</td>
                    <td style={{ padding: '5px 10px', color: over ? TC.amber : TC.text, fontSize: '11px', fontFamily: TC.font, textAlign: 'right' }}>{s.pct.toFixed(1)}%</td>
                    <td style={{ padding: '5px 10px', textAlign: 'right' }}>
                      {over
                        ? <span style={{ color: TC.amber, fontSize: '9px', background: '#150B00', border: `1px solid ${TC.amber}44`, padding: '1px 5px', borderRadius: '1px', fontFamily: TC.font }}>⚠ OVER</span>
                        : <span style={{ color: TC.green, fontSize: '9px', background: '#001A0A', border: `1px solid ${TC.green}44`, padding: '1px 5px', borderRadius: '1px', fontFamily: TC.font }}>✓ OK</span>}
                    </td>
                    <td style={{ padding: '5px 10px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                        <div style={{ width: `${Math.min(s.pct * 2, 60)}px`, height: '4px', background: over ? TC.amber : (SECTOR_COLORS[s.name] || TC.green), borderRadius: '1px', opacity: 0.8 }} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div style={{ background: TC.bg0, display: 'flex', flexDirection: 'column' }}>
          <PanelHeader title="SECTOR WEIGHT CHART" />
          <div style={{ padding: '10px 14px' }}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={sectorData} layout="vertical" margin={{ left: 0, right: 50, top: 0, bottom: 0 }}>
                <XAxis type="number" tick={{ fill: TC.text4, fontSize: 8, fontFamily: 'IBM Plex Mono' }} tickFormatter={v => `${v.toFixed(0)}%`} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={68} tick={{ fill: TC.text3, fontSize: 8, fontFamily: 'IBM Plex Mono' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: TC.bg2, border: `1px solid ${TC.border}`, borderRadius: '1px', fontFamily: TC.font, fontSize: '10px' }}
                  formatter={(v: number) => [`${v.toFixed(1)}%`, 'Weight']}
                  cursor={{ fill: TC.bg3 }}
                />
                <Bar dataKey="pct" radius={[0, 1, 1, 0]} maxBarSize={12}>
                  {sectorData.map(e => (
                    <Cell key={`chart-${e.name}`} fill={e.pct > 25 ? TC.amber : (SECTOR_COLORS[e.name] || TC.green)} opacity={0.85} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {overexposed.length > 0 && (
            <div style={{ padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <SectionLabel>OVEREXPOSURE ALERTS</SectionLabel>
              {overexposed.map(s => (
                <div key={s.name} style={{ marginTop: '6px', padding: '10px 12px', background: '#0D0700', border: `1px solid ${TC.amber}33`, borderRadius: '1px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                    <AlertPill sector={s.name} pct={s.pct} />
                    <span style={{ color: TC.text4, fontSize: '9px', fontFamily: TC.font }}>THRESHOLD: 25%</span>
                  </div>
                  <p style={{ color: TC.text3, fontSize: '10px', margin: 0, lineHeight: 1.6 }}>
                    Exceeds recommended limit by {(s.pct - 25).toFixed(1)}%. Trim or redirect new flows to underweight sectors.
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Row 3: Correlation + What-If ───────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', background: TC.border, marginTop: '1px' }}>
        <CorrelationPanel sectors={sectors} />
        <WhatIfPanel sectorData={sectorData} />
      </div>

      {/* ── Row 4: Drawdown chart (full width) ─────────────────────── */}
      <div style={{ marginTop: '1px', borderTop: `1px solid ${TC.border}` }}>
        <DrawdownPanel totalVal={totVal} totalGainPct={totGainPct} />
      </div>
    </div>
  );
}
