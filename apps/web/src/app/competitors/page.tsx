import { KpiCard } from "@/components/kpi-card";
import { DateRangeInfo } from "@/components/date-range-info";
import { SentimentBar } from "@/components/sentiment-bar";
import { EngagementTrendChart } from "@/components/engagement-trend-chart";
import { PilarChart } from "@/components/pilar-chart";
import { CompetitorMonthlyChart } from "@/components/competitor-monthly-chart";
import { KpiBarPanel } from "@/components/kpi-bar-panel";
import {
  getBrandBenchmark,
  getEngagementTrend,
  getPilarBreakdown,
  getSocialTotals,
  OWN_BRAND,
} from "@/lib/social-queries";
import {
  getCompetitorByCategoria,
  getCompetitorKeywords,
  getCompetitorMonthlyHistory,
  getCompetitorTrafficSources,
  getCompetitorWebSnapshot,
  getDreanWebMetrics,
  getGoogleTrends,
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
    webSnapshotRaw,
    monthlyHistoryRaw,
    trafficSources,
    keywords,
    porCategoria,
    googleTrends,
    dreanGa4,
  ] = await Promise.all([
    getSocialTotals(range),
    getBrandBenchmark(range),
    getPilarBreakdown(),
    getEngagementTrend(range),
    getCompetitorWebSnapshot(),
    getCompetitorMonthlyHistory(),
    getCompetitorTrafficSources(),
    getCompetitorKeywords(10),
    getCompetitorByCategoria(),
    getGoogleTrends(),
    getDreanWebMetrics(),
  ]);

  // Para Drean usamos GA4 (real) en lugar de la estimación de SimilarWeb.
  // Reemplazamos su fila en webSnapshot y su entrada en monthlyHistory.
  const webSnapshot = webSnapshotRaw.map((r) => {
    if (r.competidor !== "Drean" || !dreanGa4) return r;
    return {
      ...r,
      fecha: dreanGa4.fecha,
      visitas_estimadas: dreanGa4.visitas_estimadas,
      bounce_rate: dreanGa4.bounce_rate,
      pages_per_visit: dreanGa4.pages_per_visit,
      avg_visit_duration: dreanGa4.avg_visit_duration,
    };
  });
  const monthlyHistory = monthlyHistoryRaw.map((m) => {
    if (m.competidor !== "Drean" || !dreanGa4) return m;
    return { ...m, meses: dreanGa4.meses };
  });

  // Agrupar trends por keyword para el gráfico
  const trendsByKw = new Map<string, Array<{ fecha: string; interes: number }>>();
  for (const t of googleTrends) {
    if (!trendsByKw.has(t.keyword)) trendsByKw.set(t.keyword, []);
    trendsByKw.get(t.keyword)!.push({ fecha: t.fecha, interes: t.interes });
  }

  // Estadísticas mensuales por competidor — para la tabla y el cálculo de desvíos MoM
  const MONTH_LABELS_FULL = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  const fmtMonthFull = (fecha: string) => {
    const [y, m] = fecha.split("-");
    return `${MONTH_LABELS_FULL[parseInt(m ?? "1", 10) - 1] ?? m} ${y}`;
  };
  const fmtMonthShort = (fecha: string) => {
    const [y, m] = fecha.split("-");
    const short = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
    return `${short[parseInt(m ?? "1", 10) - 1] ?? m} ${y?.slice(2) ?? ""}`;
  };

  const allMeses = [...new Set(monthlyHistory.flatMap((m) => m.meses.map((x) => x.fecha)))].sort();
  const latestMonth = allMeses[allMeses.length - 1] ?? null;
  const previousMonth = allMeses[allMeses.length - 2] ?? null;

  const monthlyStats = new Map<
    string,
    { ultima: { fecha: string; visitas: number } | null; anterior: { fecha: string; visitas: number } | null; deltaPct: number | null }
  >();
  for (const m of monthlyHistory) {
    const meses = [...m.meses].sort((a, b) => a.fecha.localeCompare(b.fecha));
    const ultima = meses[meses.length - 1] ?? null;
    const anterior = meses[meses.length - 2] ?? null;
    const deltaPct = ultima && anterior && anterior.visitas > 0
      ? (ultima.visitas - anterior.visitas) / anterior.visitas
      : null;
    monthlyStats.set(m.competidor, { ultima, anterior, deltaPct });
  }

  // Agrupar tráfico por categoría: filas = categoria, columnas = competidor
  const categorias = [...new Set(porCategoria.map((r) => r.categoria))].sort();
  const competidoresEnCat = [...new Set(porCategoria.map((r) => r.competidor))].sort();

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

      <section className="rounded-lg border bg-card">
        <header className="border-b p-6 pb-4">
          <h3 className="text-sm font-medium text-muted-foreground">
            Tráfico web — Benchmark de dominios
          </h3>
          <p className="text-xs text-muted-foreground">
            Estimaciones mensuales de SimilarWeb. Período mostrado:{" "}
            <strong>{latestMonth ? fmtMonthFull(latestMonth) : "—"}</strong>
            {previousMonth && (
              <>
                {" "}· Δ comparado contra <strong>{fmtMonthFull(previousMonth)}</strong>
              </>
            )}.
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
                  <th className="px-4 py-2 text-right">
                    Visitas {latestMonth ? `(${fmtMonthShort(latestMonth)})` : ""}
                  </th>
                  <th className="px-4 py-2 text-right">
                    Δ MoM {previousMonth ? `(vs ${fmtMonthShort(previousMonth)})` : ""}
                  </th>
                  <th className="px-4 py-2 text-right">Bounce rate</th>
                  <th className="px-4 py-2 text-right">Pages/visit</th>
                  <th className="px-4 py-2 text-right">Avg duration</th>
                </tr>
              </thead>
              <tbody>
                {webSnapshot.map((row) => {
                  const stats = monthlyStats.get(row.competidor);
                  const visitasMes = stats?.ultima?.visitas ?? row.visitas_estimadas;
                  const deltaPct = stats?.deltaPct ?? null;
                  const isSpike = deltaPct !== null && deltaPct > 0.2;
                  const isDrop = deltaPct !== null && deltaPct < -0.2;
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
                        {visitasMes !== null ? formatNumber(visitasMes) : "—"}
                      </td>
                      <td
                        className={`px-4 py-2 text-right tabular-nums ${
                          isSpike ? "text-emerald-600 font-medium" : isDrop ? "text-rose-600 font-medium" : "text-muted-foreground"
                        }`}
                      >
                        {deltaPct !== null
                          ? `${deltaPct > 0 ? "+" : ""}${(deltaPct * 100).toFixed(1)}%`
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
          Historia mensual de visitas (SimilarWeb)
        </h3>
        <p className="text-xs text-muted-foreground">
          Últimos meses reportados por SimilarWeb por competidor. Picos sostenidos = campaña activa.
        </p>
        <div className="mt-4">
          <CompetitorMonthlyChart data={monthlyHistory} />
        </div>
      </section>

      {/* Calidad del tráfico — bounce, pages/visit, avg duration */}
      {webSnapshot.length > 0 && (
        <section className="rounded-lg border bg-card p-6">
          <h3 className="text-sm font-medium text-muted-foreground">
            Calidad del tráfico — engagement web
          </h3>
          <p className="text-xs text-muted-foreground">
            Comparativa de comportamiento de usuario por sitio. <strong>Bounce rate</strong> bajo = visitan más de 1 página.
            <strong> Pages/visit</strong> alto = exploran más. <strong>Avg duration</strong> alto = se quedan más tiempo.
          </p>
          <div className="mt-6 grid gap-6 md:grid-cols-3">
            <KpiBarPanel
              title="Bounce rate"
              subtitle="Menor es mejor"
              data={[...webSnapshot]
                .filter((r) => r.bounce_rate !== null)
                .map((r) => ({ label: r.competidor, value: (r.bounce_rate ?? 0) * 100, display: `${((r.bounce_rate ?? 0) * 100).toFixed(1)}%` }))
                .sort((a, b) => a.value - b.value)}
              colorBy="reverse"
              maxLabel="%"
            />
            <KpiBarPanel
              title="Pages / visit"
              subtitle="Mayor es mejor"
              data={[...webSnapshot]
                .filter((r) => r.pages_per_visit !== null)
                .map((r) => ({ label: r.competidor, value: r.pages_per_visit ?? 0, display: (r.pages_per_visit ?? 0).toFixed(2) }))
                .sort((a, b) => b.value - a.value)}
              colorBy="direct"
            />
            <KpiBarPanel
              title="Avg duration"
              subtitle="Mayor es mejor"
              data={[...webSnapshot]
                .filter((r) => r.avg_visit_duration !== null)
                .map((r) => ({ label: r.competidor, value: r.avg_visit_duration ?? 0, display: `${Math.round(r.avg_visit_duration ?? 0)}s` }))
                .sort((a, b) => b.value - a.value)}
              colorBy="direct"
            />
          </div>
        </section>
      )}

      {porCategoria.length > 0 && (
        <section className="rounded-lg border bg-card p-6">
          <h3 className="text-sm font-medium text-muted-foreground">
            Tráfico por categoría
          </h3>
          <p className="text-xs text-muted-foreground">
            Tráfico orgánico estimado a las secciones por categoría de cada competidor.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40">
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2">Categoría</th>
                  {competidoresEnCat.map((c) => (
                    <th key={c} className="px-3 py-2 text-right">{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {categorias.map((cat) => (
                  <tr key={cat} className="border-b last:border-0">
                    <td className="px-3 py-2 font-medium">{cat}</td>
                    {competidoresEnCat.map((c) => {
                      const r = porCategoria.find((x) => x.categoria === cat && x.competidor === c);
                      return (
                        <td key={c} className="px-3 py-2 text-right tabular-nums">
                          {r?.visitas_estimadas ? formatNumber(r.visitas_estimadas) : "—"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {googleTrends.length > 0 && (
        <section className="rounded-lg border bg-card p-6">
          <h3 className="text-sm font-medium text-muted-foreground">
            Interés de búsqueda — Google Trends (AR)
          </h3>
          <p className="text-xs text-muted-foreground">
            Escala 0-100 por keyword. Útil para ver qué marca está pujando en cada categoría.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {[...trendsByKw.entries()].slice(0, 6).map(([kw, points]) => {
              const max = Math.max(...points.map((p) => p.interes), 1);
              return (
                <div key={kw} className="rounded border border-input p-3">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs font-medium">{kw}</span>
                    <span className="text-xs text-muted-foreground">
                      máx {max} · últimos {points.length} puntos
                    </span>
                  </div>
                  <div className="mt-2 flex h-12 items-end gap-0.5">
                    {points.slice(-30).map((p, i) => (
                      <div
                        key={p.fecha + i}
                        title={`${p.fecha}: ${p.interes}`}
                        className="flex-1 rounded-sm bg-primary/70"
                        style={{ height: `${(p.interes / max) * 100}%` }}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {(() => {
        const sourcesConData = trafficSources.filter((r) => r.fuentes.length > 0);
        const keywordsConData = keywords.filter((r) => r.keywords.length > 0);
        if (sourcesConData.length === 0 && keywordsConData.length === 0) return null;
        return (
          <section className="grid gap-4 lg:grid-cols-2">
            {sourcesConData.length > 0 && (
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
                      {sourcesConData.map((row) => (
                        <tr key={row.competidor} className="border-b last:border-0">
                          <td className="px-3 py-2 font-medium align-top">{row.competidor}</td>
                          <td className="px-3 py-2">
                            <div className="flex flex-wrap gap-1.5">
                              {row.fuentes.map((f) => (
                                <span key={f.name} className="rounded-full bg-muted px-2 py-0.5 text-xs">
                                  {f.name}: {(f.value * 100).toFixed(1)}%
                                </span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {keywordsConData.length > 0 && (
              <div className="rounded-lg border bg-card p-6">
                <h3 className="text-sm font-medium text-muted-foreground">
                  Top keywords orgánicas — por competidor
                </h3>
                <p className="text-xs text-muted-foreground">
                  Las 5 palabras clave que más tráfico le traen a cada dominio.
                </p>
                <div className="mt-4 space-y-3">
                  {keywordsConData.map((row) => (
                    <div key={row.competidor} className="rounded border border-input p-3">
                      <div className="text-xs font-medium">{row.competidor}</div>
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
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        );
      })()}

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
