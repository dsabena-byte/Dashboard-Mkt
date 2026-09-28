import { getPautaPerformance } from "@/lib/pauta-queries";
import { getMetaPaidCreatives } from "@/lib/meta-paid-queries";
import { getDv360Creatives, getDv360Reach } from "@/lib/dv360-queries";
import { getDv360ThumbMap } from "@/lib/dv360-thumbs";
import { getFxRates } from "@/lib/fx-queries";
import { getPlanningMedia } from "@/lib/planning-media-queries";
import { getGoogleAdsOmd } from "@/lib/google-ads-omd-queries";
import { getEcommerceInversionMensual } from "@/lib/ecommerce-queries";
import { getGoogleAdsCreatives } from "@/lib/google-ads-creatives-queries";
import { maxUpdatedAt } from "@/lib/freshness-queries";
import { getMetaKpi, type MetaKpiData } from "@/lib/metas-server";
import { PerformanceClient } from "@/components/pauta/performance-client";
import { Suspense } from "react";
import { monedaContext } from "@/lib/moneda-server";
import { avisoFaltantes, mesLabel } from "@/lib/moneda";
import { convertirFilas, convertir12, convertirPorMes, type ConvCollector } from "@/lib/moneda-pauta";
import { MonedaSelector } from "@/components/moneda-selector";
import { DataHealth } from "@/components/data-health";
import { getPautaDiaria } from "@/lib/pauta-diaria-server";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

async function safe<T>(p: Promise<T>, fallback: T): Promise<T> {
  try {
    return await p;
  } catch {
    return fallback;
  }
}

const MES_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function fechaToMesLabel(fecha: string): string {
  const [year, month] = fecha.split("-");
  const idx = parseInt(month ?? "1", 10) - 1;
  return `${MES_NAMES[idx] ?? month} ${year}`;
}

// 7.5% de costos impositivos/agencia/fee que descontamos al valor planificado
// para que el chart muestre la inversión neta proyectada.
const PLAN_NET_FACTOR = 0.925;

function bucketForChart(sistema: string | null): "digital" | "tvCable" | "dooh" | "ooh" | null {
  if (!sistema) return "digital";
  const s = sistema.toUpperCase().trim();
  // Skip: nunca tuvieron inversión, no las graficamos
  if (s === "RADIO" || s === "RADIO TACTICO" || s.includes("OTROS")) return null;
  // TV
  if (s.includes("TV CABLE") || s === "TVC" || s === "TVA" || s === "TV") return "tvCable";
  // DOOH (incluye OOH Táctico que en realidad es digital out-of-home)
  if (s === "DOOH" || s.includes("TACTICO") || s.includes("TÁCTICO")) return "dooh";
  // OOH tradicional (incluye OOH GF / Vía Pública)
  if (s.includes("OOH") || s.includes("VÍA PÚBLICA") || s.includes("VIA PUBLICA")) return "ooh";
  // MELI / Mercado Ads → Digital (explícito)
  if (s.includes("MELI") || s.includes("MERCADO ADS")) return "digital";
  return "digital";
}

export type PlanningByMes = Record<string, { digital: number; tvCable: number; dooh: number; ooh: number }>;

async function getPlanningMonthly(): Promise<PlanningByMes> {
  const rows = await getPlanningMedia({});
  const acc: PlanningByMes = {};
  for (const r of rows) {
    if (r.tipo !== "media") continue;
    const b = bucketForChart(r.sistema);
    if (!b) continue;
    const mes = fechaToMesLabel(r.fecha);
    if (!acc[mes]) acc[mes] = { digital: 0, tvCable: 0, dooh: 0, ooh: 0 };
    acc[mes][b] += (r.inversion ?? 0) * PLAN_NET_FACTOR;
  }
  return acc;
}

// Los 6 KPIs estratégicos de Pauta Mkt (Impacto Campaña). Las claves coinciden con
// el MetaPanel (plan="Pauta Mkt") y el catálogo del Mapa.
const PAUTA_KPIS = ["Inversión", "Alcance único", "Frecuencia", "Impresiones", "VTR (≥50%)", "Clicks"] as const;
const META_FALLBACK: MetaKpiData = { valores: Array.from({ length: 12 }, () => null), direccion: "up", umbralVerde: 100, umbralAmarillo: 90, unidad: null };

export default async function PerformancePautaPage({ searchParams }: { searchParams?: { tab?: string; vista?: string; moneda?: string } }) {
  const currentYear = new Date().getFullYear();
  const [rawData, rawMetaPaid, rawDv360, rawDv360Reach, fxRates, rawPlanning, rawGadsOmd, rawGadsCreatives, fDv360, fMeta, fOmd, fGads, rawEcomInv, mon] = await Promise.all([
    getPautaPerformance(true), // Pauta Mkt incluye UGC como una categoría más
    safe(getMetaPaidCreatives(true), [] as Awaited<ReturnType<typeof getMetaPaidCreatives>>),
    safe(getDv360Creatives(), [] as Awaited<ReturnType<typeof getDv360Creatives>>),
    safe(getDv360Reach(), [] as Awaited<ReturnType<typeof getDv360Reach>>),
    safe(getFxRates(), {} as Record<string, number>),
    safe(getPlanningMonthly(), {} as PlanningByMes),
    safe(getGoogleAdsOmd(), [] as Awaited<ReturnType<typeof getGoogleAdsOmd>>),
    safe(getGoogleAdsCreatives(), [] as Awaited<ReturnType<typeof getGoogleAdsCreatives>>),
    // Frescura real por fuente (la tabla "Por Medio" sale de DV360 + Meta paid).
    safe(maxUpdatedAt("dv360_creatives"), null),
    safe(maxUpdatedAt("meta_paid_creatives", "principal", "fetched_at"), null),
    safe(maxUpdatedAt("pauta_performance"), null),
    safe(maxUpdatedAt("ga4_google_ads_daily", "principal", "updated_at"), null),
    // Inversión ecommerce (Google Ads inhouse, rol Conversión) — componente del funnel.
    safe(getEcommerceInversionMensual(new Date().getFullYear()), Array.from({ length: 12 }, () => null) as (number | null)[]),
    // Moneda (?moneda=corrientes|constantes|usd): índices de indices_macro (0110), fail-safe.
    monedaContext(searchParams?.moneda),
  ]);
  // Conversión server-side ANTES del cliente (portado de BIP): corrientes = mismos objetos.
  const { ctx, aviso } = mon;
  const col: ConvCollector = { faltantes: new Set() };
  const data = convertirFilas(ctx, rawData, (r) => r.mes, ["inversion", "inversion_plan", "costo", "costo_plan"], col);
  const metaPaid = convertirFilas(ctx, rawMetaPaid, (r) => r.mes, ["spend", "cpm", "cpc"], col);
  const dv360 = convertirFilas(ctx, rawDv360, (r) => r.mes, ["revenue_usd"], col);
  const dv360Reach = convertirFilas(ctx, rawDv360Reach, (r) => r.mes, ["revenue_usd"], col);
  const googleAdsOmd = convertirFilas(ctx, rawGadsOmd, (r) => r.mes, ["costo"], col);
  const googleAdsCreatives = convertirFilas(ctx, rawGadsCreatives, (r) => r.mes, ["cost"], col);
  const planningMonthly = convertirPorMes(ctx, rawPlanning, col);
  const ecomInv = convertir12(ctx, currentYear, rawEcomInv, col);
  // Metas mensuales de los 6 KPIs de Impacto Campaña (plan "Pauta Mkt"), en paralelo.
  // + inversión diaria por medio con API (Eficiencia Medios; REST, tablas chicas, $ corrientes).
  // + miniaturas DV360 (manifiesto del cron dv360-thumbs; solo nombre → url, fail-safe {}).
  const [metasArr, pautaDiaria, dv360Thumbs] = await Promise.all([
    Promise.all(PAUTA_KPIS.map((kpi) => safe(getMetaKpi("Pauta Mkt", kpi, currentYear), META_FALLBACK))),
    safe(getPautaDiaria(), null),
    safe(getDv360ThumbMap(rawDv360.map((r) => r.creative)), {} as Awaited<ReturnType<typeof getDv360ThumbMap>>),
  ]);
  const metas = Object.fromEntries(PAUTA_KPIS.map((kpi, i) => [kpi, metasArr[i] ?? META_FALLBACK])) as Record<(typeof PAUTA_KPIS)[number], MetaKpiData>;
  // La meta de Inversión ($) se lleva a la misma moneda que el real.
  if (ctx.moneda !== "corrientes") metas["Inversión"] = { ...metas["Inversión"], valores: convertir12(ctx, currentYear, metas["Inversión"].valores) };
  const headerExtra = (
    <div className="flex flex-col items-end gap-1.5">
      <Suspense fallback={null}>
        <MonedaSelector
          actual={ctx.moneda}
          baseLabel={ctx.idx.ultimoIpc ? mesLabel(ctx.idx.ultimoIpc) : null}
          disponible={{ ipc: ctx.idx.ipc.size > 0, usd: ctx.idx.usd.size > 0 }}
          notas={[aviso, avisoFaltantes(ctx, [...col.faltantes])]}
        />
      </Suspense>
      <DataHealth dash="performance" />
    </div>
  );
  return (
    <PerformanceClient headerExtra={headerExtra} initialTab={searchParams?.tab ?? (searchParams?.vista === "diagnostico" ? "diagnostico" : undefined)} data={data} metaPaid={metaPaid} dv360={dv360} dv360Reach={dv360Reach} fxRates={fxRates} planningMonthly={planningMonthly} googleAdsOmd={googleAdsOmd} googleAdsCreatives={googleAdsCreatives} freshness={{ dv360: fDv360, meta: fMeta, omd: fOmd, gads: fGads }} metas={metas} ecommerceInv={ecomInv} pautaDiaria={pautaDiaria} dv360Thumbs={dv360Thumbs} />
  );
}
