// ============================================================================
// TARJETA DE RECOMENDACIÓN ÚNICA — "Qué hacer ahora" (portado de BIP, sep-2026; Drean).
// Client-safe y PURO (sin server-only, sin fetch): el mismo tipo lo producen las señales
// determinísticas (lib/signals, salida genérica `Signal`) y el Diagnóstico IA (plan de acción,
// oportunidades, hallazgos a corregir) vía los adaptadores de abajo, y lo dibuja
// components/recomendacion/recomendacion-card.tsx.
//
//   prioridad = impacto (1-5) × confianza (alta 1 · media 0,7 · baja 0,4) ÷ esfuerzo (1-3)
//
// Drean: sin persistencia del "La voy a hacer" (no hay tabla de seguimiento de recomendaciones);
// las funciones puras de medición antes/después quedan acá (testeadas) para cuando se sume.
// Test: cd apps/web && npx tsx scripts/recomendacion.test.ts
// ============================================================================
import type { Signal } from "@/lib/signals/types";
import { KPI_KNOW, DASH_KNOW } from "@/lib/knowledge";
import { MODULO_TITULO } from "@/lib/guia/titulos";
import { getMetrica, metricaEnTexto, metricaPorNombre, type Metrica, type MetricaDireccion } from "@/lib/metricas";

export type NivelConfianza = "alta" | "media" | "baja";
export type NivelPrioridad = "critica" | "alta" | "media" | "baja";
export type NivelEsfuerzo = 1 | 2 | 3;
export type OrigenRec = "senal" | "ia_plan" | "ia_oportunidad" | "ia_hallazgo";

export interface ImpactoRec {
  /** Rango estimado (valores absolutos del beneficio). null = no cuantificado. */
  bajo: number | null;
  alto: number | null;
  unidad: string;
  /** Qué se estima (ej. "Clicks adicionales"). */
  metrica: string;
  /** Texto original (IA) o resumen legible. */
  texto: string;
  supuesto?: string;
}

export interface Recomendacion {
  id: string;
  origen: OrigenRec;
  dash: string;
  tipo: "alerta" | "oportunidad" | "mejora";
  titulo: string;
  /** Qué hacer, paso a paso (puede venir vacío: el título ya es la acción). */
  pasos: string[];
  /** Por qué: la evidencia con números. */
  porque: string;
  evidencia: { label: string; valor: string }[];
  impacto: ImpactoRec | null;
  /** 1-5: tamaño relativo del impacto (entra en la prioridad). */
  impactoNivel: number;
  confianza: { nivel: NivelConfianza; motivo: string };
  esfuerzo: { nivel: NivelEsfuerzo; label: string; quien: string };
  prioridad: { score: number; nivel: NivelPrioridad };
  recurso: { titulo: string; href: string } | null;
  /** KPI que mueve. `seguimiento` = nombre del KPI en el Seguimiento (medible automáticamente). */
  kpi: { id: string | null; nombre: string; seguimiento: string | null } | null;
  medicion: { kpi: string | null; unidad: string; direccion: MetricaDireccion; ventanaDias: number; criterio: string };
  cruce?: boolean;
}

// ── Prioridad ────────────────────────────────────────────────────────────────
export const CONFIANZA_PESO: Record<NivelConfianza, number> = { alta: 1, media: 0.7, baja: 0.4 };
export const ESFUERZO_LABEL: Record<NivelEsfuerzo, string> = { 1: "Bajo (horas)", 2: "Medio (días)", 3: "Alto (semanas)" };
const r2 = (v: number) => Math.round(v * 100) / 100;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function nivelPrioridad(score: number): NivelPrioridad {
  return score >= 3 ? "critica" : score >= 1.8 ? "alta" : score >= 0.9 ? "media" : "baja";
}
/** prioridad = impacto × confianza ÷ esfuerzo. */
export function calcPrioridad(impactoNivel: number, confianza: NivelConfianza, esfuerzo: NivelEsfuerzo): { score: number; nivel: NivelPrioridad } {
  const score = r2((clamp(impactoNivel, 1, 5) * CONFIANZA_PESO[confianza]) / esfuerzo);
  return { score, nivel: nivelPrioridad(score) };
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const canon = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9%]+/g, " ").trim();
/** Hash corto y estable (djb2) para ids de recomendación. */
export function hashRec(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

/** Clave de señal → id seguro (sin tildes/espacios/símbolos) + hash para que siga siendo único. */
export function slugKey(key: string): string {
  const base = key.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9_]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 80);
  return `${base || "k"}-${hashRec(key)}`;
}

const QUIEN: Record<string, string> = {
  performance: "Medios / agencia (OMD)", redes: "Contenido / community", web: "Web / ecommerce",
  "seo-search": "Contenido / SEO", overview: "Marketing", "cuadros-basicos": "Trade marketing", "floor-share": "Trade marketing",
  funnel: "Marketing / finanzas", mercado: "Marketing / comercial", "salud-marca": "Marketing", influencia: "Contenido / influencia",
  "mkt-canal": "Trade marketing", "performance-conversion": "Ecommerce",
};
const RE_ESF_BAJO = /\b(pausa|pausar|apaga|apagar|reasign\w*|mover? (el |la |parte del? )?(presupuesto|inversion)|subir (el |la )?(presupuesto|inversion|puja)|bajar|tope de frecuencia|puja|oferta|title|meta ?description|robots|rotar|reescrib\w*|escalar)\b/;
const RE_ESF_ALTO = /\b(redisen\w*|desarroll\w*|migrar|nuevo sitio|contratar|estudio|investigacion de mercado|integrar|implementar|produc\w*|crear (una )?landing|nueva landing|plataforma)\b/;
/** Esfuerzo heurístico por el texto de la acción (1 bajo · 2 medio · 3 alto). */
export function estimarEsfuerzo(texto: string, dash: string): Recomendacion["esfuerzo"] {
  const t = canon(texto);
  const nivel: NivelEsfuerzo = RE_ESF_ALTO.test(t) ? 3 : RE_ESF_BAJO.test(t) ? 1 : 2;
  return { nivel, label: ESFUERZO_LABEL[nivel], quien: QUIEN[dash] ?? "Marketing" };
}

/** Días hasta chequear el resultado (el KPI se lee por mes cerrado, así que nunca menos de ~2 semanas). */
export const VENTANA_DIAS: Record<string, number> = { performance: 21, redes: 28, web: 28, "seo-search": 42, overview: 30, "cuadros-basicos": 28, "floor-share": 28, "performance-conversion": 21 };
export const ventanaPara = (dash: string) => VENTANA_DIAS[dash] ?? 30;

// Ajuste por tablero: la misma palabra es otra métrica según dónde aparece.
function ajustarPorDash(m: Metrica | undefined, dash: string): Metrica | undefined {
  if (!m) return m;
  if (dash === "seo-search" && m.id === "clicks") return getMetrica("clicks_organicos");
  if (dash === "redes" && m.id === "alcance_unico") return getMetrica("alcance_organico");
  if (dash === "performance" && m.id === "alcance_organico") return getMetrica("alcance_unico");
  return m;
}
/** Métrica que mueve una recomendación a partir de sus textos (el primero que matchee gana). */
export function metricaDeTextos(textos: (string | null | undefined)[], dash: string): Metrica | undefined {
  for (const t of textos) {
    const m = ajustarPorDash(metricaEnTexto(t), dash);
    if (m) return m;
  }
  return undefined;
}

export function recursoPara(m: Metrica | undefined, dash: string): Recomendacion["recurso"] {
  const mod = (m?.know && KPI_KNOW[m.know]?.palancas?.find((p) => p.modulo)?.modulo) || DASH_KNOW[dash]?.modulos?.[0];
  if (!mod) return null;
  return { titulo: MODULO_TITULO[mod] ?? "Proceso Estratégico", href: `/guia/${mod}` };
}

function kpiYMedicion(m: Metrica | undefined, dash: string): Pick<Recomendacion, "kpi" | "medicion"> {
  const ventanaDias = ventanaPara(dash);
  if (!m) {
    return { kpi: null, medicion: { kpi: null, unidad: "", direccion: "up", ventanaDias, criterio: "Sin KPI con serie automática: revisá el tablero al cumplirse la ventana." } };
  }
  const seguimiento = m.plan ? m.nombre : null; // Drean: nombre exacto del KPI en el Seguimiento
  const dir = m.direccion === "down" ? "(menor es mejor)" : "(mayor es mejor)";
  return {
    kpi: { id: m.id, nombre: m.nombre, seguimiento },
    medicion: {
      kpi: seguimiento, unidad: m.unidad, direccion: m.direccion, ventanaDias,
      criterio: seguimiento
        ? `${m.nombre} ${dir}: último mes cerrado vs el baseline tomado al marcarla.`
        : `${m.nombre} ${dir}: no tiene serie mensual en el Seguimiento; comparalo en el tablero.`,
    },
  };
}

function armar(base: Omit<Recomendacion, "prioridad" | "recurso" | "kpi" | "medicion" | "esfuerzo"> & { metrica?: Metrica; textoAccion: string }): Recomendacion {
  const { metrica, textoAccion, ...rest } = base;
  const esfuerzo = estimarEsfuerzo(textoAccion, rest.dash);
  return {
    ...rest,
    esfuerzo,
    prioridad: calcPrioridad(rest.impactoNivel, rest.confianza.nivel, esfuerzo.nivel),
    recurso: recursoPara(metrica, rest.dash),
    ...kpiYMedicion(metrica, rest.dash),
  };
}

const fmtNum = (v: number) => {
  const a = Math.abs(v);
  const s = a >= 1e6 ? `${(v / 1e6).toLocaleString("es-AR", { maximumFractionDigits: 1 })}M` : a >= 1e4 ? `${(v / 1e3).toLocaleString("es-AR", { maximumFractionDigits: 1 })}K` : v.toLocaleString("es-AR", { maximumFractionDigits: a < 10 ? 1 : 0 });
  return s;
};
/** "+1,2K a +2,4K clicks" · "$ 50K a $ 100K" · texto si no está cuantificado. */
export function fmtImpacto(i: ImpactoRec | null): string {
  if (!i) return "";
  if (i.bajo == null && i.alto == null) return i.texto;
  const f = (v: number) => (i.unidad === "$" ? `$ ${fmtNum(v)}` : i.unidad === "%" || i.unidad === "pp" || i.unidad === "pts" ? `${fmtNum(v)} ${i.unidad}` : fmtNum(v));
  const suf = i.unidad && !["$", "%", "pp", "pts"].includes(i.unidad) ? ` ${i.unidad}` : "";
  const lo = i.bajo ?? i.alto!, hi = i.alto ?? i.bajo!;
  return lo === hi ? `+${f(hi)}${suf}` : `+${f(lo)} a +${f(hi)}${suf}`;
}

// ── Adaptador: SEÑALES (lib/signals, salida genérica) ────────────────────────
const TIPO_SENAL: Record<Signal["tipo"], Recomendacion["tipo"]> = { alerta: "alerta", oportunidad: "oportunidad", info: "mejora" };
const IMP_BASE: Record<"alta" | "media" | "baja", number> = { alta: 4, media: 3, baja: 2 };

export function fromSignal(s: Signal): Recomendacion {
  // Drean: si la señal trae el KPI exacto (datos.kpi, ej. off-pace del Seguimiento), manda ese.
  const kpiDato = typeof s.datos?.kpi === "string" ? metricaPorNombre(s.datos.kpi as string) : undefined;
  const metrica = kpiDato ?? metricaDeTextos([s.impacto?.metrica, s.titulo], s.dash);
  const v = s.impacto ? Math.abs(s.impacto.valor) : null;
  const impacto: ImpactoRec | null = s.impacto && v != null && Number.isFinite(v)
    ? { bajo: r2(v * 0.5), alto: r2(v), unidad: s.impacto.unidad, metrica: s.impacto.metrica, texto: `${s.impacto.metrica}: ${v.toLocaleString("es-AR", { maximumFractionDigits: 1 })} ${s.impacto.unidad}`, supuesto: "Rango entre la mitad y el total del potencial que calcula la regla (en la práctica se captura parcialmente)." }
    : null;
  const confianza: Recomendacion["confianza"] = s.cruce
    ? { nivel: "baja", motivo: "Cruza fuentes distintas (propias × mercado): es una asociación, no una causa." }
    : s.tipo === "alerta"
      ? { nivel: "alta", motivo: "Dato observado en tus fuentes, comparado contra tu propia historia." }
      : impacto
        ? { nivel: "media", motivo: "Regla sobre tus datos; el impacto es una estimación con supuestos (mediana/promedio propio)." }
        : { nivel: "media", motivo: "Regla determinística sobre tus datos, sin impacto cuantificado." };
  const impactoNivel = clamp(IMP_BASE[s.prioridad] + (impacto ? 1 : 0) - (s.tipo === "info" ? 1 : 0), 1, 5);
  return armar({
    id: `senal:${s.dash}:${slugKey(s.key)}`,
    origen: "senal",
    dash: s.dash,
    tipo: TIPO_SENAL[s.tipo],
    titulo: s.titulo,
    pasos: s.acciones.slice(0, 5),
    porque: s.descripcion,
    evidencia: impacto ? [{ label: s.impacto!.metrica, valor: `${v!.toLocaleString("es-AR", { maximumFractionDigits: 1 })} ${s.impacto!.unidad}` }] : [],
    impacto,
    impactoNivel,
    confianza,
    cruce: s.cruce || undefined,
    metrica,
    textoAccion: `${s.titulo} ${s.acciones.join(" ")}`,
  });
}

/** Solo las señales accionables (con al menos una acción) se vuelven tarjeta. */
export function recomendacionesDeSenales(signals: Signal[]): Recomendacion[] {
  return signals.filter((s) => s.acciones.length > 0).map(fromSignal);
}

// ── Adaptador: DIAGNÓSTICO IA (/api/insights) ────────────────────────────────
export interface PlanAccionIA { accion: string; prioridad: "alta" | "media" | "baja"; porque: string; impactoEsperado: string }
export interface OportunidadIA { palanca: string; impacto: string; calculo: string; prioridad: "alta" | "media" | "baja" }
export interface HallazgoIA { titulo: string; evidencia: string; tipo: "positivo" | "negativo"; porque: string }
export interface DiagnosticoIA { planAccion?: PlanAccionIA[]; oportunidades?: OportunidadIA[]; hallazgos?: HallazgoIA[] }

/** Número en formato argentino ("3.400", "1,2", "1.234,5") con sufijo mil/K/M. */
export function parseNumeroAR(raw: string): number | null {
  let s = raw.trim().replace(/[−–]/g, "-").replace(/^\+/, "").replace(/[.,]+$/, "");
  let mult = 1;
  const suf = /\s?(millones|mill|mil|k|m)$/i.exec(s);
  if (suf) { const w = (suf[1] ?? "").toLowerCase(); mult = w === "mil" || w === "k" ? 1e3 : 1e6; s = s.slice(0, suf.index); }
  s = s.replace(/\s/g, "");
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  else if (/,/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^-?\d+\.\d{3}$/.test(s)) s = s.replace(".", "");
  const n = Number(s);
  return Number.isFinite(n) ? n * mult : null;
}

const RE_NUM = /(\$\s?)?[-+−]?\d[\d.,]*(?:\s?(?:millones|mil|[kKM])\b)?(\s?%)?/g;
/** Extrae un rango (o un valor) cuantificado de un texto libre de la IA. */
export function parseImpacto(texto: string | null | undefined): { bajo: number; alto: number; unidad: string } | null {
  if (!texto) return null;
  // Se ignoran números pegados a letras ("top-3", "Q4", "H1"): no son el impacto.
  const ms = [...texto.matchAll(RE_NUM)].filter((m) => /\d/.test(m[0]) && !/[a-záéíóúñ]/i.test(texto[m.index! - 1] ?? ""));
  if (!ms.length) return null;
  const num = (m: RegExpMatchArray) => parseNumeroAR(m[0].replace(/\$|%/g, ""));
  const a = ms[0]!;
  const va = num(a);
  if (va == null) return null;
  let vb: number | null = null;
  let last = a;
  const m1 = ms[1];
  if (m1) {
    const between = texto.slice(a.index! + a[0].length, m1.index!);
    const pegado = between === "" && /^[-−]/.test(m1[0]); // "10-20%"
    if (pegado || /^\s*(a|al|y|hasta|–|—|-)\s*$/i.test(between)) { vb = num(m1); if (vb != null) vb = Math.abs(vb); last = m1; }
  }
  const tieneMoneda = !!(a[1] || last[1]);
  const pct = !!(a[2] || last[2]);
  let unidad = tieneMoneda ? "$" : pct ? "%" : "";
  if (!unidad) {
    const after = texto.slice(last.index! + last[0].length).trim();
    const w = /^(pp|pts|[a-záéíóúñ/]+)/i.exec(after)?.[1] ?? "";
    unidad = w && !/^(de|del|en|por|que|con|y|a)$/i.test(w) ? w.toLowerCase() : "";
  }
  const lo = Math.abs(vb == null ? va : Math.min(va, vb));
  const hi = Math.abs(vb == null ? va : Math.max(va, vb));
  return { bajo: Math.min(lo, hi), alto: Math.max(lo, hi), unidad };
}

function impactoIA(texto: string, metrica: string): ImpactoRec | null {
  if (!texto?.trim()) return null;
  const p = parseImpacto(texto);
  return p
    ? { bajo: p.bajo, alto: p.alto, unidad: p.unidad, metrica, texto, supuesto: "Estimación de la IA sobre tus datos (ver el cálculo)." }
    : { bajo: null, alto: null, unidad: "", metrica, texto };
}

export function fromPlanAccion(p: PlanAccionIA, dash: string): Recomendacion {
  const impacto = impactoIA(p.impactoEsperado, "Impacto esperado");
  const cuant = impacto?.bajo != null;
  return armar({
    id: `ia:${dash}:${hashRec(canon(p.accion))}`,
    origen: "ia_plan",
    dash,
    tipo: "mejora",
    titulo: p.accion,
    pasos: [],
    porque: p.porque,
    evidencia: [],
    impacto,
    impactoNivel: clamp((IMP_BASE[p.prioridad] ?? 3) + (cuant ? 1 : 0), 1, 5),
    confianza: cuant
      ? { nivel: "media", motivo: "Propuesta de la IA con impacto cuantificado sobre tus datos; validala antes de ejecutar." }
      : { nivel: "baja", motivo: "Propuesta de la IA sin impacto cuantificado." },
    metrica: metricaDeTextos([p.impactoEsperado, p.accion, p.porque], dash),
    textoAccion: p.accion,
  });
}

export function fromOportunidad(o: OportunidadIA, dash: string): Recomendacion {
  const impacto = impactoIA(o.impacto, "Impacto estimado");
  const cuant = impacto?.bajo != null;
  return armar({
    id: `ia:${dash}:${hashRec(canon(o.palanca))}`,
    origen: "ia_oportunidad",
    dash,
    tipo: "oportunidad",
    titulo: o.palanca,
    pasos: [],
    porque: o.calculo || o.impacto,
    evidencia: o.calculo ? [{ label: "Cálculo", valor: o.calculo }] : [],
    impacto,
    impactoNivel: clamp((IMP_BASE[o.prioridad] ?? 3) + (cuant ? 1 : 0), 1, 5),
    confianza: o.calculo && cuant
      ? { nivel: "media", motivo: "Estimación de la IA con el cálculo explícito sobre tus datos." }
      : { nivel: "baja", motivo: "Estimación de la IA sin cálculo verificable." },
    metrica: metricaDeTextos([o.impacto, o.palanca, o.calculo], dash),
    textoAccion: o.palanca,
  });
}

/** Solo los hallazgos NEGATIVOS son accionables ("a corregir"); los positivos quedan en el análisis. */
export function fromHallazgo(h: HallazgoIA, dash: string): Recomendacion | null {
  if (h.tipo !== "negativo") return null;
  return armar({
    id: `ia:${dash}:${hashRec(canon(h.titulo))}`,
    origen: "ia_hallazgo",
    dash,
    tipo: "alerta",
    titulo: `Corregir: ${h.titulo}`,
    pasos: [],
    porque: [h.evidencia, h.porque ? `Causa probable: ${h.porque}` : ""].filter(Boolean).join(" "),
    evidencia: [],
    impacto: null,
    impactoNivel: 2,
    confianza: { nivel: "baja", motivo: "Hallazgo de la IA (lectura de la evolución); la causa es una hipótesis." },
    metrica: metricaDeTextos([h.titulo, h.evidencia], dash),
    textoAccion: `${h.titulo} ${h.porque}`,
  });
}

export function recomendacionesDeDiagnostico(d: DiagnosticoIA | null | undefined, dash: string): Recomendacion[] {
  if (!d) return [];
  return [
    ...(d.planAccion ?? []).filter((p) => p?.accion).map((p) => fromPlanAccion(p, dash)),
    ...(d.oportunidades ?? []).filter((o) => o?.palanca).map((o) => fromOportunidad(o, dash)),
    ...(d.hallazgos ?? []).map((h) => (h?.titulo ? fromHallazgo(h, dash) : null)).filter((x): x is Recomendacion => !!x),
  ];
}

// ── Orden y deduplicación ────────────────────────────────────────────────────
const CONF_ORD: Record<NivelConfianza, number> = { alta: 0, media: 1, baja: 2 };
/** Mayor prioridad primero; empate → más confianza → menos esfuerzo → título. */
export function ordenarRecomendaciones(list: Recomendacion[]): Recomendacion[] {
  return [...list].sort((a, b) =>
    b.prioridad.score - a.prioridad.score
    || CONF_ORD[a.confianza.nivel] - CONF_ORD[b.confianza.nivel]
    || a.esfuerzo.nivel - b.esfuerzo.nivel
    || a.titulo.localeCompare(b.titulo));
}
/** Une listas sin repetir (mismo id o mismo título normalizado); gana la primera aparición. */
export function unirRecomendaciones(...listas: Recomendacion[][]): Recomendacion[] {
  const ids = new Set<string>(), tit = new Set<string>();
  const out: Recomendacion[] = [];
  for (const r of listas.flat()) {
    const t = canon(r.titulo.replace(/^corregir:\s*/i, ""));
    if (ids.has(r.id) || tit.has(t)) continue;
    ids.add(r.id); tit.add(t); out.push(r);
  }
  return ordenarRecomendaciones(out);
}

// ── Medición antes / después ─────────────────────────────────────────────────
export type EstadoSeguimiento = "planificada" | "hecha" | "descartada";
export type Veredicto = "mejoro" | "empeoro" | "sin_cambio";

export interface ResultadoMedicion {
  actual: number;
  actualMes: string;
  deltaAbs: number;
  deltaPct: number | null;
  veredicto: Veredicto;
}
export interface SeguimientoRec {
  recId: string;
  dash: string;
  estado: EstadoSeguimiento;
  kpi: string | null;
  unidad: string;
  direccion: MetricaDireccion;
  baseline: number | null;
  baselineMes: string | null;
  ventanaDias: number;
  creadaAt: string;
  hechaAt: string | null;
  /** Fecha (YYYY-MM-DD) desde la que se puede chequear el resultado. */
  chequeoDesde: string;
  resultado: ResultadoMedicion | null;
  /** Por qué todavía no hay resultado (ventana abierta, sin mes nuevo, sin KPI…). */
  pendiente: string | null;
}

/** Fecha desde la que se chequea: inicio (hecha o, si no, creada) + ventana. */
export function fechaChequeo(inicioISO: string, ventanaDias: number): string {
  const d = new Date(inicioISO);
  if (!Number.isFinite(d.getTime())) return "";
  d.setUTCDate(d.getUTCDate() + Math.max(0, Math.round(ventanaDias)));
  return d.toISOString().slice(0, 10);
}

/** Compara el valor actual contra el baseline según la dirección del KPI (tolerancia en %). */
export function evaluarResultado(baseline: number | null, actual: number | null, direccion: MetricaDireccion, toleranciaPct = 2): Omit<ResultadoMedicion, "actualMes"> | null {
  if (baseline == null || actual == null || !Number.isFinite(baseline) || !Number.isFinite(actual)) return null;
  const deltaAbs = r2(actual - baseline);
  const deltaPct = baseline !== 0 ? r2(((actual - baseline) / Math.abs(baseline)) * 100) : null;
  const chico = deltaPct != null ? Math.abs(deltaPct) < toleranciaPct : deltaAbs === 0;
  const veredicto: Veredicto = chico ? "sin_cambio" : (direccion === "down" ? deltaAbs < 0 : deltaAbs > 0) ? "mejoro" : "empeoro";
  return { actual, deltaAbs, deltaPct, veredicto };
}

/** Último valor con dato de una serie Ene..Dic → { valor, mes "YYYY-MM" }. */
export function ultimoConDato(realM: (number | null)[], anio: number): { valor: number; mes: string } | null {
  for (let i = realM.length - 1; i >= 0; i--) {
    const v = realM[i];
    if (v != null && Number.isFinite(v)) return { valor: v, mes: `${anio}-${String(i + 1).padStart(2, "0")}` };
  }
  return null;
}

/**
 * Resultado de una recomendación en seguimiento (puro): exige ventana cumplida y un mes cerrado
 * POSTERIOR al del baseline.
 */
export function medirSeguimiento(
  s: Pick<SeguimientoRec, "estado" | "kpi" | "baseline" | "baselineMes" | "direccion" | "chequeoDesde">,
  actual: { valor: number; mes: string } | null,
  hoyISO: string,
): { resultado: ResultadoMedicion | null; pendiente: string | null } {
  if (s.estado === "descartada") return { resultado: null, pendiente: null };
  if (!s.kpi) return { resultado: null, pendiente: "Sin KPI con serie automática: revisalo en el tablero." };
  if (s.baseline == null || !s.baselineMes) return { resultado: null, pendiente: "No había dato del KPI al marcarla (sin baseline)." };
  if (s.chequeoDesde && hoyISO < s.chequeoDesde) return { resultado: null, pendiente: `Se mide desde el ${s.chequeoDesde.split("-").reverse().join("/")}.` };
  if (!actual || actual.mes <= s.baselineMes) return { resultado: null, pendiente: "Esperando un mes cerrado nuevo del KPI." };
  const ev = evaluarResultado(s.baseline, actual.valor, s.direccion);
  return ev ? { resultado: { ...ev, actualMes: actual.mes }, pendiente: null } : { resultado: null, pendiente: "Sin dato comparable." };
}
