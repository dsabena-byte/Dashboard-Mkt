// Integridad del CATÁLOGO DE MÉTRICAS único (lib/metricas.ts, portado de BIP sep-2026 y adaptado a
// Drean). Correr: cd apps/web && npx tsx scripts/metricas.test.ts
// · forma del catálogo, `know` existente en KPI_KNOW, sin alias ambiguos;
// · todo KPI del Seguimiento de Drean (lib/objetivos-kpis) y de Mercado existe con su nombre EXACTO,
//   su plan, unidad y dirección;
// · kpiKnowFor sigue resolviendo los alias de siempre y ahora también los nombres del Seguimiento;
// · sin la palabra "BIP" en textos visibles.
import { METRICAS, metricaPorNombre, metricaEnTexto, canonMetrica, getMetrica, aliasesKnow, fichaMetrica, metaSpecDe } from "../src/lib/metricas";
import { KPI_KNOW, kpiKnowFor } from "../src/lib/knowledge";
import { MERCADO_KPIS, MERCADO_PLAN } from "../src/lib/mercado-kpis";

let pass = 0, fail = 0;
function ok(name: string, cond: boolean, extra?: unknown) {
  if (cond) pass++; else { fail++; console.error(`✗ ${name}${extra !== undefined ? `\n   ${JSON.stringify(extra)}` : ""}`); }
}
function eq(name: string, got: unknown, want: unknown) { ok(name, JSON.stringify(got) === JSON.stringify(want), { got, want }); }

// ── 1. Forma del catálogo ──
const ids = METRICAS.map((m) => m.id);
eq("ids únicos", ids.length, new Set(ids).size);
for (const m of METRICAS) {
  ok(`${m.id}: campos`, !!(m.nombre && m.formula && m.fuente && m.descripcion && m.granularidad && m.rol && m.horizonte && m.tipo && m.direccion));
  ok(`${m.id}: id snake_case`, /^[a-z][a-z0-9_]*$/.test(m.id));
  ok(`${m.id}: unidad válida`, ["", "%", "$", "x", "s", "pts", "pp"].includes(m.unidad));
  // Métricas del catálogo sin guía propia en Drean (heredadas del catálogo común: Mercado Libre,
  // Core Web Vitals, MMM…) pueden tener `know` sin entrada en KPI_KNOW; las del Seguimiento NO.
  if (m.know && m.plan) ok(`${m.id}: know existe en KPI_KNOW`, !!KPI_KNOW[m.know], m.know);
  ok(`${m.id}: getMetrica`, getMetrica(m.id) === m);
  ok(`${m.id}: se resuelve por su nombre`, metricaPorNombre(m.nombre) === m, metricaPorNombre(m.nombre)?.id);
  ok(`${m.id}: ficha`, fichaMetrica(m).nombre === m.nombre);
  ok(`${m.id}: sin "BIP" visible`, !/\bBIP\b/.test(`${m.nombre} ${m.formula} ${m.fuente} ${m.descripcion} ${m.medida ?? ""}`));
}
// Guías de KPI de Drean que no son métricas del catálogo (UGC cualitativo; Salud de Marca = puntaje Kantar).
const SIN_METRICA = new Set(["ugc_credibilidad", "ugc_intencion", "ugc_percepcion", "salud_marca"]);
for (const k of Object.keys(KPI_KNOW)) if (!SIN_METRICA.has(k)) ok(`KPI_KNOW ${k} cubierto por el catálogo`, METRICAS.some((m) => m.know === k));

// ── 2. Sin alias ambiguos ──
const dueno = new Map<string, string>();
for (const m of METRICAS) {
  for (const a of [m.nombre, m.etiqueta, m.metaKey, ...m.sinonimos]) {
    if (!a) continue;
    const c = canonMetrica(a);
    const prev = dueno.get(c);
    ok(`alias "${a}" no ambiguo`, !prev || prev === m.id, { alias: a, prev, now: m.id });
    dueno.set(c, m.id);
  }
}

// ── 3. KPIs del Seguimiento de Drean (nombres EXACTOS de lib/objetivos-kpis.ts) ──
const SEGUIMIENTO: { plan: string; kpi: string; unidad: string; direccion: "up" | "down"; tipo: "sum" | "rate" }[] = [
  { plan: "Pauta Mkt", kpi: "Inversión", unidad: "$", direccion: "up", tipo: "sum" },
  { plan: "Pauta Mkt", kpi: "Alcance único", unidad: "", direccion: "up", tipo: "sum" },
  { plan: "Pauta Mkt", kpi: "Frecuencia", unidad: "x", direccion: "up", tipo: "rate" },
  { plan: "Pauta Mkt", kpi: "Impresiones", unidad: "", direccion: "up", tipo: "sum" },
  { plan: "Pauta Mkt", kpi: "VTR (≥50%)", unidad: "%", direccion: "up", tipo: "rate" },
  { plan: "Pauta Mkt", kpi: "Clicks", unidad: "", direccion: "up", tipo: "sum" },
  { plan: "Web / Ecommerce", kpi: "Tráfico web (usuarios)", unidad: "", direccion: "up", tipo: "sum" },
  { plan: "Web / Ecommerce", kpi: "Avg Sesión (segundos)", unidad: "s", direccion: "up", tipo: "rate" },
  { plan: "Web / Ecommerce", kpi: "Tasa de conversión", unidad: "%", direccion: "up", tipo: "rate" },
  { plan: "Instagram", kpi: "Alcance orgánico", unidad: "", direccion: "up", tipo: "sum" },
  { plan: "Instagram", kpi: "Engagement rate", unidad: "%", direccion: "up", tipo: "rate" },
  { plan: "Cuadros Básicos", kpi: "% Cumplimiento CB", unidad: "%", direccion: "up", tipo: "rate" },
  { plan: "Floor Share", kpi: "Floor Share (exhibición)", unidad: "%", direccion: "up", tipo: "rate" },
  ...MERCADO_KPIS.map((s) => ({ plan: MERCADO_PLAN, kpi: s.key, unidad: s.unidad, direccion: s.direccion, tipo: "rate" as const })),
];
for (const s of SEGUIMIENTO) {
  const m = metricaPorNombre(s.kpi);
  ok(`Seguimiento ${s.kpi} existe`, !!m, s.kpi);
  if (!m) continue;
  eq(`Seguimiento ${s.kpi} nombre exacto`, m.nombre, s.kpi);
  eq(`Seguimiento ${s.kpi} plan`, m.plan, s.plan);
  eq(`Seguimiento ${s.kpi} unidad`, m.unidad, s.unidad);
  eq(`Seguimiento ${s.kpi} dirección`, m.direccion, s.direccion);
  eq(`Seguimiento ${s.kpi} tipo`, m.tipo, s.tipo);
}
// Y al revés: toda métrica con plan es un KPI del Seguimiento.
const segNames = new Set(SEGUIMIENTO.map((s) => s.kpi));
for (const m of METRICAS.filter((x) => x.plan)) ok(`${m.id}: plan ⇒ está en el Seguimiento`, segNames.has(m.nombre), m.nombre);
for (const s of MERCADO_KPIS) {
  const d = metaSpecDe(s.key);
  eq(`Mercado ${s.key} unidad/dirección = catálogo`, { unidad: d.unidad === "" && s.unidad === "pts" ? "pts" : d.unidad, direccion: d.direccion }, { unidad: s.unidad, direccion: s.direccion });
}

// ── 4. knowledge: los alias de siempre + los nombres del Seguimiento ──
const ALIASES_V1: Record<string, string[]> = { sos: ["share of search", "sos"], inversion: ["inversion", "gasto"], alcance: ["alcance", "alcance unico", "alcance organico", "reach"], vtr: ["vtr", "vtr >=50%"], clicks: ["clicks", "clics"], engagement: ["engagement rate"], trafico: ["trafico", "trafico web", "usuarios"], frecuencia_sesion: ["duracion media de sesion", "avg session"], conversion: ["tasa de conversion"], floor_share: ["floor share", "floor share lavado"], cb: ["cuadro basico", "% cb", "infaltables"], share_valor: ["value share", "share valor"], indice_precio: ["indice de precio"], salud_marca: ["salud de marca", "puntaje sm"] };
for (const [key, list] of Object.entries(ALIASES_V1)) for (const a of list) eq(`kpiKnowFor("${a}")`, kpiKnowFor(a)?.key ?? null, key);
eq("título VTR", kpiKnowFor("VTR (≥50%)")?.key, "vtr");
eq("Seguimiento: Tráfico web (usuarios)", kpiKnowFor("Tráfico web (usuarios)")?.key, "trafico");
eq("Seguimiento: Avg Sesión (segundos)", kpiKnowFor("Avg Sesión (segundos)")?.key, "frecuencia_sesion");
eq("Seguimiento: % Cumplimiento CB", kpiKnowFor("% Cumplimiento CB")?.key, "cb");
eq("Seguimiento: Floor Share (exhibición)", kpiKnowFor("Floor Share (exhibición)")?.key, "floor_share");
eq("Seguimiento: Índice de posición SEO", kpiKnowFor("Índice de posición SEO")?.key, "indice");
eq("título desconocido", kpiKnowFor("Cualquier cosa"), null);
ok("aliasesKnow no vacío", aliasesKnow().length > 80);

// ── 5. Métrica dentro de un texto libre ──
const txt = (t: string) => metricaEnTexto(t)?.id ?? null;
eq("texto clicks", txt("Clicks adicionales (20% reasignado)"), "clicks");
eq("texto SoS", txt("pp de share of search por cada +10% de inversión"), "sos");
eq("texto impresiones", txt("Impresiones perdidas vs CPM previo"), "impresiones");
eq("texto vistas completas", txt("Vistas completas adicionales al costo mediano"), "vtr_completo");
eq("texto alcance", txt("Alcance mensual perdido vs tendencia"), "alcance_unico");
eq("texto sin métrica", txt("Revisar la estrategia general"), null);
eq("texto 'poder' genérico no matchea", txt("para poder escalar la campaña"), null);

console.log(`metricas: ${pass} OK, ${fail} fallas`);
if (fail) process.exit(1);
