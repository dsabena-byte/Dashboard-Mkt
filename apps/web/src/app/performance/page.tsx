import { getPautaPerformance } from "@/lib/pauta-queries";
import { getMetaPaidCreatives } from "@/lib/meta-paid-queries";
import { getDv360Performance } from "@/lib/dv360-queries";
import { getPlanningMedia } from "@/lib/planning-media-queries";
import { PerformanceClient } from "@/components/pauta/performance-client";

export const dynamic = "force-dynamic";

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

export default async function PerformancePautaPage() {
  const [data, metaPaid, dv360, planningMonthly] = await Promise.all([
    getPautaPerformance(),
    safe(getMetaPaidCreatives(), [] as Awaited<ReturnType<typeof getMetaPaidCreatives>>),
    safe(getDv360Performance(), [] as Awaited<ReturnType<typeof getDv360Performance>>),
    safe(getPlanningMonthly(), {} as PlanningByMes),
  ]);
  return <PerformanceClient data={data} metaPaid={metaPaid} dv360={dv360} planningMonthly={planningMonthly} />;
}
