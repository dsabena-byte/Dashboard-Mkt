import "server-only";
import { getServerSupabase } from "./supabase-server";
import type { DateRange } from "./dates";

export interface KpiTotals {
  inversion: number;
  impresiones: number;
  clicks: number;
  sesiones: number;
  conversiones: number;
}

interface AdsAggRow {
  costo: number;
  impresiones: number;
  clicks: number;
  conversiones: number;
}

interface WebAggRow {
  sesiones: number;
  conversiones: number;
}

export async function getKpiTotals(range: DateRange): Promise<KpiTotals> {
  const supabase = getServerSupabase();

  const [adsRes, webRes] = await Promise.all([
    supabase
      .from("ads_performance")
      .select("costo, impresiones, clicks, conversiones")
      .gte("fecha", range.from)
      .lte("fecha", range.to)
      .returns<AdsAggRow[]>(),
    supabase
      .from("web_traffic")
      .select("sesiones, conversiones")
      .gte("fecha", range.from)
      .lte("fecha", range.to)
      .returns<WebAggRow[]>(),
  ]);

  if (adsRes.error) throw new Error(`ads_performance: ${adsRes.error.message}`);
  if (webRes.error) throw new Error(`web_traffic: ${webRes.error.message}`);

  const ads = adsRes.data ?? [];
  const web = webRes.data ?? [];

  return {
    inversion: ads.reduce((sum, r) => sum + Number(r.costo ?? 0), 0),
    impresiones: ads.reduce((sum, r) => sum + Number(r.impresiones ?? 0), 0),
    clicks: ads.reduce((sum, r) => sum + Number(r.clicks ?? 0), 0),
    sesiones: web.reduce((sum, r) => sum + Number(r.sesiones ?? 0), 0),
    conversiones:
      web.reduce((sum, r) => sum + Number(r.conversiones ?? 0), 0) ||
      ads.reduce((sum, r) => sum + Number(r.conversiones ?? 0), 0),
  };
}

export interface FunnelDailyRow {
  fecha: string;
  impresiones: number;
  clicks: number;
  sesiones: number;
  conversiones: number;
}

export async function getFunnelDaily(range: DateRange): Promise<FunnelDailyRow[]> {
  const supabase = getServerSupabase();

  const { data, error } = await supabase
    .from("vw_funnel_diario")
    .select("fecha, impresiones, clicks, sesiones, conversiones")
    .gte("fecha", range.from)
    .lte("fecha", range.to)
    .order("fecha", { ascending: true })
    .returns<FunnelDailyRow[]>();

  if (error) throw new Error(`vw_funnel_diario: ${error.message}`);

  // Agregamos por fecha (la vista puede tener múltiples filas por UTM en
  // la misma fecha; el funnel diario suma todas las UTMs del día).
  const byDate = new Map<string, FunnelDailyRow>();
  for (const row of data ?? []) {
    const existing = byDate.get(row.fecha) ?? {
      fecha: row.fecha,
      impresiones: 0,
      clicks: 0,
      sesiones: 0,
      conversiones: 0,
    };
    existing.impresiones += Number(row.impresiones ?? 0);
    existing.clicks += Number(row.clicks ?? 0);
    existing.sesiones += Number(row.sesiones ?? 0);
    existing.conversiones += Number(row.conversiones ?? 0);
    byDate.set(row.fecha, existing);
  }
  return [...byDate.values()].sort((a, b) => a.fecha.localeCompare(b.fecha));
}

export interface ComplianceRow {
  planning_id: string;
  fecha: string;
  canal: string;
  campania: string;
  metric_type: string;
  inversion_plan: number;
  kpi_target: number;
  inversion_real: number;
  kpi_actual: number;
  cumplimiento_inversion_pct: number | null;
  cumplimiento_kpi_pct: number | null;
}

export async function getPlanningCompliance(range: DateRange): Promise<ComplianceRow[]> {
  const supabase = getServerSupabase();

  const { data, error } = await supabase
    .from("vw_cumplimiento_planning")
    .select("*")
    .gte("fecha", range.from)
    .lte("fecha", range.to)
    .order("fecha", { ascending: true })
    .order("campania", { ascending: true })
    .returns<ComplianceRow[]>();

  if (error) throw new Error(`vw_cumplimiento_planning: ${error.message}`);
  return data ?? [];
}

/**
 * Devuelve los KPI totales del rango anterior de la misma longitud, para
 * calcular delta vs período previo.
 */
export async function getKpiTotalsPreviousPeriod(range: DateRange): Promise<KpiTotals> {
  const from = new Date(`${range.from}T00:00:00Z`);
  const to = new Date(`${range.to}T00:00:00Z`);
  const days = Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;
  const prevTo = new Date(from);
  prevTo.setUTCDate(prevTo.getUTCDate() - 1);
  const prevFrom = new Date(prevTo);
  prevFrom.setUTCDate(prevFrom.getUTCDate() - (days - 1));
  return getKpiTotals({
    from: prevFrom.toISOString().slice(0, 10),
    to: prevTo.toISOString().slice(0, 10),
  });
}
