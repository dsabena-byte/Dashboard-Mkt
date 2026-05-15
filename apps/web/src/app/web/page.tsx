import { KpiCard } from "@/components/kpi-card";
import { DateRangeInfo } from "@/components/date-range-info";
import { DonutChart } from "@/components/planning/donut-chart";
import { CompetitorMonthlyChart } from "@/components/competitor-monthly-chart";
import { KpiBarPanel } from "@/components/kpi-bar-panel";
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

  const [
    dailyKpis,
    bySource,
    byCategory,
    topLandings,
    dailyKpisPrev,
    webSnapshotRaw,
    monthlyHistoryRaw,
    trafficSources,
    competitorKeywords,
    porCategoria,
    googleTrends,
    dreanGa4,
  ] = await Promise.all([
    getWebDailyKpis(range),
    getWebBySource(range),
    getWebByCategory(range),
    getWebTopLandingPages(20),
    getWebDailyKpis(prev),
    getCompetitorWebSnapshot(),
    getCompetitorMonthlyHistory(),
    getCompetitorTrafficSources(),
    getCompetitorKeywords(10),
    getCompetitorByCategoria(),
    getGoogleTrends(),
    getDreanWebMetrics(),
  ]);

  // Solo comparamos meses CERRADOS (mes en curso es parcial).
  const today = new Date();
  const currentYear = today.getUTCFullYear();
  const currentMonth = today.getUTCMonth() + 1;
  const lastClosedYear = currentMonth === 1 ? currentYear - 1 : currentYear;
  const lastClosedMonthNum = currentMonth === 1 ? 12 : currentMonth - 1;
  const lastClosedMonthStr = `${lastClosedYear}-${String(lastClosedMonthNum).padStart(2, "0")}-01`;

  // Drean: visitas GA4, KPIs engagement SimilarWeb (apples-to-apples).
  const dreanClosedGa4 = dreanGa4?.mesesMetrics?.find((m) => m.fecha === lastClosedMonthStr);
  const webSnapshot = webSnapshotRaw.map((r) => {
    if (r.competidor !== "Drean" || !dreanGa4) return r;
    return {
      ...r,
      fecha: dreanClosedGa4?.fecha ?? dreanGa4.fecha,
      visitas_estimadas: dreanClosedGa4?.visitas ?? dreanGa4.visitas_estimadas,
    };
  });
  const monthlyHistory = monthlyHistoryRaw.map((m) => {
    if (m.competidor !== "Drean" || !dreanGa4) return m;
    const merged = new Map<string, number>();
    for (const p of m.meses) merged.set(p.fecha, p.visitas);
    for (const p of dreanGa4.meses) merged.set(p.fecha, p.visitas);
    const meses = [...merged.entries()]
      .map(([fecha, visitas]) => ({ fecha, visitas }))
      .sort((a, b) => a.fecha.localeCompare(b.fecha));
    return { ...m, meses };
  });
  for (const m of monthlyHistory) {
    m.meses = m.meses.filter((p) => p.fecha <= lastClosedMonthStr);
  }

  // Trends agrupados por keyword
  const trendsByKw = new Map<string, Array<{ fecha: string; interes: number }>>();
  for (const t of googleTrends) {
    if (!trendsByKw.has(t.keyword)) trendsByKw.set(t.keyword, []);
    trendsByKw.get(t.keyword)!.push({ fecha: t.fecha, interes: t.interes });
  }

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

  const categorias = [...new Set(porCategoria.map((r) => r.categoria))].sort();
  const competidoresEnCat = [...new Set(porCategoria.map((r) => r.competidor))].sort();

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

  // Trend data shaped for EngagementTrendChart (uses cuenta/engagement keys)
  const trendData = dailyKpis.map((r) => ({
    fecha: r.fecha,
    cuenta: "drean.com.ar",
    engagement: r.sesiones,
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
          <EngagementTrendChart data={trendData} />
        </div>
      </section>

      {/* Performance por categoría */}
      <section className="rounded-lg border bg-card">
        <header className="border-b p-6 pb-4">
          <h3 className="text-sm font-medium text-muted-foreground">Performance por categoría</h3>
          <p className="text-xs text-muted-foreground">
            Derivado del path de la landing page. Si una URL no matchea Lavado/Refrigeración/Cocinas, cae en &ldquo;Otros / Home&rdquo;.
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

      {/* ============================================================
          COMPETENCIA WEB — Drean vs competidores
          ============================================================ */}
      <div className="pt-6">
        <h2 className="text-xl font-semibold tracking-tight">Competencia web</h2>
        <p className="text-sm text-muted-foreground">
          Benchmark de Drean contra competidores (SimilarWeb) + datos reales GA4 de Drean para volumen.
        </p>
      </div>

      <section className="rounded-lg border bg-card">
        <header className="border-b p-6 pb-4">
          <h3 className="text-sm font-medium text-muted-foreground">
            Tráfico web — Benchmark de dominios
          </h3>
          <p className="text-xs text-muted-foreground">
            <strong>Visitas Drean</strong>: Google Analytics (sesiones reales first-party). <strong>Resto de KPIs</strong> (bounce/pages/duration) y <strong>competidores</strong>: SimilarWeb (estimación panel + modelos) para que la comparación use la misma metodología. Período mostrado:{" "}
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
            Sin datos de tráfico web todavía.
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
                        <span
                          className={`ml-2 rounded px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide ${
                            row.competidor === "Drean"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {row.competidor === "Drean" ? "GA4" : "SimilarWeb"}
                        </span>
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
          Historia mensual de visitas
        </h3>
        <p className="text-xs text-muted-foreground">
          Drean: GA4 real. Competidores: SimilarWeb. Picos sostenidos = campaña activa.
        </p>
        <div className="mt-4">
          <CompetitorMonthlyChart data={monthlyHistory} />
        </div>
      </section>

      {webSnapshotRaw.length > 0 && (
        <section className="rounded-lg border bg-card p-6">
          <h3 className="text-sm font-medium text-muted-foreground">
            Calidad del tráfico — engagement web
          </h3>
          <p className="text-xs text-muted-foreground">
            <strong>Fuente: SimilarWeb para todas las marcas</strong> (incluido Drean) para que la comparación use la misma metodología.
            <strong> Bounce rate</strong> bajo = visitan más de 1 página.
            <strong> Pages/visit</strong> alto = exploran más.
            <strong> Avg duration</strong> alto = se quedan más tiempo.
          </p>
          <div className="mt-6 grid gap-6 md:grid-cols-3">
            <KpiBarPanel
              title="Bounce rate"
              subtitle="Menor es mejor"
              data={[...webSnapshotRaw]
                .filter((r) => r.bounce_rate !== null)
                .map((r) => ({ label: r.competidor, value: (r.bounce_rate ?? 0) * 100, display: `${((r.bounce_rate ?? 0) * 100).toFixed(1)}%` }))
                .sort((a, b) => a.value - b.value)}
              colorBy="reverse"
              maxLabel="%"
            />
            <KpiBarPanel
              title="Pages / visit"
              subtitle="Mayor es mejor"
              data={[...webSnapshotRaw]
                .filter((r) => r.pages_per_visit !== null)
                .map((r) => ({ label: r.competidor, value: r.pages_per_visit ?? 0, display: (r.pages_per_visit ?? 0).toFixed(2) }))
                .sort((a, b) => b.value - a.value)}
              colorBy="direct"
            />
            <KpiBarPanel
              title="Avg duration"
              subtitle="Mayor es mejor"
              data={[...webSnapshotRaw]
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
            Tráfico por categoría (competidores)
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
        const keywordsConData = competitorKeywords.filter((r) => r.keywords.length > 0);
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
    </div>
  );
}
