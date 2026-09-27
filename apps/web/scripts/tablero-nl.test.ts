// "Armame el tablero" en lenguaje natural (portado de BIP, sep-2026): datasets nativos virtuales de Drean,
// capa semántica (catálogo de métricas → columnas), validación estricta del JSON del modelo, fallback sin IA
// y cruce por mes. Correr: cd apps/web && npx tsx scripts/tablero-nl.test.ts
import * as V from "../src/lib/viz/index";
import {
  NATIVE_DEFS, isNativeId, pautaMensual, pautaPorMedio, redesIgMensual, seguimientoTabla, tipoMedio, webMensual,
} from "../src/lib/native-datasets-core";
import type { PautaMesMedios } from "../src/lib/pauta-medios-model";

let fails = 0, passes = 0;
function ok(name: string, cond: boolean, extra?: unknown) {
  if (cond) passes++; else { fails++; console.error(`✗ ${name}${extra !== undefined ? `\n   ${JSON.stringify(extra)}` : ""}`); }
}
function eq(name: string, got: unknown, want: unknown) { ok(name, JSON.stringify(got) === JSON.stringify(want), { got, want }); }

// ── 1 · Datasets nativos ──────────────────────────────────────────────────────
const mm = (inv: number, impr: number, alc: number, clic: number) => ({ inv, alc, impr, clic, v50: 0, vbase: 0 });
const meses: (PautaMesMedios | null)[] = Array.from({ length: 12 }, () => null);
meses[6] = { mesIdx: 6, mesLabel: "Julio 2026", iso: "2026-07-01", tot: mm(1000, 10000, 500, 100), medios: { Meta: { ...mm(700, 8000, 500, 60), fuente: "api" }, "TV Cable": { ...mm(300, 2000, 0, 40), fuente: "omd" } } };
meses[7] = { mesIdx: 7, mesLabel: "Agosto 2026", iso: "2026-08-01", tot: mm(2000, 18000, 800, 150), medios: { Meta: { ...mm(1500, 12000, 800, 90), fuente: "api" }, YouTube: { ...mm(500, 6000, 0, 60), fuente: "api" } } };
const dsPauta = pautaMensual([{ anio: 2026, meses }]);
eq("pauta mensual: solo meses con dato", dsPauta.rows.length, 2);
eq("pauta mensual: mes ISO", dsPauta.rows[0]![0], "2026-07-01");
eq("pauta mensual: inversión offline (TV)", dsPauta.rows[0]![7], 300);
const dsMedios = pautaPorMedio([{ anio: 2026, meses }]);
eq("pauta por medio: 2 + 2 filas", dsMedios.rows.length, 4);
ok("pauta por medio: TV es offline", dsMedios.rows.some((r) => r[1] === "TV Cable" && r[2] === "Offline"));
eq("pauta por medio: suma inversión = total", dsMedios.rows.reduce((s, r) => s + Number(r[3]), 0), 3000);
eq("tipoMedio OOH/DOOH offline", [tipoMedio("OOH"), tipoMedio("DOOH"), tipoMedio("Meta")], ["Offline", "Offline", "Online"]);
const dsWeb = webMensual(
  [{ mes: "2026-07-01", sesiones: 1000, pageviews: 3000, avg_session_duration: 62.345 }, { mes: "2026-08-01", sesiones: 800, pageviews: 2000, avg_session_duration: 70 }],
  [{ mes: "2026-07-01", total_users: 700 }],
  [{ mes: "2026-07-01", conversiones: 15 }, { mes: "2026-07-01", conversiones: 5 }],
);
eq("web: filas", dsWeb.rows.length, 2);
eq("web: conversiones sumadas por canal", dsWeb.rows[0]![5], 20);
eq("web: tasa = conv/sesiones", dsWeb.rows[0]![6], 2);
eq("web: sin conversiones = vacío (no 0)", dsWeb.rows[1]![5], null);
eq("web: usuarios faltantes = vacío", dsWeb.rows[1]![1], null);
const dsRedes = redesIgMensual([
  { fecha_post: "2026-08-02T10:00:00Z", reach: 1000, engagement: 50, reactions: 40, clicks: 5, media_type: "REELS" },
  { fecha_post: "2026-08-10T10:00:00Z", reach: 500, engagement: 10, reactions: 8, clicks: 1, media_type: "STORY" },
  { fecha_post: "2026-07-10T10:00:00Z", reach: 200, engagement: 4, reactions: 4, clicks: 0, media_type: "IMAGE" },
]);
eq("redes: una fila por mes (ordenadas)", dsRedes.rows.map((r) => r[0]), ["2026-07-01", "2026-08-01"]);
eq("redes: alcance agosto (suma, con historias)", dsRedes.rows[1]![2], 1500);
eq("redes: comentarios = residual", dsRedes.rows[1]![5], 6);
eq("redes: ER = interacciones/alcance", dsRedes.rows[1]![9], 4);
const dsSeg = seguimientoTabla(2026, [{ plan: "Pauta Mkt", kpi: "Frecuencia", unit: "x", tipo: "rate", direccion: "down", realM: [2, null, ...Array(10).fill(null)], metaM: [2.5, 2.5, ...Array(10).fill(null)] }]);
eq("seguimiento: cumplimiento con dirección down", dsSeg.rows[0]![5], 125);
eq("seguimiento: mes sin real queda con meta", dsSeg.rows[1]![3], null);
ok("ids nativos", NATIVE_DEFS.every((d) => isNativeId(d.id) && d.dash.startsWith("/")) && !isNativeId("0d2b-uuid"));

const P = V.prepare(dsPauta);
const fld = (P0: V.Prepared, label: string) => P0.fields.find((f) => f.label === label)!;
eq("motor: Mes es fecha", fld(P, "Mes").type, "date");
eq("motor: Inversión es moneda", fld(P, "Inversión").format, "currency");
eq("motor: Tasa de conversión es %", fld(V.prepare(dsWeb), "Tasa de conversión (%)").format, "percent");

// ── 2 · Capa semántica ────────────────────────────────────────────────────────
const ventas: V.Dataset = { id: "sheet1", name: "Ventas 2026.xlsx", columns: ["Fecha", "Canal", "Ventas", "Unidades"], rows: [
  ["05/07/2026", "Online", "10.000", "5"], ["20/07/2026", "Tienda", "5.000", "2"], ["03/08/2026", "Online", "12.500", "6"],
] };
const schemas = [V.aiSchema(P, dsPauta.id), V.aiSchema(V.prepare(dsMedios), dsMedios.id), V.aiSchema(V.prepare(ventas), ventas.id), V.aiSchema(V.prepare(dsWeb), dsWeb.id), V.aiSchema(V.prepare(dsRedes), dsRedes.id)];
const ann = V.annotateSchema(schemas[1]!);
ok("anotación: Inversión → métrica inversion", ann.fields.find((f) => f.label === "Inversión")?.metrica === "inversion");
ok("anotación: derivadas incluyen CPM × 1000", !!ann.derivadas?.some((d) => d.metrica === "cpm" && d.expr === "SUM([Inversión]) / SUM([Impresiones]) * 1000"));
ok("anotación: CTR", !!ann.derivadas?.some((d) => d.metrica === "ctr"));

const res = V.resolvePrompt("quiero ver inversión vs ventas por mes y el CPM por medio", schemas);
eq("resuelve 3 métricas", res.metrics.map((m) => m.metrica), ["inversion", "facturacion", "cpm"]);
eq("inversión → columna exacta primero", res.metrics[0]!.cands[0]!.label, "Inversión");
ok("ventas → planilla", res.metrics[1]!.cands.some((c) => c.datasetId === "sheet1"));
ok("CPM → calc en pauta por medio", res.metrics[2]!.cands.some((c) => c.datasetId === "nat:pauta-medios" && !!c.calc));
eq("grano mes", res.grain, "month");
ok("compara", res.compare);
ok("dimensión medio resuelta", res.dims.some((d) => d.term === "medio" && d.cands.some((c) => c.datasetId === "nat:pauta-medios")));
eq("sin términos sin resolver", res.sinResolver, []);
const exp = V.explainResolution(res, Object.fromEntries(schemas.map((s) => [s.id, s.name])));
ok("explicación legible", exp.some((e) => e.includes("CPM")), exp);
const res3 = V.resolvePrompt("engagement rate mensual de instagram", [schemas[4]!]);
ok("engagement rate → columna o receta, por mes", res3.metrics.length > 0 && res3.grain === "month", res3.metrics);
const res4 = V.resolvePrompt("cosas raras por zodiaco", schemas);
eq("nada reconocible", res4.metrics.length, 0);
eq("dimensión desconocida informada", res4.sinResolver, ["zodiaco"]);

// ── 3 · Validación estricta ───────────────────────────────────────────────────
const inv = fld(P, "Inversión").id, mes = fld(P, "Mes").id;
const good = { widgets: [{ type: "line", title: "Inversión por mes", datasetId: "nat:pauta", q: { x: mes, grain: "month", measures: [{ field: inv, agg: "sum" }] } }] };
eq("válido", V.validateNlOutput(good, schemas, "nat:pauta").ok, true);
const bad = { widgets: [
  { type: "torta", title: "x", q: { x: mes, measures: [{ field: inv }] } },
  { type: "bar", title: "Campo inventado", datasetId: "nat:pauta", q: { x: mes, measures: [{ field: "99", agg: "sum" }] } },
  { type: "bar", title: "Sin x", datasetId: "nat:pauta", q: { measures: [{ field: inv, agg: "sum" }] } },
  { type: "line", title: "Ok", datasetId: "nat:pauta", q: { x: mes, measures: [{ field: inv, agg: "sum" }] } },
], calcs: [{ datasetId: "nat:pauta", name: "CPX", expr: "SUM([Inexistente]) / SUM([Clicks])" }] };
const vb = V.validateNlOutput(bad, schemas, "nat:pauta");
eq("inválido", vb.ok, false);
ok("error de tipo", vb.errors.some((e) => e.includes('type "torta"')), vb.errors);
ok("error de campo inventado", vb.errors.some((e) => e.includes('"99" no existe')), vb.errors);
ok("error de x faltante", vb.errors.some((e) => e.includes("necesita q.x")), vb.errors);
ok("error de calc", vb.errors.some((e) => e.includes("[Inexistente]")), vb.errors);
eq("conserva solo el widget válido", vb.value.widgets.length, 1);
eq("no-objeto", V.validateNlOutput("hola", schemas, "nat:pauta").ok, false);
const blendOut = { widgets: [{ type: "combo", title: "Inv vs ventas", datasetId: "nat:pauta", q: { x: mes, grain: "month", measures: [{ field: inv, agg: "sum" }, { field: "bl_v_2", agg: "sum" }] } }], blends: [{ id: "v", datasetId: "nat:pauta", remoteDatasetId: "sheet1", localKey: mes, remoteKey: "0", fields: ["2"], grain: "month" }] };
eq("cruce válido", V.validateNlOutput(blendOut, schemas, "nat:pauta").ok, true);
const blendBad = { ...blendOut, blends: [{ ...blendOut.blends[0]!, remoteKey: "1" }] };
ok("cruce por mes exige fechas", V.validateNlOutput(blendBad, schemas, "nat:pauta").errors.some((e) => e.includes("claves de tipo fecha")));

// ── 4 · Fallback determinístico ───────────────────────────────────────────────
const fb = V.fallbackPlan(res, schemas)!;
ok("fallback arma algo", !!fb && fb.widgets.length >= 3);
ok("fallback: combo inversión vs ventas con cruce por mes", fb.blends.length === 1 && fb.blends[0]!.grain === "month" && fb.widgets.some((w) => w.type === "combo"), fb);
ok("fallback: CPM por medio (calc)", fb.calcs.some((c) => c.name === "CPM") && fb.widgets.some((w) => String(w.title).startsWith("CPM por medio")), fb.widgets.map((w) => w.title));
const vfb = V.validateNlOutput(fb, schemas, "nat:pauta");
ok("el fallback pasa la validación estricta", vfb.ok, vfb.errors);
eq("fallback null si no hay métricas", V.fallbackPlan(res4, schemas), null);

// ── 5 · Cruce por mes en el motor ─────────────────────────────────────────────
const lookup = (id: string) => (id === "sheet1" ? ventas : undefined);
const Pb = V.prepare(dsMedios, { blends: [{ id: "v", datasetId: "sheet1", localKey: "0", remoteKey: "0", fields: ["2"], grain: "month" }] }, lookup);
const bf = Pb.fields.find((f) => f.id === "bl_v_2")!;
ok("campo cruzado existe y es número", !!bf && bf.type === "number", bf);
const r = V.runQuery(Pb, { x: "0", grain: "month", measures: [{ id: "m0", field: "3", agg: "sum" }, { id: "m1", field: "bl_v_2", agg: "sum" }] }, "combo");
eq("ventas por mes sin duplicar (aunque haya 2 filas por mes)", r.rows.map((x) => x.values[1]), [15000, 12500]);
eq("inversión por mes", r.rows.map((x) => x.values[0]), [1000, 2000]);
eq("sanitize conserva grain", V.sanitizeDashboard({ v: 2, datasets: { a: { blends: [{ id: "v", datasetId: "s", localKey: "0", remoteKey: "0", fields: ["2"], grain: "month" }] } } }).datasets.a!.blends?.[0]!.grain, "month");

console.log(`tablero-nl: ${passes} OK, ${fails} fallas`);
if (fails) process.exit(1);
