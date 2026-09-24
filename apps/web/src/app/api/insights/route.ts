import { NextResponse } from "next/server";
import { LoadCtx } from "@/lib/signals";
import { loadOverview } from "@/lib/signals/sources";
import type { SeguimientoObjetivos, KpiSegLite } from "@/lib/signals/model";
import { loadDash, buildDataPack, signalsForPrompt } from "@/lib/insights/datapack";
import { getLatestReport, saveReport, listReports, getReport } from "@/lib/insights/store";
import { isDiagDash, EMPTY_INSIGHTS, type Insights, type InsItem, type InsHallazgo, type InsCorr, type InsPlanAccion, type InsOportunidad } from "@/lib/insights/types";

// ============================================================================
// DIAGNÓSTICO IA por tablero (portado de BIP, sep-2026). Correlaciona indicadores con metas,
// objetivos y resultados: inyecta el Seguimiento real vs meta, un PACK DE DATOS del tablero
// (lib/insights/datapack, fuentes precalculadas) y las SEÑALES del motor determinístico
// (lib/signals) como "HALLAZGOS PRE-CALCULADOS". Salida JSON en 6 secciones. Versiones en
// `insights_report` (migración 0106; fail-safe si no corrió). La IA corre SOLO acá (POST),
// nunca en el render de las páginas. Modelo: OPENAI_INSIGHTS_MODEL (default gpt-4o-mini).
// Auth: el middleware exige sesión para /api/* (no está en BYPASS_PATHS).
// ============================================================================
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const runtime = "nodejs";
export const maxDuration = 120;

const MES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

const FOCO: Record<string, { label: string; foco: string }> = {
  overview: { label: "Seguimiento de Objetivos (visión estratégica)", foco: `Es la vista de mando. (1) Correlacioná el cumplimiento de cada OBJETIVO (TOM, SOM, Intención, Poder) con los KPIs que lo explican (usá los pesos): qué KPI tracciona o hunde cada objetivo. (2) Usá "palancas" del pack (puntos de Salud de Marca que libera cada KPI si llega a su meta = brecha × peso en el objetivo × peso estratégico) para ordenar dónde actuar primero. (3) Cruzá planes: conectá la mayor palanca con las señales de su tablero (Pauta, Redes, Web, SEO, Trade, Mercado) para explicar la CAUSA y la acción que la cierra. (4) Detectá metas laxas cuyo recurso podría ir a la mayor palanca. (5) MERCADO: inversión vs share of search (proxy de ESOV), estacionalidad de la demanda, share of engagement vs share of search, share GfK y Kantar. Explicá cada término en simple.` },
  performance: { label: "Pauta Mkt (plan de medios)", foco: `Analizá la EFICIENCIA de la inversión: (1) por medio (Meta, YouTube/Programmatic de DV360, Google Search/Demand Gen, TikTok, Mercado Ads, Geo, offline) y por rol (Awareness · Consideración · Conversión) con CPM, CPC, CTR, frecuencia y CPCV (costo por vista completa = métrica madre del video); (2) por campaña, comparando dentro de su mismo rol; (3) piezas de Meta (incluye UGC): CTR, frecuencia (fatiga), VTR; (4) embudo de video (25/50/75/100%) y dónde se cae; (5) evolución mensual (meses cerrados) del costo y la inversión; (6) REASIGNACIÓN cuantificada; (7) MERCADO: inversión vs share of search (ESOV), meses pico de demanda. Regla de fuentes: medio con API = volumen de la API; OMD solo medios sin API.` },
  redes: { label: "Redes Sociales", foco: `Analizá el orgánico: (1) evolución mensual de alcance, interacciones y ER de Instagram (el OBJETIVO de Redes se mide con IG); (2) últimos 30 días vs los 30 previos por formato; (3) FORMATOS y PILARES: qué rinde vs la mediana propia; (4) SENTIMIENTO de comentarios; (5) COMPETENCIA: ER por seguidor, cadencia y pilares vs las otras marcas; (6) share of engagement vs share of search. OJO: el alcance de Facebook NO es confiable (métrica nueva de Meta; solo posts maduros ≥60 días, sin pagos) — no bases conclusiones fuertes en el reach de FB.` },
  web: { label: "Web / Ecommerce", foco: `Analizá el sitio: (1) tráfico y conversión (eventos clave/sesiones) del último mes cerrado vs el anterior y la serie mensual; (2) CANALES: volumen, share y conversión — cuál trae volumen sin calidad y cuál convierte y está sub-escalado (cruzá con la pauta); (3) categorías del sitio; (4) competencia web (SimilarWeb, estimaciones no comparables 1:1 con GA4). Ubicá el cuello de botella y cuantificá.` },
  "seo-search": { label: "SEO / Search", foco: `Analizá la búsqueda: (1) share of search propio vs el líder y su tendencia por categoría (proxy de intención de compra); (2) KEYWORDS: faltantes de alta demanda, quick wins en posición 4-20 y fuertes a defender; (3) VISIBILIDAD EN IA (LLMs) vs share of search; (4) demanda genérica mensual. Priorizá qué capturar primero.` },
  "cuadros-basicos": { label: "Cuadros Básicos (Trade)", foco: "Analizá el cumplimiento del surtido obligatorio (Cuadro Básico) mes a mes vs la meta; tendencia y brecha. Conectá con Floor Share y el share de mercado (GfK) de la categoría." },
  "floor-share": { label: "Floor Share (Trade)", foco: "Analizá el share de exhibición de Drean por categoría (Lavado/Refrigeración/Cocción) vs su meta, el ranking de marcas en góndola y las cadenas con mucho volumen y share bajo. Cruzá con el share de mercado GfK: ¿la góndola acompaña la venta?" },
  influencia: { label: "Influencia / UGC", foco: "Analizá las piezas UGC pautadas: inversión, CPM, interacción por impresión (guardados, compartidos), VTR y el análisis cualitativo de comentarios (credibilidad, intención de compra, percepción de marca). Compará contra la pauta de marca en Meta. Recomendá qué piezas escalar, rotar o pausar." },
  mercado: { label: "Mercado (GfK)", foco: "Analizá el share de mercado (value y unit) de Drean por categoría y segmento (High/Mid/Low) vs el líder, su tendencia y el precio relativo (valor vs unidades). Cruzá con Salud de Marca, share of search y Floor Share." },
  "salud-marca": { label: "Salud de Marca (Kantar)", foco: "Analizá TOM, SOM, Intención de compra y Poder de Marca de Drean por categoría ola a ola, vs competidores, y el vínculo share de mercado → equity (si el share sube y la mente baja, o al revés). Son los 4 objetivos estratégicos del Mapa." },
  funnel: { label: "Inversión de Marketing (BGT)", foco: "Analizá la ejecución del presupuesto de Marketing vs el BGT vigente por cuatrimestre (desvío, tope 5%) y el ratio Inversión/Facturación (tope 1,3%). Detectá riesgos de sobre/sub-ejecución y si el ritmo llega al cierre." },
  "mkt-canal": { label: "Mkt Canal (retailers)", foco: "Analizá las acciones digitales en retailers: CTR por cliente/acción/plataforma, ROAS donde haya inversión e ingresos, y qué mecánicas replicar." },
  "performance-conversion": { label: "Performance Conversión (ecommerce)", foco: "Analizá la pauta de conversión (inhouse): costo, compras, ingresos, ROAS y CPA por mes y por campaña; reasignación de presupuesto entre campañas." },
};

// Serie real vs meta de un KPI en números legibles (último mes con dato + YTD + tendencia).
function kpiLine(k: KpiSegLite): string {
  const rate = k.tipo === "rate";
  const last = [...k.realM].map((v, i) => ({ v, i })).filter((x) => x.v != null).pop();
  const fmt = (v: number | null | undefined) => (v == null ? "s/d" : Number.isInteger(v) ? v.toLocaleString("es-AR") : v.toFixed(2));
  if (!last) return `- ${k.kpi} (${k.plan}): sin datos cargados este año.`;
  const li = last.i, real = last.v as number, meta = k.metaM[li];
  const brecha = meta ? ((real - meta) / meta) * 100 : null;
  const realsYtd = k.realM.slice(0, li + 1).filter((v): v is number => v != null);
  const metasYtd = k.metaM.slice(0, li + 1).filter((v): v is number => v != null);
  const s = (a: number[]) => a.reduce((x, y) => x + y, 0);
  const ytdReal = rate ? s(realsYtd) / (realsYtd.length || 1) : s(realsYtd);
  const ytdMeta = rate ? s(metasYtd) / (metasYtd.length || 1) : s(metasYtd);
  const ytdBrecha = ytdMeta ? ((ytdReal - ytdMeta) / ytdMeta) * 100 : null;
  const trend = k.realM.map((v, i) => ({ v, i })).filter((x) => x.v != null).slice(-3).map((x) => `${MES[x.i]} ${fmt(x.v)}`).join(" → ");
  const u = k.unit ? ` ${k.unit}` : "";
  return `- ${k.kpi} (${k.plan}, ${k.direccion === "down" ? "menor es mejor" : "mayor es mejor"}): ${MES[li]} real ${fmt(real)}${u} vs meta ${fmt(meta)}${u}${brecha != null ? ` (${brecha >= 0 ? "+" : ""}${brecha.toFixed(0)}% vs meta)` : ""}. YTD real ${fmt(ytdReal)} vs meta ${fmt(ytdMeta)}${ytdBrecha != null ? ` (${ytdBrecha >= 0 ? "+" : ""}${ytdBrecha.toFixed(0)}%)` : ""}. Tendencia: ${trend}.`;
}

function seguimientoCtx(seg: SeguimientoObjetivos, year: number): string {
  const objs = seg.objetivos.map((o) => {
    const ap = o.aportes.map((a) => `${a.kpi} (peso ${a.peso}%, cumpl ${a.cumpl == null ? "s/d" : Math.round(a.cumpl) + "%"})`).join("; ");
    return `- Objetivo "${o.nombre}" (peso estratégico ${Math.round(o.pesoEstrategico)}%): cumplimiento mes ${o.cumplMes == null ? "s/d" : Math.round(o.cumplMes) + "%"}, YTD ${o.cumplYtd == null ? "s/d" : Math.round(o.cumplYtd) + "%"}, cobertura ${Math.round(o.cobertura)}%. KPIs que lo explican: ${ap || "—"}.`;
  }).join("\n");
  const sm = seg.saludMarca;
  return `\n\n=== SEGUIMIENTO DE OBJETIVOS (año ${year}, mes de referencia ${seg.refMes}) — datos reales, NO inventes ===
SALUD DE MARCA (cumplimiento ponderado global): mes ${sm.cumplMes == null ? "s/d" : Math.round(sm.cumplMes) + "%"}, YTD ${sm.cumplYtd == null ? "s/d" : Math.round(sm.cumplYtd) + "%"}.
OBJETIVOS ESTRATÉGICOS y los KPIs que los explican (con su peso):
${objs}
KPIs — real vs meta (último mes con dato + acumulado YTD + tendencia):
${seg.kpis.map(kpiLine).join("\n")}
=== FIN SEGUIMIENTO ===`;
}

// GET: última versión guardada (sin re-generar) · ?list=1 historial · ?version=<id> una versión.
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const dash = sp.get("dash") ?? "";
  if (!isDiagDash(dash)) return NextResponse.json({ error: "tablero desconocido" }, { status: 400 });
  if (sp.get("list") === "1") return NextResponse.json({ versiones: await listReports(dash) });
  const v = sp.get("version");
  const rep = v ? await getReport(dash, Number(v)) : await getLatestReport(dash);
  if (!rep?.insights) return NextResponse.json({ saved: false });
  return NextResponse.json({ saved: true, dash, id: rep.id, createdAt: rep.createdAt, model: rep.model, insights: rep.insights });
}

export async function POST(req: Request) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return NextResponse.json({ error: "OPENAI_API_KEY no configurada" }, { status: 500 });
  const dash = String(((await req.json().catch(() => ({}))) as { dash?: string }).dash ?? "");
  if (!isDiagDash(dash)) return NextResponse.json({ error: "tablero desconocido" }, { status: 400 });
  const f = FOCO[dash]!;
  const model = process.env.OPENAI_INSIGHTS_MODEL || "gpt-4o-mini";
  const year = new Date().getFullYear();
  const ctx = new LoadCtx();

  // Contexto ADN: Seguimiento real vs meta (best-effort).
  const seg = await loadOverview(ctx).catch(() => null);
  const segCtx = seg ? seguimientoCtx(seg, year) : "";
  // Pack del tablero + señales (hallazgos pre-calculados).
  const loaded = await loadDash(ctx, dash, seg).catch(() => ({ seg }));
  const { pack, signals } = await buildDataPack(ctx, dash, loaded).catch(() => ({ pack: "", signals: [] }));
  const packCtx = pack ? `\n\n=== DATOS DEL TABLERO "${f.label}" (JSON, datos reales — fuente principal del análisis) ===\n${pack}\n=== FIN DATOS DEL TABLERO ===` : "";
  const sigCtx = signals.length ? `\n\n=== HALLAZGOS PRE-CALCULADOS (motor de reglas determinístico sobre los mismos datos; ordenados por prioridad e impacto) ===\n${signalsForPrompt(signals, 12)}\nInstrucción: son el punto de partida, no el análisis. Validalos contra los datos, explicá su CAUSA cruzando indicadores, descartá los que no sean relevantes y sumá lo que las reglas no ven.\n=== FIN HALLAZGOS ===` : "";
  if (!pack && !signals.length && !segCtx) return NextResponse.json({ error: "No hay datos suficientes en este tablero para un diagnóstico." }, { status: 422 });

  // Diagnóstico anterior (continuidad).
  let prevCtx = "";
  const prev = await getLatestReport(dash).catch(() => null);
  if (prev?.insights) {
    const acc = (prev.insights.planAccion ?? []).map((a) => `• ${a.accion}`).join("\n");
    prevCtx = `\n\n=== DIAGNÓSTICO ANTERIOR (${new Date(prev.createdAt).toLocaleDateString("es-AR")}) — línea de base ===\nDiagnóstico previo: ${String(prev.insights.diagnostico ?? "").slice(0, 800)}\nPlan de acción recomendado:\n${acc.slice(0, 1200)}\nInstrucción: indicá qué mejoró y qué empeoró desde entonces y si las acciones parecen haberse aplicado (según los datos). No repitas literal lo que no funcionó.\n=== FIN DIAGNÓSTICO ANTERIOR ===`;
  }

  const hoy = new Date().toLocaleDateString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" });
  const system = `Sos el consultor senior de marketing e inteligencia de negocio de Drean (electrodomésticos, Argentina). Hoy es ${hoy}.
Filosofía: el marketing es una estrategia medible — cada KPI existe para mover un objetivo (TOM, SOM, Intención de compra, Poder de Marca), cada objetivo para generar un resultado en el mercado. Tu trabajo NO es describir el tablero: es construir un DIAGNÓSTICO consistente, trazable y un plan de acción ejecutable.
LA CADENA: estrategia → objetivos (con pesos) → KPIs (con pesos) → metas → plan de acción. Mostrá la trazabilidad: por qué esta acción, sobre este KPI, mueve este objetivo.

Analizás "${f.label}". ${f.foco}
Tu fuente principal es el PACK DE DATOS y los HALLAZGOS PRE-CALCULADOS del mensaje. Si falta una parte, decilo (no la inventes).

MÉTODO (de lo general a lo particular): 1) EVOLUCIÓN en el tiempo con valores y variación %; 2) CUMPLIMIENTO DE METAS (mes y YTD, brecha %); 3) CORRELACIONES multi-causales entre KPIs y con los objetivos; 4) DETALLE (medio/campaña/pieza/formato/canal/keyword/categoría/cadena según el tablero); 5) OPORTUNIDADES cuantificadas; 6) SÍNTESIS.
REGLAS: cada afirmación lleva su número (valor, variación %, brecha vs meta, share); analizá lo que funcionó y lo que no con causas; registro profesional, sobrio, en español rioplatense; plan de acción = instrucciones concretas con impacto esperado; cada oportunidad con el cálculo explícito usando solo números del pack (explicitá supuestos). Si hay bloque MERCADO o hallazgos de cruce, al menos una oportunidad debe cruzar lo propio con el mercado.

Respondé EXCLUSIVAMENTE con un objeto JSON válido:
{
 "diagnostico": "3-4 frases: síntesis multi-causal con los números clave y el veredicto",
 "evolucion": [{"titulo":"KPI y su tendencia","evidencia":"serie con valores y variación %","lectura":"qué indica"}],
 "metas": [{"titulo":"KPI vs su meta","evidencia":"real vs meta (mes y YTD) + brecha %","lectura":"cumple / no cumple y por qué"}],
 "correlaciones": [{"indicadores":"KPI A ↔ KPI/Objetivo B","hallazgo":"relación causal con números"}],
 "hallazgos": [{"titulo":"qué funcionó o qué no","evidencia":"su métrica","tipo":"positivo|negativo","porque":"la causa"}],
 "planAccion": [{"accion":"instrucción específica","prioridad":"alta|media|baja","porque":"el dato que la justifica","impactoEsperado":"qué KPI/objetivo mueve y cuánto"}],
 "oportunidades": [{"palanca":"optimización concreta","impacto":"resultado cuantificado","calculo":"la cuenta con los números del pack y el supuesto","prioridad":"alta|media|baja"}]
}
Hasta 5 ítems en evolucion, hallazgos, planAccion y oportunidades; hasta 4 en metas y correlaciones. Si una sección no aplica, devolvé su array vacío.`;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model, temperature: 0.25, response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: `Analizá "${f.label}" y devolvé el diagnóstico en JSON.${segCtx}${packCtx}${sigCtx}${prevCtx}` },
        ],
      }),
      cache: "no-store",
    });
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[]; error?: { message?: string } };
    const content = json?.choices?.[0]?.message?.content;
    if (!res.ok || !content) return NextResponse.json({ error: json?.error?.message || "sin respuesta de IA" }, { status: 502 });
    const insights = parseInsights(content);
    const saved = await saveReport(dash, insights, { model, signalsCount: signals.length });
    return NextResponse.json({
      dash, insights, model,
      id: saved?.id ?? null, createdAt: saved?.createdAt ?? new Date().toISOString(),
      ...(saved ? {} : { warning: "No se guardó la versión (¿migración 0106_insights_report sin correr?)." }),
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

function parseInsights(raw: string): Insights {
  try {
    const s = raw.replace(/```json|```/g, "").trim();
    const j = JSON.parse(s.slice(s.indexOf("{"), s.lastIndexOf("}") + 1)) as Record<string, unknown>;
    const str = (x: unknown) => (x == null ? "" : String(x));
    const arr = (x: unknown): Record<string, unknown>[] => (Array.isArray(x) ? (x.filter((v) => v && typeof v === "object") as Record<string, unknown>[]) : []);
    const pri = (p: unknown): "alta" | "media" | "baja" => (p === "alta" || p === "baja" ? p : "media");
    const items = (x: unknown, n = 4): InsItem[] => arr(x).slice(0, n).map((v) => ({ titulo: str(v.titulo), evidencia: str(v.evidencia), ...(v.lectura ? { lectura: str(v.lectura) } : {}) })).filter((i) => i.titulo || i.evidencia);
    const corr: InsCorr[] = arr(j.correlaciones).slice(0, 4).map((v) => ({ indicadores: str(v.indicadores), hallazgo: str(v.hallazgo) })).filter((c) => c.hallazgo);
    const hall: InsHallazgo[] = arr(j.hallazgos).slice(0, 6).map((v) => ({ titulo: str(v.titulo), evidencia: str(v.evidencia), tipo: v.tipo === "negativo" ? "negativo" as const : "positivo" as const, porque: str(v.porque) })).filter((h) => h.titulo || h.evidencia);
    const plan: InsPlanAccion[] = arr(j.planAccion).slice(0, 5).map((v) => ({ accion: str(v.accion), prioridad: pri(v.prioridad), porque: str(v.porque), impactoEsperado: str(v.impactoEsperado) })).filter((p) => p.accion);
    const opor: InsOportunidad[] = arr(j.oportunidades).slice(0, 5).map((v) => ({ palanca: str(v.palanca), impacto: str(v.impacto), calculo: str(v.calculo), prioridad: pri(v.prioridad) })).filter((o) => o.palanca);
    return { diagnostico: str(j.diagnostico), evolucion: items(j.evolucion, 5), metas: items(j.metas), correlaciones: corr, hallazgos: hall, planAccion: plan, oportunidades: opor };
  } catch { return { ...EMPTY_INSIGHTS }; }
}
