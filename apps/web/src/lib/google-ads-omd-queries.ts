import "server-only";
import { getServerSupabase } from "./supabase-server";

// Inversión de Google Ads de OMD Marketing (Demand Gen + Search), traída por GA4
// a `ga4_google_ads_daily`. Se EXCLUYE el ecommerce (campañas `inhouse_*` de la
// cuenta "Drean Argentina"), que es performance, no marketing de OMD.
//
// - categoría: se deriva de la cuenta (Lavado/Refrigeración/Cocción) o, para la
//   cuenta "Search", del nombre de campaña ("Search | Refrigeración_...").
// - canal: del campaign_type (Demand Gen / Search).

export interface GoogleAdsOmdRow {
  mes: string; // "Julio 2026" (mismo formato que pauta_performance para el filtro)
  categoria: string; // Lavado | Refrigeración | Cocción | Otros
  canal: string; // Google Demand Gen | Google Search
  costo: number;
  impresiones: number;
  clicks: number;
}

const MES_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function mesLabel(fecha: string): string {
  const [y, m] = fecha.split("-");
  return `${MES_NAMES[parseInt(m ?? "1", 10) - 1] ?? m} ${y}`;
}

function categoriaDe(account: string, campaign: string): string {
  const s = `${account} ${campaign}`.toLowerCase();
  if (/refriger|heladera/.test(s)) return "Refrigeración";
  if (/lavado|lavarrop|lavaseca|secarrop/.test(s)) return "Lavado";
  if (/cocc|cocina|coccion|cocción|anafe|horno/.test(s)) return "Cocción";
  return "Otros";
}

function canalDe(campaignType: string | null): string {
  const t = (campaignType ?? "").toLowerCase();
  if (t.includes("demand")) return "Google Demand Gen";
  if (t.includes("search")) return "Google Search";
  if (t.includes("video")) return "Google Video";
  if (t.includes("performance")) return "Google PMax";
  return `Google ${campaignType ?? "Ads"}`;
}

export async function getGoogleAdsOmd(): Promise<GoogleAdsOmdRow[]> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("ga4_google_ads_daily")
    .select("fecha, campaign_name, campaign_type, account_name, cost, impressions, clicks")
    .not("campaign_name", "ilike", "inhouse%") // excluir ecommerce
    .limit(20000);
  if (error) {
    console.error("[google-ads-omd] getGoogleAdsOmd:", error.message);
    return [];
  }
  type Row = { fecha: string | null; campaign_name: string | null; campaign_type: string | null; account_name: string | null; cost: number | null; impressions: number | null; clicks: number | null };
  const rows = (data ?? []) as unknown as Row[];

  const agg = new Map<string, GoogleAdsOmdRow>();
  for (const r of rows) {
    if (!r.fecha) continue;
    const mes = mesLabel(r.fecha);
    const categoria = categoriaDe(r.account_name ?? "", r.campaign_name ?? "");
    const canal = canalDe(r.campaign_type);
    const key = `${mes}|${categoria}|${canal}`;
    const a = agg.get(key) ?? { mes, categoria, canal, costo: 0, impresiones: 0, clicks: 0 };
    a.costo += Number(r.cost ?? 0);
    a.impresiones += Number(r.impressions ?? 0);
    a.clicks += Number(r.clicks ?? 0);
    agg.set(key, a);
  }
  return [...agg.values()].map((a) => ({ ...a, costo: Math.round(a.costo) }));
}
