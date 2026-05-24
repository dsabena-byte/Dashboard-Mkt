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
  usuarios: number;
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
  usuarios: number;
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
  usuarios: number;
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
 * Divide un rango en chunks mensuales (cal-month boundaries). Útil para evitar
 * statement_timeout en Supabase cuando la vista agrega por fecha sobre miles
 * de filas — cada chunk corre en paralelo bajo su propio budget.
 */
function splitRangeByMonth(range: WebRange): WebRange[] {
  const out: WebRange[] = [];
  const start = new Date(`${range.from}T00:00:00Z`);
  const end = new Date(`${range.to}T00:00:00Z`);
  let cur = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  while (cur <= end) {
    const monthEnd = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth() + 1, 0));
    const from = cur < start ? start : cur;
    const to = monthEnd > end ? end : monthEnd;
    out.push({ from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) });
    cur = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth() + 1, 1));
  }
  return out;
}

export async function getWebDailyKpis(range: WebRange): Promise<DailyKpiRow[]> {
  const chunks = splitRangeByMonth(range);
  const results = await Promise.all(chunks.map(async (r) => {
    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from("vw_drean_web_daily_kpis")
      .select("*")
      .gte("fecha", r.from)
      .lte("fecha", r.to)
      .order("fecha", { ascending: true })
      .range(0, 99_999)
      .returns<DailyKpiRow[]>();
    if (error) throw new Error(`vw_drean_web_daily_kpis: ${error.message}`);
    return data ?? [];
  }));
  return results.flat();
}

export async function getWebBySource(range: WebRange): Promise<BySourceRow[]> {
  const chunks = splitRangeByMonth(range);
  const results = await Promise.all(chunks.map(async (r) => {
    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from("vw_drean_web_by_source")
      .select("*")
      .gte("fecha", r.from)
      .lte("fecha", r.to)
      .range(0, 99_999)
      .returns<BySourceRow[]>();
    if (error) throw new Error(`vw_drean_web_by_source: ${error.message}`);
    return data ?? [];
  }));
  return results.flat();
}

export async function getWebByCategory(range: WebRange): Promise<ByCategoryRow[]> {
  const chunks = splitRangeByMonth(range);
  const results = await Promise.all(chunks.map(async (r) => {
    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from("vw_drean_web_by_category")
      .select("*")
      .gte("fecha", r.from)
      .lte("fecha", r.to)
      .range(0, 99_999)
      .returns<ByCategoryRow[]>();
    if (error) throw new Error(`vw_drean_web_by_category: ${error.message}`);
    return data ?? [];
  }));
  return results.flat();
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
  // Bypassea vw_drean_web_smartup_traffic (que hace ILIKE seq scan y timeout).
  // Va directo a web_traffic con filtro del lado server por utm_campaign LIKE
  // y un rango de fechas razonable (24 meses) — el indice de fecha hace que
  // sea rapido.
  const supabase = getServerSupabase();
  const today = new Date();
  const fromDate = new Date(Date.UTC(today.getUTCFullYear() - 2, today.getUTCMonth(), 1));
  const fromIso = fromDate.toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("web_traffic")
    .select("fecha, sesiones, usuarios, utm_campaign")
    .gte("fecha", fromIso)
    .ilike("utm_campaign", "smartup_tiktok_%")
    .range(0, 99_999)
    .returns<Array<{ fecha: string; sesiones: number; usuarios: number; utm_campaign: string | null }>>();
  if (error) {
    if (/relation .* does not exist/i.test(error.message)) return [];
    throw new Error(`web_traffic (smartup): ${error.message}`);
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

export async function getWebTopProducts(range: WebRange, limit = 10): Promise<TopProductRow[]> {
  const supabase = getServerSupabase();
  const client = supabase as unknown as {
    rpc: (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: { message: string } | null }>;
  };
  const { data, error } = await client.rpc("top_products_in_range", {
    p_from: range.from,
    p_to: range.to,
    p_limit: limit,
  });
  if (error) {
    if (/does not exist|function .* does not exist/i.test(error.message)) return [];
    throw new Error(`top_products_in_range: ${error.message}`);
  }
  const rows = (data ?? []) as Array<{
    landing_page: string;
    sku: string | null;
    producto_slug: string | null;
    categoria: string;
    sesiones: number;
    usuarios: number;
    conversiones: number;
    pageviews: number;
    conversion_rate: number | null;
  }>;
  return rows.map((r) => ({ ...r, usuarios: r.usuarios ?? 0, ultima_fecha: range.to }));
}

export async function getWebTopLandingPages(range: WebRange, limit = 10): Promise<TopLandingRow[]> {
  const supabase = getServerSupabase();
  const client = supabase as unknown as {
    rpc: (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: { message: string } | null }>;
  };
  const { data, error } = await client.rpc("top_landings_in_range", {
    p_from: range.from,
    p_to: range.to,
    p_limit: limit,
  });
  if (error) {
    if (/does not exist|function .* does not exist/i.test(error.message)) return [];
    throw new Error(`top_landings_in_range: ${error.message}`);
  }
  const rows = (data ?? []) as Array<{
    landing_page: string;
    sesiones: number;
    conversiones: number;
    pageviews: number;
    conversion_rate: number | null;
    bounce_rate: number | null;
  }>;
  return rows.map((r) => ({ ...r, ultima_fecha: range.to }));
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
  usuarios: number;
  conversiones: number;
  pageviews: number;
}

export function aggregateBySource(rows: BySourceRow[]): ChannelAggregate[] {
  const byCanal = new Map<string, { sesiones: number; usuarios: number; conversiones: number; pageviews: number }>();
  for (const r of rows) {
    const acc = byCanal.get(r.canal) ?? { sesiones: 0, usuarios: 0, conversiones: 0, pageviews: 0 };
    acc.sesiones += r.sesiones;
    acc.usuarios += r.usuarios ?? 0;
    acc.conversiones += r.conversiones;
    acc.pageviews += r.pageviews;
    byCanal.set(r.canal, acc);
  }
  return [...byCanal.entries()]
    .map(([canal, v]) => ({ canal, ...v }))
    .sort((a, b) => b.usuarios - a.usuarios);
}

export interface CategoryAggregate {
  categoria: string;
  sesiones: number;
  usuarios: number;
  conversiones: number;
  pageviews: number;
  conversion_rate: number | null;
  bounce_rate: number | null;
}

export function aggregateByCategory(rows: ByCategoryRow[]): CategoryAggregate[] {
  const map = new Map<string, { sesiones: number; usuarios: number; conversiones: number; pageviews: number; bounceNum: number; bounceDenom: number }>();
  for (const r of rows) {
    const acc = map.get(r.categoria) ?? { sesiones: 0, usuarios: 0, conversiones: 0, pageviews: 0, bounceNum: 0, bounceDenom: 0 };
    acc.sesiones += r.sesiones;
    acc.usuarios += r.usuarios ?? 0;
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
      usuarios: v.usuarios,
      conversiones: v.conversiones,
      pageviews: v.pageviews,
      conversion_rate: v.sesiones > 0 ? v.conversiones / v.sesiones : null,
      bounce_rate: v.bounceDenom > 0 ? v.bounceNum / v.bounceDenom : null,
    }))
    .sort((a, b) => b.usuarios - a.usuarios);
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

// ============================================================================
// GA4 demographics (workflow ga4-demographics-sync)
// ============================================================================

export interface DeviceMixRow {
  device_category: string;
  sessions: number;
  total_users: number;
}

export interface RegionRow {
  region: string;
  sessions: number;
  total_users: number;
}

export interface DemographicsSummary {
  byDevice: DeviceMixRow[];
  byRegion: RegionRow[];
}

interface DemoAgeGenderRaw {
  device_category: string | null;
  sessions: number | null;
  total_users: number | null;
}

interface DemoGeoRaw {
  region: string | null;
  sessions: number | null;
  total_users: number | null;
}

/**
 * Devuelve mix de devices y top regiones de los **últimos 7 días**.
 *
 * El rango es independiente del filtro de fechas del header de /web — el
 * workflow de demographics solo carga ~7 días móviles y ese es el horizonte
 * más útil para el card. Se ignora el parámetro `range` del header.
 *
 * - Lee `ga4_demo_age_gender` agregando por device_category. age_bracket y
 *   gender vienen siempre NULL en la propiedad de Drean por thresholding —
 *   los ignoramos.
 * - Lee `ga4_demo_geo` agregando por region. country y city no se usan en
 *   este card (Drean es ~Argentina 99%).
 */
export async function getWebDemographicsSummary(
  _range: WebRange,
  regionLimit = 7,
): Promise<DemographicsSummary & { rangeLabel: string }> {
  const supabase = getServerSupabase();

  // Últimos 7 días terminando ayer (UTC). Hardcodeado porque el workflow
  // solo mantiene ~7 días de data demográfica.
  const today = new Date();
  const to = new Date(today);
  to.setUTCDate(to.getUTCDate() - 1);
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - 6);
  const toIso = to.toISOString().slice(0, 10);
  const fromIso = from.toISOString().slice(0, 10);

  const [deviceRes, geoRes] = await Promise.all([
    supabase
      .from("ga4_demo_age_gender")
      .select("device_category, sessions, total_users")
      .gte("fecha", fromIso)
      .lte("fecha", toIso)
      .returns<DemoAgeGenderRaw[]>(),
    supabase
      .from("ga4_demo_geo")
      .select("region, sessions, total_users")
      .gte("fecha", fromIso)
      .lte("fecha", toIso)
      .returns<DemoGeoRaw[]>(),
  ]);

  if (deviceRes.error) {
    // Si la tabla no existe todavia en el ambiente, devolvemos vacio en vez
    // de tirar — asi /web renderiza igual cuando la migration 0026 no se
    // aplico aun.
    if (/does not exist|relation .* does not exist/i.test(deviceRes.error.message)) {
      return { byDevice: [], byRegion: [], rangeLabel: `${fromIso} → ${toIso}` };
    }
    throw new Error(`ga4_demo_age_gender: ${deviceRes.error.message}`);
  }
  if (geoRes.error) {
    if (/does not exist|relation .* does not exist/i.test(geoRes.error.message)) {
      return { byDevice: [], byRegion: [], rangeLabel: `${fromIso} → ${toIso}` };
    }
    throw new Error(`ga4_demo_geo: ${geoRes.error.message}`);
  }

  // Agregar device
  const deviceMap = new Map<string, DeviceMixRow>();
  for (const r of deviceRes.data ?? []) {
    const key = r.device_category ?? "unknown";
    const row = deviceMap.get(key) ?? { device_category: key, sessions: 0, total_users: 0 };
    row.sessions += Number(r.sessions ?? 0);
    row.total_users += Number(r.total_users ?? 0);
    deviceMap.set(key, row);
  }

  // Agregar regiones (descartando NULL)
  const regionMap = new Map<string, RegionRow>();
  for (const r of geoRes.data ?? []) {
    if (!r.region) continue;
    const row = regionMap.get(r.region) ?? { region: r.region, sessions: 0, total_users: 0 };
    row.sessions += Number(r.sessions ?? 0);
    row.total_users += Number(r.total_users ?? 0);
    regionMap.set(r.region, row);
  }

  const byDevice = [...deviceMap.values()].sort((a, b) => b.sessions - a.sessions);
  const regionsSorted = [...regionMap.values()].sort((a, b) => b.sessions - a.sessions);

  // Top N + agregamos "Otros" con el resto
  const top = regionsSorted.slice(0, regionLimit);
  const rest = regionsSorted.slice(regionLimit);
  if (rest.length > 0) {
    top.push({
      region: "Otros",
      sessions: rest.reduce((s, r) => s + r.sessions, 0),
      total_users: rest.reduce((s, r) => s + r.total_users, 0),
    });
  }

  return { byDevice, byRegion: top, rangeLabel: `${fromIso} → ${toIso}` };
}

export const PALETA_DEVICE: Record<string, string> = {
  mobile: "#22c55e",
  desktop: "#3b82f6",
  tablet: "#a78bfa",
  unknown: "#94a3b8",
};
