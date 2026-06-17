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
import { Plus, Download, Trash2, Search, X, Upload, GripVertical, RotateCcw, Check } from "lucide-react";
import { toast } from "sonner";
import {
  TC, GRID_BG, computeHoldings,
  totalValue, totalInvested, fmtINR, fmtINR2, gainColor, gainSymbol,
  TypeBadge, ThSort, ThFixed, Td, PanelHeader, TermInput, TermBtn,
  type Holding,
} from "./TerminalShared";
import { useHoldings, useHoldingActions } from "../store";

// ─── Constants ────────────────────────────────────────────────────────────────

const MF_SEARCH: { code: string; name: string; category: string; nav: string }[] = [
  { code: "122655", name: "Parag Parikh Flexi Cap Fund – Direct Growth",   category: "Flexi Cap",  nav: "92.14"  },
  { code: "120716", name: "UTI Nifty 50 Index Fund – Direct Growth",        category: "Index",      nav: "152.34" },
  { code: "118989", name: "Mirae Asset Large Cap Fund – Direct Growth",     category: "Large Cap",  nav: "118.92" },
  { code: "101539", name: "Axis Bluechip Fund – Direct Growth",            category: "Large Cap",  nav: "61.44"  },
  { code: "147663", name: "Motilal Oswal Nifty 500 Index Fund – Direct",    category: "Index",      nav: "24.88"  },
  { code: "118550", name: "Nippon India Small Cap Fund – Direct Growth",    category: "Small Cap",  nav: "89.22"  },
  { code: "102885", name: "DSP Tax Saver Fund (ELSS) – Direct Growth",      category: "ELSS",       nav: "112.34" },
  { code: "100595", name: "ICICI Pru Technology Fund – Direct Growth",      category: "Sectoral",   nav: "228.17" },
];

const BLANK: Omit<Holding, "id"> = {
  type: "MF", name: "", shortName: "", identifier: "",
  units: 0, avgCost: 0, currentNav: 0, sector: "", invested: 0, notes: "",
};

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
  const [editId,   setEditId]      = useState<number | null>(null);
  const [search,   setSearch]      = useState("");
  const [sortKey,  setSortKey]     = useState<SortKey>("currentValue");
  const [sortDir,  setSortDir]     = useState<"asc" | "desc">("desc");
  const [importing, setImporting]  = useState(false);
  const fileRef                     = useRef<HTMLInputElement>(null);

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

  function handleDelete(id: number) {
    actions.remove(id);
    toast("Holding removed");
  }

  // ── Inline field update ─────────────────────────────────────────────────────

  function updateField(id: number, field: keyof Holding, raw: string) {
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
        const withIds = imported.map((h, i) => ({ ...h, id: Date.now() + i }));
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
              <TermBtn variant="ghost" onClick={handleReset}>
                <RotateCcw style={{ width: 11, height: 11 }} /> RESET DEMO
              </TermBtn>
              <TermBtn variant="danger" onClick={handleClear}>
                <Trash2 style={{ width: 11, height: 11 }} /> CLEAR
              </TermBtn>
              <TermBtn variant="primary" onClick={() => { setShowForm(true); setEditId(null); setForm({ ...BLANK }); }}>
                <Plus style={{ width: 11, height: 11 }} /> ADD
              </TermBtn>
            </div>
          }
        />

        {/* ── Empty state or Table ───────────────────────────────── */}
        {holdings.length === 0 ? (
          <EmptyState
            onAdd={() => { setShowForm(true); setEditId(null); setForm({ ...BLANK }); }}
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

                      {/* Delete button */}
                      <Td>
                        <button
                          onClick={e => { e.stopPropagation(); handleDelete(h.id); }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: TC.text5, padding: '2px 4px' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = TC.red; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = TC.text5; }}
                        >
                          <X style={{ width: 12, height: 12 }} />
                        </button>
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

      {/* ── Add / Edit Side Panel ────────────────────────────────── */}
      {showForm && (
        <div style={{
          width: '296px', flexShrink: 0,
          borderLeft: `1px solid ${TC.border}`,
          background: TC.bg1,
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          animation: 'fadeIn 120ms ease-out',
        }}>
          <PanelHeader
            title={editId !== null ? "EDIT HOLDING" : "ADD NEW HOLDING"}
            right={
              <button
                onClick={() => setShowForm(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: TC.text4 }}
              >
                <X style={{ width: 14, height: 14 }} />
              </button>
            }
          />
          <div style={{
            flex: 1, overflowY: 'auto', padding: '12px',
            display: 'flex', flexDirection: 'column', gap: '10px',
          }}>
            {/* Type */}
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

            {/* Auto-calculate invested */}
            {form.units > 0 && form.avgCost > 0 && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '6px 8px',
                background: TC.bg0, border: `1px solid ${TC.border2}`, borderRadius: '1px',
              }}>
                <span style={{ color: TC.text4, fontSize: '9px' }}>AUTO:</span>
                <span style={{ color: TC.text3, fontSize: '10px' }}>
                  {form.units} × ₹{form.avgCost.toFixed(2)} = {fmtINR2(form.units * form.avgCost)}
                </span>
                <button
                  onClick={() => setForm(f => ({ ...f, invested: f.units * f.avgCost }))}
                  style={{
                    marginLeft: 'auto', background: 'none', border: `1px solid ${TC.green}33`,
                    color: TC.green, fontSize: '8px', padding: '1px 5px', borderRadius: '1px',
                    cursor: 'pointer', fontFamily: TC.font,
                  }}
                >
                  <Check style={{ width: 9, height: 9, display: 'inline' }} /> USE
                </button>
              </div>
            )}

            <TermBtn variant="primary" onClick={handleAdd}>
              {editId !== null ? "UPDATE HOLDING" : "+ ADD HOLDING"}
            </TermBtn>
          </div>

          {/* MF Scheme search helper */}
          {form.type === "MF" && (
            <div style={{ borderTop: `1px solid ${TC.border}`, flexShrink: 0 }}>
              <PanelHeader title="SCHEME SEARCH (SAMPLE DATA)" />
              <div style={{ overflowY: 'auto', maxHeight: '220px' }}>
                {MF_SEARCH.map((r, i) => (
                  <div
                    key={r.code}
                    onClick={() => setForm(f => ({
                      ...f,
                      name: r.name.replace(' – Direct Growth', '').replace(' – Direct', ''),
                      identifier: r.code,
                      sector: r.category,
                      currentNav: parseFloat(r.nav),
                    }))}
                    style={{
                      padding: '7px 12px',
                      borderBottom: `1px solid ${TC.border2}`,
                      cursor: 'pointer',
                      background: i % 2 === 0 ? TC.bg1 : TC.bg0,
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = TC.bg2; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = i % 2 === 0 ? TC.bg1 : TC.bg0; }}
                  >
                    <div style={{ color: TC.text, fontSize: '10px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.name}
                    </div>
                    <div style={{ display: 'flex', gap: '10px', marginTop: '2px' }}>
                      <span style={{ color: TC.text4, fontSize: '9px' }}>{r.code}</span>
                      <span style={{ color: TC.text4, fontSize: '9px' }}>{r.category}</span>
                      <span style={{ color: TC.green, fontSize: '9px' }}>NAV ₹{r.nav}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
