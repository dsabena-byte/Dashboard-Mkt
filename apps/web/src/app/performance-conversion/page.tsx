import { getConversionDaily, getConversionItems } from "@/lib/pauta-conversion-queries";
import { PerformanceConversionClient } from "@/components/pauta/performance-conversion-client";

export const dynamic = "force-dynamic";

async function safe<T>(p: Promise<T>, fallback: T): Promise<T> {
  try {
    return await p;
  } catch {
    return fallback;
  }
}

export default async function PerformancePautaConversionPage() {
  const [rows, items] = await Promise.all([
    safe(getConversionDaily(), [] as Awaited<ReturnType<typeof getConversionDaily>>),
    safe(getConversionItems(), [] as Awaited<ReturnType<typeof getConversionItems>>),
  ]);
  return <PerformanceConversionClient rows={rows} items={items} />;
}
