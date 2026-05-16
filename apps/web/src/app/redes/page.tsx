import { KpiCard } from "@/components/kpi-card";
import { DateRangeInfo } from "@/components/date-range-info";
import { SentimentBar } from "@/components/sentiment-bar";
import { EngagementTrendChart } from "@/components/engagement-trend-chart";
import { PilarChart } from "@/components/pilar-chart";
import {
  getBrandBenchmark,
  getEngagementTrend,
  getPilarBreakdown,
  getSocialTotals,
  OWN_BRAND,
} from "@/lib/social-queries";
import { parseDateRange } from "@/lib/dates";
import { formatNumber, formatPct } from "@/lib/utils";

interface PageProps {
  searchParams: Record<string, string | string[] | undefined>;
}

export default async function CompetitorsPage({ searchParams }: PageProps) {
  const range = parseDateRange(searchParams);

  const [totals, benchmark, pilarBreakdown, trend] = await Promise.all([
    getSocialTotals(range),
    getBrandBenchmark(range),
    getPilarBreakdown(),
    getEngagementTrend(range),
  ]);

  const hasData = benchmark.length > 0;

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Redes Sociales</h2>
          <p className="text-sm text-muted-foreground">
            Métricas sociales de Drean y competidores. La parte web está en <strong>/web</strong>.
          </p>
        </div>
        <DateRangeInfo range={range} />
      </header>

      {!hasData && (
        <div className="rounded-lg border bg-amber-50 p-4 text-sm text-amber-900">
          <strong>Sin datos sociales todavía.</strong> Aplicá la migración{" "}
          <code>0003_extend_social_schema.sql</code> en Supabase, importá el workflow{" "}
          <code>sheets-social-sync.json</code> en N8N y poblá el Sheet con el scraper.
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Posts (propios)"
          value={formatNumber(totals.posts)}
          hint={`@${OWN_BRAND}`}
        />
        <KpiCard
          title="Engagement promedio"
          value={
            totals.engagement_promedio !== null
              ? formatPct(totals.engagement_promedio, 2)
              : "—"
          }
        />
        <KpiCard
          title="Sentiment positivo"
          value={
            totals.sentiment_positivo_promedio !== null
              ? `${totals.sentiment_positivo_promedio.toFixed(0)}%`
              : "—"
          }
        />
        <KpiCard
          title="Followers"
          value={totals.followers > 0 ? formatNumber(totals.followers) : "—"}
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border bg-card p-6">
          <header className="mb-4">
            <h3 className="text-sm font-medium text-muted-foreground">
              Engagement por marca
            </h3>
            <p className="text-xs text-muted-foreground">
              Likes + comentarios / posts, por día.
            </p>
          </header>
          <EngagementTrendChart data={trend} />
        </div>
        <div className="rounded-lg border bg-card p-6">
          <header className="mb-4">
            <h3 className="text-sm font-medium text-muted-foreground">
              Posts por pilar
            </h3>
            <p className="text-xs text-muted-foreground">
              Distribución de contenido (Producto, Branding, Educacional, Promo).
            </p>
          </header>
          <PilarChart data={pilarBreakdown} />
        </div>
      </section>

      <section className="rounded-lg border bg-card">
        <header className="border-b p-6 pb-4">
          <h3 className="text-sm font-medium text-muted-foreground">
            Benchmark — Drean vs Competidores
          </h3>
          <p className="text-xs text-muted-foreground">
            Métricas agregadas en el rango seleccionado.
          </p>
        </header>
        {benchmark.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            Sin datos para mostrar.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40">
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2">Marca</th>
                  <th className="px-4 py-2 text-right">Posts</th>
                  <th className="px-4 py-2 text-right">Likes</th>
                  <th className="px-4 py-2 text-right">Comentarios</th>
                  <th className="px-4 py-2 text-right">Views</th>
                  <th className="px-4 py-2 text-right">Engagement avg</th>
                  <th className="px-4 py-2">Sentiment</th>
                  <th className="px-4 py-2 text-right">Followers</th>
                </tr>
              </thead>
              <tbody>
                {benchmark.map((row) => (
                  <tr key={row.cuenta} className="border-b last:border-0">
                    <td className="px-4 py-2 font-medium">
                      <span className="flex items-center gap-2">
                        @{row.cuenta}
                        {!row.es_competidor && (
                          <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary">
                            propia
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {formatNumber(row.posts)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {formatNumber(row.likes)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {formatNumber(row.comentarios)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {formatNumber(row.views)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {row.engagement_promedio !== null
                        ? row.engagement_promedio.toFixed(1)
                        : "—"}
                    </td>
                    <td className="px-4 py-2" style={{ minWidth: 140 }}>
                      <SentimentBar
                        positivo={row.sentiment_positivo_promedio}
                        negativo={row.sentiment_negativo_promedio}
                        neutro={row.sentiment_neutro_promedio}
                      />
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                      {row.followers > 0 ? formatNumber(row.followers) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
