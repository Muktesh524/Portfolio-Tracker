/**
 * store.ts — User-aware global portfolio store
 * ─────────────────────────────────────────────
 * Reactive state using useSyncExternalStore.
 * Firestore is the source of truth; localStorage is an offline cache.
 *
 * Lifecycle:
 *   1. User logs in  → App calls initForUser(uid)
 *                       → load from Firestore (or migrate from localStorage)
 *                       → subscribe to onSnapshot for real-time updates
 *   2. User edits    → mutate in-memory + write localStorage + debounce Firestore write
 *   3. User logs out → App calls teardown()
 *                       → unsubscribe, clear in-memory state
 *
 * Usage:
 *   const holdings = useHoldings();
 *   const actions  = useHoldingActions();
 */

import { useSyncExternalStore } from "react";
import { HOLDINGS as DEFAULT_HOLDINGS, computeHoldings, totalValue, totalInvested, type Holding, type ComputedHolding } from "./components/TerminalShared";
import {
  loadFromFirestore,
  persistToFirestore,
  subscribeToHoldings,
  migrateLocalStorageToFirestore,
} from "./firestoreSync";
import type { Unsubscribe } from "firebase/firestore";

const LS_KEY = "bloomberg-portfolio-holdings";

// ─── External store ───────────────────────────────────────────────────────────

type Listener = () => void;

let holdings: Holding[] = loadFromLocalStorage();
let listeners: Set<Listener> = new Set();
let firestoreUnsub: Unsubscribe | null = null;
let currentUid: string | null = null;

function loadFromLocalStorage(): Holding[] {
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

function saveToLocalStorage(next: Holding[]) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(next));
  } catch {
    // QuotaExceededError — Firestore is source of truth anyway
  }
}

function notify() {
  listeners.forEach(l => l());
}

/**
 * Internal: update in-memory state, persist to localStorage + Firestore.
 * skipFirestore=true when the update came FROM Firestore (avoids echo loop).
 */
function persist(next: Holding[], skipFirestore = false) {
  holdings = next;
  saveToLocalStorage(next);
  if (!skipFirestore && currentUid) {
    persistToFirestore(currentUid, next);
  }
  notify();
}

function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function getSnapshot(): Holding[] {
  return holdings;
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────

/**
 * Called after login. Loads holdings from Firestore (migrating from
 * localStorage if this is the user's first login), then subscribes
 * to real-time onSnapshot updates.
 *
 * Returns a promise that resolves once the initial load is complete
 * so App.tsx can show a loading state during the sync.
 */
export async function initForUser(uid: string): Promise<void> {
  currentUid = uid;

  // Try to migrate localStorage → Firestore on first login (best-effort)
  const localHoldings = loadFromLocalStorage();
  try {
    await migrateLocalStorageToFirestore(uid, localHoldings);
  } catch {
    // Non-fatal
  }

  // One-time load from Firestore
  try {
    const firestoreHoldings = await loadFromFirestore(uid);
    if (firestoreHoldings.length > 0) {
      persist(firestoreHoldings, true); // skipFirestore: just loaded from there
    }
  } catch {
    // Fallback to localStorage
  }

  // Subscribe to real-time updates (handles changes from other devices)
  firestoreUnsub = subscribeToHoldings(uid, (incoming) => {
    // Avoid echo: only apply if the set of IDs changed
    const currentIds  = holdings.map(h => h.id).sort().join(",");
    const incomingIds = incoming.map(h => h.id).sort().join(",");
    if (currentIds !== incomingIds) {
      persist(incoming, true);
    }
  });
}

/**
 * Called on logout. Clears in-memory state and unsubscribes from Firestore.
 */
export function teardown() {
  if (firestoreUnsub) {
    firestoreUnsub();
    firestoreUnsub = null;
  }
  currentUid = null;
  holdings = DEFAULT_HOLDINGS;
  notify();
}

// ─── Public hooks ─────────────────────────────────────────────────────────────

export function useHoldings(): Holding[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export interface HoldingActions {
  set:    (holdings: Holding[]) => void;
  add:    (holding: Omit<Holding, "id">) => void;
  update: (id: string, fields: Partial<Holding>) => void;
  remove: (id: string) => void;
  reset:  () => void;
  clear:  () => void;
}

/** Short unique string ID */
function genId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function useHoldingActions(): HoldingActions {
  return {
    set(next: Holding[]) {
      persist(next);
    },
    add(h: Omit<Holding, "id">) {
      persist([...holdings, { ...h, id: genId() }]);
    },
    update(id: string, fields: Partial<Holding>) {
      persist(holdings.map(h => h.id === id ? { ...h, ...fields } : h));
    },
    remove(id: string) {
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
  const totVal    = totalValue(computed);
  const totInv    = totalInvested(computed);
  const totGain   = totVal - totInv;
  const mfVal     = computed.filter(x => x.type === "MF").reduce((s, x) => s + x.currentValue, 0);
  const stVal     = computed.filter(x => x.type === "Stock").reduce((s, x) => s + x.currentValue, 0);

  return {
    computed,
    totalVal:     totVal,
    totalInv:     totInv,
    totalGain:    totGain,
    totalGainPct: totInv > 0 ? (totGain / totInv) * 100 : 0,
    mfVal,
    stVal,
    mfPct: totVal > 0 ? (mfVal / totVal) * 100 : 0,
    stPct: totVal > 0 ? (stVal / totVal) * 100 : 0,
    sectorCount:  new Set(computed.map(x => x.sector)).size,
    holdingCount: h.length,
  };
}
