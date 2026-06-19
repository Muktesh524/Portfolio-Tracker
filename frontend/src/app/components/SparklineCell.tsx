/**
 * SparklineCell.tsx
 * ─────────────────
 * A 60×24px inline sparkline for holdings table rows.
 * Uses a seeded pseudo-random walk so each holding gets a
 * deterministic (but visually varied) 15-point price history.
 *
 * Bloomberg rows show trailing price shapes — not axis labels,
 * not tooltips, just the shape. Keep it completely silent.
 */

import { LineChart, Line, ResponsiveContainer } from "recharts";
import { TC } from "./TerminalShared";

/** Seeded linear-congruential PRNG — same seed → same sparkline every render. */
function seededRNG(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

/** Generate 15 plausible daily % changes centred around a long-run drift. */
function makeSpark(seed: number, gainLossPct: number): { v: number }[] {
  const rng   = seededRNG(seed);
  const drift = gainLossPct / 15;          // spread actual gain across 15 days
  let   base  = 100;
  return Array.from({ length: 15 }, () => {
    const noise = (rng() - 0.48) * 2.2;   // ±1.1% daily noise
    base += drift + noise;
    return { v: Math.max(base, 0.1) };
  });
}

interface Props {
  holdingId:   number;   // used as seed so each row has a unique shape
  gainLossPct: number;   // overall P&L% drives the macro trend
}

export function SparklineCell({ holdingId, gainLossPct }: Props) {
  const data  = makeSpark(holdingId * 31337, gainLossPct);
  const color = gainLossPct >= 0 ? TC.green : TC.red;

  return (
    <ResponsiveContainer width={60} height={24}>
      <LineChart data={data} margin={{ top: 2, bottom: 2, left: 0, right: 0 }}>
        <Line
          type="monotone"
          dataKey="v"
          stroke={color}
          strokeWidth={1}
          dot={false}
          isAnimationActive={false}   // no animation — terminal rows should be instant
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
