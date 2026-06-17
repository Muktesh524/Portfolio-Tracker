import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { Toaster } from "sonner";
import { Activity, BarChart2, BookOpen, PieChart, Lightbulb, ChevronLeft, ChevronRight } from "lucide-react";
import { TC } from "./components/TerminalShared";
import { usePortfolioSummary } from "./store";
import { fmtINR, fmtINR2, fmtPct, gainColor } from "./components/TerminalShared";

const OverviewScreen        = lazy(() => import("./components/OverviewScreen").then(m => ({ default: m.OverviewScreen })));
const HoldingsScreen        = lazy(() => import("./components/HoldingsScreen").then(m => ({ default: m.HoldingsScreen })));
const AnalysisScreen        = lazy(() => import("./components/AnalysisScreen").then(m => ({ default: m.AnalysisScreen })));
const RecommendationsScreen = lazy(() => import("./components/RecommendationsScreen").then(m => ({ default: m.RecommendationsScreen })));

const APP_VERSION = "3.2.0";
const BUILD_DATE  = new Date().toISOString().split("T")[0];

type Tab = "overview" | "holdings" | "analysis" | "recommendations";

const TABS: { id: Tab; label: string; key: string; icon: React.ReactNode }[] = [
  { id: "overview",        label: "OVERVIEW",        key: "F1", icon: <BarChart2 style={{ width: 13, height: 13 }} /> },
  { id: "holdings",        label: "HOLDINGS",        key: "F2", icon: <BookOpen  style={{ width: 13, height: 13 }} /> },
  { id: "analysis",        label: "ANALYSIS",        key: "F3", icon: <PieChart  style={{ width: 13, height: 13 }} /> },
  { id: "recommendations", label: "RECOMMENDATIONS", key: "F4", icon: <Lightbulb style={{ width: 13, height: 13 }} /> },
];

const CMD_HINTS = [
  { key: "F1", desc: "OVERVIEW" },
  { key: "F2", desc: "HOLDINGS" },
  { key: "F3", desc: "ANALYSIS" },
  { key: "F4", desc: "RECS" },
  { key: "R",  desc: "REFRESH" },
  { key: "\\", desc: "SIDEBAR" },
];

// ─── Loading skeleton — Bloomberg-style pulsing bars ──────────────────────────

function ScreenSkeleton() {
  return (
    <div style={{
      width: '100%', height: '100%',
      background: TC.bg0, fontFamily: TC.font,
      display: 'flex', flexDirection: 'column', padding: '14px',
      gap: '12px',
    }}>
      {/* Header pulse */}
      <div style={{ display: 'flex', gap: '1px' }}>
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} style={{
            flex: 1, height: '52px', background: TC.bg1,
            borderRadius: '1px',
            animation: 'pulse 1.5s ease-in-out infinite',
            animationDelay: `${i * 80}ms`,
          }} />
        ))}
      </div>
      {/* Chart area pulse */}
      <div style={{ display: 'flex', gap: '1px', flex: 'none' }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{
            flex: 1, height: '120px', background: TC.bg1,
            borderRadius: '1px',
            animation: 'pulse 1.5s ease-in-out infinite',
            animationDelay: `${i * 120}ms`,
          }} />
        ))}
      </div>
      {/* Table rows pulse */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} style={{
            height: '28px', background: i % 2 === 0 ? TC.bg0 : TC.bg1,
            borderRadius: '1px',
            animation: 'pulse 1.5s ease-in-out infinite',
            animationDelay: `${i * 60}ms`,
          }} />
        ))}
      </div>
      {/* Terminal-style loading indicator */}
      <div style={{
        color: TC.text5, fontSize: '9px', letterSpacing: '0.12em',
        display: 'flex', alignItems: 'center', gap: '8px',
      }}>
        <span style={{ color: TC.green + '66' }}>›</span>
        LOADING MODULE
        <span className="cursor-blink" style={{ color: TC.green }}>_</span>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.4; }
          50%      { opacity: 0.7; }
        }
      `}</style>
    </div>
  );
}

// ─── Main app ─────────────────────────────────────────────────────────────────

export default function App() {
  const [tab,         setTab]         = useState<Tab>("overview");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [refreshKey,  setRefreshKey]  = useState(0);

  const ps = usePortfolioSummary();

  const riskLabel = ps.mfPct + ps.stPct >= 85 ? "AGGRESSIVE"
    : ps.mfPct + ps.stPct >= 70 ? "MOD+"
    : ps.mfPct + ps.stPct >= 40 ? "MODERATE"
    : "CONSERV";

  const gainC = gainColor(ps.totalGain);

  const sidebarStats = [
    { label: "CURR VALUE",  val: fmtINR(ps.totalVal),                                     color: TC.text },
    { label: "TOTAL GAIN",  val: (ps.totalGain >= 0 ? "+" : "") + fmtINR2(ps.totalGain),  color: gainC },
    { label: "RETURN",      val: fmtPct(ps.totalGainPct),                                  color: gainC },
    { label: "MF ALLOC",    val: ps.mfPct.toFixed(1) + "%",                                color: TC.blue },
    { label: "STOCK ALLOC", val: ps.stPct.toFixed(1) + "%",                                color: "#44CC88" },
    { label: "RISK",        val: riskLabel,                                                 color: TC.amber },
    { label: "HOLDINGS",    val: String(ps.holdingCount),                                   color: TC.text3 },
    { label: "SECTORS",     val: String(ps.sectorCount),                                    color: TC.text3 },
  ];

  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
    if (e.key === "F1") { e.preventDefault(); setTab("overview"); }
    if (e.key === "F2") { e.preventDefault(); setTab("holdings"); }
    if (e.key === "F3") { e.preventDefault(); setTab("analysis"); }
    if (e.key === "F4") { e.preventDefault(); setTab("recommendations"); }
    if (e.key === "r" || e.key === "R") setRefreshKey(k => k + 1);
    if (e.key === "\\") setSidebarOpen(s => !s);
  }, []);

  useEffect(() => {
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  return (
    <div
      style={{
        width: '100%', height: '100%',
        display: 'flex', flexDirection: 'column',
        background: TC.bg0,
        fontFamily: TC.font,
        color: TC.text,
        overflow: 'hidden',
      }}
    >
      <Toaster
        position="top-right"
        theme="dark"
        toastOptions={{
          style: {
            background: TC.bg2,
            border: `1px solid ${TC.border}`,
            color: TC.text,
            fontFamily: TC.font,
            fontSize: '11px',
            borderRadius: '1px',
          },
        }}
      />

      {/* ── Ticker / brand bar ─────────────────────────────────────── */}
      <div style={{
        flexShrink: 0,
        display: 'flex', alignItems: 'stretch',
        background: '#080808',
        borderBottom: `1px solid ${TC.border}`,
        height: '38px',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '0 16px',
          borderRight: `1px solid ${TC.border}`,
          minWidth: sidebarOpen ? '180px' : '44px',
          transition: 'min-width 200ms',
          overflow: 'hidden',
          flexShrink: 0,
        }}>
          <Activity style={{ width: 14, height: 14, color: TC.green, flexShrink: 0 }} />
          {sidebarOpen && (
            <span style={{ color: TC.green, fontSize: '11px', letterSpacing: '0.08em', whiteSpace: 'nowrap', fontWeight: 600 }}>
              BLOOMBERG<span style={{ color: TC.text5 }}> TERMINAL</span>
            </span>
          )}
        </div>

        <div style={{ display: 'flex', flex: 1 }}>
          {TABS.map(t => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '7px',
                  padding: '0 18px',
                  borderRight: `1px solid ${TC.border}`,
                  borderBottom: active ? `2px solid ${TC.green}` : '2px solid transparent',
                  background: active ? TC.bg1 : 'transparent',
                  color: active ? TC.green : TC.text4,
                  fontSize: '10px', letterSpacing: '0.1em',
                  cursor: 'pointer',
                  transition: 'color 80ms, background 80ms',
                  fontFamily: TC.font,
                  outline: 'none',
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.color = TC.text2; }}
                onMouseLeave={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.color = TC.text4; }}
              >
                {t.icon}
                {t.label}
                <span style={{ color: TC.text5, fontSize: '9px' }}>[{t.key}]</span>
              </button>
            );
          })}
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', gap: '12px',
          padding: '0 16px',
          borderLeft: `1px solid ${TC.border}`,
        }}>
          {[
            { label: "NIFTY 50",    val: "24,832.15", chg: "+0.43%",  up: true },
            { label: "SENSEX",      val: "82,198.40", chg: "+0.38%",  up: true },
            { label: "NIFTY MID",   val: "52,441.30", chg: "-0.12%",  up: false },
            { label: "USD/INR",     val: "83.42",     chg: "-0.08%",  up: false },
          ].map(idx => (
            <div key={idx.label} style={{ display: 'flex', alignItems: 'baseline', gap: '5px' }}>
              <span style={{ color: TC.text4, fontSize: '9px', letterSpacing: '0.08em' }}>{idx.label}</span>
              <span style={{ color: TC.text, fontSize: '10px' }}>{idx.val}</span>
              <span style={{ color: idx.up ? TC.green : TC.red, fontSize: '9px' }}>
                {idx.up ? '▲' : '▼'} {idx.chg}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Content area (sidebar + screen) ────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Sidebar */}
        <div style={{
          flexShrink: 0,
          display: 'flex', flexDirection: 'column',
          width: sidebarOpen ? '178px' : '38px',
          borderRight: `1px solid ${TC.border}`,
          background: '#0C0C0C',
          overflow: 'hidden',
          transition: 'width 200ms',
        }}>
          <button
            onClick={() => setSidebarOpen(s => !s)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
              padding: '6px 10px',
              borderBottom: `1px solid ${TC.border}`,
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: TC.text5,
              transition: 'color 80ms',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = TC.green; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = TC.text5; }}
          >
            {sidebarOpen
              ? <ChevronLeft style={{ width: 12, height: 12 }} />
              : <ChevronRight style={{ width: 12, height: 12 }} />}
          </button>

          {sidebarOpen && (
            <>
              <div style={{ padding: '10px 12px', borderBottom: `1px solid ${TC.border}` }}>
                <div style={{ color: TC.text5, fontSize: '8px', letterSpacing: '0.14em', marginBottom: '8px' }}>QUICK STATS</div>
                {sidebarStats.map(s => (
                  <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '5px' }}>
                    <span style={{ color: TC.text5, fontSize: '9px' }}>{s.label}</span>
                    <span style={{ color: s.color, fontSize: '11px' }}>{s.val}</span>
                  </div>
                ))}
              </div>

              <div style={{ padding: '10px 12px', borderBottom: `1px solid ${TC.border}` }}>
                <div style={{ color: TC.text5, fontSize: '8px', letterSpacing: '0.14em', marginBottom: '5px' }}>RISK PROFILE</div>
                <div style={{
                  display: 'inline-block', color: TC.amber, fontSize: '11px',
                  background: TC.amber + '18', border: `1px solid ${TC.amber}44`,
                  padding: '2px 7px', borderRadius: '1px',
                }}>{riskLabel}</div>
                <div style={{ color: TC.text5, fontSize: '9px', marginTop: '5px', lineHeight: 1.6 }}>
                  {ps.stPct + ps.mfPct >= 100 ? "100% equity. Consider adding debt buffer." : `${(ps.stPct + ps.mfPct).toFixed(0)}% equity exposure.`}
                </div>
              </div>

              <div style={{ padding: '10px 12px', borderBottom: `1px solid ${TC.border}` }}>
                <div style={{ color: TC.text5, fontSize: '8px', letterSpacing: '0.14em', marginBottom: '6px' }}>KEYBOARD</div>
                {CMD_HINTS.map(h => (
                  <div key={h.key} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ color: TC.bg3, fontSize: '9px', background: TC.bg2, border: `1px solid ${TC.border}`, padding: '0 4px', borderRadius: '1px', fontFamily: TC.font }}>{h.key}</span>
                    <span style={{ color: TC.text5, fontSize: '9px' }}>{h.desc}</span>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 'auto', padding: '10px 12px', borderTop: `1px solid ${TC.border}` }}>
                <button
                  onClick={() => {
                    const blob = new Blob(["Type,Name,Identifier\nSee Holdings tab for full export"], { type: "text/csv" });
                    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "portfolio.csv"; a.click();
                  }}
                  style={{
                    width: '100%', background: TC.green + '11', color: TC.green,
                    border: `1px solid ${TC.green}22`, padding: '5px',
                    fontSize: '9px', letterSpacing: '0.08em', borderRadius: '1px',
                    cursor: 'pointer', fontFamily: TC.font,
                  }}
                >
                  EXPORT CSV
                </button>
              </div>
            </>
          )}
        </div>

        {/* Screen — lazy loaded with Suspense fallback */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <Suspense fallback={<ScreenSkeleton />}>
            {tab === "overview"        && <OverviewScreen onRefresh={() => setRefreshKey(k => k + 1)} key={refreshKey} />}
            {tab === "holdings"        && <HoldingsScreen />}
            {tab === "analysis"        && <AnalysisScreen />}
            {tab === "recommendations" && <RecommendationsScreen />}
          </Suspense>
        </div>
      </div>

      {/* ── Global command bar ──────────────────────────────────────── */}
      <div style={{
        flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '3px 14px',
        background: '#080808',
        borderTop: `1px solid ${TC.border}`,
        height: '26px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ color: TC.green + '66', fontSize: '11px' }}>›</span>
          <span style={{ color: TC.text5, fontSize: '9px', letterSpacing: '0.06em' }}>TYPE COMMAND</span>
          <span style={{ color: TC.border, fontSize: '10px' }}>│</span>
          {CMD_HINTS.map(h => (
            <span key={h.key} style={{ color: TC.text5, fontSize: '9px', display: 'inline-flex', gap: '4px', alignItems: 'center' }}>
              <span style={{ color: TC.text5, background: TC.bg2, border: `1px solid ${TC.border}`, padding: '0 3px', borderRadius: '1px', fontSize: '8px', fontFamily: TC.font }}>{h.key}</span>
              {h.desc}
            </span>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <span style={{ color: TC.text5, fontSize: '9px' }}>DATA: AMFI + NSE VIA MFTOOL/YFINANCE (EDUCATIONAL)</span>
          <span style={{ color: TC.border, fontSize: '10px' }}>│</span>
          <span style={{ color: TC.text5, fontSize: '9px' }}>v{APP_VERSION}  ·  {BUILD_DATE}</span>
        </div>
      </div>
    </div>
  );
}
