// Config de tablero v2: upgrade de configs viejas (builder v1), saneo/validación (también de lo
// que devuelve la IA), filtros de tablero y filtros cruzados → Filter[] por dataset.
import type { Agg, ChartType, CrossFilter, DashFilter, DashFilterState, DashboardV2, DatasetSettings, DateGrain, Filter, Measure, NumFormat, Query, TableCalc, Widget, WidgetOpts } from "./types";
import type { Prepared } from "./schema";
import { ROWS_FIELD } from "./schema";

export const CHART_TYPES: ChartType[] = ["kpi", "bar", "line", "area", "combo", "pie", "donut", "scatter", "heatmap", "table", "pivot", "funnel", "waterfall", "gauge", "text"];
const AGGS: Agg[] = ["sum", "avg", "min", "max", "count", "countd", "median", "last"];
const CALCS: TableCalc[] = ["none", "pct_total", "running", "moving_avg", "diff_prev", "pct_prev", "yoy", "yoy_pct"];
const FORMATS: NumFormat[] = ["auto", "number", "integer", "decimal", "currency", "percent", "pct_frac", "ratio"];
const GRAINS: DateGrain[] = ["day", "week", "month", "quarter", "year"];
const OPS: Filter["op"][] = ["in", "notin", "between", "gte", "lte", "contains", "date_relative", "bucket"];

export function uid(prefix = "w"): string {
  const r = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${r}`;
}

// ── Upgrade de la config v1 ──
interface LegacyWidget { id?: string; type?: string; title?: string; x?: string; metrics?: string[]; metaCol?: string; agg?: string; unit?: string; span?: number }
const UNIT_FMT: Record<string, NumFormat> = { $: "currency", "%": "percent", x: "ratio" };

export function upgradeWidget(o: LegacyWidget): Widget {
  const agg = (AGGS.includes(o.agg as Agg) ? o.agg : "sum") as Agg;
  const format = UNIT_FMT[o.unit ?? ""] ?? undefined;
  const mets = (o.metrics ?? []).filter(Boolean);
  const measures: Measure[] = mets.map((f, i) => ({ id: `m${i}`, field: f, agg, format }));
  const target = o.metaCol ? { field: o.metaCol, agg } : undefined;
  const base = { id: o.id || uid(), title: o.title || "Gráfico", q: { x: o.x || undefined, measures, target } as Query, h: "m" as const, opts: { format } as WidgetOpts };
  const wide = o.span === 2 ? 4 : 2;
  switch (o.type) {
    case "kpi": return { ...base, type: "kpi", w: 1, q: { ...base.q, x: undefined }, opts: { ...base.opts, kpiMode: "total", compare: "none", spark: true } };
    case "lines": return { ...base, type: "line", w: wide };
    case "combo": return { ...base, type: "combo", w: wide, q: { ...base.q, measures: measures.map((m, i) => ({ ...m, mark: i === 0 ? "bar" : "line", axis: i === 0 ? "left" : "right" })) } };
    case "hbar": return { ...base, type: "bar", w: wide, q: { ...base.q, measures: measures.slice(0, 1), sort: { by: "value", dir: "desc" }, topN: { n: 20 } }, opts: { ...base.opts, orientation: "h" } };
    case "donut": return { ...base, type: "donut", w: wide, q: { ...base.q, measures: measures.slice(0, 1), topN: { n: 20 } } };
    case "table": return { ...base, type: "table", w: wide, h: "l", q: { ...base.q, target: undefined }, opts: { ...base.opts, detail: true, pageSize: 25 } };
    default: return { ...base, type: "bar", w: wide };
  }
}

/** Lee cualquier config guardada (v1 o v2) y devuelve una DashboardV2 saneada. */
export function upgradeDashboard(raw: unknown, meta: { title?: string; datasetId?: string | null } = {}): DashboardV2 {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  if (o.v === 2) return sanitizeDashboard({ ...o, title: (o.title as string) || meta.title || "", datasetId: (o.datasetId as string | null) ?? meta.datasetId ?? null });
  const widgets = Array.isArray(o.widgets) ? (o.widgets as LegacyWidget[]).map(upgradeWidget) : [];
  return sanitizeDashboard({ v: 2, title: meta.title ?? "", datasetId: meta.datasetId ?? null, datasets: {}, widgets, filters: [] });
}

// ── Saneo ──
const str = (v: unknown, max = 200): string | undefined => (typeof v === "string" && v.trim() ? v.slice(0, max) : undefined);
const oneOf = <T extends string>(v: unknown, list: readonly T[], def: T): T => (list.includes(v as T) ? (v as T) : def);
const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : undefined);

function sanitizeFilter(f: unknown, P?: Prepared): Filter | null {
  if (!f || typeof f !== "object") return null;
  const o = f as Record<string, unknown>;
  const field = str(o.field);
  if (!field || (P && !P.byId.has(field))) return null;
  const op = oneOf(o.op, OPS, "in");
  const out: Filter = { field, op };
  if (Array.isArray(o.values)) out.values = o.values.map(String).slice(0, 500);
  if (o.min != null) out.min = typeof o.min === "number" ? o.min : String(o.min);
  if (o.max != null) out.max = typeof o.max === "number" ? o.max : String(o.max);
  if (o.text != null) out.text = String(o.text).slice(0, 200);
  if (o.rel) out.rel = o.rel as Filter["rel"];
  if (num(o.n) != null) out.n = Math.max(1, Math.min(3650, Math.round(num(o.n)!)));
  if (o.grain) out.grain = oneOf(o.grain, GRAINS, "month");
  if (o.anchor === "datos" || o.anchor === "hoy") out.anchor = o.anchor;
  return out;
}

export function sanitizeWidget(raw: unknown, P?: Prepared): Widget | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const type = oneOf(o.type, CHART_TYPES, "bar");
  const qr = (o.q && typeof o.q === "object" ? o.q : {}) as Record<string, unknown>;
  const okField = (f: unknown): string | undefined => { const s = str(f); return s && (!P || P.byId.has(s)) ? s : undefined; };
  const measures: Measure[] = (Array.isArray(qr.measures) ? qr.measures : []).slice(0, 8).map((m, i): Measure | null => {
    if (!m || typeof m !== "object") return null;
    const mm = m as Record<string, unknown>;
    const field = str(mm.field) === ROWS_FIELD ? ROWS_FIELD : okField(mm.field);
    if (!field) return null;
    return {
      id: str(mm.id, 40) ?? `m${i}`, field, agg: oneOf(mm.agg, AGGS, "sum"), label: str(mm.label, 80),
      format: mm.format ? oneOf(mm.format, FORMATS, "auto") : undefined, calc: mm.calc ? oneOf(mm.calc, CALCS, "none") : undefined,
      n: num(mm.n), axis: mm.axis === "right" ? "right" : mm.axis === "left" ? "left" : undefined, mark: mm.mark === "line" ? "line" : mm.mark === "bar" ? "bar" : undefined,
      asMeta: mm.asMeta === true ? true : undefined,
    };
  }).filter((m): m is Measure => !!m);
  // ids de medida únicos
  const seen = new Set<string>();
  measures.forEach((m, i) => { if (seen.has(m.id)) m.id = `m${i}_${Math.random().toString(36).slice(2, 5)}`; seen.add(m.id); });
  const tr = (qr.target && typeof qr.target === "object" ? qr.target : null) as Record<string, unknown> | null;
  const target = tr ? { field: okField(tr.field), agg: tr.agg ? oneOf(tr.agg, AGGS, "sum") : undefined, value: num(tr.value) ?? null, label: str(tr.label, 60) } : undefined;
  const sr = (qr.sort && typeof qr.sort === "object" ? qr.sort : null) as Record<string, unknown> | null;
  const q: Query = {
    x: okField(qr.x), series: okField(qr.series),
    rows: Array.isArray(qr.rows) ? qr.rows.map(okField).filter((x): x is string => !!x).slice(0, 4) : undefined,
    cols: Array.isArray(qr.cols) ? qr.cols.map(okField).filter((x): x is string => !!x).slice(0, 3) : undefined,
    measures,
    filters: Array.isArray(qr.filters) ? qr.filters.map((f) => sanitizeFilter(f, P)).filter((f): f is Filter => !!f) : undefined,
    grain: qr.grain ? oneOf(qr.grain, GRAINS, "month") : undefined,
    sort: sr ? { by: oneOf(sr.by, ["x", "value", "none"] as const, "value"), dir: sr.dir === "asc" ? "asc" : "desc", measure: str(sr.measure, 40) } : undefined,
    topN: qr.topN && typeof qr.topN === "object" && num((qr.topN as Record<string, unknown>).n) ? { n: Math.max(1, Math.min(200, Math.round(num((qr.topN as Record<string, unknown>).n)!))), others: Boolean((qr.topN as Record<string, unknown>).others) } : undefined,
    target: target && (target.field || target.value != null) ? target : undefined,
    dateField: okField(qr.dateField),
  };
  const op = (o.opts && typeof o.opts === "object" ? o.opts : {}) as Record<string, unknown>;
  const opts: WidgetOpts = {};
  if (op.orientation === "h" || op.orientation === "v") opts.orientation = op.orientation;
  if (op.stack) opts.stack = oneOf(op.stack, ["none", "stacked", "percent"] as const, "none");
  for (const k of ["labels", "legend", "spark", "totals", "detail", "smooth"] as const) if (typeof op[k] === "boolean") opts[k] = op[k] as boolean;
  if (op.palette) opts.palette = oneOf(op.palette, ["azul", "teal", "pizarra", "mixta"] as const, "azul");
  if (op.format) opts.format = oneOf(op.format, FORMATS, "auto");
  if (op.kpiMode) opts.kpiMode = op.kpiMode === "last" ? "last" : "total";
  if (op.compare) opts.compare = oneOf(op.compare, ["none", "prev_period", "prev_year"] as const, "none");
  if (op.direction) opts.direction = op.direction === "down" ? "down" : "up";
  if (num(op.green) != null) opts.green = num(op.green);
  if (num(op.yellow) != null) opts.yellow = num(op.yellow);
  if (num(op.pageSize) != null) opts.pageSize = Math.max(5, Math.min(200, Math.round(num(op.pageSize)!)));
  if (typeof op.text === "string") opts.text = op.text.slice(0, 5000);
  if (Array.isArray(op.cond)) opts.cond = op.cond.filter((c) => c && typeof c === "object").slice(0, 10).map((c) => {
    const cc = c as Record<string, unknown>;
    return { measure: String(cc.measure ?? ""), kind: oneOf(cc.kind, ["bars", "scale", "semaforo"] as const, "bars"), green: num(cc.green), yellow: num(cc.yellow), dir: cc.dir === "down" ? "down" as const : "up" as const };
  });
  const w = num(o.w);
  return {
    id: str(o.id, 60) ?? uid(), type, title: str(o.title, 140) ?? "", subtitle: str(o.subtitle, 200),
    datasetId: str(o.datasetId, 60), q,
    w: (w && w >= 1 && w <= 4 ? Math.round(w) : type === "kpi" || type === "gauge" ? 1 : 2) as Widget["w"],
    h: oneOf(o.h, ["s", "m", "l"] as const, type === "kpi" || type === "gauge" || type === "text" ? "s" : "m"),
    opts,
  };
}

export function sanitizeDashboard(raw: unknown): DashboardV2 {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const datasets: Record<string, DatasetSettings> = {};
  const dsr = (o.datasets && typeof o.datasets === "object" ? o.datasets : {}) as Record<string, unknown>;
  for (const [id, v] of Object.entries(dsr).slice(0, 10)) {
    const s = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
    const fields: DatasetSettings["fields"] = {};
    for (const [fid, fo] of Object.entries((s.fields && typeof s.fields === "object" ? s.fields : {}) as Record<string, Record<string, unknown>>)) {
      if (!fo || typeof fo !== "object") continue;
      fields[fid] = {
        label: str(fo.label, 80),
        type: fo.type ? oneOf(fo.type, ["date", "number", "text", "boolean"] as const, "text") : undefined,
        role: fo.role ? oneOf(fo.role, ["dimension", "measure"] as const, "dimension") : undefined,
        format: fo.format ? oneOf(fo.format, FORMATS, "auto") : undefined,
        hidden: fo.hidden === true ? true : undefined,
      };
    }
    const calcs = (Array.isArray(s.calcs) ? s.calcs : []).slice(0, 60).map((c) => c as Record<string, unknown>).filter((c) => str(c?.id) && str(c?.name) && typeof c?.expr === "string")
      .map((c) => ({ id: String(c.id).slice(0, 60), name: String(c.name).slice(0, 80), expr: String(c.expr).slice(0, 2000), format: c.format ? oneOf(c.format, FORMATS, "auto") : undefined }));
    const blends = (Array.isArray(s.blends) ? s.blends : []).slice(0, 5).map((b) => b as Record<string, unknown>).filter((b) => str(b?.id) && str(b?.datasetId) && str(b?.localKey) && b?.remoteKey != null)
      .map((b) => ({ id: String(b.id), datasetId: String(b.datasetId), localKey: String(b.localKey), remoteKey: String(b.remoteKey), fields: Array.isArray(b.fields) ? b.fields.map(String).slice(0, 30) : [] }));
    datasets[id] = { fields, calcs, blends };
  }
  const widgets = (Array.isArray(o.widgets) ? o.widgets : []).slice(0, 60).map((w) => sanitizeWidget(w)).filter((w): w is Widget => !!w);
  const filters: DashFilter[] = (Array.isArray(o.filters) ? o.filters : []).slice(0, 12).map((f) => f as Record<string, unknown>)
    .filter((f) => str(f?.field) && str(f?.datasetId))
    .map((f) => ({ id: str(f.id, 60) ?? uid("f"), datasetId: String(f.datasetId), field: String(f.field), kind: f.kind === "date" ? "date" : "list", label: str(f.label, 60) }));
  return { v: 2, title: str(o.title, 140) ?? "", description: str(o.description, 400), datasetId: str(o.datasetId, 60) ?? null, datasets, widgets, filters };
}

// ── Filtros de tablero ──
export const DATE_PRESETS: { v: string; label: string }[] = [
  { v: "all", label: "Todo el período" },
  { v: "last_data_month", label: "Último mes con datos" },
  { v: "this_month", label: "Mes actual" },
  { v: "prev_month", label: "Mes anterior" },
  { v: "last_3m", label: "Últimos 3 meses" },
  { v: "last_6m", label: "Últimos 6 meses" },
  { v: "last_12m", label: "Últimos 12 meses" },
  { v: "this_quarter", label: "Trimestre actual" },
  { v: "ytd", label: "Año a la fecha (YTD)" },
  { v: "this_year", label: "Año actual" },
  { v: "prev_year", label: "Año anterior" },
  { v: "last_30d", label: "Últimos 30 días" },
  { v: "custom", label: "Personalizado…" },
];

export function presetToFilter(field: string, st: { preset: string; from?: string; to?: string } | undefined): Filter | null {
  if (!st || st.preset === "all") return null;
  switch (st.preset) {
    case "last_data_month": return { field, op: "date_relative", rel: "this_month", anchor: "datos" };
    case "this_month": return { field, op: "date_relative", rel: "this_month" };
    case "prev_month": return { field, op: "date_relative", rel: "prev_month" };
    case "last_3m": return { field, op: "date_relative", rel: "last_n_months", n: 3 };
    case "last_6m": return { field, op: "date_relative", rel: "last_n_months", n: 6 };
    case "last_12m": return { field, op: "date_relative", rel: "last_n_months", n: 12 };
    case "this_quarter": return { field, op: "date_relative", rel: "this_quarter" };
    case "ytd": return { field, op: "date_relative", rel: "ytd" };
    case "this_year": return { field, op: "date_relative", rel: "this_year" };
    case "prev_year": return { field, op: "date_relative", rel: "prev_year" };
    case "last_30d": return { field, op: "date_relative", rel: "last_n_days", n: 30 };
    case "custom": return st.from || st.to ? { field, op: "between", min: st.from ?? null, max: st.to ?? null } : null;
  }
  return null;
}

/** Filtros efectivos para un widget: los de tablero de su dataset + cruzados (de OTROS widgets). */
export function effectiveFilters(datasetId: string, widgetId: string, dashFilters: DashFilter[], state: DashFilterState, cross: CrossFilter[]): Filter[] {
  const out: Filter[] = [];
  for (const df of dashFilters) {
    if (df.datasetId !== datasetId) continue;
    if (df.kind === "date") { const f = presetToFilter(df.field, state.date?.[df.id]); if (f) out.push(f); }
    else { const vals = state.list?.[df.id]; if (vals?.length) out.push({ field: df.field, op: "in", values: vals }); }
  }
  for (const c of cross) {
    if (c.datasetId !== datasetId || c.sourceWidget === widgetId) continue;
    out.push({ field: c.field, op: c.grain ? "bucket" : "in", values: [c.key], grain: c.grain });
  }
  return out;
}

/** Widget nuevo con defaults razonables. */
export function newWidget(type: ChartType, datasetId?: string): Widget {
  return {
    id: uid(), type, title: type === "text" ? "" : "Nuevo gráfico", datasetId,
    q: { measures: [] }, w: type === "kpi" || type === "gauge" ? 1 : 2, h: type === "kpi" || type === "gauge" || type === "text" ? "s" : "m",
    opts: type === "kpi" ? { kpiMode: "total", compare: "none", spark: true } : type === "text" ? { text: "## Título\nNota o comentario del tablero." } : {},
  };
}
