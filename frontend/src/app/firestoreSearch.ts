import {
  collection, query, where, getDocs, orderBy, limit,
  type QueryConstraint,
} from "firebase/firestore";
import { db } from "./firebase";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface FirestoreStock {
  symbol:   string;
  name:     string;
  exchange: string;
  sector:   string;
}

export interface FirestoreMF {
  scheme_code: string;
  name:        string;
  category:    string;
  amc:         string;
  plan:        string;
  type:        string;
}

// ─── Cache ───────────────────────────────────────────────────────────────────

interface CacheEntry<T> {
  data: T[];
  ts:   number;
}

const CACHE_TTL = 5 * 60 * 1000;
const stockCache = new Map<string, CacheEntry<FirestoreStock>>();
const mfCache    = new Map<string, CacheEntry<FirestoreMF>>();

function getCached<T>(cache: Map<string, CacheEntry<T>>, key: string): T[] | null {
  const e = cache.get(key);
  if (!e) return null;
  if (Date.now() - e.ts > CACHE_TTL) { cache.delete(key); return null; }
  return e.data;
}

// ─── Stock Search ────────────────────────────────────────────────────────────

export async function searchStocksFirestore(q: string): Promise<FirestoreStock[]> {
  const key = q.toLowerCase().trim();
  if (key.length < 1) return [];

  const cached = getCached(stockCache, key);
  if (cached) return cached;

  const upper = key.toUpperCase();
  const ref = collection(db, "stocks");

  // Firestore prefix range query on search_name (lowercase name for search)
  // We search both by symbol prefix and name prefix, then merge
  const symbolConstraints: QueryConstraint[] = [
    where("symbol", ">=", upper),
    where("symbol", "<=", upper + ""),
    limit(15),
  ];

  const nameKey = key;
  const nameConstraints: QueryConstraint[] = [
    where("search_name", ">=", nameKey),
    where("search_name", "<=", nameKey + ""),
    limit(15),
  ];

  const [symbolSnap, nameSnap] = await Promise.all([
    getDocs(query(ref, ...symbolConstraints)),
    getDocs(query(ref, ...nameConstraints)),
  ]);

  const seen = new Set<string>();
  const results: FirestoreStock[] = [];

  for (const snap of [symbolSnap, nameSnap]) {
    snap.forEach(doc => {
      const d = doc.data() as FirestoreStock;
      if (!seen.has(d.symbol)) {
        seen.add(d.symbol);
        results.push(d);
      }
    });
  }

  const final = results.slice(0, 15);
  stockCache.set(key, { data: final, ts: Date.now() });
  return final;
}

// ─── Mutual Fund Search ──────────────────────────────────────────────────────

export async function searchMFFirestore(q: string): Promise<FirestoreMF[]> {
  const key = q.toLowerCase().trim();
  if (key.length < 2) return [];

  const cached = getCached(mfCache, key);
  if (cached) return cached;

  const ref = collection(db, "mutual_funds");

  // Firestore prefix range query on search_name
  const constraints: QueryConstraint[] = [
    where("search_name", ">=", key),
    where("search_name", "<=", key + ""),
    limit(20),
  ];

  const snap = await getDocs(query(ref, ...constraints));
  const results: FirestoreMF[] = [];
  snap.forEach(doc => results.push(doc.data() as FirestoreMF));

  mfCache.set(key, { data: results, ts: Date.now() });
  return results;
}
