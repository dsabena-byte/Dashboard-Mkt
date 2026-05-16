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

export async function getWebDailyKpis(range: WebRange): Promise<DailyKpiRow[]> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("vw_drean_web_daily_kpis")
    .select("*")
    .gte("fecha", range.from)
    .lte("fecha", range.to)
    .order("fecha", { ascending: true })
    .returns<DailyKpiRow[]>();
  if (error) throw new Error(`vw_drean_web_daily_kpis: ${error.message}`);
  return data ?? [];
}

export async function getWebBySource(range: WebRange): Promise<BySourceRow[]> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("vw_drean_web_by_source")
    .select("*")
    .gte("fecha", range.from)
    .lte("fecha", range.to)
    .returns<BySourceRow[]>();
  if (error) throw new Error(`vw_drean_web_by_source: ${error.message}`);
  return data ?? [];
}

export async function getWebByCategory(range: WebRange): Promise<ByCategoryRow[]> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("vw_drean_web_by_category")
    .select("*")
    .gte("fecha", range.from)
    .lte("fecha", range.to)
    .returns<ByCategoryRow[]>();
  if (error) throw new Error(`vw_drean_web_by_category: ${error.message}`);
  return data ?? [];
}

export interface MonthlyUsersRow {
  mes: string;
  total_users: number;
  new_users: number;
  sesiones?: number;
  pageviews?: number;
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
    conversiones: number;
    pageviews: number;
    conversion_rate: number | null;
  }>;
  return rows.map((r) => ({ ...r, ultima_fecha: range.to }));
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
