// Ejecución de queries sobre un dataset preparado: filtros (lista, rango, relativo, bucket),
// agrupación por dimensiones (con granularidad de fecha), medidas agregadas (incluye calculados
// agregados evaluados DESPUÉS de agrupar), orden, top N + "Otros", cálculos de tabla (% del
// total, acumulado, media móvil, vs anterior, interanual), meta, KPI con comparación y pivot.
import type { Agg, ChartType, DateGrain, Field, Filter, Measure, NumFormat, Query } from "./types";
import { evaluate } from "./expr";
import { bucketKey, bucketLabel, fmtDate, keyToStart, parseDate, shiftKey } from "./parse";
import { fieldRange, firstDateField, rowVal, ROWS_FIELD, type Prepared } from "./schema";

export interface QueryCtx { now?: number; extra?: Filter[] }
export interface DimMeta { field: string; label: string; grain?: DateGrain; type: Field["type"] }
export interface MeasureMeta { id: string; label: string; format: NumFormat; axis?: "left" | "right"; mark?: "bar" | "line"; asMeta?: boolean }
export interface ResultRow { keys: string[]; labels: string[]; values: (number | null)[]; target?: number | null }
export interface KpiResult {
  value: number | null; prev: number | null; deltaPct: number | null;
  target: number | null; cumpl: number | null;
  periodLabel: string; prevLabel: string;
  spark: { key: string; label: string; value: number | null }[];
}
export interface PivotRow { level: number; leaf: boolean; keys: string[]; labels: string[]; cells: (number | null)[][] }
export interface PivotResult { rowDims: DimMeta[]; colDims: DimMeta[]; colKeys: { keys: string[]; label: string }[]; rows: PivotRow[]; grand: (number | null)[][] }
export interface DetailResult { header: { id: string; label: string; format: NumFormat; type: Field["type"] }[]; rows: (string | number | null)[][]; total: number }
export interface Result {
  dims: DimMeta[];
  measures: MeasureMeta[];
  rows: ResultRow[];
  xKeys: { key: string; label: string }[];
  seriesKeys: { key: string; label: string }[];
  totals: (number | null)[];
  targetLabel?: string;
  hasTarget: boolean;
  kpi?: KpiResult;
  pivot?: PivotResult;
  detail?: DetailResult;
  rowCount: number;
  warnings: string[];
  error?: string;
}

const DAY = 86400000;
export const OTROS = "__otros";
const EMPTY = "(vacío)";

// ── Claves de dimensión ──
export function autoGrain(P: Prepared, id: string): DateGrain {
  const f = P.byId.get(id);
  if (f?.monthOnly) return "month";
  const r = fieldRange(P, id);
  if (!r) return "month";
  const span = (r[1] - r[0]) / DAY;
  if (span <= 62) return "day";
  if (span > 365 * 6) return "year";
  return "month";
}

function dimKeyFn(P: Prepared, id: string, grain?: DateGrain): (i: number) => string {
  const f = P.byId.get(id);
  const s = P.str.get(id);
  if (s) return (i) => s[i] ?? EMPTY;
  const a = P.num.get(id);
  if (!a || !f) return () => EMPTY;
  if (f.type === "date") { const g = grain ?? "month"; return (i) => (Number.isNaN(a[i]) ? EMPTY : bucketKey(a[i]!, g)); }
  if (f.type === "boolean") return (i) => (Number.isNaN(a[i]) ? EMPTY : a[i] === 1 ? "Sí" : "No");
  return (i) => (Number.isNaN(a[i]) ? EMPTY : String(a[i]));
}

function dimLabel(f: Field | undefined, key: string, grain: DateGrain | undefined, withYear: boolean): string {
  if (key === OTROS) return "Otros";
  if (key === EMPTY || !f) return key;
  if (f.type === "date") return bucketLabel(key, grain ?? "month", withYear && !f.monthOnly);
  if (f.type === "number") { const n = Number(key); return Number.isFinite(n) ? (Number.isInteger(n) && Math.abs(n) < 10000 ? String(n) : n.toLocaleString("es-AR")) : key; }
  return key;
}

// ── Filtros ──
function shiftKeyNext(key: string, g: DateGrain): string {
  const t = keyToStart(key, g);
  const d = new Date(t);
  const y = d.getUTCFullYear(), m = d.getUTCMonth();
  if (g === "day") return bucketKey(t + DAY, g);
  if (g === "week") return bucketKey(t + 7 * DAY, g);
  if (g === "month") return bucketKey(Date.UTC(y, m + 1, 1), g);
  if (g === "quarter") return bucketKey(Date.UTC(y, m + 3, 1), g);
  return bucketKey(Date.UTC(y + 1, 0, 1), g);
}
function relRange(f: Filter, now: number): [number, number] {
  const d = new Date(now);
  const y = d.getUTCFullYear(), m = d.getUTCMonth();
  const today = Date.UTC(y, m, d.getUTCDate());
  const n = Math.max(1, f.n ?? 1);
  switch (f.rel) {
    case "last_n_days": return [today - (n - 1) * DAY, today + DAY];
    case "last_n_months": return [Date.UTC(y, m - n + 1, 1), Date.UTC(y, m + 1, 1)];
    case "this_month": return [Date.UTC(y, m, 1), Date.UTC(y, m + 1, 1)];
    case "prev_month": return [Date.UTC(y, m - 1, 1), Date.UTC(y, m, 1)];
    case "this_quarter": { const q = Math.floor(m / 3) * 3; return [Date.UTC(y, q, 1), Date.UTC(y, q + 3, 1)]; }
    case "this_year": return [Date.UTC(y, 0, 1), Date.UTC(y + 1, 0, 1)];
    case "ytd": return [Date.UTC(y, 0, 1), today + DAY];
    case "prev_year": return [Date.UTC(y - 1, 0, 1), Date.UTC(y, 0, 1)];
    default: return [-Infinity, Infinity];
  }
}
const toBound = (v: number | string | null | undefined, end: boolean): number | null => {
  if (v == null || v === "") return null;
  if (typeof v === "number") return v;
  const d = parseDate(v);
  if (d) return end ? d.t + DAY : d.t;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Rango [desde, hasta) de fecha que impone un filtro (si es de fecha). */
export function filterDateRange(P: Prepared, f: Filter, now: number): [number, number] | null {
  const fd = P.byId.get(f.field);
  if (!fd || fd.type !== "date") return null;
  if (f.op === "date_relative") {
    let ref = now;
    if (f.anchor === "datos") { const r = fieldRange(P, f.field); if (r) ref = r[1]; }
    return relRange(f, ref);
  }
  if (f.op === "bucket" && f.grain && f.values?.length === 1) {
    const a = keyToStart(f.values[0]!, f.grain);
    const b = keyToStart(shiftKeyNext(f.values[0]!, f.grain), f.grain);
    return [a, b];
  }
  if (f.op === "between" || f.op === "gte" || f.op === "lte") {
    const a = f.op === "lte" ? -Infinity : toBound(f.min, false) ?? -Infinity;
    const b = f.op === "gte" ? Infinity : toBound(f.max, true) ?? Infinity;
    return [a, b];
  }
  return null;
}

function applyFilter(P: Prepared, f: Filter, idx: number[], now: number, warn: string[]): number[] {
  const fd = P.byId.get(f.field);
  if (!fd) { warn.push("Un filtro usa un campo que ya no existe."); return idx; }
  const a = P.num.get(f.field), s = P.str.get(f.field);
  if (f.op === "in" || f.op === "notin" || f.op === "bucket") {
    const set = new Set(f.values ?? []);
    if (!set.size) return idx;
    const key = dimKeyFn(P, f.field, f.grain);
    const keep = f.op !== "notin";
    return idx.filter((i) => set.has(key(i)) === keep);
  }
  if (f.op === "contains") {
    const t = (f.text ?? "").toLowerCase().trim();
    if (!t) return idx;
    const key = dimKeyFn(P, f.field);
    return idx.filter((i) => key(i).toLowerCase().includes(t));
  }
  const dr = filterDateRange(P, f, now);
  if (dr && a) return idx.filter((i) => a[i]! >= dr[0] && a[i]! < dr[1]);
  if (a && fd.type !== "date") {
    const lo = f.op === "lte" ? -Infinity : typeof f.min === "number" ? f.min : f.min != null && f.min !== "" ? Number(f.min) : -Infinity;
    const hi = f.op === "gte" ? Infinity : typeof f.max === "number" ? f.max : f.max != null && f.max !== "" ? Number(f.max) : Infinity;
    return idx.filter((i) => a[i]! >= lo && a[i]! <= hi);
  }
  void s;
  return idx;
}

function allIdx(n: number): number[] { const o = new Array<number>(n); for (let i = 0; i < n; i++) o[i] = i; return o; }

export function filterRows(P: Prepared, filters: Filter[], now: number, warn: string[] = [], skipField?: string): number[] {
  let idx = allIdx(P.n);
  for (const f of filters) {
    if (skipField && f.field === skipField && P.byId.get(f.field)?.type === "date" && f.op !== "in" && f.op !== "notin" && f.op !== "bucket") continue;
    if (skipField && f.field === skipField && f.op === "bucket") continue;
    idx = applyFilter(P, f, idx, now, warn);
  }
  return idx;
}

// ── Medidas ──
function aggNums(vals: number[], how: Agg): number | null {
  if (how === "count") return vals.length;
  if (!vals.length) return null;
  switch (how) {
    case "sum": { let s = 0; for (const v of vals) s += v; return s; }
    case "avg": { let s = 0; for (const v of vals) s += v; return s / vals.length; }
    case "min": { let m = Infinity; for (const v of vals) if (v < m) m = v; return m; }
    case "max": { let m = -Infinity; for (const v of vals) if (v > m) m = v; return m; }
    case "last": return vals[vals.length - 1]!;
    case "median": { const s = [...vals].sort((x, y) => x - y); const k = s.length >> 1; return s.length % 2 ? s[k]! : (s[k - 1]! + s[k]!) / 2; }
    case "countd": return new Set(vals).size;
  }
  return null;
}

/** Calcula una medida sobre un conjunto de filas. */
export function computeMeasure(P: Prepared, m: Pick<Measure, "field" | "agg">, idx: number[]): number | null {
  if (m.field === ROWS_FIELD || !m.field) return idx.length;
  const f = P.byId.get(m.field);
  if (!f || f.error) return null;
  if (f.aggregate) return evalAggCalc(P, f.id, idx);
  const a = P.num.get(f.id);
  if (m.agg === "countd") {
    const key = dimKeyFn(P, f.id, "day");
    const set = new Set<string>();
    for (const i of idx) { const k = key(i); if (k !== EMPTY) set.add(k); }
    return set.size;
  }
  if (!a || f.type === "text") {
    if (m.agg === "count" || f.type === "text") { const s = P.str.get(f.id); let c = 0; for (const i of idx) if (s ? s[i] != null : true) c++; return c; }
  }
  if (!a) return null;
  const vals: number[] = [];
  for (const i of idx) { const x = a[i]; if (!Number.isNaN(x)) vals.push(x!); }
  return aggNums(vals, m.agg);
}

function evalAggCalc(P: Prepared, id: string, idx: number[]): number | null {
  const comp = P.compiled.get(id);
  if (!comp) return null;
  const aggVals = comp.aggs.map((ag) => {
    if (!ag.arg) return idx.length;
    const ck = `aggarg:${id}:${ag.idx}`;
    let col = P.cache.get(ck) as { num: Float64Array; key: (string | null)[] } | undefined;
    if (!col) {
      const num = new Float64Array(P.n);
      const key: (string | null)[] = new Array(P.n);
      for (let i = 0; i < P.n; i++) {
        let v;
        try { v = evaluate(ag.arg, (fid) => rowVal(P, fid, i)); } catch { v = null; }
        const n = v == null ? NaN : typeof v === "number" ? v : typeof v === "boolean" ? (v ? 1 : 0) : v instanceof Date ? v.getTime() : Number.isFinite(Number(v)) ? Number(v) : NaN;
        num[i] = n;
        key[i] = v == null || v === "" ? null : v instanceof Date ? v.toISOString() : String(v);
      }
      col = { num, key };
      P.cache.set(ck, col);
    }
    if (ag.fn === "count") { let c = 0; for (const i of idx) if (col.key[i] != null) c++; return c; }
    if (ag.fn === "countd") { const s = new Set<string>(); for (const i of idx) { const k = col.key[i]; if (k != null) s.add(k); } return s.size; }
    const vals: number[] = [];
    for (const i of idx) { const x = col.num[i]; if (!Number.isNaN(x)) vals.push(x!); }
    return aggNums(vals, ag.fn);
  });
  try {
    const v = evaluate(comp.ast, () => null, aggVals);
    return typeof v === "number" && Number.isFinite(v) ? v : typeof v === "boolean" ? (v ? 1 : 0) : null;
  } catch { return null; }
}

/** Formato efectivo de una medida (el de la tabla-calc manda). */
export function measureFormat(P: Prepared, m: Measure): NumFormat {
  if (m.calc === "pct_total" || m.calc === "pct_prev" || m.calc === "yoy_pct") return "percent";
  if (m.format && m.format !== "auto") return m.format;
  if (m.agg === "count" || m.agg === "countd" || m.field === ROWS_FIELD) return "integer";
  return P.byId.get(m.field)?.format ?? "auto";
}

const AGG_LBL: Record<Agg, string> = { sum: "", avg: "Prom. ", min: "Mín. ", max: "Máx. ", count: "Cant. ", countd: "Distintos ", median: "Mediana ", last: "Último " };
const CALC_LBL: Record<string, string> = { pct_total: " (% del total)", running: " (acumulado)", moving_avg: " (media móvil)", diff_prev: " (vs anterior)", pct_prev: " (% vs anterior)", yoy: " (vs año ant.)", yoy_pct: " (% interanual)" };
export function measureLabel(P: Prepared, m: Measure): string {
  if (m.label?.trim()) return m.label.trim();
  if (m.field === ROWS_FIELD) return "Cantidad de filas";
  const f = P.byId.get(m.field);
  const base = f?.label ?? "—";
  const agg = f?.aggregate ? "" : AGG_LBL[m.agg] ?? "";
  return `${agg}${base}${m.calc && m.calc !== "none" ? CALC_LBL[m.calc] ?? "" : ""}`;
}

// ── Query principal ──
const qcacheKey = (q: Query, ctx: QueryCtx, type: ChartType, detail: boolean) => JSON.stringify([q, ctx.extra ?? [], Math.floor((ctx.now ?? Date.now()) / DAY), type, detail]);

export function runQuery(P: Prepared, q: Query, type: ChartType, ctx: QueryCtx = {}, opts: { kpiMode?: "total" | "last"; compare?: "none" | "prev_period" | "prev_year"; detail?: boolean; direction?: "up" | "down" } = {}): Result {
  const key = "q:" + qcacheKey(q, ctx, type, !!opts.detail) + JSON.stringify(opts);
  const hit = P.cache.get(key) as Result | undefined;
  if (hit) return hit;
  let res: Result;
  try { res = doQuery(P, q, type, ctx, opts); }
  catch (e) { res = { dims: [], measures: [], rows: [], xKeys: [], seriesKeys: [], totals: [], hasTarget: false, rowCount: 0, warnings: [], error: e instanceof Error ? e.message : "Error al calcular" }; }
  // LRU simple
  const qk = [...P.cache.keys()].filter((k) => k.startsWith("q:"));
  if (qk.length > 300) for (const k of qk.slice(0, 100)) P.cache.delete(k);
  P.cache.set(key, res);
  return res;
}

function doQuery(P: Prepared, q: Query, type: ChartType, ctx: QueryCtx, opts: { kpiMode?: "total" | "last"; compare?: "none" | "prev_period" | "prev_year"; detail?: boolean; direction?: "up" | "down" }): Result {
  const now = ctx.now ?? Date.now();
  const warnings: string[] = [];
  const filters = [...(q.filters ?? []), ...(ctx.extra ?? [])];
  const idx = filterRows(P, filters, now, warnings);
  const measures = (q.measures ?? []).filter((m) => m.field === ROWS_FIELD || P.byId.has(m.field));
  for (const m of measures) { const f = P.byId.get(m.field); if (f?.error) warnings.push(`El cálculo “${f.label}” tiene un error: ${f.error}`); }
  const mMeta: MeasureMeta[] = measures.map((m) => ({ id: m.id, label: measureLabel(P, m), format: measureFormat(P, m), axis: m.axis, mark: m.mark, asMeta: m.asMeta }));
  const base: Result = { dims: [], measures: mMeta, rows: [], xKeys: [], seriesKeys: [], totals: [], hasTarget: false, rowCount: idx.length, warnings: [...P.warnings, ...warnings] };
  base.totals = measures.map((m) => computeMeasure(P, m, idx));

  // Target (meta)
  const tgt = q.target;
  const hasTargetField = !!tgt?.field && P.byId.has(tgt.field);
  const hasTargetConst = tgt?.value != null && Number.isFinite(tgt.value);
  base.hasTarget = hasTargetField || hasTargetConst;
  if (base.hasTarget) base.targetLabel = tgt?.label || (hasTargetField ? P.byId.get(tgt!.field!)!.label : "Meta");
  const targetOf = (ix: number[]): number | null => (hasTargetField ? computeMeasure(P, { field: tgt!.field!, agg: tgt!.agg ?? "sum" }, ix) : hasTargetConst ? tgt!.value! : null);

  if (type === "text") return base;
  if (type === "kpi" || type === "gauge") {
    base.kpi = kpi(P, q, measures[0], idx, filters, now, opts, targetOf);
    return base;
  }
  if ((type === "table" && (opts.detail || !measures.length))) {
    base.detail = detail(P, q, idx);
    return base;
  }
  if (type === "pivot") {
    base.pivot = pivot(P, q, measures, idx);
    return base;
  }

  // Dimensiones: x (+ serie). Heatmap usa cols[0] como 2ª dimensión si no hay serie.
  const dimIds = [q.x, q.series ?? (type === "heatmap" ? q.cols?.[0] : undefined)].filter((d): d is string => !!d && P.byId.has(d));
  if (type === "table" && q.rows?.length) for (const r of q.rows) if (P.byId.has(r) && !dimIds.includes(r)) dimIds.push(r);
  const dims: DimMeta[] = dimIds.map((id) => { const f = P.byId.get(id)!; return { field: id, label: f.label, type: f.type, grain: f.type === "date" ? q.grain ?? autoGrain(P, id) : undefined }; });
  base.dims = dims;
  const keyFns = dims.map((d) => dimKeyFn(P, d.field, d.grain));

  // Agrupar
  const groups = new Map<string, { keys: string[]; idx: number[] }>();
  for (const i of idx) {
    const keys = keyFns.map((fn) => fn(i));
    const k = keys.join("\u0001");
    let g = groups.get(k);
    if (!g) { g = { keys, idx: [] }; groups.set(k, g); }
    g.idx.push(i);
  }
  let groupList = [...groups.values()];

  // Top N por x (ranking por total de la 1ª medida), resto → "Otros"
  const xIsDate = dims[0]?.type === "date";
  const primary = measures[0];
  if (q.topN?.n && dims.length && !xIsDate) {
    const byX = new Map<string, number[]>();
    for (const g of groupList) { const arr = byX.get(g.keys[0]!) ?? []; for (const i of g.idx) arr.push(i); byX.set(g.keys[0]!, arr); }
    const ranked = [...byX.entries()].map(([k, ix]) => ({ k, v: primary ? computeMeasure(P, primary, ix) ?? -Infinity : ix.length })).sort((a, b) => b.v - a.v);
    const keep = new Set(ranked.slice(0, q.topN.n).map((r) => r.k));
    if (ranked.length > q.topN.n) {
      const merged = new Map<string, { keys: string[]; idx: number[] }>();
      for (const g of groupList) {
        if (keep.has(g.keys[0]!)) { merged.set(g.keys.join("\u0001"), g); continue; }
        if (!q.topN.others) continue;
        const keys = [OTROS, ...g.keys.slice(1)];
        const k = keys.join("\u0001");
        const m = merged.get(k) ?? { keys, idx: [] };
        for (const i of g.idx) m.idx.push(i);
        merged.set(k, m);
      }
      groupList = [...merged.values()];
    }
  }
  if (groupList.length > 5000) { warnings.push("Demasiadas combinaciones: se muestran las primeras 5.000."); groupList = groupList.slice(0, 5000); }

  // Valores
  const rows: ResultRow[] = groupList.map((g) => ({ keys: g.keys, labels: [], values: measures.map((m) => computeMeasure(P, m, g.idx)), target: base.hasTarget ? targetOf(g.idx) : undefined }));

  // Etiquetas (año solo si hay más de un año)
  const years = new Set<string>();
  if (xIsDate) for (const r of rows) years.add(r.keys[0]!.slice(0, 4));
  rows.forEach((r) => { r.labels = r.keys.map((k, j) => dimLabel(P.byId.get(dims[j]!.field), k, dims[j]!.grain, j === 0 ? years.size > 1 : true)); });

  // Orden de x
  const sort = q.sort ?? (xIsDate || type === "waterfall" ? { by: "x" as const, dir: "asc" as const } : { by: "value" as const, dir: "desc" as const });
  const xTotals = new Map<string, number>();
  const sortMi = Math.max(0, measures.findIndex((m) => m.id === sort.measure));
  for (const r of rows) xTotals.set(r.keys[0] ?? "", (xTotals.get(r.keys[0] ?? "") ?? 0) + (r.values[sortMi] ?? 0));
  const xs = [...new Set(rows.map((r) => r.keys[0] ?? ""))];
  const dir = sort.dir === "asc" ? 1 : -1;
  if (sort.by === "x") xs.sort((a, b) => (a === OTROS ? 1 : b === OTROS ? -1 : dir * (xIsDate || dims[0]?.type === "number" ? (xIsDate ? (a < b ? -1 : a > b ? 1 : 0) : Number(a) - Number(b)) : a.localeCompare(b, "es", { numeric: true }))));
  else if (sort.by === "value") xs.sort((a, b) => (a === OTROS ? 1 : b === OTROS ? -1 : dir * ((xTotals.get(a) ?? 0) - (xTotals.get(b) ?? 0))));
  const xPos = new Map(xs.map((k, i) => [k, i]));
  const lblOf = new Map<string, string>();
  for (const r of rows) lblOf.set(r.keys[0] ?? "", r.labels[0] ?? "");
  base.xKeys = xs.map((k) => ({ key: k, label: lblOf.get(k) ?? k }));
  if (dims[1]) {
    const sTot = new Map<string, number>(); const sLbl = new Map<string, string>();
    for (const r of rows) { sTot.set(r.keys[1]!, (sTot.get(r.keys[1]!) ?? 0) + Math.abs(r.values[0] ?? 0)); sLbl.set(r.keys[1]!, r.labels[1]!); }
    const sIsDate = dims[1].type === "date";
    const sk = [...sTot.keys()].sort((a, b) => (sIsDate ? (a < b ? -1 : 1) : (sTot.get(b) ?? 0) - (sTot.get(a) ?? 0)));
    base.seriesKeys = sk.map((k) => ({ key: k, label: sLbl.get(k) ?? k }));
  }
  rows.sort((a, b) => (xPos.get(a.keys[0] ?? "") ?? 0) - (xPos.get(b.keys[0] ?? "") ?? 0));

  // Cálculos de tabla (a lo largo de x, dentro de cada serie)
  measures.forEach((m, mi) => {
    if (!m.calc || m.calc === "none") return;
    const bySeries = new Map<string, ResultRow[]>();
    for (const r of rows) { const s = r.keys[1] ?? ""; const arr = bySeries.get(s) ?? []; arr.push(r); bySeries.set(s, arr); }
    let yoyMap: Map<string, number | null> | null = null;
    if ((m.calc === "yoy" || m.calc === "yoy_pct") && xIsDate) {
      // Interanual: se agrupa SIN el filtro de fecha del eje, para tener el año anterior.
      const ix2 = filterRows(P, filters, now, [], dims[0]!.field);
      const g2 = new Map<string, number[]>();
      for (const i of ix2) { const k = keyFns.map((fn) => fn(i)).join("\u0001"); const arr = g2.get(k) ?? []; arr.push(i); g2.set(k, arr); }
      yoyMap = new Map([...g2.entries()].map(([k, ix]) => [k, computeMeasure(P, m, ix)]));
    }
    for (const list of bySeries.values()) {
      const raw = list.map((r) => r.values[mi]);
      const tot = raw.reduce<number>((s, v) => s + (v ?? 0), 0);
      let acc = 0;
      list.forEach((r, j) => {
        const v = raw[j];
        switch (m.calc) {
          case "pct_total": r.values[mi] = v == null || !tot ? null : (v / tot) * 100; break;
          case "running": acc += v ?? 0; r.values[mi] = acc; break;
          case "moving_avg": { const n = Math.max(2, m.n ?? 3); const win = raw.slice(Math.max(0, j - n + 1), j + 1).filter((x): x is number => x != null); r.values[mi] = win.length ? win.reduce((s, x) => s + x, 0) / win.length : null; break; }
          case "diff_prev": { const p = j > 0 ? raw[j - 1] : null; r.values[mi] = v == null || p == null ? null : v - p; break; }
          case "pct_prev": { const p = j > 0 ? raw[j - 1] : null; r.values[mi] = v == null || p == null || p === 0 ? null : ((v - p) / Math.abs(p)) * 100; break; }
          case "yoy": case "yoy_pct": {
            if (!yoyMap) { r.values[mi] = null; break; }
            const pk = [shiftKey(r.keys[0]!, dims[0]!.grain ?? "month", "year"), ...r.keys.slice(1)].join("\u0001");
            const p = yoyMap.get(pk) ?? null;
            r.values[mi] = v == null || p == null ? null : m.calc === "yoy" ? v - p : p === 0 ? null : ((v - p) / Math.abs(p)) * 100;
            break;
          }
        }
      });
    }
    if (m.calc === "pct_total") base.totals[mi] = 100;
    else if (m.calc !== "running" && m.calc !== "moving_avg") base.totals[mi] = null;
  });

  base.rows = rows;
  base.warnings = [...P.warnings, ...warnings];
  return base;
}

// ── KPI ──
function kpi(P: Prepared, q: Query, m: Measure | undefined, idx: number[], filters: Filter[], now: number, opts: { kpiMode?: "total" | "last"; compare?: "none" | "prev_period" | "prev_year"; direction?: "up" | "down" }, targetOf: (ix: number[]) => number | null): KpiResult {
  const out: KpiResult = { value: null, prev: null, deltaPct: null, target: null, cumpl: null, periodLabel: "", prevLabel: "", spark: [] };
  if (!m) return out;
  const df = (q.dateField && P.byId.get(q.dateField)?.type === "date" ? P.byId.get(q.dateField) : undefined) ?? firstDateField(P);
  const compare = opts.compare ?? "none";
  const mode = opts.kpiMode ?? "total";
  let cur = idx;
  if (df) {
    const g = q.grain ?? (autoGrain(P, df.id) === "day" ? "day" : "month");
    const a = P.num.get(df.id)!;
    const keyFn = dimKeyFn(P, df.id, g);
    // Sparkline
    const byK = new Map<string, number[]>();
    for (const i of idx) { if (Number.isNaN(a[i])) continue; const k = keyFn(i); const arr = byK.get(k) ?? []; arr.push(i); byK.set(k, arr); }
    const ks = [...byK.keys()].sort();
    const multiYear = new Set(ks.map((k) => k.slice(0, 4))).size > 1;
    out.spark = ks.slice(-24).map((k) => ({ key: k, label: bucketLabel(k, g, multiYear && !df.monthOnly), value: computeMeasure(P, m, byK.get(k)!) }));
    const wide = compare !== "none" ? filterRows(P, filters, now, [], df.id) : null;
    const inRange = (ix: number[], r: [number, number]) => ix.filter((i) => a[i]! >= r[0] && a[i]! < r[1]);
    if (mode === "last") {
      const lastK = [...ks].reverse().find((k) => computeMeasure(P, m, byK.get(k)!) != null);
      if (lastK) {
        cur = byK.get(lastK)!;
        out.periodLabel = bucketLabel(lastK, g, true);
        if (wide) {
          const pk = shiftKey(lastK, g, compare === "prev_year" ? "year" : "prev");
          out.prev = computeMeasure(P, m, wide.filter((i) => !Number.isNaN(a[i]) && keyFn(i) === pk));
          out.prevLabel = bucketLabel(pk, g, true);
        }
      }
    } else if (wide) {
      // Rango actual: el del filtro de fecha activo, o YTD del último año con datos.
      let range: [number, number] | null = null;
      for (const f of filters) { if (f.field !== df.id) continue; const r = filterDateRange(P, f, now); if (r) range = range ? [Math.max(range[0], r[0]), Math.min(range[1], r[1])] : r; }
      if (range && (!Number.isFinite(range[0]) || !Number.isFinite(range[1]))) {
        const dr = fieldRange(P, df.id);
        if (dr) range = [Number.isFinite(range[0]) ? range[0] : dr[0], Number.isFinite(range[1]) ? range[1] : dr[1] + DAY];
      }
      let ytd = false;
      if (!range) {
        let mx = -Infinity; for (const i of idx) if (a[i]! > mx) mx = a[i]!;
        if (Number.isFinite(mx)) { const y = new Date(mx).getUTCFullYear(); range = [Date.UTC(y, 0, 1), mx + DAY]; ytd = true; }
      }
      if (range) {
        cur = inRange(idx, range);
        const [r0, r1] = range;
        let prev: [number, number];
        const d0 = new Date(r0), d1 = new Date(r1);
        const monthAligned = d0.getUTCDate() === 1 && d1.getUTCDate() === 1;
        if (compare === "prev_year") prev = [Date.UTC(d0.getUTCFullYear() - 1, d0.getUTCMonth(), d0.getUTCDate()), Date.UTC(d1.getUTCFullYear() - 1, d1.getUTCMonth(), d1.getUTCDate())];
        else if (monthAligned) { const months = (d1.getUTCFullYear() - d0.getUTCFullYear()) * 12 + d1.getUTCMonth() - d0.getUTCMonth(); prev = [Date.UTC(d0.getUTCFullYear(), d0.getUTCMonth() - months, 1), r0]; }
        else prev = [r0 - (r1 - r0), r0];
        out.prev = computeMeasure(P, m, inRange(wide, prev));
        out.periodLabel = ytd ? `Acum. ${d0.getUTCFullYear()}` : `${fmtDate(r0)} – ${fmtDate(r1 - DAY)}`;
        out.prevLabel = compare === "prev_year" ? "mismo período año anterior" : "período anterior";
        if (ytd && compare === "prev_year") out.prevLabel = `mismo período ${d0.getUTCFullYear() - 1}`;
      }
    }
  }
  out.value = computeMeasure(P, m, cur);
  if (out.prev != null && out.value != null && out.prev !== 0) out.deltaPct = ((out.value - out.prev) / Math.abs(out.prev)) * 100;
  out.target = targetOf(cur);
  if (out.value != null && out.target != null && out.target !== 0) {
    const dir = opts.direction ?? "up";
    out.cumpl = dir === "up" ? (out.value / out.target) * 100 : out.value === 0 ? null : (out.target / out.value) * 100;
  }
  return out;
}

// ── Detalle (filas crudas) ──
function detail(P: Prepared, q: Query, idx: number[]): DetailResult {
  const ids = [q.x, ...(q.rows ?? []), ...(q.measures ?? []).map((m) => m.field)].filter((x): x is string => !!x && P.byId.has(x) && !P.byId.get(x)!.aggregate);
  const fields = (ids.length ? [...new Set(ids)].map((i) => P.byId.get(i)!) : P.fields.filter((f) => !f.hidden && !f.aggregate && !f.error)).slice(0, 30);
  const header = fields.map((f) => ({ id: f.id, label: f.label, format: f.format, type: f.type }));
  const lim = idx.slice(0, 5000);
  const rows = lim.map((i) => fields.map((f) => {
    const v = rowVal(P, f.id, i);
    if (v == null) return null;
    if (v instanceof Date) return fmtDate(v.getTime());
    if (typeof v === "boolean") return v ? "Sí" : "No";
    return v;
  }));
  return { header, rows, total: idx.length };
}

// ── Pivot ──
function pivot(P: Prepared, q: Query, measures: Measure[], idx: number[]): PivotResult {
  const rIds = (q.rows?.length ? q.rows : q.x ? [q.x] : []).filter((id) => P.byId.has(id));
  const cIds = (q.cols?.length ? q.cols : q.series ? [q.series] : []).filter((id) => P.byId.has(id));
  const mk = (id: string): DimMeta => { const f = P.byId.get(id)!; return { field: id, label: f.label, type: f.type, grain: f.type === "date" ? q.grain ?? autoGrain(P, id) : undefined }; };
  const rowDims = rIds.map(mk), colDims = cIds.map(mk);
  const rFns = rowDims.map((d) => dimKeyFn(P, d.field, d.grain));
  const cFns = colDims.map((d) => dimKeyFn(P, d.field, d.grain));
  const cell = new Map<string, number[]>(); // "r\u0002c" → idx
  const rowSet = new Map<string, string[]>(), colSet = new Map<string, string[]>();
  for (const i of idx) {
    const rk = rFns.map((f) => f(i)), ck = cFns.map((f) => f(i));
    const rs = rk.join("\u0001"), cs = ck.join("\u0001");
    if (!rowSet.has(rs)) rowSet.set(rs, rk);
    if (!colSet.has(cs)) colSet.set(cs, ck);
    const k = rs + "\u0002" + cs;
    const arr = cell.get(k) ?? []; arr.push(i); cell.set(k, arr);
  }
  const cmpKeys = (a: string[], b: string[], dimsM: DimMeta[]) => {
    for (let j = 0; j < a.length; j++) {
      if (a[j] === b[j]) continue;
      if (dimsM[j]!.type === "number") return Number(a[j]) - Number(b[j]);
      return a[j]!.localeCompare(b[j]!, "es", { numeric: true });
    }
    return 0;
  };
  let colKeysArr = [...colSet.values()].sort((a, b) => cmpKeys(a, b, colDims));
  if (colKeysArr.length > 40) colKeysArr = colKeysArr.slice(0, 40);
  const rowKeysArr = [...rowSet.values()].sort((a, b) => cmpKeys(a, b, rowDims)).slice(0, 1000);
  const yearsC = new Set(colKeysArr.map((k) => k[0]?.slice(0, 4)));
  const lbl = (dims: DimMeta[], keys: string[], multi: boolean) => keys.map((k, j) => dimLabel(P.byId.get(dims[j]!.field), k, dims[j]!.grain, multi));
  const colKeys = colKeysArr.map((k) => ({ keys: k, label: lbl(colDims, k, yearsC.size > 1).join(" · ") }));
  // idx por fila (prefijo) y columna
  const cellsFor = (rowList: string[]): (number | null)[][] => {
    const perCol: number[][] = colKeysArr.map(() => []);
    const all: number[] = [];
    for (const rs of rowList) {
      colKeysArr.forEach((ck, ci) => { const ix = cell.get(rs + "\u0002" + ck.join("\u0001")); if (ix) { for (const i of ix) { perCol[ci]!.push(i); all.push(i); } } });
      if (!colKeysArr.length) { const ix = cell.get(rs + "\u0002"); if (ix) for (const i of ix) all.push(i); }
    }
    const cols = colKeysArr.length ? perCol.map((ix) => measures.map((m) => (ix.length ? computeMeasure(P, m, ix) : null))) : [];
    cols.push(measures.map((m) => computeMeasure(P, m, all)));
    return cols;
  };
  const out: PivotRow[] = [];
  const R = rowDims.length;
  // prefijo → filas hoja que lo contienen
  const byPrefix = new Map<string, string[]>();
  for (const rk of rowKeysArr) for (let lv = 0; lv < R - 1; lv++) { const ps = rk.slice(0, lv + 1).join("\u0001"); const arr = byPrefix.get(ps) ?? []; arr.push(rk.join("\u0001")); byPrefix.set(ps, arr); }
  const seenPrefix = new Set<string>();
  const yearsR = new Set(rowKeysArr.map((k) => k[0]?.slice(0, 4)));
  for (const rk of rowKeysArr) {
    // Subtotales por prefijo (encabezado de grupo) cuando hay 2+ niveles
    for (let lv = 0; lv < R - 1; lv++) {
      const pre = rk.slice(0, lv + 1);
      const ps = pre.join("\u0001");
      if (seenPrefix.has(ps)) continue;
      seenPrefix.add(ps);
      out.push({ level: lv, leaf: false, keys: pre, labels: lbl(rowDims.slice(0, lv + 1), pre, yearsR.size > 1), cells: cellsFor(byPrefix.get(ps) ?? []) });
    }
    const rs = rk.join("\u0001");
    out.push({ level: R - 1, leaf: true, keys: rk, labels: lbl(rowDims, rk, yearsR.size > 1), cells: cellsFor([rs]) });
  }
  const grand = cellsFor(rowKeysArr.map((k) => k.join("\u0001")));
  return { rowDims, colDims, colKeys, rows: out, grand };
}

/** Clave de fecha → timestamp (para el filtro cruzado por bucket). */
export const bucketStartOf = keyToStart;
