import { SeoSearchClient } from "@/components/seo-search/seo-search-client";
import { SeoOrganicoSection } from "@/components/seo-search/seo-organico-section";
import { getShareOfSearch, getTrendsInterest, getDemandaGenerica, getSeoOverview, getKeywordGap, getDreanRankings } from "@/lib/competitive-queries";

export const dynamic = "force-dynamic";

export default async function SeoSearchPage() {
  const [share, trends, demanda, seoOverview, gap, rankings] = await Promise.all([
    getShareOfSearch().catch(() => []),
    getTrendsInterest().catch(() => []),
    getDemandaGenerica().catch(() => []),
    getSeoOverview().catch(() => []),
    getKeywordGap().catch(() => []),
    getDreanRankings().catch(() => []),
  ]);

  const sinData = share.length === 0;

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-4 md:p-6">
      <header>
        <h1 className="text-xl font-bold">Análisis SEO / Search</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Inteligencia competitiva de demanda: <strong>Share of Search</strong> (predice el market share) e interés de
          búsqueda de Drean vs el set de electrodomésticos en Argentina.
        </p>
      </header>

      {sinData ? (
        <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
          Todavía no hay data cargada. Corré el sync de demanda (workflow <code>Trends sync</code>) para poblar el Share of
          Search.
        </div>
      ) : (
        <SeoSearchClient share={share} trends={trends} demanda={demanda} />
      )}

      {seoOverview.length > 0 && (
        <div className="border-t pt-6">
          <SeoOrganicoSection overview={seoOverview} gap={gap} rankings={rankings} />
        </div>
      )}
    </div>
  );
}
