/**
 * firestoreSync.ts — Firestore ↔ store bridge
 * ─────────────────────────────────────────────
 * Handles all Firestore operations for per-user holdings.
 * The store calls these functions; components never touch Firestore directly.
 *
 * Strategy:
 *   • onSnapshot → real-time listener, updates in-memory store + localStorage cache
 *   • persistToFirestore → debounced batch write (300ms) on local mutations
 *   • loadFromFirestore → one-time load on login
 *   • On first login: if localStorage has non-demo data and Firestore is empty,
 *     migrate localStorage → Firestore automatically
 */

import {
  collection, doc, getDocs, writeBatch,
  onSnapshot, deleteDoc,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";
import { type Holding } from "./components/TerminalShared";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function holdingsCol(uid: string) {
  return collection(db, "users", uid, "holdings");
}

function holdingDoc(uid: string, id: string) {
  return doc(db, "users", uid, "holdings", id);
}

// ─── Load ─────────────────────────────────────────────────────────────────────

/**
 * One-time fetch of all holdings for the user from Firestore.
 * Returns an empty array if the user has no holdings yet.
 */
export async function loadFromFirestore(uid: string): Promise<Holding[]> {
  const snap = await getDocs(holdingsCol(uid));
  if (snap.empty) return [];
  return snap.docs.map(d => ({ ...(d.data() as Omit<Holding, "id">), id: d.id }));
}

// ─── Persist ──────────────────────────────────────────────────────────────────

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Debounced batch write — replaces entire holdings subcollection.
 * Debounce of 300ms prevents excessive writes during rapid edits.
 */
export function persistToFirestore(uid: string, holdings: Holding[]) {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(async () => {
    try {
      // Delete all existing docs then write fresh — Firestore batch max 500 ops.
      // For typical portfolio sizes (<50 holdings) this is fine.
      const existing = await getDocs(holdingsCol(uid));
      const existingIds = new Set(existing.docs.map(d => d.id));
      const incomingIds = new Set(holdings.map(h => h.id));

      const batch = writeBatch(db);

      // Delete removed holdings
      for (const d of existing.docs) {
        if (!incomingIds.has(d.id)) {
          batch.delete(holdingDoc(uid, d.id));
        }
      }

      // Upsert all current holdings
      for (const h of holdings) {
        const { id, ...data } = h;
        batch.set(holdingDoc(uid, id), data);
      }

      await batch.commit();
    } catch (err) {
      console.warn("[firestoreSync] persistToFirestore failed:", err);
    }
  }, 300);
}

// ─── Real-time listener ───────────────────────────────────────────────────────

/**
 * Subscribe to live updates from Firestore for this user's holdings.
 * Calls onUpdate(holdings) whenever Firestore data changes (from any device).
 * Returns an unsubscribe function to clean up on logout.
 */
export function subscribeToHoldings(
  uid: string,
  onUpdate: (holdings: Holding[]) => void,
): Unsubscribe {
  return onSnapshot(
    holdingsCol(uid),
    (snap) => {
      const holdings: Holding[] = snap.docs.map(d => ({
        ...(d.data() as Omit<Holding, "id">),
        id: d.id,
      }));
      onUpdate(holdings);
    },
    (err) => {
      console.warn("[firestoreSync] onSnapshot error:", err);
    },
  );
}

// ─── Migration ────────────────────────────────────────────────────────────────

/**
 * If Firestore is empty and localStorage has non-demo holdings,
 * migrate localStorage data to Firestore (one-time, on first login).
 */
export async function migrateLocalStorageToFirestore(
  uid: string,
  localHoldings: Holding[],
): Promise<boolean> {
  // Only migrate if there's real (non-demo) data
  const hasRealData = localHoldings.some(h => !h.id.startsWith("demo-"));
  if (!hasRealData) return false;

  const existing = await getDocs(holdingsCol(uid));
  if (!existing.empty) return false; // Firestore already has data, don't overwrite

  const batch = writeBatch(db);
  for (const h of localHoldings) {
    const { id, ...data } = h;
    batch.set(holdingDoc(uid, id), data);
  }
  await batch.commit();
  return true;
}
