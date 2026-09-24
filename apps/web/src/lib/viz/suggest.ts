// "Tablero automático", "Mostrame" (qué gráficos sirven para lo elegido) y plantillas de los
// tableros nativos de planilla (Inversión, Resultados Comerciales, Trade) cuando las columnas matchean.
import type { ChartType, Field, Measure, Widget } from "./types";
import { fieldRange, firstDateField, distinctValues, ROWS_FIELD, type Prepared } from "./schema";
import { computeMeasure } from "./query";
import { uid } from "./dashboard";

const DAY = 86400000;
const nrm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const PRIO_MEASURE = /(venta|factur|revenue|ingreso|inversi|spend|gasto|monto|importe|real|ejecutad|unidades|cantidad|share)/;
const TARGET_RE = /(presupuest|\bbgt\b|budget|\bmeta\b|objetivo|target|\bplan\b|planificad|forecast)/;

function measuresOf(P: Prepared): Field[] {
  return P.fields.filter((f) => f.role === "measure" && !f.hidden && !f.error && (f.type === "number"))
    .sort((a, b) => {
      const sa = (a.format === "currency" ? 0 : 2) + (PRIO_MEASURE.test(nrm(a.label)) ? 0 : 1) + (TARGET_RE.test(nrm(a.label)) ? 3 : 0);
      const sb = (b.format === "currency" ? 0 : 2) + (PRIO_MEASURE.test(nrm(b.label)) ? 0 : 1) + (TARGET_RE.test(nrm(b.label)) ? 3 : 0);
      return sa - sb;
    });
}
function dimsOf(P: Prepared): { f: Field; card: number }[] {
  return P.fields.filter((f) => f.role === "dimension" && !f.hidden && !f.error && f.type !== "date")
    .map((f) => ({ f, card: distinctValues(P, f.id, 100000).length }))
    .filter((d) => d.card >= 2);
}
const aggFor = (f: Field) => (f.format === "percent" || f.format === "pct_frac" || f.format === "ratio" ? "avg" as const : "sum" as const);
const M = (f: Field, extra: Partial<Measure> = {}): Measure => ({ id: uid("m"), field: f.id, agg: aggFor(f), ...extra });

function spanInfo(P: Prepared, d?: Field) {
  if (!d) return { months: 0, spansYear: false };
  const r = fieldRange(P, d.id);
  if (!r) return { months: 0, spansYear: false };
  const months = Math.round((r[1] - r[0]) / (30.4 * DAY)) + 1;
  return { months, spansYear: months >= 13 };
}

/** Tablero automático profesional a partir del esquema. */
export function autoDashboard(P: Prepared, datasetId: string): Widget[] {
  const ms = measuresOf(P);
  const date = firstDateField(P);
  const dims = dimsOf(P);
  const cat = [...dims].sort((a, b) => score(a.card) - score(b.card))[0]?.f;
  const cat2 = dims.find((d) => d.f.id !== cat?.id && d.card <= 30)?.f;
  const hiCard = [...dims].sort((a, b) => b.card - a.card)[0];
  const { months, spansYear } = spanInfo(P, date);
  const targetCand = ms.find((f) => TARGET_RE.test(nrm(f.label)));
  const reals0 = ms.filter((f) => f !== targetCand);
  // La meta se empareja con la medida de ESCALA parecida (total entre 0,5x y 2x); si no hay, no se usa.
  const all = Array.from({ length: P.n }, (_, i) => i);
  const tot = (f: Field) => Math.abs(computeMeasure(P, { field: f.id, agg: "sum" }, all) ?? 0);
  const tTot = targetCand ? tot(targetCand) : 0;
  const pairIdx = targetCand && tTot ? reals0.findIndex((f) => { const r = tot(f) / tTot; return r >= 0.5 && r <= 2; }) : -1;
  const target = pairIdx >= 0 ? targetCand : undefined;
  const reals = pairIdx > 0 ? [reals0[pairIdx], ...reals0.filter((_, i) => i !== pairIdx)] : pairIdx === 0 ? reals0 : targetCand ? [...reals0, targetCand] : reals0;
  const out: Widget[] = [];
  const ds = datasetId;

  if (!reals.length) {
    out.push({ id: uid(), type: "kpi", title: "Registros", datasetId: ds, q: { measures: [{ id: "m0", field: ROWS_FIELD, agg: "count" }] }, w: 1, h: "s", opts: { kpiMode: "total", spark: true } });
    if (cat) out.push({ id: uid(), type: "bar", title: `Registros por ${cat.label.toLowerCase()}`, datasetId: ds, q: { x: cat.id, measures: [{ id: "m0", field: ROWS_FIELD, agg: "count" }], topN: { n: 12, others: true } }, w: 3, h: "m", opts: { orientation: "h", labels: true } });
    out.push({ id: uid(), type: "table", title: "Detalle", datasetId: ds, q: { measures: [] }, w: 4, h: "l", opts: { detail: true, pageSize: 25 } });
    return out;
  }

  // 1 · KPIs (con comparación y sparkline; meta si hay columna de presupuesto/meta)
  const kpis = reals.slice(0, 4);
  const kw = kpis.length === 3 ? [1, 1, 2] : kpis.length === 1 ? [2] : kpis.map(() => (kpis.length === 2 ? 2 : 1));
  kpis.forEach((f, i) => {
    out.push({
      id: uid(), type: "kpi", title: f!.label, datasetId: ds,
      q: { measures: [M(f!)], target: i === 0 && target ? { field: target.id, agg: "sum", label: target.label } : undefined, dateField: date?.id, grain: "month" },
      w: kw[i] as Widget["w"], h: "s",
      opts: { kpiMode: date && months >= 2 ? (i === 0 && target ? "total" : "last") : "total", compare: date ? (spansYear ? "prev_year" : "prev_period") : "none", spark: !!date },
    });
  });

  // 2 · Evolución mensual
  if (date) {
    const [a, b] = reals;
    if (target && a) out.push({ id: uid(), type: "bar", title: `${a.label} vs ${target.label.toLowerCase()}`, subtitle: "Real en azul, meta en gris", datasetId: ds, q: { x: date.id, grain: months > 36 ? "quarter" : "month", measures: [M(a)], target: { field: target.id, agg: "sum", label: target.label } }, w: 4, h: "m", opts: { labels: true } });
    else if (b && a!.format !== b.format) out.push({ id: uid(), type: "combo", title: `${a!.label} y ${b.label.toLowerCase()} por mes`, datasetId: ds, q: { x: date.id, grain: "month", measures: [M(a!, { mark: "bar", axis: "left" }), M(b, { mark: "line", axis: "right" })] }, w: 4, h: "m", opts: { labels: false } });
    else out.push({ id: uid(), type: months <= 14 ? "bar" : "line", title: `Evolución de ${reals.slice(0, 2).map((f) => f!.label.toLowerCase()).join(" y ")}`, datasetId: ds, q: { x: date.id, grain: months > 36 ? "quarter" : "month", measures: reals.slice(0, months <= 14 ? 1 : 2).map((f) => M(f!)) }, w: 4, h: "m", opts: { labels: months <= 14 } });
  }

  // 3 · Apertura por categoría principal + participación
  if (cat) {
    const a = reals[0];
    out.push({ id: uid(), type: "bar", title: `${a!.label} por ${cat.label.toLowerCase()}`, datasetId: ds, q: { x: cat.id, measures: [M(a!)], sort: { by: "value", dir: "desc" }, topN: { n: 10, others: true } }, w: 2, h: "m", opts: { orientation: "h", labels: true } });
    const shareBy = cat2 && distinctValues(P, cat2.id, 100).length <= 8 ? cat2 : cat;
    out.push({ id: uid(), type: "donut", title: `Participación por ${shareBy.label.toLowerCase()}`, datasetId: ds, q: { x: shareBy.id, measures: [M(a!)], topN: { n: 6, others: true } }, w: 2, h: "m", opts: {} });
    if (date && months >= 3 && distinctValues(P, cat.id, 100).length <= 15) {
      out.push({ id: uid(), type: "heatmap", title: `${a!.label} por ${cat.label.toLowerCase()} y mes`, datasetId: ds, q: { x: date.id, grain: "month", series: cat.id, measures: [M(a!)] }, w: 4, h: "m", opts: {} });
    }
  }

  // 4 · Top N (tabla con % del total y barras)
  const tdim = hiCard && hiCard.card > 1 ? hiCard.f : cat;
  if (tdim) {
    const tm = reals.slice(0, 3).map((f) => M(f!));
    const share = M(reals[0]!, { calc: "pct_total", label: "% del total" });
    out.push({ id: uid(), type: "table", title: `Top 20 · ${tdim.label}`, datasetId: ds, q: { x: tdim.id, measures: [...tm, share], sort: { by: "value", dir: "desc" }, topN: { n: 20, others: true } }, w: 4, h: "l", opts: { totals: true, pageSize: 20, cond: [{ measure: tm[0]!.id, kind: "bars" }] } });
  } else {
    out.push({ id: uid(), type: "table", title: "Detalle", datasetId: ds, q: { measures: [] }, w: 4, h: "l", opts: { detail: true, pageSize: 25 } });
  }
  return out;
}
const score = (card: number) => (card >= 3 && card <= 12 ? 0 : card <= 30 ? 1 : card === 2 ? 2 : 3);

// ── Mostrame ──
export interface ShowMeItem { type: ChartType; label: string; ok: boolean; hint: string }
export const CHART_LABEL: Record<ChartType, string> = {
  kpi: "KPI", bar: "Barras", line: "Líneas", area: "Área", combo: "Combo (barras + línea)", pie: "Torta", donut: "Dona",
  scatter: "Dispersión", heatmap: "Mapa de calor", table: "Tabla", pivot: "Tabla dinámica", funnel: "Embudo",
  waterfall: "Cascada", gauge: "Avance vs meta", text: "Texto / nota",
};

export function showMe(sel: { dims: Field[]; measures: number; hasTarget: boolean }): { items: ShowMeItem[]; best: ChartType } {
  const d = sel.dims.length, m = sel.measures;
  const hasDate = sel.dims.some((f) => f.type === "date");
  const it = (type: ChartType, ok: boolean, hint: string): ShowMeItem => ({ type, label: CHART_LABEL[type], ok, hint });
  const items = [
    it("kpi", m >= 1, "1 medida"),
    it("gauge", m >= 1 && sel.hasTarget, "1 medida + meta"),
    it("bar", m >= 1 && d >= 1, "1+ dimensión, 1+ medida"),
    it("line", m >= 1 && d >= 1, "fecha + 1+ medida"),
    it("area", m >= 1 && d >= 1, "fecha + 1+ medida"),
    it("combo", m >= 2 && d >= 1, "1 dimensión, 2 medidas"),
    it("donut", m === 1 && d === 1, "1 dimensión, 1 medida"),
    it("pie", m === 1 && d === 1, "1 dimensión, 1 medida"),
    it("scatter", m >= 2 && d >= 1, "1 dimensión (detalle), 2–3 medidas"),
    it("heatmap", m === 1 && d === 2, "2 dimensiones, 1 medida"),
    it("funnel", m === 1 && d === 1, "etapas + 1 medida"),
    it("waterfall", m === 1 && d === 1, "1 dimensión, 1 medida"),
    it("table", true, "cualquier combinación"),
    it("pivot", d >= 1, "filas × columnas"),
    it("text", true, "título o nota"),
  ];
  let best: ChartType = "table";
  if (d === 0 && m >= 1) best = sel.hasTarget ? "gauge" : "kpi";
  else if (d === 1 && hasDate) best = m >= 2 ? "combo" : "line";
  else if (d === 1 && m === 1) best = "bar";
  else if (d === 1 && m >= 2) best = "bar";
  else if (d === 2 && m === 1) best = hasDate ? "line" : "heatmap";
  else if (d >= 2) best = "pivot";
  return { items, best };
}

// ── Plantillas de los tableros nativos ──
function find(P: Prepared, re: RegExp, pred: (f: Field) => boolean = () => true): Field | undefined {
  return P.fields.find((f) => !f.hidden && !f.error && re.test(nrm(f.label)) && pred(f));
}
const isNum = (f: Field) => f.type === "number" && f.role === "measure";
const isDim = (f: Field) => f.role === "dimension" && f.type !== "date";

/** Plantilla para inversion / resultados / trade si las columnas matchean; null si no. */
export function templateFor(slug: string, P: Prepared, datasetId: string): { widgets: Widget[]; calcs: { id: string; name: string; expr: string; format?: Field["format"] }[] } | null {
  const date = firstDateField(P);
  const ds = datasetId;
  const kpi = (title: string, measures: Measure[], extra: Partial<Widget> = {}, w: Widget["w"] = 1): Widget => ({ id: uid(), type: "kpi", title, datasetId: ds, q: { measures, dateField: date?.id, grain: "month" }, w, h: "s", opts: { kpiMode: "total", compare: date ? "prev_year" : "none", spark: !!date }, ...extra });

  if (slug === "inversion") {
    const real = find(P, /(real|ejecutad|inversi|gasto|spend|monto|importe)/, (f) => isNum(f) && !TARGET_RE.test(nrm(f.label)));
    const bgt = find(P, /(presupuest|\bbgt\b|budget|\bplan\b|planificad|forecast|\bmeta\b)/, isNum);
    if (!real || !bgt) return null;
    const fact = find(P, /(factur|venta|revenue|ingreso)/, isNum);
    const concepto = find(P, /(concepto|cuenta|rubro|medio|categor|partida|linea|l[ií]nea|area|área|canal)/, isDim);
    const cur = real.format === "currency" || bgt.format === "currency" ? "currency" as const : undefined;
    const calcs = [{ id: "calc_desvio", name: "Desvío vs presupuesto", expr: `(SUM([${real.label}]) - SUM([${bgt.label}])) / SUM([${bgt.label}]) * 100`, format: "percent" as const }];
    if (fact) calcs.push({ id: "calc_inv_fact", name: "Inversión / facturación", expr: `SUM([${real.label}]) / SUM([${fact.label}]) * 100`, format: "percent" as const });
    const w: Widget[] = [
      kpi("Inversión real", [{ id: "m0", field: real.id, agg: "sum" }], { q: { measures: [{ id: "m0", field: real.id, agg: "sum", format: cur }], target: { field: bgt.id, agg: "sum", label: "Presupuesto" }, dateField: date?.id, grain: "month" }, opts: { kpiMode: "total", compare: "none", spark: !!date, direction: "down", green: 100, yellow: 95 } }, 2),
      kpi("Desvío vs presupuesto", [{ id: "m0", field: "calc_desvio", agg: "sum" }], { opts: { kpiMode: "total", compare: "none", spark: !!date } }),
      fact ? kpi("Inversión / facturación", [{ id: "m0", field: "calc_inv_fact", agg: "sum" }], { opts: { kpiMode: "total", compare: date ? "prev_year" : "none", spark: !!date } }) : kpi("Presupuesto", [{ id: "m0", field: bgt.id, agg: "sum" }]),
    ];
    if (date) w.push({ id: uid(), type: "bar", title: "Ejecución mensual vs presupuesto", subtitle: "Real en azul, presupuesto en gris", datasetId: ds, q: { x: date.id, grain: "month", measures: [{ id: "m0", field: real.id, agg: "sum", label: "Real", format: cur }], target: { field: bgt.id, agg: "sum", label: "Presupuesto" } }, w: 4, h: "m", opts: { labels: true } });
    if (date) w.push({ id: uid(), type: "line", title: "Acumulado real vs presupuesto", datasetId: ds, q: { x: date.id, grain: "month", measures: [{ id: "m0", field: real.id, agg: "sum", calc: "running", label: "Real acumulado", format: cur }, { id: "m1", field: bgt.id, agg: "sum", calc: "running", label: "Presupuesto acumulado", format: cur, asMeta: true }] }, w: 2, h: "m", opts: {} });
    if (concepto) {
      w.push({ id: uid(), type: "bar", title: `Inversión por ${concepto.label.toLowerCase()}`, datasetId: ds, q: { x: concepto.id, measures: [{ id: "m0", field: real.id, agg: "sum", label: "Real", format: cur }], target: { field: bgt.id, agg: "sum", label: "Presupuesto" }, sort: { by: "value", dir: "desc" }, topN: { n: 10, others: true } }, w: 2, h: "m", opts: { orientation: "h", labels: true } });
      w.push({ id: uid(), type: "table", title: `Desvío por ${concepto.label.toLowerCase()}`, datasetId: ds, q: { x: concepto.id, measures: [{ id: "m0", field: real.id, agg: "sum", label: "Real", format: cur }, { id: "m1", field: bgt.id, agg: "sum", label: "Presupuesto", format: cur, asMeta: true }, { id: "m2", field: "calc_desvio", agg: "sum", label: "Desvío %" }], sort: { by: "value", dir: "desc" } }, w: 4, h: "l", opts: { totals: true, pageSize: 20, cond: [{ measure: "m0", kind: "bars" }, { measure: "m2", kind: "semaforo", green: 0, yellow: 5, dir: "down" }] } });
    }
    if (fact && date) w.push({ id: uid(), type: "combo", title: "Inversión y facturación", datasetId: ds, q: { x: date.id, grain: "month", measures: [{ id: "m0", field: real.id, agg: "sum", mark: "bar", axis: "left", label: "Inversión", format: cur }, { id: "m1", field: "calc_inv_fact", agg: "sum", mark: "line", axis: "right", label: "Inv/Fact %" }] }, w: concepto ? 4 : 2, h: "m", opts: {} });
    return { widgets: w, calcs };
  }

  if (slug === "resultados") {
    const ventas = find(P, /(venta|factur|revenue|ingreso|importe|monto)/, isNum) ?? find(P, /(unidades|cantidad)/, isNum);
    if (!ventas) return null;
    const unidades = find(P, /(unidades|cantidad|volumen)/, (f) => isNum(f) && f.id !== ventas.id);
    const share = find(P, /(share|particip|cuota)/, isNum);
    const meta = find(P, /(\bmeta\b|objetivo|presupuest|budget|target|forecast)/, (f) => isNum(f) && f.id !== ventas.id);
    const cat = find(P, /(categor|segmento|familia|linea|l[ií]nea|division|división|marca)/, isDim);
    const canal = find(P, /(canal|cliente|cadena|retailer|region|región|zona|provincia)/, (f) => isDim(f) && f.id !== cat?.id);
    const prod = find(P, /(producto|sku|modelo|articulo|artículo|descripcion|descripción)/, (f) => isDim(f) && f.id !== cat?.id && f.id !== canal?.id);
    const w: Widget[] = [
      kpi(ventas.label, [{ id: "m0", field: ventas.id, agg: "sum" }], meta ? { q: { measures: [{ id: "m0", field: ventas.id, agg: "sum" }], target: { field: meta.id, agg: "sum", label: meta.label }, dateField: date?.id, grain: "month" } } : {}, 2),
    ];
    if (unidades) w.push(kpi(unidades.label, [{ id: "m0", field: unidades.id, agg: "sum" }]));
    if (share) w.push(kpi(share.label, [{ id: "m0", field: share.id, agg: "avg" }], { opts: { kpiMode: "last", compare: date ? "prev_year" : "none", spark: !!date } }));
    if (w.length === 2) w[1]!.w = 2; else if (w.length === 1) w[0]!.w = 4;
    if (date) w.push({ id: uid(), type: "bar", title: `${ventas.label} por mes`, subtitle: meta ? "Real vs meta" : "Con variación interanual", datasetId: ds, q: { x: date.id, grain: "month", measures: [{ id: "m0", field: ventas.id, agg: "sum" }], target: meta ? { field: meta.id, agg: "sum", label: meta.label } : undefined }, w: share ? 2 : 4, h: "m", opts: { labels: true } });
    if (date && share) w.push({ id: uid(), type: "combo", title: `${ventas.label} y ${share.label.toLowerCase()}`, datasetId: ds, q: { x: date.id, grain: "month", measures: [{ id: "m0", field: ventas.id, agg: "sum", mark: "bar", axis: "left" }, { id: "m1", field: share.id, agg: "avg", mark: "line", axis: "right" }] }, w: 2, h: "m", opts: {} });
    if (date) w.push({ id: uid(), type: "line", title: "Variación interanual", datasetId: ds, q: { x: date.id, grain: "month", measures: [{ id: "m0", field: ventas.id, agg: "sum", calc: "yoy_pct", label: "% vs año anterior" }] }, w: 2, h: "m", opts: { labels: true } });
    if (cat) w.push({ id: uid(), type: "donut", title: `Mix por ${cat.label.toLowerCase()}`, datasetId: ds, q: { x: cat.id, measures: [{ id: "m0", field: ventas.id, agg: "sum" }], topN: { n: 6, others: true } }, w: 2, h: "m", opts: {} });
    if (canal) w.push({ id: uid(), type: "bar", title: `${ventas.label} por ${canal.label.toLowerCase()}`, datasetId: ds, q: { x: canal.id, series: cat && distinctValues(P, cat.id, 50).length <= 6 ? cat.id : undefined, measures: [{ id: "m0", field: ventas.id, agg: "sum" }], topN: { n: 10, others: true } }, w: 2, h: "m", opts: { orientation: "h", stack: "stacked" } });
    const tdim = prod ?? canal ?? cat;
    if (tdim) w.push({ id: uid(), type: "table", title: `Top 20 · ${tdim.label}`, datasetId: ds, q: { x: tdim.id, measures: [{ id: "m0", field: ventas.id, agg: "sum" }, { id: "m1", field: ventas.id, agg: "sum", calc: "pct_total", label: "% del total" }, ...(unidades ? [{ id: "m2", field: unidades.id, agg: "sum" as const }] : [])], sort: { by: "value", dir: "desc" }, topN: { n: 20, others: true } }, w: 4, h: "l", opts: { totals: true, pageSize: 20, cond: [{ measure: "m0", kind: "bars" }] } });
    return { widgets: w, calcs: [] };
  }

  if (slug === "trade") {
    const fs = find(P, /(floor|exhib|espacio|frente|share)/, isNum);
    const cb = find(P, /(surtido|\bcb\b|cuadro|presencia|cobertura|disponib|quiebre|stock)/, (f) => isNum(f) && f.id !== fs?.id);
    if (!fs && !cb) return null;
    const meta = find(P, /(\bmeta\b|objetivo|target)/, (f) => isNum(f) && f.id !== fs?.id && f.id !== cb?.id);
    const cadena = find(P, /(cadena|cliente|retailer|canal|cuenta)/, isDim);
    const tienda = find(P, /(tienda|sucursal|local|punto de venta|pdv|store)/, (f) => isDim(f) && f.id !== cadena?.id);
    const cat = find(P, /(categor|segmento|familia|linea|l[ií]nea)/, (f) => isDim(f) && f.id !== cadena?.id && f.id !== tienda?.id);
    const agg = (f: Field) => aggFor(f) === "sum" && !/(unidades|cantidad)/.test(nrm(f.label)) ? "avg" as const : aggFor(f);
    const w: Widget[] = [];
    if (fs) w.push(kpi(fs.label, [{ id: "m0", field: fs.id, agg: agg(fs) }], { q: { measures: [{ id: "m0", field: fs.id, agg: agg(fs) }], target: meta ? { field: meta.id, agg: "avg", label: meta.label } : undefined, dateField: date?.id, grain: date && autoWeek(P, date) ? "week" : "month" }, opts: { kpiMode: date ? "last" : "total", compare: date ? "prev_period" : "none", spark: !!date } }, 2));
    if (cb) w.push(kpi(cb.label, [{ id: "m0", field: cb.id, agg: agg(cb) }], { opts: { kpiMode: date ? "last" : "total", compare: date ? "prev_period" : "none", spark: !!date } }, fs ? 1 : 2));
    if (tienda) w.push(kpi("Tiendas relevadas", [{ id: "m0", field: tienda.id, agg: "countd" }], { opts: { kpiMode: "total", compare: "none", spark: false } }, fs && cb ? 1 : 2));
    const main = fs ?? cb!;
    if (date) w.push({ id: uid(), type: "line", title: `Evolución de ${[fs, cb].filter(Boolean).map((f) => f!.label.toLowerCase()).join(" y ")}`, datasetId: ds, q: { x: date.id, grain: autoWeek(P, date) ? "week" : "month", measures: [fs, cb].filter(Boolean).map((f, i) => ({ id: `m${i}`, field: f!.id, agg: agg(f!) })), target: meta ? { field: meta.id, agg: "avg", label: meta.label } : undefined }, w: 4, h: "m", opts: { labels: true } });
    if (cadena) w.push({ id: uid(), type: "bar", title: `${main.label} por ${cadena.label.toLowerCase()}`, datasetId: ds, q: { x: cadena.id, measures: [{ id: "m0", field: main.id, agg: agg(main) }], target: meta ? { field: meta.id, agg: "avg", label: meta.label } : undefined, sort: { by: "value", dir: "desc" }, topN: { n: 12, others: false } }, w: 2, h: "m", opts: { orientation: "h", labels: true } });
    if (cadena && cat) w.push({ id: uid(), type: "heatmap", title: `${main.label}: ${cadena.label.toLowerCase()} × ${cat.label.toLowerCase()}`, datasetId: ds, q: { x: cat.id, series: cadena.id, measures: [{ id: "m0", field: main.id, agg: agg(main) }] }, w: 2, h: "m", opts: {} });
    const tdim = tienda ?? cadena;
    if (tdim) w.push({ id: uid(), type: "table", title: `${tdim.label}: ranking`, datasetId: ds, q: { x: tdim.id, rows: cadena && tienda ? [cadena.id] : undefined, measures: [fs, cb].filter(Boolean).map((f, i) => ({ id: `m${i}`, field: f!.id, agg: agg(f!) })), sort: { by: "value", dir: "asc" } }, w: 4, h: "l", opts: { pageSize: 20, totals: true, cond: [{ measure: "m0", kind: "scale" }] } });
    return { widgets: w, calcs: [] };
  }
  return null;
}
function autoWeek(P: Prepared, d: Field): boolean {
  const r = fieldRange(P, d.id);
  return !!r && (r[1] - r[0]) / DAY <= 180 && distinctValues(P, d.id, 1000).length > 8;
}
