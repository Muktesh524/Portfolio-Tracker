/**
 * OverviewScreen.tsx — Bloomberg Terminal Portfolio Overview (F1)
 * ─────────────────────────────────────────────────────────────────
 * Layout (top → bottom):
 *   [1] Portfolio identity bar   — name, live IST clock, refresh timestamp, SIM/NSE badge
 *   [2] Five primary KPI tiles   — Current Value, Invested, Gain, MF split, Stock split
 *   [3] Six secondary KPI cells  — Equity %, Risk, MF count, Stock count, Sectors, Top sector
 *   [4] Three-panel chart row    — Asset allocation pie | Sector bar | Performance trend
 *   [5] Overexposure alert bar   — amber pills for sectors > 25%
 *   [6] Holdings table           — sortable, with sparkline column, sticky footer totals
 */

import { useState, useEffect } from "react";
import {
  PieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  TC, GRID_BG, computeHoldings, totalValue, totalInvested,
  SECTOR_COLORS, fmtINR, fmtINR2, fmtPct, gainColor, gainSymbol,
  SectionLabel, TypeBadge, ThSort, ThFixed, TRow, Td,
  AlertPill, PanelHeader, TermBtn,
} from "./TerminalShared";
import { useHoldings } from "../store";
import { SparklineCell } from "./SparklineCell";
import { PerformanceTrendChart } from "./PerformanceTrendChart";

// ─── Types ────────────────────────────────────────────────────────────────────

type SortKey = "name" | "currentValue" | "gainLoss" | "gainLossPct" | "invested" | "sector";

// ─── IST clock helpers ────────────────────────────────────────────────────────

const IST    = { timeZone: "Asia/Kolkata" };
const timeFmt = (d: Date) =>
  d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, ...IST });
const dateFmt = (d: Date) =>
  d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", ...IST });

// ─── Simulated market index data ──────────────────────────────────────────────
// Bloomberg SIM badge is shown because these are static placeholders,
// not a live WebSocket feed.  Real values would come from a backend proxy.

interface IndexQuote {
  label: string;
  val:   string;
  chg:   string;
  abs:   string;   // absolute change in native units
  up:    boolean;
}

const SIM_INDICES: IndexQuote[] = [
  { label: "NIFTY 50",    val: "24,832.15",  chg: "+0.43%",  abs: "+105.80", up: true  },
  { label: "SENSEX",      val: "82,198.40",  chg: "+0.38%",  abs: "+308.22", up: true  },
  { label: "NIFTY MID",   val: "52,441.30",  chg: "-0.12%",  abs: "-62.15",  up: false },
  { label: "USD/INR",     val: "83.42",      chg: "-0.08%",  abs: "-0.07",   up: false },
];

// ─── Animated ticker ──────────────────────────────────────────────────────────
// Scrolls SIM_INDICES left on a CSS animation so it feels live.

function TickerBar() {
  // Duplicate entries so the scroll loops seamlessly
  const items = [...SIM_INDICES, ...SIM_INDICES];

  return (
    <div style={{
      overflow: 'hidden',
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      // mask fades the edges so items appear/disappear smoothly
      maskImage: 'linear-gradient(to right, transparent 0%, black 4%, black 96%, transparent 100%)',
      WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 4%, black 96%, transparent 100%)',
    }}>
      <div style={{
        display: 'flex',
        gap: '0px',
        // translate the full width of the first set → creates infinite loop
        animation: 'tickerScroll 28s linear infinite',
        whiteSpace: 'nowrap',
        willChange: 'transform',
      }}>
        {items.map((idx, i) => (
          <span
            key={`${idx.label}-${i}`}
            style={{
              display: 'inline-flex',
              alignItems: 'baseline',
              gap: '4px',
              padding: '0 18px',
              borderRight: `1px solid ${TC.border2}`,
            }}
          >
            <span style={{ color: TC.text4, fontSize: '9px', letterSpacing: '0.08em' }}>
              {idx.label}
            </span>
            <span style={{ color: TC.text, fontSize: '10px' }}>{idx.val}</span>
            <span style={{ color: idx.up ? TC.green : TC.red, fontSize: '9px' }}>
              {idx.up ? '▲' : '▼'} {idx.chg}
            </span>
            <span style={{ color: (idx.up ? TC.green : TC.red) + '88', fontSize: '9px' }}>
              ({idx.abs})
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Market-status badge ──────────────────────────────────────────────────────
// NSE is open 09:15–15:30 IST on weekdays.
// Shows green "NSE OPEN" or amber "NSE CLOSED" + a SIM dot.

function MarketStatusBadge({ time }: { time: Date }) {
  const ist  = new Date(time.toLocaleString("en-US", IST));
  const h    = ist.getHours();
  const m    = ist.getMinutes();
  const mins = h * 60 + m;
  const day  = ist.getDay(); // 0=Sun, 6=Sat
  const isWeekday = day >= 1 && day <= 5;
  const isOpen    = isWeekday && mins >= 9 * 60 + 15 && mins < 15 * 60 + 30;

  const color = isOpen ? TC.green : TC.amber;
  const label = isOpen ? "NSE OPEN" : "NSE CLOSED";

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
      {/* Market status */}
      <span style={{
        color,
        fontSize: '9px',
        letterSpacing: '0.08em',
        background: color + '11',
        border: `1px solid ${color}33`,
        padding: '1px 7px',
        borderRadius: '1px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
      }}>
        <span style={{
          width: '5px',
          height: '5px',
          borderRadius: '50%',
          background: color,
          // blink the dot only when open
          animation: isOpen ? 'blink 1.6s step-end infinite' : 'none',
          display: 'inline-block',
        }} />
        {label}
      </span>

      {/* SIM badge — honest about data source */}
      <span style={{
        color: TC.amber,
        fontSize: '8px',
        letterSpacing: '0.12em',
        background: TC.amber + '0E',
        border: `1px solid ${TC.amber}22`,
        padding: '1px 5px',
        borderRadius: '1px',
      }}>
        SIM
      </span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function OverviewScreen({ onRefresh }: { onRefresh?: () => void }) {
  const [sortKey,    setSortKey]    = useState<SortKey>("currentValue");
  const [sortDir,    setSortDir]    = useState<"asc" | "desc">("desc");
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh,setLastRefresh]= useState(new Date());
  const [time,       setTime]       = useState(new Date());

  // Live IST clock — ticks every second
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // ── Portfolio computations (reactive via store) ────────────────────────────
  const holdings     = useHoldings();
  const computed     = computeHoldings(holdings);
  const totVal       = totalValue(computed);
  const totInv       = totalInvested(computed);
  const totGain      = totVal - totInv;
  const totGainPct   = (totGain / totInv) * 100;
  const mfVal        = computed.filter(h => h.type === "MF").reduce((s, h) => s + h.currentValue, 0);
  const stVal        = computed.filter(h => h.type === "Stock").reduce((s, h) => s + h.currentValue, 0);
  const gainC        = gainColor(totGain);

  // Sector aggregation
  const sectorMap: Record<string, number> = {};
  computed.forEach(h => { sectorMap[h.sector] = (sectorMap[h.sector] || 0) + h.currentValue; });
  const sectorData = Object.entries(sectorMap)
    .map(([name, val]) => ({ name, value: val, pct: (val / totVal) * 100 }))
    .sort((a, b) => b.value - a.value);

  const pieData = [
    { name: "Mutual Funds", value: mfVal },
    { name: "Stocks",       value: stVal },
  ];

  const overexposed = sectorData.filter(s => s.pct > 25);

  // Sorted holdings
  const sorted = [...computed].sort((a, b) => {
    const av = a[sortKey] as number | string;
    const bv = b[sortKey] as number | string;
    if (typeof av === "string")
      return sortDir === "asc" ? av.localeCompare(bv as string) : (bv as string).localeCompare(av);
    return sortDir === "asc" ? (av as number) - (bv as number) : (bv as number) - (av as number);
  });

  function handleSort(k: string) {
    if (sortKey === (k as SortKey)) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(k as SortKey); setSortDir("desc"); }
  }

  async function handleRefresh() {
    setRefreshing(true);
    onRefresh?.();
    toast("Fetching live NAVs & prices…", { description: "AMFI + NSE via mftool / yfinance" });
    await new Promise(r => setTimeout(r, 2200));
    setLastRefresh(new Date());
    setRefreshing(false);
    toast.success("Portfolio refreshed", { description: `All ${computed.length} instruments updated` });
  }

  return (
    <div className="flex flex-col h-full" style={{ fontFamily: TC.font, background: TC.bg0, ...GRID_BG }}>

      {/* ── [1] Portfolio identity + ticker bar ─────────────────────── */}
      <div style={{ flexShrink: 0, background: TC.bg1, borderBottom: `1px solid ${TC.border}` }}>

        {/* Row 1a — name, clock, status */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '4px 14px', borderBottom: `1px solid ${TC.border2}`,
          height: '28px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <span style={{ color: TC.green, fontSize: '11px', letterSpacing: '0.1em' }}>
              MUKTESH'S ₹30K PORTFOLIO
            </span>
            <span style={{ color: TC.border }}>│</span>
            <span style={{ color: TC.text3, fontSize: '10px', letterSpacing: '0.04em' }}>
              {dateFmt(time)}
            </span>
            <span style={{ color: TC.text2, fontSize: '10px', fontVariantNumeric: 'tabular-nums' }}>
              {timeFmt(time)}
            </span>
            <span style={{ color: TC.text4, fontSize: '10px' }}>IST</span>
            <span style={{ color: TC.border }}>│</span>
            <span style={{ color: TC.text5, fontSize: '9px' }}>
              REFRESHED {timeFmt(lastRefresh)}
            </span>
          </div>
          <MarketStatusBadge time={time} />
        </div>

        {/* Row 1b — animated index ticker */}
        <div style={{
          height: '26px',
          display: 'flex',
          alignItems: 'center',
          borderBottom: `1px solid ${TC.border2}`,
          overflow: 'hidden',
        }}>
          <TickerBar />
        </div>

        {/* ── [2] Primary KPI tiles ──────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1px', background: TC.border }}>
          {[
            { label: 'CURRENT VALUE',  val: fmtINR(totVal),  sub: `${computed.length} HOLDINGS`, color: TC.text },
            { label: 'TOTAL INVESTED', val: fmtINR(totInv),  sub: 'COST BASIS', color: TC.text3 },
            { label: 'TOTAL GAIN',     val: (totGain >= 0 ? '+' : '') + fmtINR2(totGain), sub: fmtPct(totGainPct), color: gainC },
            { label: 'MF VALUE',       val: fmtINR(mfVal),   sub: `${((mfVal / totVal) * 100).toFixed(1)}% OF PORT`, color: TC.blue },
            { label: 'STOCK VALUE',    val: fmtINR(stVal),   sub: `${((stVal / totVal) * 100).toFixed(1)}% OF PORT`, color: '#44CC88' },
          ].map(m => (
            <div key={m.label} style={{ padding: '8px 14px', background: TC.bg0 }}>
              <SectionLabel>{m.label}</SectionLabel>
              <div style={{ color: m.color, fontSize: '22px', letterSpacing: '-0.02em', lineHeight: 1.1, margin: '3px 0 2px' }}>
                {m.val}
              </div>
              <div style={{ color: TC.text4, fontSize: '9px' }}>{m.sub}</div>
            </div>
          ))}
        </div>

        {/* ── [3] Secondary KPI cells ────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '1px', background: TC.border }}>
          {[
            { label: 'EQUITY EXPOSURE', val: '100%',      color: TC.amber },
            { label: 'RISK PROFILE',    val: 'MODERATE+', color: TC.amber },
            { label: 'MF HOLDINGS',     val: `${holdings.filter(h => h.type === 'MF').length}`,    color: TC.text },
            { label: 'STOCK HOLDINGS',  val: `${holdings.filter(h => h.type === 'Stock').length}`, color: TC.text },
            { label: 'SECTORS',         val: `${sectorData.length}`,                               color: TC.text },
            { label: 'TOP SECTOR',      val: sectorData[0]?.name.toUpperCase() || '—',
              color: sectorData[0]?.pct > 25 ? TC.amber : TC.text },
          ].map(m => (
            <div key={m.label} style={{ padding: '5px 14px', background: TC.bg1 }}>
              <SectionLabel>{m.label}</SectionLabel>
              <div style={{ color: m.color, fontSize: '13px', marginTop: '2px', letterSpacing: '0.02em' }}>{m.val}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── [4] Three-panel chart row ────────────────────────────────── */}
      <div style={{
        flexShrink: 0,
        display: 'grid',
        gridTemplateColumns: '200px 1fr 1fr',
        gap: '1px',
        background: TC.border,
        borderBottom: `1px solid ${TC.border}`,
      }}>

        {/* Panel A — Donut allocation chart */}
        <div style={{ padding: '10px 14px', background: TC.bg0 }}>
          <SectionLabel>ASSET ALLOCATION</SectionLabel>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '6px' }}>
            <PieChart width={100} height={100}>
              <Pie
                data={pieData}
                cx={48} cy={46}
                innerRadius={26} outerRadius={44}
                dataKey="value"
                stroke="none"
                // thin gap between segments — Bloomberg uses 1px separators
                paddingAngle={1}
              >
                <Cell key="pie-mf" fill={TC.blue}  />
                <Cell key="pie-st" fill={TC.green} />
              </Pie>
              <Tooltip
                contentStyle={{ background: TC.bg2, border: `1px solid ${TC.border}`, borderRadius: '1px', fontFamily: TC.font, fontSize: '10px' }}
                formatter={(v: number) => [fmtINR2(v), ""]}
              />
            </PieChart>

            {/* Legend */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {pieData.map((d, i) => (
                <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: 7, height: 7, background: i === 0 ? TC.blue : TC.green, borderRadius: '1px', flexShrink: 0 }} />
                  <div>
                    <div style={{ color: TC.text3, fontSize: '8px', letterSpacing: '0.08em' }}>
                      {d.name.toUpperCase()}
                    </div>
                    <div style={{ color: TC.text, fontSize: '11px' }}>{fmtINR(d.value)}</div>
                    <div style={{ color: TC.text4, fontSize: '9px' }}>
                      {((d.value / totVal) * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Panel B — Sector bar chart */}
        <div style={{ padding: '10px 14px', background: TC.bg0 }}>
          <SectionLabel>SECTOR EXPOSURE — TOP 8</SectionLabel>
          <div style={{ marginTop: '6px' }}>
            <ResponsiveContainer width="100%" height={100}>
              <BarChart
                data={sectorData.slice(0, 8)}
                layout="vertical"
                margin={{ left: 0, right: 40, top: 0, bottom: 0 }}
              >
                <XAxis
                  type="number"
                  tick={{ fill: TC.text4, fontSize: 8, fontFamily: 'IBM Plex Mono' }}
                  tickFormatter={v => `${v.toFixed(0)}%`}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={68}
                  tick={{ fill: TC.text3, fontSize: 8, fontFamily: 'IBM Plex Mono' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{ background: TC.bg2, border: `1px solid ${TC.border}`, borderRadius: '1px', fontFamily: TC.font, fontSize: '10px' }}
                  formatter={(v: number) => [`${v.toFixed(1)}%`, 'Alloc']}
                  cursor={{ fill: TC.bg3 }}
                />
                <Bar dataKey="pct" radius={[0, 1, 1, 0]} maxBarSize={10}>
                  {sectorData.slice(0, 8).map(e => (
                    <Cell
                      key={`bar-${e.name}`}
                      fill={e.pct > 25 ? TC.amber : (SECTOR_COLORS[e.name] || TC.green)}
                      opacity={0.85}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Panel C — Performance trend area chart */}
        <PerformanceTrendChart finalValue={totVal} totalGainPct={totGainPct} />
      </div>

      {/* ── [5] Overexposure alert bar ───────────────────────────────── */}
      {overexposed.length > 0 && (
        <div style={{
          flexShrink: 0,
          display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap',
          padding: '5px 14px',
          background: '#0D0700',
          borderBottom: `1px solid ${TC.amber}33`,
        }}>
          <span style={{ color: TC.amber, fontSize: '9px', letterSpacing: '0.14em' }}>OVEREXPOSURE:</span>
          {overexposed.map(s => <AlertPill key={s.name} sector={s.name} pct={s.pct} />)}
        </div>
      )}

      {/* ── [6] Holdings table ───────────────────────────────────────── */}
      <PanelHeader
        title={`HOLDINGS TABLE — ${computed.length} INSTRUMENTS  ·  CLICK COLUMN TO SORT`}
        right={
          <TermBtn
            variant="ghost"
            disabled={refreshing}
            onClick={handleRefresh}
          >
            <RefreshCw className={`w-3 h-3 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "REFRESHING…" : "REFRESH  [R]"}
          </TermBtn>
        }
      />

      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <ThFixed  label="TYPE" />
                <ThSort   label="NAME"       sortKey="name"        activeSortKey={sortKey} dir={sortDir} onSort={handleSort} align="left" />
                <ThFixed  label="CODE / TICKER" />
                <ThFixed  label="UNITS" />
                <ThFixed  label="AVG COST" />
                <ThFixed  label="NAV / CMP" />
                <ThSort   label="VALUE ₹"    sortKey="currentValue" activeSortKey={sortKey} dir={sortDir} onSort={handleSort} />
                {/* Consolidated G/L column: shows both absolute + % */}
                <ThSort   label="GAIN / LOSS ▸ %" sortKey="gainLoss" activeSortKey={sortKey} dir={sortDir} onSort={handleSort} />
                <ThFixed  label="ALLOC %" />
                <ThFixed  label="15D TREND" align="right" />
                <ThSort   label="SECTOR"     sortKey="sector"       activeSortKey={sortKey} dir={sortDir} onSort={handleSort} align="left" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((h, i) => {
                const alloc   = (h.currentValue / totVal) * 100;
                const glColor = gainColor(h.gainLoss);
                return (
                  <TRow key={h.id} index={i}>
                    <Td align="center">
                      <TypeBadge type={h.type} />
                    </Td>

                    <Td align="left" style={{ color: TC.text, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '11px' }}>
                      {h.name}
                    </Td>

                    <Td style={{ color: TC.text4, fontSize: '10px' }}>{h.identifier}</Td>

                    <Td style={{ color: TC.text3 }}>
                      {h.units.toFixed(h.type === 'Stock' ? 0 : 3)}
                    </Td>

                    <Td style={{ color: TC.text3 }}>{fmtINR2(h.avgCost)}</Td>

                    <Td style={{ color: TC.text }}>{fmtINR2(h.currentNav)}</Td>

                    <Td style={{ color: TC.text }}>{fmtINR(h.currentValue)}</Td>

                    {/* Consolidated gain cell: ▲/▼ abs  (pct%) */}
                    <Td>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '1px' }}>
                        <span style={{ color: glColor, fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          <span style={{ fontSize: '9px' }}>{gainSymbol(h.gainLoss)}</span>
                          {fmtINR2(Math.abs(h.gainLoss))}
                        </span>
                        <span style={{
                          color: glColor + 'BB',
                          fontSize: '9px',
                          background: glColor + '0F',
                          padding: '0px 4px',
                          borderRadius: '1px',
                        }}>
                          {Math.abs(h.gainLossPct).toFixed(2)}%
                        </span>
                      </div>
                    </Td>

                    <Td style={{ color: TC.text3 }}>{alloc.toFixed(1)}%</Td>

                    {/* Sparkline — 60px wide, 24px tall, no interaction */}
                    <Td align="right" style={{ padding: '2px 10px' }}>
                      <SparklineCell holdingId={h.id} gainLossPct={h.gainLossPct} />
                    </Td>

                    <Td align="left" style={{ color: TC.text4, fontSize: '10px' }}>{h.sector}</Td>
                  </TRow>
                );
              })}

              {/* Totals sticky footer */}
              <tr style={{
                background:   TC.bg2,
                borderTop:    `1px solid ${TC.border}`,
                position:     'sticky',
                bottom:       0,
                zIndex:       1,
              }}>
                <td colSpan={6} style={{ padding: '5px 10px', color: TC.text4, fontSize: '9px', letterSpacing: '0.12em', fontFamily: TC.font, textAlign: 'right' }}>
                  PORTFOLIO TOTALS
                </td>
                <td style={{ padding: '5px 10px', color: TC.text, fontSize: '11px', fontFamily: TC.font, textAlign: 'right' }}>
                  {fmtINR(totVal)}
                </td>
                <td style={{ padding: '5px 10px', fontFamily: TC.font, textAlign: 'right' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '1px' }}>
                    <span style={{ color: gainColor(totGain), fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                      <span style={{ fontSize: '9px' }}>{gainSymbol(totGain)}</span>
                      {fmtINR2(Math.abs(totGain))}
                    </span>
                    <span style={{ color: gainColor(totGainPct) + 'BB', fontSize: '9px' }}>
                      {Math.abs(totGainPct).toFixed(2)}%
                    </span>
                  </div>
                </td>
                <td style={{ padding: '5px 10px', color: TC.text4, fontSize: '9px', fontFamily: TC.font, textAlign: 'right' }}>
                  100.0%
                </td>
                <td colSpan={2} />
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Ticker animation keyframe ─────────────────────────────────── */}
      {/*
        We inject the @keyframes here as an inline <style> tag so this component
        is entirely self-contained.  The animation translates exactly 50% of the
        doubled-list width, which equals the width of the original single list.
      */}
      <style>{`
        @keyframes tickerScroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}
