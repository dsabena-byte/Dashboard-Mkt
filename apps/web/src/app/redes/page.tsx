import { KpiCard } from "@/components/kpi-card";
import { SocialFilters } from "@/components/social/social-filters";
import { SocialTrendChart } from "@/components/social/social-trend-chart";
import { SocialPilarChart } from "@/components/social/social-pilar-chart";
import { SocialContentMixChart } from "@/components/social/social-content-mix-chart";
import { SocialSentimentChart } from "@/components/social/social-sentiment-chart";
import { SocialContentTypeChart } from "@/components/social/social-content-type-chart";
import {
  BRAND_COLORS,
  BRAND_LABELS,
  NET_LABELS,
  OWN_BRAND,
  computeBrandStats,
  computeContentMix,
  computeContentTypeSlices,
  computeKpis,
  computeNetStats,
  computePilarStats,
  computeSentimentByBrand,
  computeTrend,
  enrichEngagement,
  getAllMarcas,
  getSocialFollowers,
  getSocialPosts,
  topCriticalPosts,
  topSuccessfulPosts,
} from "@/lib/social-posts-queries";

export const dynamic = "force-dynamic";

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
  const periodo = getParam(searchParams, "periodo", "all");

  const [rawPosts, allMarcas, followers] = await Promise.all([
    getSocialPosts({ marca, red, periodo }),
    getAllMarcas(),
    getSocialFollowers(),
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
  const brandStats = computeBrandStats(posts);
  const trend = computeTrend(posts);
  const pilarStats = computePilarStats(posts);
  const contentMix = computeContentMix(posts);
  const sentByBrand = computeSentimentByBrand(posts).map((s) => ({
    ...s,
    label: BRAND_LABELS[s.key] ?? s.key,
  }));
  const contentSlices = computeContentTypeSlices(posts);
  const successful = topSuccessfulPosts(posts);
  const critical = topCriticalPosts(posts);

  const hasData = posts.length > 0;

  return (
    <div className="space-y-4">
      <header className="flex items-end justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Redes Sociales</h2>
          <p className="text-sm text-muted-foreground">
            Posts de Drean vs Philco vs Gafa (IG, FB, TT). Sentiment, engagement, contenido.
          </p>
        </div>
      </header>

      <SocialFilters
        currentBrand={marca}
        currentNet={red}
        currentPeriodo={periodo}
        brands={brandOptions}
      />

      {!hasData && (
        <div className="rounded-lg border bg-amber-50 p-4 text-sm text-amber-900">
          <strong>Tabla <code>social_posts</code> vacía.</strong> Aplicá la migración{" "}
          <code>0021_social_posts.sql</code> en Supabase y cargá los posts desde la planilla del scraper
          (Sheet ID: <code>1uIt7zeqdU4QcnQC6Fzw0phPWaO1ppiWY68HVVmpUPDg</code>).
        </div>
      )}

      {/* Network Breakdown */}
      <section className="grid gap-3 sm:grid-cols-3">
        {netStats.map((n) => (
          <div key={n.red} className="flex items-center gap-3 rounded-lg border bg-card p-3">
            <div className="text-2xl">
              {n.red === "INSTAGRAM" ? "📷" : n.red === "FACEBOOK" ? "👥" : "🎵"}
            </div>
            <div className="flex-1">
              <div className="text-xs font-semibold">{NET_LABELS[n.red] ?? n.red}</div>
              <div className="text-[10px] text-muted-foreground">
                {n.posts} posts{n.total_views > 0 ? ` · ${fmtK(n.total_views)} views` : ""}
              </div>
            </div>
            <div className="text-base font-bold tabular-nums" style={{ color: "#dc2626" }}>
              {n.engagement_promedio.toFixed(2)}%
            </div>
          </div>
        ))}
      </section>

      {/* KPI cards */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <KpiCard title="Engagement prom" value={`${kpis.engagement_promedio.toFixed(2)}%`} hint={`Máx ${kpis.max_engagement.toFixed(2)}%`} />
        <KpiCard title="Total likes" value={fmtK(kpis.total_likes)} hint={`${kpis.posts} posts`} />
        <KpiCard title="Total views" value={fmtK(kpis.total_views)} hint="Videos e IG" />
        <div className="rounded-lg border bg-card p-4 lg:col-span-2">
          <div className="text-xs font-medium text-muted-foreground">Sentimiento</div>
          <div className="mt-2 flex items-baseline gap-4">
            <div>
              <span className="text-2xl font-bold tabular-nums text-emerald-600">
                {Math.round(kpis.sentimiento_positivo)}%
              </span>
              <span className="ml-1 text-[10px] uppercase tracking-wide text-muted-foreground">Positivo</span>
            </div>
            <div>
              <span className="text-2xl font-bold tabular-nums text-rose-600">
                {Math.round(kpis.sentimiento_negativo)}%
              </span>
              <span className="ml-1 text-[10px] uppercase tracking-wide text-muted-foreground">Negativo</span>
            </div>
            <div>
              <span className="text-2xl font-bold tabular-nums text-slate-500">
                {Math.round(kpis.sentimiento_neutro)}%
              </span>
              <span className="ml-1 text-[10px] uppercase tracking-wide text-muted-foreground">Neutro</span>
            </div>
          </div>
        </div>
        <KpiCard title="Posts" value={String(kpis.posts)} hint={kpis.redes.join(" · ") || "—"} />
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

      {/* Benchmark + Content Mix */}
      <section className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div className="rounded-lg border bg-card p-4">
          <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Benchmark de marcas · KPIs comparados
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b">
                <tr className="text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-2 py-1.5">Marca</th>
                  <th className="px-2 py-1.5 text-right">Posts</th>
                  <th className="px-2 py-1.5 text-right">Eng. prom</th>
                  <th className="px-2 py-1.5">Eng. relativo</th>
                  <th className="px-2 py-1.5 text-right">% Pos</th>
                  <th className="px-2 py-1.5 text-right">% Neg</th>
                  <th className="px-2 py-1.5 text-right">Views prom</th>
                </tr>
              </thead>
              <tbody>
                {brandStats.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-2 py-6 text-center text-muted-foreground">
                      Sin datos.
                    </td>
                  </tr>
                ) : (
                  (() => {
                    const maxEng = Math.max(...brandStats.map((b) => b.engagement_promedio), 0.0001);
                    return brandStats.map((b) => {
                      const rel = (b.engagement_promedio / maxEng) * 100;
                      const color = BRAND_COLORS[b.marca] ?? "#94a3b8";
                      return (
                        <tr key={b.marca} className="border-b last:border-0">
                          <td className="px-2 py-1.5 font-medium">
                            <span className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle" style={{ backgroundColor: color }} />
                            {BRAND_LABELS[b.marca] ?? b.marca}
                            {b.marca === OWN_BRAND && <span className="ml-1 text-rose-500">★</span>}
                          </td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{b.posts}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{b.engagement_promedio.toFixed(2)}%</td>
                          <td className="px-2 py-1.5">
                            <div className="h-1 w-24 rounded-full bg-muted">
                              <div className="h-1 rounded-full" style={{ width: `${rel}%`, backgroundColor: color }} />
                            </div>
                          </td>
                          <td className="px-2 py-1.5 text-right tabular-nums text-emerald-600">{Math.round(b.positivo)}%</td>
                          <td className="px-2 py-1.5 text-right tabular-nums text-rose-600">{Math.round(b.negativo)}%</td>
                          <td className="px-2 py-1.5 text-right tabular-nums">
                            {b.views_promedio > 0 ? fmtK(Math.round(b.views_promedio)) : "—"}
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
        <div className="rounded-lg border bg-card p-4">
          <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Mix de contenido por red
          </h3>
          <SocialContentMixChart data={contentMix} />
        </div>
      </section>

      {/* Sentiment + Content Type */}
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border bg-card p-4">
          <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Sentimiento por marca
          </h3>
          <SocialSentimentChart data={sentByBrand} />
        </div>
        <div className="rounded-lg border bg-card p-4">
          <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Distribución por tipo de contenido
          </h3>
          <SocialContentTypeChart data={contentSlices} />
        </div>
      </section>

      {/* Posts panels */}
      <section className="grid gap-4 lg:grid-cols-2">
        <PostsPanel title={`Posts exitosos · Eng > 0.3% o Positivo > 80%`} posts={successful} color="emerald" />
        <PostsPanel title={`Posts críticos · Negativo > 10%`} posts={critical} color="rose" />
      </section>
    </div>
  );
}

function PostsPanel({
  title,
  posts,
  color,
}: {
  title: string;
  posts: Array<{
    id: string;
    url: string;
    marca: string;
    red_social: string;
    fecha: string | null;
    engagement: number | null;
    positivo: number | null;
    negativo: number | null;
    pilar: string | null;
  }>;
  color: "emerald" | "rose";
}) {
  const accent = color === "emerald" ? "text-emerald-600" : "text-rose-600";
  const bg = color === "emerald" ? "bg-emerald-50" : "bg-rose-50";
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className={`mb-3 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wide ${accent}`}>
        <span>● {title}</span>
        <span className={`rounded px-1.5 py-0.5 ${bg}`}>{posts.length} posts</span>
      </div>
      {posts.length === 0 ? (
        <div className="py-8 text-center text-xs text-muted-foreground">Sin posts en el período.</div>
      ) : (
        <div className="space-y-2">
          {posts.map((p) => (
            <div key={p.id} className={`rounded-md border-l-2 ${color === "emerald" ? "border-emerald-500" : "border-rose-500"} ${bg} p-2`}>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-bold">{(p.engagement ?? 0).toFixed(2)}%</span>
                <span className="rounded px-1.5 py-0.5 text-[10px]" style={{ backgroundColor: `${BRAND_COLORS[p.marca] ?? "#94a3b8"}22`, color: BRAND_COLORS[p.marca] ?? "#64748b" }}>
                  {BRAND_LABELS[p.marca] ?? p.marca}
                </span>
                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px]">{p.red_social}</span>
                {p.pilar && <span className="rounded bg-muted px-1.5 py-0.5 text-[10px]">{p.pilar}</span>}
                <span className="ml-auto text-[10px] text-muted-foreground">
                  {p.fecha ?? "—"}
                </span>
                <a
                  href={p.url}
                  target="_blank"
                  rel="noopener"
                  className={`rounded px-2 py-0.5 text-[10px] font-semibold ${accent}`}
                >
                  Ver →
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
