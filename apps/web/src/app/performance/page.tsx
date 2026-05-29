import { getPautaPerformance } from "@/lib/pauta-queries";
import { PerformanceClient } from "@/components/pauta/performance-client";

export const dynamic = "force-dynamic";

export default async function PerformancePautaPage() {
  const data = await getPautaPerformance();
  return <PerformanceClient data={data} />;
}
