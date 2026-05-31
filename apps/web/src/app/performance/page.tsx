import { getPautaPerformance } from "@/lib/pauta-queries";
import { getMetaPaidCreatives } from "@/lib/meta-paid-queries";
import { PerformanceClient } from "@/components/pauta/performance-client";

export const dynamic = "force-dynamic";

async function safe<T>(p: Promise<T>, fallback: T): Promise<T> {
  try {
    return await p;
  } catch {
    return fallback;
  }
}

export default async function PerformancePautaPage() {
  const [data, metaPaid] = await Promise.all([
    getPautaPerformance(),
    safe(getMetaPaidCreatives(), [] as Awaited<ReturnType<typeof getMetaPaidCreatives>>),
  ]);
  return <PerformanceClient data={data} metaPaid={metaPaid} />;
}
