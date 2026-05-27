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
import { getFbOrganicSummary } from "@/lib/meta-fb-queries";
import {
  BRAND_COLORS,
  BRAND_LABELS,
  NET_LABELS,
  OWN_BRAND,
  computeBrandStats,
  computeContentTypeSlices,
  computeKpis,
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
  const currentYear = new Date().getFullYear();
  const ytdRange = { from: `${currentYear}-01-01`, to: new Date().toISOString().slice(0, 10) };
  const range = parseDateRange(searchParams, ytdRange);

  const [rawPosts, allMarcas, followers, fbOrganic] = await Promise.all([
    getSocialPosts({ marca, red, from: range.from, to: range.to }),
    getAllMarcas(),
    getSocialFollowers(),
    getFbOrganicSummary({ from: range.from, to: range.to }),
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
  const trend = computeTrend(posts);
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

  return (
    <div className="space-y-4">
      <header className="flex items-end justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Redes Sociales</h2>
          <p className="text-sm text-muted-foreground">
            Analítica de Drean y competitiva en Redes Sociales.
          </p>
        </div>
        <DateRangePicker initialFrom={range.from} initialTo={range.to} />
      </header>

      <FbOrganicSection data={fbOrganic} />

      <div className="flex flex-wrap items-start gap-3">
        <div className="flex-1 min-w-0">
          <SocialFilters
            currentBrand={marca}
            currentNet={red}
            brands={brandOptions}
          />
        </div>
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
                <div className="text-2xl">
                  {n.red === "INSTAGRAM" ? "📷" : n.red === "FACEBOOK" ? "👥" : "🎵"}
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
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
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
    </div>
  );
}
