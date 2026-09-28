import "server-only";
// ============================================================================
// Lector (server, REST con la service key) de la "Inversión diaria por medio" — Eficiencia Medios y la
// señal `gasto_diario_anomalo`. Tablas chicas, lecturas en paralelo, nunca tira (sin dato → serie vacía).
//  · Google Search / Demand Gen: google_ads_creatives (diaria por anuncio; PMax no está en la tabla y se
//    excluye igual por las dudas, como en Pauta Mkt).
//  · Meta: meta_paid_daily (0123, diaria por campaña) si ya tiene filas; si no, dato MENSUAL de
//    meta_paid_creatives (gasto del mes a la fecha de la última sync). Los totales por mes de Meta salen
//    SIEMPRE de meta_paid_creatives (fuente de verdad de Pauta Mkt) y alimentan la referencia mensual y la
//    concentración por campaña (días activos por campaña).
//  · DV360 (YouTube / Programmatic): SOLO mensual (dv360_creatives.mes); USD→ARS con el fx del mes.
// Todo en $ corrientes (la detección compara al medio consigo mismo, no depende de la moneda).
// ============================================================================
import { addDias, mesMas, type SerieMedio, type CampaniaMes, type PautaDiariaData } from "@/lib/pauta-diaria";
export type { PautaDiariaData } from "@/lib/pauta-diaria";

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
/** "Agosto 2026" → "2026-08". */
function mesIso(label: string | null): string | null {
  const m = (label ?? "").trim().toLowerCase().match(/^([a-záéíóú]+)\s+(\d{4})$/);
  if (!m) return null;
  const i = MESES.indexOf(m[1]!.normalize("NFD").replace(/[̀-ͯ]/g, ""));
  return i < 0 ? null : `${m[2]}-${String(i + 1).padStart(2, "0")}`;
}

async function rest<T>(query: string): Promise<{ ok: boolean; rows: T[]; missing?: boolean }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { ok: false, rows: [] };
  try {
    const res = await fetch(`${url}/rest/v1/${query}`, { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "no-store", signal: AbortSignal.timeout(15_000) });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      return { ok: false, rows: [], missing: /PGRST205|42P01|does not exist|schema cache/i.test(t) };
    }
    return { ok: true, rows: (await res.json()) as T[] };
  } catch { return { ok: false, rows: [] }; }
}

const GOOGLE_MEDIO: Record<string, string> = { SEARCH: "Google Search", DEMAND_GEN: "Demand Gen" };
const DV360_MEDIO: Record<string, string> = { YouTube: "YouTube (DV360)", Programmatic: "Programmatic (DV360)" };

export async function getPautaDiaria(now = new Date()): Promise<PautaDiariaData> {
  // "Hoy" en Argentina (UTC−3): el dato de un día se cierra a la medianoche local.
  const hoy = new Date(now.getTime() - 3 * 3_600_000).toISOString().slice(0, 10);
  const mes = hoy.slice(0, 7);
  const desdeGrafico = addDias(hoy, -90);
  // Para la referencia hacen falta los 3 meses cerrados completos.
  const desdeRef = `${mesMas(mes, -3)}-01`;
  const desde = desdeGrafico < desdeRef ? desdeGrafico : desdeRef;

  const anio = Number(mes.slice(0, 4));
  const [gads, mDaily, mMes, dv, fx, gMin, mMin, planRows] = await Promise.all([
    rest<{ fecha: string; campaign_type: string | null; cost: number | string | null }>(
      `google_ads_creatives?select=fecha,campaign_type,cost&fecha=gte.${desde}&campaign_type=in.(SEARCH,DEMAND_GEN)&order=fecha.asc&limit=50000`),
    rest<{ fecha: string; campaign_name: string | null; spend: number | string | null }>(
      `meta_paid_daily?select=fecha,campaign_name,spend&fecha=gte.${desde}&order=fecha.asc&limit=50000`),
    rest<{ mes: string | null; campaign_name: string | null; spend: number | string | null; dias_activos: number | null; fetched_at: string | null }>(
      `meta_paid_creatives?select=mes,campaign_name,spend,dias_activos,fetched_at&limit=20000`),
    rest<{ mes: string; canal: string; revenue_usd: number | string | null; updated_at: string | null }>(
      `dv360_creatives?select=mes,canal,revenue_usd,updated_at&mes=gte.${desdeRef}&limit=20000`),
    rest<{ mes: string; usd_ars: number | string }>(`fx_rates?select=mes,usd_ars&order=mes.asc`),
    // Desde cuándo hay dato diario (para la nota de la UI).
    rest<{ fecha: string }>(`google_ads_creatives?select=fecha&campaign_type=in.(SEARCH,DEMAND_GEN)&order=fecha.asc&limit=1`),
    rest<{ fecha: string }>(`meta_paid_daily?select=fecha&order=fecha.asc&limit=1`),
    // Plan mensual de Inversión (meta "Pauta Mkt", total) del año actual y el anterior.
    rest<{ anio: number; mes: number; valor: number | string | null }>(
      `kpi_meta_valores?plan=eq.${encodeURIComponent("Pauta Mkt")}&kpi=eq.${encodeURIComponent("Inversión")}&categoria=eq.__general__&anio=in.(${anio - 1},${anio})&select=anio,mes,valor`),
  ]);
  const n = (v: number | string | null | undefined) => Number(v ?? 0) || 0;

  // ── Google (diario) ──
  const gSeries = new Map<string, SerieMedio>();
  const gDesde: string | null = gMin.rows[0]?.fecha ?? null;
  for (const r of gads.rows) {
    const medio = GOOGLE_MEDIO[r.campaign_type ?? ""];
    if (!medio) continue;
    const s = gSeries.get(medio) ?? { medio, fuente: "diaria" as const, dias: {}, meses: {} };
    const v = n(r.cost);
    s.dias[r.fecha] = (s.dias[r.fecha] ?? 0) + v;
    s.meses[r.fecha.slice(0, 7)] = (s.meses[r.fecha.slice(0, 7)] ?? 0) + v;
    gSeries.set(medio, s);
  }

  // ── Meta: totales por mes + campañas (mensual) ──
  const metaMeses: Record<string, number> = {};
  const camp = new Map<string, CampaniaMes>();
  let metaAsOf: string | null = null;
  for (const r of mMes.rows) {
    const m = mesIso(r.mes);
    if (!m) continue;
    const v = n(r.spend);
    metaMeses[m] = (metaMeses[m] ?? 0) + v;
    if (m === mes && r.fetched_at) { const f = new Date(new Date(r.fetched_at).getTime() - 3 * 3_600_000).toISOString().slice(0, 10); if (!metaAsOf || f > metaAsOf) metaAsOf = f; }
    const name = r.campaign_name ?? "(sin nombre)";
    const k = `${m}|${name}`;
    const c = camp.get(k) ?? { mes: m, campania: name, gasto: 0, dias: null };
    c.gasto += v;
    if (r.dias_activos != null) c.dias = Math.max(c.dias ?? 0, r.dias_activos);
    camp.set(k, c);
  }
  // Meta diario (0123) — si hay filas.
  const metaDias: Record<string, number> = {};
  const metaDesde: string | null = mMin.rows[0]?.fecha ?? null;
  for (const r of mDaily.rows) {
    metaDias[r.fecha] = (metaDias[r.fecha] ?? 0) + n(r.spend);
  }
  // La serie diaria de Meta se usa si cubre el mes en curso o el anterior (si no, quedó vieja: mensual).
  const metaDiaria = Object.keys(metaDias).some((f) => f >= `${mesMas(mes, -1)}-01`);
  const metaSerie: SerieMedio = metaDiaria
    ? { medio: "Meta", fuente: "diaria", dias: metaDias, meses: metaMeses }
    : {
      medio: "Meta", fuente: "mensual", dias: {}, meses: metaMeses, asOf: metaAsOf,
      nota: mDaily.missing
        ? "Meta todavía informa por mes: falta correr la migración 0123_meta_paid_daily.sql (después, la próxima sync diaria completa los últimos 3 meses día por día)."
        : "Meta todavía informa por mes: el detalle diario se completa con la próxima sincronización de Meta (corre todos los días a las 07:30).",
    };

  // ── DV360 (solo mensual) ──
  const fxMap = new Map(fx.rows.map((r) => [r.mes.slice(0, 7), n(r.usd_ars)]));
  const fxLast = fx.rows.length ? n(fx.rows[fx.rows.length - 1]!.usd_ars) : 0;
  const dvSeries = new Map<string, SerieMedio>();
  for (const r of dv.rows) {
    const medio = DV360_MEDIO[r.canal];
    if (!medio) continue;
    const m = r.mes.slice(0, 7);
    const s = dvSeries.get(medio) ?? { medio, fuente: "mensual" as const, dias: {}, meses: {}, asOf: null, nota: "DV360 solo informa por mes: no se puede ver el gasto por día. Se compara lo que va del mes contra un mes normal." };
    s.meses[m] = (s.meses[m] ?? 0) + n(r.revenue_usd) * (fxMap.get(m) ?? fxLast);
    if (m === mes && r.updated_at) {
      // El reporte de DV360 llega con el día anterior cerrado.
      const f = addDias(new Date(new Date(r.updated_at).getTime() - 3 * 3_600_000).toISOString().slice(0, 10), -1);
      if (f.slice(0, 7) === mes && (!s.asOf || f > s.asOf)) s.asOf = f;
    }
    dvSeries.set(medio, s);
  }

  const orden = ["Meta", "Google Search", "Demand Gen", "YouTube (DV360)", "Programmatic (DV360)"];
  const series = [metaSerie, ...gSeries.values(), ...dvSeries.values()].sort((a, b) => orden.indexOf(a.medio) - orden.indexOf(b.medio));
  const plan: Record<string, number> = {};
  for (const r of planRows.rows) { const v = n(r.valor); if (v > 0) plan[`${r.anio}-${String(r.mes).padStart(2, "0")}`] = v; }
  return {
    hoy, desde: desdeGrafico, series, plan,
    campanias: [{ medio: "Meta", filas: [...camp.values()] }],
    meta: { diaria: metaDiaria, faltaMigracion: !!mDaily.missing, desde: metaDesde },
    google: { desde: gDesde },
  };
}
