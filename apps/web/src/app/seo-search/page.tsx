import { SeoSearchClient } from "@/components/seo-search/seo-search-client";
import { SeoCompetitivoSection } from "@/components/seo-search/seo-competitivo-section";
import { RegionSection } from "@/components/seo-search/region-section";
import { LlmoSection } from "@/components/seo-search/llmo-section";
import { getShareOfSearch, getTrendsInterest, getDemandaGenerica, getSeoCompetitivo, getSearchRegion, getSeoIndexHistory, getLlmo, getSeoFreshness } from "@/lib/competitive-queries";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

// dd/mm hh:mm en hora argentina (o "—" si no hay fecha).
function fechaCorta(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}
function Fresh({ label, date }: { label: string; date: string | null }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${date ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />
      {label}: <span className="font-medium text-foreground/70">{fechaCorta(date)}</span>
    </span>
  );
}

export default async function SeoSearchPage() {
  const [share, trends, demanda, seoCompetitivo, region, indexHist, llmo, fresh] = await Promise.all([
    getShareOfSearch().catch(() => []),
    getTrendsInterest().catch(() => []),
    getDemandaGenerica().catch(() => []),
    getSeoCompetitivo().catch(() => []),
    getSearchRegion().catch(() => []),
    getSeoIndexHistory().catch(() => []),
    getLlmo().catch(() => []),
    getSeoFreshness().catch(() => ({ demanda: null, trends: null, serp: null, region: null, indice: null, llmo: null })),
  ]);

  const sinData = share.length === 0;

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-4 md:p-6">
      <header>
        <h1 className="text-xl font-bold">Análisis SEO / Search</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Inteligencia competitiva de demanda: <strong>Share of Search</strong> (predice la intención de compra) e interés de
          búsqueda de Drean vs el set de electrodomésticos en Argentina.
        </p>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
          <Fresh label="Demanda / Share" date={fresh.demanda} />
          <Fresh label="Trends" date={fresh.trends} />
          <Fresh label="Posición / SEO" date={fresh.serp} />
          <Fresh label="Provincias" date={fresh.region} />
          <Fresh label="Índice histórico" date={fresh.indice} />
          <Fresh label="Visibilidad IA" date={fresh.llmo} />
        </div>
      </header>

      {sinData ? (
        <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
          Todavía no hay data cargada. Corré el sync de demanda (workflow <code>Trends sync</code>) para poblar el Share of
          Search.
        </div>
      ) : (
        <SeoSearchClient share={share} trends={trends} demanda={demanda} />
      )}

      {region.length > 0 && (
        <div className="border-t pt-6">
          <RegionSection rows={region} />
        </div>
      )}

      {seoCompetitivo.length > 0 && (
        <div className="border-t pt-6">
          <SeoCompetitivoSection rows={seoCompetitivo} historia={indexHist} />
        </div>
      )}

      {llmo.length > 0 && (
        <div className="border-t pt-6">
          <LlmoSection rows={llmo} />
        </div>
      )}
    </div>
  );
}
