import "server-only";
// Lectura (server) del Simulador de presupuesto: las MISMAS queries que /performance (tablas chicas)
// + el modelo por medio compartido (buildPautaMediosMensual) para el año en curso y el anterior,
// + la demanda genérica por categoría (search_volume). Sin llamadas externas. Nunca tira.
import { getPautaPerformance } from "@/lib/pauta-queries";
import { getMetaPaidCreatives } from "@/lib/meta-paid-queries";
import { getDv360Creatives, getDv360Reach } from "@/lib/dv360-queries";
import { getGoogleAdsOmd } from "@/lib/google-ads-omd-queries";
import { getFxRates } from "@/lib/fx-queries";
import { getDemandaGenerica } from "@/lib/competitive-queries";
import { buildPautaMediosMensual } from "@/lib/pauta-medios-model";
import { buildSimModel, simMonthsFromPauta, forecastDemand, type SimModel, type DemandPoint } from "@/lib/simulador";
import { getEcommerceMensual } from "@/lib/ecommerce-queries";
import { construirDatosMmm, type MmmDatos, type MmmKpiSerie } from "@/lib/mmm-datos";

const safe = async <T>(p: Promise<T>, fb: T): Promise<T> => { try { return await p; } catch { return fb; } };
const isPmax = (canal: string) => /pmax|performance ?max/i.test(canal);

export interface SimuladorData {
  model: SimModel;
  demanda: { categoria: string; serie: DemandPoint[]; puntos: DemandPoint[]; metodo: string }[];
  /** Series mensuales para el MMM-lite (el ajuste corre en el navegador). */
  mmm: MmmDatos | null;
}

// Usuarios mensuales de GA4 (tabla chica, ~1 fila por mes) por REST service key.
async function getUsuariosMensuales(): Promise<Record<string, number>> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return {};
  try {
    const res = await fetch(`${url}/rest/v1/ga4_monthly_users?select=mes,total_users&order=mes.asc&limit=500`, { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "no-store" });
    if (!res.ok) return {};
    const rows = (await res.json()) as { mes: string; total_users: number | null }[];
    return Object.fromEntries(rows.filter((r) => r.total_users != null && r.total_users > 0).map((r) => [r.mes.slice(0, 7), Number(r.total_users)]));
  } catch { return {}; }
}

export async function getSimuladorData(now = new Date()): Promise<SimuladorData> {
  const anioActual = now.getUTCFullYear();
  const [pauta, metaPaid, dv360, dv360Reach, gads, fxRates, dem, usuarios, ecoCur, ecoPrev] = await Promise.all([
    safe(getPautaPerformance(true), []),         // Pauta Mkt incluye UGC
    safe(getMetaPaidCreatives(true), []),
    safe(getDv360Creatives(), []),
    safe(getDv360Reach(), []),
    safe(getGoogleAdsOmd(), []),
    safe(getFxRates(), {} as Record<string, number>),
    safe(getDemandaGenerica(), []),
    // MMM-lite: KPI de negocio (GA4) + inversión ecommerce. Lecturas chicas por REST.
    safe(getUsuariosMensuales(), {} as Record<string, number>),
    safe(getEcommerceMensual(anioActual), null),
    safe(getEcommerceMensual(anioActual - 1), null),
  ]);
  const anio = now.getUTCFullYear();
  const googleAdsOmd = gads.filter((r) => !isPmax(r.canal)); // Performance Max fuera de Pauta Mkt
  const base = { pauta, metaPaid, dv360, dv360Reach, googleAdsOmd, fxRates };
  const cur = buildPautaMediosMensual({ ...base, anio, currentMonth: now.getUTCMonth() + 1 });
  const prev = buildPautaMediosMensual({ ...base, anio: anio - 1, currentMonth: 13 });
  const simMeses = simMonthsFromPauta(prev, cur);
  const model = buildSimModel(simMeses);

  // MMM-lite: mismas series por medio que las curvas + Ecommerce + KPIs de GA4 (meses cerrados).
  const mesEnCurso = now.toISOString().slice(0, 7);
  const porMes = (y: number, arr: (number | null)[] | undefined) => Object.fromEntries((arr ?? []).map((v, i) => [`${y}-${String(i + 1).padStart(2, "0")}`, v]).filter(([, v]) => v != null && (v as number) > 0)) as Record<string, number>;
  const kpis = ([
    { key: "usuarios", label: "Usuarios web", unidad: "", porMes: usuarios },
    { key: "transacciones", label: "Transacciones", unidad: "", porMes: { ...porMes(anio - 1, ecoPrev?.transacciones), ...porMes(anio, ecoCur?.transacciones) } },
    { key: "ingresos", label: "Ingresos ecommerce", unidad: "$", porMes: { ...porMes(anio - 1, ecoPrev?.ingresos), ...porMes(anio, ecoCur?.ingresos) } },
  ] as MmmKpiSerie[]).filter((k) => Object.keys(k.porMes).length > 0);
  const extraEco = { medio: "Ecommerce", porMes: { ...porMes(anio - 1, ecoPrev?.invConversion), ...porMes(anio, ecoCur?.invConversion) } };
  let mmm: MmmDatos | null = null;
  try { mmm = construirDatosMmm({ meses: simMeses, extra: [extraEco], kpis, mesEnCurso }); } catch { mmm = null; }

  const hoyYm = now.toISOString().slice(0, 7);
  const cats = [...new Set(dem.map((d) => d.categoria))];
  const demanda = cats.map((categoria) => {
    const serie = dem.filter((d) => d.categoria === categoria && d.mes.slice(0, 7) <= hoyYm)
      .map((d) => ({ mes: d.mes.slice(0, 7), v: Number(d.search_volume) || 0 }));
    return { categoria, serie, ...forecastDemand(serie, 3) };
  }).filter((d) => d.serie.length >= 3);
  return { model, demanda, mmm };
}
