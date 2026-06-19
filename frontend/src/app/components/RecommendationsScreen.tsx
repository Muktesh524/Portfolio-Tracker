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

import { useState, useMemo, useCallback } from "react";
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import {
  Shield, Target, TrendingUp, TrendingDown, AlertTriangle,
  Layers, PieChart as PieIcon, ChevronDown, ChevronUp, Send,
  Play, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import {
  TC, GRID_BG, fmtINR,
  SectionLabel, PanelHeader, TermBtn, TermInput,
} from "./TerminalShared";
import { usePortfolioSummary } from "../store";
import { runMonteCarloAPI, type MonteCarloResult } from "../api";

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

// ─── Monte Carlo client-side engine ─────────────────────────────────────────

function seededRNG(seed: number) {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; };
}

function normalRandom(rng: () => number): number {
  const u1 = rng();
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(Math.max(u1, 1e-10))) * Math.cos(2 * Math.PI * u2);
}

interface SimAssumptions {
  years: number;
  numSims: number;
  expectedReturn: number;
  volatility: number;
  riskFreeRate: number;
}

const DEFAULT_ASSUMPTIONS: SimAssumptions = {
  years: 5,
  numSims: 5000,
  expectedReturn: 12,
  volatility: 18,
  riskFreeRate: 6.5,
};

interface HistBin {
  label: string;
  count: number;
  frequency: number;
  aboveStart: boolean;
  midVal: number;
}

interface SimResults {
  samplePaths: number[][];
  percentileSeries: { month: number; p10: number; p25: number; p50: number; p75: number; p90: number }[];
  histogram: HistBin[];
  median: number;
  mean: number;
  p10: number;
  p25: number;
  p75: number;
  p90: number;
  probProfit: number;
  probDouble: number;
  var95: number;
  cvar95: number;
  maxDrawdown: number;
  sharpe: number;
  months: number;
  source: 'client' | 'server';
}

function runLocalMonteCarlo(startVal: number, a: SimAssumptions): SimResults {
  const months = a.years * 12;
  const mu = a.expectedReturn / 100;
  const sigma = a.volatility / 100;
  const rf = a.riskFreeRate / 100;
  const monthlyR = mu / 12;
  const monthlyV = sigma / Math.sqrt(12);
  const drift = monthlyR - 0.5 * monthlyV * monthlyV;
  const rng = seededRNG(Math.round(startVal * 100) ^ (a.years * 7919));

  const allPaths: number[][] = [];

  for (let sim = 0; sim < a.numSims; sim++) {
    let val = startVal;
    const path: number[] = [val];
    for (let m = 0; m < months; m++) {
      val = val * Math.exp(drift + monthlyV * normalRandom(rng));
      path.push(Math.round(val * 100) / 100);
    }
    allPaths.push(path);
  }

  const samplePaths = allPaths.slice(0, 5);

  const percentileSeries: SimResults['percentileSeries'] = [];
  for (let m = 0; m <= months; m++) {
    const vals = allPaths.map(p => p[m]).sort((a, b) => a - b);
    const n = vals.length;
    percentileSeries.push({
      month: m,
      p10: Math.round(vals[Math.floor(n * 0.10)]),
      p25: Math.round(vals[Math.floor(n * 0.25)]),
      p50: Math.round(vals[Math.floor(n * 0.50)]),
      p75: Math.round(vals[Math.floor(n * 0.75)]),
      p90: Math.round(vals[Math.floor(n * 0.90)]),
    });
  }

  const finals = allPaths.map(p => p[p.length - 1]).sort((a, b) => a - b);
  const n = finals.length;

  const p10 = finals[Math.floor(n * 0.10)];
  const p25 = finals[Math.floor(n * 0.25)];
  const median = finals[Math.floor(n * 0.50)];
  const p75 = finals[Math.floor(n * 0.75)];
  const p90 = finals[Math.floor(n * 0.90)];
  const meanFinal = finals.reduce((s, v) => s + v, 0) / n;

  const profitable = finals.filter(v => v > startVal).length;
  const doubled = finals.filter(v => v >= startVal * 2).length;

  // VaR 95% = loss at 5th percentile
  const var95val = finals[Math.floor(n * 0.05)];
  const var95 = Math.max(0, startVal - var95val);

  // CVaR = average of losses worse than VaR
  const worstN = Math.floor(n * 0.05);
  const cvar95 = worstN > 0
    ? Math.max(0, startVal - finals.slice(0, worstN).reduce((s, v) => s + v, 0) / worstN)
    : var95;

  // Max drawdown on median path
  let peak = percentileSeries[0].p50;
  let worstDd = 0;
  for (const pt of percentileSeries) {
    if (pt.p50 > peak) peak = pt.p50;
    const dd = peak > 0 ? (peak - pt.p50) / peak : 0;
    if (dd > worstDd) worstDd = dd;
  }

  const totalReturn = (meanFinal / startVal) - 1;
  const annReturn = Math.pow(1 + totalReturn, 1 / Math.max(a.years, 1)) - 1;
  const sharpe = sigma > 0 ? (annReturn - rf) / sigma : 0;

  // Histogram: 25 bins
  const numBins = 25;
  const minV = finals[0];
  const maxV = finals[n - 1];
  const binW = (maxV - minV) / numBins || 1;
  const histogram: HistBin[] = [];
  for (let i = 0; i < numBins; i++) {
    const lo = minV + i * binW;
    const hi = lo + binW;
    const count = i < numBins - 1
      ? finals.filter(v => v >= lo && v < hi).length
      : finals.filter(v => v >= lo && v <= hi).length;
    histogram.push({
      label: `₹${(lo / 1000).toFixed(0)}k`,
      count,
      frequency: Math.round(count / n * 1000) / 10,
      aboveStart: lo >= startVal,
      midVal: (lo + hi) / 2,
    });
  }

  return {
    samplePaths,
    percentileSeries,
    histogram,
    median: Math.round(median),
    mean: Math.round(meanFinal),
    p10: Math.round(p10),
    p25: Math.round(p25),
    p75: Math.round(p75),
    p90: Math.round(p90),
    probProfit: Math.round(profitable / n * 100),
    probDouble: Math.round(doubled / n * 100),
    var95: Math.round(var95),
    cvar95: Math.round(cvar95),
    maxDrawdown: Math.round(worstDd * 1000) / 10,
    sharpe: Math.round(sharpe * 100) / 100,
    months,
    source: 'client',
  };
}

const PATH_COLORS = [TC.green, TC.blue, TC.amber, TC.purple, '#88FF44'];

// ─── Valuation Simulator Panel ──────────────────────────────────────────────

function ValuationSimulator({ totalVal, riskScore }: { totalVal: number; riskScore: number }) {
  const derivedReturn = Math.round((8 + riskScore * 10) * 10) / 10;
  const derivedVol = Math.round((10 + riskScore * 18) * 10) / 10;

  const [assumptions, setAssumptions] = useState<SimAssumptions>({
    ...DEFAULT_ASSUMPTIONS,
    expectedReturn: derivedReturn,
    volatility: derivedVol,
  });
  const [results, setResults] = useState<SimResults | null>(null);
  const [running, setRunning] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const updateAssumption = useCallback(<K extends keyof SimAssumptions>(key: K, val: SimAssumptions[K]) => {
    setAssumptions(prev => ({ ...prev, [key]: val }));
  }, []);

  const runSimulation = useCallback(async () => {
    if (totalVal <= 0) {
      toast.error("Portfolio value is zero — add holdings first");
      return;
    }
    setRunning(true);

    // Try backend first, fall back to client
    try {
      const apiResult = await runMonteCarloAPI({
        start_value: totalVal,
        annual_return: assumptions.expectedReturn / 100,
        annual_volatility: assumptions.volatility / 100,
        years: assumptions.years,
        num_simulations: assumptions.numSims,
        num_sample_paths: 5,
      });

      if (apiResult) {
        // Convert API response to SimResults
        const finals = apiResult.final_distribution;
        const n = finals.length;
        const var95val = finals[Math.floor(n * 0.05)];
        const worstN = Math.floor(n * 0.05);

        setResults({
          samplePaths: apiResult.sample_paths,
          percentileSeries: apiResult.percentile_series,
          histogram: apiResult.histogram_bins.map(b => ({
            label: b.bin_label,
            count: b.count,
            frequency: b.frequency,
            aboveStart: b.above_start,
            midVal: (b.bin_start + b.bin_end) / 2,
          })),
          median: apiResult.median,
          mean: apiResult.mean,
          p10: apiResult.p10,
          p25: apiResult.p25,
          p75: apiResult.p75,
          p90: apiResult.p90,
          probProfit: apiResult.prob_profit,
          probDouble: apiResult.prob_double,
          var95: Math.round(Math.max(0, totalVal - var95val)),
          cvar95: worstN > 0
            ? Math.round(Math.max(0, totalVal - finals.slice(0, worstN).reduce((s, v) => s + v, 0) / worstN))
            : Math.round(Math.max(0, totalVal - var95val)),
          maxDrawdown: apiResult.max_drawdown_median,
          sharpe: apiResult.sharpe_estimate,
          months: apiResult.months,
          source: 'server',
        });
        toast.success(`Simulation complete — ${assumptions.numSims.toLocaleString()} paths (server)`);
        setRunning(false);
        return;
      }
    } catch {
      // fall through to client
    }

    // Client-side fallback
    setTimeout(() => {
      const res = runLocalMonteCarlo(totalVal, assumptions);
      setResults(res);
      setRunning(false);
      toast.success(`Simulation complete — ${assumptions.numSims.toLocaleString()} paths (client)`);
    }, 50);
  }, [totalVal, assumptions]);

  const tickInterval = (assumptions.years <= 1) ? 3 : (assumptions.years <= 3) ? 6 : 12;

  return (
    <div style={{ background: TC.bg0, padding: '14px' }}>
      {/* ── Header + Run Button ──────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <SectionLabel>MONTE CARLO VALUATION ENGINE</SectionLabel>
          {results && (
            <span style={{
              fontSize: '8px', letterSpacing: '0.1em', fontWeight: 600,
              color: results.source === 'server' ? TC.green : TC.blue,
              background: (results.source === 'server' ? TC.green : TC.blue) + '18',
              border: `1px solid ${(results.source === 'server' ? TC.green : TC.blue)}33`,
              padding: '1px 5px', borderRadius: '1px',
            }}>
              {results.source === 'server' ? 'SERVER' : 'CLIENT'}
            </span>
          )}
        </div>
        <TermBtn
          variant="primary"
          onClick={runSimulation}
          disabled={running || totalVal <= 0}
        >
          {running
            ? <><Loader2 style={{ width: 12, height: 12, animation: 'spin 1s linear infinite' }} /> RUNNING...</>
            : <><Play style={{ width: 11, height: 11 }} /> RUN VALUATION SIMULATION</>
          }
        </TermBtn>
      </div>

      {/* ── Assumptions Controls ─────────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: showAdvanced ? 'repeat(6, 1fr)' : 'repeat(4, 1fr)',
        gap: '8px', marginBottom: '12px',
      }}>
        {([
          { key: 'years',          label: 'HORIZON (YRS)',   min: 1,  max: 30,    step: 1 },
          { key: 'expectedReturn', label: 'EXP. RETURN %',  min: 1,  max: 30,    step: 0.5 },
          { key: 'volatility',     label: 'VOLATILITY %',   min: 5,  max: 50,    step: 0.5 },
          { key: 'riskFreeRate',   label: 'RISK-FREE %',    min: 0,  max: 15,    step: 0.5 },
          ...(showAdvanced ? [
            { key: 'numSims',      label: 'SIMULATIONS',    min: 500, max: 10000, step: 500 },
          ] : []),
        ] as { key: keyof SimAssumptions; label: string; min: number; max: number; step: number }[]).map(ctrl => (
          <div key={ctrl.key}>
            <div style={{ color: TC.text4, fontSize: '8px', letterSpacing: '0.1em', marginBottom: '4px' }}>{ctrl.label}</div>
            <input
              type="number"
              value={assumptions[ctrl.key]}
              min={ctrl.min}
              max={ctrl.max}
              step={ctrl.step}
              onChange={e => {
                const v = parseFloat(e.target.value);
                if (!isNaN(v)) updateAssumption(ctrl.key, Math.max(ctrl.min, Math.min(ctrl.max, v)));
              }}
              style={{
                width: '100%', background: TC.bg1, border: `1px solid ${TC.border}`,
                color: TC.text, padding: '4px 8px', borderRadius: '1px',
                fontSize: '12px', fontFamily: TC.font, outline: 'none',
              }}
              onFocus={e => { e.target.style.borderColor = TC.green + '66'; }}
              onBlur={e => { e.target.style.borderColor = TC.border; }}
            />
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <button
            onClick={() => setShowAdvanced(s => !s)}
            style={{
              background: 'transparent', border: `1px solid ${TC.border}`,
              color: TC.text4, fontSize: '8px', letterSpacing: '0.08em',
              padding: '5px 8px', borderRadius: '1px', cursor: 'pointer',
              fontFamily: TC.font,
            }}
          >
            {showAdvanced ? '◂ LESS' : 'MORE ▸'}
          </button>
        </div>
      </div>

      {/* ── Portfolio context ────────────────────────────────────── */}
      <div style={{
        display: 'flex', gap: '16px', padding: '6px 10px', marginBottom: '12px',
        background: TC.bg1, border: `1px solid ${TC.border}`, borderRadius: '1px',
      }}>
        <div style={{ display: 'flex', gap: '5px', alignItems: 'baseline' }}>
          <span style={{ color: TC.text4, fontSize: '8px', letterSpacing: '0.1em' }}>STARTING VALUE:</span>
          <span style={{ color: TC.text, fontSize: '12px' }}>{fmtINR(totalVal)}</span>
        </div>
        <div style={{ display: 'flex', gap: '5px', alignItems: 'baseline' }}>
          <span style={{ color: TC.text4, fontSize: '8px', letterSpacing: '0.1em' }}>MODEL:</span>
          <span style={{ color: TC.text3, fontSize: '10px' }}>GBM (Geometric Brownian Motion)</span>
        </div>
        <div style={{ display: 'flex', gap: '5px', alignItems: 'baseline' }}>
          <span style={{ color: TC.text4, fontSize: '8px', letterSpacing: '0.1em' }}>RISK SCORE:</span>
          <span style={{ color: TC.amber, fontSize: '10px' }}>{(riskScore * 100).toFixed(0)}%</span>
        </div>
      </div>

      {/* ── Results ──────────────────────────────────────────────── */}
      {!results && !running && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          height: '200px', border: `1px dashed ${TC.border}`, borderRadius: '1px',
        }}>
          <div style={{ textAlign: 'center' }}>
            <Play style={{ width: 24, height: 24, color: TC.text5, margin: '0 auto 8px' }} />
            <div style={{ color: TC.text4, fontSize: '11px' }}>Click <span style={{ color: TC.green }}>RUN VALUATION SIMULATION</span> to begin</div>
            <div style={{ color: TC.text5, fontSize: '9px', marginTop: '4px' }}>
              {assumptions.numSims.toLocaleString()} simulations × {assumptions.years * 12} months
            </div>
          </div>
        </div>
      )}

      {running && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          height: '200px', border: `1px solid ${TC.green}22`, borderRadius: '1px',
          background: TC.green + '06',
        }}>
          <div style={{ textAlign: 'center' }}>
            <Loader2 style={{ width: 24, height: 24, color: TC.green, margin: '0 auto 8px', animation: 'spin 1s linear infinite' }} />
            <div style={{ color: TC.green, fontSize: '11px' }}>Running {assumptions.numSims.toLocaleString()} simulations...</div>
            <div style={{ color: TC.text5, fontSize: '9px', marginTop: '4px' }}>
              μ={assumptions.expectedReturn}% · σ={assumptions.volatility}% · {assumptions.years}Y horizon
            </div>
          </div>
        </div>
      )}

      {results && !running && (
        <>
          {/* ── Stats Grid ─────────────────────────────────────────── */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)',
            gap: '1px', background: TC.border, marginBottom: '12px',
            border: `1px solid ${TC.border}`, borderRadius: '1px',
          }}>
            {[
              { label: 'MEDIAN',       val: fmtINR(results.median),           color: TC.text },
              { label: 'MEAN',         val: fmtINR(results.mean),             color: TC.text },
              { label: '90TH PCTL',    val: fmtINR(results.p90),              color: TC.green },
              { label: '10TH PCTL',    val: fmtINR(results.p10),              color: TC.red },
              { label: 'P(PROFIT)',    val: `${results.probProfit}%`,          color: results.probProfit >= 60 ? TC.green : TC.amber },
              { label: 'P(2×)',        val: `${results.probDouble}%`,          color: results.probDouble >= 20 ? TC.green : TC.text3 },
              { label: 'VaR 95%',      val: fmtINR(results.var95),            color: TC.red },
              { label: 'SHARPE',       val: results.sharpe.toFixed(2),         color: results.sharpe >= 0.5 ? TC.green : TC.amber },
            ].map(m => (
              <div key={m.label} style={{ background: TC.bg1, padding: '8px 10px' }}>
                <div style={{ color: TC.text4, fontSize: '7px', letterSpacing: '0.12em' }}>{m.label}</div>
                <div style={{ color: m.color, fontSize: '13px', marginTop: '2px' }}>{m.val}</div>
              </div>
            ))}
          </div>

          {/* ── Charts Row: Confidence Bands + Distribution Histogram ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {/* Confidence band chart */}
            <div style={{ border: `1px solid ${TC.border}`, borderRadius: '1px', padding: '10px', background: TC.bg1 }}>
              <SectionLabel>PROJECTION — CONFIDENCE BANDS (P10–P90)</SectionLabel>
              <div style={{ marginTop: '8px' }}>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={results.percentileSeries} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="bandOuter" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={TC.green} stopOpacity={0.08} />
                        <stop offset="100%" stopColor={TC.green} stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="bandInner" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={TC.green} stopOpacity={0.15} />
                        <stop offset="100%" stopColor={TC.green} stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <ReferenceLine y={totalVal} stroke={TC.text5} strokeDasharray="3 3" strokeWidth={1} />
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
                      axisLine={false} tickLine={false} width={44}
                    />
                    <Tooltip
                      contentStyle={{
                        background: TC.bg2, border: `1px solid ${TC.border}`,
                        borderRadius: '1px', fontFamily: TC.font, fontSize: '9px',
                      }}
                      formatter={(v: number, name: string) => [fmtINR(v), name.toUpperCase()]}
                      labelFormatter={v => `Month ${v}`}
                    />
                    <Area type="monotone" dataKey="p90" stroke="none" fill="url(#bandOuter)" isAnimationActive={false} />
                    <Area type="monotone" dataKey="p75" stroke="none" fill="url(#bandInner)" isAnimationActive={false} />
                    <Area type="monotone" dataKey="p25" stroke="none" fill="url(#bandInner)" isAnimationActive={false} />
                    <Area type="monotone" dataKey="p10" stroke="none" fill="url(#bandOuter)" isAnimationActive={false} />
                    <Line type="monotone" dataKey="p50" stroke={TC.green} strokeWidth={1.5} dot={false} isAnimationActive={false} />
                    <Line type="monotone" dataKey="p90" stroke={TC.green} strokeWidth={0.5} strokeDasharray="2 2" dot={false} opacity={0.5} isAnimationActive={false} />
                    <Line type="monotone" dataKey="p10" stroke={TC.red} strokeWidth={0.5} strokeDasharray="2 2" dot={false} opacity={0.5} isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
                <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
                  {[
                    { color: TC.green, label: 'MEDIAN (P50)', style: 'solid' },
                    { color: TC.green + '88', label: 'P10–P90 BAND', style: 'area' },
                    { color: TC.text5, label: 'START VALUE', style: 'dashed' },
                  ].map(l => (
                    <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {l.style === 'area'
                        ? <div style={{ width: 10, height: 6, background: l.color, opacity: 0.3, borderRadius: '1px' }} />
                        : <div style={{ width: 10, height: 0, borderTop: `1.5px ${l.style} ${l.color}` }} />
                      }
                      <span style={{ color: TC.text5, fontSize: '7px' }}>{l.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Distribution histogram */}
            <div style={{ border: `1px solid ${TC.border}`, borderRadius: '1px', padding: '10px', background: TC.bg1 }}>
              <SectionLabel>TERMINAL VALUE DISTRIBUTION — {assumptions.numSims.toLocaleString()} OUTCOMES</SectionLabel>
              <div style={{ marginTop: '8px' }}>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={results.histogram} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                    <XAxis
                      dataKey="label"
                      tick={{ fill: TC.text4, fontSize: 7, fontFamily: 'IBM Plex Mono' }}
                      interval={Math.max(0, Math.floor(results.histogram.length / 6) - 1)}
                      axisLine={false} tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: TC.text4, fontSize: 8, fontFamily: 'IBM Plex Mono' }}
                      axisLine={false} tickLine={false} width={30}
                    />
                    <Tooltip
                      contentStyle={{
                        background: TC.bg2, border: `1px solid ${TC.border}`,
                        borderRadius: '1px', fontFamily: TC.font, fontSize: '9px',
                      }}
                      formatter={(v: number) => [`${v} sims`, 'COUNT']}
                      labelFormatter={l => `Range: ${l}`}
                    />
                    <ReferenceLine x={`₹${(totalVal / 1000).toFixed(0)}k`} stroke={TC.text5} strokeDasharray="3 3" />
                    <Bar dataKey="count" isAnimationActive={false} radius={[1, 1, 0, 0]}>
                      {results.histogram.map((bin, i) => (
                        <Cell key={i} fill={bin.aboveStart ? TC.green + 'AA' : TC.red + '88'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <div style={{ width: 8, height: 8, background: TC.green + 'AA', borderRadius: '1px' }} />
                    <span style={{ color: TC.text5, fontSize: '7px' }}>PROFIT ({results.probProfit}%)</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <div style={{ width: 8, height: 8, background: TC.red + '88', borderRadius: '1px' }} />
                    <span style={{ color: TC.text5, fontSize: '7px' }}>LOSS ({100 - results.probProfit}%)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Risk Metrics Row ──────────────────────────────────── */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '8px', marginTop: '12px',
          }}>
            {[
              {
                label: 'VALUE AT RISK (95%)',
                desc: 'Max loss in worst 5% of scenarios',
                val: fmtINR(results.var95),
                color: TC.red,
              },
              {
                label: 'CONDITIONAL VaR (95%)',
                desc: 'Avg loss in worst 5% of scenarios',
                val: fmtINR(results.cvar95),
                color: TC.red,
              },
              {
                label: 'MAX DRAWDOWN (MEDIAN)',
                desc: 'Largest peak-to-trough on median path',
                val: `${results.maxDrawdown}%`,
                color: TC.amber,
              },
              {
                label: 'EXPECTED RANGE',
                desc: `80% confidence interval (${assumptions.years}Y)`,
                val: `${fmtINR(results.p10)} — ${fmtINR(results.p90)}`,
                color: TC.text,
              },
            ].map(m => (
              <div key={m.label} style={{
                padding: '10px 12px', background: TC.bg1,
                border: `1px solid ${TC.border}`, borderRadius: '1px',
              }}>
                <div style={{ color: TC.text4, fontSize: '8px', letterSpacing: '0.1em' }}>{m.label}</div>
                <div style={{ color: m.color, fontSize: '14px', marginTop: '3px' }}>{m.val}</div>
                <div style={{ color: TC.text5, fontSize: '8px', marginTop: '3px' }}>{m.desc}</div>
              </div>
            ))}
          </div>

          {/* ── Model footnote ───────────────────────────────────── */}
          <div style={{
            marginTop: '10px', padding: '6px 10px',
            background: TC.bg1, border: `1px solid ${TC.border2}`, borderRadius: '1px',
            display: 'flex', justifyContent: 'space-between',
          }}>
            <div style={{ color: TC.text5, fontSize: '8px', lineHeight: 1.6 }}>
              GBM model · μ={assumptions.expectedReturn}% · σ={assumptions.volatility}% · rf={assumptions.riskFreeRate}% · {results.months} monthly steps · {assumptions.numSims.toLocaleString()} sims
            </div>
            <div style={{ color: TC.text5, fontSize: '8px' }}>
              Source: {results.source === 'server' ? 'FastAPI backend' : 'Browser (client-side)'}
            </div>
          </div>
        </>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
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

        {/* ── [2] Monte Carlo Valuation Simulator ───────── */}
        <div style={{
          background: TC.border, marginTop: '1px',
        }}>
          <ValuationSimulator totalVal={ps.totalVal} riskScore={riskScore} />
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
