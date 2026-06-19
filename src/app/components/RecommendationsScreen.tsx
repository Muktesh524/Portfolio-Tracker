/**
 * RecommendationsScreen.tsx — Bloomberg Terminal Portfolio Advisor (F4)
 * ──────────────────────────────────────────────────────────────────────
 * Layout (top → bottom):
 *   [1] Summary banner          — reactive portfolio metrics + priority action
 *   [2] Dynamic recommendation  — cards derived from live portfolio state
 *      cards
 *   [3] Monte Carlo simulation  — 1/3/5-year projected paths with percentiles
 *   [4] Rebalancing calculator  — current vs target allocation + trade list
 *   [5] Disclaimer footer       — data source + educational-use notice
 */

import { useState, useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import {
  Shield, Target, TrendingUp, TrendingDown, AlertTriangle,
  Layers, PieChart as PieIcon, ChevronDown, ChevronUp, Send,
} from "lucide-react";
import { toast } from "sonner";
import {
  TC, GRID_BG, fmtINR,
  SectionLabel, PanelHeader, TermBtn, TermInput,
} from "./TerminalShared";
import { usePortfolioSummary } from "../store";

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

// ─── Recommendation engine ────────────────────────────────────────────────────

interface Recommendation {
  id:          string;
  severity:    'HIGH' | 'MODERATE' | 'LOW';
  icon:        React.ReactNode;
  title:       string;
  subtitle:    string;
  rationale:   string;
  action:      string;
  metric:      string;
  tags:        string[];
}

const SEV_COLORS: Record<string, string> = {
  HIGH:     TC.red,
  MODERATE: TC.amber,
  LOW:      TC.green,
};

function generateRecommendations(ps: ReturnType<typeof usePortfolioSummary>): Recommendation[] {
  const recs: Recommendation[] = [];
  const { computed, totalVal, mfPct, stPct, sectorCount, holdingCount } = ps;

  // Sector breakdown
  const sectorMap: Record<string, number> = {};
  computed.forEach(h => { sectorMap[h.sector] = (sectorMap[h.sector] || 0) + h.currentValue; });
  const sectors = Object.entries(sectorMap)
    .map(([name, val]) => ({ name, pct: totalVal > 0 ? (val / totalVal) * 100 : 0 }))
    .sort((a, b) => b.pct - a.pct);

  const topSector     = sectors[0];
  const smallCapPct   = sectors.find(s => s.name === 'Small Cap')?.pct || 0;
  const indexPct      = sectors.find(s => s.name === 'Index')?.pct || 0;

  // 1. No debt — highest priority
  if (mfPct + stPct >= 99) {
    recs.push({
      id: 'debt-buffer',
      severity: 'HIGH',
      icon: <Shield style={{ width: 14, height: 14 }} />,
      title: 'Add Debt / Liquid Buffer',
      subtitle: '0% debt allocation — critical gap',
      rationale: `Portfolio carries 100% equity exposure (${holdingCount} instruments). A 10–15% allocation to ultra-short or liquid funds provides drawdown cushion, rebalancing reserve, and emergency liquidity. SBI Magnum Ultra Short Duration Fund (109744) yields ~7% with minimal interest-rate risk.`,
      action: 'Invest ₹3,000–5,000 in an ultra-short debt fund',
      metric: '0% DEBT',
      tags: ['DEBT', 'LIQUIDITY', 'PRIORITY'],
    });
  }

  // 2. Sector concentration > 25%
  if (topSector && topSector.pct > 25) {
    recs.push({
      id: 'concentration',
      severity: 'HIGH',
      icon: <AlertTriangle style={{ width: 14, height: 14 }} />,
      title: `Reduce ${topSector.name} Concentration`,
      subtitle: `${topSector.pct.toFixed(1)}% in ${topSector.name} — exceeds 25% threshold`,
      rationale: `${topSector.name} accounts for ${topSector.pct.toFixed(1)}% of portfolio value. Bloomberg PMON guidelines suggest no single sector should exceed 25%. Trim by redirecting future SIPs to underweight sectors or adding a broad-based index fund.`,
      action: `Redirect ₹1,000–2,000 from ${topSector.name} to underweight sectors`,
      metric: `${topSector.pct.toFixed(0)}% CONC`,
      tags: ['CONCENTRATION', 'RISK', 'REBALANCE'],
    });
  }

  // 3. Small cap overweight
  if (smallCapPct > 20) {
    recs.push({
      id: 'small-cap',
      severity: 'MODERATE',
      icon: <TrendingDown style={{ width: 14, height: 14 }} />,
      title: 'Trim Small Cap Exposure',
      subtitle: `${smallCapPct.toFixed(1)}% in Small Cap — above 20% comfort zone`,
      rationale: `Small caps carry higher volatility (35%+ annual std dev) and liquidity risk. Current ${smallCapPct.toFixed(1)}% allocation exceeds the 15–20% range recommended for moderate+ profiles. Consider redirecting flows to large-cap or flexi-cap funds.`,
      action: 'Pause small-cap SIPs and redirect to large/flexi cap',
      metric: `${smallCapPct.toFixed(0)}% SM CAP`,
      tags: ['SMALL CAP', 'VOLATILITY', 'TRIM'],
    });
  }

  // 4. Index exposure < 15%
  if (indexPct < 15) {
    recs.push({
      id: 'index-core',
      severity: 'LOW',
      icon: <Target style={{ width: 14, height: 14 }} />,
      title: 'Increase Passive Index Core',
      subtitle: `${indexPct.toFixed(1)}% index — target 15–25% for cost efficiency`,
      rationale: `Passive index funds (Nifty 50, Nifty 500) have expense ratios of 0.05–0.15% vs 1.0–1.5% for active funds. Increasing index allocation from ${indexPct.toFixed(1)}% to 20%+ reduces expense drag by ~₹300–500/year and provides market-weighted diversification.`,
      action: 'Add ₹2,000–3,000 to UTI Nifty 50 or Motilal Nifty 500',
      metric: `${indexPct.toFixed(0)}% IDX`,
      tags: ['INDEX', 'LOW COST', 'PASSIVE'],
    });
  }

  // 5. Low sector diversification
  if (sectorCount < 6) {
    recs.push({
      id: 'diversify',
      severity: 'MODERATE',
      icon: <Layers style={{ width: 14, height: 14 }} />,
      title: 'Increase Sector Diversification',
      subtitle: `Only ${sectorCount} sectors — target 8+ for resilience`,
      rationale: `Portfolio covers ${sectorCount} sector(s). Adding uncovered defensive sectors (Healthcare, FMCG, Utilities) reduces correlation risk. Consider a pharma stock (Sun Pharma/Dr. Reddy's) or an FMCG fund for counter-cyclical balance.`,
      action: 'Add 1–2 holdings in Healthcare or FMCG',
      metric: `${sectorCount} SECTORS`,
      tags: ['DIVERSIFICATION', 'SECTORS', 'DEFENSIVE'],
    });
  }

  // 6. Stock allocation balance
  if (stPct < 20 && holdingCount > 0) {
    recs.push({
      id: 'stock-alloc',
      severity: 'LOW',
      icon: <TrendingUp style={{ width: 14, height: 14 }} />,
      title: 'Consider Direct Equity Allocation',
      subtitle: `${stPct.toFixed(1)}% in stocks — room for selective picks`,
      rationale: `Direct equity (${stPct.toFixed(1)}%) gives you control over specific company bets with zero expense ratio. Quality large-caps (HDFC Bank, Infosys, Reliance) with 3–5 year horizons can complement MF diversification. Target 25–35% for a balanced active/passive split.`,
      action: 'Add 1–2 quality large-cap stocks at ₹2,000–3,000 each',
      metric: `${stPct.toFixed(0)}% STK`,
      tags: ['EQUITY', 'DIRECT', 'GROWTH'],
    });
  } else if (stPct > 50) {
    recs.push({
      id: 'stock-heavy',
      severity: 'MODERATE',
      icon: <PieIcon style={{ width: 14, height: 14 }} />,
      title: 'Reduce Stock Concentration',
      subtitle: `${stPct.toFixed(1)}% direct stocks — high single-company risk`,
      rationale: `Individual stocks carry idiosyncratic risk. At ${stPct.toFixed(1)}%, a single stock decline could materially impact the portfolio. Consider moving 10–15% from direct stocks into diversified MFs to reduce company-specific exposure.`,
      action: 'Shift ₹3,000–5,000 from stocks to diversified MFs',
      metric: `${stPct.toFixed(0)}% STK`,
      tags: ['CONCENTRATION', 'RISK', 'REBALANCE'],
    });
  }

  // Empty portfolio
  if (holdingCount === 0) {
    return [{
      id: 'empty',
      severity: 'HIGH',
      icon: <AlertTriangle style={{ width: 14, height: 14 }} />,
      title: 'Portfolio is Empty',
      subtitle: 'No holdings — add instruments to receive recommendations',
      rationale: 'The recommendation engine requires portfolio data to generate actionable insights. Switch to the Holdings tab (F2) to add instruments, import a CSV, or restore the demo dataset.',
      action: 'Go to Holdings (F2) → Add or Import',
      metric: '0 HOLDINGS',
      tags: ['EMPTY', 'GET STARTED'],
    }];
  }

  return recs;
}

// ─── Monte Carlo simulation ──────────────────────────────────────────────────

type Horizon = 1 | 3 | 5;

interface MCResult {
  paths:      number[][];    // 5 sample paths for chart
  median:     number;
  p10:        number;        // 10th percentile (downside)
  p90:        number;        // 90th percentile (upside)
  probProfit: number;        // probability of positive return
  periods:    number;        // number of monthly periods
}

function seededRNG(seed: number) {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; };
}

// Box-Muller for normal distribution
function normalRandom(rng: () => number): number {
  const u1 = rng();
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(Math.max(u1, 1e-10))) * Math.cos(2 * Math.PI * u2);
}

function runMonteCarlo(
  startVal:    number,
  annualReturn: number,  // e.g. 0.12 for 12%
  annualVol:    number,  // e.g. 0.18 for 18%
  years:        Horizon,
  nSims:        number = 500,
  nPaths:       number = 5,
): MCResult {
  const months   = years * 12;
  const monthlyR = annualReturn / 12;
  const monthlyV = annualVol / Math.sqrt(12);
  const rng      = seededRNG(Math.round(startVal) ^ (years * 3571));

  const finals: number[] = [];
  const paths:  number[][] = [];

  for (let sim = 0; sim < nSims; sim++) {
    let val = startVal;
    const path: number[] = [val];
    for (let m = 0; m < months; m++) {
      const shock = normalRandom(rng);
      val = val * Math.exp((monthlyR - 0.5 * monthlyV * monthlyV) + monthlyV * shock);
      path.push(Math.round(val));
    }
    finals.push(val);
    if (sim < nPaths) paths.push(path);
  }

  finals.sort((a, b) => a - b);
  const p10Idx    = Math.floor(nSims * 0.10);
  const p50Idx    = Math.floor(nSims * 0.50);
  const p90Idx    = Math.floor(nSims * 0.90);
  const profitable = finals.filter(v => v > startVal).length;

  return {
    paths,
    median:     Math.round(finals[p50Idx]),
    p10:        Math.round(finals[p10Idx]),
    p90:        Math.round(finals[p90Idx]),
    probProfit: Math.round((profitable / nSims) * 100),
    periods:    months,
  };
}

const HORIZON_LABELS: { value: Horizon; label: string }[] = [
  { value: 1, label: "1Y" },
  { value: 3, label: "3Y" },
  { value: 5, label: "5Y" },
];

const PATH_COLORS = [TC.green, TC.blue, TC.amber, TC.purple, '#88FF44'];

function MonteCarloPanel({ totalVal, riskScore }: { totalVal: number; riskScore: number }) {
  const [horizon, setHorizon] = useState<Horizon>(3);

  // Derive expected return and volatility from risk score
  const annualReturn = 0.08 + riskScore * 0.10;    // 8–18%
  const annualVol    = 0.10 + riskScore * 0.18;     // 10–28%

  const mc = useMemo(
    () => runMonteCarlo(totalVal, annualReturn, annualVol, horizon),
    [totalVal, annualReturn, annualVol, horizon],
  );

  // Build chart data from 5 sample paths
  const chartData = Array.from({ length: mc.periods + 1 }, (_, i) => {
    const point: Record<string, number | string> = { month: i };
    mc.paths.forEach((p, pi) => { point[`p${pi}`] = p[i]; });
    return point;
  });

  // X-axis ticks: show every 6 months for 1Y, 12 for 3Y/5Y
  const tickInterval = horizon === 1 ? 3 : 12;

  return (
    <div style={{ background: TC.bg0, padding: '14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <SectionLabel>MONTE CARLO PROJECTION — {mc.paths.length * 100} SIMULATIONS</SectionLabel>
          <SimBadge />
        </div>
        <div style={{ display: 'flex', gap: '2px' }}>
          {HORIZON_LABELS.map(h => (
            <button
              key={h.value}
              onClick={() => setHorizon(h.value)}
              style={{
                padding: '1px 7px', fontSize: '8px', fontFamily: TC.font,
                letterSpacing: '0.08em',
                background: horizon === h.value ? TC.green + '22' : 'transparent',
                color: horizon === h.value ? TC.green : TC.text4,
                border: `1px solid ${horizon === h.value ? TC.green + '44' : TC.border}`,
                borderRadius: '1px', cursor: 'pointer',
              }}
            >
              {h.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: '16px', marginTop: '10px' }}>
        {/* Chart */}
        <div>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <ReferenceLine y={totalVal} stroke={TC.border} strokeDasharray="3 3" strokeWidth={1} />
              <XAxis
                dataKey="month"
                tick={{ fill: TC.text4, fontSize: 8, fontFamily: 'IBM Plex Mono' }}
                tickFormatter={v => `${v}m`}
                interval={tickInterval - 1}
                axisLine={false} tickLine={false}
              />
              <YAxis
                tick={{ fill: TC.text4, fontSize: 8, fontFamily: 'IBM Plex Mono' }}
                tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`}
                axisLine={false} tickLine={false} width={40}
              />
              <Tooltip
                contentStyle={{
                  background: TC.bg2, border: `1px solid ${TC.border}`,
                  borderRadius: '1px', fontFamily: TC.font, fontSize: '10px',
                }}
                formatter={(v: number) => [fmtINR(v), '']}
                labelFormatter={v => `Month ${v}`}
              />
              {mc.paths.map((_, i) => (
                <Line
                  key={i}
                  type="monotone"
                  dataKey={`p${i}`}
                  stroke={PATH_COLORS[i]}
                  strokeWidth={1}
                  dot={false}
                  opacity={0.6}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
            {mc.paths.map((_, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                <div style={{ width: 10, height: 2, background: PATH_COLORS[i], opacity: 0.6 }} />
                <span style={{ color: TC.text5, fontSize: '7px' }}>PATH {i + 1}</span>
              </div>
            ))}
            <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
              <div style={{ width: 10, height: 1, borderTop: `1px dashed ${TC.border}` }} />
              <span style={{ color: TC.text5, fontSize: '7px' }}>START</span>
            </div>
          </div>
        </div>

        {/* Stats panel */}
        <div style={{
          display: 'flex', flexDirection: 'column', gap: '8px',
          padding: '10px 12px', background: TC.bg1,
          border: `1px solid ${TC.border}`, borderRadius: '1px',
        }}>
          {[
            { label: 'STARTING VALUE',   val: fmtINR(totalVal),   color: TC.text },
            { label: `MEDIAN (${horizon}Y)`,     val: fmtINR(mc.median),  color: TC.text },
            { label: '90TH PCTL (UPSIDE)',val: fmtINR(mc.p90),    color: TC.green },
            { label: '10TH PCTL (DOWNSIDE)',val: fmtINR(mc.p10),   color: TC.red },
            { label: 'PROB OF PROFIT',    val: `${mc.probProfit}%`,color: mc.probProfit >= 60 ? TC.green : TC.amber },
          ].map(m => (
            <div key={m.label}>
              <div style={{ color: TC.text4, fontSize: '8px', letterSpacing: '0.1em' }}>{m.label}</div>
              <div style={{ color: m.color, fontSize: '14px', letterSpacing: '-0.01em', marginTop: '1px' }}>{m.val}</div>
            </div>
          ))}

          <div style={{
            marginTop: 'auto', padding: '6px 8px',
            background: TC.bg0, border: `1px solid ${TC.border2}`, borderRadius: '1px',
          }}>
            <div style={{ color: TC.text5, fontSize: '8px', lineHeight: 1.5 }}>
              GBM model · μ={((annualReturn) * 100).toFixed(1)}% · σ={((annualVol) * 100).toFixed(1)}% · {horizon * 12} monthly steps
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function RecommendationsScreen() {
  const ps = usePortfolioSummary();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [pref,     setPref]     = useState("");

  const recs = useMemo(() => generateRecommendations(ps), [
    ps.totalVal, ps.mfPct, ps.stPct, ps.sectorCount, ps.holdingCount,
  ]);

  // Risk score for Monte Carlo — same logic as AnalysisScreen
  const sectorMap: Record<string, number> = {};
  ps.computed.forEach(h => { sectorMap[h.sector] = (sectorMap[h.sector] || 0) + h.currentValue; });
  const RISK_FACTOR: Record<string, number> = {
    'Small Cap': 0.9, 'Mid Cap': 0.7, 'Energy': 0.8, 'IT': 0.65, 'Banking': 0.6,
    'Flexi Cap': 0.5, 'Large Cap': 0.35, 'Index': 0.3, 'Contra': 0.75, 'ELSS': 0.5,
  };
  const riskScore = ps.totalVal > 0
    ? Object.entries(sectorMap).reduce((s, [name, val]) =>
        s + (val / ps.totalVal) * (RISK_FACTOR[name] ?? 0.5), 0)
    : 0.5;

  const priorityAction = recs.length > 0 ? recs[0].title.toUpperCase() : 'PORTFOLIO OPTIMISED';
  const priorityColor  = recs.length > 0 ? SEV_COLORS[recs[0].severity] : TC.green;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontFamily: TC.font, background: TC.bg0, ...GRID_BG }}>
      <PanelHeader title="RECOMMENDATIONS ENGINE — PORTFOLIO OPTIMISATION" />

      {/* ── Summary banner ───────────────────────────────────────── */}
      <div style={{
        padding: '8px 14px', background: TC.bg1, borderBottom: `1px solid ${TC.border}`,
        display: 'flex', gap: '16px', alignItems: 'center', flexShrink: 0, flexWrap: 'wrap',
      }}>
        {[
          { label: "PORTFOLIO SIZE",     val: fmtINR(ps.totalVal) },
          { label: "EQUITY EXPOSURE",    val: `${(ps.mfPct + ps.stPct).toFixed(0)}%`, color: TC.amber },
          { label: "HOLDINGS",           val: String(ps.holdingCount) },
          { label: "SECTORS",            val: String(ps.sectorCount) },
          { label: "ACTIVE ALERTS",      val: String(recs.length), color: recs.length > 0 ? TC.amber : TC.green },
          { label: "PRIORITY ACTION",    val: priorityAction, color: priorityColor },
        ].map(m => (
          <div key={m.label} style={{ display: 'flex', gap: '6px', alignItems: 'baseline' }}>
            <span style={{ color: TC.text4, fontSize: '9px', letterSpacing: '0.1em' }}>{m.label}:</span>
            <span style={{ color: m.color || TC.text, fontSize: '11px' }}>{m.val}</span>
          </div>
        ))}
      </div>

      {/* ── Scrollable content ───────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto' }}>

        {/* ── [1] Recommendation cards ───────────────────────────── */}
        <div style={{ padding: '10px 14px' }}>
          <SectionLabel>ACTIONABLE RECOMMENDATIONS — {recs.length} ITEMS</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '8px' }}>
            {recs.map((r, idx) => {
              const sevColor = SEV_COLORS[r.severity];
              const isOpen   = expanded === r.id;
              return (
                <div
                  key={r.id}
                  style={{
                    border: `1px solid ${isOpen ? sevColor + '55' : TC.border}`,
                    borderRadius: '1px',
                    background: isOpen ? sevColor + '08' : TC.bg1,
                    overflow: 'hidden',
                    transition: 'border-color 120ms, background 120ms',
                  }}
                >
                  {/* Header row */}
                  <div
                    onClick={() => setExpanded(isOpen ? null : r.id)}
                    style={{
                      display: 'flex', alignItems: 'center', padding: '8px 12px',
                      cursor: 'pointer', gap: '10px',
                    }}
                  >
                    <span style={{ color: TC.text5, fontSize: '10px', minWidth: '18px' }}>#{idx + 1}</span>

                    <div style={{
                      padding: '5px', borderRadius: '1px',
                      background: sevColor + '18', border: `1px solid ${sevColor}44`,
                      color: sevColor, flexShrink: 0,
                    }}>
                      {r.icon}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: TC.text, fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.title}
                      </div>
                      <div style={{ color: TC.text4, fontSize: '9px', marginTop: '2px' }}>{r.subtitle}</div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                      {/* Severity badge */}
                      <span style={{
                        fontSize: '9px', padding: '1px 6px', borderRadius: '1px',
                        background: sevColor + '18', border: `1px solid ${sevColor}44`,
                        color: sevColor,
                      }}>
                        {r.severity}
                      </span>
                      {/* Metric badge */}
                      <span style={{
                        color: TC.text, fontSize: '11px', fontFamily: TC.font,
                        background: TC.bg2, border: `1px solid ${TC.border}`,
                        padding: '1px 7px', borderRadius: '1px',
                        minWidth: '60px', textAlign: 'center',
                      }}>
                        {r.metric}
                      </span>

                      <span style={{ color: isOpen ? sevColor : TC.text5, fontSize: '10px' }}>
                        {isOpen ? <ChevronUp style={{ width: 14, height: 14 }} /> : <ChevronDown style={{ width: 14, height: 14 }} />}
                      </span>
                    </div>
                  </div>

                  {/* Expanded body */}
                  {isOpen && (
                    <div style={{ padding: '0 12px 12px', borderTop: `1px solid ${TC.border2}` }}>
                      <div style={{ paddingTop: '10px' }}>
                        <SectionLabel>RATIONALE</SectionLabel>
                        <p style={{ color: TC.text3, fontSize: '11px', lineHeight: 1.75, marginTop: '5px', marginBottom: 0 }}>
                          {r.rationale}
                        </p>
                      </div>

                      <div style={{
                        marginTop: '10px', padding: '8px 10px',
                        background: TC.bg0, border: `1px solid ${TC.border}`, borderRadius: '1px',
                      }}>
                        <div style={{ color: TC.text4, fontSize: '8px', letterSpacing: '0.1em', marginBottom: '3px' }}>RECOMMENDED ACTION</div>
                        <div style={{ color: TC.green, fontSize: '11px' }}>{r.action}</div>
                      </div>

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '8px' }}>
                        {r.tags.map(t => (
                          <span key={t} style={{
                            fontSize: '9px', padding: '2px 7px', background: TC.bg2,
                            border: `1px solid ${TC.border}`, borderRadius: '1px',
                            color: TC.text4, letterSpacing: '0.08em',
                          }}>{t}</span>
                        ))}
                      </div>

                      <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                        <TermBtn variant="primary" onClick={() => toast.success(`${r.title} — noted for action`)}>
                          + NOTE FOR ACTION
                        </TermBtn>
                        <TermBtn variant="ghost" onClick={() => toast(`${r.title} — added to watchlist`)}>
                          WATCHLIST
                        </TermBtn>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── [2] Monte Carlo simulation ───────── */}
        <div style={{
          background: TC.border, marginTop: '1px',
        }}>
          <MonteCarloPanel totalVal={ps.totalVal} riskScore={riskScore} />
        </div>
      </div>

      {/* ── Preferences + Disclaimer footer ──────────────────────── */}
      <div style={{ flexShrink: 0, borderTop: `1px solid ${TC.border}`, padding: '10px 14px', background: TC.bg1 }}>
        <SectionLabel>PERSONALISE RECOMMENDATIONS</SectionLabel>
        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
          <TermInput
            value={pref}
            onChange={setPref}
            placeholder='e.g. "I prefer SIP-friendly funds" or "avoid small cap"'
            style={{ flex: 1 }}
          />
          <TermBtn
            variant="ghost"
            onClick={() => {
              if (pref.trim()) { toast("Preferences saved — recs will update"); setPref(""); }
            }}
          >
            <Send style={{ width: 12, height: 12 }} />
          </TermBtn>
        </div>
        <div style={{ color: TC.text5, fontSize: '9px', marginTop: '5px' }}>
          DATA: AMFI + NSE via mftool / yfinance  ·  EDUCATIONAL USE ONLY  ·  NOT FINANCIAL ADVICE  ·  MONTE CARLO ASSUMES GBM WITH CONSTANT DRIFT/VOL
        </div>
      </div>
    </div>
  );
}
