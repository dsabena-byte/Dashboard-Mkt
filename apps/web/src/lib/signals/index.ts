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
import { computePautaSignals } from "./pauta";
import { computeWebSignals } from "./web";
import { computeSeoSignals } from "./seo";
import { computeOverviewSignals } from "./overview";
import { computeCrucesSignals } from "./cruces";
import { computePautaDataSignals, computeCbSignals, computeFsSignals, computeUgcSignals, computeMercadoSignals, computeSaludSignals, computeMktCanalSignals, computeConversionSignals, computeInversionSignals } from "./drean";
import { LoadCtx, loadRedes, loadPauta, loadWeb, loadSeo, loadOverview, loadCruces, loadCb, loadFs, loadUgc, loadMercado, loadSalud, loadMktCanal, loadConversion, loadInversion } from "./sources";

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
      case "performance": { const p = await loadPauta(ctx); return p ? [...computePautaSignals(p), ...computePautaDataSignals(p.warnings)] : []; }
      case "web": { const w = await loadWeb(ctx); return w ? computeWebSignals(w.reports, { periodo: w.periodo.label, competitor: w.competitor }) : []; }
      case "seo-search": { const s = await loadSeo(ctx); return s ? computeSeoSignals(s) : []; }
      case "overview": {
        const o = await loadOverview(ctx);
        let base = o ? computeOverviewSignals(o) : [];
        // Visibilidad en IA vs share of search (regla de seo.ts): se referencia en la visión general.
        const s = await loadSeo(ctx).catch(() => null);
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
  const base = await baseSignals(ctx, dash);
  let extra: Signal[] = [];
  if (CRUCE_DASHES.includes(dash)) {
    const cr = await cruces.catch(() => [] as Signal[]);
    extra = dash === "overview" ? cr.slice(0, OVERVIEW_CRUCES) : cr.filter((c) => c.dash === dash);
  }
  if (dash === "overview") {
    // La visión general cruza planes: las 2 principales de cada tablero propio de Drean.
    const tops = await Promise.all((["cuadros-basicos", "floor-share", "mercado", "salud-marca"] as SignalDash[]).map((d) => baseSignals(ctx, d).then((s) => s.filter((x) => x.tipo !== "info").slice(0, OVERVIEW_PER_DASH)).catch(() => [])));
    extra = [...extra, ...tops.flat()];
  }
  return sortSignals([...base, ...extra]);
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

/** Lista compacta para el chat: una línea por señal (sin `datos`), acotada. */
export async function signalsSummaryForChat(dash?: SignalScope, limit = 15): Promise<{ dash: SignalDash; tipo: Signal["tipo"]; prioridad: Signal["prioridad"]; cruce: boolean; titulo: string; detalle: string; accion: string | null; impacto: string | null }[]> {
  const s = await computeSignals(dash).catch(() => [] as Signal[]);
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
