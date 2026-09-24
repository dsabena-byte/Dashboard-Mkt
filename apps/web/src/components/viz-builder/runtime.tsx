"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import * as XLSX from "xlsx";
import {
  DATE_PRESETS, distinctValues, effectiveFilters, firstDateField, prepare, runQuery, uid,
  type CrossFilter, type DashFilter, type DashFilterState, type DashboardV2, type Dataset, type Prepared, type Result, type Widget,
} from "@/lib/viz";
import { resultToAoa } from "@/lib/viz/export";
import { WidgetCard } from "@/components/viz/widget-card";
import { TextBlock } from "@/components/viz/misc";

// Runtime de un tablero de planilla: barra de filtros (fecha con presets + listas), filtros
// cruzados (clic en una barra/porción filtra los demás widgets del mismo dataset), grilla de 4
// columnas y "Modo reporte" imprimible. En modo edición agrega el cromo para reordenar (drag &
// drop nativo), cambiar ancho/alto, duplicar, borrar y abrir el editor del widget.

export const VZ_CSS = `
.vz-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;align-items:start}
.vz-w1{grid-column:span 1}.vz-w2{grid-column:span 2}.vz-w3{grid-column:span 3}.vz-w4{grid-column:span 4}
@media (max-width:1100px){.vz-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.vz-w3,.vz-w4{grid-column:span 2}}
@media (max-width:640px){.vz-grid{grid-template-columns:minmax(0,1fr)}.vz-w1,.vz-w2,.vz-w3,.vz-w4{grid-column:span 1}}
.vz-bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:0 0 14px}
.vz-pill{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line);background:#fff;border-radius:9px;padding:6px 10px;font-size:12.5px;color:var(--ink);cursor:pointer;font-family:inherit}
.vz-pill:hover{border-color:#c9d6e6}
.vz-pill b{font-weight:600}
.vz-pill small{color:var(--muted);font-size:12px}
.vz-pill.on{border-color:var(--navy);background:var(--navy-soft)}
.vz-chip{display:inline-flex;align-items:center;gap:6px;border-radius:999px;background:var(--navy-soft);color:var(--navy);padding:4px 6px 4px 10px;font-size:12px;font-weight:600}
.vz-chip button{border:0;background:none;color:inherit;cursor:pointer;font-size:13px;line-height:1;padding:0 2px}
.vz-pop{position:absolute;z-index:40;top:calc(100% + 6px);left:0;background:#fff;border:1px solid var(--line);border-radius:12px;box-shadow:0 10px 30px -12px rgba(15,23,42,.35);padding:10px;min-width:240px;max-width:340px}
.vz-link{border:0;background:none;color:var(--navy);font-weight:600;font-size:12.5px;cursor:pointer;padding:4px 2px;font-family:inherit}
.vz-tb{display:flex;flex-wrap:wrap;gap:2px;align-items:center;justify-content:flex-end;background:var(--panel-2);border:1px solid var(--line);border-radius:9px;padding:3px;margin:-6px -6px 10px}
.vz-card .recharts-wrapper:focus,.vz-card .recharts-wrapper *:focus,.vz-card .recharts-surface:focus{outline:none}
.vz-tb button{border:0;background:none;border-radius:6px;padding:3px 6px;font-size:11.5px;color:var(--muted);cursor:pointer;font-family:inherit;line-height:1.2}
.vz-tb button:hover{background:var(--line-2);color:var(--ink)}
.vz-tb button.on{background:var(--navy);color:#fff}
.vz-tb .sep{width:1px;height:14px;background:var(--line);margin:0 2px}
.vz-drag-over{outline:2px dashed var(--cyan);outline-offset:3px}
.vz-report-root{position:fixed;inset:0;z-index:1000;background:#fff;overflow:auto}
@media print{
  @page{size:A4 landscape;margin:10mm}
  body.vz-printing > *:not(.vz-report-root){display:none !important}
  body.vz-printing .vz-report-root{position:static;overflow:visible}
  [data-noprint]{display:none !important}
  .vz-card{break-inside:avoid;page-break-inside:avoid}
  .vz-grid{gap:10px}
}
`;

export interface RuntimeProps {
  config: DashboardV2;
  datasets: Record<string, Dataset>;
  mode: "view" | "edit";
  onChange?: (c: DashboardV2) => void;
  onEditWidget?: (id: string) => void;
  editingId?: string | null;
  headerExtra?: React.ReactNode;
}

/** Datasets preparados (memo) según los ajustes del tablero. */
export function usePrepared(config: DashboardV2, datasets: Record<string, Dataset>) {
  return useMemo(() => {
    const out: Record<string, Prepared> = {};
    const lookup = (id: string) => datasets[id];
    for (const [id, ds] of Object.entries(datasets)) out[id] = prepare(ds, config.datasets[id] ?? {}, lookup);
    return out;
  }, [config.datasets, datasets]);
}

const dsOf = (w: Widget, c: DashboardV2) => w.datasetId || c.datasetId || "";

export function DashboardRuntime({ config, datasets, mode, onChange, onEditWidget, editingId, headerExtra }: RuntimeProps) {
  const preps = usePrepared(config, datasets);
  const [fstate, setFstate] = useState<DashFilterState>({});
  const [cross, setCross] = useState<CrossFilter[]>([]);
  const [report, setReport] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  // Filtro de fecha implícito (dataset principal) si el tablero no definió uno.
  const filters: DashFilter[] = useMemo(() => {
    const fs = [...config.filters];
    const main = config.datasetId && preps[config.datasetId];
    if (main && !fs.some((f) => f.kind === "date" && f.datasetId === config.datasetId)) {
      const d = firstDateField(main);
      if (d) fs.unshift({ id: "auto-date", datasetId: config.datasetId!, field: d.id, kind: "date", label: "Período" });
    }
    return fs.filter((f) => preps[f.datasetId]?.byId.has(f.field));
  }, [config.filters, config.datasetId, preps]);

  const results = useMemo(() => {
    const out: Record<string, Result | null> = {};
    for (const w of config.widgets) {
      const P = preps[dsOf(w, config)];
      if (w.type === "text") { out[w.id] = null; continue; }
      if (!P) { out[w.id] = { dims: [], measures: [], rows: [], xKeys: [], seriesKeys: [], totals: [], hasTarget: false, rowCount: 0, warnings: [], error: "La planilla de este gráfico no está disponible" }; continue; }
      const extra = effectiveFilters(dsOf(w, config), w.id, filters, fstate, cross);
      out[w.id] = runQuery(P, w.q, w.type, { extra }, { kpiMode: w.opts.kpiMode, compare: w.opts.compare, detail: w.opts.detail, direction: w.opts.direction });
    }
    return out;
  }, [config, preps, filters, fstate, cross]);

  function select(w: Widget, key: string, label: string) {
    if (!w.q.x || key === "__otros" || key === "__total") return;
    const r = results[w.id];
    const grain = r?.dims[0]?.type === "date" ? r.dims[0].grain : undefined;
    setCross((cs) => {
      const same = cs.find((c) => c.sourceWidget === w.id);
      const rest = cs.filter((c) => c.sourceWidget !== w.id);
      if (same && same.key === key) return rest;
      return [...rest, { sourceWidget: w.id, datasetId: dsOf(w, config), field: w.q.x!, grain, key, label }];
    });
  }

  const upd = (patch: (ws: Widget[]) => Widget[]) => onChange?.({ ...config, widgets: patch(config.widgets) });
  function move(from: string, to: string) {
    if (from === to) return;
    upd((ws) => { const a = [...ws]; const i = a.findIndex((w) => w.id === from); const [it] = a.splice(i, 1); const j = a.findIndex((w) => w.id === to); a.splice(j, 0, it!); return a; });
  }

  const activeCount = Object.values(fstate.list ?? {}).filter((v) => v.length).length + Object.values(fstate.date ?? {}).filter((v) => v.preset !== "all").length + cross.length;
  const clearAll = () => { setFstate({}); setCross([]); };
  const fieldLabel = (f: DashFilter) => f.label || preps[f.datasetId]?.byId.get(f.field)?.label || "Filtro";

  const bar = (
    <div className="vz-bar" data-noprint="1">
      {filters.map((f) => f.kind === "date"
        ? <DateFilter key={f.id} f={f} label={fieldLabel(f)} st={fstate.date?.[f.id]} onChange={(v) => setFstate((s) => ({ ...s, date: { ...(s.date ?? {}), [f.id]: v } }))} onRemove={mode === "edit" && f.id !== "auto-date" ? () => onChange?.({ ...config, filters: config.filters.filter((x) => x.id !== f.id) }) : undefined} />
        : <ListFilter key={f.id} f={f} label={fieldLabel(f)} P={preps[f.datasetId]} sel={fstate.list?.[f.id] ?? []} onChange={(v) => setFstate((s) => ({ ...s, list: { ...(s.list ?? {}), [f.id]: v } }))} onRemove={mode === "edit" ? () => onChange?.({ ...config, filters: config.filters.filter((x) => x.id !== f.id) }) : undefined} />)}
      {mode === "edit" && <AddDashFilter config={config} preps={preps} onAdd={(f) => onChange?.({ ...config, filters: [...config.filters, f] })} />}
      {cross.map((c) => (
        <span key={c.sourceWidget} className="vz-chip" title="Filtro cruzado (clic en un gráfico)">
          {preps[c.datasetId]?.byId.get(c.field)?.label}: {c.label}
          <button onClick={() => setCross((cs) => cs.filter((x) => x !== c))} aria-label="Quitar">×</button>
        </span>
      ))}
      {activeCount > 0 && <button className="vz-link" onClick={clearAll}>Limpiar filtros</button>}
      <span style={{ flex: 1 }} />
      {headerExtra}
      {mode === "view" && <button className="vz-pill" onClick={() => setReport(true)} title="Vista limpia para imprimir o exportar a PDF">Modo reporte</button>}
      {mode === "view" && <DownloadData datasets={datasets} used={[...new Set(config.widgets.map((w) => dsOf(w, config)))]} />}
    </div>
  );

  const periodLabel = filters.filter((f) => f.kind === "date").map((f) => { const st = fstate.date?.[f.id]; if (!st || st.preset === "all") return null; if (st.preset === "custom") return `${st.from ?? "…"} → ${st.to ?? "…"}`; return DATE_PRESETS.find((p) => p.v === st.preset)?.label ?? null; }).filter(Boolean).join(" · ") || "Todo el período";
  const filtersLabel = [
    ...filters.filter((f) => f.kind === "list" && (fstate.list?.[f.id] ?? []).length).map((f) => `${fieldLabel(f)}: ${(fstate.list?.[f.id] ?? []).join(", ")}`),
    ...cross.map((c) => `${preps[c.datasetId]?.byId.get(c.field)?.label}: ${c.label}`),
  ];

  return (
    <>
      <style>{VZ_CSS}</style>
      {bar}
      {config.widgets.length === 0 && mode === "edit" && (
        <div className="card" style={{ textAlign: "center", padding: 36 }}>
          <p className="hint" style={{ margin: 0 }}>El tablero está vacío. Usá <b>Tablero automático</b>, <b>Armalo con IA</b> o <b>+ Gráfico</b> arriba.</p>
        </div>
      )}
      <div className="vz-grid">
        {config.widgets.map((w) => {
          const sel = cross.find((c) => c.sourceWidget === w.id)?.key ?? null;
          const toolbar = mode === "edit" ? (
            <div className="vz-tb" data-noprint="1">
              <button title="Arrastrá para mover" style={{ cursor: "grab", marginRight: "auto" }}>⠿ mover</button>
              <span className="sep" />
              {[1, 2, 3, 4].map((n) => <button key={n} className={w.w === n ? "on" : ""} title={`Ancho ${n}/4`} onClick={() => upd((ws) => ws.map((x) => (x.id === w.id ? { ...x, w: n as Widget["w"] } : x)))}>{n}</button>)}
              <span className="sep" />
              {(["s", "m", "l"] as const).map((h) => <button key={h} className={w.h === h ? "on" : ""} title="Alto" onClick={() => upd((ws) => ws.map((x) => (x.id === w.id ? { ...x, h } : x)))}>{h.toUpperCase()}</button>)}
              <span className="sep" />
              <button title="Editar" onClick={() => onEditWidget?.(w.id)} style={{ color: "var(--navy)", fontWeight: 600 }}>Editar</button>
              <button title="Duplicar" onClick={() => upd((ws) => { const i = ws.findIndex((x) => x.id === w.id); const copy = { ...structuredClone(w), id: uid(), title: w.title ? `${w.title} (copia)` : "" }; const a = [...ws]; a.splice(i + 1, 0, copy); return a; })}>⧉</button>
              <button title="Eliminar" onClick={() => { if (confirm("¿Eliminar este gráfico?")) upd((ws) => ws.filter((x) => x.id !== w.id)); }} style={{ color: "var(--err)" }}>✕</button>
            </div>
          ) : undefined;
          const dragProps: React.HTMLAttributes<HTMLDivElement> | undefined = mode === "edit" ? {
            draggable: true,
            onDragStart: (e) => { setDragId(w.id); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", w.id); },
            onDragOver: (e) => { if (dragId) { e.preventDefault(); setOverId(w.id); } },
            onDragLeave: () => setOverId((o) => (o === w.id ? null : o)),
            onDrop: (e) => { e.preventDefault(); if (dragId) move(dragId, w.id); setDragId(null); setOverId(null); },
            onDragEnd: () => { setDragId(null); setOverId(null); },
            style: { outline: editingId === w.id ? "2px solid var(--cyan)" : overId === w.id && dragId !== w.id ? "2px dashed var(--cyan)" : undefined, outlineOffset: 3, opacity: dragId === w.id ? 0.5 : 1 },
          } : undefined;
          return <WidgetCard key={w.id} w={w} r={results[w.id] ?? null} selected={sel} onSelect={(k, l) => select(w, k, l)} toolbar={toolbar} dragProps={dragProps} />;
        })}
      </div>
      {report && <ReportMode config={config} results={results} period={periodLabel} filters={filtersLabel} onClose={() => setReport(false)} />}
    </>
  );
}

// ── Filtros de tablero ──
function useOutside(ref: React.RefObject<HTMLElement | null>, onOut: () => void) {
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onOut(); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [ref, onOut]);
}

function DateFilter({ f, label, st, onChange, onRemove }: { f: DashFilter; label: string; st?: { preset: string; from?: string; to?: string }; onChange: (v: { preset: string; from?: string; to?: string }) => void; onRemove?: () => void }) {
  const preset = st?.preset ?? "all";
  const inp: React.CSSProperties = { border: "1px solid var(--line)", borderRadius: 8, padding: "5px 7px", fontSize: 12.5, fontFamily: "inherit" };
  return (
    <span className={`vz-pill${preset !== "all" ? " on" : ""}`} style={{ cursor: "default" }} data-f={f.id}>
      <small>{label}</small>
      <select value={preset} onChange={(e) => onChange({ preset: e.target.value, from: st?.from, to: st?.to })} style={{ border: 0, background: "transparent", fontSize: 12.5, fontWeight: 600, color: "var(--ink)", fontFamily: "inherit", cursor: "pointer" }}>
        {DATE_PRESETS.map((p) => <option key={p.v} value={p.v}>{p.label}</option>)}
      </select>
      {preset === "custom" && (
        <>
          <input type="date" style={inp} value={st?.from ?? ""} onChange={(e) => onChange({ preset, from: e.target.value, to: st?.to })} />
          <span style={{ color: "var(--faint)" }}>→</span>
          <input type="date" style={inp} value={st?.to ?? ""} onChange={(e) => onChange({ preset, from: st?.from, to: e.target.value })} />
        </>
      )}
      {onRemove && <button className="vz-link" onClick={onRemove} title="Quitar filtro" style={{ color: "var(--muted)" }}>×</button>}
    </span>
  );
}

export function ValuesPicker({ P, field, sel, onChange }: { P: Prepared; field: string; sel: string[]; onChange: (v: string[]) => void }) {
  const [q, setQ] = useState("");
  const vals = useMemo(() => distinctValues(P, field, 2000), [P, field]);
  const shown = vals.filter((v) => !q || v.key.toLowerCase().includes(q.toLowerCase())).slice(0, 300);
  const set = new Set(sel);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <input autoFocus placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} style={{ border: "1px solid var(--line)", borderRadius: 8, padding: "6px 8px", fontSize: 12.5, fontFamily: "inherit" }} />
      <div style={{ display: "flex", gap: 10 }}>
        <button className="vz-link" onClick={() => onChange([])}>Todos</button>
        <button className="vz-link" onClick={() => onChange(shown.map((v) => v.key))}>Solo los visibles</button>
      </div>
      <div style={{ maxHeight: 240, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
        {shown.map((v) => (
          <label key={v.key} style={{ display: "flex", gap: 7, alignItems: "center", fontSize: 12.5, cursor: "pointer", padding: "2px 0" }}>
            <input type="checkbox" checked={set.has(v.key)} onChange={() => onChange(set.has(v.key) ? sel.filter((x) => x !== v.key) : [...sel, v.key])} />
            <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.key}</span>
            <span style={{ color: "var(--faint)", fontSize: 11 }}>{v.count.toLocaleString("es-AR")}</span>
          </label>
        ))}
        {!shown.length && <span className="hint" style={{ margin: 0 }}>Sin coincidencias.</span>}
      </div>
    </div>
  );
}

function ListFilter({ f, label, P, sel, onChange, onRemove }: { f: DashFilter; label: string; P?: Prepared; sel: string[]; onChange: (v: string[]) => void; onRemove?: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useOutside(ref, () => setOpen(false));
  if (!P) return null;
  return (
    <span ref={ref} style={{ position: "relative" }}>
      <button className={`vz-pill${sel.length ? " on" : ""}`} onClick={() => setOpen((o) => !o)}>
        <small>{label}</small><b>{sel.length === 0 ? "Todos" : sel.length === 1 ? sel[0] : `${sel.length} seleccionados`}</b> ▾
      </button>
      {onRemove && <button className="vz-link" onClick={onRemove} title="Quitar filtro" style={{ color: "var(--muted)" }}>×</button>}
      {open && <div className="vz-pop"><ValuesPicker P={P} field={f.field} sel={sel} onChange={onChange} /></div>}
    </span>
  );
}

function AddDashFilter({ config, preps, onAdd }: { config: DashboardV2; preps: Record<string, Prepared>; onAdd: (f: DashFilter) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useOutside(ref, () => setOpen(false));
  const ids = Object.keys(preps);
  const [ds, setDs] = useState(config.datasetId ?? ids[0] ?? "");
  const P = preps[ds];
  return (
    <span ref={ref} style={{ position: "relative" }}>
      <button className="vz-pill" onClick={() => setOpen((o) => !o)} style={{ borderStyle: "dashed" }}>+ Filtro del tablero</button>
      {open && (
        <div className="vz-pop" style={{ minWidth: 260 }}>
          <p className="hint" style={{ margin: "0 0 8px", fontSize: 12 }}>Aplica a todos los gráficos de esa planilla.</p>
          {ids.length > 1 && (
            <select value={ds} onChange={(e) => setDs(e.target.value)} style={{ width: "100%", marginBottom: 8, border: "1px solid var(--line)", borderRadius: 8, padding: 6, fontSize: 12.5 }}>
              {ids.map((id) => <option key={id} value={id}>{preps[id]!.ds.name}</option>)}
            </select>
          )}
          <div style={{ maxHeight: 260, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
            {P?.fields.filter((f) => !f.hidden && !f.error && !f.aggregate && (f.role === "dimension" || f.type === "date")).map((f) => (
              <button key={f.id} className="vz-link" style={{ textAlign: "left", color: "var(--ink)", fontWeight: 500 }} onClick={() => { onAdd({ id: uid("f"), datasetId: ds, field: f.id, kind: f.type === "date" ? "date" : "list" }); setOpen(false); }}>
                {f.type === "date" ? "📅" : "▤"} {f.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </span>
  );
}

function DownloadData({ datasets, used }: { datasets: Record<string, Dataset>; used: string[] }) {
  function go() {
    const wb = XLSX.utils.book_new();
    for (const id of used) {
      const ds = datasets[id]; if (!ds) continue;
      const ws = XLSX.utils.aoa_to_sheet([ds.columns, ...ds.rows]);
      XLSX.utils.book_append_sheet(wb, ws, (ds.name || "Datos").replace(/[\\/?*[\]:]/g, " ").slice(0, 30) || "Datos");
    }
    if (wb.SheetNames.length) XLSX.writeFile(wb, "datos-tablero.xlsx");
  }
  return <button className="vz-pill" onClick={go} title="Descargar las planillas completas que usa el tablero">Descargar datos</button>;
}

// ── Modo reporte ──
function ReportMode({ config, results, period, filters, onClose }: { config: DashboardV2; results: Record<string, Result | null>; period: string; filters: string[]; onClose: () => void }) {
  const [narr, setNarr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    document.body.classList.add("vz-printing");
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", esc);
    return () => { document.body.classList.remove("vz-printing"); window.removeEventListener("keydown", esc); };
  }, [onClose]);

  async function narrative() {
    setBusy(true); setErr(null);
    try {
      const widgets = config.widgets.filter((w) => w.type !== "text").map((w) => { const r = results[w.id]; return { titulo: w.title, tipo: w.type, datos: r && !r.error ? resultToAoa(r, w).slice(0, 26) : [] }; });
      const res = await fetch("/api/tableros/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "narrativa", title: config.title, periodo: period, filtros: filters, widgets }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "No se pudo generar el resumen");
      setNarr(String(d.texto ?? ""));
    } catch (e) { setErr(e instanceof Error ? e.message : "Error"); } finally { setBusy(false); }
  }

  if (!mounted) return null;
  const today = new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" });
  return createPortal(
    <div className="vz-report-root bip-viz">
      <div className="vz-report" style={{ maxWidth: 1180, margin: "0 auto", padding: "26px 28px 40px" }}>
        <div data-noprint="1" style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginBottom: 14, flexWrap: "wrap" }}>
          <button className="vz-pill" onClick={narrative} disabled={busy}>{busy ? "Escribiendo…" : narr ? "Regenerar resumen IA" : "Resumen con IA"}</button>
          <button className="btn" onClick={() => window.print()} style={{ padding: "7px 14px", fontSize: 13 }}>Imprimir / PDF</button>
          <button className="vz-pill" onClick={onClose}>Cerrar</button>
        </div>
        <header style={{ borderBottom: "2px solid var(--ink)", paddingBottom: 12, marginBottom: 16, display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--muted)" }}>Reporte</div>
            <h1 style={{ margin: "2px 0 0", fontSize: 26 }}>{config.title || "Tablero"}</h1>
            {config.description && <p className="hint" style={{ margin: "4px 0 0" }}>{config.description}</p>}
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)", textAlign: "right", lineHeight: 1.6 }}>
            <div><b style={{ color: "var(--ink)" }}>Período:</b> {period}</div>
            {filters.length > 0 && <div><b style={{ color: "var(--ink)" }}>Filtros:</b> {filters.join(" · ")}</div>}
            <div>Emitido el {today}</div>
          </div>
        </header>
        {err && <div className="err" data-noprint="1">{err}</div>}
        {narr && (
          <section style={{ border: "1px solid var(--line)", borderRadius: 14, padding: "14px 18px", marginBottom: 16, background: "var(--panel-2)" }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 6 }}>Resumen</div>
            <TextBlock text={narr} />
          </section>
        )}
        <div className="vz-grid">
          {config.widgets.map((w) => <WidgetCard key={w.id} w={w} r={results[w.id] ?? null} print />)}
        </div>
      </div>
    </div>,
    document.body,
  );
}
