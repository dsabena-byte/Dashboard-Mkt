// ============================================================================
// Visibilidad en IA (LLMO) — diseño estadístico. PURO, client-safe, sin imports.
// docs/estado-del-arte/seo-geo.md §4.9 y gap G1: el LLMO viejo (5 prompts × 1 corrida, share y
// "rank promedio") no era estadísticamente válido. Las respuestas de IA son muy volátiles
// (SparkToro+Gumshoe 2026: la misma lista de marcas se repite <1 vez cada 100 corridas) → la
// métrica útil es la TASA DE MENCIÓN (% de respuestas que nombran la marca) sobre muchas
// corridas, con su intervalo de confianza (Wilson); la "posición en la IA" es ruido.
//
// Método:
//  · 12 prompts por categoría en 4 intenciones (descubrimiento, comparación, evaluación,
//    compra/servicio), en español rioplatense, generados DETERMINÍSTICAMENTE de plantillas.
//  · Cada sync semanal corre K llamadas por categoría (K por plan, `LLMO_CALLS_POR_CAT`),
//    rotando los prompts según la semana → a lo largo del mes cada prompt se corre ≥3 veces.
//  · Muestreo acumulado: se agregan las respuestas de los últimos LLMO_WINDOW_DAYS días
//    (las guardadas en el snapshot + las nuevas) → n ≈ 4K por categoría sin pagar más por corrida.
//  · Tasa de mención = respuestas que mencionan la marca / respuestas; IC Wilson 95%.
//  · "Dato insuficiente" si n < LLMO_MIN_N o el IC es más ancho que ±LLMO_MAX_HALF_WIDTH.
//  · Share of model (SoV) = menciones de la marca / menciones de todas las marcas trackeadas
//    (se conserva: lo usan el KPI del Mapa y el historial `seo_monthly.llmo_share`).
// ============================================================================

export type LlmoIntencion = "descubrimiento" | "comparacion" | "evaluacion" | "compra";
export interface LlmoPrompt { id: string; intencion: LlmoIntencion; texto: string }

/** 12 prompts deterministas por categoría (3 por intención). `id` estable (no incluye el año). */
export function llmoPromptSet(categoria: string, year: number): LlmoPrompt[] {
  const c = categoria.trim();
  const P = (id: string, intencion: LlmoIntencion, texto: string): LlmoPrompt => ({ id, intencion, texto });
  return [
    P("desc1", "descubrimiento", `¿Cuáles son las mejores marcas de ${c} en Argentina?`),
    P("desc2", "descubrimiento", `Recomendame marcas de ${c} para comprar en Argentina en ${year}.`),
    P("desc3", "descubrimiento", `Mejores ${c} ${year} en Argentina: ranking de marcas.`),
    P("comp1", "comparacion", `¿Qué marca de ${c} conviene comprar hoy en Argentina? Compará las principales.`),
    P("comp2", "comparacion", `Comparame las marcas de ${c} que se venden en Argentina: precio, calidad y durabilidad.`),
    P("comp3", "comparacion", `Estoy entre varias marcas de ${c}, ¿cuál me recomendás y por qué? Vivo en Argentina.`),
    P("eval1", "evaluacion", `¿Qué marcas de ${c} tienen mejor calidad y servicio técnico en Argentina?`),
    P("eval2", "evaluacion", `¿Qué marca de ${c} es más confiable y dura más? Busco opciones disponibles en Argentina.`),
    P("eval3", "evaluacion", `¿Qué marcas de ${c} tienen mejor relación precio-calidad en Argentina en ${year}?`),
    P("compra1", "compra", `¿Qué ${c} me conviene comprar en cuotas en Argentina? Nombrá marcas concretas.`),
    P("compra2", "compra", `Quiero comprar ${c} en Argentina, ¿qué marcas tienen buena garantía y service en todo el país?`),
    P("compra3", "compra", `¿Dónde y qué marca de ${c} comprar en Argentina para no equivocarme?`),
  ];
}

/** Semana ISO-ish (número de semanas desde epoch) → rotación determinística. */
export const weekIndex = (d: Date): number => Math.floor(d.getTime() / (7 * 86400_000));

/**
 * Prompts a correr en esta corrida: `k` llamadas, rotando desde un offset que depende de la
 * semana (así, en 4 corridas se cubre todo el set). Si k > prompts, se repiten (réplicas).
 */
export function pickPromptsForRun<T>(prompts: T[], k: number, week: number): T[] {
  if (!prompts.length || k <= 0) return [];
  const off = ((week * k) % prompts.length + prompts.length) % prompts.length;
  return Array.from({ length: k }, (_, i) => prompts[(off + i) % prompts.length]!);
}

// ── Costo / tamaño de muestra por plan ───────────────────────────────────────
export type LlmoPlan = "insight_trial" | "insight" | "optimize" | "accelerate";
/** Llamadas por categoría y corrida semanal. Default BARATO (ver costo abajo); override por env
 *  LLMO_CALLS_POR_CAT (todos) o LLMO_CALLS_<PLAN> (p. ej. LLMO_CALLS_ACCELERATE=24). */
export const LLMO_CALLS_DEFAULT: Record<LlmoPlan, number> = { insight_trial: 8, insight: 8, optimize: 10, accelerate: 10 };
export const LLMO_CALLS_MAX = 40;
export function llmoCallsPorCat(plan: LlmoPlan | string | null | undefined, env: Record<string, string | undefined> = {}): number {
  const p = (plan && plan in LLMO_CALLS_DEFAULT ? plan : "optimize") as LlmoPlan;
  const raw = env[`LLMO_CALLS_${p.toUpperCase()}`] ?? env.LLMO_CALLS_POR_CAT;
  const n = raw != null && raw !== "" ? Math.round(Number(raw)) : LLMO_CALLS_DEFAULT[p];
  return Number.isFinite(n) && n > 0 ? Math.min(LLMO_CALLS_MAX, n) : LLMO_CALLS_DEFAULT[p];
}

/** Costo por llamada (US$) de gpt-4o-search-preview con search_context_size "low":
 *  US$30 / 1.000 llamadas + tokens (US$2,50/M in, US$10/M out; ~150 in + ~600 out)
 *  → 0,03 + 0,0004 + 0,006 ≈ US$0,036 (developers.openai.com/api/docs/pricing, sep-2026). */
export const LLMO_USD_POR_LLAMADA = 0.036;
export const RUNS_POR_MES = 4.33; // sync SEO semanal (lunes)
export function llmoCostoMensualUsd(callsPorCat: number, categorias: number, usdPorLlamada = LLMO_USD_POR_LLAMADA, runsPorMes = RUNS_POR_MES): number {
  return callsPorCat * categorias * runsPorMes * usdPorLlamada;
}

// ── Estadística ──────────────────────────────────────────────────────────────
export const LLMO_WINDOW_DAYS = 28;
export const LLMO_MIN_N = 30;
export const LLMO_MAX_HALF_WIDTH = 0.2; // ±20 pp

/** Intervalo de Wilson (proporciones 0..1). n=0 → [0,1]. */
export function wilson(k: number, n: number, z = 1.96): { p: number; lo: number; hi: number } {
  if (!(n > 0)) return { p: 0, lo: 0, hi: 1 };
  const p = Math.min(1, Math.max(0, k / n));
  const z2 = z * z;
  const den = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / den;
  const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / den;
  return { p, lo: Math.max(0, center - half), hi: Math.min(1, center + half) };
}

/** Una respuesta de IA ya procesada (lo que se guarda en el snapshot, sin el texto). */
export interface LlmoMuestra {
  categoria: string; fecha: string; prompt: string; intencion?: string; modelo: string; marcas: string[];
  /** URLs citadas por el modelo con búsqueda (G6, lib/llmo-fuentes.ts). Solo modelo con búsqueda. */
  fuentes?: string[];
}

/** Muestras vigentes: las previas dentro de la ventana + las nuevas (máx. `cap` por categoría). */
export function poolMuestras(prev: LlmoMuestra[] | null | undefined, nuevas: LlmoMuestra[], now: Date, windowDays = LLMO_WINDOW_DAYS, cap = 200): LlmoMuestra[] {
  const desde = now.getTime() - windowDays * 86400_000;
  const all = [...(prev ?? []).filter((m) => { const t = Date.parse(m.fecha); return Number.isFinite(t) && t >= desde; }), ...nuevas];
  const byCat = new Map<string, LlmoMuestra[]>();
  for (const m of all) { const a = byCat.get(m.categoria) ?? []; a.push(m); byCat.set(m.categoria, a); }
  return [...byCat.values()].flatMap((a) => a.sort((x, y) => y.fecha.localeCompare(x.fecha)).slice(0, cap));
}

export interface LlmoAgg {
  marca: string; own: boolean;
  respuestas: number;      // n
  menciones: number;       // respuestas que mencionan la marca (k)
  menciones_total: number; // menciones de TODAS las marcas trackeadas (para el SoV)
  tasa_pct: number; ic_lo: number; ic_hi: number; // %, Wilson 95%
  share_pct: number;       // SoV (%)
  suficiente: boolean;
}

export function isSuficiente(n: number, lo: number, hi: number): boolean {
  return n >= LLMO_MIN_N && (hi - lo) / 2 <= LLMO_MAX_HALF_WIDTH;
}

/** Agrega las muestras de UNA categoría por marca. */
export function aggregateLlmo(muestras: LlmoMuestra[], brands: { marca: string; own: boolean }[]): LlmoAgg[] {
  const n = muestras.length;
  const k = new Map(brands.map((b) => [b.marca, 0]));
  for (const m of muestras) for (const b of new Set(m.marcas)) if (k.has(b)) k.set(b, (k.get(b) ?? 0) + 1);
  const total = [...k.values()].reduce((s, x) => s + x, 0);
  return brands.map((b) => {
    const kk = k.get(b.marca) ?? 0;
    const w = wilson(kk, n);
    return { marca: b.marca, own: b.own, respuestas: n, menciones: kk, menciones_total: total, tasa_pct: w.p * 100, ic_lo: w.lo * 100, ic_hi: w.hi * 100, share_pct: total > 0 ? (kk / total) * 100 : 0, suficiente: isSuficiente(n, w.lo, w.hi) };
  });
}

/** Lectura uniforme de una fila (nueva o de un snapshot VIEJO: n = prompts, k = menciones). */
export interface LlmoLike { marca: string; own: boolean; menciones: number; prompts: number; share_pct: number; respuestas?: number; menciones_total?: number; tasa_pct?: number; ic_lo?: number; ic_hi?: number; suficiente?: boolean }
export interface LlmoStats { n: number; k: number; tasa: number; lo: number; hi: number; margen: number; suficiente: boolean; sov: number; sovLo: number; sovHi: number }
export function llmoStats(r: LlmoLike): LlmoStats {
  const n = r.respuestas ?? r.prompts ?? 0;
  const k = Math.min(n, r.menciones ?? 0);
  const w = wilson(k, n);
  const tot = r.menciones_total ?? (r.share_pct > 0 ? Math.round((r.menciones / r.share_pct) * 100) : 0);
  const sv = wilson(r.menciones, tot);
  const lo = w.lo * 100, hi = w.hi * 100;
  return { n, k, tasa: w.p * 100, lo, hi, margen: (hi - lo) / 2, suficiente: r.suficiente ?? isSuficiente(n, w.lo, w.hi), sov: r.share_pct, sovLo: sv.lo * 100, sovHi: sv.hi * 100 };
}

/** ¿a supera a b fuera del margen de error? (ICs de Wilson que NO se solapan; conservador). */
export function claramenteMayor(a: { lo: number }, b: { hi: number }): boolean {
  return a.lo > b.hi;
}

/** "38% ± 9 pp" */
export const fTasaIc = (s: Pick<LlmoStats, "tasa" | "margen">): string => `${Math.round(s.tasa)}% ± ${Math.round(s.margen)} pp`;
