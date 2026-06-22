import { getInfluenciaPerformance } from "@/lib/pauta-queries";
import { getMetaUgcCreatives } from "@/lib/meta-paid-queries";
import { InfluenciaClient } from "@/components/pauta/influencia-client";

export const dynamic = "force-dynamic";

async function safe<T>(p: Promise<T>, fallback: T): Promise<T> {
  try {
    return await p;
  } catch {
    return fallback;
  }
}

export default async function InfluenciaPage() {
  const [rows, ugcCreatives] = await Promise.all([
    safe(getInfluenciaPerformance(), [] as Awaited<ReturnType<typeof getInfluenciaPerformance>>),
    safe(getMetaUgcCreatives(), [] as Awaited<ReturnType<typeof getMetaUgcCreatives>>),
  ]);

  return <InfluenciaClient rows={rows} ugcCreatives={ugcCreatives} />;
}
