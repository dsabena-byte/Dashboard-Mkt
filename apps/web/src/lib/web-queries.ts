import "server-only";
import { getServerSupabase } from "./supabase-server";

export interface DailyKpiRow {
  fecha: string;
  sesiones: number;
  usuarios: number;
  usuarios_nuevos: number;
  conversiones: number;
  eventos_clave: number;
  pageviews: number;
  bounce_rate: number | null;
  avg_session_duration: number | null;
}

export interface BySourceRow {
  fecha: string;
  source: string;
  medium: string;
  canal: string;
  sesiones: number;
  conversiones: number;
  pageviews: number;
}

export interface MonthlyByChannelRow {
  mes: string;
  canal: string;
  sesiones: number;
  conversiones: number;
  pageviews: number;
}

export interface ByCategoryRow {
  fecha: string;
  categoria: string;
  sesiones: number;
  conversiones: number;
  pageviews: number;
  bounce_rate: number | null;
}

export interface TopLandingRow {
  landing_page: string;
  sesiones: number;
  conversiones: number;
  pageviews: number;
  conversion_rate: number | null;
  bounce_rate: number | null;
  ultima_fecha: string;
}

export interface TopProductRow {
  landing_page: string;
  sku: string | null;
  producto_slug: string | null;
  categoria: string;
  sesiones: number;
  conversiones: number;
  pageviews: number;
  conversion_rate: number | null;
  ultima_fecha: string;
}

export interface WebRange {
  from: string;       // YYYY-MM-DD
  to: string;
}

/**
 * Clasifica un row de web_traffic en canal "amigable" — replica el CASE WHEN
 * de vw_drean_web_by_source en JS para evitar regex chain server-side caro.
 */
function classifyCanal(src: string, med: string, camp: string): string {
  const SEARCH_ENGINES = /(google|bing|yahoo|duckduckgo|yandex|baidu|ecosia|ask)/;
  const SOCIAL = /(facebook|instagram|twitter|x\.com|linkedin|tiktok|pinterest|snapchat|reddit|fb\.com|fb\.me|ig\.com|meta)/;
  const VIDEO = /(youtube|vimeo|twitch)/;
  const PAID_MED = /(cpc|ppc|paid|paidsearch|paid_search|sem)/;
  const PAID_SOCIAL_MED = /(cpc|ppc|paid|cpm|cpv|paid_social|paidsocial|paid.social|social.paid)/;
  const MAIL = /mail|email|mailchimp|sendgrid|hubspot|klaviyo/;

  if (/cross.?network|crossnetwork|^pmax|performance.?max/.test(camp)) return "Cross-network";
  if (SEARCH_ENGINES.test(src) && !/shopping/.test(src) && PAID_MED.test(med)) return "Paid Search";
  if (SEARCH_ENGINES.test(src) && (med === "organic" || med === "")) return "Organic Search";
  if (SOCIAL.test(src) && PAID_SOCIAL_MED.test(med)) return "Paid Social";
  if (SOCIAL.test(src)) return "Organic Social";
  if (med === "email" || MAIL.test(src)) return "Email";
  if (/^(display|banner|expandable|interstitial|cpm|cpa)$/.test(med)) return "Display";
  if (VIDEO.test(src) && /(cpv|paid|cpc)/.test(med)) return "Paid Video";
  if (VIDEO.test(src)) return "Organic Video";
  if (med === "referral") return "Referral";
  if (/^(affiliate|affiliates)$/.test(med)) return "Affiliates";
  if ((src === "" || src === "(direct)") && (med === "" || med === "(none)" || med === "(not set)")) return "Direct";
  if (/(cpc|ppc|paid|cpm|cpa)/.test(med)) return "Paid Other";
  if (med === "organic") return "Organic Search";
  return "Unassigned";
}

interface RawWebTrafficRow {
  fecha: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  landing_page: string | null;
  sesiones: number;
  usuarios: number;
  usuarios_nuevos: number;
  conversiones: number;
  eventos_clave: number;
  bounce_rate: number | null;
  avg_session_duration: number | null;
  pageviews: number;
}

/**
 * Trae raw rows de web_traffic filtrando smartup_tiktok. Bypassea la cadena de
 * views (vw_drean_web_traffic_with_purchases → ...) que hace JOIN caro con
 * ga4_purchases_daily y revienta con statement_timeout en rangos largos.
 *
 * Trade-off: perdemos purchase attribution (usamos conversiones GA4 raw).
 */
async function fetchRawWebTraffic(range: WebRange): Promise<RawWebTrafficRow[]> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("web_traffic")
    .select("fecha, utm_source, utm_medium, utm_campaign, landing_page, sesiones, usuarios, usuarios_nuevos, conversiones, eventos_clave, bounce_rate, avg_session_duration, pageviews")
    .gte("fecha", range.from)
    .lte("fecha", range.to)
    .range(0, 199_999)
    .returns<RawWebTrafficRow[]>();
  if (error) throw new Error(`web_traffic: ${error.message}`);
  const rows = data ?? [];
  // Excluir smartup_tiktok_% (bot traffic con bounce <0.5%)
  return rows.filter((r) => !((r.utm_campaign ?? "").toLowerCase().startsWith("smartup_tiktok_")));
}

export async function getWebDailyKpis(range: WebRange): Promise<DailyKpiRow[]> {
  const raw = await fetchRawWebTraffic(range);
  const byFecha = new Map<string, {
    sesiones: number; usuarios: number; usuarios_nuevos: number;
    conversiones: number; eventos_clave: number; pageviews: number;
    bounceNum: number; bounceDenom: number;
    durNum: number; durDenom: number;
  }>();
  for (const r of raw) {
    const acc = byFecha.get(r.fecha) ?? {
      sesiones: 0, usuarios: 0, usuarios_nuevos: 0,
      conversiones: 0, eventos_clave: 0, pageviews: 0,
      bounceNum: 0, bounceDenom: 0, durNum: 0, durDenom: 0,
    };
    acc.sesiones += r.sesiones ?? 0;
    acc.usuarios += r.usuarios ?? 0;
    acc.usuarios_nuevos += r.usuarios_nuevos ?? 0;
    acc.conversiones += r.conversiones ?? 0;
    acc.eventos_clave += r.eventos_clave ?? 0;
    acc.pageviews += r.pageviews ?? 0;
    if (r.bounce_rate !== null && r.sesiones > 0) {
      acc.bounceNum += r.bounce_rate * r.sesiones;
      acc.bounceDenom += r.sesiones;
    }
    if (r.avg_session_duration !== null && r.sesiones > 0) {
      acc.durNum += r.avg_session_duration * r.sesiones;
      acc.durDenom += r.sesiones;
    }
    byFecha.set(r.fecha, acc);
  }
  return [...byFecha.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([fecha, v]) => ({
      fecha,
      sesiones: v.sesiones,
      usuarios: v.usuarios,
      usuarios_nuevos: v.usuarios_nuevos,
      conversiones: v.conversiones,
      eventos_clave: v.eventos_clave,
      pageviews: v.pageviews,
      bounce_rate: v.bounceDenom > 0 ? v.bounceNum / v.bounceDenom : null,
      avg_session_duration: v.durDenom > 0 ? v.durNum / v.durDenom : null,
    }));
}

export async function getWebBySource(range: WebRange): Promise<BySourceRow[]> {
  const raw = await fetchRawWebTraffic(range);
  const map = new Map<string, BySourceRow>();
  for (const r of raw) {
    const srcRaw = r.utm_source ?? "";
    const medRaw = r.utm_medium ?? "";
    const source = srcRaw || "(direct)";
    const medium = medRaw || "(none)";
    const canal = classifyCanal(srcRaw.toLowerCase(), medRaw.toLowerCase(), (r.utm_campaign ?? "").toLowerCase());
    const key = `${r.fecha}|${source}|${medium}|${canal}`;
    const acc = map.get(key) ?? {
      fecha: r.fecha, source, medium, canal,
      sesiones: 0, conversiones: 0, pageviews: 0,
    };
    acc.sesiones += r.sesiones ?? 0;
    acc.conversiones += r.conversiones ?? 0;
    acc.pageviews += r.pageviews ?? 0;
    map.set(key, acc);
  }
  return [...map.values()];
}

function classifyCategoria(landingPage: string): string {
  const lp = landingPage.toLowerCase();
  if (/(lavado|lavarropas|\/c\/15)/.test(lp)) return "Lavado";
  if (/(heladera|refriger|freezer|\/c\/9)/.test(lp)) return "Refrigeración";
  if (/(cocci|cocina|\/c\/1$|\/c\/1\/|\/c\/1\?)/.test(lp)) return "Cocinas";
  return "Otros / Home";
}

export async function getWebByCategory(range: WebRange): Promise<ByCategoryRow[]> {
  const raw = await fetchRawWebTraffic(range);
  const map = new Map<string, {
    sesiones: number; conversiones: number; pageviews: number;
    bounceNum: number; bounceDenom: number;
  }>();
  for (const r of raw) {
    const categoria = classifyCategoria(r.landing_page ?? "");
    const key = `${r.fecha}|${categoria}`;
    const acc = map.get(key) ?? {
      sesiones: 0, conversiones: 0, pageviews: 0, bounceNum: 0, bounceDenom: 0,
    };
    acc.sesiones += r.sesiones ?? 0;
    acc.conversiones += r.conversiones ?? 0;
    acc.pageviews += r.pageviews ?? 0;
    if (r.bounce_rate !== null && r.sesiones > 0) {
      acc.bounceNum += r.bounce_rate * r.sesiones;
      acc.bounceDenom += r.sesiones;
    }
    map.set(key, acc);
  }
  return [...map.entries()].map(([key, v]) => {
    const [fecha, categoria] = key.split("|");
    return {
      fecha: fecha!,
      categoria: categoria!,
      sesiones: v.sesiones,
      conversiones: v.conversiones,
      pageviews: v.pageviews,
      bounce_rate: v.bounceDenom > 0 ? v.bounceNum / v.bounceDenom : null,
    };
  });
}

export interface MonthlyUsersRow {
  mes: string;
  total_users: number;
  new_users: number;
  sesiones?: number;
  pageviews?: number;
}

export interface SmartupMonthlyRow {
  mes: string;
  sesiones: number;
  usuarios: number;
}

/**
 * Sesiones/usuarios de campañas Smartup agregados por mes (desde web_traffic).
 * Se usa para restar de los valores de ga4_monthly_users (cargados sin filtrar
 * Smartup desde GA4 API). Si web_traffic no tiene datos del mes, devuelve 0 y
 * la resta es no-op.
 */
export async function getSmartupMonthlyAggregates(): Promise<SmartupMonthlyRow[]> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("vw_drean_web_smartup_traffic")
    .select("fecha, sesiones, usuarios")
    .range(0, 99_999)
    .returns<Array<{ fecha: string; sesiones: number; usuarios: number }>>();
  if (error) {
    if (/relation .* does not exist/i.test(error.message)) return [];
    throw new Error(`vw_drean_web_smartup_traffic: ${error.message}`);
  }
  const map = new Map<string, { sesiones: number; usuarios: number }>();
  for (const r of data ?? []) {
    const mes = r.fecha.slice(0, 7) + "-01";
    const acc = map.get(mes) ?? { sesiones: 0, usuarios: 0 };
    acc.sesiones += r.sesiones ?? 0;
    acc.usuarios += r.usuarios ?? 0;
    map.set(mes, acc);
  }
  return [...map.entries()].map(([mes, v]) => ({ mes, ...v }));
}

export async function getAllMonthlyUsers(): Promise<MonthlyUsersRow[]> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("ga4_monthly_users")
    .select("mes, total_users, new_users, sesiones, pageviews")
    .order("mes", { ascending: true })
    .returns<MonthlyUsersRow[]>();
  if (error) {
    if (/relation .* does not exist/i.test(error.message)) return [];
    throw new Error(`ga4_monthly_users: ${error.message}`);
  }
  return data ?? [];
}

export async function getMonthlyUsers(monthStart: string): Promise<MonthlyUsersRow | null> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("ga4_monthly_users")
    .select("mes, total_users, new_users")
    .eq("mes", monthStart)
    .maybeSingle()
    .returns<MonthlyUsersRow | null>();
  if (error) {
    if (/relation .* does not exist/i.test(error.message)) return null;
    throw new Error(`ga4_monthly_users: ${error.message}`);
  }
  return data ?? null;
}

export async function getWebMonthlyByChannel(monthsBack = 12): Promise<MonthlyByChannelRow[]> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("vw_drean_web_monthly_by_channel")
    .select("mes, canal, sesiones, conversiones, pageviews")
    .order("mes", { ascending: true })
    .returns<MonthlyByChannelRow[]>();
  if (error) {
    if (/relation .* does not exist/i.test(error.message)) return [];
    throw new Error(`vw_drean_web_monthly_by_channel: ${error.message}`);
  }
  const rows = data ?? [];
  // Quedarse con los últimos monthsBack meses
  const meses = [...new Set(rows.map((r) => r.mes))].sort();
  const keep = new Set(meses.slice(-monthsBack));
  return rows.filter((r) => keep.has(r.mes));
}

function classifyProductCategoria(lp: string): string {
  if (/\/Lavavajillas(\/|$)/i.test(lp)) return "Lavavajillas";
  if (/\/Lavado(\/|$)/i.test(lp)) return "Lavado";
  if (/\/Heladeras(\/|$)/i.test(lp)) return "Refrigeración";
  if (/\/Cocci/i.test(lp)) return "Cocinas";
  return "Otros";
}

export async function getWebTopProducts(range: WebRange, limit = 10): Promise<TopProductRow[]> {
  const raw = await fetchRawWebTraffic(range);
  const map = new Map<string, {
    landing_page: string;
    sesiones: number; conversiones: number; pageviews: number;
  }>();
  for (const r of raw) {
    const lp = r.landing_page ?? "";
    if (!/\/p\//.test(lp)) continue;
    const acc = map.get(lp) ?? { landing_page: lp, sesiones: 0, conversiones: 0, pageviews: 0 };
    acc.sesiones += r.sesiones ?? 0;
    acc.conversiones += r.conversiones ?? 0;
    acc.pageviews += r.pageviews ?? 0;
    map.set(lp, acc);
  }
  return [...map.values()]
    .sort((a, b) => b.sesiones - a.sesiones)
    .slice(0, limit)
    .map((r) => {
      const skuMatch = r.landing_page.match(/\/p\/([^/?#]+)/);
      const slugMatch = r.landing_page.match(/\/([^/]+)\/p\//);
      return {
        landing_page: r.landing_page,
        sku: skuMatch?.[1] ?? null,
        producto_slug: slugMatch?.[1] ?? null,
        categoria: classifyProductCategoria(r.landing_page),
        sesiones: r.sesiones,
        conversiones: r.conversiones,
        pageviews: r.pageviews,
        conversion_rate: r.sesiones > 0 ? r.conversiones / r.sesiones : null,
        ultima_fecha: range.to,
      };
    });
}

export async function getWebTopLandingPages(range: WebRange, limit = 10): Promise<TopLandingRow[]> {
  const raw = await fetchRawWebTraffic(range);
  const map = new Map<string, {
    landing_page: string;
    sesiones: number; conversiones: number; pageviews: number;
    bounceNum: number; bounceDenom: number;
  }>();
  for (const r of raw) {
    const lp = r.landing_page ?? "";
    if (!lp) continue;
    const acc = map.get(lp) ?? {
      landing_page: lp, sesiones: 0, conversiones: 0, pageviews: 0,
      bounceNum: 0, bounceDenom: 0,
    };
    acc.sesiones += r.sesiones ?? 0;
    acc.conversiones += r.conversiones ?? 0;
    acc.pageviews += r.pageviews ?? 0;
    if (r.bounce_rate !== null && r.sesiones > 0) {
      acc.bounceNum += r.bounce_rate * r.sesiones;
      acc.bounceDenom += r.sesiones;
    }
    map.set(lp, acc);
  }
  return [...map.values()]
    .sort((a, b) => b.sesiones - a.sesiones)
    .slice(0, limit)
    .map((r) => ({
      landing_page: r.landing_page,
      sesiones: r.sesiones,
      conversiones: r.conversiones,
      pageviews: r.pageviews,
      conversion_rate: r.sesiones > 0 ? r.conversiones / r.sesiones : null,
      bounce_rate: r.bounceDenom > 0 ? r.bounceNum / r.bounceDenom : null,
      ultima_fecha: range.to,
    }));
}

// ============================================================================
// Helpers para construir agregaciones a nivel página

export interface WebTotals {
  sesiones: number;
  usuarios: number;
  conversiones: number;
  pageviews: number;
  conversion_rate: number | null;       // conversiones / sesiones
  pages_per_session: number | null;     // pageviews / sesiones
  bounce_rate: number | null;           // ponderado por sesiones
  avg_session_duration: number | null;  // ponderado por sesiones
}

export function aggregateDaily(rows: DailyKpiRow[]): WebTotals {
  const sesiones = rows.reduce((a, r) => a + (r.sesiones ?? 0), 0);
  const usuarios = rows.reduce((a, r) => a + (r.usuarios ?? 0), 0);
  const conversiones = rows.reduce((a, r) => a + (r.conversiones ?? 0), 0);
  const pageviews = rows.reduce((a, r) => a + (r.pageviews ?? 0), 0);

  let bounceNum = 0, bounceDenom = 0;
  let durNum = 0, durDenom = 0;
  for (const r of rows) {
    if (r.bounce_rate !== null) {
      bounceNum += r.bounce_rate * r.sesiones;
      bounceDenom += r.sesiones;
    }
    if (r.avg_session_duration !== null) {
      durNum += r.avg_session_duration * r.sesiones;
      durDenom += r.sesiones;
    }
  }

  return {
    sesiones,
    usuarios,
    conversiones,
    pageviews,
    conversion_rate: sesiones > 0 ? conversiones / sesiones : null,
    pages_per_session: sesiones > 0 ? pageviews / sesiones : null,
    bounce_rate: bounceDenom > 0 ? bounceNum / bounceDenom : null,
    avg_session_duration: durDenom > 0 ? durNum / durDenom : null,
  };
}

export interface ChannelAggregate {
  canal: string;
  sesiones: number;
  conversiones: number;
  pageviews: number;
}

export function aggregateBySource(rows: BySourceRow[]): ChannelAggregate[] {
  const byCanal = new Map<string, { sesiones: number; conversiones: number; pageviews: number }>();
  for (const r of rows) {
    const acc = byCanal.get(r.canal) ?? { sesiones: 0, conversiones: 0, pageviews: 0 };
    acc.sesiones += r.sesiones;
    acc.conversiones += r.conversiones;
    acc.pageviews += r.pageviews;
    byCanal.set(r.canal, acc);
  }
  return [...byCanal.entries()]
    .map(([canal, v]) => ({ canal, ...v }))
    .sort((a, b) => b.sesiones - a.sesiones);
}

export interface CategoryAggregate {
  categoria: string;
  sesiones: number;
  conversiones: number;
  pageviews: number;
  conversion_rate: number | null;
  bounce_rate: number | null;
}

export function aggregateByCategory(rows: ByCategoryRow[]): CategoryAggregate[] {
  const map = new Map<string, { sesiones: number; conversiones: number; pageviews: number; bounceNum: number; bounceDenom: number }>();
  for (const r of rows) {
    const acc = map.get(r.categoria) ?? { sesiones: 0, conversiones: 0, pageviews: 0, bounceNum: 0, bounceDenom: 0 };
    acc.sesiones += r.sesiones;
    acc.conversiones += r.conversiones;
    acc.pageviews += r.pageviews;
    if (r.bounce_rate !== null) {
      acc.bounceNum += r.bounce_rate * r.sesiones;
      acc.bounceDenom += r.sesiones;
    }
    map.set(r.categoria, acc);
  }
  return [...map.entries()]
    .map(([categoria, v]) => ({
      categoria,
      sesiones: v.sesiones,
      conversiones: v.conversiones,
      pageviews: v.pageviews,
      conversion_rate: v.sesiones > 0 ? v.conversiones / v.sesiones : null,
      bounce_rate: v.bounceDenom > 0 ? v.bounceNum / v.bounceDenom : null,
    }))
    .sort((a, b) => b.sesiones - a.sesiones);
}

export const PALETA_CANAL: Record<string, string> = {
  Direct: "#64748b",
  "Organic Search": "#22c55e",
  "Paid Search": "#f97316",
  "Organic Social": "#a78bfa",
  "Paid Social": "#ec4899",
  Email: "#facc15",
  Referral: "#0ea5e9",
  Display: "#94a3b8",
  "Cross-network": "#6366f1",
  "Paid Video": "#3b82f6",
  "Organic Video": "#06b6d4",
  "Paid Other": "#fb923c",
  Affiliates: "#10b981",
  Unassigned: "#cbd5e1",
  Otros: "#94a3b8",
};

export const PALETA_CATEGORIA: Record<string, string> = {
  Lavado: "#a78bfa",
  Refrigeración: "#22c55e",
  Cocinas: "#f97316",
  "Otros / Home": "#94a3b8",
};
