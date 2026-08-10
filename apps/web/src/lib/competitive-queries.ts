import "server-only";
import { getServerSupabase } from "./supabase-server";

// Lecturas para el dashboard "Análisis SEO / Search" (Módulo A · demanda).
// Fuente: search_volume + trends_interest + vw_share_of_search (poblados por
// trends-sync desde DataForSEO).

export interface ShareRow {
  categoria: string;
  marca: string;
  mes: string;       // YYYY-MM-DD (primer día del mes)
  vol: number;
  share_pct: number;
}

export interface TrendRow {
  categoria: string;
  marca: string;
  fecha: string;     // inicio de semana
  interes: number;   // 0-100
}

export interface DemandaRow {
  categoria: string;
  mes: string;
  search_volume: number | null;
}

const num = (v: unknown): number => (v == null ? 0 : typeof v === "number" ? v : Number(v) || 0);

export async function getShareOfSearch(): Promise<ShareRow[]> {
  const sb = getServerSupabase();
  const { data, error } = await sb
    .from("vw_share_of_search")
    .select("categoria, marca, mes, vol, share_pct")
    .order("mes", { ascending: true })
    .returns<ShareRow[]>();
  if (error) throw new Error(`vw_share_of_search: ${error.message}`);
  return (data ?? []).map((r) => ({ ...r, vol: num(r.vol), share_pct: num(r.share_pct) }));
}

export async function getTrendsInterest(): Promise<TrendRow[]> {
  const sb = getServerSupabase();
  const { data, error } = await sb
    .from("trends_interest")
    .select("categoria, marca, fecha, interes")
    .not("marca", "is", null)
    .order("fecha", { ascending: true })
    .limit(20000)
    .returns<TrendRow[]>();
  if (error) throw new Error(`trends_interest: ${error.message}`);
  return ((data ?? []) as TrendRow[]).map((r) => ({ ...r, interes: num(r.interes) }));
}

// ===== Módulo B · SEO =====
export interface SeoOverviewRow {
  dominio: string;
  marca: string | null;
  keywords_count: number | null;
  pos_1_3: number | null;
  pos_4_10: number | null;
  etv: number | null;
  fecha: string;
}
export interface KeywordGapRow {
  keyword: string;
  competidor: string;
  categoria: string | null;
  pos_competidor: number | null;
  search_volume: number | null;
}

export async function getSeoOverview(): Promise<SeoOverviewRow[]> {
  const sb = getServerSupabase();
  const { data, error } = await sb
    .from("seo_domain_overview")
    .select("dominio, marca, keywords_count, pos_1_3, pos_4_10, etv, fecha")
    .order("etv", { ascending: false })
    .returns<SeoOverviewRow[]>();
  if (error) throw new Error(`seo_domain_overview: ${error.message}`);
  return (data ?? []) as SeoOverviewRow[];
}

// Matriz competitiva de SEO: posición de cada dominio (marca + retailer) en cada
// keyword del universo. Alimenta el índice conglomerado + buckets.
export interface SerpRow {
  marca: string;
  keyword: string;
  categoria: string | null;
  posicion: number | null;
  search_volume: number | null;
}
export async function getSeoCompetitivo(): Promise<SerpRow[]> {
  const sb = getServerSupabase();
  const { data, error } = await sb
    .from("seo_rankings")
    .select("marca, keyword, categoria, posicion, search_volume")
    .limit(20000)
    .returns<SerpRow[]>();
  if (error) throw new Error(`seo_rankings: ${error.message}`);
  return (data ?? []) as SerpRow[];
}

export interface RankingRow {
  keyword: string;
  categoria: string | null;
  posicion: number | null;
  search_volume: number | null;
  url: string | null;
}
export async function getDreanRankings(): Promise<RankingRow[]> {
  const sb = getServerSupabase();
  const { data, error } = await sb
    .from("seo_rankings")
    .select("keyword, categoria, posicion, search_volume, url")
    .eq("dominio", "drean.com.ar")
    .order("search_volume", { ascending: false })
    .limit(500)
    .returns<RankingRow[]>();
  if (error) throw new Error(`seo_rankings: ${error.message}`);
  return (data ?? []) as RankingRow[];
}

export async function getKeywordGap(): Promise<KeywordGapRow[]> {
  const sb = getServerSupabase();
  const { data, error } = await sb
    .from("seo_keyword_gap")
    .select("keyword, competidor, categoria, pos_competidor, search_volume")
    .order("search_volume", { ascending: false })
    .limit(200)
    .returns<KeywordGapRow[]>();
  if (error) throw new Error(`seo_keyword_gap: ${error.message}`);
  return (data ?? []) as KeywordGapRow[];
}

// Interés de búsqueda por provincia (para el mapa).
export interface RegionRow {
  marca: string;
  categoria: string;
  provincia: string;
  interes: number | null;
}
export async function getSearchRegion(): Promise<RegionRow[]> {
  const sb = getServerSupabase();
  const { data, error } = await sb
    .from("search_region")
    .select("marca, categoria, provincia, interes")
    .limit(5000)
    .returns<RegionRow[]>();
  if (error) throw new Error(`search_region: ${error.message}`);
  return (data ?? []) as RegionRow[];
}

// Histórico mensual del índice de posición conglomerado por marca × categoría.
export interface SeoIndexHistRow {
  categoria: string;
  marca: string;
  mes: string;      // YYYY-MM-DD (primer día del mes)
  indice: number;
}
export async function getSeoIndexHistory(): Promise<SeoIndexHistRow[]> {
  const sb = getServerSupabase();
  const { data, error } = await sb
    .from("seo_index_history")
    .select("categoria, marca, mes, indice")
    .order("mes", { ascending: true })
    .limit(5000)
    .returns<SeoIndexHistRow[]>();
  if (error) throw new Error(`seo_index_history: ${error.message}`);
  return ((data ?? []) as SeoIndexHistRow[]).map((r) => ({ ...r, indice: num(r.indice) }));
}

// LLMO — visibilidad de marca en respuestas de LLM (share of model) por categoría.
export interface LlmoRow {
  categoria: string;
  marca: string;
  mes: string;
  menciones: number;
  prompts: number;
  share_pct: number;
  rank_prom: number | null;
}
export async function getLlmo(): Promise<LlmoRow[]> {
  const sb = getServerSupabase();
  const { data, error } = await sb
    .from("seo_llmo")
    .select("categoria, marca, mes, menciones, prompts, share_pct, rank_prom")
    .order("mes", { ascending: true })
    .limit(5000)
    .returns<LlmoRow[]>();
  if (error) throw new Error(`seo_llmo: ${error.message}`);
  return ((data ?? []) as LlmoRow[]).map((r) => ({
    ...r,
    menciones: num(r.menciones),
    prompts: num(r.prompts),
    share_pct: num(r.share_pct),
    rank_prom: r.rank_prom == null ? null : num(r.rank_prom),
  }));
}

// Última actualización de cada fuente del dashboard SEO / Search.
export interface SeoFreshness {
  demanda: string | null; // search_volume (Share of Search + demanda)
  trends: string | null;  // trends_interest
  serp: string | null;    // seo_rankings (posición / SEO competitivo)
  region: string | null;  // search_region (mapa por provincia)
  indice: string | null;  // seo_index_history (histórico del índice)
  llmo: string | null;    // seo_llmo (visibilidad en IA)
}
async function ultimaFecha(tabla: string, col: string): Promise<string | null> {
  const sb = getServerSupabase();
  const { data, error } = await sb
    .from(tabla as never)
    .select(col)
    .order(col, { ascending: false })
    .limit(1)
    .returns<Array<Record<string, string | null>>>();
  if (error || !data || data.length === 0) return null;
  return data[0]?.[col] ?? null;
}
export async function getSeoFreshness(): Promise<SeoFreshness> {
  const [demanda, trends, serp, region, indice, llmo] = await Promise.all([
    ultimaFecha("search_volume", "fetched_at").catch(() => null),
    ultimaFecha("trends_interest", "fetched_at").catch(() => null),
    ultimaFecha("seo_rankings", "fetched_at").catch(() => null),
    ultimaFecha("search_region", "fetched_at").catch(() => null),
    ultimaFecha("seo_index_history", "updated_at").catch(() => null),
    ultimaFecha("seo_llmo", "updated_at").catch(() => null),
  ]);
  return { demanda, trends, serp, region, indice, llmo };
}

// Demanda genérica de la categoría (keyword genérica, sin marca) por mes.
export async function getDemandaGenerica(): Promise<DemandaRow[]> {
  const sb = getServerSupabase();
  const { data, error } = await sb
    .from("search_volume")
    .select("categoria, mes, search_volume")
    .eq("generico", true)
    .order("mes", { ascending: true })
    .returns<DemandaRow[]>();
  if (error) throw new Error(`search_volume: ${error.message}`);
  return data ?? [];
}
