import { KpiCard } from "@/components/kpi-card";
import { DateRangePicker } from "@/components/date-range-picker";
import { DonutChart } from "@/components/planning/donut-chart";
import { CompetitorMonthlyChart } from "@/components/competitor-monthly-chart";
import { CategoryTrendChart } from "@/components/category-trend-chart";
import { WebMonthlyChart } from "@/components/web-monthly-chart";
import { ChannelMonthlyChart } from "@/components/channel-monthly-chart";
import { KpiBarPanel } from "@/components/kpi-bar-panel";
import {
  aggregateByCategory,
  aggregateBySource,
  aggregateDaily,
  getWebByCategory,
  getWebBySource,
  getWebDailyKpis,
  getAllMonthlyUsers,
  getMonthlyUsers,
  getWebMonthlyByChannel,
  getWebTopLandingPages,
  getWebTopProducts,
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
import { lastClosedMonthRange, parseDateRange } from "@/lib/dates";
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
  // Default = último mes cerrado (ej: hoy 15-may → Abril 1 a Abril 30).
  const range = parseDateRange(searchParams, lastClosedMonthRange());
  const prev = previousRange(range.from, range.to);

  // Para el gráfico mensual: traer 12 meses hacia atrás
  const monthlyRange = (() => {
    const to = new Date(`${range.to}T00:00:00Z`);
    const from = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth() - 11, 1));
    return { from: from.toISOString().slice(0, 10), to: range.to };
  })();

  // Para comparativa YoY: traer también los mismos meses del año anterior (24 meses back)
  const yoyRange = (() => {
    const to = new Date(`${range.to}T00:00:00Z`);
    const from = new Date(Date.UTC(to.getUTCFullYear() - 1, to.getUTCMonth() - 11, 1));
    return { from: from.toISOString().slice(0, 10), to: range.to };
  })();

  const [
    dailyKpis,
    monthlyDailyKpis,
    bySource,
    monthlyByChannel,
    byCategory,
    monthlyByCategory,
    topLandings,
    topProducts,
    dailyKpisPrev,
    webSnapshotRaw,
    monthlyHistoryRaw,
    trafficSources,
    competitorKeywords,
    porCategoria,
    googleTrends,
    dreanGa4,
    monthlyUsersRow,
    allMonthlyUsers,
  ] = await Promise.all([
    getWebDailyKpis(range),
    getWebDailyKpis(yoyRange),
    getWebBySource(range),
    getWebMonthlyByChannel(12),
    getWebByCategory(range),
    getWebByCategory(monthlyRange),
    getWebTopLandingPages(range, 10),
    getWebTopProducts(range, 10),
    getWebDailyKpis(prev),
    getCompetitorWebSnapshot(),
    getCompetitorMonthlyHistory(),
    getCompetitorTrafficSources(),
    getCompetitorKeywords(10),
    getCompetitorByCategoria(),
    getGoogleTrends(),
    getDreanWebMetrics(),
    // Si el rango empieza el 1 de algún mes, traer total users únicos de ese mes
    range.from.endsWith("-01") ? getMonthlyUsers(range.from) : Promise.resolve(null),
    getAllMonthlyUsers(),
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

  // Agregación mensual con comparativa YoY (mismo mes año anterior)
  // monthlyDailyKpis ahora trae 24 meses → splitamos por año
  const monthlyAll = new Map<string, { sesiones: number; usuarios: number; conversiones: number }>();
  for (const r of monthlyDailyKpis) {
    const mes = r.fecha.slice(0, 7) + "-01";
    const acc = monthlyAll.get(mes) ?? { sesiones: 0, usuarios: 0, conversiones: 0 };
    acc.sesiones += r.sesiones;
    acc.usuarios += r.usuarios;
    acc.conversiones += r.conversiones;
    monthlyAll.set(mes, acc);
  }
  // Maps: mes → users / sesiones (total_users es lo principal, ya está cargado)
  const monthlyUsersMap = new Map<string, number>();
  const monthlySessionsMap = new Map<string, number>();
  for (const u of allMonthlyUsers) {
    monthlyUsersMap.set(u.mes, u.total_users);
    if (u.sesiones && u.sesiones > 0) monthlySessionsMap.set(u.mes, u.sesiones);
  }
  // Helper: trae users (o sessions fallback a web_traffic) para un (año, mes)
  const getMonthVal = (year: number, m: number, kind: "users" | "sessions"): number => {
    const key = `${year}-${String(m).padStart(2, "0")}-01`;
    if (kind === "users") return monthlyUsersMap.get(key) ?? monthlyAll.get(key)?.usuarios ?? 0;
    return monthlySessionsMap.get(key) ?? monthlyAll.get(key)?.sesiones ?? 0;
  };
  const currYear = (new Date(`${range.to}T00:00:00Z`)).getUTCFullYear();
  const prevYear = currYear - 1;
  const MES_SHORT = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  // Una fila por mes (Ene-Dic) con barras side-by-side 2025 vs 2026
  const monthlyDataRaw = [];
  for (let m = 1; m <= 12; m++) {
    const usuarios_curr = getMonthVal(currYear, m, "users");
    const usuarios_prev = getMonthVal(prevYear, m, "users");
    monthlyDataRaw.push({
      mes: MES_SHORT[m - 1]!,
      usuarios_curr,
      usuarios_prev,
      sesiones_curr: getMonthVal(currYear, m, "sessions"),
      sesiones_prev: getMonthVal(prevYear, m, "sessions"),
    });
  }
  // Mostrar solo meses con al menos un valor
  const monthlyData = monthlyDataRaw.filter(
    (r) => r.usuarios_curr > 0 || r.usuarios_prev > 0
  );
  const yearLabels = { curr: String(currYear), prev: String(prevYear) };

  // Evolución mensual por canal: rows = mes, columnas = canal con sesiones
  // monthlyByChannel viene pre-agregado desde la vista (mes, canal, sesiones).
  const monthlyChannelMap = new Map<string, Map<string, number>>();
  for (const r of monthlyByChannel) {
    let perCanal = monthlyChannelMap.get(r.mes);
    if (!perCanal) { perCanal = new Map(); monthlyChannelMap.set(r.mes, perCanal); }
    perCanal.set(r.canal, (perCanal.get(r.canal) ?? 0) + r.sesiones);
  }
  // Top N canales sobre el total del rango — los otros van a "Otros"
  const canalTotals = new Map<string, number>();
  for (const perCanal of monthlyChannelMap.values()) {
    for (const [canal, s] of perCanal) {
      canalTotals.set(canal, (canalTotals.get(canal) ?? 0) + s);
    }
  }
  const topCanales = [...canalTotals.entries()]
    .sort(([, a], [, b]) => b - a)
    .slice(0, 7)
    .map(([c]) => c);
  const SHORT_MONTH = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  const fmtMesLabel = (mes: string) => {
    const [y, m] = mes.split("-");
    return `${SHORT_MONTH[parseInt(m ?? "1", 10) - 1] ?? m} ${y?.slice(2) ?? ""}`;
  };
  const monthlyChannelData = [...monthlyChannelMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mes, perCanal]) => {
      const row: Record<string, string | number | null> = { mesLabel: fmtMesLabel(mes) };
      for (const c of topCanales) row[c] = perCanal.get(c) ?? null;
      return row as { mesLabel: string } & Record<string, number | null>;
    });

  // Pivot data para CategoryTrendChart: { fecha, Lavado: X, Cocinas: Y, ... }
  // Tendencia por categoría — agregada POR MES (12 meses hacia atrás, no afectado por filtro)
  const categoriasUnicas = [...new Set(monthlyByCategory.map((r) => r.categoria))];
  const categoryTrendByDate = new Map<string, Record<string, number>>();
  for (const r of monthlyByCategory) {
    const mes = r.fecha.slice(0, 7) + "-01";
    const acc = categoryTrendByDate.get(mes) ?? {};
    acc[r.categoria] = (acc[r.categoria] ?? 0) + r.sesiones;
    categoryTrendByDate.set(mes, acc);
  }
  const SHORT_MONTH_CAT = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  const fmtMesCat = (mes: string) => {
    const [y, m] = mes.split("-");
    return `${SHORT_MONTH_CAT[parseInt(m ?? "1", 10) - 1] ?? m} ${y?.slice(2) ?? ""}`;
  };
  const categoryTrendData = [...categoryTrendByDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mes, vals]) => {
      const row: Record<string, string | number | null> = { fecha: fmtMesCat(mes) };
      for (const cat of categoriasUnicas) row[cat] = vals[cat] ?? null;
      return row as { fecha: string } & Record<string, number | null>;
    });

  // Paleta de categorías web (incluye Lavavajillas y Home/Otros)
  const PALETA_CAT_WEB: Record<string, string> = {
    Lavado: "#a78bfa",
    Refrigeración: "#22c55e",
    Cocinas: "#f97316",
    Lavavajillas: "#0ea5e9",
    Home: "#94a3b8",
    Otros: "#cbd5e1",
    ...PALETA_CATEGORIA,
  };

  const deltaSesiones = pctChange(totals.sesiones, totalsPrev.sesiones);
  const deltaConversiones = pctChange(totals.conversiones, totalsPrev.conversiones);
  const deltaCR = (totals.conversion_rate !== null && totalsPrev.conversion_rate !== null && totalsPrev.conversion_rate > 0)
    ? (totals.conversion_rate - totalsPrev.conversion_rate) / totalsPrev.conversion_rate
    : null;

  const hasData = dailyKpis.length > 0;

  // Trend semanal: agregamos sesiones por semana (lunes inicio) desde monthlyDailyKpis
  // (12 meses hacia atrás). No afectado por el filtro.
  const weekStartIso = (fecha: string): string => {
    const d = new Date(`${fecha}T00:00:00Z`);
    const day = d.getUTCDay();
    const offset = day === 0 ? -6 : 1 - day;
    d.setUTCDate(d.getUTCDate() + offset);
    return d.toISOString().slice(0, 10);
  };
  const weeklyMap = new Map<string, number>();
  for (const r of monthlyDailyKpis) {
    const wk = weekStartIso(r.fecha);
    weeklyMap.set(wk, (weeklyMap.get(wk) ?? 0) + r.sesiones);
  }
  const trendData = [...weeklyMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([fecha, sesiones]) => ({
      fecha,
      cuenta: "drean.com.ar",
      engagement: sesiones,
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
        <DateRangePicker initialFrom={range.from} initialTo={range.to} />
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
          title={monthlyUsersRow ? "Usuarios únicos (mes)" : "Usuarios (suma diaria)"}
          value={formatNumber(monthlyUsersRow ? monthlyUsersRow.total_users : totals.usuarios)}
          hint={
            monthlyUsersRow
              ? `${formatNumber(monthlyUsersRow.new_users)} nuevos`
              : "⚠ sobre-cuenta usuarios que visitan varios días"
          }
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

      {/* Tendencia mensual — últimos 12 meses */}
      <section className="rounded-lg border bg-card p-6">
        <h3 className="text-sm font-medium text-muted-foreground">Tendencia mensual: sesiones + usuarios</h3>
        <p className="text-xs text-muted-foreground">
          Últimos 12 meses (no afectado por el filtro). Barras = sesiones, línea = usuarios únicos.
        </p>
        <div className="mt-4">
          <WebMonthlyChart data={monthlyData} labels={yearLabels} />
        </div>
      </section>

      {/* Categoría: tabla + tendencia side-by-side */}
      <section className="grid gap-4 lg:grid-cols-2">
      {/* Performance por categoría */}
      <div className="rounded-lg border bg-card">
        <header className="border-b p-6 pb-4">
          <h3 className="text-sm font-medium text-muted-foreground">Performance por categoría</h3>
          <p className="text-xs text-muted-foreground">
            Derivado del path de la landing page. Si una URL no matchea Lavado/Refrigeración/Cocinas, cae en &ldquo;Otros / Home&rdquo;.
          </p>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="border-b bg-muted/40">
              <tr className="text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2">Categoría</th>
                <th className="px-3 py-2 text-right">Sesiones</th>
                <th className="px-3 py-2 text-right">%</th>
                <th className="px-3 py-2 text-right">Conv.</th>
                <th className="px-3 py-2 text-right">CR</th>
                <th className="px-3 py-2 text-right">Bounce</th>
                <th className="px-3 py-2 text-right">PV</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((c) => (
                <tr key={c.categoria} className="border-b last:border-0">
                  <td className="px-3 py-2 font-medium">
                    <span
                      className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle"
                      style={{ backgroundColor: PALETA_CATEGORIA[c.categoria] ?? "#94a3b8" }}
                    />
                    {c.categoria}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatNumber(c.sesiones)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                    {totals.sesiones > 0 ? `${((c.sesiones / totals.sesiones) * 100).toFixed(1)}%` : "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatNumber(c.conversiones)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {c.conversion_rate !== null ? `${(c.conversion_rate * 100).toFixed(2)}%` : "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {c.bounce_rate !== null ? formatPct(c.bounce_rate * 100, 1) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                    {formatNumber(c.pageviews)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tendencia por categoría — sesiones diarias por categoría */}
      <div className="rounded-lg border bg-card p-6">
        <h3 className="text-sm font-medium text-muted-foreground">
          Tendencia mensual por categoría
        </h3>
        <p className="text-xs text-muted-foreground">
          Sesiones por mes (últimos 12 meses, no afectado por el filtro).
        </p>
        <div className="mt-4">
          <CategoryTrendChart
            data={categoryTrendData}
            categorias={categoriasUnicas}
            colors={PALETA_CAT_WEB}
          />
        </div>
      </div>
      </section>

      {/* Top productos + Top landings — lado a lado */}
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border bg-card">
          <header className="border-b p-6 pb-4">
            <h3 className="text-sm font-medium text-muted-foreground">Top 10 productos (PDPs)</h3>
            <p className="text-xs text-muted-foreground">
              Páginas de <strong>detalle de producto</strong> más visitadas en el rango.
            </p>
          </header>
          {topProducts.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              Sin productos en el rango. Probá un período más amplio.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40">
                  <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-2">Producto</th>
                    <th className="px-4 py-2">Cat.</th>
                    <th className="px-4 py-2 text-right">Sesiones</th>
                    <th className="px-4 py-2 text-right">% total</th>
                  </tr>
                </thead>
                <tbody>
                  {topProducts.map((p) => {
                    const nombre = p.producto_slug
                      ? p.producto_slug.replace(/-/g, " ").slice(0, 50)
                      : (p.sku ?? "(sin nombre)");
                    return (
                      <tr key={p.landing_page} className="border-b last:border-0">
                        <td className="px-3 py-2 max-w-[260px] truncate text-xs" title={p.producto_slug ?? p.landing_page}>
                          <div>{nombre}</div>
                          <div className="font-mono text-[10px] text-muted-foreground">{p.sku ?? ""}</div>
                        </td>
                        <td className="px-3 py-2 text-xs">
                          <span
                            className="mr-1 inline-block h-2 w-2 rounded-full align-middle"
                            style={{ backgroundColor: PALETA_CAT_WEB[p.categoria] ?? "#94a3b8" }}
                          />
                          {p.categoria}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatNumber(p.sesiones)}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                          {totals.sesiones > 0 ? `${((p.sesiones / totals.sesiones) * 100).toFixed(1)}%` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-lg border bg-card">
          <header className="border-b p-6 pb-4">
            <h3 className="text-sm font-medium text-muted-foreground">Top 10 landing pages</h3>
            <p className="text-xs text-muted-foreground">
              <strong>Toda página</strong> de entrada (home, categorías, productos, etc.) — punto de aterrizaje del usuario.
            </p>
          </header>
          {topLandings.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">Sin landings en el rango.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40">
                  <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-2">Landing</th>
                    <th className="px-4 py-2 text-right">Sesiones</th>
                    <th className="px-4 py-2 text-right">% total</th>
                  </tr>
                </thead>
                <tbody>
                  {topLandings.map((l) => (
                    <tr key={l.landing_page} className="border-b last:border-0">
                      <td className="px-4 py-2 max-w-[280px] truncate text-xs" title={l.landing_page}>
                        {l.landing_page}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">{formatNumber(l.sesiones)}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                        {totals.sesiones > 0 ? `${((l.sesiones / totals.sesiones) * 100).toFixed(1)}%` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* Mix de canales (rango) + Evolución mensual por canal — side by side */}
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-sm font-medium text-muted-foreground">Mix de canales (rango)</h3>
          <p className="text-xs text-muted-foreground">Sesiones por fuente de tráfico en el rango seleccionado.</p>
          <div className="mt-4">
            <DonutChart data={channelDonut} valueFormat="number" />
          </div>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-sm font-medium text-muted-foreground">Evolución mensual por canal</h3>
          <p className="text-xs text-muted-foreground">
            Sesiones por canal — últimos 12 meses. Top 7 canales por volumen.
          </p>
          <div className="mt-4">
            <ChannelMonthlyChart
              data={monthlyChannelData}
              canales={topCanales}
              colors={PALETA_CANAL}
            />
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
                <th className="px-4 py-2 text-right">PV / sesión</th>
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
                  <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                    {c.sesiones > 0 ? (c.pageviews / c.sesiones).toFixed(2) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Trend semanal */}
      <section className="rounded-lg border bg-card p-6">
        <h3 className="text-sm font-medium text-muted-foreground">Tendencia semanal de sesiones</h3>
        <p className="text-xs text-muted-foreground">Sesiones por semana — últimos 12 meses (no afectado por el filtro).</p>
        <div className="mt-4">
          <EngagementTrendChart data={trendData} />
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
            <strong>Fuente: SimilarWeb para todas las marcas</strong> (incluido Drean) para que la comparación use la misma metodología.{" "}
            <strong>Período</strong>: snapshot más reciente disponible (estas métricas se reportan como punto-en-el-tiempo, no mensualizadas).
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
