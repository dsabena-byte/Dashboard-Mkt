import { getInfluenciaPerformance } from "@/lib/pauta-queries";
import { getMetaUgcCreatives } from "@/lib/meta-paid-queries";
import { getUgcAnalysis } from "@/lib/ugc-analysis-queries";
import { maxUpdatedAt } from "@/lib/freshness-queries";
import { getTikTokPiezas } from "@/lib/tiktok-piezas-server";
import { InfluenciaClient } from "@/components/pauta/influencia-client";
import { DashTabs } from "@/components/diagnostico/dash-tabs";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

async function safe<T>(p: Promise<T>, fallback: T): Promise<T> {
  try {
    return await p;
  } catch {
    return fallback;
  }
}

export default async function InfluenciaPage() {
  const [rows, ugcCreatives, ugcAnalysis, lastUpdated, tiktok] = await Promise.all([
    safe(getInfluenciaPerformance(), [] as Awaited<ReturnType<typeof getInfluenciaPerformance>>),
    safe(getMetaUgcCreatives(), [] as Awaited<ReturnType<typeof getMetaUgcCreatives>>),
    safe(getUgcAnalysis(), [] as Awaited<ReturnType<typeof getUgcAnalysis>>),
    safe(maxUpdatedAt("pauta_performance"), null),
    safe(getTikTokPiezas(), null),
  ]);

  return (
    <DashTabs dash="influencia">
      <InfluenciaClient rows={rows} ugcCreatives={ugcCreatives} ugcAnalysis={ugcAnalysis} lastUpdated={lastUpdated} tiktokUgc={(tiktok?.items ?? []).filter((p) => p.categoria === "UGC")} />
    </DashTabs>
  );
}
