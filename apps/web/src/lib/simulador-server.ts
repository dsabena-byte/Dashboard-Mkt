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

const safe = async <T>(p: Promise<T>, fb: T): Promise<T> => { try { return await p; } catch { return fb; } };
const isPmax = (canal: string) => /pmax|performance ?max/i.test(canal);

export interface SimuladorData {
  model: SimModel;
  demanda: { categoria: string; serie: DemandPoint[]; puntos: DemandPoint[]; metodo: string }[];
}

export async function getSimuladorData(now = new Date()): Promise<SimuladorData> {
  const [pauta, metaPaid, dv360, dv360Reach, gads, fxRates, dem] = await Promise.all([
    safe(getPautaPerformance(true), []),         // Pauta Mkt incluye UGC
    safe(getMetaPaidCreatives(true), []),
    safe(getDv360Creatives(), []),
    safe(getDv360Reach(), []),
    safe(getGoogleAdsOmd(), []),
    safe(getFxRates(), {} as Record<string, number>),
    safe(getDemandaGenerica(), []),
  ]);
  const anio = now.getUTCFullYear();
  const googleAdsOmd = gads.filter((r) => !isPmax(r.canal)); // Performance Max fuera de Pauta Mkt
  const base = { pauta, metaPaid, dv360, dv360Reach, googleAdsOmd, fxRates };
  const cur = buildPautaMediosMensual({ ...base, anio, currentMonth: now.getUTCMonth() + 1 });
  const prev = buildPautaMediosMensual({ ...base, anio: anio - 1, currentMonth: 13 });
  const model = buildSimModel(simMonthsFromPauta(prev, cur));

  const hoyYm = now.toISOString().slice(0, 7);
  const cats = [...new Set(dem.map((d) => d.categoria))];
  const demanda = cats.map((categoria) => {
    const serie = dem.filter((d) => d.categoria === categoria && d.mes.slice(0, 7) <= hoyYm)
      .map((d) => ({ mes: d.mes.slice(0, 7), v: Number(d.search_volume) || 0 }));
    return { categoria, serie, ...forecastDemand(serie, 3) };
  }).filter((d) => d.serie.length >= 3);
  return { model, demanda };
}
