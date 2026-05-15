import { KpiCard } from "@/components/kpi-card";
import { DateRangeInfo } from "@/components/date-range-info";
import { DonutChart } from "@/components/planning/donut-chart";
import {
  aggregateByCategory,
  aggregateBySource,
  aggregateDaily,
  getWebByCategory,
  getWebBySource,
  getWebDailyKpis,
  getWebTopLandingPages,
  PALETA_CANAL,
  PALETA_CATEGORIA,
} from "@/lib/web-queries";
import { parseDateRange } from "@/lib/dates";
import { formatNumber, formatPct } from "@/lib/utils";
import { EngagementTrendChart } from "@/components/engagement-trend-chart";

interface PageProps {
  searchParams: Record<string, string | string[] | undefined>;
}

function previousRange(from: string, to: string): { from: string; to: string } {
  const f = new Date(`${from}T00:00:00Z`);
  const t = new Date(`${to}T00:00:00Z`);
  const days = Math.round((t.getTime() - f.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const prevTo = new Date(f);
  prevTo.setUTCDate(prevTo.getUTCDate() - 1);
  const prevFrom = new Date(prevTo);
  prevFrom.setUTCDate(prevFrom.getUTCDate() - (days - 1));
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { from: iso(prevFrom), to: iso(prevTo) };
}

function pctChange(curr: number, prev: number): number | null {
  if (prev === 0) return null;
  return (curr - prev) / prev;
}

function formatDelta(delta: number | null): string {
  if (delta === null) return "vs período anterior: —";
  const pct = delta * 100;
  const arrow = pct > 0 ? "▲" : pct < 0 ? "▼" : "•";
  return `${arrow} ${pct > 0 ? "+" : ""}${pct.toFixed(1)}% vs período anterior`;
}

export default async function WebPage({ searchParams }: PageProps) {
  const range = parseDateRange(searchParams);
  const prev = previousRange(range.from, range.to);

  const [dailyKpis, bySource, byCategory, topLandings, dailyKpisPrev] = await Promise.all([
    getWebDailyKpis(range),
    getWebBySource(range),
    getWebByCategory(range),
    getWebTopLandingPages(20),
    getWebDailyKpis(prev),
  ]);

  const totals = aggregateDaily(dailyKpis);
  const totalsPrev = aggregateDaily(dailyKpisPrev);
  const channels = aggregateBySource(bySource);
  const categories = aggregateByCategory(byCategory);

  const deltaSesiones = pctChange(totals.sesiones, totalsPrev.sesiones);
  const deltaConversiones = pctChange(totals.conversiones, totalsPrev.conversiones);
  const deltaCR = (totals.conversion_rate !== null && totalsPrev.conversion_rate !== null && totalsPrev.conversion_rate > 0)
    ? (totals.conversion_rate - totalsPrev.conversion_rate) / totalsPrev.conversion_rate
    : null;

  const hasData = dailyKpis.length > 0;

  // Trend data for the line chart
  const trendData = dailyKpis.map((r) => ({
    fecha: r.fecha,
    drean: r.sesiones,
  }));

  const channelDonut = channels.map((c) => ({
    name: c.canal,
    value: c.sesiones,
    color: PALETA_CANAL[c.canal] ?? "#94a3b8",
  })).filter((c) => c.value > 0);

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Web · Drean</h2>
          <p className="text-sm text-muted-foreground">
            Tráfico real de Google Analytics 4 (drean.com.ar) — performance, canales, categorías y top landings.
          </p>
        </div>
        <DateRangeInfo range={range} />
      </header>

      {!hasData && (
        <div className="rounded-lg border bg-amber-50 p-4 text-sm text-amber-900">
          Sin datos GA4 en este rango. Probá un rango más amplio o ejecutá el workflow{" "}
          <code>ga4-web-traffic-sync</code> en N8N.
        </div>
      )}

      {/* KPIs principales */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Sesiones"
          value={formatNumber(totals.sesiones)}
          hint={formatDelta(deltaSesiones)}
        />
        <KpiCard
          title="Conversiones"
          value={formatNumber(totals.conversiones)}
          hint={formatDelta(deltaConversiones)}
        />
        <KpiCard
          title="Conversion rate"
          value={totals.conversion_rate !== null ? `${(totals.conversion_rate * 100).toFixed(2)}%` : "—"}
          hint={formatDelta(deltaCR)}
        />
        <KpiCard
          title="Pageviews"
          value={formatNumber(totals.pageviews)}
          hint={`${totals.pages_per_session?.toFixed(2) ?? "—"} pages/session`}
        />
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Usuarios totales"
          value={formatNumber(totals.usuarios)}
          hint="únicos en el período"
        />
        <KpiCard
          title="Bounce rate"
          value={totals.bounce_rate !== null ? formatPct(totals.bounce_rate * 100, 1) : "—"}
          hint="GA4 engaged-sessions def"
        />
        <KpiCard
          title="Avg session"
          value={totals.avg_session_duration !== null ? `${Math.round(totals.avg_session_duration)}s` : "—"}
          hint="duración media"
        />
        <KpiCard
          title="Top canal"
          value={channels[0]?.canal ?? "—"}
          hint={channels[0] ? `${formatNumber(channels[0].sesiones)} sesiones` : ""}
        />
      </section>

      {/* Trend diario */}
      <section className="rounded-lg border bg-card p-6">
        <h3 className="text-sm font-medium text-muted-foreground">Tendencia diaria de sesiones</h3>
        <p className="text-xs text-muted-foreground">Sesiones por día en el rango.</p>
        <div className="mt-4">
          <EngagementTrendChart data={trendData.map((d) => ({ fecha: d.fecha, brand: d.drean })) as unknown as Parameters<typeof EngagementTrendChart>[0]["data"]} />
        </div>
      </section>

      {/* Performance por categoría */}
      <section className="rounded-lg border bg-card">
        <header className="border-b p-6 pb-4">
          <h3 className="text-sm font-medium text-muted-foreground">Performance por categoría</h3>
          <p className="text-xs text-muted-foreground">
            Derivado del path de la landing page. Si una URL no matchea Lavado/Refrigeración/Cocinas, cae en "Otros / Home".
          </p>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40">
              <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2">Categoría</th>
                <th className="px-4 py-2 text-right">Sesiones</th>
                <th className="px-4 py-2 text-right">% del total</th>
                <th className="px-4 py-2 text-right">Conversiones</th>
                <th className="px-4 py-2 text-right">CR</th>
                <th className="px-4 py-2 text-right">Bounce rate</th>
                <th className="px-4 py-2 text-right">Pageviews</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((c) => (
                <tr key={c.categoria} className="border-b last:border-0">
                  <td className="px-4 py-2 font-medium">
                    <span
                      className="mr-2 inline-block h-2 w-2 rounded-full align-middle"
                      style={{ backgroundColor: PALETA_CATEGORIA[c.categoria] ?? "#94a3b8" }}
                    />
                    {c.categoria}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatNumber(c.sesiones)}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                    {totals.sesiones > 0 ? `${((c.sesiones / totals.sesiones) * 100).toFixed(1)}%` : "—"}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatNumber(c.conversiones)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {c.conversion_rate !== null ? `${(c.conversion_rate * 100).toFixed(2)}%` : "—"}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {c.bounce_rate !== null ? formatPct(c.bounce_rate * 100, 1) : "—"}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                    {formatNumber(c.pageviews)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Source mix + Top landings */}
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-sm font-medium text-muted-foreground">Mix de canales</h3>
          <p className="text-xs text-muted-foreground">Sesiones por fuente de tráfico.</p>
          <div className="mt-4">
            <DonutChart data={channelDonut} />
          </div>
        </div>

        <div className="rounded-lg border bg-card">
          <header className="border-b p-6 pb-4">
            <h3 className="text-sm font-medium text-muted-foreground">Top 20 landing pages</h3>
            <p className="text-xs text-muted-foreground">Páginas con más sesiones (acumulado all-time).</p>
          </header>
          <div className="max-h-[500px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 border-b bg-muted/40">
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2">Landing</th>
                  <th className="px-4 py-2 text-right">Sesiones</th>
                  <th className="px-4 py-2 text-right">CR</th>
                </tr>
              </thead>
              <tbody>
                {topLandings.map((l) => (
                  <tr key={l.landing_page} className="border-b last:border-0">
                    <td className="px-4 py-2 max-w-xs truncate text-xs" title={l.landing_page}>
                      {l.landing_page}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{formatNumber(l.sesiones)}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                      {l.conversion_rate !== null ? `${(l.conversion_rate * 100).toFixed(2)}%` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Detalle de canales */}
      <section className="rounded-lg border bg-card">
        <header className="border-b p-6 pb-4">
          <h3 className="text-sm font-medium text-muted-foreground">Detalle por canal</h3>
          <p className="text-xs text-muted-foreground">Sesiones y conversiones acumuladas por canal en el rango.</p>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40">
              <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2">Canal</th>
                <th className="px-4 py-2 text-right">Sesiones</th>
                <th className="px-4 py-2 text-right">% total</th>
                <th className="px-4 py-2 text-right">Conversiones</th>
                <th className="px-4 py-2 text-right">CR</th>
              </tr>
            </thead>
            <tbody>
              {channels.map((c) => (
                <tr key={c.canal} className="border-b last:border-0">
                  <td className="px-4 py-2 font-medium">
                    <span
                      className="mr-2 inline-block h-2 w-2 rounded-full align-middle"
                      style={{ backgroundColor: PALETA_CANAL[c.canal] ?? "#94a3b8" }}
                    />
                    {c.canal}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatNumber(c.sesiones)}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                    {totals.sesiones > 0 ? `${((c.sesiones / totals.sesiones) * 100).toFixed(1)}%` : "—"}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatNumber(c.conversiones)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {c.sesiones > 0 ? `${((c.conversiones / c.sesiones) * 100).toFixed(2)}%` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
