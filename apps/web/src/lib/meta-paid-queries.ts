import "server-only";
import { getServerSupabase } from "./supabase-server";

export interface MetaPaidCreativeRow {
  ad_id: string;
  mes: string;
  plataforma: string;
  campaign_name: string | null;
  adset_name: string | null;
  ad_name: string | null;
  objective: string | null;
  categoria: string | null;
  tipo_compra: string | null;
  source: string;
  thumbnail_url: string | null;
  image_url: string | null;
  body: string | null;
  permalink_url: string | null;
  impresiones: number;
  alcance: number;
  frecuencia: number | null;
  clicks: number;
  spend: number;
  ctr: number | null;
  cpm: number | null;
  cpc: number | null;
  views_total: number | null;
  views_completed: number | null;
  vtr: number | null;
}

interface DbRow {
  ad_id: string;
  mes: string;
  plataforma: string | null;
  campaign_name: string | null;
  adset_name: string | null;
  ad_name: string | null;
  objective: string | null;
  categoria: string | null;
  tipo_compra: string | null;
  source: string | null;
  thumbnail_url: string | null;
  image_url: string | null;
  body: string | null;
  permalink_url: string | null;
  impresiones: number | null;
  alcance: number | null;
  frecuencia: string | number | null;
  clicks: number | null;
  spend: string | number | null;
  ctr: string | number | null;
  cpm: string | number | null;
  cpc: string | number | null;
  views_total: number | null;
  views_completed: number | null;
  vtr: string | number | null;
}

const num = (v: string | number | null): number | null =>
  v == null ? null : typeof v === "number" ? v : Number(v);

function mapRow(r: DbRow): MetaPaidCreativeRow {
  return {
    ad_id: r.ad_id,
    mes: r.mes,
    plataforma: r.plataforma ?? "meta",
    campaign_name: r.campaign_name,
    adset_name: r.adset_name,
    ad_name: r.ad_name,
    objective: r.objective,
    categoria: r.categoria,
    tipo_compra: r.tipo_compra,
    source: r.source ?? "graph_api",
    thumbnail_url: r.thumbnail_url,
    image_url: r.image_url,
    body: r.body,
    permalink_url: r.permalink_url,
    impresiones: r.impresiones ?? 0,
    alcance: r.alcance ?? 0,
    frecuencia: num(r.frecuencia),
    clicks: r.clicks ?? 0,
    spend: num(r.spend) ?? 0,
    ctr: num(r.ctr),
    cpm: num(r.cpm),
    cpc: num(r.cpc),
    views_total: r.views_total,
    views_completed: r.views_completed,
    vtr: num(r.vtr),
  };
}

export async function getMetaPaidCreatives(): Promise<MetaPaidCreativeRow[]> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("meta_paid_creatives")
    .select(
      "ad_id, mes, plataforma, campaign_name, adset_name, ad_name, objective, categoria, tipo_compra, source, thumbnail_url, image_url, body, permalink_url, impresiones, alcance, frecuencia, clicks, spend, ctr, cpm, cpc, views_total, views_completed, vtr",
    )
    .order("spend", { ascending: false })
    .returns<DbRow[]>();
  if (error) throw new Error(`meta_paid_creatives: ${error.message}`);
  return (data ?? []).map(mapRow);
}
