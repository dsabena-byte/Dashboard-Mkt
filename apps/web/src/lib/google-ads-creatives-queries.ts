import "server-only";
import { getServerSupabase } from "./supabase-server";

// Piezas de Google Ads a nivel ANUNCIO (tabla google_ads_creatives), traídas
// directo de la Google Ads API por el cron google-ads-sync. Profundidad que GA4
// no da: embudo de video (cuartiles) + interacciones por anuncio. Alimenta la
// grilla de piezas Google en /performance.
//
// La tabla es diaria (una fila por fecha+ad_id); acá agregamos por (ad_id, mes):
// sumamos volúmenes y ponderamos la VTR/cuartiles por impresiones.

const MESES_ES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
function mesLabel(fecha: string): string {
  const [y, m] = fecha.split("-");
  return `${MESES_ES[Number(m) - 1] ?? m} ${y}`; // 'YYYY-MM-DD' → 'Julio 2026'
}

export interface GoogleAdsCreativeRow {
  mes: string;                     // derivado de fecha (ej "Julio 2026")
  ad_id: string;
  customer_id: string;
  account_label: string | null;    // Refrigeración | Lavado | Cocción | Search
  campaign_name: string | null;
  campaign_type: string | null;    // DEMAND_GEN | SEARCH | VIDEO | PERFORMANCE_MAX
  ad_name: string | null;
  thumbnail_url: string | null;
  impressions: number;
  clicks: number;
  cost: number;                    // ARS
  interactions: number;
  vtr_p25: number | null;          // fracción 0-1 (ponderada por impresiones de video)
  vtr_p50: number | null;
  vtr_p75: number | null;
  vtr_p100: number | null;
  dias_activos: number;            // días del mes con impresiones > 0 (días reales pautados)
}

interface DbRow {
  fecha: string;
  customer_id: string;
  account_label: string | null;
  campaign_name: string | null;
  campaign_type: string | null;
  ad_id: string;
  ad_name: string | null;
  thumbnail_url: string | null;
  impressions: number | null;
  clicks: number | null;
  cost: string | number | null;
  interactions: number | null;
  vtr_p25: string | number | null;
  vtr_p50: string | number | null;
  vtr_p75: string | number | null;
  vtr_p100: string | number | null;
}

const num = (v: string | number | null | undefined): number => {
  if (v == null) return 0;
  return typeof v === "number" ? v : Number(v) || 0;
};

interface Agg {
  mes: string;
  ad_id: string;
  customer_id: string;
  account_label: string | null;
  campaign_name: string | null;
  campaign_type: string | null;
  ad_name: string | null;
  thumbnail_url: string | null;
  impressions: number;
  clicks: number;
  cost: number;
  interactions: number;
  // Ponderación de cuartiles: acumulamos (rate × impresiones) y las impresiones
  // de las filas que tienen video, para el promedio ponderado.
  q25: number; q50: number; q75: number; q100: number; qImpr: number;
  dias: Set<string>; // fechas distintas con impresiones > 0
}

export async function getGoogleAdsCreatives(): Promise<GoogleAdsCreativeRow[]> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("google_ads_creatives")
    .select("fecha, customer_id, account_label, campaign_name, campaign_type, ad_id, ad_name, thumbnail_url, impressions, clicks, cost, interactions, vtr_p25, vtr_p50, vtr_p75, vtr_p100")
    .order("fecha", { ascending: false })
    .limit(50000)
    .returns<DbRow[]>();
  if (error) throw new Error(`google_ads_creatives: ${error.message}`);

  const acc = new Map<string, Agg>();
  for (const r of data ?? []) {
    const mes = mesLabel(r.fecha);
    const key = `${r.ad_id}|${mes}`;
    const impr = num(r.impressions);
    let a = acc.get(key);
    if (!a) {
      a = {
        mes, ad_id: r.ad_id, customer_id: r.customer_id, account_label: r.account_label,
        campaign_name: r.campaign_name, campaign_type: r.campaign_type, ad_name: r.ad_name,
        thumbnail_url: r.thumbnail_url,
        impressions: 0, clicks: 0, cost: 0, interactions: 0,
        q25: 0, q50: 0, q75: 0, q100: 0, qImpr: 0,
        dias: new Set<string>(),
      };
      acc.set(key, a);
    }
    if (impr > 0) a.dias.add(r.fecha); // día real con entrega
    a.impressions += impr;
    a.clicks += num(r.clicks);
    a.cost += num(r.cost);
    a.interactions += num(r.interactions);
    if (!a.thumbnail_url && r.thumbnail_url) a.thumbnail_url = r.thumbnail_url;
    // Solo sumamos al embudo de video las filas que REALMENTE son de video
    // (cuartil >0). Los ads de imagen/Search guardan 0 (no null) por el coerce del
    // sync; si los contáramos, diluirían el embudo y mostrarían "VTR 0%" de más.
    if (num(r.vtr_p25) > 0) {
      a.q25 += num(r.vtr_p25) * impr;
      a.q50 += num(r.vtr_p50) * impr;
      a.q75 += num(r.vtr_p75) * impr;
      a.q100 += num(r.vtr_p100) * impr;
      a.qImpr += impr;
    }
  }

  return [...acc.values()]
    .map((a): GoogleAdsCreativeRow => ({
      mes: a.mes, ad_id: a.ad_id, customer_id: a.customer_id, account_label: a.account_label,
      campaign_name: a.campaign_name, campaign_type: a.campaign_type, ad_name: a.ad_name,
      thumbnail_url: a.thumbnail_url,
      impressions: a.impressions, clicks: a.clicks, cost: a.cost, interactions: a.interactions,
      vtr_p25: a.qImpr > 0 ? a.q25 / a.qImpr : null,
      vtr_p50: a.qImpr > 0 ? a.q50 / a.qImpr : null,
      vtr_p75: a.qImpr > 0 ? a.q75 / a.qImpr : null,
      vtr_p100: a.qImpr > 0 ? a.q100 / a.qImpr : null,
      dias_activos: a.dias.size,
    }))
    .sort((x, y) => y.cost - x.cost);
}
