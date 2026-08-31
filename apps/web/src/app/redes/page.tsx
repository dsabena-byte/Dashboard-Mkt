import { KpiCard } from "@/components/kpi-card";
import { DateRangePicker } from "@/components/date-range-picker";
import { parseDateRange } from "@/lib/dates";
import { SocialFilters } from "@/components/social/social-filters";
import { SocialTrendChart } from "@/components/social/social-trend-chart";
import { SocialPilarChart } from "@/components/social/social-pilar-chart";
import { SocialSentimentChart } from "@/components/social/social-sentiment-chart";
import { SocialContentTypeChart } from "@/components/social/social-content-type-chart";
import { CompetenciaPostsPanel } from "@/components/social/competencia-posts-panel";
import { BrandSentimentSummary } from "@/components/social/brand-sentiment-summary";
import { IgOrganicSection } from "@/components/social/ig-organic-section";
import { OrganicBuildupPanel } from "@/components/social/organic-buildup-panel";
import { InsightsPanel } from "@/components/insights/insights-panel";
import { TopContentPanel } from "@/components/insights/top-content-panel";
import { RedesTabs } from "@/components/social/redes-tabs";
import { MetaPanel } from "@/components/metas/meta-panel";
import { getInsightsByCategoria, getTopAndBottomPostsLastNDays } from "@/lib/insights-queries";
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
  const [rawPosts, allMarcas, followers, igOrganic, insightsOrganico, topContent] = await Promise.all([
    getSocialPosts({ marca, red, from: range.from, to: range.to }),
    getAllMarcas(),
    getSocialFollowers(),
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
  // Posteos de competencia para el panel por marca. Solo Instagram: las marcas
  // suelen duplicar contenido en FB y ahí las métricas son más pobres.
  const competenciaPosts = posts
    .filter((p) => p.marca !== OWN_BRAND && p.red_social === "INSTAGRAM")
    .map((p) => ({
      id: p.id,
      marca: p.marca,
      red_social: p.red_social,
      content_type: p.content_type,
      url: p.url,
      fecha: p.fecha,
      engagement: p.engagement,
      likes: p.likes,
      comentarios: p.comentarios,
      views: p.views,
      pilar: p.pilar,
      thumbnail_url: p.thumbnail_url,
      copy: p.copy,
    }));

  const hasData = posts.length > 0;
  // Sentiment solo aplica para Instagram. Si filtran por FB/TT, lo ocultamos.
  const showSentiment = red === "all" || red === "INSTAGRAM";

  // ===== Redes mide SOLO Instagram =====
  // Facebook deprecó su reach orgánico (Meta, 15-jun-2026) y la métrica de
  // reemplazo no separa pago de orgánico → dato no confiable. Se excluye FB y el
  // combinado de la analítica orgánica de Drean; el análisis competitivo (abajo)
  // sigue mostrando todas las redes porque es otra cosa (benchmark de marcas).

  // Snapshot IG del MES EN CURSO para las metas mensuales. Las metas son MENSUALES:
  // el "real" del semáforo es el valor del mes en curso (no el acumulado del período).
  const MES_SHORT = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  const mesIdx = new Date().getMonth(); // 0-11
  const year2 = String(currentYear).slice(2);
  const mesLabel = `${MES_SHORT[mesIdx]} ${year2}`; // formato de igOrganic.monthlyData ("Ago 26")
  const igMes = igOrganic.monthlyData.find((m) => m.mes === mesLabel);
  const alcanceMes = igMes?.alcance ?? null;
  const interaccionesMes = igMes?.engagement ?? null;
  // Engagement rate IG del mes = interacciones / alcance (mismo par que el gráfico).
  const engRateMes = alcanceMes && interaccionesMes ? (interaccionesMes / alcanceMes) * 100 : null;
  const igFollowers = getLatestFollowers(followers, OWN_BRAND, "INSTAGRAM") || 145_700;

  // Construcción orgánica IG (alcance/views/interacción por pilar y categoría).
  const organicBuildup = computeOrganicBuildup(igOrganic.topPosts);

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

      {/* ===== Instagram orgánico (Drean mide SOLO IG) ===== */}
      <IgOrganicSection data={igOrganic} />

      {/* ===== Metas del plan (KPIs que conectan con el Mapa Estratégico) ===== */}
      <MetaPanel
        plan="Redes Sociales"
        titulo="Metas de Redes Sociales"
        subtitulo={`Metas mensuales de los KPIs que este plan aporta al Mapa Estratégico. El semáforo compara el real de ${mesLabel} en Instagram vs la meta del mes. Seguidores es el total vigente.`}
        kpis={[
          { nombre: "Alcance orgánico", actual: alcanceMes },
          { nombre: "Engagement rate", unidad: "%", actual: engRateMes },
          { nombre: "Sentiment", unidad: "%", actual: kpis.sentimiento_positivo },
          { nombre: "Seguidores", actual: igFollowers },
          { nombre: "Interacciones", actual: interaccionesMes },
        ]}
      />

      <OrganicBuildupPanel byPilar={organicBuildup.byPilar} byCategoria={organicBuildup.byCategoria} />

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
            <table className="w-full table-fixed text-[11px]">
              <colgroup>
                <col className="w-[17%]" />
                <col className="w-[10%]" />
                <col className="w-[7%]" />
                <col className="w-[9%]" />
                <col className="w-[9%]" />
                <col className="w-[7%]" />
                <col className="w-[7%]" />
                <col className="w-[7%]" />
                <col className="w-[9%]" />
                <col className="w-[9%]" />
                <col className="w-[9%]" />
              </colgroup>
              <thead className="border-b">
                <tr className="text-left text-[9px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-1 py-1.5">Marca</th>
                  <th className="px-1 py-1.5 text-right">Follow.</th>
                  <th className="px-1 py-1.5 text-right">Posts</th>
                  <th className="px-1 py-1.5 text-right">P/sem</th>
                  <th className="px-1 py-1.5 text-right">Eng.</th>
                  <th className="px-1 py-1.5 text-right">Pos</th>
                  <th className="px-1 py-1.5 text-right">Neg</th>
                  <th className="px-1 py-1.5 text-right">Neu</th>
                  <th className="px-1 py-1.5 text-right">Likes</th>
                  <th className="px-1 py-1.5 text-right">Com.</th>
                  <th className="px-1 py-1.5 text-right">Views</th>
                </tr>
              </thead>
              <tbody>
                {brandStats.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-1 py-6 text-center text-muted-foreground">
                      Sin datos.
                    </td>
                  </tr>
                ) : (
                  (() => {
                    return brandStats.map((b) => {
                      const color = BRAND_COLORS[b.marca] ?? "#94a3b8";
                      return (
                        <tr key={b.marca} className="border-b last:border-0">
                          <td className="px-1 py-1.5 font-medium">
                            <span className="mr-1 inline-block h-2 w-2 shrink-0 rounded-full align-middle" style={{ backgroundColor: color }} />
                            <span className="align-middle">{BRAND_LABELS[b.marca] ?? b.marca}</span>
                            {b.marca === OWN_BRAND && <span className="ml-0.5 align-middle text-rose-500">★</span>}
                          </td>
                          <td className="px-1 py-1.5 text-right tabular-nums text-muted-foreground">
                            {b.followers > 0 ? fmtK(b.followers) : "—"}
                          </td>
                          <td className="px-1 py-1.5 text-right tabular-nums">{b.posts}</td>
                          <td className="px-1 py-1.5 text-right tabular-nums text-muted-foreground">{b.posts_per_week.toFixed(1)}</td>
                          <td className="px-1 py-1.5 text-right tabular-nums">{b.engagement_promedio.toFixed(2)}%</td>
                          <td className="px-1 py-1.5 text-right tabular-nums text-emerald-600">{Math.round(b.positivo)}%</td>
                          <td className="px-1 py-1.5 text-right tabular-nums text-rose-600">{Math.round(b.negativo)}%</td>
                          <td className="px-1 py-1.5 text-right tabular-nums text-slate-500">{Math.round(b.neutro)}%</td>
                          <td className="px-1 py-1.5 text-right tabular-nums">{fmtK(b.total_likes)}</td>
                          <td className="px-1 py-1.5 text-right tabular-nums">{fmtK(b.total_comentarios)}</td>
                          <td className="px-1 py-1.5 text-right tabular-nums">
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

      {/* Posteos de competencia agrupados por marca (tarjetas con filtros) */}
      <CompetenciaPostsPanel posts={competenciaPosts} />
        </>
      )}
    </div>
  );
}
