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
