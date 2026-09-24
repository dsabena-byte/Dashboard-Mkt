// Test del motor de tableros (lib/viz). Correr:
//   cd apps/web && npx tsx scripts/viz-engine.test.ts
import * as V from "../src/lib/viz/index";

let fails = 0, passes = 0;
function eq(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) passes++; else { fails++; console.error(`✗ ${name}\n   got:  ${JSON.stringify(got)}\n   want: ${JSON.stringify(want)}`); }
}
function near(name: string, got: number | null | undefined, want: number, tol = 1e-6) {
  if (got != null && Math.abs(got - want) <= tol) passes++; else { fails++; console.error(`✗ ${name}: got ${got}, want ${want}`); }
}

// ── Parsing ──
eq("num es-AR", V.parseNumber("1.234,56"), 1234.56);
eq("num en", V.parseNumber("1,234.56"), 1234.56);
eq("num es miles", V.parseNumber("1.234"), 1234);
eq("num en miles", V.parseNumber("1,234", "en"), 1234);
eq("num es decimal coma", V.parseNumber("12,5"), 12.5);
eq("num moneda", V.parseNumber("$ 1.500.000"), 1500000);
eq("num USD", V.parseNumber("US$ 2,500.75"), 2500.75);
eq("num paréntesis", V.parseNumber("(1.200,50)"), -1200.5);
eq("num %", V.parseNumber("12,5%"), 12.5);
eq("num texto", V.parseNumber("N/A"), null);
eq("num guion", V.parseNumber("-"), null);
eq("num decimal punto", V.parseNumber("3.75"), 3.75);
eq("locale en por muestras", V.detectLocale(["1,234.50", "2,000", "15.25"]), "en");
const d = (s: unknown) => { const r = V.parseDate(s, { serial: true }); return r ? V.isoDate(r.t) : null; };
eq("fecha ISO", d("2026-03-15"), "2026-03-15");
eq("fecha dd/mm/aaaa", d("15/03/2026"), "2026-03-15");
eq("fecha dd-mm-aa", d("05-04-26"), "2026-04-05");
eq("fecha mm/dd si día>12", d("03/25/2026"), "2026-03-25");
eq("fecha ene-26", d("ene-26"), "2026-01-01");
eq("fecha Marzo 2026", d("Marzo 2026"), "2026-03-01");
eq("fecha March 2026", d("March 2026"), "2026-03-01");
eq("fecha sept.25", d("sept.25"), "2025-09-01");
eq("fecha 15 de marzo de 2026", d("15 de marzo de 2026"), "2026-03-15");
eq("fecha aaaa-mm", d("2026-07"), "2026-07-01");
eq("fecha serial Excel", d(46096), "2026-03-15");
eq("fecha Q2 2026", d("Q2 2026"), "2026-04-01");
eq("fecha inválida", d("Mayorista"), null);
eq("fecha 30/02 inválida", d("30/02/2026"), null);
eq("bool", [V.parseBool("Sí"), V.parseBool("no"), V.parseBool("x"), V.parseBool("hola")], [true, false, true, null]);
eq("formato", [V.fmtValue(1234567, "currency"), V.fmtValue(12.345, "percent"), V.fmtValue(0.1234, "pct_frac"), V.fmtValue(2.5, "ratio"), V.fmtValue(15300), V.fmtValue(1234.5, "number", false)], ["$1,2M", "12,3%", "12,3%", "2,5x", "15K", "1.234,5"]);

// ── Dataset de prueba (fechas en 3 formatos mezclados, números es-AR y con $) ──
const cols = ["Fecha", "Canal", "Categoría", "Ventas", "Inversión", "Presupuesto", "Share", "Activo", "Año"];
const rows: unknown[][] = [];
const canales = ["Online", "Mayorista", "Retail"];
const cats = ["Lavado", "Refrigeración", "Cocción"];
const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
let k = 0;
for (let y = 2025; y <= 2026; y++) for (let m = 1; m <= 12; m++) {
  if (y === 2026 && m > 8) break;
  for (const c of canales) for (const cat of cats) {
    k++;
    const ventas = 1000 * m + (c === "Online" ? 500 : 0) + (y === 2026 ? 100 : 0);
    const mm = String(m).padStart(2, "0");
    const fecha = k % 3 === 0 ? `15/${mm}/${y}` : k % 3 === 1 ? `${y}-${mm}-10` : `${MES[m - 1]}-${String(y).slice(2)}`;
    rows.push([fecha, c, cat, ventas.toLocaleString("es-AR"), `$ ${(ventas / 10).toLocaleString("es-AR")}`, ventas / 10 + 50, "12,5%", k % 2 ? "Sí" : "No", y]);
  }
}
const ds: V.Dataset = { id: "ds1", name: "ventas.xlsx", columns: cols, rows };
const settings: V.DatasetSettings = {
  calcs: [
    { id: "c_roas", name: "ROAS", expr: "SUM([Ventas]) / SUM([Inversión])" },
    { id: "c_margen", name: "Ventas netas", expr: "[Ventas] - [Inversión]" },
    { id: "c_online", name: "Es online", expr: 'IF(CONTAINS([Canal], "on"), "Online", "Offline")' },
    { id: "c_mes", name: "Mes num", expr: "MONTH([Fecha])" },
    { id: "c_err", name: "Roto", expr: "SUM([Ventas]) + [Ventas]" },
    { id: "c_dep", name: "Neto x2", expr: "[Ventas netas] * 2" },
  ],
};
const P = V.prepare(ds, settings);
const F = (label: string) => P.fields.find((f) => f.label === label)!;
eq("tipos", cols.map((c) => F(c).type), ["date", "text", "text", "number", "number", "number", "number", "boolean", "number"]);
eq("roles", cols.map((c) => F(c).role), ["dimension", "dimension", "dimension", "measure", "measure", "measure", "measure", "dimension", "dimension"]);
eq("formatos", [F("Ventas").format, F("Inversión").format, F("Share").format, F("Presupuesto").format], ["currency", "currency", "percent", "currency"]);
eq("calc agregado", F("ROAS").aggregate, true);
eq("calc texto", F("Es online").type, "text");
eq("calc error", typeof F("Roto").error, "string");
eq("calc dependiente", F("Neto x2").type, "number");
eq("memo prepare", V.prepare(ds, settings) === P, true);
const Pov = V.prepare(ds, { fields: { "8": { type: "text", label: "Ejercicio" }, "3": { format: "integer" } } });
eq("override tipo/label/formato", [Pov.byId.get("8")!.type, Pov.byId.get("8")!.label, Pov.byId.get("3")!.format], ["text", "Ejercicio", "integer"]);

const total = rows.length;
const now = Date.UTC(2026, 8, 24);
const sumVentas = rows.reduce<number>((s, r) => s + Number(String(r[3]).replace(/\./g, "")), 0);
const r1 = V.runQuery(P, { measures: [{ id: "m", field: F("Ventas").id, agg: "sum" }] }, "kpi", { now });
near("kpi total", r1.kpi!.value, sumVentas);
eq("rowCount", r1.rowCount, total);
const r2 = V.runQuery(P, { measures: [{ id: "m", field: "c_roas", agg: "sum" }] }, "kpi", { now });
near("ratio agregado SUM/SUM", r2.kpi!.value, 10, 1e-9);
const r3 = V.runQuery(P, { x: F("Canal").id, measures: [{ id: "m", field: F("Ventas").id, agg: "sum" }] }, "bar", { now });
eq("bar x orden desc", r3.xKeys[0].key, "Online");
near("bar suma canales", r3.rows.reduce((s, r) => s + (r.values[0] ?? 0), 0), sumVentas);
const r4 = V.runQuery(P, { x: F("Fecha").id, grain: "month", measures: [{ id: "m", field: F("Ventas").id, agg: "sum" }, { id: "y", field: F("Ventas").id, agg: "sum", calc: "yoy" }] }, "line", { now });
eq("meses", r4.xKeys.length, 20);
eq("label mes", r4.xKeys[0].label, "Ene 25");
near("yoy mar-26 (+100 x 9 filas)", r4.rows.find((r) => r.keys[0] === "2026-03")!.values[1], 900);
const r4b = V.runQuery(P, { x: F("Fecha").id, grain: "month", measures: [{ id: "y", field: F("Ventas").id, agg: "sum", calc: "yoy" }], filters: [{ field: F("Fecha").id, op: "date_relative", rel: "ytd" }] }, "line", { now });
near("yoy con filtro de fecha (usa año anterior igual)", r4b.rows[0].values[0], 900);
const r5 = V.runQuery(P, { measures: [{ id: "m", field: V.ROWS_FIELD, agg: "count" }], filters: [{ field: F("Canal").id, op: "in", values: ["Online"] }, { field: F("Categoría").id, op: "contains", text: "lav" }] }, "kpi", { now });
eq("filtros in+contains", r5.kpi!.value, 20);
const r6 = V.runQuery(P, { measures: [{ id: "m", field: V.ROWS_FIELD, agg: "count" }], filters: [{ field: F("Fecha").id, op: "date_relative", rel: "ytd" }] }, "kpi", { now });
eq("filtro ytd 2026", r6.kpi!.value, 8 * 9);
const r6b = V.runQuery(P, { measures: [{ id: "m", field: V.ROWS_FIELD, agg: "count" }], filters: [{ field: F("Fecha").id, op: "date_relative", rel: "this_month", anchor: "datos" }] }, "kpi", { now });
eq("filtro último mes con datos", r6b.kpi!.value, 9);
const r6c = V.runQuery(P, { measures: [{ id: "m", field: V.ROWS_FIELD, agg: "count" }], filters: [{ field: F("Fecha").id, op: "between", min: "2025-01-01", max: "2025-03-31" }] }, "kpi", { now });
eq("filtro between fechas", r6c.kpi!.value, 27);
const r6d = V.runQuery(P, { measures: [{ id: "m", field: V.ROWS_FIELD, agg: "count" }], filters: [{ field: F("Ventas").id, op: "gte", min: 8000 }] }, "kpi", { now });
eq("filtro gte numérico", r6d.kpi!.value, rows.filter((r) => Number(String(r[3]).replace(/\./g, "")) >= 8000).length);
const r7 = V.runQuery(P, { measures: [{ id: "m", field: F("Ventas").id, agg: "sum" }], dateField: F("Fecha").id, grain: "month" }, "kpi", { now }, { kpiMode: "last", compare: "prev_year" });
eq("kpi last período", r7.kpi!.periodLabel, "Ago 26");
near("kpi last delta vs año ant.", r7.kpi!.deltaPct, (900 / (8000 * 9 + 500 * 3)) * 100, 1e-6);
eq("sparkline", r7.kpi!.spark.length, 20);
const r7b = V.runQuery(P, { measures: [{ id: "m", field: F("Ventas").id, agg: "sum" }], dateField: F("Fecha").id, grain: "month" }, "kpi", { now }, { kpiMode: "last", compare: "prev_period" });
eq("kpi vs mes anterior", r7b.kpi!.prevLabel, "Jul 26");
const r8 = V.runQuery(P, { measures: [{ id: "m", field: F("Ventas").id, agg: "sum" }], dateField: F("Fecha").id }, "kpi", { now }, { kpiMode: "total", compare: "prev_year" });
eq("kpi ytd label", r8.kpi!.periodLabel, "Acum. 2026");
eq("kpi ytd delta > 0", (r8.kpi!.deltaPct ?? 0) > 0, true);
const r9 = V.runQuery(P, { measures: [{ id: "m", field: F("Inversión").id, agg: "sum" }], target: { field: F("Presupuesto").id, agg: "sum" } }, "kpi", { now });
eq("cumplimiento < 100", (r9.kpi!.cumpl ?? 200) < 100, true);
const r10 = V.runQuery(P, { x: F("Canal").id, measures: [{ id: "m", field: F("Ventas").id, agg: "sum" }], topN: { n: 1, others: true } }, "bar", { now });
eq("topN keys", r10.xKeys.map((x) => x.label), ["Online", "Otros"]);
near("topN conserva total", r10.rows.reduce((s, r) => s + (r.values[0] ?? 0), 0), sumVentas);
const r11 = V.runQuery(P, { x: F("Canal").id, measures: [{ id: "m", field: F("Ventas").id, agg: "sum", calc: "pct_total" }] }, "bar", { now });
near("% total suma 100", r11.rows.reduce((s, r) => s + (r.values[0] ?? 0), 0), 100);
const r12 = V.runQuery(P, { x: F("Fecha").id, grain: "year", measures: [{ id: "m", field: F("Ventas").id, agg: "sum", calc: "running" }] }, "line", { now });
near("acumulado final = total", r12.rows[r12.rows.length - 1].values[0], sumVentas);
const r12b = V.runQuery(P, { x: F("Fecha").id, grain: "month", measures: [{ id: "m", field: F("Ventas").id, agg: "sum", calc: "moving_avg", n: 3 }] }, "line", { now });
near("media móvil 3", r12b.rows[2].values[0], ((1000 + 2000 + 3000) * 9 + 500 * 3 * 3) / 3);
const r12c = V.runQuery(P, { x: F("Fecha").id, grain: "month", measures: [{ id: "m", field: F("Ventas").id, agg: "sum", calc: "pct_prev" }] }, "line", { now });
eq("% vs anterior 1ª vacía", r12c.rows[0].values[0], null);
const r13 = V.runQuery(P, { x: F("Canal").id, series: F("Categoría").id, measures: [{ id: "m", field: F("Ventas").id, agg: "sum" }] }, "heatmap", { now });
eq("heatmap celdas", r13.rows.length, 9);
eq("series", r13.seriesKeys.length, 3);
const r14 = V.runQuery(P, { rows: [F("Canal").id, F("Categoría").id], cols: [F("Año").id], measures: [{ id: "m", field: F("Ventas").id, agg: "sum" }] }, "pivot", { now });
eq("pivot filas (3 subtot + 9 hojas)", r14.pivot!.rows.length, 12);
eq("pivot columnas", r14.pivot!.colKeys.map((c) => c.label), ["2025", "2026"]);
near("pivot gran total", r14.pivot!.grand[r14.pivot!.grand.length - 1][0], sumVentas);
const sub = r14.pivot!.rows[0];
near("pivot subtotal = suma hojas", sub.cells[2][0], r14.pivot!.rows.slice(1, 4).reduce((s, r) => s + (r.cells[2][0] ?? 0), 0));
const r15 = V.runQuery(P, { x: "c_online", measures: [{ id: "m", field: F("Canal").id, agg: "countd" }, { id: "n", field: "c_margen", agg: "sum" }] }, "bar", { now });
eq("calc como dimensión", r15.xKeys.map((x) => x.key).sort(), ["Offline", "Online"]);
eq("countd", r15.rows.find((r) => r.keys[0] === "Offline")!.values[0], 2);
const r16 = V.runQuery(P, { measures: [] }, "table", { now }, { detail: true });
eq("detalle filas", r16.detail!.rows.length, total);
const r17 = V.runQuery(P, { x: F("Categoría").id, measures: [{ id: "a", field: F("Inversión").id, agg: "sum" }, { id: "b", field: F("Ventas").id, agg: "sum" }] }, "scatter", { now });
eq("scatter puntos", r17.rows.length, 3);
const r18 = V.runQuery(P, { measures: [{ id: "m", field: V.ROWS_FIELD, agg: "count" }], filters: [{ field: F("Fecha").id, op: "bucket", values: ["2026-02"], grain: "month" }] }, "kpi", { now });
eq("filtro bucket (cruzado)", r18.kpi!.value, 9);
const r20 = V.runQuery(P, { x: F("Canal").id, measures: [{ id: "m", field: F("Ventas").id, agg: "median" }, { id: "n", field: F("Ventas").id, agg: "max" }] }, "table", { now });
eq("mediana/max", r20.rows.length, 3);

// ── Expresiones ──
const ev = (s: string) => { const c = V.compile(s, () => null); return V.evaluate(c.ast, () => null); };
eq("expr aritmética", ev("2 + 3 * (4 - 1) / 2"), 6.5);
eq("expr IF/AND", ev('IF(1 < 2 AND NOT (3 = 4), "ok", "no")'), "ok");
eq("expr texto", ev('CONCAT(LEFT("Buenos", 3), RIGHT("Aires", 2))'), "Buees");
eq("expr ROUND/ABS", ev("ROUND(ABS(-2.345), 2)"), 2.35);
eq("expr div 0", ev("5 / 0"), null);
eq("expr ; es-AR", ev("IF(1 = 1; 10; 20)"), 10);
eq("expr MAX fila", ev("MAX(3, 7, 5)"), 7);
let msg = ""; try { V.compile("SUM([X]", () => "x"); } catch (e) { msg = (e as Error).message; }
eq("expr error paréntesis", msg, "Falta cerrar un paréntesis");
msg = ""; try { V.compile("eval(1)", () => null); } catch (e) { msg = (e as Error).message; }
eq("expr función desconocida", msg, "Función desconocida “eval”");
msg = ""; try { V.compile("constructor", () => null); } catch (e) { msg = (e as Error).message; }
eq("expr identificador suelto", msg.startsWith("“constructor” no es un campo"), true);

// ── Upgrade de configs viejas ──
const legacy = { widgets: [{ id: "a", type: "kpi", title: "Ventas", metrics: ["3"], agg: "sum", unit: "$", metaCol: "5" }, { id: "b", type: "hbar", title: "Por canal", x: "1", metrics: ["3"], span: 2 }, { id: "c", type: "table", title: "Detalle" }, { id: "d", type: "combo", x: "0", metrics: ["3", "4"] }] };
const up = V.upgradeDashboard(legacy, { title: "T", datasetId: "ds1" });
eq("legacy tipos", up.widgets.map((w) => w.type), ["kpi", "bar", "table", "combo"]);
eq("legacy hbar", [up.widgets[1].opts.orientation, up.widgets[1].w], ["h", 4]);
eq("legacy kpi meta", up.widgets[0].q.target?.field, "5");
eq("legacy formato", up.widgets[0].q.measures[0].format, "currency");
eq("legacy combo eje", up.widgets[3].q.measures.map((m) => m.axis), ["left", "right"]);
near("legacy kpi corre", V.runQuery(P, up.widgets[0].q, "kpi", { now }).kpi!.value, sumVentas);
eq("v2 idempotente", JSON.stringify(V.upgradeDashboard(up)) === JSON.stringify(up), true);

// ── Automático, plantillas, Mostrame, filtros de tablero, saneo ──
const auto = V.autoDashboard(P, "ds1");
eq("auto: kpis + evolución + tabla", [auto.some((w) => w.type === "kpi"), auto.some((w) => ["line", "bar", "combo"].includes(w.type) && w.q.x === F("Fecha").id), auto.some((w) => w.type === "table")], [true, true, true]);
eq("auto sin errores", auto.map((w) => V.runQuery(P, w.q, w.type, { now }, { kpiMode: w.opts.kpiMode, compare: w.opts.compare, detail: w.opts.detail })).filter((r) => r.error).length, 0);
const tpl = V.templateFor("inversion", V.prepare(ds, {}), "ds1");
eq("plantilla inversión", !!tpl && tpl.widgets.length >= 4, true);
const P2 = V.prepare(ds, { calcs: tpl!.calcs });
const tplRes = tpl!.widgets.map((w) => V.runQuery(P2, w.q, w.type, { now }, { kpiMode: w.opts.kpiMode, compare: w.opts.compare }));
eq("plantilla corre sin error", tplRes.filter((r) => r.error).length, 0);
const inv = sumVentas / 10, bgt = sumVentas / 10 + 50 * total;
near("desvío (calc de plantilla)", tplRes[1].kpi!.value, ((inv - bgt) / bgt) * 100, 1e-6);
eq("plantilla resultados", !!V.templateFor("resultados", P, "ds1"), true);
eq("plantilla trade sin columnas → null", V.templateFor("trade", V.prepare({ id: "x", name: "x", columns: ["A", "B"], rows: [["a", 1]] }), "x"), null);
eq("showMe fecha+medida", V.showMe({ dims: [F("Fecha")], measures: 1, hasTarget: false }).best, "line");
eq("showMe cat+medida", V.showMe({ dims: [F("Canal")], measures: 1, hasTarget: false }).best, "bar");
eq("showMe solo medida", V.showMe({ dims: [], measures: 1, hasTarget: false }).best, "kpi");
const ef = V.effectiveFilters("ds1", "w1", [{ id: "f1", datasetId: "ds1", field: "0", kind: "date" }, { id: "f2", datasetId: "ds1", field: "1", kind: "list" }, { id: "f3", datasetId: "otro", field: "1", kind: "list" }], { date: { f1: { preset: "ytd" } }, list: { f2: ["Online"], f3: ["X"] } }, [{ sourceWidget: "w2", datasetId: "ds1", field: "2", key: "Lavado", label: "Lavado" }, { sourceWidget: "w1", datasetId: "ds1", field: "2", key: "X", label: "X" }]);
eq("filtros efectivos (tablero + cruzado de otro widget)", ef.map((f) => f.op), ["date_relative", "in", "in"]);
const bad = V.sanitizeWidget({ type: "hack", q: { measures: [{ field: "nope" }, { field: "3", agg: "evil" }] }, w: 9 }, P);
eq("sanitize", [bad!.type, bad!.q.measures.length, bad!.q.measures[0].agg, bad!.w], ["bar", 1, "sum", 2]);

// ── Blend (lookup a 2º dataset) ──
const ds2: V.Dataset = { id: "ds2", name: "canales.csv", columns: ["canal", "Responsable", "Meta anual"], rows: [["online", "Ana", "1.000.000"], ["Mayorista", "Juan", "2.000.000"]] };
const P3 = V.prepare(ds, { blends: [{ id: "b1", datasetId: "ds2", localKey: F("Canal").id, remoteKey: "0", fields: ["1", "2"] }] }, (id) => (id === "ds2" ? ds2 : null));
eq("blend lookup", V.runQuery(P3, { x: "bl_b1_1", measures: [{ id: "m", field: V.ROWS_FIELD, agg: "count" }] }, "bar", { now }).xKeys.map((x) => x.key).sort(), ["(vacío)", "Ana", "Juan"]);
eq("blend numérico", P3.byId.get("bl_b1_2")!.type, "number");

// ── Performance: 100k filas ──
const big: unknown[][] = [];
for (let i = 0; i < 100000; i++) big.push([`${1 + (i % 28)}/${1 + (i % 12)}/2026`, canales[i % 3], cats[i % 3] + (i % 50), `${(i % 1000) * 3},5`, i % 7]);
const t0 = Date.now();
const PB = V.prepare({ id: "big", name: "big", columns: ["Fecha", "Canal", "Producto", "Ventas", "Unidades"], rows: big }, {});
const t1 = Date.now();
const rb = V.runQuery(PB, { x: "0", grain: "month", series: "1", measures: [{ id: "m", field: "3", agg: "sum" }] }, "bar", { now });
const rp = V.runQuery(PB, { rows: ["2"], cols: ["1"], measures: [{ id: "m", field: "3", agg: "sum" }] }, "pivot", { now });
const t2 = Date.now();
V.runQuery(PB, { x: "0", grain: "month", series: "1", measures: [{ id: "m", field: "3", agg: "sum" }] }, "bar", { now });
const t3 = Date.now();
console.log(`  perf 100k filas: prepare ${t1 - t0}ms · bar+pivot ${t2 - t1}ms · repetida (memo) ${t3 - t2}ms · aviso: ${PB.warnings[0] ? "sí" : "no"}`);
eq("perf resultado", [rb.xKeys.length, rp.pivot!.rows.length], [12, 150]);
eq("perf < 3s", t2 - t0 < 3000, true);

console.log(`\n${passes} OK · ${fails} fallas`);
if (fails) process.exit(1);
