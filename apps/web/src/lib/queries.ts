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

// ---------------------------------------------------------------------------
// GA4 demographics
// ---------------------------------------------------------------------------

export interface AgeGenderRow {
  age_bracket: string;
  gender: string;
  sessions: number;
  total_users: number;
}

export interface GeoRow {
  region: string;
  city: string | null;
  sessions: number;
  total_users: number;
}

export interface InterestRow {
  interest_category: string;
  sessions: number;
  total_users: number;
}

export interface DeviceRow {
  device_category: string;
  sessions: number;
  total_users: number;
}

interface DemoAgeGenderRaw {
  age_bracket: string | null;
  gender: string | null;
  device_category: string | null;
  sessions: number | null;
  total_users: number | null;
}

interface DemoGeoRaw {
  country: string | null;
  region: string | null;
  city: string | null;
  device_category: string | null;
  sessions: number | null;
  total_users: number | null;
}

interface DemoInterestRaw {
  interest_category: string | null;
  sessions: number | null;
  total_users: number | null;
}

export interface DemographicsSummary {
  byAge: AgeGenderRow[];
  byGender: AgeGenderRow[];
  byRegion: GeoRow[];
  byCity: GeoRow[];
  byDevice: DeviceRow[];
  byInterest: InterestRow[];
  totals: { sessions: number; users: number };
}

export async function getDemographicsSummary(range: DateRange): Promise<DemographicsSummary> {
  const supabase = getServerSupabase();

  const [ageGenderRes, geoRes, interestRes] = await Promise.all([
    supabase
      .from("ga4_demo_age_gender")
      .select("age_bracket, gender, device_category, sessions, total_users")
      .gte("fecha", range.from)
      .lte("fecha", range.to)
      .returns<DemoAgeGenderRaw[]>(),
    supabase
      .from("ga4_demo_geo")
      .select("country, region, city, device_category, sessions, total_users")
      .gte("fecha", range.from)
      .lte("fecha", range.to)
      .returns<DemoGeoRaw[]>(),
    supabase
      .from("ga4_demo_interest")
      .select("interest_category, sessions, total_users")
      .gte("fecha", range.from)
      .lte("fecha", range.to)
      .returns<DemoInterestRaw[]>(),
  ]);

  if (ageGenderRes.error) throw new Error(`ga4_demo_age_gender: ${ageGenderRes.error.message}`);
  if (geoRes.error) throw new Error(`ga4_demo_geo: ${geoRes.error.message}`);
  if (interestRes.error) throw new Error(`ga4_demo_interest: ${interestRes.error.message}`);

  const ageGender = ageGenderRes.data ?? [];
  const geo = geoRes.data ?? [];
  const interest = interestRes.data ?? [];

  // Agrupaciones
  const byAgeMap = new Map<string, AgeGenderRow>();
  const byGenderMap = new Map<string, AgeGenderRow>();
  const byDeviceMap = new Map<string, DeviceRow>();

  for (const r of ageGender) {
    const sessions = Number(r.sessions ?? 0);
    const users = Number(r.total_users ?? 0);

    const age = r.age_bracket ?? "unknown";
    const ageRow = byAgeMap.get(age) ?? { age_bracket: age, gender: "", sessions: 0, total_users: 0 };
    ageRow.sessions += sessions;
    ageRow.total_users += users;
    byAgeMap.set(age, ageRow);

    const gender = r.gender ?? "unknown";
    const gRow = byGenderMap.get(gender) ?? { age_bracket: "", gender, sessions: 0, total_users: 0 };
    gRow.sessions += sessions;
    gRow.total_users += users;
    byGenderMap.set(gender, gRow);

    const device = r.device_category ?? "unknown";
    const dRow = byDeviceMap.get(device) ?? { device_category: device, sessions: 0, total_users: 0 };
    dRow.sessions += sessions;
    dRow.total_users += users;
    byDeviceMap.set(device, dRow);
  }

  const byRegionMap = new Map<string, GeoRow>();
  const byCityMap = new Map<string, GeoRow>();

  for (const r of geo) {
    const sessions = Number(r.sessions ?? 0);
    const users = Number(r.total_users ?? 0);
    if (r.region) {
      const rRow = byRegionMap.get(r.region) ?? {
        region: r.region,
        city: null,
        sessions: 0,
        total_users: 0,
      };
      rRow.sessions += sessions;
      rRow.total_users += users;
      byRegionMap.set(r.region, rRow);
    }
    if (r.city) {
      const key = `${r.region ?? ""}|${r.city}`;
      const cRow = byCityMap.get(key) ?? {
        region: r.region ?? "",
        city: r.city,
        sessions: 0,
        total_users: 0,
      };
      cRow.sessions += sessions;
      cRow.total_users += users;
      byCityMap.set(key, cRow);
    }
  }

  const byInterestMap = new Map<string, InterestRow>();
  for (const r of interest) {
    if (!r.interest_category) continue;
    const row = byInterestMap.get(r.interest_category) ?? {
      interest_category: r.interest_category,
      sessions: 0,
      total_users: 0,
    };
    row.sessions += Number(r.sessions ?? 0);
    row.total_users += Number(r.total_users ?? 0);
    byInterestMap.set(r.interest_category, row);
  }

  const sortBySessionsDesc = <T extends { sessions: number }>(rows: T[]) =>
    rows.sort((a, b) => b.sessions - a.sessions);

  const totals = ageGender.reduce(
    (acc, r) => {
      acc.sessions += Number(r.sessions ?? 0);
      acc.users += Number(r.total_users ?? 0);
      return acc;
    },
    { sessions: 0, users: 0 },
  );

  return {
    byAge: sortBySessionsDesc([...byAgeMap.values()]),
    byGender: sortBySessionsDesc([...byGenderMap.values()]),
    byRegion: sortBySessionsDesc([...byRegionMap.values()]).slice(0, 10),
    byCity: sortBySessionsDesc([...byCityMap.values()]).slice(0, 15),
    byDevice: sortBySessionsDesc([...byDeviceMap.values()]),
    byInterest: sortBySessionsDesc([...byInterestMap.values()]).slice(0, 10),
    totals,
  };
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
