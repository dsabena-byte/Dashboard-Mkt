// Tarjeta de recomendación única (lib/recomendacion.ts, portado de BIP sep-2026). Correr: cd apps/web && npx tsx scripts/recomendacion.test.ts
import {
  calcPrioridad, nivelPrioridad, estimarEsfuerzo, fromSignal, recomendacionesDeSenales, fromPlanAccion, fromOportunidad,
  fromHallazgo, recomendacionesDeDiagnostico, unirRecomendaciones, ordenarRecomendaciones, parseNumeroAR, parseImpacto,
  evaluarResultado, fechaChequeo, ultimoConDato, medirSeguimiento, fmtImpacto, slugKey, hashRec, metricaDeTextos,
  type Recomendacion,
} from "../src/lib/recomendacion";
import { computePautaSignals } from "../src/lib/signals/pauta";
import type { Signal } from "../src/lib/signals/types";

let pass = 0, fail = 0;
function ok(name: string, cond: boolean, extra?: unknown) {
  if (cond) pass++; else { fail++; console.error(`✗ ${name}${extra !== undefined ? `\n   ${JSON.stringify(extra)}` : ""}`); }
}
function eq(name: string, got: unknown, want: unknown) { ok(name, JSON.stringify(got) === JSON.stringify(want), { got, want }); }

// ── Prioridad = impacto × confianza ÷ esfuerzo ──
eq("prio 5·alta/1", calcPrioridad(5, "alta", 1), { score: 5, nivel: "critica" });
eq("prio 4·media/2", calcPrioridad(4, "media", 2), { score: 1.4, nivel: "media" });
eq("prio 3·baja/3", calcPrioridad(3, "baja", 3), { score: 0.4, nivel: "baja" });
eq("prio 3·alta/1", calcPrioridad(3, "alta", 1), { score: 3, nivel: "critica" });
eq("prio clamp", calcPrioridad(9, "alta", 1).score, 5);
eq("nivel 1.8", nivelPrioridad(1.8), "alta");
ok("más esfuerzo ⇒ menos prioridad", calcPrioridad(4, "alta", 1).score > calcPrioridad(4, "alta", 3).score);
ok("más confianza ⇒ más prioridad", calcPrioridad(4, "alta", 2).score > calcPrioridad(4, "baja", 2).score);

// ── Esfuerzo heurístico ──
eq("esfuerzo bajo", estimarEsfuerzo("Pausar la campaña y reasignar el presupuesto", "performance").nivel, 1);
eq("esfuerzo alto", estimarEsfuerzo("Rediseñar la landing de producto", "web").nivel, 3);
eq("esfuerzo medio", estimarEsfuerzo("Publicar más carruseles", "redes").nivel, 2);
eq("quién por tablero", estimarEsfuerzo("x", "seo-search").quien, "Contenido / SEO");

// ── Adaptador de señales ──
const sig: Signal = {
  key: "pauta_realloc_clicks", dash: "performance", tipo: "oportunidad", prioridad: "alta",
  titulo: "Mover 20% de la inversión de la campaña A a la B", descripcion: "B tiene CPC $ 40 vs A $ 90.",
  acciones: ["Bajar 20% el presupuesto de A", "Subir el presupuesto de B"], datos: {},
  impacto: { metrica: "Clicks adicionales (20% reasignado)", valor: 1200, unidad: "clicks" },
};
const r = fromSignal(sig);
ok("id con prefijo", r.id.startsWith("senal:performance:pauta_realloc_clicks-"), r.id);
eq("tipo", r.tipo, "oportunidad");
eq("pasos", r.pasos, sig.acciones);
eq("rango impacto", [r.impacto?.bajo, r.impacto?.alto, r.impacto?.unidad], [600, 1200, "clicks"]);
eq("kpi clicks", r.kpi, { id: "clicks", nombre: "Clicks", seguimiento: "Clicks" });
eq("medición", [r.medicion.kpi, r.medicion.direccion, r.medicion.ventanaDias], ["Clicks", "up", 21]);
eq("confianza media (impacto estimado)", r.confianza.nivel, "media");
eq("impactoNivel alta+cuant", r.impactoNivel, 5);
eq("esfuerzo bajo (reasignar)", r.esfuerzo.nivel, 1);
eq("prioridad", r.prioridad, { score: 3.5, nivel: "critica" });
ok("recurso a la guía", !!r.recurso?.href.startsWith("/guia/"), r.recurso);
eq("fmtImpacto", fmtImpacto(r.impacto), "+600 a +1.200 clicks");

const alerta = fromSignal({ ...sig, key: "x", tipo: "alerta", impacto: undefined });
eq("alerta observada ⇒ confianza alta", alerta.confianza.nivel, "alta");
eq("sin impacto ⇒ null", alerta.impacto, null);
const cruce = fromSignal({ ...sig, key: "cruce_x", cruce: true });
eq("cruce ⇒ confianza baja", cruce.confianza.nivel, "baja");
eq("cruce flag", cruce.cruce, true);
const seo = fromSignal({ ...sig, key: "s", dash: "seo-search", impacto: { metrica: "Clicks extra estimados (período de 3 meses)", valor: 300, unidad: "clicks" } });
eq("SEO: clicks = orgánicos (sin serie en el Seguimiento)", [seo.kpi?.id, seo.medicion.kpi], ["clicks_organicos", null]);
const redes = fromSignal({ ...sig, key: "r", dash: "redes", impacto: { metrica: "Alcance perdido en el período", valor: -5000, unidad: "personas" } });
eq("Redes: alcance = orgánico, valor absoluto", [redes.kpi?.seguimiento, redes.impacto?.alto], ["Alcance orgánico", 5000]);
const rara = fromSignal({ ...sig, key: "overview_kpi_no_meta_Web / Ecommerce_Tráfico web" });
ok("id seguro con clave rara", /^[a-z_]+:[a-z-]+:[\w.:-]+$/i.test(rara.id), rara.id);
ok("slug estable", slugKey("a b") === slugKey("a b") && slugKey("a b") !== slugKey("a_b"));
eq("hash estable", hashRec("hola"), hashRec("hola"));
eq("info sin acciones no es tarjeta", recomendacionesDeSenales([{ ...sig, acciones: [] }, sig]).length, 1);
eq("metricaDeTextos orden", metricaDeTextos([null, "Tasa de conversión baja"], "web")?.id, "conversion");

// Señales reales del motor de pauta → todas se adaptan sin romper.
const pautaMin = { months: [], campaigns: [], creatives: [], totals: {}, currency: "ARS" } as unknown as Parameters<typeof computePautaSignals>[0];
let sigReales: Signal[] = [];
try { sigReales = computePautaSignals(pautaMin); } catch { sigReales = []; }
ok("adapta señales reales", recomendacionesDeSenales(sigReales).every((x) => x.titulo && x.prioridad.score > 0));

// ── Parseo de números y de impacto (texto de la IA) ──
eq("num 3.400", parseNumeroAR("3.400"), 3400);
eq("num 1,2", parseNumeroAR("1,2"), 1.2);
eq("num 1.234,5", parseNumeroAR("1.234,5"), 1234.5);
eq("num 1,2M", parseNumeroAR("1,2M"), 1200000);
eq("num 15 mil", parseNumeroAR("15 mil"), 15000);
eq("num punto final", parseNumeroAR("3.400."), 3400);
eq("imp rango", parseImpacto("entre 1.200 y 2.000 clicks/mes"), { bajo: 1200, alto: 2000, unidad: "clicks/mes" });
eq("imp pct", parseImpacto("+18% de CTR"), { bajo: 18, alto: 18, unidad: "%" });
eq("imp moneda", parseImpacto("Ahorro de $ 1,2M por mes"), { bajo: 1200000, alto: 1200000, unidad: "$" });
eq("imp pp", parseImpacto("+2 a +4 pp de share of search"), { bajo: 2, alto: 4, unidad: "pp" });
eq("imp guion", parseImpacto("10-20% más de vistas"), { bajo: 10, alto: 20, unidad: "%" });
eq("imp unidad", parseImpacto("≈ 3.400 vistas completas"), { bajo: 3400, alto: 3400, unidad: "vistas" });
eq("imp ignora top-3", parseImpacto("llevarla al top-3 suma 400 clicks")?.alto, 400);
eq("imp sin número", parseImpacto("Mejora la percepción de marca"), null);
eq("imp vacío", parseImpacto(""), null);

// ── Adaptadores del Diagnóstico IA ──
const plan = fromPlanAccion({ accion: "Rotar las creatividades de Meta con frecuencia > 4", prioridad: "alta", porque: "Frecuencia 6,2 y CTR en caída", impactoEsperado: "+15% de CTR en 3 semanas" }, "performance");
eq("plan origen/tipo", [plan.origen, plan.tipo], ["ia_plan", "mejora"]);
eq("plan cuantificado ⇒ media", plan.confianza.nivel, "media");
eq("plan kpi CTR (sin serie)", [plan.kpi?.id, plan.medicion.kpi], ["ctr", null]);
eq("plan esfuerzo bajo (rotar)", plan.esfuerzo.nivel, 1);
ok("plan id ia", plan.id.startsWith("ia:performance:"));
const planSin = fromPlanAccion({ accion: "Trabajar la comunicación", prioridad: "media", porque: "", impactoEsperado: "Mejor recordación" }, "overview");
eq("plan sin número ⇒ baja", planSin.confianza.nivel, "baja");
eq("plan sin número ⇒ texto", [planSin.impacto?.bajo, planSin.impacto?.texto], [null, "Mejor recordación"]);
eq("fmtImpacto texto", fmtImpacto(planSin.impacto), "Mejor recordación");
const opo = fromOportunidad({ palanca: "Escalar la campaña de búsqueda de marca", impacto: "+800 a +1.100 clicks/mes", calculo: "CPC $ 35 vs $ 80 promedio × $ 50K", prioridad: "alta" }, "performance");
eq("oportunidad", [opo.tipo, opo.confianza.nivel, opo.impacto?.bajo, opo.impacto?.alto, opo.kpi?.id], ["oportunidad", "media", 800, 1100, "clicks"]);
eq("oportunidad evidencia", opo.evidencia[0]?.label, "Cálculo");
eq("hallazgo positivo ⇒ null", fromHallazgo({ titulo: "Reels", evidencia: "", tipo: "positivo", porque: "" }, "redes"), null);
const hal = fromHallazgo({ titulo: "Cayó el engagement rate", evidencia: "ER 2,1% vs 3,4%", tipo: "negativo", porque: "Menos reels" }, "redes");
eq("hallazgo negativo", [hal?.tipo, hal?.confianza.nivel, hal?.kpi?.seguimiento], ["alerta", "baja", "Engagement rate"]);
const diag = recomendacionesDeDiagnostico({ planAccion: [{ accion: "A", prioridad: "alta", porque: "", impactoEsperado: "" }], oportunidades: [{ palanca: "B", impacto: "", calculo: "", prioridad: "baja" }], hallazgos: [{ titulo: "C", evidencia: "", tipo: "negativo", porque: "" }, { titulo: "D", evidencia: "", tipo: "positivo", porque: "" }] }, "web");
eq("diagnóstico → 3 tarjetas", diag.length, 3);
eq("diagnóstico null", recomendacionesDeDiagnostico(null, "web"), []);
eq("diagnóstico viejo sin oportunidades", recomendacionesDeDiagnostico({ planAccion: [] }, "web"), []);

// ── Orden y unión ──
const lista = unirRecomendaciones([r, alerta], [opo, { ...opo, id: "otro" } as Recomendacion, { ...r, id: "dup-id" } as Recomendacion]);
eq("unión sin duplicados (id o título)", lista.map((x) => x.id).sort(), [r.id, opo.id].sort());
ok("ordenada por prioridad", lista.every((x, i) => i === 0 || lista[i - 1].prioridad.score >= x.prioridad.score));
const ord = ordenarRecomendaciones([planSin, r]);
eq("orden: mayor score primero", ord[0].id, r.id);

// ── Medición antes / después ──
eq("mejoró (up)", evaluarResultado(100, 120, "up"), { actual: 120, deltaAbs: 20, deltaPct: 20, veredicto: "mejoro" });
eq("empeoró (up)", evaluarResultado(100, 90, "up")?.veredicto, "empeoro");
eq("mejoró (down)", evaluarResultado(10, 8, "down")?.veredicto, "mejoro");
eq("sin cambio (<2%)", evaluarResultado(100, 101, "up")?.veredicto, "sin_cambio");
eq("baseline 0", evaluarResultado(0, 5, "up"), { actual: 5, deltaAbs: 5, deltaPct: null, veredicto: "mejoro" });
eq("sin baseline", evaluarResultado(null, 5, "up"), null);
eq("fecha chequeo", fechaChequeo("2026-09-01T12:00:00Z", 28), "2026-09-29");
eq("fecha inválida", fechaChequeo("x", 5), "");
eq("último con dato", ultimoConDato([1, 2, null, 4, null, null, null, null, null, null, null, null], 2026), { valor: 4, mes: "2026-04" });
eq("sin dato", ultimoConDato(Array(12).fill(null), 2026), null);
const segBase = { estado: "hecha" as const, kpi: "Clicks", baseline: 1000, baselineMes: "2026-08", direccion: "up" as const, chequeoDesde: "2026-09-20" };
ok("ventana abierta", !!medirSeguimiento(segBase, { valor: 1500, mes: "2026-09" }, "2026-09-10").pendiente?.startsWith("Se mide desde"));
eq("sin mes nuevo", medirSeguimiento(segBase, { valor: 1500, mes: "2026-08" }, "2026-09-25").pendiente, "Esperando un mes cerrado nuevo del KPI.");
eq("resultado", medirSeguimiento(segBase, { valor: 1500, mes: "2026-09" }, "2026-10-02").resultado, { actual: 1500, deltaAbs: 500, deltaPct: 50, veredicto: "mejoro", actualMes: "2026-09" });
ok("sin KPI", !!medirSeguimiento({ ...segBase, kpi: null }, null, "2026-10-02").pendiente);
eq("descartada", medirSeguimiento({ ...segBase, estado: "descartada" }, null, "2026-10-02"), { resultado: null, pendiente: null });
ok("sin baseline", !!medirSeguimiento({ ...segBase, baseline: null }, { valor: 1, mes: "2026-09" }, "2026-10-02").pendiente);

// ── Drean: la señal off-pace del Seguimiento trae el KPI exacto en datos.kpi ──
{
  const off = fromSignal({ key: "overview_kpi_off_pace_Floor Share_Floor Share (exhibición)", dash: "overview", tipo: "alerta", prioridad: "alta",
    titulo: '"Floor Share (exhibición)": 0% de probabilidad de llegar a la meta anual', descripcion: "x", acciones: ["Revisar"], datos: { kpi: "Floor Share (exhibición)" } });
  eq("off-pace: KPI = el de datos.kpi (no 'probabilidad de meta')", off.kpi?.id, "floor_share");
  eq("off-pace: medible en el Seguimiento", off.medicion.kpi, "Floor Share (exhibición)");
  ok("recurso a /guia", !!off.recurso?.href.startsWith("/guia/"));
  ok("sin BIP en el recurso", !/BIP/.test(off.recurso?.titulo ?? ""));
}

console.log(`recomendacion: ${pass} OK, ${fail} fallas`);
if (fail) process.exit(1);
