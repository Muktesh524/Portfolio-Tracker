/**
 * HoldingsScreen.tsx — Bloomberg Terminal Holdings Manager (F2)
 * ──────────────────────────────────────────────────────────────
 * Full-featured CRUD table with:
 *   • Inline editing   — click units / avg cost / notes cells to edit in-place
 *   • Drag-and-drop    — grab the grip column to reorder rows (native HTML DnD)
 *   • localStorage     — holdings array persists across reloads
 *   • CSV import       — parse uploaded .csv, validate, merge into holdings
 *   • Export CSV       — downloads the full table as .csv
 *   • Add/Edit sidebar — slide-in panel for full field entry
 *   • Empty state      — shown when holdings list is cleared
 *   • Reset to Demo    — restores the original HOLDINGS array from TerminalShared
 */

import { useState, useEffect, useRef } from "react";
import { Plus, Download, Trash2, Search, X, Upload, GripVertical, RotateCcw, Check, RefreshCw, Loader2, PlusCircle } from "lucide-react";
import { toast } from "sonner";
import {
  TC, GRID_BG, computeHoldings,
  totalValue, totalInvested, fmtINR, fmtINR2, gainColor, gainSymbol,
  TypeBadge, ThSort, ThFixed, Td, PanelHeader, TermInput, TermBtn,
  type Holding,
} from "./TerminalShared";
import { useHoldings, useHoldingActions } from "../store";
import {
  fetchPortfolioSnapshot, checkBackendHealth,
  fetchMFNavDetail,
  fetchStockPrice,
} from "../api";
import {
  searchStocksFirestore, searchMFFirestore,
  type FirestoreStock, type FirestoreMF,
} from "../firestoreSearch";

// ─── Constants ────────────────────────────────────────────────────────────────

const BLANK: Omit<Holding, "id"> = {
  type: "MF", name: "", shortName: "", identifier: "",
  units: 0, avgCost: 0, currentNav: 0, sector: "", invested: 0, notes: "",
};

type AddMode = "new" | "topup";
type InputMode = "units" | "amount";

type SortKey = "name" | "currentValue" | "gainLoss" | "gainLossPct" | "invested";

// ─── CSV parser ───────────────────────────────────────────────────────────────

interface CsvResult {
  holdings: Omit<Holding, "id">[];
  errors:   string[];
  skipped:  number;
}

function parseCsv(text: string, existingIds: Set<string>): CsvResult {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length < 2) return { holdings: [], errors: ["File has no data rows"], skipped: 0 };

  const headerLine = lines[0].toLowerCase().replace(/[^a-z,]/g, "");
  const headers = headerLine.split(",");

  // Validate that at least type, name, identifier exist
  const hasType = headers.includes("type");
  const hasName = headers.includes("name");
  const hasId   = headers.includes("identifier");
  if (!hasName || !hasId) {
    return { holdings: [], errors: ["CSV must have at least 'Name' and 'Identifier' columns"], skipped: 0 };
  }

  const results: Omit<Holding, "id">[] = [];
  const errors:  string[] = [];
  let   skipped = 0;

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map(c => c.trim().replace(/^["']|["']$/g, ""));
    if (cols.length < 2) { errors.push(`Row ${i + 1}: too few columns`); continue; }

    const get = (key: string) => {
      const idx = headers.indexOf(key);
      return idx >= 0 && idx < cols.length ? cols[idx] : "";
    };

    const identifier = get("identifier");
    if (!identifier) { errors.push(`Row ${i + 1}: missing identifier`); continue; }

    // Skip duplicates
    if (existingIds.has(identifier.toUpperCase())) { skipped++; continue; }

    const typeRaw = get("type").toUpperCase();
    const type: "MF" | "Stock" = typeRaw === "STOCK" ? "Stock" : "MF";
    const name      = get("name") || identifier;
    const units     = parseFloat(get("units"))      || 0;
    const avgCost   = parseFloat(get("avgcost"))     || 0;
    const currentNav= parseFloat(get("currentnav"))  || 0;
    const sector    = get("sector")                   || "Unknown";
    const invested  = parseFloat(get("invested"))     || (units * avgCost);
    const notes     = get("notes")                    || "";

    results.push({
      type, name, shortName: name.slice(0, 20), identifier,
      units, avgCost, currentNav, sector, invested, notes,
    });
  }

  return { holdings: results, errors, skipped };
}

// ─── Inline-edit cell wrapper ─────────────────────────────────────────────────

function InlineEditCell({
  value,
  type = "text",
  onSave,
  style,
  formatDisplay,
}: {
  value:          string | number;
  type?:          "text" | "number";
  onSave:         (v: string) => void;
  style?:         React.CSSProperties;
  formatDisplay?: (v: string | number) => string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState(String(value));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      setDraft(String(value));
      setTimeout(() => inputRef.current?.select(), 0);
    }
  }, [editing, value]);

  function commit() {
    setEditing(false);
    if (draft !== String(value)) onSave(draft);
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type={type}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === "Enter")  commit();
          if (e.key === "Escape") setEditing(false);
        }}
        style={{
          background:   TC.bg0,
          border:       `1px solid ${TC.green}66`,
          color:        TC.text,
          padding:      '2px 5px',
          borderRadius: '1px',
          fontSize:     '11px',
          fontFamily:   TC.font,
          outline:      'none',
          width:        '100%',
          textAlign:    'right',
          ...style,
        }}
      />
    );
  }

  return (
    <span
      onClick={e => { e.stopPropagation(); setEditing(true); }}
      title="Click to edit"
      style={{
        cursor:       'pointer',
        borderBottom: `1px dashed ${TC.border}`,
        padding:      '0 1px',
        transition:   'border-color 80ms',
        ...style,
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLSpanElement).style.borderBottomColor = TC.green + '66'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLSpanElement).style.borderBottomColor = TC.border; }}
    >
      {formatDisplay ? formatDisplay(value) : String(value)}
    </span>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ onAdd, onReset, onImport }: {
  onAdd:    () => void;
  onReset:  () => void;
  onImport: () => void;
}) {
  return (
    <div style={{
      flex: 1,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: '16px',
      padding: '40px',
    }}>
      <div style={{ color: TC.text5, fontSize: '40px', lineHeight: 1 }}>⊘</div>
      <div style={{ color: TC.text3, fontSize: '13px', letterSpacing: '0.06em' }}>
        NO HOLDINGS IN PORTFOLIO
      </div>
      <div style={{ color: TC.text5, fontSize: '10px', maxWidth: '340px', textAlign: 'center', lineHeight: 1.6 }}>
        Add instruments manually, import from a CSV file, or restore the demo dataset to get started.
      </div>
      <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
        <TermBtn variant="primary" onClick={onAdd}>
          <Plus style={{ width: 11, height: 11 }} /> ADD HOLDING
        </TermBtn>
        <TermBtn variant="ghost" onClick={onImport}>
          <Upload style={{ width: 11, height: 11 }} /> IMPORT CSV
        </TermBtn>
        <TermBtn variant="ghost" onClick={onReset}>
          <RotateCcw style={{ width: 11, height: 11 }} /> DEMO DATA
        </TermBtn>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function HoldingsScreen() {
  const holdings = useHoldings();
  const actions  = useHoldingActions();
  const [form,     setForm]        = useState<Omit<Holding, "id">>({ ...BLANK });
  const [showForm, setShowForm]    = useState(false);
  const [editId,   setEditId]      = useState<string | null>(null);
  const [search,   setSearch]      = useState("");
  const [sortKey,  setSortKey]     = useState<SortKey>("currentValue");
  const [sortDir,  setSortDir]     = useState<"asc" | "desc">("desc");
  const [importing, setImporting]  = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const fileRef                     = useRef<HTMLInputElement>(null);

  // MF search state
  const [mfQuery,       setMfQuery]       = useState("");
  const [mfResults,     setMfResults]     = useState<FirestoreMF[]>([]);
  const [mfSearching,   setMfSearching]   = useState(false);
  const [mfSearchDone,  setMfSearchDone]  = useState(false);
  const [fetchingNav,   setFetchingNav]   = useState(false);
  const [addMode,       setAddMode]       = useState<AddMode>("new");
  const [topupTarget,   setTopupTarget]   = useState<Holding | null>(null);
  const [topupUnits,    setTopupUnits]    = useState(0);
  const [topupCost,     setTopupCost]     = useState(0);
  const mfSearchTimer                     = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Stock search state
  const [stQuery,       setStQuery]       = useState("");
  const [stResults,     setStResults]     = useState<FirestoreStock[]>([]);
  const [stSearching,   setStSearching]   = useState(false);
  const [stSearchDone,  setStSearchDone]  = useState(false);
  const [fetchingPrice, setFetchingPrice] = useState(false);
  const stSearchTimer                     = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Amount/Units input mode
  const [inputMode,     setInputMode]     = useState<InputMode>("units");
  const [amountValue,   setAmountValue]   = useState(0);
  const [manualEntry,   setManualEntry]   = useState(false);

  // Validation state — tracks which fields the user has interacted with
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Drag-and-drop state
  const [dragIdx,  setDragIdx]  = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  const computed = computeHoldings(holdings);
  const totVal   = totalValue(computed);
  const totInv   = totalInvested(computed);
  const totGain  = totVal - totInv;

  const filtered = computed.filter(h =>
    h.name.toLowerCase().includes(search.toLowerCase()) ||
    h.identifier.toLowerCase().includes(search.toLowerCase()) ||
    h.sector.toLowerCase().includes(search.toLowerCase())
  );

  const sorted = [...filtered].sort((a, b) => {
    const av = a[sortKey] as number | string;
    const bv = b[sortKey] as number | string;
    if (typeof av === "string") return sortDir === "asc" ? av.localeCompare(bv as string) : (bv as string).localeCompare(av);
    return sortDir === "asc" ? (av as number) - (bv as number) : (bv as number) - (av as number);
  });

  function handleSort(k: string) {
    if (sortKey === (k as SortKey)) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(k as SortKey); setSortDir("desc"); }
  }

  // ── CRUD ────────────────────────────────────────────────────────────────────

  function handleAdd() {
    if (!form.name || !form.identifier) { toast.error("Name and Identifier required"); return; }
    if (editId !== null) {
      actions.update(editId, form);
      toast.success("Holding updated");
      setEditId(null);
    } else {
      actions.add(form);
      toast.success("Holding added");
    }
    setForm({ ...BLANK });
    setShowForm(false);
  }

  function handleEdit(h: Holding) {
    const { id, ...rest } = h;
    setForm({ ...rest });
    setEditId(id);
    setShowForm(true);
  }

  function handleDelete(id: string) {
    actions.remove(id);
    toast("Holding removed");
  }

  // ── Inline field update ─────────────────────────────────────────────────────

  function updateField(id: string, field: keyof Holding, raw: string) {
    const h = holdings.find(x => x.id === id);
    if (!h) return;
    const numVal = parseFloat(raw);
    if (field === "units" || field === "avgCost") {
      const updated = { [field]: isNaN(numVal) ? 0 : numVal } as Partial<Holding>;
      const newUnits = field === "units" ? (isNaN(numVal) ? 0 : numVal) : h.units;
      const newCost  = field === "avgCost" ? (isNaN(numVal) ? 0 : numVal) : h.avgCost;
      updated.invested = newUnits * newCost;
      actions.update(id, updated);
    } else if (field === "notes") {
      actions.update(id, { notes: raw });
    }
  }

  // ── Drag-and-drop ───────────────────────────────────────────────────────────

  function handleDragStart(e: React.DragEvent, idx: number) {
    setDragIdx(idx);
    e.dataTransfer.effectAllowed = "move";
    // Transparent drag image — the visual feedback is the highlighted drop target
    const img = new Image();
    img.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
    e.dataTransfer.setDragImage(img, 0, 0);
  }

  function handleDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOver(idx);
  }

  function handleDrop(e: React.DragEvent, dropIdx: number) {
    e.preventDefault();
    if (dragIdx === null || dragIdx === dropIdx) { setDragIdx(null); setDragOver(null); return; }

    // Reorder on the *raw* holdings array (not the sorted/filtered view)
    // Map sorted indices back to raw indices
    const dragId = sorted[dragIdx]?.id;
    const dropId = sorted[dropIdx]?.id;
    if (!dragId || !dropId) { setDragIdx(null); setDragOver(null); return; }

    const arr   = [...holdings];
    const fromI = arr.findIndex(h => h.id === dragId);
    const toI   = arr.findIndex(h => h.id === dropId);
    if (fromI >= 0 && toI >= 0) {
      const [moved] = arr.splice(fromI, 1);
      arr.splice(toI, 0, moved);
      actions.set(arr);
    }

    setDragIdx(null);
    setDragOver(null);
  }

  function handleDragEnd() { setDragIdx(null); setDragOver(null); }

  // ── CSV import ──────────────────────────────────────────────────────────────

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    toast("Parsing CSV…", { description: file.name });

    // Small delay so the toast renders before sync parsing
    await new Promise(r => setTimeout(r, 300));

    try {
      const text = await file.text();
      const existingIds = new Set(holdings.map(h => h.identifier.toUpperCase()));
      const { holdings: imported, errors, skipped } = parseCsv(text, existingIds);

      if (errors.length > 0) {
        toast.error(`${errors.length} row error(s)`, {
          description: errors.slice(0, 3).join("; ") + (errors.length > 3 ? ` … and ${errors.length - 3} more` : ""),
        });
      }

      if (imported.length > 0) {
        const withIds = imported.map((h) => ({ ...h, id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}` }));
        actions.set([...holdings, ...withIds]);
        toast.success(`Imported ${imported.length} holding(s)`, {
          description: skipped > 0 ? `${skipped} duplicate(s) skipped` : undefined,
        });
      } else if (errors.length === 0) {
        toast("No new holdings to import", {
          description: skipped > 0 ? `${skipped} duplicate(s) skipped` : "File was empty or all rows invalid",
        });
      }
    } catch (err) {
      toast.error("Failed to read CSV", { description: String(err) });
    }

    setImporting(false);
    // Reset file input so the same file can be re-imported
    if (fileRef.current) fileRef.current.value = "";
  }

  // ── Export ──────────────────────────────────────────────────────────────────

  function handleExport() {
    const rows = [
      ["Type", "Name", "Identifier", "Units", "AvgCost", "CurrentNav", "Invested", "CurrentValue", "GainLoss", "GainLossPct", "Sector", "Notes"],
      ...computed.map(h => [
        h.type, `"${h.name}"`, h.identifier,
        h.units, h.avgCost, h.currentNav, h.invested,
        h.currentValue.toFixed(2), h.gainLoss.toFixed(2), h.gainLossPct.toFixed(2),
        h.sector, `"${h.notes}"`,
      ]),
    ];
    const csv  = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a    = document.createElement("a");
    a.href     = URL.createObjectURL(blob);
    a.download = "muktesh-portfolio.csv";
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success("Exported portfolio.csv");
  }

  // ── Reset ───────────────────────────────────────────────────────────────────

  function handleReset() {
    actions.reset();
    toast.success("Restored demo data", { description: "13 holdings loaded" });
  }

  function handleClear() {
    actions.clear();
    toast("Holdings cleared");
  }

  // ── MF search (debounced) ──────────────────────────────────────────────────

  function handleMfSearch(q: string) {
    setMfQuery(q);
    setMfSearchDone(false);
    if (mfSearchTimer.current) clearTimeout(mfSearchTimer.current);
    if (q.length < 2) { setMfResults([]); setMfSearchDone(false); return; }
    setMfSearching(true);
    mfSearchTimer.current = setTimeout(async () => {
      try {
        const results = await searchMFFirestore(q);
        setMfResults(results);
      } catch {
        setMfResults([]);
      }
      setMfSearching(false);
      setMfSearchDone(true);
    }, 350);
  }

  async function handleSelectMF(result: FirestoreMF) {
    setMfResults([]);
    setMfQuery("");
    setMfSearchDone(false);
    setFetchingNav(true);
    const detail = await fetchMFNavDetail(result.scheme_code);
    setFetchingNav(false);

    const cleanName = result.name
      .replace(/\s*-\s*Direct Plan\s*/i, "")
      .replace(/\s*-\s*Growth\s*/i, "")
      .replace(/\s*-\s*IDCW\s*/i, "")
      .trim();

    const nav = detail?.nav ?? 0;
    setForm(f => ({
      ...f,
      type: "MF",
      name: cleanName,
      shortName: cleanName.slice(0, 20),
      identifier: result.scheme_code,
      currentNav: nav,
      avgCost: nav,
      sector: detail?.category || result.category || "",
    }));
    setInputMode("amount");
    setAmountValue(0);
    toast.success(`Selected: ${result.scheme_code}`, {
      description: detail ? `NAV ₹${detail.nav} as of ${detail.date}` : "NAV lookup failed — enter manually",
    });
  }

  // ── Stock search (debounced) ──────────────────────────────────────────────

  function handleStSearch(q: string) {
    setStQuery(q);
    setStSearchDone(false);
    if (stSearchTimer.current) clearTimeout(stSearchTimer.current);
    if (q.length < 1) { setStResults([]); setStSearchDone(false); return; }
    setStSearching(true);
    stSearchTimer.current = setTimeout(async () => {
      try {
        const results = await searchStocksFirestore(q);
        setStResults(results);
      } catch {
        setStResults([]);
      }
      setStSearching(false);
      setStSearchDone(true);
    }, 300);
  }

  async function handleSelectStock(result: FirestoreStock) {
    setStResults([]);
    setStQuery("");
    setStSearchDone(false);
    setFetchingPrice(true);
    const ticker = result.symbol.endsWith(".NS") || result.symbol.endsWith(".BO") ? result.symbol : result.symbol + ".NS";
    const price = await fetchStockPrice(ticker);
    setFetchingPrice(false);

    const cmp = price ?? 0;
    setForm(f => ({
      ...f,
      type: "Stock",
      name: result.name,
      shortName: result.symbol.replace(".NS", ""),
      identifier: ticker,
      currentNav: cmp,
      avgCost: cmp,
      sector: result.sector,
    }));
    setInputMode("units");
    setAmountValue(0);
    toast.success(`Selected: ${ticker}`, {
      description: price ? `CMP ₹${price.toFixed(2)}` : "Price lookup failed — enter manually",
    });
  }

  // ── Top-up (add units to existing) ─────────────────────────────────────────

  function handleStartTopup(h: Holding) {
    setAddMode("topup");
    setTopupTarget(h);
    setTopupUnits(0);
    setTopupCost(h.currentNav);
    setShowForm(true);
    setEditId(null);
    setInputMode(h.type === "MF" ? "amount" : "units");
    setAmountValue(0);
  }

  function handleTopupSubmit() {
    if (!topupTarget || topupUnits <= 0) {
      toast.error("Enter units to add");
      return;
    }
    const h = topupTarget;
    const newTotalUnits = h.units + topupUnits;
    const newTotalInvested = h.invested + (topupUnits * topupCost);
    const newAvgCost = newTotalInvested / newTotalUnits;

    actions.update(h.id, {
      units: parseFloat(newTotalUnits.toFixed(4)),
      avgCost: parseFloat(newAvgCost.toFixed(4)),
      invested: parseFloat(newTotalInvested.toFixed(2)),
    });
    toast.success("Units added (SIP top-up)", {
      description: `+${topupUnits} units @ ₹${topupCost.toFixed(2)} → ${newTotalUnits.toFixed(3)} total`,
    });
    setTopupTarget(null);
    setTopupUnits(0);
    setTopupCost(0);
    setShowForm(false);
    setAddMode("new");
  }

  // ── Refresh prices from backend ──────────────────────────────────────────────

  async function handleRefreshPrices() {
    setRefreshing(true);
    try {
      const isHealthy = await checkBackendHealth();
      if (!isHealthy) {
        toast.error("Backend unavailable", { description: "Is http://localhost:8000 running?" });
        setRefreshing(false);
        return;
      }

      // Separate MF and stock identifiers
      const mfIsins = holdings.filter(h => h.type === "MF").map(h => h.identifier);
      const stocks = holdings.filter(h => h.type === "Stock").map(h => h.identifier);

      // Fetch all prices at once
      const snapshot = await fetchPortfolioSnapshot(mfIsins, stocks);

      // Check for errors
      if (Object.keys(snapshot.errors).length > 0) {
        const errorList = Object.entries(snapshot.errors)
          .filter(([k]) => k !== "_global")
          .map(([k, v]) => `${k}: ${v}`)
          .slice(0, 3)
          .join(", ");
        toast.warning("Some prices failed to fetch", { description: errorList || "See console for details" });
      }

      // Update holdings with new prices
      let updatedCount = 0;
      holdings.forEach(h => {
        let newNav: number | null = null;

        if (h.type === "MF" && snapshot.mf_navs[h.identifier]) {
          newNav = snapshot.mf_navs[h.identifier];
        } else if (h.type === "Stock" && snapshot.stock_prices[h.identifier]) {
          newNav = snapshot.stock_prices[h.identifier];
        }

        if (newNav !== null && newNav !== h.currentNav) {
          actions.update(h.id, { currentNav: newNav });
          updatedCount++;
        }
      });

      toast.success(`Prices refreshed`, {
        description: `${updatedCount} of ${holdings.length} holdings updated`,
      });
    } catch (error) {
      toast.error("Failed to refresh prices", { description: String(error) });
    } finally {
      setRefreshing(false);
    }
  }

  // ── Validation ──────────────────────────────────────────────────────────────

  function touch(field: string) {
    setTouched(t => ({ ...t, [field]: true }));
  }

  function getErrors(): Record<string, string> {
    const e: Record<string, string> = {};
    if (manualEntry) {
      if (!form.name.trim()) e.name = "Name is required";
      if (!form.identifier.trim()) e.identifier = form.type === "MF" ? "Scheme code is required" : "Ticker is required";
      if (form.units <= 0) e.units = "Units must be greater than 0";
      if (form.avgCost <= 0) e.avgCost = "Avg cost must be greater than 0";
    } else {
      if (!form.identifier) e.identifier = form.type === "MF" ? "Select a fund from search" : "Select a stock from search";
      if (inputMode === "amount") {
        if (amountValue <= 0) e.amount = "Enter an amount greater than 0";
      } else {
        if (form.units <= 0) e.units = form.type === "Stock" ? "Enter quantity (at least 1)" : "Enter units greater than 0";
      }
    }
    return e;
  }

  const errors = addMode === "new" && editId === null ? getErrors() : {};
  const isFormValid = Object.keys(errors).length === 0;

  function getTopupErrors(): Record<string, string> {
    const e: Record<string, string> = {};
    if (inputMode === "amount") {
      if (amountValue <= 0) e.amount = "Enter an amount greater than 0";
    } else {
      if (topupUnits <= 0) e.units = "Enter units greater than 0";
    }
    if (topupCost <= 0) e.cost = "Purchase price must be greater than 0";
    return e;
  }

  const topupErrors = addMode === "topup" ? getTopupErrors() : {};
  const isTopupValid = Object.keys(topupErrors).length === 0;

  const errorStyle: React.CSSProperties = {
    color: TC.red, fontSize: '9px', fontFamily: TC.font,
    marginTop: '3px', letterSpacing: '0.04em',
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  const labelStyle: React.CSSProperties = {
    color: TC.text4, fontSize: '9px', letterSpacing: '0.12em',
    fontFamily: TC.font, display: 'block', marginBottom: '3px',
  };

  return (
    <div className="flex h-full overflow-hidden" style={{ fontFamily: TC.font, background: TC.bg0, ...GRID_BG }}>

      {/* Hidden file input for CSV import */}
      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        style={{ display: 'none' }}
        onChange={handleImport}
      />

      {/* ── Main table area ──────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <PanelHeader
          title={`HOLDINGS MANAGER — ${holdings.length} INSTRUMENTS`}
          right={
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              {/* Search */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                background: TC.bg0, border: `1px solid ${TC.border}`,
                padding: '3px 8px', borderRadius: '1px',
              }}>
                <Search style={{ color: TC.text4, width: 12, height: 12 }} />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="FILTER…"
                  style={{
                    background: 'transparent', border: 'none', color: TC.text,
                    fontSize: '10px', outline: 'none', width: '140px', fontFamily: TC.font,
                  }}
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: TC.text5, padding: 0 }}
                  >
                    <X style={{ width: 10, height: 10 }} />
                  </button>
                )}
              </div>

              <TermBtn variant="ghost" onClick={() => fileRef.current?.click()} disabled={importing}>
                <Upload style={{ width: 11, height: 11 }} />
                {importing ? "IMPORTING…" : "IMPORT CSV"}
              </TermBtn>
              <TermBtn variant="ghost" onClick={handleExport}>
                <Download style={{ width: 11, height: 11 }} /> EXPORT
              </TermBtn>
              <TermBtn variant="ghost" onClick={handleRefreshPrices} disabled={refreshing}>
                <RefreshCw style={{ width: 11, height: 11, animation: refreshing ? "spin 1s linear infinite" : "none" }} />
                {refreshing ? "REFRESHING…" : "REFRESH PRICES"}
              </TermBtn>
              <TermBtn variant="ghost" onClick={handleReset}>
                <RotateCcw style={{ width: 11, height: 11 }} /> RESET DEMO
              </TermBtn>
              <TermBtn variant="danger" onClick={handleClear}>
                <Trash2 style={{ width: 11, height: 11 }} /> CLEAR
              </TermBtn>
              <TermBtn variant="primary" onClick={() => { setShowForm(true); setEditId(null); setForm({ ...BLANK }); setAddMode("new"); setTopupTarget(null); setMfQuery(""); setMfResults([]); setMfSearchDone(false); setStQuery(""); setStResults([]); setStSearchDone(false); setInputMode("units"); setAmountValue(0); setManualEntry(false); setTouched({}); }}>
                <Plus style={{ width: 11, height: 11 }} /> ADD
              </TermBtn>
            </div>
          }
        />

        {/* ── Empty state or Table ───────────────────────────────── */}
        {holdings.length === 0 ? (
          <EmptyState
            onAdd={() => { setShowForm(true); setEditId(null); setForm({ ...BLANK }); setAddMode("new"); setTopupTarget(null); }}
            onReset={handleReset}
            onImport={() => fileRef.current?.click()}
          />
        ) : (
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {/* Drag grip column */}
                  <ThFixed label="" />
                  <ThFixed label="TYPE" />
                  <ThSort label="NAME"      sortKey="name"         activeSortKey={sortKey} dir={sortDir} onSort={handleSort} align="left" />
                  <ThFixed label="CODE" />
                  <ThFixed label="UNITS ✎" />
                  <ThFixed label="AVG ₹ ✎" />
                  <ThFixed label="NAV/CMP ₹" />
                  <ThSort label="VALUE ₹"   sortKey="currentValue" activeSortKey={sortKey} dir={sortDir} onSort={handleSort} />
                  <ThSort label="GAIN ₹"    sortKey="gainLoss"     activeSortKey={sortKey} dir={sortDir} onSort={handleSort} />
                  <ThSort label="G/L %"     sortKey="gainLossPct"  activeSortKey={sortKey} dir={sortDir} onSort={handleSort} />
                  <ThFixed label="SECTOR" />
                  <ThFixed label="NOTES ✎" />
                  <ThFixed label="" />
                </tr>
              </thead>
              <tbody>
                {sorted.map((h, i) => {
                  const gc = gainColor(h.gainLoss);
                  const isDragTarget = dragOver === i && dragIdx !== i;
                  return (
                    <tr
                      key={h.id}
                      draggable
                      onDragStart={e => handleDragStart(e, i)}
                      onDragOver={e => handleDragOver(e, i)}
                      onDrop={e => handleDrop(e, i)}
                      onDragEnd={handleDragEnd}
                      style={{
                        background:   dragIdx === i
                          ? TC.bg3
                          : isDragTarget
                            ? '#0D1A14'
                            : i % 2 === 0 ? TC.bg0 : TC.bg1,
                        borderBottom: `1px solid ${TC.border2}`,
                        borderTop:    isDragTarget ? `2px solid ${TC.green}` : '2px solid transparent',
                        borderLeft:   dragIdx === i ? `2px solid ${TC.amber}` : '2px solid transparent',
                        transition:   'background 80ms',
                        cursor:       'default',
                        opacity:      dragIdx === i ? 0.6 : 1,
                      }}
                    >
                      {/* Drag grip */}
                      <td style={{
                        padding: '5px 4px', textAlign: 'center',
                        cursor: 'grab', color: TC.text5,
                        fontFamily: TC.font,
                      }}>
                        <GripVertical style={{ width: 12, height: 12 }} />
                      </td>

                      <Td align="center"><TypeBadge type={h.type} /></Td>

                      <Td
                        align="left"
                        style={{
                          color: TC.text, maxWidth: '200px', overflow: 'hidden',
                          textOverflow: 'ellipsis', cursor: 'pointer',
                        }}
                      >
                        <span onClick={e => { e.stopPropagation(); handleEdit(h); }}
                              title="Click to edit full details"
                              style={{ borderBottom: `1px dashed ${TC.border}` }}>
                          {h.name}
                        </span>
                      </Td>

                      <Td style={{ color: TC.text4, fontSize: '10px' }}>{h.identifier}</Td>

                      {/* Inline-editable: units */}
                      <Td>
                        <InlineEditCell
                          value={h.units}
                          type="number"
                          style={{ color: TC.text3 }}
                          formatDisplay={v => Number(v).toFixed(h.type === 'Stock' ? 0 : 3)}
                          onSave={v => updateField(h.id, "units", v)}
                        />
                      </Td>

                      {/* Inline-editable: avg cost */}
                      <Td>
                        <InlineEditCell
                          value={h.avgCost}
                          type="number"
                          style={{ color: TC.text3 }}
                          formatDisplay={v => fmtINR2(Number(v))}
                          onSave={v => updateField(h.id, "avgCost", v)}
                        />
                      </Td>

                      <Td style={{ color: TC.text }}>{fmtINR2(h.currentNav)}</Td>
                      <Td style={{ color: TC.text }}>{fmtINR(h.currentValue)}</Td>

                      <Td>
                        <span style={{ color: gc, fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          <span style={{ fontSize: '9px' }}>{gainSymbol(h.gainLoss)}</span>
                          {fmtINR2(Math.abs(h.gainLoss))}
                        </span>
                      </Td>

                      <Td>
                        <span style={{
                          color: gc, fontSize: '11px',
                          background: gc + '14', padding: '1px 5px', borderRadius: '1px',
                        }}>
                          {gainSymbol(h.gainLoss)} {Math.abs(h.gainLossPct).toFixed(2)}%
                        </span>
                      </Td>

                      <Td style={{ color: TC.text4, fontSize: '10px' }}>{h.sector}</Td>

                      {/* Inline-editable: notes */}
                      <Td style={{ maxWidth: '120px' }}>
                        <InlineEditCell
                          value={h.notes}
                          type="text"
                          style={{
                            color: h.notes ? TC.text5 : TC.border,
                            fontSize: '10px', textAlign: 'left',
                            overflow: 'hidden', textOverflow: 'ellipsis',
                            maxWidth: '110px', display: 'inline-block',
                          }}
                          formatDisplay={v => String(v) || "—"}
                          onSave={v => updateField(h.id, "notes", v)}
                        />
                      </Td>

                      {/* Top-up + Delete */}
                      <Td>
                        <div style={{ display: 'flex', gap: '2px', justifyContent: 'center' }}>
                          <button
                            onClick={e => { e.stopPropagation(); handleStartTopup(h); }}
                            title="Add units (SIP top-up)"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: TC.text5, padding: '2px 4px' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = TC.green; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = TC.text5; }}
                          >
                            <PlusCircle style={{ width: 12, height: 12 }} />
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); handleDelete(h.id); }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: TC.text5, padding: '2px 4px' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = TC.red; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = TC.text5; }}
                          >
                            <X style={{ width: 12, height: 12 }} />
                          </button>
                        </div>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>

              {/* ── Totals footer ────────────────────────────────── */}
              <tfoot>
                <tr style={{
                  background: TC.bg2, borderTop: `1px solid ${TC.border}`,
                  position: 'sticky', bottom: 0,
                }}>
                  <td colSpan={7} style={{
                    padding: '5px 10px', color: TC.text4, fontSize: '9px',
                    letterSpacing: '0.12em', fontFamily: TC.font, textAlign: 'right',
                  }}>
                    TOTALS ({sorted.length} shown)
                  </td>
                  <td style={{
                    padding: '5px 10px', color: TC.text, fontSize: '11px',
                    fontFamily: TC.font, textAlign: 'right',
                  }}>
                    {fmtINR(totVal)}
                  </td>
                  <td style={{ padding: '5px 10px', fontFamily: TC.font, textAlign: 'right' }}>
                    <span style={{
                      color: gainColor(totGain), fontSize: '11px',
                      display: 'inline-flex', alignItems: 'center', gap: '3px',
                    }}>
                      <span style={{ fontSize: '9px' }}>{gainSymbol(totGain)}</span>
                      {fmtINR2(Math.abs(totGain))}
                    </span>
                  </td>
                  <td colSpan={4} style={{
                    padding: '5px 10px', color: gainColor(totGain), fontSize: '11px',
                    fontFamily: TC.font, textAlign: 'right',
                  }}>
                    {totInv > 0 ? `${gainSymbol(totGain)} ${Math.abs((totGain / totInv) * 100).toFixed(2)}%` : "—"}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* ── Add / Edit / Top-Up Side Panel ────────────────────────── */}
      {showForm && (
        <div style={{
          width: '320px', flexShrink: 0,
          borderLeft: `1px solid ${TC.border}`,
          background: TC.bg1,
          display: 'flex', flexDirection: 'column',
          animation: 'fadeIn 120ms ease-out',
        }}>
          <PanelHeader
            title={
              addMode === "topup" ? "ADD UNITS (SIP TOP-UP)"
                : editId !== null ? "EDIT HOLDING"
                : "ADD NEW HOLDING"
            }
            right={
              <button
                onClick={() => { setShowForm(false); setAddMode("new"); setTopupTarget(null); setMfQuery(""); setMfResults([]); setMfSearchDone(false); setStQuery(""); setStResults([]); setStSearchDone(false); setManualEntry(false); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: TC.text4 }}
              >
                <X style={{ width: 14, height: 14 }} />
              </button>
            }
          />

          {/* ── TOP-UP MODE ─────────────────────────────────── */}
          {addMode === "topup" && topupTarget && (
            <div style={{
              flex: 1, overflowY: 'auto', padding: '12px',
              display: 'flex', flexDirection: 'column', gap: '10px',
            }}>
              {/* Target holding info */}
              <div style={{
                padding: '10px', background: TC.bg0,
                border: `1px solid ${TC.green}33`, borderRadius: '1px',
              }}>
                <div style={{ color: TC.text4, fontSize: '9px', letterSpacing: '0.12em', marginBottom: '6px' }}>
                  EXISTING POSITION
                </div>
                <div style={{ color: TC.text, fontSize: '11px', marginBottom: '3px' }}>
                  {topupTarget.name}
                </div>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <span style={{ color: TC.text4, fontSize: '10px' }}>
                    <TypeBadge type={topupTarget.type} /> {topupTarget.identifier}
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginTop: '8px' }}>
                  <div>
                    <span style={{ color: TC.text5, fontSize: '9px' }}>CURRENT UNITS</span>
                    <div style={{ color: TC.text, fontSize: '12px' }}>{topupTarget.units.toFixed(3)}</div>
                  </div>
                  <div>
                    <span style={{ color: TC.text5, fontSize: '9px' }}>AVG COST</span>
                    <div style={{ color: TC.text, fontSize: '12px' }}>₹{topupTarget.avgCost.toFixed(2)}</div>
                  </div>
                  <div>
                    <span style={{ color: TC.text5, fontSize: '9px' }}>INVESTED</span>
                    <div style={{ color: TC.text, fontSize: '12px' }}>{fmtINR2(topupTarget.invested)}</div>
                  </div>
                  <div>
                    <span style={{ color: TC.text5, fontSize: '9px' }}>CURR NAV</span>
                    <div style={{ color: TC.green, fontSize: '12px' }}>₹{topupTarget.currentNav.toFixed(2)}</div>
                  </div>
                </div>
              </div>

              {/* Amount / Units toggle for top-up */}
              <div>
                <label style={labelStyle}>HOW WOULD YOU LIKE TO ENTER?</label>
                <div style={{ display: 'flex', gap: '0' }}>
                  <button
                    onClick={() => setInputMode("amount")}
                    style={{
                      flex: 1, padding: '7px 8px', fontSize: '10px', fontFamily: TC.font,
                      background: inputMode === "amount" ? TC.green + '18' : TC.bg0,
                      border: `1px solid ${inputMode === "amount" ? TC.green + '66' : TC.border}`,
                      borderRight: 'none',
                      color: inputMode === "amount" ? TC.green : TC.text4,
                      cursor: 'pointer', letterSpacing: '0.08em', transition: 'all 120ms',
                    }}
                  >
                    ENTER AMOUNT ₹
                  </button>
                  <button
                    onClick={() => setInputMode("units")}
                    style={{
                      flex: 1, padding: '7px 8px', fontSize: '10px', fontFamily: TC.font,
                      background: inputMode === "units" ? TC.green + '18' : TC.bg0,
                      border: `1px solid ${inputMode === "units" ? TC.green + '66' : TC.border}`,
                      color: inputMode === "units" ? TC.green : TC.text4,
                      cursor: 'pointer', letterSpacing: '0.08em', transition: 'all 120ms',
                    }}
                  >
                    ENTER UNITS
                  </button>
                </div>
              </div>

              {/* Amount mode for top-up */}
              {inputMode === "amount" && (
                <div>
                  <label style={labelStyle}>SIP AMOUNT ₹</label>
                  <TermInput
                    type="number"
                    value={amountValue || ""}
                    onChange={v => {
                      touch("topup_amount");
                      const amt = parseFloat(v) || 0;
                      setAmountValue(amt);
                      if (topupCost > 0 && amt > 0) {
                        setTopupUnits(parseFloat((amt / topupCost).toFixed(4)));
                      }
                    }}
                    placeholder="e.g. 5000"
                    style={touched.topup_amount && topupErrors.amount ? { borderColor: TC.red } : undefined}
                  />
                  {touched.topup_amount && topupErrors.amount && (
                    <div style={errorStyle}>{topupErrors.amount}</div>
                  )}
                  {amountValue > 0 && topupCost > 0 && (
                    <div style={{
                      marginTop: '6px', padding: '10px',
                      background: '#001A0A', border: `1px solid ${TC.green}22`, borderRadius: '1px',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: TC.text4, fontSize: '9px', letterSpacing: '0.08em' }}>UNITS YOU'LL GET</span>
                        <span style={{ color: TC.green, fontSize: '15px', fontWeight: 600, fontFamily: TC.font }}>
                          {(amountValue / topupCost).toFixed(4)}
                        </span>
                      </div>
                      <div style={{ color: TC.text5, fontSize: '9px', marginTop: '4px' }}>
                        ₹{amountValue.toLocaleString("en-IN")} ÷ ₹{topupCost.toFixed(2)} = {(amountValue / topupCost).toFixed(4)} units
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Units mode for top-up */}
              {inputMode === "units" && (
                <div>
                  <label style={labelStyle}>NEW UNITS TO ADD</label>
                  <TermInput
                    type="number"
                    value={topupUnits || ""}
                    onChange={v => {
                      touch("topup_units");
                      const u = parseFloat(v) || 0;
                      setTopupUnits(u);
                      setAmountValue(u * topupCost);
                    }}
                    placeholder="e.g. 5.123"
                    style={touched.topup_units && topupErrors.units ? { borderColor: TC.red } : undefined}
                  />
                  {touched.topup_units && topupErrors.units && (
                    <div style={errorStyle}>{topupErrors.units}</div>
                  )}
                </div>
              )}

              <div>
                <label style={labelStyle}>PURCHASE PRICE PER UNIT ₹</label>
                <TermInput
                  type="number"
                  value={topupCost || ""}
                  onChange={v => {
                    touch("topup_cost");
                    const cost = parseFloat(v) || 0;
                    setTopupCost(cost);
                    if (inputMode === "amount" && amountValue > 0 && cost > 0) {
                      setTopupUnits(parseFloat((amountValue / cost).toFixed(4)));
                    }
                  }}
                  placeholder="e.g. 92.14"
                  style={touched.topup_cost && topupErrors.cost ? { borderColor: TC.red } : undefined}
                />
                {touched.topup_cost && topupErrors.cost && (
                  <div style={errorStyle}>{topupErrors.cost}</div>
                )}
              </div>

              {/* Preview */}
              {topupUnits > 0 && topupCost > 0 && (
                <div style={{
                  padding: '8px 10px', background: TC.bg0,
                  border: `1px solid ${TC.border2}`, borderRadius: '1px',
                }}>
                  <div style={{ color: TC.text4, fontSize: '9px', letterSpacing: '0.12em', marginBottom: '6px' }}>
                    AFTER TOP-UP
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
                    <div>
                      <span style={{ color: TC.text5, fontSize: '9px' }}>TOTAL UNITS</span>
                      <div style={{ color: TC.green, fontSize: '11px' }}>
                        {(topupTarget.units + topupUnits).toFixed(3)}
                      </div>
                    </div>
                    <div>
                      <span style={{ color: TC.text5, fontSize: '9px' }}>NEW AVG COST</span>
                      <div style={{ color: TC.green, fontSize: '11px' }}>
                        ₹{((topupTarget.invested + topupUnits * topupCost) / (topupTarget.units + topupUnits)).toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <span style={{ color: TC.text5, fontSize: '9px' }}>TOTAL INVESTED</span>
                      <div style={{ color: TC.text, fontSize: '11px' }}>
                        {fmtINR2(topupTarget.invested + topupUnits * topupCost)}
                      </div>
                    </div>
                    <div>
                      <span style={{ color: TC.text5, fontSize: '9px' }}>THIS PURCHASE</span>
                      <div style={{ color: TC.amber, fontSize: '11px' }}>
                        {fmtINR2(topupUnits * topupCost)}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <TermBtn variant="primary" disabled={!isTopupValid} onClick={() => {
                setTouched(t => ({ ...t, topup_amount: true, topup_units: true, topup_cost: true }));
                if (isTopupValid) handleTopupSubmit();
              }}>
                <PlusCircle style={{ width: 11, height: 11 }} /> ADD UNITS
              </TermBtn>
              <TermBtn variant="ghost" onClick={() => { setAddMode("new"); setTopupTarget(null); setShowForm(false); }}>
                CANCEL
              </TermBtn>
            </div>
          )}

          {/* ── NEW / EDIT MODE ─────────────────────────────── */}
          {addMode === "new" && (
            <>
              {/* Search area — sits OUTSIDE the scrollable form so dropdowns don't get clipped */}
              {editId === null && (
                <div style={{ padding: '12px 12px 0', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {/* Type selector */}
                  <div>
                    <label style={labelStyle}>TYPE</label>
                    <select
                      value={form.type}
                      onChange={e => {
                        setForm(f => ({ ...BLANK, type: e.target.value as 'MF' | 'Stock' }));
                        setMfQuery(""); setMfResults([]); setMfSearchDone(false);
                        setStQuery(""); setStResults([]); setStSearchDone(false);
                      }}
                      style={{
                        background: TC.bg0, border: `1px solid ${TC.border}`, color: TC.text,
                        padding: '5px 8px', borderRadius: '1px', fontSize: '11px',
                        fontFamily: TC.font, width: '100%', outline: 'none',
                      }}
                    >
                      <option value="MF">MF — MUTUAL FUND</option>
                      <option value="Stock">STOCK</option>
                    </select>
                  </div>

                  {/* ── MF Search ─────────────────────── */}
                  {form.type === "MF" && (
                    <div style={{ position: 'relative' }}>
                      <label style={labelStyle}>SEARCH FUND BY NAME</label>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        background: TC.bg0,
                        border: `1px solid ${mfQuery.length >= 2 ? TC.green + '66' : TC.border}`,
                        padding: '0 8px', borderRadius: '1px',
                        transition: 'border-color 120ms',
                      }}>
                        {mfSearching ? (
                          <Loader2 style={{ color: TC.green, width: 12, height: 12, animation: 'spin 1s linear infinite', flexShrink: 0 }} />
                        ) : (
                          <Search style={{ color: TC.text4, width: 12, height: 12, flexShrink: 0 }} />
                        )}
                        <input
                          value={mfQuery}
                          onChange={e => handleMfSearch(e.target.value)}
                          placeholder="e.g. parag parikh flexi"
                          style={{
                            background: 'transparent', border: 'none', color: TC.text,
                            fontSize: '11px', outline: 'none', width: '100%', fontFamily: TC.font,
                            padding: '6px 0',
                          }}
                        />
                        {mfQuery && (
                          <button
                            onClick={() => { setMfQuery(""); setMfResults([]); setMfSearchDone(false); }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: TC.text5, padding: 0, flexShrink: 0 }}
                          >
                            <X style={{ width: 10, height: 10 }} />
                          </button>
                        )}
                      </div>

                      {/* Dropdown: results / searching / no results */}
                      {(mfSearching || (mfSearchDone && mfQuery.length >= 2)) && (
                        <div style={{
                          position: 'absolute', top: '100%', left: 0, right: 0,
                          background: TC.bg0, border: `1px solid ${TC.green}44`,
                          borderTop: 'none', zIndex: 50,
                          maxHeight: '280px', overflowY: 'auto',
                          boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
                          borderRadius: '0 0 2px 2px',
                        }}>
                          {mfSearching && mfResults.length === 0 && (
                            <div style={{ padding: '16px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                              <Loader2 style={{ color: TC.green, width: 14, height: 14, animation: 'spin 1s linear infinite' }} />
                              <span style={{ color: TC.text4, fontSize: '10px', letterSpacing: '0.06em' }}>Searching mutual funds…</span>
                            </div>
                          )}
                          {!mfSearching && mfSearchDone && mfResults.length === 0 && (
                            <div style={{ padding: '16px 12px', textAlign: 'center' }}>
                              <div style={{ color: TC.text5, fontSize: '10px', marginBottom: '4px' }}>
                                No funds found for "<span style={{ color: TC.amber }}>{mfQuery}</span>"
                              </div>
                              <div style={{ color: TC.text5, fontSize: '9px', opacity: 0.6 }}>
                                Try a different keyword or use manual entry below
                              </div>
                            </div>
                          )}
                          {mfResults.length > 0 && (
                            <div style={{ padding: '4px 10px 3px', color: TC.text5, fontSize: '8px', letterSpacing: '0.1em', borderBottom: `1px solid ${TC.border2}` }}>
                              {mfResults.length} RESULT{mfResults.length > 1 ? 'S' : ''}
                            </div>
                          )}
                          {mfResults.map((r, i) => (
                            <div
                              key={r.scheme_code}
                              onMouseDown={e => { e.preventDefault(); handleSelectMF(r); }}
                              style={{
                                padding: '8px 10px', cursor: 'pointer',
                                borderBottom: `1px solid ${TC.border2}`,
                                background: i % 2 === 0 ? TC.bg0 : TC.bg1,
                                transition: 'background 80ms',
                              }}
                              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = TC.green + '0D'; }}
                              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = i % 2 === 0 ? TC.bg0 : TC.bg1; }}
                            >
                              <div style={{
                                color: TC.text, fontSize: '10px',
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                              }}>
                                {r.name}
                              </div>
                              <div style={{ display: 'flex', gap: '6px', marginTop: '4px', alignItems: 'center', flexWrap: 'wrap' }}>
                                <span style={{
                                  color: TC.green, fontSize: '9px',
                                  background: TC.green + '14', padding: '1px 5px', borderRadius: '1px',
                                }}>
                                  {r.scheme_code}
                                </span>
                                {r.category && (
                                  <span style={{
                                    color: TC.amber, fontSize: '9px',
                                    background: TC.amber + '14', padding: '1px 5px', borderRadius: '1px',
                                  }}>
                                    {r.category}
                                  </span>
                                )}
                                {r.amc && (
                                  <span style={{ color: TC.text5, fontSize: '9px' }}>{r.amc}</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── Stock Search ──────────────────── */}
                  {form.type === "Stock" && (
                    <div style={{ position: 'relative' }}>
                      <label style={labelStyle}>SEARCH STOCK BY SYMBOL OR NAME</label>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        background: TC.bg0,
                        border: `1px solid ${stQuery.length >= 1 ? TC.green + '66' : TC.border}`,
                        padding: '0 8px', borderRadius: '1px',
                        transition: 'border-color 120ms',
                      }}>
                        {stSearching ? (
                          <Loader2 style={{ color: TC.green, width: 12, height: 12, animation: 'spin 1s linear infinite', flexShrink: 0 }} />
                        ) : (
                          <Search style={{ color: TC.text4, width: 12, height: 12, flexShrink: 0 }} />
                        )}
                        <input
                          value={stQuery}
                          onChange={e => handleStSearch(e.target.value)}
                          placeholder="e.g. RELIANCE or Tata"
                          style={{
                            background: 'transparent', border: 'none', color: TC.text,
                            fontSize: '11px', outline: 'none', width: '100%', fontFamily: TC.font,
                            padding: '6px 0',
                          }}
                        />
                        {stQuery && (
                          <button
                            onClick={() => { setStQuery(""); setStResults([]); setStSearchDone(false); }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: TC.text5, padding: 0, flexShrink: 0 }}
                          >
                            <X style={{ width: 10, height: 10 }} />
                          </button>
                        )}
                      </div>

                      {/* Dropdown */}
                      {(stSearching || (stSearchDone && stQuery.length >= 1)) && (
                        <div style={{
                          position: 'absolute', top: '100%', left: 0, right: 0,
                          background: TC.bg0, border: `1px solid ${TC.green}44`,
                          borderTop: 'none', zIndex: 50,
                          maxHeight: '280px', overflowY: 'auto',
                          boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
                          borderRadius: '0 0 2px 2px',
                        }}>
                          {stSearching && stResults.length === 0 && (
                            <div style={{ padding: '16px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                              <Loader2 style={{ color: TC.green, width: 14, height: 14, animation: 'spin 1s linear infinite' }} />
                              <span style={{ color: TC.text4, fontSize: '10px', letterSpacing: '0.06em' }}>Searching NSE stocks…</span>
                            </div>
                          )}
                          {!stSearching && stSearchDone && stResults.length === 0 && (
                            <div style={{ padding: '16px 12px', textAlign: 'center' }}>
                              <div style={{ color: TC.text5, fontSize: '10px', marginBottom: '4px' }}>
                                No stocks found for "<span style={{ color: TC.amber }}>{stQuery}</span>"
                              </div>
                              <div style={{ color: TC.text5, fontSize: '9px', opacity: 0.6 }}>
                                Try the full company name or NSE symbol
                              </div>
                            </div>
                          )}
                          {stResults.length > 0 && (
                            <div style={{ padding: '4px 10px 3px', color: TC.text5, fontSize: '8px', letterSpacing: '0.1em', borderBottom: `1px solid ${TC.border2}` }}>
                              {stResults.length} RESULT{stResults.length > 1 ? 'S' : ''}
                            </div>
                          )}
                          {stResults.map((r, i) => (
                            <div
                              key={r.symbol}
                              onMouseDown={e => { e.preventDefault(); handleSelectStock(r); }}
                              style={{
                                padding: '8px 10px', cursor: 'pointer',
                                borderBottom: `1px solid ${TC.border2}`,
                                background: i % 2 === 0 ? TC.bg0 : TC.bg1,
                                transition: 'background 80ms',
                              }}
                              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = TC.green + '0D'; }}
                              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = i % 2 === 0 ? TC.bg0 : TC.bg1; }}
                            >
                              <div style={{
                                display: 'flex', alignItems: 'center', gap: '8px',
                              }}>
                                <span style={{
                                  color: TC.green, fontSize: '10px', fontWeight: 600,
                                  background: TC.green + '14', padding: '1px 5px', borderRadius: '1px',
                                  flexShrink: 0,
                                }}>
                                  {r.symbol.replace(".NS", "")}
                                </span>
                                <span style={{
                                  color: TC.text, fontSize: '10px',
                                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                }}>
                                  {r.name}
                                </span>
                              </div>
                              <div style={{ display: 'flex', gap: '6px', marginTop: '3px', alignItems: 'center' }}>
                                <span style={{
                                  color: TC.amber, fontSize: '9px',
                                  background: TC.amber + '14', padding: '1px 5px', borderRadius: '1px',
                                }}>
                                  {r.sector}
                                </span>
                                <span style={{ color: TC.text5, fontSize: '9px' }}>{r.exchange || "NSE"}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Fetching indicator */}
                  {(fetchingNav || fetchingPrice) && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      padding: '6px 8px', background: TC.bg0,
                      border: `1px solid ${TC.green}33`, borderRadius: '1px',
                    }}>
                      <Loader2 style={{ color: TC.green, width: 12, height: 12, animation: 'spin 1s linear infinite' }} />
                      <span style={{ color: TC.green, fontSize: '10px' }}>
                        {fetchingNav ? "Fetching latest NAV…" : "Fetching current price…"}
                      </span>
                    </div>
                  )}

                  {/* Selected indicator */}
                  {form.identifier && !fetchingNav && !fetchingPrice && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      padding: '6px 8px', background: '#001A0A',
                      border: `1px solid ${TC.green}33`, borderRadius: '1px',
                    }}>
                      <Check style={{ color: TC.green, width: 11, height: 11 }} />
                      <span style={{ color: TC.green, fontSize: '10px' }}>
                        {form.identifier} — {form.type === "MF" ? "NAV" : "CMP"} ₹{form.currentNav.toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Scrollable form fields */}
              <div style={{
                flex: 1, overflowY: 'auto', padding: '12px',
                display: 'flex', flexDirection: 'column', gap: '10px',
              }}>
                {/* ── EDIT MODE — full manual form ──────────── */}
                {editId !== null && (
                  <>
                    <div>
                      <label style={labelStyle}>TYPE</label>
                      <select
                        value={form.type}
                        onChange={e => setForm(f => ({ ...f, type: e.target.value as 'MF' | 'Stock' }))}
                        style={{
                          background: TC.bg0, border: `1px solid ${TC.border}`, color: TC.text,
                          padding: '5px 8px', borderRadius: '1px', fontSize: '11px',
                          fontFamily: TC.font, width: '100%', outline: 'none',
                        }}
                      >
                        <option value="MF">MF — MUTUAL FUND</option>
                        <option value="Stock">STOCK</option>
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>DISPLAY NAME</label>
                      <TermInput value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} placeholder="e.g. Parag Parikh Flexi Cap" />
                    </div>
                    <div>
                      <label style={labelStyle}>{form.type === 'MF' ? 'SCHEME CODE' : 'NSE TICKER'}</label>
                      <TermInput value={form.identifier} onChange={v => setForm(f => ({ ...f, identifier: v }))} placeholder={form.type === 'MF' ? 'e.g. 122655' : 'e.g. RELIANCE.NS'} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <div>
                        <label style={labelStyle}>UNITS / QTY</label>
                        <TermInput type="number" value={form.units || ""} onChange={v => setForm(f => ({ ...f, units: parseFloat(v) || 0 }))} placeholder="0.000" />
                      </div>
                      <div>
                        <label style={labelStyle}>AVG COST ₹</label>
                        <TermInput type="number" value={form.avgCost || ""} onChange={v => setForm(f => ({ ...f, avgCost: parseFloat(v) || 0 }))} placeholder="0.00" />
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <div>
                        <label style={labelStyle}>CURR NAV / CMP ₹</label>
                        <TermInput type="number" value={form.currentNav || ""} onChange={v => setForm(f => ({ ...f, currentNav: parseFloat(v) || 0 }))} placeholder="0.00" />
                      </div>
                      <div>
                        <label style={labelStyle}>INVESTED ₹</label>
                        <TermInput type="number" value={form.invested || ""} onChange={v => setForm(f => ({ ...f, invested: parseFloat(v) || 0 }))} placeholder="0.00" />
                      </div>
                    </div>
                    <div>
                      <label style={labelStyle}>SECTOR / CATEGORY</label>
                      <TermInput value={form.sector} onChange={v => setForm(f => ({ ...f, sector: v }))} placeholder="e.g. Large Cap, IT" />
                    </div>
                    <div>
                      <label style={labelStyle}>NOTES</label>
                      <TermInput value={form.notes} onChange={v => setForm(f => ({ ...f, notes: v }))} placeholder="Optional…" />
                    </div>
                    <TermBtn variant="primary" onClick={handleAdd}>
                      UPDATE HOLDING
                    </TermBtn>
                  </>
                )}

                {/* ── ADD MODE — streamlined customer flow ──── */}
                {editId === null && (
                  <>
                    {/* Prompt to search if nothing selected yet */}
                    {!form.identifier && !manualEntry && (
                      <div style={{
                        padding: '16px 12px', textAlign: 'center',
                        color: touched.identifier ? TC.red : TC.text5,
                        fontSize: '10px', lineHeight: 1.7,
                        border: `1px dashed ${touched.identifier ? TC.red + '66' : TC.border}`,
                        borderRadius: '1px',
                        background: touched.identifier ? TC.red + '08' : 'transparent',
                      }}>
                        {touched.identifier
                          ? (form.type === "MF" ? "Please select a mutual fund from search above" : "Please select a stock from search above")
                          : (form.type === "MF" ? "Search for a mutual fund above to get started" : "Search for a stock above to get started")
                        }
                      </div>
                    )}

                    {/* Once an instrument is selected via search, show the streamlined entry */}
                    {form.identifier && !manualEntry && (
                      <>
                        {/* Selected instrument summary card */}
                        <div style={{
                          padding: '10px', background: TC.bg0,
                          border: `1px solid ${TC.green}33`, borderRadius: '1px',
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{
                                color: TC.text, fontSize: '11px', fontWeight: 600,
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                              }}>
                                {form.name}
                              </div>
                              <div style={{ display: 'flex', gap: '6px', marginTop: '4px', alignItems: 'center' }}>
                                <TypeBadge type={form.type} />
                                <span style={{ color: TC.text4, fontSize: '9px' }}>{form.identifier}</span>
                              </div>
                            </div>
                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                              <div style={{ color: TC.text5, fontSize: '8px', letterSpacing: '0.1em' }}>
                                {form.type === "MF" ? "LATEST NAV" : "CMP"}
                              </div>
                              <div style={{ color: TC.green, fontSize: '14px', fontWeight: 600 }}>
                                ₹{form.currentNav.toFixed(2)}
                              </div>
                            </div>
                          </div>
                          {form.sector && (
                            <div style={{ color: TC.text5, fontSize: '9px', marginTop: '4px' }}>
                              {form.sector}
                            </div>
                          )}
                        </div>

                        {/* Amount / Units toggle */}
                        <div>
                          <label style={labelStyle}>HOW WOULD YOU LIKE TO ENTER?</label>
                          <div style={{ display: 'flex', gap: '0' }}>
                            <button
                              onClick={() => {
                                setInputMode("amount");
                                if (form.units > 0 && form.currentNav > 0) {
                                  setAmountValue(parseFloat((form.units * form.currentNav).toFixed(2)));
                                }
                              }}
                              style={{
                                flex: 1,
                                padding: '7px 8px', fontSize: '10px', fontFamily: TC.font,
                                background: inputMode === "amount" ? TC.green + '18' : TC.bg0,
                                border: `1px solid ${inputMode === "amount" ? TC.green + '66' : TC.border}`,
                                borderRight: 'none',
                                color: inputMode === "amount" ? TC.green : TC.text4,
                                cursor: 'pointer', letterSpacing: '0.08em',
                                transition: 'all 120ms',
                              }}
                            >
                              ENTER AMOUNT ₹
                            </button>
                            <button
                              onClick={() => {
                                setInputMode("units");
                                if (amountValue > 0 && form.currentNav > 0) {
                                  setForm(f => ({ ...f, units: parseFloat((amountValue / f.currentNav).toFixed(4)) }));
                                }
                              }}
                              style={{
                                flex: 1,
                                padding: '7px 8px', fontSize: '10px', fontFamily: TC.font,
                                background: inputMode === "units" ? TC.green + '18' : TC.bg0,
                                border: `1px solid ${inputMode === "units" ? TC.green + '66' : TC.border}`,
                                color: inputMode === "units" ? TC.green : TC.text4,
                                cursor: 'pointer', letterSpacing: '0.08em',
                                transition: 'all 120ms',
                              }}
                            >
                              ENTER UNITS
                            </button>
                          </div>
                        </div>

                        {/* Amount input mode */}
                        {inputMode === "amount" && (
                          <div>
                            <label style={labelStyle}>INVESTMENT AMOUNT ₹</label>
                            <TermInput
                              type="number"
                              value={amountValue || ""}
                              onChange={v => {
                                touch("amount");
                                const amt = parseFloat(v) || 0;
                                setAmountValue(amt);
                                if (form.currentNav > 0 && amt > 0) {
                                  const calcUnits = parseFloat((amt / form.currentNav).toFixed(4));
                                  setForm(f => ({
                                    ...f,
                                    units: calcUnits,
                                    avgCost: f.currentNav,
                                    invested: amt,
                                  }));
                                } else {
                                  setForm(f => ({ ...f, units: 0, invested: 0 }));
                                }
                              }}
                              placeholder="e.g. 5000"
                              style={touched.amount && errors.amount ? { borderColor: TC.red } : undefined}
                            />
                            {touched.amount && errors.amount && (
                              <div style={errorStyle}>{errors.amount}</div>
                            )}
                            {/* Live calculation preview */}
                            {amountValue > 0 && form.currentNav > 0 && (
                              <div style={{
                                marginTop: '6px', padding: '10px',
                                background: '#001A0A', border: `1px solid ${TC.green}22`,
                                borderRadius: '1px',
                              }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span style={{ color: TC.text4, fontSize: '9px', letterSpacing: '0.08em' }}>
                                    {form.type === "MF" ? "UNITS YOU'LL GET" : "SHARES YOU'LL GET"}
                                  </span>
                                  <span style={{ color: TC.green, fontSize: '15px', fontWeight: 600, fontFamily: TC.font }}>
                                    {form.type === "Stock"
                                      ? Math.floor(amountValue / form.currentNav)
                                      : (amountValue / form.currentNav).toFixed(4)
                                    }
                                  </span>
                                </div>
                                <div style={{ color: TC.text5, fontSize: '9px', marginTop: '4px' }}>
                                  ₹{amountValue.toLocaleString("en-IN")} ÷ ₹{form.currentNav.toFixed(2)} = {(amountValue / form.currentNav).toFixed(4)} units
                                </div>
                                {form.type === "MF" && (
                                  <div style={{
                                    marginTop: '6px', paddingTop: '6px',
                                    borderTop: `1px solid ${TC.green}15`,
                                    color: TC.text5, fontSize: '9px',
                                    display: 'flex', justifyContent: 'space-between',
                                  }}>
                                    <span>NAV as on today</span>
                                    <span style={{ color: TC.text3 }}>₹{form.currentNav.toFixed(2)}</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Units input mode */}
                        {inputMode === "units" && (
                          <div>
                            <label style={labelStyle}>{form.type === "Stock" ? "QUANTITY (SHARES)" : "UNITS ALLOTTED"}</label>
                            <TermInput
                              type="number"
                              value={form.units || ""}
                              onChange={v => {
                                touch("units");
                                const u = parseFloat(v) || 0;
                                const amt = parseFloat((u * form.currentNav).toFixed(2));
                                setForm(f => ({
                                  ...f,
                                  units: u,
                                  avgCost: f.currentNav,
                                  invested: amt,
                                }));
                                setAmountValue(amt);
                              }}
                              placeholder={form.type === "Stock" ? "e.g. 10" : "e.g. 5.123"}
                              style={touched.units && errors.units ? { borderColor: TC.red } : undefined}
                            />
                            {touched.units && errors.units && (
                              <div style={errorStyle}>{errors.units}</div>
                            )}
                            {/* Live value preview */}
                            {form.units > 0 && form.currentNav > 0 && (
                              <div style={{
                                marginTop: '6px', padding: '10px',
                                background: '#001A0A', border: `1px solid ${TC.green}22`,
                                borderRadius: '1px',
                              }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span style={{ color: TC.text4, fontSize: '9px', letterSpacing: '0.08em' }}>TOTAL INVESTMENT</span>
                                  <span style={{ color: TC.green, fontSize: '15px', fontWeight: 600, fontFamily: TC.font }}>
                                    ₹{(form.units * form.currentNav).toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                                  </span>
                                </div>
                                <div style={{ color: TC.text5, fontSize: '9px', marginTop: '4px' }}>
                                  {form.type === "Stock" ? form.units.toFixed(0) : form.units.toFixed(4)} × ₹{form.currentNav.toFixed(2)} = {fmtINR2(form.units * form.currentNav)}
                                </div>
                                {form.type === "MF" && (
                                  <div style={{
                                    marginTop: '6px', paddingTop: '6px',
                                    borderTop: `1px solid ${TC.green}15`,
                                    color: TC.text5, fontSize: '9px',
                                    display: 'flex', justifyContent: 'space-between',
                                  }}>
                                    <span>NAV as on today</span>
                                    <span style={{ color: TC.text3 }}>₹{form.currentNav.toFixed(2)}</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Avg cost override — collapsed by default, show only if user wants different cost */}
                        {form.units > 0 && (
                          <div>
                            <label style={labelStyle}>AVG COST ₹ (PURCHASE PRICE)</label>
                            <TermInput
                              type="number"
                              value={form.avgCost || ""}
                              onChange={v => {
                                const cost = parseFloat(v) || 0;
                                setForm(f => ({ ...f, avgCost: cost, invested: f.units * cost }));
                              }}
                              placeholder="defaults to current NAV/CMP"
                            />
                            {form.avgCost > 0 && form.avgCost !== form.currentNav && (
                              <div style={{
                                marginTop: '3px', fontSize: '9px',
                                color: form.avgCost < form.currentNav ? TC.green : TC.red,
                              }}>
                                {form.avgCost < form.currentNav ? "▲" : "▼"}{" "}
                                {Math.abs(((form.currentNav - form.avgCost) / form.avgCost) * 100).toFixed(1)}% {form.avgCost < form.currentNav ? "gain" : "loss"} from purchase
                              </div>
                            )}
                          </div>
                        )}

                        {/* Optional notes */}
                        <div>
                          <label style={labelStyle}>NOTES (OPTIONAL)</label>
                          <TermInput value={form.notes} onChange={v => setForm(f => ({ ...f, notes: v }))} placeholder="e.g. SIP since Jan 2024" />
                        </div>

                        {/* Summary before submission */}
                        {form.units > 0 && form.avgCost > 0 && (
                          <div style={{
                            padding: '10px', background: TC.bg0,
                            border: `1px solid ${TC.border}`, borderRadius: '1px',
                          }}>
                            <div style={{ color: TC.text4, fontSize: '9px', letterSpacing: '0.12em', marginBottom: '8px' }}>
                              SUMMARY
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                              <div>
                                <span style={{ color: TC.text5, fontSize: '8px' }}>UNITS</span>
                                <div style={{ color: TC.text, fontSize: '12px' }}>
                                  {form.type === "Stock" ? form.units.toFixed(0) : form.units.toFixed(4)}
                                </div>
                              </div>
                              <div>
                                <span style={{ color: TC.text5, fontSize: '8px' }}>AVG COST</span>
                                <div style={{ color: TC.text, fontSize: '12px' }}>₹{form.avgCost.toFixed(2)}</div>
                              </div>
                              <div>
                                <span style={{ color: TC.text5, fontSize: '8px' }}>INVESTED</span>
                                <div style={{ color: TC.amber, fontSize: '12px' }}>{fmtINR2(form.units * form.avgCost)}</div>
                              </div>
                              <div>
                                <span style={{ color: TC.text5, fontSize: '8px' }}>CURRENT VALUE</span>
                                <div style={{ color: TC.green, fontSize: '12px' }}>{fmtINR2(form.units * form.currentNav)}</div>
                              </div>
                            </div>
                          </div>
                        )}

                        <TermBtn variant="primary" disabled={!isFormValid} onClick={() => {
                          setTouched(t => ({ ...t, amount: true, units: true, identifier: true }));
                          if (isFormValid) {
                            setForm(f => ({ ...f, invested: f.units * f.avgCost }));
                            handleAdd();
                          }
                        }}>
                          <Plus style={{ width: 11, height: 11 }} /> ADD TO PORTFOLIO
                        </TermBtn>
                      </>
                    )}

                    {/* Manual entry link for power users */}
                    {!form.identifier && !manualEntry && (
                      <button
                        onClick={() => setManualEntry(true)}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: TC.text5, fontSize: '9px', fontFamily: TC.font,
                          textDecoration: 'underline', padding: '4px 0',
                        }}
                      >
                        Or enter details manually →
                      </button>
                    )}

                    {/* Manual entry fallback — hidden behind link */}
                    {manualEntry && (
                      <>
                        <div>
                          <label style={labelStyle}>DISPLAY NAME *</label>
                          <TermInput
                            value={form.name}
                            onChange={v => { touch("name"); setForm(f => ({ ...f, name: v })); }}
                            placeholder="e.g. Parag Parikh Flexi Cap"
                            style={touched.name && errors.name ? { borderColor: TC.red } : undefined}
                          />
                          {touched.name && errors.name && <div style={errorStyle}>{errors.name}</div>}
                        </div>
                        <div>
                          <label style={labelStyle}>{form.type === 'MF' ? 'SCHEME CODE *' : 'NSE TICKER *'}</label>
                          <TermInput
                            value={form.identifier}
                            onChange={v => { touch("identifier"); setForm(f => ({ ...f, identifier: v })); }}
                            placeholder={form.type === 'MF' ? 'e.g. 122655' : 'e.g. RELIANCE.NS'}
                            style={touched.identifier && errors.identifier ? { borderColor: TC.red } : undefined}
                          />
                          {touched.identifier && errors.identifier && <div style={errorStyle}>{errors.identifier}</div>}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                          <div>
                            <label style={labelStyle}>UNITS / QTY *</label>
                            <TermInput
                              type="number"
                              value={form.units || ""}
                              onChange={v => { touch("units"); setForm(f => ({ ...f, units: parseFloat(v) || 0 })); }}
                              placeholder="0.000"
                              style={touched.units && errors.units ? { borderColor: TC.red } : undefined}
                            />
                            {touched.units && errors.units && <div style={errorStyle}>{errors.units}</div>}
                          </div>
                          <div>
                            <label style={labelStyle}>AVG COST ₹ *</label>
                            <TermInput
                              type="number"
                              value={form.avgCost || ""}
                              onChange={v => { touch("avgCost"); setForm(f => ({ ...f, avgCost: parseFloat(v) || 0 })); }}
                              placeholder="0.00"
                              style={touched.avgCost && errors.avgCost ? { borderColor: TC.red } : undefined}
                            />
                            {touched.avgCost && errors.avgCost && <div style={errorStyle}>{errors.avgCost}</div>}
                          </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                          <div>
                            <label style={labelStyle}>CURR NAV / CMP ₹</label>
                            <TermInput type="number" value={form.currentNav || ""} onChange={v => setForm(f => ({ ...f, currentNav: parseFloat(v) || 0 }))} placeholder="0.00" />
                          </div>
                          <div>
                            <label style={labelStyle}>INVESTED ₹</label>
                            <TermInput type="number" value={form.invested || ""} onChange={v => setForm(f => ({ ...f, invested: parseFloat(v) || 0 }))} placeholder="0.00" />
                          </div>
                        </div>
                        <div>
                          <label style={labelStyle}>SECTOR / CATEGORY</label>
                          <TermInput value={form.sector} onChange={v => setForm(f => ({ ...f, sector: v }))} placeholder="e.g. Large Cap, IT" />
                        </div>
                        <div>
                          <label style={labelStyle}>NOTES</label>
                          <TermInput value={form.notes} onChange={v => setForm(f => ({ ...f, notes: v }))} placeholder="Optional…" />
                        </div>
                        <TermBtn variant="primary" disabled={!isFormValid} onClick={() => {
                          setTouched(t => ({ ...t, name: true, identifier: true, units: true, avgCost: true }));
                          if (isFormValid) {
                            setForm(f => ({ ...f, invested: f.units * f.avgCost }));
                            setManualEntry(false);
                            handleAdd();
                          }
                        }}>
                          + ADD HOLDING
                        </TermBtn>
                      </>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
