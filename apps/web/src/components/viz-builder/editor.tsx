"use client";
import { useMemo, useRef, useState, useEffect } from "react";
import {
  CHART_LABEL, DATE_PRESETS, NUM_FORMATS, ROWS_FIELD, presetToFilter, runQuery, showMe, uid,
  type Agg, type ChartType, type CondRule, type DashboardV2, type Dataset, type DatasetSettings, type Field, type Filter, type Measure, type Prepared, type TableCalc, type Widget,
} from "@/lib/viz";
import { WidgetCard } from "@/components/viz/widget-card";
import { DRAG_MIME, FieldsPanel, TypeBadge, box, lbl } from "./fields";
import { ValuesPicker as ValuesPickerLite } from "./runtime";

// Editor de un widget (panel lateral): Campos | Estantes (Mostrame, Eje, Color, Filas, Columnas,
// Valores, Meta, Filtros) | Vista previa en vivo + Formato. Todo por clic o arrastrando campos.

const AGG_OPTS: { v: Agg; label: string }[] = [
  { v: "sum", label: "Suma" }, { v: "avg", label: "Promedio" }, { v: "min", label: "Mínimo" }, { v: "max", label: "Máximo" },
  { v: "median", label: "Mediana" }, { v: "count", label: "Cantidad" }, { v: "countd", label: "Distintos" }, { v: "last", label: "Último" },
];
const CALC_OPTS: { v: TableCalc; label: string }[] = [
  { v: "none", label: "Sin cálculo" }, { v: "pct_total", label: "% del total" }, { v: "running", label: "Acumulado" },
  { v: "moving_avg", label: "Media móvil" }, { v: "diff_prev", label: "Diferencia vs anterior" }, { v: "pct_prev", label: "% vs anterior" },
  { v: "yoy", label: "Diferencia vs año anterior" }, { v: "yoy_pct", label: "% vs año anterior" },
];
const TYPE_ICON: Record<ChartType, string> = { kpi: "123", gauge: "◔", bar: "▥", line: "⟋", area: "◭", combo: "▥⟋", donut: "◯", pie: "◕", scatter: "⁘", heatmap: "▦", funnel: "⏷", waterfall: "▤", table: "☰", pivot: "⊞", text: "T" };

type Shelf = "x" | "series" | "rows" | "cols" | "measures" | "target" | "filters" | "dateField";

function shelvesFor(t: ChartType): { key: Shelf; label: string; hint?: string }[] {
  const base: { key: Shelf; label: string; hint?: string }[] = [];
  if (t === "text") return [];
  if (t === "kpi" || t === "gauge") base.push({ key: "dateField", label: "Fecha (comparación y tendencia)" });
  else if (t === "pivot") base.push({ key: "rows", label: "Filas" }, { key: "cols", label: "Columnas" });
  else if (t === "table") base.push({ key: "x", label: "Filas", hint: "vacío = detalle de filas" }, { key: "rows", label: "Más filas" });
  else if (t === "heatmap") base.push({ key: "x", label: "Columnas (X)" }, { key: "series", label: "Filas (Y)" });
  else if (t === "scatter") base.push({ key: "x", label: "Detalle (un punto por…)" }, { key: "series", label: "Color" });
  else if (t === "pie" || t === "donut") base.push({ key: "x", label: "Categoría" });
  else if (t === "funnel") base.push({ key: "x", label: "Etapas" });
  else if (t === "waterfall") base.push({ key: "x", label: "Categoría / período" });
  else base.push({ key: "x", label: t === "bar" ? "Eje (categoría o fecha)" : "Eje (X)" }, { key: "series", label: "Color / Serie" });
  base.push({ key: "measures", label: t === "scatter" ? "Valores (X, Y, tamaño)" : "Valores" });
  if (["kpi", "gauge", "bar", "line", "area", "table"].includes(t)) base.push({ key: "target", label: "Meta" });
  base.push({ key: "filters", label: "Filtros del gráfico" });
  return base;
}

const isMeasureField = (P: Prepared, id: string) => id === ROWS_FIELD || P.byId.get(id)?.role === "measure";
const defAgg = (f?: Field): Agg => (!f ? "count" : f.type !== "number" ? "count" : f.format === "percent" || f.format === "pct_frac" || f.format === "ratio" ? "avg" : "sum");

export function WidgetEditor({ widget, config, preps, datasets, datasetsList, loadDataset, onChange, onSettings, onClose }: {
  widget: Widget; config: DashboardV2; preps: Record<string, Prepared>; datasets: Record<string, Dataset>;
  datasetsList: { id: string; name: string }[]; loadDataset: (id: string) => Promise<Dataset | null>;
  onChange: (w: Widget) => void; onSettings: (dsId: string, s: DatasetSettings) => void; onClose: () => void;
}) {
  const w = widget;
  const dsId = w.datasetId || config.datasetId || datasetsList[0]?.id || "";
  const P = preps[dsId];
  const settings = config.datasets[dsId] ?? {};
  const [tab, setTab] = useState<"formato" | "orden" | "kpi" | "tabla">("formato");
  const set = (patch: Partial<Widget>) => onChange({ ...w, ...patch });
  const setQ = (patch: Partial<Widget["q"]>) => onChange({ ...w, q: { ...w.q, ...patch } });
  const setO = (patch: Partial<Widget["opts"]>) => onChange({ ...w, opts: { ...w.opts, ...patch } });

  useEffect(() => { if (dsId && !datasets[dsId]) void loadDataset(dsId); }, [dsId, datasets, loadDataset]);

  const preview = useMemo(() => (P && w.type !== "text" ? runQuery(P, w.q, w.type, {}, { kpiMode: w.opts.kpiMode, compare: w.opts.compare, detail: w.opts.detail, direction: w.opts.direction }) : null), [P, w]);
  const selDims = [w.q.x, w.q.series, ...(w.q.rows ?? []), ...(w.q.cols ?? [])].filter(Boolean).map((id) => P?.byId.get(id!)).filter((f): f is Field => !!f);
  const sm = showMe({ dims: selDims, measures: w.q.measures.length, hasTarget: !!w.q.target });

  // Suma un campo al estante "natural" (o al indicado).
  function addField(id: string, shelf?: Shelf) {
    if (!P) return;
    const f = P.byId.get(id);
    const meas = isMeasureField(P, id);
    const fresh = !w.q.x && !w.q.measures.length && !(w.q.rows ?? []).length;
    let q = { ...w.q };
    let type = w.type;
    const target = shelf ?? (meas ? "measures" : f?.type === "date" && (type === "kpi" || type === "gauge") ? "dateField" : type === "pivot" ? (!(q.rows ?? []).length ? "rows" : "cols") : !q.x ? "x" : shelvesFor(type).some((s) => s.key === "series") && !q.series ? "series" : "x");
    if (target === "measures") {
      q.measures = [...q.measures, { id: uid("m"), field: id, agg: f?.aggregate ? "sum" : defAgg(f) }];
    } else if (target === "target") {
      q.target = { field: id, agg: defAgg(f), label: f?.label };
    } else if (target === "filters") {
      q.filters = [...(q.filters ?? []), { field: id, op: f?.type === "date" ? "date_relative" : f?.type === "number" ? "between" : "in", values: [], rel: f?.type === "date" ? "last_n_months" : undefined, n: 12 }];
    } else if (target === "rows" || target === "cols") {
      q[target] = [...(q[target] ?? []).filter((x) => x !== id), id];
    } else if (target === "dateField") {
      q.dateField = id;
    } else {
      q[target as "x" | "series"] = id;
    }
    // Arranque inteligente: con el widget vacío, elegir el mejor tipo (como "Mostrame" de Tableau).
    if (fresh && (type === "bar" || type === "kpi") && target !== "filters") {
      const dims = [q.x, q.series].filter(Boolean).map((d) => P.byId.get(d!)).filter((x): x is Field => !!x);
      const best = showMe({ dims, measures: q.measures.length, hasTarget: !!q.target }).best;
      if (dims.length || q.measures.length) type = dims.length === 0 && q.measures.length ? "kpi" : best === "table" ? "bar" : best;
      if (type === "kpi" && w.type !== "kpi") q = { ...q };
    }
    onChange({ ...w, type, q, w: type === "kpi" && fresh ? 1 : w.w, h: type === "kpi" && fresh ? "s" : w.type === "kpi" && type !== "kpi" ? "m" : w.h, opts: type === "kpi" && fresh ? { kpiMode: "total", compare: "none", spark: true, ...w.opts } : w.opts, title: w.title && w.title !== "Nuevo gráfico" ? w.title : autoTitle(P, q, type) });
  }

  function onDropShelf(shelf: Shelf) {
    return {
      onDragOver: (e: React.DragEvent) => { if (e.dataTransfer.types.includes(DRAG_MIME)) { e.preventDefault(); (e.currentTarget as HTMLElement).style.background = "var(--cyan-soft)"; } },
      onDragLeave: (e: React.DragEvent) => { (e.currentTarget as HTMLElement).style.background = ""; },
      onDrop: (e: React.DragEvent) => { e.preventDefault(); (e.currentTarget as HTMLElement).style.background = ""; const id = e.dataTransfer.getData(DRAG_MIME); if (id) addField(id, shelf); },
    };
  }

  const fieldLabel = (id?: string) => (id === ROWS_FIELD ? "Cantidad de filas" : P?.byId.get(id ?? "")?.label ?? "—");
  const pill = (id: string, onRemove: () => void, extra?: React.ReactNode) => (
    <span key={id} style={{ display: "inline-flex", alignItems: "center", gap: 5, background: isMeasureField(P!, id) ? "rgba(20,184,166,.12)" : "rgba(30,64,175,.09)", color: "var(--ink)", borderRadius: 7, padding: "3px 4px 3px 7px", fontSize: 12, maxWidth: "100%" }}>
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fieldLabel(id)}</span>{extra}
      <button onClick={onRemove} style={{ border: 0, background: "none", cursor: "pointer", color: "var(--muted)", fontSize: 13, lineHeight: 1 }} aria-label="Quitar">×</button>
    </span>
  );

  function renderShelf(s: { key: Shelf; label: string; hint?: string }) {
    let body: React.ReactNode = null;
    const empty = <span style={{ fontSize: 11.5, color: "var(--faint)" }}>{s.hint ?? "Arrastrá o hacé clic en un campo"}</span>;
    if (s.key === "x" || s.key === "series" || s.key === "dateField") {
      const v = s.key === "dateField" ? w.q.dateField : w.q[s.key];
      body = v ? pill(v, () => setQ({ [s.key]: undefined } as Partial<Widget["q"]>)) : empty;
      if (s.key === "dateField" && !v && P) {
        const dates = P.fields.filter((f) => f.type === "date");
        if (dates.length) body = <span style={{ fontSize: 11.5, color: "var(--faint)" }}>Automática: {dates[0]!.label}</span>;
      }
    } else if (s.key === "rows" || s.key === "cols") {
      const arr = w.q[s.key] ?? [];
      body = arr.length ? arr.map((id) => pill(id, () => setQ({ [s.key]: arr.filter((x) => x !== id) } as Partial<Widget["q"]>))) : empty;
    } else if (s.key === "measures") {
      body = w.q.measures.length ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, width: "100%" }}>
          {w.q.measures.map((m, i) => <MeasureRow key={m.id} m={m} P={P!} type={w.type} idx={i} onChange={(mm) => setQ({ measures: w.q.measures.map((x) => (x.id === m.id ? mm : x)) })} onRemove={() => setQ({ measures: w.q.measures.filter((x) => x.id !== m.id) })} onMove={(dir) => { const a = [...w.q.measures]; const j = i + dir; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j]!, a[i]!]; setQ({ measures: a }); }} />)}
        </div>
      ) : empty;
    } else if (s.key === "target") {
      const t = w.q.target;
      body = (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, width: "100%" }}>
          {t?.field ? pill(t.field, () => setQ({ target: undefined }), (
            <select value={t.agg ?? "sum"} onChange={(e) => setQ({ target: { ...t, agg: e.target.value as Agg } })} style={{ border: 0, background: "transparent", fontSize: 11.5, color: "var(--muted)" }}>{AGG_OPTS.map((a) => <option key={a.v} value={a.v}>{a.label}</option>)}</select>
          )) : (
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input style={{ ...box, width: 120 }} inputMode="decimal" placeholder="Valor fijo" value={t?.value ?? ""} onChange={(e) => { const n = Number(e.target.value.replace(/\./g, "").replace(",", ".")); setQ({ target: e.target.value === "" ? undefined : { value: Number.isFinite(n) ? n : null, label: t?.label ?? "Meta" } }); }} />
              <span style={{ fontSize: 11.5, color: "var(--faint)" }}>o arrastrá una columna</span>
            </div>
          )}
          {t && <input style={box} placeholder="Nombre de la meta" value={t.label ?? ""} onChange={(e) => setQ({ target: { ...t, label: e.target.value } })} />}
        </div>
      );
    } else if (s.key === "filters") {
      const fs = w.q.filters ?? [];
      body = fs.length ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, width: "100%" }}>
          {fs.map((f, i) => <FilterRow key={i} f={f} P={P!} onChange={(nf) => setQ({ filters: fs.map((x, j) => (j === i ? nf : x)) })} onRemove={() => setQ({ filters: fs.filter((_, j) => j !== i) })} />)}
        </div>
      ) : empty;
    }
    return (
      <div key={s.key}>
        <span style={lbl}>{s.label}</span>
        <div {...onDropShelf(s.key)} style={{ minHeight: 34, border: "1px dashed #c9d6e6", borderRadius: 9, padding: 6, display: "flex", flexWrap: "wrap", gap: 5, alignItems: "center", transition: "background .12s" }}>{body}</div>
      </div>
    );
  }

  const isChart = ["bar", "line", "area", "combo", "pie", "donut", "scatter", "heatmap", "funnel", "waterfall"].includes(w.type);
  const xField = w.q.x ? P?.byId.get(w.q.x) : undefined;
  const tabs: { k: typeof tab; label: string; show: boolean }[] = [
    { k: "formato", label: "Formato", show: true },
    { k: "orden", label: "Orden y agrupación", show: isChart || w.type === "table" || w.type === "pivot" || w.type === "kpi" || w.type === "gauge" },
    { k: "kpi", label: "Comparación y meta", show: w.type === "kpi" || w.type === "gauge" },
    { k: "tabla", label: "Tabla", show: w.type === "table" || w.type === "pivot" },
  ];

  return (
    <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: "min(1180px, 100vw)", background: "#fff", borderLeft: "1px solid var(--line)", boxShadow: "-20px 0 60px -30px rgba(15,23,42,.45)", zIndex: 900, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderBottom: "1px solid var(--line)" }}>
        <b style={{ fontSize: 15 }}>Editar gráfico</b>
        <span className="hint" style={{ margin: 0, fontSize: 12 }}>Los cambios se ven en vivo · no te olvides de <b>Guardar tablero</b></span>
        <span style={{ flex: 1 }} />
        <button className="btn" onClick={onClose} style={{ padding: "7px 16px", fontSize: 13 }}>Listo</button>
      </div>
      <div style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "240px 320px minmax(0,1fr)", overflow: "hidden" }} className="vz-ed">
        <style>{`@media (max-width:1000px){.vz-ed{grid-template-columns:1fr!important;overflow:auto!important}.vz-ed>div{max-height:none!important;border-right:0!important}}`}</style>
        <div style={{ borderRight: "1px solid var(--line)", padding: 12, display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
          <FieldsPanel P={P} settings={settings} onSettings={(s) => onSettings(dsId, s)} onPick={(id) => addField(id)} datasetsList={datasetsList} currentDs={dsId}
            onDataset={(id) => { if (id !== dsId) { void loadDataset(id); onChange({ ...w, datasetId: id, q: { measures: [] } }); } }} loadDataset={loadDataset} datasets={datasets} />
        </div>
        <div style={{ borderRight: "1px solid var(--line)", padding: 12, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <span style={lbl}>Mostrame</span>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 4 }}>
              {sm.items.map((it) => (
                <button key={it.type} title={`${it.label} · ${it.hint}`} onClick={() => set({ type: it.type, w: it.type === "kpi" || it.type === "gauge" ? 1 : w.type === "kpi" || w.type === "gauge" ? 2 : w.w, h: it.type === "kpi" || it.type === "gauge" ? "s" : w.type === "kpi" || w.type === "gauge" ? "m" : w.h })}
                  style={{ border: w.type === it.type ? "2px solid var(--navy)" : it.type === sm.best ? "1px solid var(--cyan)" : "1px solid var(--line)", background: w.type === it.type ? "var(--navy-soft)" : "#fff", borderRadius: 8, padding: "6px 2px 4px", cursor: "pointer", opacity: it.ok ? 1 : 0.4, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, fontFamily: "inherit", position: "relative" }}>
                  <span style={{ fontSize: 14, color: "var(--navy)", lineHeight: 1 }}>{TYPE_ICON[it.type]}</span>
                  <span style={{ fontSize: 9.5, color: "var(--muted)", lineHeight: 1.1, textAlign: "center" }}>{it.label.split(" (")[0]}</span>
                  {it.type === sm.best && w.type !== it.type && <span style={{ position: "absolute", top: 1, right: 3, fontSize: 9, color: "var(--cyan-ink)" }}>★</span>}
                </button>
              ))}
            </div>
            <p className="hint" style={{ margin: "4px 0 0", fontSize: 11 }}>★ recomendado para lo que elegiste · {CHART_LABEL[w.type]}</p>
          </div>
          {w.type === "text" ? (
            <div><span style={lbl}>Texto (markdown simple)</span><textarea style={{ ...box, minHeight: 200, fontSize: 13 }} value={w.opts.text ?? ""} onChange={(e) => setO({ text: e.target.value })} placeholder={"## Título\nUna nota con **negrita** y listas:\n- punto uno"} /></div>
          ) : P ? shelvesFor(w.type).map(renderShelf) : <p className="hint">Cargando planilla…</p>}
        </div>
        <div style={{ padding: 14, overflowY: "auto", background: "var(--panel-2)", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div><span style={lbl}>Título</span><input style={box} value={w.title} onChange={(e) => set({ title: e.target.value })} /></div>
            <div><span style={lbl}>Subtítulo</span><input style={box} value={w.subtitle ?? ""} onChange={(e) => set({ subtitle: e.target.value || undefined })} placeholder="Opcional" /></div>
          </div>
          <div style={{ maxWidth: w.w === 1 ? 360 : w.w === 2 ? 620 : undefined }}>
            <WidgetCard w={w} r={preview} />
          </div>
          {w.type !== "text" && (
            <div style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 12, padding: 12 }}>
              <div style={{ display: "flex", gap: 14, borderBottom: "1px solid var(--line)", marginBottom: 10 }}>
                {tabs.filter((t) => t.show).map((t) => <button key={t.k} onClick={() => setTab(t.k)} style={{ border: 0, background: "none", padding: "6px 0", borderBottom: tab === t.k ? "2px solid #f59e0b" : "2px solid transparent", fontWeight: 600, fontSize: 12.5, color: tab === t.k ? "var(--ink)" : "var(--muted)", cursor: "pointer", fontFamily: "inherit" }}>{t.label}</button>)}
              </div>
              {tab === "formato" && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 10 }}>
                  <div><span style={lbl}>Formato del número</span><select style={box} value={w.opts.format ?? "auto"} onChange={(e) => setO({ format: e.target.value as Widget["opts"]["format"] })}>{NUM_FORMATS.map((f) => <option key={f.v} value={f.v}>{f.label}</option>)}</select></div>
                  <div><span style={lbl}>Tamaño</span>
                    <div style={{ display: "flex", gap: 6 }}>
                      <select style={box} value={w.w} onChange={(e) => set({ w: Number(e.target.value) as Widget["w"] })}>{[1, 2, 3, 4].map((n) => <option key={n} value={n}>Ancho {n}/4</option>)}</select>
                      <select style={box} value={w.h} onChange={(e) => set({ h: e.target.value as Widget["h"] })}><option value="s">Bajo</option><option value="m">Medio</option><option value="l">Alto</option></select>
                    </div>
                  </div>
                  {isChart && <div><span style={lbl}>Colores</span><select style={box} value={w.opts.palette ?? ""} onChange={(e) => setO({ palette: (e.target.value || undefined) as Widget["opts"]["palette"] })}><option value="">Automático (azul)</option><option value="azul">Azules</option><option value="teal">Teal</option><option value="pizarra">Pizarra</option><option value="mixta">Mixta (azul · teal · pizarra)</option></select></div>}
                  {isChart && <div><span style={lbl}>Etiquetas de valor</span><select style={box} value={w.opts.labels == null ? "" : w.opts.labels ? "1" : "0"} onChange={(e) => setO({ labels: e.target.value === "" ? undefined : e.target.value === "1" })}><option value="">Automático</option><option value="1">Mostrar</option><option value="0">Ocultar</option></select></div>}
                  {isChart && <div><span style={lbl}>Leyenda</span><select style={box} value={w.opts.legend == null ? "" : w.opts.legend ? "1" : "0"} onChange={(e) => setO({ legend: e.target.value === "" ? undefined : e.target.value === "1" })}><option value="">Automático</option><option value="1">Mostrar</option><option value="0">Ocultar</option></select></div>}
                  {w.type === "bar" && <div><span style={lbl}>Orientación</span><select style={box} value={w.opts.orientation ?? "v"} onChange={(e) => setO({ orientation: e.target.value as "v" | "h" })}><option value="v">Vertical</option><option value="h">Horizontal (ranking)</option></select></div>}
                  {(w.type === "bar" || w.type === "area") && <div><span style={lbl}>Apilado</span><select style={box} value={w.opts.stack ?? "none"} onChange={(e) => setO({ stack: e.target.value as Widget["opts"]["stack"] })}><option value="none">Agrupado</option><option value="stacked">Apilado</option><option value="percent">Apilado 100%</option></select></div>}
                  {(w.type === "line" || w.type === "area") && <div><span style={lbl}>Curva</span><select style={box} value={w.opts.smooth === false ? "0" : "1"} onChange={(e) => setO({ smooth: e.target.value === "1" })}><option value="1">Suave</option><option value="0">Recta</option></select></div>}
                </div>
              )}
              {tab === "orden" && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 10 }}>
                  {(xField?.type === "date" || w.type === "kpi" || w.type === "gauge" || [...(w.q.rows ?? []), ...(w.q.cols ?? [])].some((id) => P?.byId.get(id)?.type === "date")) && (
                    <div><span style={lbl}>Agrupar fechas por</span><select style={box} value={w.q.grain ?? ""} onChange={(e) => setQ({ grain: (e.target.value || undefined) as Widget["q"]["grain"] })}><option value="">Automático</option><option value="day">Día</option><option value="week">Semana</option><option value="month">Mes</option><option value="quarter">Trimestre</option><option value="year">Año</option></select></div>
                  )}
                  {w.type !== "kpi" && w.type !== "gauge" && w.type !== "pivot" && (
                    <>
                      <div><span style={lbl}>Ordenar por</span><select style={box} value={w.q.sort ? `${w.q.sort.by}:${w.q.sort.dir}` : ""} onChange={(e) => { const [by, dir] = e.target.value.split(":"); setQ({ sort: e.target.value ? { by: by as "x" | "value", dir: dir as "asc" | "desc", measure: w.q.sort?.measure } : undefined }); }}>
                        <option value="">Automático</option><option value="value:desc">Valor (mayor a menor)</option><option value="value:asc">Valor (menor a mayor)</option><option value="x:asc">Eje (A→Z / cronológico)</option><option value="x:desc">Eje (Z→A)</option>
                      </select></div>
                      {w.q.measures.length > 1 && w.q.sort?.by === "value" && <div><span style={lbl}>Según</span><select style={box} value={w.q.sort.measure ?? ""} onChange={(e) => setQ({ sort: { ...w.q.sort!, measure: e.target.value || undefined } })}>{w.q.measures.map((m) => <option key={m.id} value={m.id}>{fieldLabel(m.field)}</option>)}</select></div>}
                      <div><span style={lbl}>Top N</span>
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <input style={{ ...box, width: 70 }} type="number" min={1} placeholder="Todos" value={w.q.topN?.n ?? ""} onChange={(e) => setQ({ topN: e.target.value ? { n: Math.max(1, Number(e.target.value)), others: w.q.topN?.others ?? true } : undefined })} />
                          {w.q.topN && <label style={{ fontSize: 12, display: "flex", gap: 4, alignItems: "center" }}><input type="checkbox" checked={!!w.q.topN.others} onChange={(e) => setQ({ topN: { ...w.q.topN!, others: e.target.checked } })} />“Otros”</label>}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
              {tab === "kpi" && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 10 }}>
                  <div><span style={lbl}>Valor</span><select style={box} value={w.opts.kpiMode ?? "total"} onChange={(e) => setO({ kpiMode: e.target.value as "total" | "last" })}><option value="total">Total del período</option><option value="last">Último período con datos</option></select></div>
                  <div><span style={lbl}>Comparar contra</span><select style={box} value={w.opts.compare ?? "none"} onChange={(e) => setO({ compare: e.target.value as Widget["opts"]["compare"] })}><option value="none">Sin comparación</option><option value="prev_period">Período anterior</option><option value="prev_year">Mismo período año anterior</option></select></div>
                  <div><span style={lbl}>Sentido</span><select style={box} value={w.opts.direction ?? "up"} onChange={(e) => setO({ direction: e.target.value as "up" | "down" })}><option value="up">Más es mejor</option><option value="down">Menos es mejor (ej. costo)</option></select></div>
                  <div><span style={lbl}>Semáforo (% de la meta)</span>
                    <div style={{ display: "flex", gap: 6 }}>
                      <input style={box} type="number" title="Verde desde" value={w.opts.green ?? 100} onChange={(e) => setO({ green: Number(e.target.value) })} />
                      <input style={box} type="number" title="Amarillo desde" value={w.opts.yellow ?? 90} onChange={(e) => setO({ yellow: Number(e.target.value) })} />
                    </div>
                  </div>
                  {w.type === "kpi" && <label style={{ fontSize: 12.5, display: "flex", gap: 6, alignItems: "center" }}><input type="checkbox" checked={w.opts.spark ?? true} onChange={(e) => setO({ spark: e.target.checked })} />Mini tendencia</label>}
                </div>
              )}
              {tab === "tabla" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                    <div style={{ width: 150 }}><span style={lbl}>Filas por página</span><input style={box} type="number" min={5} value={w.opts.pageSize ?? 15} onChange={(e) => setO({ pageSize: Number(e.target.value) })} /></div>
                    {w.type === "table" && <label style={{ fontSize: 12.5, display: "flex", gap: 6, alignItems: "center" }}><input type="checkbox" checked={w.opts.totals ?? true} onChange={(e) => setO({ totals: e.target.checked })} />Fila de totales</label>}
                    {w.type === "table" && <label style={{ fontSize: 12.5, display: "flex", gap: 6, alignItems: "center" }}><input type="checkbox" checked={!!w.opts.detail} onChange={(e) => setO({ detail: e.target.checked })} />Detalle (filas sin agrupar)</label>}
                  </div>
                  <div>
                    <span style={lbl}>Formato condicional</span>
                    {w.q.measures.map((m) => { const rule = w.opts.cond?.find((c) => c.measure === m.id); const setRule = (r: CondRule | null) => setO({ cond: [...(w.opts.cond ?? []).filter((c) => c.measure !== m.id), ...(r ? [r] : [])] }); return (
                      <div key={m.id} style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 12.5, minWidth: 130, flex: "0 0 auto" }}>{m.label || fieldLabel(m.field)}</span>
                        <select style={{ ...box, width: 150 }} value={rule?.kind ?? ""} onChange={(e) => setRule(e.target.value ? { measure: m.id, kind: e.target.value as CondRule["kind"], green: rule?.green ?? 100, yellow: rule?.yellow ?? 90, dir: rule?.dir ?? "up" } : null)}>
                          <option value="">Sin formato</option><option value="bars">Barras de datos</option><option value="scale">Escala de color</option><option value="semaforo">Semáforo</option>
                        </select>
                        {rule?.kind === "semaforo" && (
                          <>
                            <select style={{ ...box, width: 120 }} value={rule.dir ?? "up"} onChange={(e) => setRule({ ...rule, dir: e.target.value as "up" | "down" })}><option value="up">Más es mejor</option><option value="down">Menos es mejor</option></select>
                            <input style={{ ...box, width: 80 }} type="number" title="Verde" value={rule.green ?? 100} onChange={(e) => setRule({ ...rule, green: Number(e.target.value) })} />
                            <input style={{ ...box, width: 80 }} type="number" title="Amarillo" value={rule.yellow ?? 90} onChange={(e) => setRule({ ...rule, yellow: Number(e.target.value) })} />
                          </>
                        )}
                      </div>
                    ); })}
                    {!w.q.measures.length && <span className="hint" style={{ fontSize: 12 }}>Sumá medidas para aplicar formato.</span>}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function autoTitle(P: Prepared, q: Widget["q"], type: ChartType): string {
  const m = q.measures[0];
  const ml = m ? (m.field === ROWS_FIELD ? "Registros" : P.byId.get(m.field)?.label ?? "") : "";
  const xl = q.x ? P.byId.get(q.x)?.label ?? "" : "";
  if (type === "kpi" || type === "gauge") return ml || "Indicador";
  if (ml && xl) return `${ml} por ${xl.toLowerCase()}`;
  return ml || xl || "Nuevo gráfico";
}

function MeasureRow({ m, P, type, idx, onChange, onRemove, onMove }: { m: Measure; P: Prepared; type: ChartType; idx: number; onChange: (m: Measure) => void; onRemove: () => void; onMove: (d: -1 | 1) => void }) {
  const [open, setOpen] = useState(false);
  const f = P.byId.get(m.field);
  const isRows = m.field === ROWS_FIELD;
  return (
    <div style={{ background: "rgba(20,184,166,.10)", borderRadius: 8, padding: "4px 6px" }}>
      <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
        {f ? <TypeBadge f={f} /> : <TypeBadge f="rows" />}
        <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={m.label || f?.label}>{m.label || (isRows ? "Cantidad de filas" : f?.label ?? "—")}</span>
        {!isRows && !f?.aggregate && <select value={m.agg} onChange={(e) => onChange({ ...m, agg: e.target.value as Agg })} style={{ border: 0, background: "transparent", fontSize: 11.5, color: "var(--muted)", fontFamily: "inherit", maxWidth: 88 }}>{AGG_OPTS.filter((a) => f?.type === "number" || ["count", "countd"].includes(a.v)).map((a) => <option key={a.v} value={a.v}>{a.label}</option>)}</select>}
        <button onClick={() => setOpen((o) => !o)} title="Más opciones" style={{ border: 0, background: "none", cursor: "pointer", color: m.calc && m.calc !== "none" ? "var(--navy)" : "var(--muted)", fontSize: 13 }}>⚙</button>
        <button onClick={onRemove} style={{ border: 0, background: "none", cursor: "pointer", color: "var(--muted)", fontSize: 13 }} aria-label="Quitar">×</button>
      </div>
      {open && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, padding: "6px 0 2px" }}>
          <input style={{ ...box, gridColumn: "1 / -1" }} placeholder="Nombre a mostrar" value={m.label ?? ""} onChange={(e) => onChange({ ...m, label: e.target.value || undefined })} />
          <select style={box} value={m.calc ?? "none"} onChange={(e) => onChange({ ...m, calc: e.target.value as TableCalc })} title="Cálculo de tabla">{CALC_OPTS.map((c) => <option key={c.v} value={c.v}>{c.label}</option>)}</select>
          {m.calc === "moving_avg" ? <input style={box} type="number" min={2} value={m.n ?? 3} onChange={(e) => onChange({ ...m, n: Number(e.target.value) })} title="Ventana" /> : (
            <select style={box} value={m.format ?? "auto"} onChange={(e) => onChange({ ...m, format: e.target.value as Measure["format"] })}>{NUM_FORMATS.map((x) => <option key={x.v} value={x.v}>{x.label}</option>)}</select>
          )}
          {type === "combo" && (
            <>
              <select style={box} value={m.mark ?? (idx === 0 ? "bar" : "line")} onChange={(e) => onChange({ ...m, mark: e.target.value as "bar" | "line" })}><option value="bar">Barras</option><option value="line">Línea</option></select>
              <select style={box} value={m.axis ?? (idx === 0 ? "left" : "right")} onChange={(e) => onChange({ ...m, axis: e.target.value as "left" | "right" })}><option value="left">Eje izquierdo</option><option value="right">Eje derecho</option></select>
            </>
          )}
          <label style={{ gridColumn: "1 / -1", display: "flex", gap: 6, alignItems: "center", fontSize: 12 }}><input type="checkbox" checked={!!m.asMeta} onChange={(e) => onChange({ ...m, asMeta: e.target.checked || undefined })} />Mostrar como meta (gris)</label>
          <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8 }}>
            <button className="vz-link" onClick={() => onMove(-1)}>↑ Subir</button>
            <button className="vz-link" onClick={() => onMove(1)}>↓ Bajar</button>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterRow({ f, P, onChange, onRemove }: { f: Filter; P: Prepared; onChange: (f: Filter) => void; onRemove: () => void }) {
  const [open, setOpen] = useState(!((f.values ?? []).length || f.rel || f.min != null || f.max != null || f.text));
  const fd = P.byId.get(f.field);
  const ref = useRef<HTMLDivElement>(null);
  const summary = (() => {
    if (!fd) return "campo inexistente";
    if (f.op === "date_relative") return DATE_PRESETS.find((p) => presetToFilter(f.field, { preset: p.v })?.rel === f.rel && (presetToFilter(f.field, { preset: p.v })?.n ?? 1) === (f.n ?? 1))?.label ?? "relativo";
    if (f.op === "between" || f.op === "gte" || f.op === "lte") return `${f.min ?? "…"} → ${f.max ?? "…"}`;
    if (f.op === "contains") return `contiene “${f.text ?? ""}”`;
    const v = f.values ?? [];
    return v.length ? `${f.op === "notin" ? "excluye " : ""}${v.length === 1 ? v[0] : `${v.length} valores`}` : "todos";
  })();
  return (
    <div ref={ref} style={{ background: "rgba(30,64,175,.07)", borderRadius: 8, padding: "4px 6px" }}>
      <div style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12.5 }}>
        <span style={{ fontWeight: 600 }}>{fd?.label ?? "—"}</span>
        <button className="vz-link" style={{ fontWeight: 500, color: "var(--muted)", flex: 1, textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} onClick={() => setOpen((o) => !o)}>{summary}</button>
        <button onClick={onRemove} style={{ border: 0, background: "none", cursor: "pointer", color: "var(--muted)" }} aria-label="Quitar">×</button>
      </div>
      {open && fd && (
        <div style={{ padding: "6px 0 2px", display: "flex", flexDirection: "column", gap: 6 }}>
          {fd.type === "date" ? (
            <>
              <select style={box} value={f.op === "date_relative" ? `rel:${f.rel}:${f.n ?? 1}:${f.anchor ?? ""}` : "range"} onChange={(e) => {
                if (e.target.value === "range") onChange({ field: f.field, op: "between", min: null, max: null });
                else { const p = DATE_PRESETS.find((x) => { const pf = presetToFilter(f.field, { preset: x.v }); return pf && `rel:${pf.rel}:${pf.n ?? 1}:${pf.anchor ?? ""}` === e.target.value; }); const pf = p && presetToFilter(f.field, { preset: p.v }); if (pf) onChange(pf); }
              }}>
                {DATE_PRESETS.filter((p) => p.v !== "all" && p.v !== "custom").map((p) => { const pf = presetToFilter(f.field, { preset: p.v })!; return <option key={p.v} value={`rel:${pf.rel}:${pf.n ?? 1}:${pf.anchor ?? ""}`}>{p.label}</option>; })}
                <option value="range">Rango de fechas…</option>
              </select>
              {f.op === "between" && (
                <div style={{ display: "flex", gap: 6 }}>
                  <input type="date" style={box} value={String(f.min ?? "")} onChange={(e) => onChange({ ...f, min: e.target.value || null })} />
                  <input type="date" style={box} value={String(f.max ?? "")} onChange={(e) => onChange({ ...f, max: e.target.value || null })} />
                </div>
              )}
            </>
          ) : fd.type === "number" && fd.role === "measure" ? (
            <div style={{ display: "flex", gap: 6 }}>
              <input style={box} inputMode="decimal" placeholder="Mínimo" value={f.min ?? ""} onChange={(e) => onChange({ ...f, op: "between", min: e.target.value === "" ? null : Number(e.target.value.replace(",", ".")) })} />
              <input style={box} inputMode="decimal" placeholder="Máximo" value={f.max ?? ""} onChange={(e) => onChange({ ...f, op: "between", max: e.target.value === "" ? null : Number(e.target.value.replace(",", ".")) })} />
            </div>
          ) : (
            <>
              <div style={{ display: "flex", gap: 6 }}>
                <select style={box} value={f.op === "contains" ? "contains" : f.op === "notin" ? "notin" : "in"} onChange={(e) => onChange({ ...f, op: e.target.value as Filter["op"] })}>
                  <option value="in">Incluir</option><option value="notin">Excluir</option><option value="contains">Contiene texto</option>
                </select>
              </div>
              {f.op === "contains" ? <input style={box} placeholder="Texto" value={f.text ?? ""} onChange={(e) => onChange({ ...f, text: e.target.value })} />
                : <ValuesPickerLite P={P} field={f.field} sel={f.values ?? []} onChange={(v) => onChange({ ...f, values: v })} />}
            </>
          )}
        </div>
      )}
    </div>
  );
}
