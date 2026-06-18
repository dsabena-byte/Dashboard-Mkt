import "server-only";
import { getServerSupabase } from "./supabase-server";
import type { ConversionDailyRow, ConversionItemRow } from "./pauta-conversion-data";

const num = (v: string | number | null | undefined): number =>
  v == null ? 0 : typeof v === "number" ? v : Number(v);

// Solo mostramos data con período completo (revenue + inversión). El backfill
// arrancó en 2026; nov/dic 2025 quedaron sin esas columnas, así que los dejamos
// afuera del dashboard de conversión.
const START_DATE = "2026-01-01";

interface TrafficRaw {
  fecha: string;
  utm_campaign: string | null;
  sesiones: number | null;
  usuarios: number | null;
  usuarios_nuevos: number | null;
  bounce_rate: number | null;
  pageviews: number | null;
}
interface PurchaseRaw {
  fecha: string;
  utm_campaign: string | null;
  purchases: number | null;
  revenue: string | number | null;
}
interface CostRaw {
  fecha: string;
  utm_campaign: string | null;
  cost: string | number | null;
  ad_clicks: number | null;
  ad_impressions: number | null;
}

interface Acc {
  sesiones: number; usuarios: number; usuarios_nuevos: number; pageviews: number;
  bounceNum: number; bounceDen: number;
  transacciones: number; ingresos: number;
  costo: number; ad_clicks: number; ad_impresiones: number;
}

/**
 * Trae la data diaria por campaña de la pauta de conversión (inhouse_*),
 * mergeando web_traffic + ga4_purchases_daily + ga4_ads_cost_daily por
 * (fecha, campaña). El revenue y la inversión pueden no estar todavía (revenue
 * recién con el cron actualizado; inversión cuando Google Ads esté vinculado a
 * GA4) — en ese caso quedan en 0 y los KPIs de eficiencia se muestran pendientes.
 */
export async function getConversionDaily(): Promise<ConversionDailyRow[]> {
  const supabase = getServerSupabase();

  const trafficRes = await supabase
    .from("web_traffic")
    .select("fecha, utm_campaign, sesiones, usuarios, usuarios_nuevos, bounce_rate, pageviews")
    .ilike("utm_campaign", "inhouse%")
    .gte("fecha", START_DATE)
    .range(0, 199_999)
    .returns<TrafficRaw[]>();
  if (trafficRes.error) throw new Error(`web_traffic (conversion): ${trafficRes.error.message}`);

  const purchasesRes = await supabase
    .from("ga4_purchases_daily")
    .select("fecha, utm_campaign, purchases, revenue")
    .ilike("utm_campaign", "inhouse%")
    .gte("fecha", START_DATE)
    .range(0, 199_999)
    .returns<PurchaseRaw[]>();
  // revenue puede no existir aún (migración 0063 sin aplicar) → reintentar sin esa col
  let purchases: PurchaseRaw[] = [];
  if (purchasesRes.error) {
    if (/revenue/i.test(purchasesRes.error.message)) {
      const retry = await supabase
        .from("ga4_purchases_daily")
        .select("fecha, utm_campaign, purchases")
        .ilike("utm_campaign", "inhouse%")
        .gte("fecha", START_DATE)
        .range(0, 199_999)
        .returns<PurchaseRaw[]>();
      if (!retry.error) purchases = retry.data ?? [];
    } else if (!/does not exist|relation .* does not exist/i.test(purchasesRes.error.message)) {
      throw new Error(`ga4_purchases_daily (conversion): ${purchasesRes.error.message}`);
    }
  } else {
    purchases = purchasesRes.data ?? [];
  }

  // Costo: la tabla puede no existir todavía → tolerar.
  let cost: CostRaw[] = [];
  const costRes = await supabase
    .from("ga4_ads_cost_daily")
    .select("fecha, utm_campaign, cost, ad_clicks, ad_impressions")
    .ilike("utm_campaign", "inhouse%")
    .gte("fecha", START_DATE)
    .range(0, 199_999)
    .returns<CostRaw[]>();
  if (costRes.error) {
    if (!/does not exist|relation .* does not exist/i.test(costRes.error.message)) {
      throw new Error(`ga4_ads_cost_daily (conversion): ${costRes.error.message}`);
    }
  } else {
    cost = costRes.data ?? [];
  }

  const map = new Map<string, Acc>();
  const key = (fecha: string, campaign: string) => `${fecha}|${campaign}`;
  const get = (fecha: string, campaign: string): Acc => {
    const k = key(fecha, campaign);
    let e = map.get(k);
    if (!e) {
      e = { sesiones: 0, usuarios: 0, usuarios_nuevos: 0, pageviews: 0, bounceNum: 0, bounceDen: 0, transacciones: 0, ingresos: 0, costo: 0, ad_clicks: 0, ad_impresiones: 0 };
      map.set(k, e);
    }
    return e;
  };

  for (const r of trafficRes.data ?? []) {
    if (!r.utm_campaign) continue;
    const e = get(r.fecha, r.utm_campaign);
    const ses = num(r.sesiones);
    e.sesiones += ses;
    e.usuarios += num(r.usuarios);
    e.usuarios_nuevos += num(r.usuarios_nuevos);
    e.pageviews += num(r.pageviews);
    if (r.bounce_rate != null && ses > 0) {
      e.bounceNum += r.bounce_rate * ses;
      e.bounceDen += ses;
    }
  }
  for (const r of purchases) {
    if (!r.utm_campaign) continue;
    const e = get(r.fecha, r.utm_campaign);
    e.transacciones += num(r.purchases);
    e.ingresos += num(r.revenue);
  }
  for (const r of cost) {
    if (!r.utm_campaign) continue;
    const e = get(r.fecha, r.utm_campaign);
    e.costo += num(r.cost);
    e.ad_clicks += num(r.ad_clicks);
    e.ad_impresiones += num(r.ad_impressions);
  }

  return [...map.entries()].map(([k, e]) => {
    const [fecha, campaign] = k.split("|");
    return {
      fecha: fecha ?? "",
      campaign: campaign ?? "",
      sesiones: e.sesiones,
      usuarios: e.usuarios,
      usuarios_nuevos: e.usuarios_nuevos,
      bounce_rate: e.bounceDen > 0 ? e.bounceNum / e.bounceDen : null,
      pageviews: e.pageviews,
      transacciones: e.transacciones,
      ingresos: e.ingresos,
      costo: e.costo,
      ad_clicks: e.ad_clicks,
      ad_impresiones: e.ad_impresiones,
    };
  });
}

interface ItemRaw {
  fecha: string;
  utm_campaign: string | null;
  item_name: string | null;
  items_purchased: number | null;
  item_revenue: string | number | null;
}

/**
 * Productos comprados por las campañas inhouse_* (GA4 itemsPurchased/itemRevenue).
 * La tabla puede no existir todavía (migración 0064) o estar vacía (falta correr
 * el cron) → devuelve [] y el dashboard muestra el ranking pendiente.
 */
export async function getConversionItems(): Promise<ConversionItemRow[]> {
  const supabase = getServerSupabase();
  const res = await supabase
    .from("ga4_items_daily")
    .select("fecha, utm_campaign, item_name, items_purchased, item_revenue")
    .ilike("utm_campaign", "inhouse%")
    .gte("fecha", START_DATE)
    .range(0, 199_999)
    .returns<ItemRaw[]>();
  if (res.error) {
    if (/does not exist|relation .* does not exist/i.test(res.error.message)) return [];
    throw new Error(`ga4_items_daily (conversion): ${res.error.message}`);
  }
  return (res.data ?? [])
    .filter((r) => r.item_name)
    .map((r) => ({
      fecha: r.fecha,
      campaign: r.utm_campaign ?? "",
      item_name: r.item_name ?? "",
      items_purchased: num(r.items_purchased),
      item_revenue: num(r.item_revenue),
    }));
}
