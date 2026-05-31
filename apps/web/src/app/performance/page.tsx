import { getPautaPerformance } from "@/lib/pauta-queries";
import { getMetaPaidCreatives } from "@/lib/meta-paid-queries";
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

function bucketForChart(sistema: string | null): "digital" | "tvCable" | "dooh" | "ooh" {
  if (!sistema) return "digital";
  const s = sistema.toUpperCase();
  if (s.includes("TV CABLE") || s === "TVC" || s === "TVA") return "tvCable";
  if (s === "DOOH") return "dooh";
  if (s === "OOH" || s.includes("VÍA PÚBLICA") || s.includes("VIA PUBLICA")) return "ooh";
  return "digital";
}

export type PlanningByMes = Record<string, { digital: number; tvCable: number; dooh: number; ooh: number }>;

async function getPlanningMonthly(): Promise<PlanningByMes> {
  const rows = await getPlanningMedia({});
  const acc: PlanningByMes = {};
  for (const r of rows) {
    if (r.tipo !== "media") continue;
    const mes = fechaToMesLabel(r.fecha);
    const b = bucketForChart(r.sistema);
    if (!acc[mes]) acc[mes] = { digital: 0, tvCable: 0, dooh: 0, ooh: 0 };
    acc[mes][b] += r.inversion ?? 0;
  }
  return acc;
}

export default async function PerformancePautaPage() {
  const [data, metaPaid, planningMonthly] = await Promise.all([
    getPautaPerformance(),
    safe(getMetaPaidCreatives(), [] as Awaited<ReturnType<typeof getMetaPaidCreatives>>),
    safe(getPlanningMonthly(), {} as PlanningByMes),
  ]);
  return <PerformanceClient data={data} metaPaid={metaPaid} planningMonthly={planningMonthly} />;
}
