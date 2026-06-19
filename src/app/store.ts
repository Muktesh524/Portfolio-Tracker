/**
 * store.ts — Lightweight global portfolio store
 * ───────────────────────────────────────────────
 * Zero-dependency reactive state using useSyncExternalStore.
 * Reads/writes the same localStorage key as HoldingsScreen so
 * both codepaths stay in sync.
 *
 * Usage:  const holdings = useHoldings();
 *         const actions  = useHoldingActions();
 */

import { useSyncExternalStore } from "react";
import { HOLDINGS as DEFAULT_HOLDINGS, computeHoldings, totalValue, totalInvested, type Holding, type ComputedHolding } from "./components/TerminalShared";

const LS_KEY = "bloomberg-portfolio-holdings";

// ─── External store ───────────────────────────────────────────────────────────

type Listener = () => void;

let holdings: Holding[] = loadFromStorage();
let listeners: Set<Listener> = new Set();

function loadFromStorage(): Holding[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return DEFAULT_HOLDINGS;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_HOLDINGS;
    return parsed as Holding[];
  } catch {
    return DEFAULT_HOLDINGS;
  }
}

function persist(next: Holding[]) {
  holdings = next;
  localStorage.setItem(LS_KEY, JSON.stringify(next));
  listeners.forEach(l => l());
}

function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function getSnapshot(): Holding[] {
  return holdings;
}

// Listen for storage events from other tabs
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === LS_KEY) {
      holdings = loadFromStorage();
      listeners.forEach(l => l());
    }
  });
}

// ─── Public hooks ─────────────────────────────────────────────────────────────

export function useHoldings(): Holding[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export interface HoldingActions {
  set:    (holdings: Holding[]) => void;
  add:    (holding: Omit<Holding, "id">) => void;
  update: (id: number, fields: Partial<Holding>) => void;
  remove: (id: number) => void;
  reset:  () => void;
  clear:  () => void;
}

export function useHoldingActions(): HoldingActions {
  return {
    set(next: Holding[]) {
      persist(next);
    },
    add(h: Omit<Holding, "id">) {
      persist([...holdings, { ...h, id: Date.now() }]);
    },
    update(id: number, fields: Partial<Holding>) {
      persist(holdings.map(h => h.id === id ? { ...h, ...fields } : h));
    },
    remove(id: number) {
      persist(holdings.filter(h => h.id !== id));
    },
    reset() {
      persist([...DEFAULT_HOLDINGS]);
    },
    clear() {
      persist([]);
    },
  };
}

// ─── Derived data hook ────────────────────────────────────────────────────────

export interface PortfolioSummary {
  computed:     ComputedHolding[];
  totalVal:     number;
  totalInv:     number;
  totalGain:    number;
  totalGainPct: number;
  mfVal:        number;
  stVal:        number;
  mfPct:        number;
  stPct:        number;
  sectorCount:  number;
  holdingCount: number;
}

export function usePortfolioSummary(): PortfolioSummary {
  const h = useHoldings();
  const computed  = computeHoldings(h);
  const totalVal  = totalValue(computed);
  const totalInv  = totalInvested(computed);
  const totalGain = totalVal - totalInv;
  const mfVal     = computed.filter(x => x.type === "MF").reduce((s, x) => s + x.currentValue, 0);
  const stVal     = computed.filter(x => x.type === "Stock").reduce((s, x) => s + x.currentValue, 0);

  return {
    computed,
    totalVal,
    totalInv,
    totalGain,
    totalGainPct: totalInv > 0 ? (totalGain / totalInv) * 100 : 0,
    mfVal,
    stVal,
    mfPct: totalVal > 0 ? (mfVal / totalVal) * 100 : 0,
    stPct: totalVal > 0 ? (stVal / totalVal) * 100 : 0,
    sectorCount:  new Set(computed.map(x => x.sector)).size,
    holdingCount: h.length,
  };
}
