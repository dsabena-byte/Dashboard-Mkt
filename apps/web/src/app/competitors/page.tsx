import { KpiCard } from "@/components/kpi-card";
import { DateRangeInfo } from "@/components/date-range-info";
import { SentimentBar } from "@/components/sentiment-bar";
import { EngagementTrendChart } from "@/components/engagement-trend-chart";
import { PilarChart } from "@/components/pilar-chart";
import { CompetitorTrafficChart } from "@/components/competitor-traffic-chart";
import {
  getBrandBenchmark,
  getEngagementTrend,
  getPilarBreakdown,
  getSocialTotals,
  OWN_BRAND,
} from "@/lib/social-queries";
import {
  getCompetitorKeywords,
  getCompetitorTrafficSources,
  getCompetitorWebHistory,
  getCompetitorWebSnapshot,
} from "@/lib/competitor-web-queries";
import { parseDateRange } from "@/lib/dates";
import { formatNumber, formatPct } from "@/lib/utils";

interface PageProps {
  searchParams: Record<string, string | string[] | undefined>;
}

export default async function CompetitorsPage({ searchParams }: PageProps) {
  const range = parseDateRange(searchParams);

  const [
    totals,
    benchmark,
    pilarBreakdown,
    trend,
    webSnapshot,
    webHistory,
    trafficSources,
    keywords,
  ] = await Promise.all([
    getSocialTotals(range),
    getBrandBenchmark(range),
    getPilarBreakdown(),
    getEngagementTrend(range),
    getCompetitorWebSnapshot(),
    getCompetitorWebHistory(12),
    getCompetitorTrafficSources(),
    getCompetitorKeywords(10),
  ]);

  const hasData = benchmark.length > 0;

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Competencia</h2>
          <p className="text-sm text-muted-foreground">
            Tráfico web (Apify, fase 3) + métricas sociales del scraping de Drean y competidores.
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

      <section className="rounded-lg border bg-card">
        <header className="border-b p-6 pb-4">
          <h3 className="text-sm font-medium text-muted-foreground">
            Tráfico web — Benchmark de dominios
          </h3>
          <p className="text-xs text-muted-foreground">
            Estimaciones mensuales de SimilarWeb (vía Apify). Δ = variación vs snapshot anterior; picos sostenidos suelen indicar campañas activas.
          </p>
        </header>
        {webSnapshot.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            Sin datos de tráfico web todavía. Configurá el workflow{" "}
            <code>competitor-web-sync</code> en N8N para empezar a popular la tabla{" "}
            <code>competitor_web</code>.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40">
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2">Competidor</th>
                  <th className="px-4 py-2">Dominio</th>
                  <th className="px-4 py-2 text-right">Visitas</th>
                  <th className="px-4 py-2 text-right">Δ vs anterior</th>
                  <th className="px-4 py-2 text-right">Bounce rate</th>
                  <th className="px-4 py-2 text-right">Pages/visit</th>
                  <th className="px-4 py-2 text-right">Avg duration</th>
                  <th className="px-4 py-2 text-right">Última actualización</th>
                </tr>
              </thead>
              <tbody>
                {webSnapshot.map((row) => {
                  const isSpike = row.deltaVisitasPct !== null && row.deltaVisitasPct > 0.2;
                  const isDrop = row.deltaVisitasPct !== null && row.deltaVisitasPct < -0.2;
                  return (
                    <tr key={row.competidor} className="border-b last:border-0">
                      <td className="px-4 py-2 font-medium">
                        {row.competidor}
                        {isSpike && (
                          <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                            🔥 pico
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">{row.dominio}</td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {row.visitas_estimadas !== null ? formatNumber(row.visitas_estimadas) : "—"}
                      </td>
                      <td
                        className={`px-4 py-2 text-right tabular-nums ${
                          isSpike ? "text-emerald-600 font-medium" : isDrop ? "text-rose-600" : "text-muted-foreground"
                        }`}
                      >
                        {row.deltaVisitasPct !== null
                          ? `${row.deltaVisitasPct > 0 ? "+" : ""}${(row.deltaVisitasPct * 100).toFixed(1)}%`
                          : "—"}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {row.bounce_rate !== null ? formatPct(row.bounce_rate * 100, 1) : "—"}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {row.pages_per_visit !== null ? row.pages_per_visit.toFixed(2) : "—"}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {row.avg_visit_duration !== null ? `${Math.round(row.avg_visit_duration)}s` : "—"}
                      </td>
                      <td className="px-4 py-2 text-right text-xs text-muted-foreground">
                        {row.fecha}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-lg border bg-card p-6">
        <h3 className="text-sm font-medium text-muted-foreground">
          Evolución de visitas — últimos snapshots
        </h3>
        <p className="text-xs text-muted-foreground">
          Cada punto es una ejecución del workflow. Cuantos más snapshots tengamos, más visible se vuelven los picos de campañas.
        </p>
        <div className="mt-4">
          <CompetitorTrafficChart series={webHistory} />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-sm font-medium text-muted-foreground">
            Fuentes de tráfico por competidor
          </h3>
          <p className="text-xs text-muted-foreground">Mix actual (último snapshot).</p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40">
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2">Competidor</th>
                  <th className="px-3 py-2">Top fuentes (% del tráfico)</th>
                </tr>
              </thead>
              <tbody>
                {trafficSources.map((row) => (
                  <tr key={row.competidor} className="border-b last:border-0">
                    <td className="px-3 py-2 font-medium align-top">{row.competidor}</td>
                    <td className="px-3 py-2">
                      {row.fuentes.length === 0 ? (
                        <span className="text-xs text-muted-foreground">Sin breakdown</span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {row.fuentes.map((f) => (
                            <span
                              key={f.name}
                              className="rounded-full bg-muted px-2 py-0.5 text-xs"
                            >
                              {f.name}: {(f.value * 100).toFixed(1)}%
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-sm font-medium text-muted-foreground">
            Top keywords orgánicas — por competidor
          </h3>
          <p className="text-xs text-muted-foreground">
            Las 5 palabras clave que más tráfico le traen a cada dominio.
          </p>
          <div className="mt-4 space-y-3">
            {keywords.map((row) => (
              <div key={row.competidor} className="rounded border border-input p-3">
                <div className="text-xs font-medium">{row.competidor}</div>
                {row.keywords.length === 0 ? (
                  <div className="mt-1 text-xs text-muted-foreground">Sin data de keywords</div>
                ) : (
                  <ol className="mt-1 grid gap-0.5 text-xs">
                    {row.keywords.slice(0, 5).map((k, i) => (
                      <li key={k.keyword + i} className="flex justify-between gap-2">
                        <span className="truncate">
                          {i + 1}. {k.keyword}
                        </span>
                        {k.visits !== null && (
                          <span className="tabular-nums text-muted-foreground">
                            {formatNumber(k.visits)}
                          </span>
                        )}
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
