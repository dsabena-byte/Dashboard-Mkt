import "server-only";
// ============================================================================
// Motor de SEÑALES determinísticas (sin IA) — portado de BIP (sep-2026) y adaptado a Drean.
// Lee fuentes baratas/precalculadas (lib/signals/sources.ts) y corre las reglas puras de cada
// tablero. Se calcula al vuelo (sin tabla propia) y nunca tira.
// CRUCES (lib/signals/cruces.ts): propios × mercado; cada señal cruzada pertenece a un tablero y se
// suma a ese tablero; en overview se muestran las más relevantes. Scope "cruces" = solo cruzadas.
// Consumidores: /api/insights/signals, /api/insights (Diagnóstico IA) y el copiloto
// (`signalsSummaryForChat` + `isSignalScope`).
// ============================================================================
import { type Signal, type SignalDash, sortSignals } from "./types";
import { computeRedesSignals } from "./redes";
import { computePautaSignals, pacingSignals, fatigaSignals } from "./pauta";
import { gastoDiarioSignals } from "./pauta-diaria";
import { computeWebSignals } from "./web";
import { computeSeoSignals } from "./seo";
import { computeOverviewSignals } from "./overview";
import { computeCrucesSignals } from "./cruces";
import { computeWebCalidadSignals } from "./web-calidad";
import { computeSeoAvanzadoSignals } from "./seo-avanzado";
import { computePautaDataSignals, computeCbSignals, computeFsSignals, computeUgcSignals, computeMercadoSignals, computeSaludSignals, computeMktCanalSignals, computeConversionSignals, computeInversionSignals } from "./drean";
import { LoadCtx, loadRedes, loadPauta, loadPautaExtras, loadPautaDiaria, loadWeb, loadWebCalidad, loadSeoAvanzadoInput, loadSeo, loadOverview, loadCruces, loadCb, loadFs, loadUgc, loadMercado, loadSalud, loadMktCanal, loadConversion, loadInversion } from "./sources";

export type { Signal, SignalDash } from "./types";
export type SignalScope = SignalDash | "cruces";
export { LoadCtx } from "./sources";

export const SIGNAL_DASHES: SignalDash[] = [
  "overview", "performance", "redes", "web", "seo-search",
  "cuadros-basicos", "floor-share", "influencia", "mercado", "salud-marca", "mkt-canal", "performance-conversion", "funnel",
];
const CRUCE_DASHES: SignalDash[] = ["overview", "performance", "redes", "web", "seo-search"];
const OVERVIEW_CRUCES = 4;
const OVERVIEW_PER_DASH = 2;

const crucesFor = async (ctx: LoadCtx): Promise<Signal[]> => {
  try { const inp = await loadCruces(ctx); return inp ? computeCrucesSignals(inp) : []; } catch { return []; }
};

/** Señales propias de un tablero (sin cruces). */
export async function baseSignals(ctx: LoadCtx, dash: SignalDash): Promise<Signal[]> {
  try {
    switch (dash) {
      case "redes": { const r = await loadRedes(ctx); return r ? computeRedesSignals(r) : []; }
      case "performance": {
        // + pacing del mes en curso vs la meta de Inversión y fatiga creativa (lib/pauta-pacing, lib/pauta-fatiga).
        // + gasto diario anómalo por medio con API (lib/pauta-diaria → señal gasto_diario_anomalo).
        const [p, x, gd] = await Promise.all([loadPauta(ctx).catch(() => null), loadPautaExtras(ctx).catch(() => null), loadPautaDiaria(ctx).catch(() => null)]);
        const extra = [...(x ? [...pacingSignals(x.pacing), ...fatigaSignals(x.fatiga)] : []), ...gastoDiarioSignals(gd)];
        return p ? [...computePautaSignals(p), ...computePautaDataSignals(p.warnings), ...extra] : extra;
      }
      case "web": {
        // + calidad del dato / cierre proyectado / consent (lib/signals/web-calidad.ts, snapshot del cron web-calidad).
        const [w, wc] = await Promise.all([loadWeb(ctx).catch(() => null), loadWebCalidad(ctx).catch(() => null)]);
        return [...(w ? computeWebSignals(w.reports, { periodo: w.periodo.label, competitor: w.competitor }) : []), ...(wc ? computeWebCalidadSignals(wc) : [])];
      }
      case "seo-search": {
        // + SEO/GEO avanzado: SC a fondo, auditoría, fuentes de IA, keywords, ESoS (lib/signals/seo-avanzado.ts).
        const [s, sa] = await Promise.all([loadSeo(ctx).catch(() => null), loadSeoAvanzadoInput(ctx).catch(() => null)]);
        return [...(s ? computeSeoSignals(s) : []), ...(sa ? computeSeoAvanzadoSignals(sa) : [])];
      }
      case "overview": {
        // En paralelo: el Seguimiento y el SEO (visibilidad en IA) no dependen uno del otro.
        const [o, s] = await Promise.all([loadOverview(ctx).catch(() => null), loadSeo(ctx).catch(() => null)]);
        let base = o ? computeOverviewSignals(o) : [];
        // Visibilidad en IA vs share of search (regla de seo.ts): se referencia en la visión general.
        if (s) base = [...base, ...computeSeoSignals(s).filter((x) => x.key.includes("_llm_")).slice(0, 1)];
        return base;
      }
      case "cuadros-basicos": { const c = await loadCb(ctx); return c ? computeCbSignals(c) : []; }
      case "floor-share": { const f = await loadFs(ctx); return f ? computeFsSignals(f) : []; }
      case "influencia": { const u = await loadUgc(ctx); return u ? computeUgcSignals(u) : []; }
      case "mercado": { const m = await loadMercado(ctx); return m ? computeMercadoSignals(m) : []; }
      case "salud-marca": return computeSaludSignals(await loadSalud(ctx));
      case "mkt-canal": { const m = await loadMktCanal(ctx); return m ? computeMktCanalSignals(m) : []; }
      case "performance-conversion": { const c = await loadConversion(ctx); return c ? computeConversionSignals(c) : []; }
      case "funnel": { const i = await loadInversion(ctx); return i ? computeInversionSignals(i.cuatris, { maxDesvio: i.maxDesvio, maxInvFact: i.maxInvFact }) : []; }
    }
  } catch { /* señales best-effort */ }
  return [];
}

async function forDash(ctx: LoadCtx, dash: SignalDash, cruces: Promise<Signal[]>): Promise<Signal[]> {
  // Todo en paralelo (propias, cruces y — en overview — los tableros de trade/mercado/salud): cada fuente
  // tiene su tope en el LoadCtx, así que el total queda acotado por la fuente más lenta, no por la suma.
  const [base, cr, tops] = await Promise.all([
    baseSignals(ctx, dash),
    CRUCE_DASHES.includes(dash) ? cruces.catch(() => [] as Signal[]) : Promise.resolve([] as Signal[]),
    dash === "overview"
      // La visión general cruza planes: las 2 principales de cada tablero propio de Drean.
      ? Promise.all((["cuadros-basicos", "floor-share", "mercado", "salud-marca"] as SignalDash[]).map((d) => baseSignals(ctx, d).then((s) => s.filter((x) => x.tipo !== "info").slice(0, OVERVIEW_PER_DASH)).catch(() => [] as Signal[])))
      : Promise.resolve([] as Signal[][]),
  ]);
  const extra = dash === "overview" ? cr.slice(0, OVERVIEW_CRUCES) : cr.filter((c) => c.dash === dash);
  return sortSignals([...base, ...extra, ...tops.flat()]);
}

/** Señales de un tablero (o de todos si no se indica), ordenadas por prioridad / tipo / impacto. */
export async function computeSignals(dash?: SignalScope, ctx: LoadCtx = new LoadCtx()): Promise<Signal[]> {
  const cruces = crucesFor(ctx);
  if (dash === "cruces") return cruces;
  if (dash) return forDash(ctx, dash, cruces);
  // Todos: cada señal una sola vez (en su tablero), sin duplicar en overview.
  const all = await Promise.all(SIGNAL_DASHES.map((d) => (d === "overview"
    ? baseSignals(ctx, d)
    : forDash(ctx, d, cruces))));
  const seen = new Set<string>();
  return sortSignals(all.flat().filter((s) => (seen.has(s.key) ? false : (seen.add(s.key), true))));
}

// ── Caché en memoria por tablero (15 min) ──
// Las señales se recalculan sobre fuentes que cambian cada horas (crons de 6-12 h), así que reabrir el
// Diagnóstico dentro de los 15 min sirve la misma respuesta al instante. Un resultado PARCIAL (alguna
// fuente se omitió por tiempo) se guarda solo 2 min, para reintentar pronto. Pedidos simultáneos del
// mismo tablero comparten el cálculo en curso. Vive por instancia del servidor (no se comparte entre
// instancias ni sobrevive a un deploy): es una aceleración, nunca la fuente de verdad.
export interface SignalsResult { signals: Signal[]; skipped: string[]; computedAt: string; ms: number; cached: boolean; timings: Record<string, number> }
const CACHE_TTL = 15 * 60_000;
const CACHE_TTL_PARCIAL = 2 * 60_000;
const cache = new Map<string, { at: number; ttl: number; res: SignalsResult }>();
const inflight = new Map<string, Promise<SignalsResult>>();

/** Señales + fuentes omitidas por tiempo, con caché de 15 min por tablero (`fresh` la saltea). */
export async function computeSignalsDetailed(dash?: SignalScope, opts: { fresh?: boolean; timeoutMs?: number } = {}): Promise<SignalsResult> {
  const k = dash ?? "*";
  const hit = cache.get(k);
  if (!opts.fresh && hit && Date.now() - hit.at < hit.ttl) return { ...hit.res, cached: true };
  const running = inflight.get(k);
  if (running) return running;
  const job = (async () => {
    const t0 = Date.now();
    const ctx = new LoadCtx({ timeoutMs: opts.timeoutMs });
    const signals = await computeSignals(dash, ctx).catch(() => [] as Signal[]);
    const res: SignalsResult = { signals, skipped: ctx.skippedLabels(), computedAt: new Date().toISOString(), ms: Date.now() - t0, cached: false, timings: { ...ctx.timings } };
    cache.set(k, { at: Date.now(), ttl: res.skipped.length ? CACHE_TTL_PARCIAL : CACHE_TTL, res });
    return res;
  })().finally(() => inflight.delete(k));
  inflight.set(k, job);
  return job;
}

/** Lista compacta para el chat: una línea por señal (sin `datos`), acotada. */
export async function signalsSummaryForChat(dash?: SignalScope, limit = 15): Promise<{ dash: SignalDash; tipo: Signal["tipo"]; prioridad: Signal["prioridad"]; cruce: boolean; titulo: string; detalle: string; accion: string | null; impacto: string | null }[]> {
  const s = await computeSignalsDetailed(dash).then((r) => r.signals).catch(() => [] as Signal[]);
  return s.slice(0, limit).map((x) => ({
    dash: x.dash, tipo: x.tipo, prioridad: x.prioridad, cruce: !!x.cruce, titulo: x.titulo,
    detalle: x.descripcion.slice(0, 280),
    accion: x.acciones[0] ?? null,
    impacto: x.impacto ? `${x.impacto.metrica}: ${x.impacto.valor.toLocaleString("es-AR", { maximumFractionDigits: 1 })} ${x.impacto.unidad}` : null,
  }));
}

export function isSignalDash(d: string): d is SignalDash {
  return (SIGNAL_DASHES as string[]).includes(d);
}
export function isSignalScope(d: string): d is SignalScope {
  return d === "cruces" || isSignalDash(d);
}
