/**
 * PerformanceTrendChart.tsx
 * ──────────────────────────
 * Portfolio performance area chart covering a selectable window
 * (7 / 30 / 90 days).  Data is simulated from the known totals so
 * the shape is realistic — final value always equals the live total.
 *
 * Bloomberg convention: area charts use a *very* subtle fill
 * (signal colour at ~8% opacity) and a single 1px stroke.
 * No gridlines, no axis borders, minimal tick labels.
 */

import { useState, useMemo } from "react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import { TC, fmtINR, fmtINR2, gainColor, gainSymbol, SectionLabel } from "./TerminalShared";

// ─── Simulation helpers ───────────────────────────────────────────────────────

type Window = 7 | 30 | 90;

interface DataPoint {
  label: string;   // x-axis tick (e.g. "12 Jun")
  value: number;   // portfolio value in ₹
  gain:  number;   // absolute gain from day-0 value
}

/**
 * Builds a seeded daily portfolio-value series ending at `finalValue`.
 * The walk starts at `finalValue / (1 + totalGainPct/100)` (cost basis)
 * and mean-reverts toward `finalValue` over `days`.
 */
function buildSeries(
  finalValue:    number,
  totalGainPct:  number,
  days:          Window,
): DataPoint[] {
  const costBasis = finalValue / (1 + totalGainPct / 100);
  const totalGain = finalValue - costBasis;

  // Simple quadratic path: value[t] = costBasis + totalGain * (t/days)^0.8
  // with small per-day noise to look natural.
  const seed = Math.round(finalValue) ^ (days * 997);
  let   rngState = seed;
  const rng = () => {
    rngState = (rngState * 1664525 + 1013904223) & 0xffffffff;
    return (rngState >>> 0) / 0xffffffff;
  };

  const now = new Date();
  const points: DataPoint[] = [];

  for (let i = 0; i <= days; i++) {
    const t      = i / days;
    const trend  = costBasis + totalGain * Math.pow(t, 0.85);
    const noise  = i < days ? (rng() - 0.49) * (finalValue * 0.004) : 0;
    const value  = i === days ? finalValue : trend + noise;

    const d = new Date(now);
    d.setDate(now.getDate() - (days - i));

    // Tick label: show first, mid, and last for 7-day; every ~10 days for 30/90
    const showTick =
      i === 0 ||
      i === days ||
      (days === 7  && true) ||
      (days === 30 && i % 10 === 0) ||
      (days === 90 && i % 30 === 0);

    const label = showTick
      ? d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })
      : "";

    points.push({
      label,
      value: Math.round(value),
      gain:  Math.round(value - costBasis),
    });
  }

  return points;
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────

function TrendTooltip({
  active, payload, label,
}: {
  active?:  boolean;
  payload?: { value: number; payload: DataPoint }[];
  label?:   string;
}) {
  if (!active || !payload?.length) return null;
  const { value, gain } = payload[0].payload;
  const color = gainColor(gain);
  return (
    <div style={{
      background:   TC.bg2,
      border:       `1px solid ${TC.border}`,
      padding:      '6px 10px',
      fontFamily:   TC.font,
      fontSize:     '10px',
      color:        TC.text,
      borderRadius: '1px',
      minWidth:     '130px',
    }}>
      <div style={{ color: TC.text4, fontSize: '9px', marginBottom: '4px' }}>{label}</div>
      <div style={{ color: TC.text, fontSize: '11px' }}>{fmtINR(value)}</div>
      <div style={{ color, fontSize: '10px', marginTop: '2px' }}>
        {gainSymbol(gain)} {fmtINR2(Math.abs(gain))}
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  finalValue:   number;   // current total portfolio value
  totalGainPct: number;   // overall return % (used to back-calculate cost basis)
}

const WINDOWS: { label: string; value: Window }[] = [
  { label: "7D",  value: 7  },
  { label: "30D", value: 30 },
  { label: "90D", value: 90 },
];

export function PerformanceTrendChart({ finalValue, totalGainPct }: Props) {
  const [window, setWindow] = useState<Window>(30);

  const data        = useMemo(() => buildSeries(finalValue, totalGainPct, window), [finalValue, totalGainPct, window]);
  const startValue  = data[0]?.value ?? finalValue;
  const periodGain  = finalValue - startValue;
  const periodColor = gainColor(periodGain);

  // Determine y-axis domain with 2% padding
  const values = data.map(d => d.value);
  const yMin   = Math.min(...values) * 0.98;
  const yMax   = Math.max(...values) * 1.02;

  // X-axis: show only labelled ticks to avoid crowding
  const tickIndices = data.reduce<number[]>((acc, d, i) => {
    if (d.label) acc.push(i);
    return acc;
  }, []);

  return (
    <div style={{ padding: '10px 14px', background: TC.bg0 }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
        <SectionLabel>PORTFOLIO PERFORMANCE TREND</SectionLabel>

        <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
          {WINDOWS.map(w => (
            <button
              key={w.value}
              onClick={() => setWindow(w.value)}
              style={{
                padding:      '1px 7px',
                fontSize:     '8px',
                fontFamily:   TC.font,
                letterSpacing:'0.08em',
                background:   window === w.value ? TC.green + '22' : 'transparent',
                color:        window === w.value ? TC.green : TC.text4,
                border:       `1px solid ${window === w.value ? TC.green + '44' : TC.border}`,
                borderRadius: '1px',
                cursor:       'pointer',
                transition:   'all 80ms',
              }}
            >
              {w.label}
            </button>
          ))}
        </div>
      </div>

      {/* Period summary */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '6px' }}>
        <div>
          <div style={{ color: TC.text4, fontSize: '8px', letterSpacing: '0.1em' }}>CURRENT</div>
          <div style={{ color: TC.text, fontSize: '13px', letterSpacing: '-0.01em' }}>{fmtINR(finalValue)}</div>
        </div>
        <div>
          <div style={{ color: TC.text4, fontSize: '8px', letterSpacing: '0.1em' }}>
            {window}D CHANGE
          </div>
          <div style={{ color: periodColor, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '3px' }}>
            <span style={{ fontSize: '9px' }}>{gainSymbol(periodGain)}</span>
            {fmtINR2(Math.abs(periodGain))}
          </div>
        </div>
        <div>
          <div style={{ color: TC.text4, fontSize: '8px', letterSpacing: '0.1em' }}>
            {window}D RETURN
          </div>
          <div style={{ color: periodColor, fontSize: '13px' }}>
            {gainSymbol(periodGain)} {Math.abs((periodGain / startValue) * 100).toFixed(2)}%
          </div>
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={90}>
        <AreaChart data={data} margin={{ top: 2, right: 4, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="perfGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={periodColor} stopOpacity={0.14} />
              <stop offset="100%" stopColor={periodColor} stopOpacity={0.01} />
            </linearGradient>
          </defs>

          {/* Break-even line (starting value of this window) */}
          <ReferenceLine
            y={startValue}
            stroke={TC.border}
            strokeDasharray="2 3"
            strokeWidth={1}
          />

          <XAxis
            dataKey="label"
            ticks={tickIndices.map(i => data[i]?.label).filter(Boolean) as string[]}
            tick={{ fill: TC.text4, fontSize: 8, fontFamily: 'IBM Plex Mono' }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[yMin, yMax]}
            tick={{ fill: TC.text4, fontSize: 8, fontFamily: 'IBM Plex Mono' }}
            tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`}
            axisLine={false}
            tickLine={false}
            width={36}
          />
          <Tooltip content={<TrendTooltip />} />
          <Area
            type="monotone"
            dataKey="value"
            stroke={periodColor}
            strokeWidth={1}
            fill="url(#perfGrad)"
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
