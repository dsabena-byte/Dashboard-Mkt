import "server-only";
import { getServerSupabase } from "./supabase-server";

export interface CompetitorWebRow {
  competidor: string;
  dominio: string;
  fecha: string;
  visitas_estimadas: number | null;
  visitantes_unicos: number | null;
  bounce_rate: number | null;
  pages_per_visit: number | null;
  avg_visit_duration: number | null;
  fuentes_trafico: unknown;
  paginas_top: unknown;
  paises_top: unknown;
  keywords_top: unknown;
  raw: unknown;
}

export interface CompetitorWebSnapshotWithDelta extends CompetitorWebRow {
  deltaVisitas: number | null;          // diferencia absoluta vs snapshot anterior
  deltaVisitasPct: number | null;       // % de variación
  fechaAnterior: string | null;
}

// Competidores que no son relevantes para el benchmark (distorsionan visualizaciones).
// Samsung opera con tráfico global desde shop.samsung.com, ~10M visitas vs ~200k de la pauta argentina.
const HIDDEN_COMPETITORS = new Set(["Samsung"]);

// =====================================================================
// Drean (datos REALES desde GA4 — reemplazan la estimación de SimilarWeb)
// =====================================================================

export interface DreanGa4Monthly {
  fecha: string;
  visitas: number;
  bounce_rate: number | null;
  pages_per_visit: number | null;
  avg_visit_duration: number | null;
}
interface DreanGa4Snapshot {
  fecha: string;
  visitas_estimadas: number;
  bounce_rate: number | null;
  pages_per_visit: number | null;
  avg_visit_duration: number | null;
  meses: Array<{ fecha: string; visitas: number }>;
  // Métricas de calidad mensuales (para poder elegir el mes cerrado en lugar del en curso)
  mesesMetrics: DreanGa4Monthly[];
}

/**
 * Agrega las filas de web_traffic (GA4) en métricas mensuales y devuelve
 * el snapshot del último mes + serie de los últimos 12 meses.
 */
export async function getDreanWebMetrics(): Promise<DreanGa4Snapshot | null> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("web_traffic")
    .select("fecha, sesiones, bounce_rate, avg_session_duration, pageviews")
    .order("fecha", { ascending: false })
    .returns<Array<{ fecha: string; sesiones: number; bounce_rate: number | null; avg_session_duration: number | null; pageviews: number }>>();
  if (error) {
    if (/relation .* does not exist/i.test(error.message)) return null;
    throw new Error(`web_traffic: ${error.message}`);
  }
  const rows = data ?? [];
  if (rows.length === 0) return null;

  // Agregar por mes (yyyy-mm-01)
  const byMonth = new Map<string, { sesiones: number; pageviews: number; bounceWeighted: number; durationWeighted: number; sesionesConBounce: number; sesionesConDuration: number }>();
  for (const r of rows) {
    const monthKey = r.fecha.slice(0, 7) + "-01";
    const acc = byMonth.get(monthKey) ?? {
      sesiones: 0, pageviews: 0, bounceWeighted: 0, durationWeighted: 0,
      sesionesConBounce: 0, sesionesConDuration: 0,
    };
    acc.sesiones += r.sesiones ?? 0;
    acc.pageviews += r.pageviews ?? 0;
    if (r.bounce_rate !== null) {
      acc.bounceWeighted += (r.bounce_rate ?? 0) * (r.sesiones ?? 0);
      acc.sesionesConBounce += r.sesiones ?? 0;
    }
    if (r.avg_session_duration !== null) {
      acc.durationWeighted += (r.avg_session_duration ?? 0) * (r.sesiones ?? 0);
      acc.sesionesConDuration += r.sesiones ?? 0;
    }
    byMonth.set(monthKey, acc);
  }
  const mesesMetrics: DreanGa4Monthly[] = [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([fecha, acc]) => ({
      fecha,
      visitas: acc.sesiones,
      bounce_rate: acc.sesionesConBounce > 0 ? acc.bounceWeighted / acc.sesionesConBounce : null,
      pages_per_visit: acc.sesiones > 0 ? acc.pageviews / acc.sesiones : null,
      avg_visit_duration: acc.sesionesConDuration > 0 ? acc.durationWeighted / acc.sesionesConDuration : null,
    }));
  const meses = mesesMetrics.map((m) => ({ fecha: m.fecha, visitas: m.visitas }));

  const lastMonth = meses[meses.length - 1];
  if (!lastMonth) return null;
  const lastAcc = byMonth.get(lastMonth.fecha)!;

  return {
    fecha: lastMonth.fecha,
    visitas_estimadas: lastAcc.sesiones,
    bounce_rate: lastAcc.sesionesConBounce > 0 ? lastAcc.bounceWeighted / lastAcc.sesionesConBounce : null,
    pages_per_visit: lastAcc.sesiones > 0 ? lastAcc.pageviews / lastAcc.sesiones : null,
    avg_visit_duration: lastAcc.sesionesConDuration > 0 ? lastAcc.durationWeighted / lastAcc.sesionesConDuration : null,
    meses: meses.slice(-12),
    mesesMetrics: mesesMetrics.slice(-12),
  };
}

async function fetchAll(): Promise<CompetitorWebRow[]> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("competitor_web")
    .select(
      "competidor, dominio, fecha, visitas_estimadas, visitantes_unicos, bounce_rate, pages_per_visit, avg_visit_duration, fuentes_trafico, paginas_top, paises_top, keywords_top, raw",
    )
    .order("fecha", { ascending: false })
    .returns<CompetitorWebRow[]>();
  if (error) throw new Error(`competitor_web: ${error.message}`);
  return (data ?? []).filter((r) => !HIDDEN_COMPETITORS.has(r.competidor));
}

/**
 * Snapshot actual con delta vs ejecución previa para detectar picos de tráfico.
 */
export async function getCompetitorWebSnapshot(): Promise<CompetitorWebSnapshotWithDelta[]> {
  const all = await fetchAll();
  const byComp = new Map<string, CompetitorWebRow[]>();
  for (const r of all) {
    if (!byComp.has(r.competidor)) byComp.set(r.competidor, []);
    byComp.get(r.competidor)!.push(r);
  }
  const out: CompetitorWebSnapshotWithDelta[] = [];
  for (const [, rows] of byComp) {
    const latest = rows[0]!;
    const prev = rows[1];
    let deltaVisitas: number | null = null;
    let deltaVisitasPct: number | null = null;
    if (prev && latest.visitas_estimadas !== null && prev.visitas_estimadas !== null && prev.visitas_estimadas > 0) {
      deltaVisitas = latest.visitas_estimadas - prev.visitas_estimadas;
      deltaVisitasPct = deltaVisitas / prev.visitas_estimadas;
    }
    out.push({ ...latest, deltaVisitas, deltaVisitasPct, fechaAnterior: prev?.fecha ?? null });
  }
  return out.sort((a, b) => (b.visitas_estimadas ?? 0) - (a.visitas_estimadas ?? 0));
}

/**
 * Serie de snapshots ejecutados (cada vez que corre el workflow).
 */
export async function getCompetitorWebHistory(limit = 12): Promise<
  Array<{
    competidor: string;
    dominio: string;
    serie: Array<{ fecha: string; visitas: number | null }>;
  }>
> {
  const all = await fetchAll();
  const byComp = new Map<string, CompetitorWebRow[]>();
  for (const r of all) {
    if (!byComp.has(r.competidor)) byComp.set(r.competidor, []);
    byComp.get(r.competidor)!.push(r);
  }
  return [...byComp.entries()].map(([competidor, rows]) => {
    const sorted = [...rows].sort((a, b) => a.fecha.localeCompare(b.fecha));
    const trimmed = sorted.slice(-limit);
    return {
      competidor,
      dominio: rows[0]?.dominio ?? "",
      serie: trimmed.map((r) => ({ fecha: r.fecha, visitas: r.visitas_estimadas })),
    };
  });
}

/**
 * Historia mensual de visitas — viene del actor SimilarWeb dentro del raw JSON.
 * Detecta valores con clave en formato YYYY-MM-DD en cualquier nivel del objeto.
 * El actor radeance/similarweb-scraper devuelve esto como un map plano de fecha→count
 * (los últimos 3-6 meses), o anidado en `monthlyVisits`/`historicalTraffic`/etc.
 */
export async function getCompetitorMonthlyHistory(): Promise<
  Array<{
    competidor: string;
    dominio: string;
    meses: Array<{ fecha: string; visitas: number }>;
  }>
> {
  const all = await fetchAll();
  // Quedarse con el snapshot más reciente por competidor (el raw más actualizado)
  const latestByComp = new Map<string, CompetitorWebRow>();
  for (const r of all) {
    if (!latestByComp.has(r.competidor)) latestByComp.set(r.competidor, r);
  }
  return [...latestByComp.values()].map((r) => ({
    competidor: r.competidor,
    dominio: r.dominio,
    meses: extractMonthlyFromRaw(r.raw),
  }));
}

const MONTH_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_HISTORY_FIELD_HINTS = [
  "monthlyVisitsDateFormat",
  "monthlyVisits",
  "monthlyVisitors",
  "estimatedMonthlyVisits",
  "trafficHistory",
  "historicalTraffic",
  "historicalData",
  "history",
  "visitsByMonth",
];

function extractMonthlyFromRaw(raw: unknown): Array<{ fecha: string; visitas: number }> {
  if (!raw || typeof raw !== "object") return [];
  // Caso 1: raw es directamente un map fecha → número
  const direct = mapToSerie(raw as Record<string, unknown>);
  if (direct.length > 0) return direct;
  // Caso 2: raw tiene un campo conocido con la historia
  const r = raw as Record<string, unknown>;
  for (const k of MONTH_HISTORY_FIELD_HINTS) {
    const v = r[k];
    if (Array.isArray(v)) {
      const arr = (v as Array<Record<string, unknown>>).map((p) => ({
        fecha: String(p.date ?? p.month ?? p.fecha ?? ""),
        visitas: numOrZero(p.visits ?? p.value ?? p.count ?? p.traffic),
      })).filter((p) => MONTH_KEY_RE.test(p.fecha) && p.visitas > 0);
      if (arr.length > 0) return sortByFecha(arr);
    }
    if (v && typeof v === "object") {
      const obj = v as Record<string, unknown>;
      const serie = mapToSerie(obj);
      if (serie.length > 0) return serie;
    }
  }
  return [];
}

function mapToSerie(obj: Record<string, unknown>): Array<{ fecha: string; visitas: number }> {
  const out: Array<{ fecha: string; visitas: number }> = [];
  for (const [k, v] of Object.entries(obj)) {
    if (!MONTH_KEY_RE.test(k)) continue;
    const n = numOrZero(v);
    if (n > 0) out.push({ fecha: k, visitas: n });
  }
  return sortByFecha(out);
}

function sortByFecha<T extends { fecha: string }>(arr: T[]): T[] {
  return arr.sort((a, b) => a.fecha.localeCompare(b.fecha));
}

function numOrZero(v: unknown): number {
  if (v === null || v === undefined) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export interface SourceBreakdown {
  competidor: string;
  fuentes: Array<{ name: string; value: number }>;
}

/**
 * Distribución de fuentes de tráfico (direct, search, social, referral, paid, mail).
 * El JSON puede venir en distintos shapes según el actor — soportamos varios.
 */
export async function getCompetitorTrafficSources(): Promise<SourceBreakdown[]> {
  const snap = await getCompetitorWebSnapshot();
  return snap.map((r) => ({ competidor: r.competidor, fuentes: parseSources(r.fuentes_trafico) }));
}

function parseSources(raw: unknown): Array<{ name: string; value: number }> {
  if (!raw || typeof raw !== "object") return [];
  const r = raw as Record<string, unknown>;
  const candidates: Record<string, unknown> = (() => {
    if (r.shares && typeof r.shares === "object") return r.shares as Record<string, unknown>;
    if (r.trafficSources && typeof r.trafficSources === "object") return r.trafficSources as Record<string, unknown>;
    if (r.engagements && typeof r.engagements === "object") {
      const eng = r.engagements as Record<string, unknown>;
      if (eng.trafficSources && typeof eng.trafficSources === "object") {
        return eng.trafficSources as Record<string, unknown>;
      }
    }
    return r;
  })();

  const out: Array<{ name: string; value: number }> = [];
  for (const [k, v] of Object.entries(candidates)) {
    const num = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(num) || num === 0) continue;
    if (typeof v === "object") continue;
    out.push({ name: prettyLabel(k), value: num });
  }
  return out.sort((a, b) => b.value - a.value);
}

function prettyLabel(k: string): string {
  const map: Record<string, string> = {
    direct: "Directo",
    directVisits: "Directo",
    search: "Buscadores",
    searchVisits: "Buscadores",
    organic: "Search orgánico",
    paid: "Search pago",
    social: "Social",
    socialVisits: "Social",
    referrals: "Referrals",
    referralVisits: "Referrals",
    mail: "Mail",
    mailVisits: "Mail",
    display: "Display",
    displayAds: "Display",
  };
  return map[k] ?? k.charAt(0).toUpperCase() + k.slice(1);
}

export interface KeywordRow {
  competidor: string;
  keywords: Array<{ keyword: string; visits: number | null; share: number | null }>;
}

export async function getCompetitorKeywords(topN = 10): Promise<KeywordRow[]> {
  const snap = await getCompetitorWebSnapshot();
  return snap.map((r) => ({
    competidor: r.competidor,
    keywords: parseKeywords(r.keywords_top, topN),
  }));
}

function parseKeywords(
  raw: unknown,
  topN: number,
): Array<{ keyword: string; visits: number | null; share: number | null }> {
  if (!Array.isArray(raw)) return [];
  return (raw as Array<Record<string, unknown>>)
    .map((k) => ({
      keyword: String(k.keyword ?? k.name ?? k.term ?? ""),
      visits: numOrNull(k.visits ?? k.value ?? k.traffic),
      share: numOrNull(k.share ?? k.percent ?? k.percentage),
    }))
    .filter((k) => k.keyword)
    .slice(0, topN);
}

function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// ============================================================================
// Categoría (URL paths) — placeholder hasta tener data
// ============================================================================

export interface CompetitorCategoryRow {
  competidor: string;
  categoria: string;
  url: string;
  visitas_estimadas: number | null;
  fecha: string;
}

export async function getCompetitorByCategoria(): Promise<CompetitorCategoryRow[]> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("competitor_categoria_web")
    .select("competidor, categoria, url, visitas_estimadas, fecha")
    .order("fecha", { ascending: false })
    .returns<CompetitorCategoryRow[]>();
  if (error) {
    // Tabla aún no existe — devolver array vacío para no romper la página
    if (/relation .* does not exist/i.test(error.message)) return [];
    throw new Error(`competitor_categoria_web: ${error.message}`);
  }
  // Quedarse con la última fila por (competidor, categoria)
  const seen = new Set<string>();
  const out: CompetitorCategoryRow[] = [];
  for (const r of data ?? []) {
    const key = `${r.competidor}|${r.categoria}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

// ============================================================================
// Google Trends — placeholder hasta tener data
// ============================================================================

export interface TrendRow {
  fecha: string;
  keyword: string;
  marca: string | null;
  categoria: string | null;
  interes: number;
}

export async function getGoogleTrends(): Promise<TrendRow[]> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("google_trends")
    .select("fecha, keyword, marca, categoria, interes")
    .order("fecha", { ascending: true })
    .returns<TrendRow[]>();
  if (error) {
    if (/relation .* does not exist/i.test(error.message)) return [];
    throw new Error(`google_trends: ${error.message}`);
  }
  return data ?? [];
}
