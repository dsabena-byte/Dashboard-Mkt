"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  CHART_LABEL, aiSchema, autoDashboard, compile, newWidget, prepare, resolveName, sanitizeWidget, templateFor, uid,
  type CalcDef, type ChartType, type DashboardV2, type Dataset, type DatasetSettings, type Prepared, type Widget,
} from "@/lib/viz";
import { SheetAdder } from "./sheet-adder";
import { DashboardRuntime, usePrepared } from "./runtime";
import { WidgetEditor } from "./editor";
import { Modal, box, lbl } from "./fields";

// Builder de un tablero de planilla (motor v2): planillas del tablero, tablero automático,
// plantillas nativas, "Armalo con IA", lienzo de 4 columnas con drag & drop y el editor de cada
// gráfico. Guarda la config v2 en /api/tableros (tabla `tableros`, migración 0109).

const NATIVE: string[] = []; // BIP tenía plantillas para sus tableros nativos; en Drean todos son propios
const ADD_TYPES: ChartType[] = ["kpi", "bar", "line", "area", "combo", "donut", "pie", "scatter", "heatmap", "table", "pivot", "funnel", "waterfall", "gauge", "text"];
const EXAMPLES = ["Ventas por mes comparadas con el año anterior", "Top 10 clientes por facturación con % del total", "Inversión real vs presupuesto por concepto y el desvío", "KPIs principales con su tendencia"];

const stepN: React.CSSProperties = { display: "inline-flex", alignItems: "center", justifyContent: "center", width: 20, height: 20, borderRadius: 999, background: "#e0e7ff", color: "#1e40af", fontSize: 11.5, fontWeight: 600, flex: "0 0 auto" };

export function VizBuilder({ slug, initial, datasetsList: dl0, initialDatasets }: {
  slug: string; initial: DashboardV2; datasetsList: { id: string; name: string; row_count: number }[]; initialDatasets: Record<string, Dataset>;
}) {
  const [config, setConfig] = useState<DashboardV2>(initial);
  const [datasets, setDatasets] = useState<Record<string, Dataset>>(initialDatasets);
  const [datasetsList, setDatasetsList] = useState(dl0);
  const [editing, setEditing] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [ai, setAi] = useState(false);
  const [srcOpen, setSrcOpen] = useState(!initial.datasetId);
  const preps = usePrepared(config, datasets);

  const change = (c: DashboardV2) => { setConfig(c); setDirty(true); setMsg(null); };
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const loading = useRef(new Set<string>());
  const loadDataset = useCallback(async (id: string): Promise<Dataset | null> => {
    if (!id) return null;
    if (datasets[id]) return datasets[id];
    if (loading.current.has(id)) return null;
    loading.current.add(id);
    try {
      const res = await fetch(`/api/tableros/dataset?id=${encodeURIComponent(id)}`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "No se pudo cargar la planilla");
      setDatasets((m) => ({ ...m, [id]: d as Dataset }));
      return d as Dataset;
    } catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : "Error" }); return null; }
    finally { loading.current.delete(id); }
  }, [datasets]);

  // Datasets referenciados por widgets / blends → cargarlos.
  useEffect(() => {
    const ids = new Set<string>();
    if (config.datasetId) ids.add(config.datasetId);
    for (const w of config.widgets) if (w.datasetId) ids.add(w.datasetId);
    for (const s of Object.values(config.datasets)) for (const b of s.blends ?? []) ids.add(b.datasetId);
    for (const id of ids) if (!datasets[id]) void loadDataset(id);
  }, [config, datasets, loadDataset]);

  const mainP: Prepared | undefined = config.datasetId ? preps[config.datasetId] : undefined;

  // Tablero recién creado con planilla y sin gráficos → tablero automático (una vez).
  const autoDone = useRef(false);
  useEffect(() => {
    if (autoDone.current || !config.datasetId || config.widgets.length) return;
    const ds = datasets[config.datasetId];
    if (!ds) return;
    autoDone.current = true;
    applyAuto(config.datasetId, ds, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.datasetId, config.widgets.length, datasets]);

  async function pickPrimary(id: string) {
    const ds = await loadDataset(id);
    change({ ...config, datasetId: id || null });
    if (ds && config.widgets.length === 0) applyAuto(id, ds, true);
  }

  function applyAuto(dsId: string, ds?: Dataset, silent = false) {
    const d = ds ?? datasets[dsId];
    if (!d) return;
    if (!silent && config.widgets.length && !confirm("Esto reemplaza los gráficos actuales por un tablero automático. ¿Seguimos?")) return;
    const settings = config.datasets[dsId] ?? {};
    const P = prepare(d, settings, (id) => datasets[id]);
    let widgets: Widget[];
    let calcs: CalcDef[] = [];
    const tpl = NATIVE.includes(slug) ? templateFor(slug, P, dsId) : null;
    if (tpl) { widgets = tpl.widgets; calcs = tpl.calcs.filter((c) => !(settings.calcs ?? []).some((x) => x.id === c.id)); }
    else widgets = autoDashboard(P, dsId);
    change({ ...config, datasetId: config.datasetId ?? dsId, datasets: { ...config.datasets, [dsId]: { ...settings, calcs: [...(settings.calcs ?? []), ...calcs] } }, widgets });
    setMsg({ ok: true, text: tpl ? "Armamos el tablero con la plantilla de este tablero. Ajustalo como quieras." : "Armamos un tablero automático con tu planilla. Ajustalo como quieras." });
  }

  async function uploadFile(file: File) {
    setMsg({ ok: true, text: "Subiendo planilla…" });
    try {
      const fd = new FormData(); fd.append("file", file);
      const res = await fetch("/api/tableros/datasets", { method: "POST", body: fd });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "No se pudo subir");
      await addDataset({ id: d.id, name: d.name, rows: d.rows });
    } catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : "Error" }); }
  }

  // Planilla nueva (subida, Google Sheets o Excel vinculado): se suma a la lista. Si el tablero todavía
  // no tiene gráficos pasa a ser la principal; si ya tiene, queda disponible sin romper lo armado.
  async function addDataset(d: { id: string; name: string; rows: number }) {
    setDatasetsList((l) => [{ id: d.id, name: d.name, row_count: d.rows }, ...l.filter((x) => x.id !== d.id)]);
    if (!config.datasetId || config.widgets.length === 0) { await pickPrimary(d.id); setMsg({ ok: true, text: `Usando “${d.name}”. Armá el tablero con Tablero automático, IA o + Gráfico.` }); }
    else { await loadDataset(d.id); setMsg({ ok: true, text: `Sumaste “${d.name}”. Elegila como planilla principal o usala en un gráfico (Editar → Planilla).` }); }
  }

  async function save() {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch("/api/tableros", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, config }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "No se pudo guardar");
      setDirty(false);
      setMsg({ ok: true, text: "Guardado ✓" });
    } catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : "Error" }); } finally { setBusy(false); }
  }

  function addWidget(t: ChartType) {
    const w = newWidget(t, config.datasetId ?? undefined);
    change({ ...config, widgets: [...config.widgets, w] });
    setAddOpen(false);
    if (t !== "text") setEditing(w.id); else setEditing(w.id);
  }

  const editingW = config.widgets.find((w) => w.id === editing) ?? null;
  const usedIds = useMemo(() => [...new Set([config.datasetId, ...config.widgets.map((w) => w.datasetId)].filter(Boolean) as string[])], [config]);
  const listForEditor = datasetsList.map((d) => ({ id: d.id, name: d.name }));
  const canTemplate = NATIVE.includes(slug) && mainP && !!templateFor(slug, mainP, config.datasetId!);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Barra superior */}
      <div className="card" style={{ margin: 0, padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ flex: "1 1 260px" }}>
            <span style={lbl}>Nombre del tablero</span>
            <input style={{ ...box, fontSize: 14, fontWeight: 600 }} value={config.title} onChange={(e) => change({ ...config, title: e.target.value })} placeholder="Ej. Inversión de Marketing" />
          </div>
          <div style={{ flex: "2 1 320px" }}>
            <span style={lbl}>Descripción (opcional)</span>
            <input style={box} value={config.description ?? ""} onChange={(e) => change({ ...config, description: e.target.value || undefined })} placeholder="Para qué sirve este tablero" />
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {msg && <span className="hint" style={{ margin: 0, fontSize: 12.5, color: msg.ok ? "var(--good)" : "var(--err)" }}>{msg.text}</span>}
            <Link href={`/tableros/${slug}`} className="vz-pill" style={{ padding: "8px 14px", fontSize: 13, fontWeight: 600, color: "var(--navy)" }} onClick={(e) => { if (dirty && !confirm("Hay cambios sin guardar. ¿Salir igual?")) e.preventDefault(); }}>Ver tablero</Link>
            <span style={stepN}>3</span>
            <button className="btn" onClick={save} disabled={busy} style={{ padding: "8px 16px", fontSize: 13 }}>{busy ? "Guardando…" : dirty ? "Guardar tablero •" : "Guardar tablero"}</button>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", borderTop: "1px solid var(--line-2)", paddingTop: 10 }}>
          <span style={stepN}>1</span>
          <button className="vz-pill" onClick={() => setSrcOpen((o) => !o)} title="Elegir, cambiar o subir la planilla que alimenta el tablero">
            <small>Planilla</small><b>{usedIds.length ? usedIds.map((id) => datasetsList.find((d) => d.id === id)?.name ?? "…").join(", ") : "Elegí una planilla"}</b> · <span style={{ color: "var(--navy)", fontWeight: 600 }}>{usedIds.length ? "cambiar o subir otra" : "elegir o subir"}</span> ▾
          </button>
          <span style={{ flex: 1 }} />
          <span style={stepN}>2</span>
          <button className="vz-pill" disabled={!config.datasetId} onClick={() => config.datasetId && applyAuto(config.datasetId)} title="Arma un tablero completo a partir de la planilla">{canTemplate ? "Plantilla del tablero" : "Tablero automático"}</button>
          <button className="vz-pill" disabled={!config.datasetId} onClick={() => setAi(true)} style={{ borderColor: "var(--cyan)" }}>✦ Armalo con IA</button>
          <span style={{ position: "relative" }}>
            <button className="btn" disabled={!config.datasetId} onClick={() => setAddOpen((o) => !o)} style={{ padding: "7px 14px", fontSize: 13 }}>+ Gráfico</button>
            {addOpen && (
              <div className="vz-pop" style={{ right: 0, left: "auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2, minWidth: 300 }}>
                {ADD_TYPES.map((t) => <button key={t} className="vz-link" style={{ textAlign: "left", color: "var(--ink)", fontWeight: 500 }} onClick={() => addWidget(t)}>{CHART_LABEL[t]}</button>)}
              </div>
            )}
          </span>
        </div>

        <p className="hint" style={{ margin: 0, fontSize: 12.5 }}>
          <b>1</b> Elegí o subí la planilla · <b>2</b> Armá los gráficos: <i>Tablero automático</i> (te lo arma solo), <i>Armalo con IA</i> (le pedís lo que querés ver) o <i>+ Gráfico</i> (uno por uno). Para <b>borrar</b> un gráfico usá la ✕ de su esquina; para cambiarlo, <i>Editar</i> · <b>3</b> <i>Guardar tablero</i>.
        </p>

        {srcOpen && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, background: "var(--panel-2)", borderRadius: 10, padding: 12 }}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
              <div style={{ flex: "1 1 280px" }}>
                <span style={lbl}>Planilla principal</span>
                <select style={box} value={config.datasetId ?? ""} onChange={(e) => pickPrimary(e.target.value)}>
                  <option value="">Elegí una planilla…</option>
                  {datasetsList.map((d) => <option key={d.id} value={d.id}>{d.name} ({d.row_count.toLocaleString("es-AR")} filas)</option>)}
                </select>
              </div>
            </div>
            {/* Drean: archivo (Excel/CSV) o Google Sheets por link (si el token de Google tiene el scope). */}
            <SheetAdder onFile={(f) => void uploadFile(f)} onCreated={(d) => void addDataset(d)} />
            <p className="hint" style={{ margin: 0, fontSize: 12 }}>Cada gráfico puede usar otra planilla (se elige en su editor). Los filtros del tablero aplican a los gráficos de la misma planilla.</p>
          </div>
        )}
      </div>

      {!config.datasetId ? (
        <div className="card" style={{ margin: 0, textAlign: "center", padding: 32 }}>
          <p className="hint" style={{ margin: 0 }}>Elegí o subí la planilla que alimenta este tablero. Te armamos un tablero automático y después lo ajustás.</p>
        </div>
      ) : (
        <DashboardRuntime config={config} datasets={datasets} mode="edit" onChange={change} onEditWidget={setEditing} editingId={editing} />
      )}

      {editingW && (
        <WidgetEditor widget={editingW} config={config} preps={preps} datasets={datasets} datasetsList={listForEditor} loadDataset={loadDataset}
          onChange={(w) => change({ ...config, widgets: config.widgets.map((x) => (x.id === w.id ? w : x)) })}
          onSettings={(dsId, s) => change({ ...config, datasets: { ...config.datasets, [dsId]: s } })}
          onClose={() => setEditing(null)} />
      )}
      {ai && <AiModal config={config} preps={preps} onClose={() => setAi(false)} onApply={(widgets, settingsByDs, replace) => {
        const ds = { ...config.datasets };
        for (const [id, s] of Object.entries(settingsByDs)) ds[id] = s;
        change({ ...config, datasets: ds, widgets: replace ? widgets : [...config.widgets, ...widgets] });
        setAi(false);
        setMsg({ ok: true, text: `La IA armó ${widgets.length} gráfico(s). Revisalos y guardá.` });
      }} onFallback={() => { setAi(false); if (config.datasetId) applyAuto(config.datasetId); }} />}
    </div>
  );
}

// ── Armalo con IA ──
function AiModal({ config, preps, onClose, onApply, onFallback }: {
  config: DashboardV2; preps: Record<string, Prepared>; onClose: () => void;
  onApply: (w: Widget[], settings: Record<string, DatasetSettings>, replace: boolean) => void; onFallback: () => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [replace, setReplace] = useState(config.widgets.length === 0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const ids = [...new Set([config.datasetId, ...config.widgets.map((w) => w.datasetId)].filter(Boolean) as string[])].filter((id) => preps[id]);

  async function go(full: boolean) {
    setBusy(true); setErr(null);
    try {
      const res = await fetch("/api/tableros/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: full ? "tablero" : "widgets", prompt: full ? prompt || "Armá un tablero profesional completo con los KPIs, la evolución, las aperturas principales y un ranking." : prompt, datasets: ids.map((id) => aiSchema(preps[id]!, id)), primary: config.datasetId }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "La IA no respondió");
      // Calculados propuestos por la IA → validar y crear; widgets → sanear contra el esquema.
      const settings: Record<string, DatasetSettings> = {};
      const calcIdByName = new Map<string, string>();
      for (const c of (d.calcs ?? []) as { datasetId?: string; name?: string; expr?: string; format?: CalcDef["format"] }[]) {
        const dsId = c.datasetId && preps[c.datasetId] ? c.datasetId : config.datasetId!;
        const P = preps[dsId];
        if (!P || !c.name || !c.expr) continue;
        try { compile(c.expr, (n) => resolveName(P, n)); } catch { continue; }
        const cur = settings[dsId] ?? { ...(config.datasets[dsId] ?? {}) };
        const id = uid("calc");
        cur.calcs = [...(cur.calcs ?? []), { id, name: c.name, expr: c.expr, format: c.format }];
        settings[dsId] = cur;
        calcIdByName.set(`${dsId}:${c.name}`, id);
      }
      const out: Widget[] = [];
      for (const raw of (d.widgets ?? []) as Record<string, unknown>[]) {
        const dsId = typeof raw.datasetId === "string" && preps[raw.datasetId] ? raw.datasetId : config.datasetId!;
        // "calc:Nombre" → id del calculado creado
        const fix = (v: unknown) => (typeof v === "string" && v.startsWith("calc:") ? calcIdByName.get(`${dsId}:${v.slice(5)}`) ?? v : v);
        const q = (raw.q ?? {}) as Record<string, unknown>;
        if (Array.isArray(q.measures)) q.measures = q.measures.map((m) => ({ ...(m as object), field: fix((m as { field?: unknown }).field) }));
        if (q.target && typeof q.target === "object") (q.target as Record<string, unknown>).field = fix((q.target as Record<string, unknown>).field);
        const base = preps[dsId];
        const P = settings[dsId] ? prepare(base!.ds, settings[dsId]) : base;
        const w = sanitizeWidget({ ...raw, datasetId: dsId === config.datasetId ? undefined : dsId }, P);
        if (w && (w.type === "text" || w.q.measures.length || w.opts.detail || w.type === "table")) out.push(w);
      }
      if (!out.length) throw new Error("La IA no devolvió gráficos válidos para tu planilla.");
      onApply(out, settings, replace);
    } catch (e) { setErr(e instanceof Error ? e.message : "Error"); } finally { setBusy(false); }
  }

  return (
    <Modal title="Armalo con IA" onClose={onClose}>
      <p className="hint" style={{ marginTop: 0 }}>Contale qué querés ver. La IA conoce las columnas de tu planilla (y una muestra chica de filas), arma los gráficos y después los ajustás.</p>
      <textarea autoFocus style={{ ...box, minHeight: 90, fontSize: 13.5 }} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="¿Qué querés ver? Ej. cómo vienen las ventas por canal vs el año pasado" />
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "8px 0" }}>
        {EXAMPLES.map((x) => <button key={x} className="vz-pill" style={{ fontSize: 12 }} onClick={() => setPrompt(x)}>{x}</button>)}
      </div>
      <label style={{ display: "flex", gap: 6, fontSize: 12.5, alignItems: "center" }}><input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} />Reemplazar los gráficos actuales</label>
      {err && <div className="err" style={{ margin: "10px 0 0" }}>{err} <button className="vz-link" onClick={onFallback}>Usar el tablero automático</button></div>}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14, flexWrap: "wrap" }}>
        <button className="btn ghost" disabled={busy} onClick={() => go(true)} style={{ padding: "7px 14px", fontSize: 13 }}>Tablero completo con IA</button>
        <button className="btn" disabled={busy || !prompt.trim()} onClick={() => go(false)} style={{ padding: "7px 14px", fontSize: 13 }}>{busy ? "Armando…" : "Armar"}</button>
      </div>
    </Modal>
  );
}
