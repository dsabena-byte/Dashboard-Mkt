import { KpiCard } from "@/components/kpi-card";
import { DateRangePicker } from "@/components/date-range-picker";
import { parseDateRange } from "@/lib/dates";
import { SocialFilters } from "@/components/social/social-filters";
import { SocialTrendChart } from "@/components/social/social-trend-chart";
import { SocialPilarChart } from "@/components/social/social-pilar-chart";
import { SocialSentimentChart } from "@/components/social/social-sentiment-chart";
import { SocialContentTypeChart } from "@/components/social/social-content-type-chart";
import { PaginatedPostsPanel } from "@/components/social/paginated-posts-panel";
import { BrandSentimentSummary } from "@/components/social/brand-sentiment-summary";
import { FbOrganicSection } from "@/components/social/fb-organic-section";
import { IgOrganicSection } from "@/components/social/ig-organic-section";
import { OrganicBuildupPanel } from "@/components/social/organic-buildup-panel";
import { FbMonthlyChart } from "@/components/social/fb-monthly-chart";
import { InsightsPanel } from "@/components/insights/insights-panel";
import { TopContentPanel } from "@/components/insights/top-content-panel";
import { RedesTabs } from "@/components/social/redes-tabs";
import { getInsightsByCategoria, getTopAndBottomPostsLastNDays } from "@/lib/insights-queries";
import { getFbOrganicSummary } from "@/lib/meta-fb-queries";
import { getIgOrganicSummary } from "@/lib/meta-ig-queries";
import {
  BRAND_COLORS,
  BRAND_LABELS,
  NET_LABELS,
  OWN_BRAND,
  computeBrandStats,
  computeContentTypeSlices,
  computeKpis,
  computeOrganicBuildup,
  computeNetStats,
  computePilarStats,
  computeSentimentByBrand,
  computeTrend,
  computeWeeklyPostCount,
  enrichEngagement,
  getAllMarcas,
  getLatestFollowers,
  getSocialFollowers,
  getSocialPosts,
  topByBrandPerformance,
  bottomByBrandPerformance,
} from "@/lib/social-posts-queries";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

interface PageProps {
  searchParams: Record<string, string | string[] | undefined>;
}

function getParam(searchParams: PageProps["searchParams"], key: string, fallback = "all"): string {
  const v = searchParams[key];
  if (Array.isArray(v)) return v[0] ?? fallback;
  return v ?? fallback;
}

function fmtK(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
}

export default async function RedesPage({ searchParams }: PageProps) {
  const marca = getParam(searchParams, "marca", "all");
  const red = getParam(searchParams, "red", "all");
  const tab = getParam(searchParams, "tab", "analitica");
  const currentYear = new Date().getFullYear();
  const ytdRange = { from: `${currentYear}-01-01`, to: new Date().toISOString().slice(0, 10) };
  const range = parseDateRange(searchParams, ytdRange);

  const safe = async <T,>(p: Promise<T>, fallback: T, label: string): Promise<T> => {
    try {
      return await p;
    } catch (err) {
      console.error(`[redes/page] ${label} failed:`, err);
      return fallback;
    }
  };

  // Solo wrappeamos los queries NUEVOS en safe(): insights_log puede no existir
  // si el user no corrió la migration 0040 todavía, y getTopPostsLastNDays
  // depende de meta_posts. Los queries originales se dejan tal cual para no
  // cambiar el contrato de tipos del resto del page.
  const [rawPosts, allMarcas, followers, fbOrganic, igOrganic, insightsOrganico, topContent] = await Promise.all([
    getSocialPosts({ marca, red, from: range.from, to: range.to }),
    getAllMarcas(),
    getSocialFollowers(),
    getFbOrganicSummary({ from: range.from, to: range.to }),
    getIgOrganicSummary({ from: range.from, to: range.to }),
    safe(getInsightsByCategoria("organico_drean", 12), [] as Awaited<ReturnType<typeof getInsightsByCategoria>>, "getInsightsByCategoria"),
    safe(
      getTopAndBottomPostsLastNDays(30, 5),
      { instagram: { top: [], bottom: [] }, facebook: { top: [], bottom: [] } } as Awaited<ReturnType<typeof getTopAndBottomPostsLastNDays>>,
      "getTopAndBottomPostsLastNDays",
    ),
  ]);

  // Recalcula engagement por post usando social_followers (si hay snapshots).
  // Si no hay, mantiene el engagement del scrape original.
  const posts = enrichEngagement(rawPosts, followers);

  const brandOptions = allMarcas.map((m) => ({
    value: m,
    label: BRAND_LABELS[m] ?? m,
  }));

  const kpis = computeKpis(posts);
  const netStats = computeNetStats(posts);
  const brandStats = computeBrandStats(posts, followers, red);
  // Tendencia mensual: padea a 12 meses del año actual para mostrar el año completo.
  // Los meses sin posts quedan con `values: {}` => recharts no dibuja punto (gap en la línea).
  const trendRaw = computeTrend(posts);
  const trendYear = trendRaw.length > 0 ? Number(trendRaw[trendRaw.length - 1]!.mes.slice(0, 4)) : new Date().getFullYear();
  const trendMap = new Map(trendRaw.map((t) => [t.mes, t]));
  const trend = Array.from({ length: 12 }, (_, i) => {
    const key = `${trendYear}-${String(i + 1).padStart(2, "0")}`;
    return trendMap.get(key) ?? { mes: key, values: {} };
  });
  const weeklyVolume = computeWeeklyPostCount(posts);
  const pilarStats = computePilarStats(posts);
  const sentByBrand = computeSentimentByBrand(posts).map((s) => ({
    ...s,
    label: BRAND_LABELS[s.key] ?? s.key,
  }));
  const contentSlices = computeContentTypeSlices(posts);
  const brandAvgEng = posts.length > 0
    ? posts.reduce((s, p) => s + (p.engagement ?? 0), 0) / posts.length
    : 0;
  const topBrand = topByBrandPerformance(posts);
  const bottomBrand = bottomByBrandPerformance(posts);

  const hasData = posts.length > 0;
  // Sentiment solo aplica para Instagram. Si filtran por FB/TT, lo ocultamos.
  const showSentiment = red === "all" || red === "INSTAGRAM";

  // ===== Resumen combinado IG + FB (orgánico Drean) =====
  // Para que coincida con cada sección, repetimos exactamente los mismos
  // agregados que se usan en IgOrganicSection / FbOrganicSection.
  const fbPosts = fbOrganic.topPosts;
  const fbReactions = fbPosts.reduce((s, p) => s + (p.reactions ?? 0), 0);
  const fbCommentsShares = fbPosts.reduce((s, p) => s + (p.engagement ?? 0), 0);
  const fbClicks = fbPosts.reduce((s, p) => s + (p.clicks ?? 0), 0);
  const fbVideoViews = fbPosts.reduce((s, p) => s + (p.video_views ?? 0), 0);
  const fbEngagementTotal = fbReactions + fbCommentsShares + fbClicks + fbVideoViews;

  const combinedAlcance = fbOrganic.totals.impressions_unique + igOrganic.totalReach;
  const combinedEngagement = fbEngagementTotal + igOrganic.totalEngagement;
  const combinedReactions = fbReactions + igOrganic.totalReactions;
  const combinedComments = fbCommentsShares + igOrganic.totalComments;
  const combinedVideoViews = fbVideoViews + igOrganic.totalVideoViews;
  const combinedFollowers = (fbOrganic.totals.fans_total ?? 0) + 145_700; // IG: 145.7K hardcoded como en IgOrganicSection
  const combinedPosts = fbPosts.length + igOrganic.postCount;

  // Sumar mes a mes los monthlyData. Si NINGUNA red tiene data ese mes
  // (ambas null), queda null para que recharts no dibuje barra/punto.
  const monthlyMap = new Map<string, { mes: string; alcance: number | null; engagement: number | null }>();
  function bump(mes: string, alc: number | null | undefined, eng: number | null | undefined) {
    const acc = monthlyMap.get(mes) ?? { mes, alcance: null, engagement: null };
    if (alc != null) acc.alcance = (acc.alcance ?? 0) + alc;
    if (eng != null) acc.engagement = (acc.engagement ?? 0) + eng;
    monthlyMap.set(mes, acc);
  }
  for (const m of fbOrganic.monthlyData) bump(m.mes, m.alcance, m.engagement);
  for (const m of igOrganic.monthlyData) bump(m.mes, m.alcance, m.engagement);
  const combinedMonthly = [...monthlyMap.values()];

  // Construcción orgánica (alcance/views/interacción por pilar y categoría) + fecha de últ. dato.
  const organicPosts = [...igOrganic.topPosts, ...fbOrganic.topPosts];
  const organicBuildup = computeOrganicBuildup(organicPosts);
  const organicDates = organicPosts.map((p) => p.fecha_post).filter(Boolean) as string[];
  const ultimaActualizacion = organicDates.length ? organicDates.reduce((a, b) => (a > b ? a : b)).slice(0, 10) : null;

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Redes Sociales</h2>
          <p className="text-sm text-muted-foreground">
            Analítica Orgánica de Drean y Análisis competitivo de RRSS.
          </p>
        </div>
        <DateRangePicker initialFrom={range.from} initialTo={range.to} />
      </header>

      <RedesTabs
        current={tab}
        tabs={[
          { key: "analitica", label: "📊 Analítica" },
          { key: "insights", label: "💡 Insights Drean", badge: insightsOrganico.length || undefined },
        ]}
        preserveParams={searchParams}
      />

      {tab === "insights" && (
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Top contenidos del período + análisis automático comparando los últimos 30 días vs los 30 días previos.
            El cron corre 1x/día. Para forzar una recorrida: GitHub → Actions → &quot;Organic insights&quot; → Run workflow.
          </p>
          <TopContentPanel instagram={topContent.instagram} facebook={topContent.facebook} />
          <InsightsPanel insights={insightsOrganico} titulo="📊 Insights orgánico Drean (últimos 30d vs 30d previos)" />
        </div>
      )}

      {tab !== "analitica" ? null : (
        <>

      {/* ===== Resumen combinado Drean en redes (IG + FB) ===== */}
      <section className="space-y-4 rounded-lg border bg-card p-6">
        <header className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg text-white text-xs font-bold" style={{ background: "linear-gradient(135deg, #1877F2 0%, #dc2743 100%)" }}>★</div>
          <div>
            <h3 className="text-base font-semibold tracking-tight">Drean en redes — Instagram + Facebook</h3>
            <p className="text-xs text-muted-foreground">
              KPIs sumados de @dreanargentina + Page Drean en el período seleccionado.
            </p>
            {ultimaActualizacion && (
              <p className="text-[11px] text-muted-foreground/70">Actualizado al {ultimaActualizacion}</p>
            )}
          </div>
        </header>

        {/* KPIs principales */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard title="Alcance combinado" value={fmtK(combinedAlcance)} hint={`${combinedPosts} posts entre IG + FB`} />
          <KpiCard title="Engagement combinado" value={fmtK(combinedEngagement)} hint="Reacciones + comments + clicks + views" />
          <KpiCard title="Comunidad total" value={fmtK(combinedFollowers)} hint="Followers IG + Fans FB" />
          <KpiCard title="Posts" value={String(combinedPosts)} hint="IG feed/reels/stories + FB" />
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <KpiCard title="Reacciones / Likes" value={fmtK(combinedReactions)} />
          <KpiCard title="Comentarios" value={fmtK(combinedComments)} />
          <KpiCard title="Video views" value={fmtK(combinedVideoViews)} />
        </div>

        {/* Tendencia mensual combinada */}
        {combinedMonthly.length > 0 && (
          <div className="rounded-lg border bg-background p-4">
            <h4 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Evolución mensual combinada — Alcance vs Engagement
            </h4>
            <FbMonthlyChart data={combinedMonthly} />
          </div>
        )}
      </section>

      <OrganicBuildupPanel byPilar={organicBuildup.byPilar} byCategoria={organicBuildup.byCategoria} />

      <IgOrganicSection data={igOrganic} />

      <FbOrganicSection data={fbOrganic} />

      {/* Separador visual */}
      <div className="border-t-2 border-muted pt-6">
        <div className="mb-4">
          <h2 className="text-xl font-semibold tracking-tight">Análisis Competitivo</h2>
          <p className="text-sm text-muted-foreground">Drean vs Philco vs Gafa vs Electrolux vs Whirlpool en IG, FB y TT.</p>
        </div>
        <SocialFilters
          currentBrand={marca}
          currentNet={red}
          brands={brandOptions}
        />
      </div>

      {!hasData && (
        <div className="rounded-lg border bg-amber-50 p-4 text-sm text-amber-900">
          <strong>Tabla <code>social_posts</code> vacía.</strong> Aplicá la migración{" "}
          <code>0021_social_posts.sql</code> en Supabase y cargá los posts desde la planilla del scraper
          (Sheet ID: <code>1uIt7zeqdU4QcnQC6Fzw0phPWaO1ppiWY68HVVmpUPDg</code>).
        </div>
      )}

      {/* Network Breakdown — el card de Instagram incluye sentiment nested adentro */}
      <section className="grid gap-3 sm:grid-cols-3 items-start">
        {netStats.map((n) => {
          // Total followers de esa red sumando las marcas
          const netFollowers = [...new Set(posts.map((p) => p.marca))]
            .reduce((sum, m) => sum + getLatestFollowers(followers, m, n.red), 0);
          const isIG = n.red === "INSTAGRAM";
          return (
            <div key={n.red} className="rounded-lg border bg-card">
              <div className="flex items-center gap-3 p-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full text-white text-sm font-bold" style={{
                  background: n.red === "INSTAGRAM" ? "linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)" : n.red === "FACEBOOK" ? "#1877F2" : "#000000",
                }}>
                  {n.red === "INSTAGRAM" ? "IG" : n.red === "FACEBOOK" ? "FB" : "TT"}
                </div>
                <div className="flex-1">
                  <div className="text-xs font-semibold">{NET_LABELS[n.red] ?? n.red}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {n.posts} posts{n.total_views > 0 ? ` · ${fmtK(n.total_views)} views` : ""}
                    {netFollowers > 0 ? ` · ${fmtK(netFollowers)} followers` : ""}
                  </div>
                  {n.ultima_fecha && (
                    <div className="text-[9px] text-muted-foreground/60">
                      Últ. dato: {n.ultima_fecha}
                    </div>
                  )}
                </div>
                <div className="text-base font-bold tabular-nums" style={{ color: "#dc2626" }}>
                  {n.engagement_promedio.toFixed(2)}%
                </div>
              </div>
              {/* Sentiment nested SOLO en el card de Instagram */}
              {isIG && showSentiment && (
                <div className="border-t bg-muted/30 px-3 py-2">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Sentimiento</div>
                  <div className="mt-1 flex items-baseline gap-3">
                    <div>
                      <span className="text-base font-bold tabular-nums text-emerald-600">
                        {Math.round(kpis.sentimiento_positivo)}%
                      </span>
                      <span className="ml-1 text-[9px] uppercase tracking-wide text-muted-foreground">Pos</span>
                    </div>
                    <div>
                      <span className="text-base font-bold tabular-nums text-rose-600">
                        {Math.round(kpis.sentimiento_negativo)}%
                      </span>
                      <span className="ml-1 text-[9px] uppercase tracking-wide text-muted-foreground">Neg</span>
                    </div>
                    <div>
                      <span className="text-base font-bold tabular-nums text-slate-500">
                        {Math.round(kpis.sentimiento_neutro)}%
                      </span>
                      <span className="ml-1 text-[9px] uppercase tracking-wide text-muted-foreground">Neu</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </section>

      {/* KPI cards */}
      <section className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        <KpiCard title="Engagement prom" value={`${kpis.engagement_promedio.toFixed(2)}%`} hint={`Máx ${kpis.max_engagement.toFixed(2)}%`} />
        <KpiCard title="Total likes" value={fmtK(kpis.total_likes)} hint={`${kpis.posts} posts`} />
        <KpiCard title="Total views" value={fmtK(kpis.total_views)} hint="Videos e IG" />
        <KpiCard
          title="Total followers"
          value={fmtK(
            (marca !== "all" ? [marca] : allMarcas).reduce((sum, m) => {
              if (red !== "all") return sum + getLatestFollowers(followers, m, red);
              return sum + getLatestFollowers(followers, m, "INSTAGRAM")
                + getLatestFollowers(followers, m, "FACEBOOK")
                + getLatestFollowers(followers, m, "TIKTOK");
            }, 0),
          )}
          hint={marca !== "all" ? (BRAND_LABELS[marca] ?? marca) : red === "all" ? "Suma IG + FB + TT" : NET_LABELS[red] ?? red}
        />
        <KpiCard title="Posts" value={String(kpis.posts)} hint={kpis.redes.join(" · ") || "—"} />
      </section>

      {/* Volumen semanal de posteos */}
      <section className="rounded-lg border bg-card p-4">
        <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Cantidad de posteos por semana
        </h3>
        <SocialTrendChart
          data={weeklyVolume}
          brands={[...new Set(posts.map((p) => p.marca))]}
          brandLabels={BRAND_LABELS}
          brandColors={BRAND_COLORS}
          valueFormat="integer"
        />
      </section>

      {/* Trend + Pilar */}
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border bg-card p-4">
          <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Tendencia mensual de engagement
          </h3>
          <SocialTrendChart
            data={trend}
            brands={[...new Set(posts.map((p) => p.marca))]}
            brandLabels={BRAND_LABELS}
            brandColors={BRAND_COLORS}
          />
        </div>
        <div className="rounded-lg border bg-card p-4">
          <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Engagement promedio por pilar
          </h3>
          <SocialPilarChart data={pilarStats} />
        </div>
      </section>

      {/* Benchmark + Distribución por contenido */}
      <section className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3 rounded-lg border bg-card p-4">
          <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Benchmark de marcas · KPIs comparados
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b">
                <tr className="text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-2 py-1.5">Marca</th>
                  <th className="px-2 py-1.5 text-right">Followers</th>
                  <th className="px-2 py-1.5 text-right">Posts</th>
                  <th className="px-2 py-1.5 text-right">Posts/sem</th>
                  <th className="px-2 py-1.5 text-right">Eng. prom</th>
                  <th className="px-2 py-1.5 text-right">% Pos</th>
                  <th className="px-2 py-1.5 text-right">% Neg</th>
                  <th className="px-2 py-1.5 text-right">% Neu</th>
                  <th className="px-2 py-1.5 text-right">Likes</th>
                  <th className="px-2 py-1.5 text-right">Coment.</th>
                  <th className="px-2 py-1.5 text-right">Views</th>
                </tr>
              </thead>
              <tbody>
                {brandStats.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-2 py-6 text-center text-muted-foreground">
                      Sin datos.
                    </td>
                  </tr>
                ) : (
                  (() => {
                    return brandStats.map((b) => {
                      const color = BRAND_COLORS[b.marca] ?? "#94a3b8";
                      return (
                        <tr key={b.marca} className="border-b last:border-0">
                          <td className="px-2 py-1.5 font-medium">
                            <span className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle" style={{ backgroundColor: color }} />
                            {BRAND_LABELS[b.marca] ?? b.marca}
                            {b.marca === OWN_BRAND && <span className="ml-1 text-rose-500">★</span>}
                          </td>
                          <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">
                            {b.followers > 0 ? fmtK(b.followers) : "—"}
                          </td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{b.posts}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">{b.posts_per_week.toFixed(1)}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{b.engagement_promedio.toFixed(2)}%</td>
                          <td className="px-2 py-1.5 text-right tabular-nums text-emerald-600">{Math.round(b.positivo)}%</td>
                          <td className="px-2 py-1.5 text-right tabular-nums text-rose-600">{Math.round(b.negativo)}%</td>
                          <td className="px-2 py-1.5 text-right tabular-nums text-slate-500">{Math.round(b.neutro)}%</td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{fmtK(b.total_likes)}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{fmtK(b.total_comentarios)}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums">
                            {b.total_views > 0 ? fmtK(b.total_views) : "—"}
                          </td>
                        </tr>
                      );
                    });
                  })()
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div className="lg:col-span-2 rounded-lg border bg-card p-4">
          <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Distribución por tipo de contenido
          </h3>
          <SocialContentTypeChart data={contentSlices} />
        </div>
      </section>

      {/* Sentiment + Resumen cualitativo */}
      {showSentiment && (
        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border bg-card p-4">
            <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Sentimiento por marca <span className="text-muted-foreground/70">(solo Instagram)</span>
            </h3>
            <div className="mb-3 flex flex-wrap gap-2 text-[10px] text-muted-foreground">
              {sentByBrand.map((s) => (
                <span key={s.key} className="rounded bg-muted px-1.5 py-0.5">
                  {s.label}: <strong>{s.comentarios_analizados}</strong> posts analizados
                </span>
              ))}
            </div>
            <SocialSentimentChart data={sentByBrand} />
          </div>
          <BrandSentimentSummary
            marcas={[...new Set(posts.filter((p) => p.red_social === "INSTAGRAM").map((p) => p.marca))]}
            from={range.from}
            to={range.to}
          />
        </section>
      )}

      {/* Posts por performance de marca — mejores y peores vs promedio de la marca */}
      <section className="grid gap-4 lg:grid-cols-2">
        <PaginatedPostsPanel
          title="Mejores posts (arriba del promedio)"
          posts={topBrand}
          color="emerald"
          avgEngagement={brandAvgEng}
        />
        <PaginatedPostsPanel
          title="Peores posts (abajo del promedio)"
          posts={bottomBrand}
          color="rose"
          avgEngagement={brandAvgEng}
        />
      </section>
        </>
      )}
    </div>
  );
}
