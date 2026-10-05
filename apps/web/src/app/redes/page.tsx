import { fmtEng } from "@/lib/fmt-eng";
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
import { FbOrganicSection } from "@/components/social/fb-organic-section";
import { IgOrganicSection } from "@/components/social/ig-organic-section";
import { OrganicBuildupPanel } from "@/components/social/organic-buildup-panel";
import { TopContentPanel } from "@/components/insights/top-content-panel";
import { MetaPanel } from "@/components/metas/meta-panel";
import { getTopAndBottomPostsLastNDays } from "@/lib/insights-queries";
import { getFbOrganicSummary } from "@/lib/meta-fb-queries";
import { getIgOrganicSummary } from "@/lib/meta-ig-queries";
import { getMetaKpi, type MetaKpiData } from "@/lib/metas-server";
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
  computeWeeklyPostCount,
  enrichEngagement,
  getAllMarcas,
  getLatestFollowers,
  getSocialFollowers,
  getSocialPosts,
} from "@/lib/social-posts-queries";
import { DashTabs, DashTabBar } from "@/components/diagnostico/dash-tabs";
import { ShareEngagementSection } from "@/components/social/share-engagement";
import { getMercadoSeries } from "@/lib/mercado-kpis-server";
import { lastIdx } from "@/lib/mercado-kpis";
import { HowToRead } from "@/components/knowledge/how-to-read";
import { DataHealth } from "@/components/data-health";
import { IgStoriesResumen } from "@/components/social/ig-stories-resumen";
import { RedesContenidoPanel } from "@/components/social/redes-contenido-panel";
import { CompetenciaDiferenciales } from "@/components/social/competencia-diferenciales";
import { getIgStoriesResumen, getOwnContentPosts } from "@/lib/redes-extra-queries";
import { getPostSnapshots } from "@/lib/post-snapshots";
import { attachIgSentiment } from "@/lib/post-sentiment-server";
import { toPostSentiment } from "@/lib/post-sentiment";
import { formatBenchmarks, bestTimes } from "@/lib/redes-contenido";
import { comparableEr, erComparablePorMarca, trendMaduro, probablePauta, pautaPorMarca, ER_METODO_TXT, ER_METODO_EDAD_TXT } from "@/lib/redes-competencia";
import { temasPorMarca, temaGaps } from "@/lib/redes-temas";
import { LearnButton } from "@/components/knowledge/learn-button";

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
  const metaFallback: MetaKpiData = { valores: Array.from({ length: 12 }, () => null), direccion: "up", umbralVerde: 100, umbralAmarillo: 90, unidad: null };
  // Share of engagement (año completo, todas las marcas/redes): mismo cálculo que el KPI del Mapa.
  const mercadoP = safe(getMercadoSeries(currentYear), null, "getMercadoSeries");
  const [rawPosts, allMarcas, followers, fbOrganic, igOrganic, topContent, metaAlc, metaEng, fbMetaAlc, fbMetaEng] = await Promise.all([
    getSocialPosts({ marca, red, from: range.from, to: range.to }),
    getAllMarcas(),
    getSocialFollowers(),
    getFbOrganicSummary({ from: range.from, to: range.to }),
    getIgOrganicSummary({ from: range.from, to: range.to }),
    safe(
      getTopAndBottomPostsLastNDays(30, 5),
      { instagram: { top: [], bottom: [] }, facebook: { top: [], bottom: [] } } as Awaited<ReturnType<typeof getTopAndBottomPostsLastNDays>>,
      "getTopAndBottomPostsLastNDays",
    ),
    // Meta mensual de "Alcance orgánico" para pintarla como línea en el gráfico IG.
    safe(getMetaKpi("Redes Sociales", "Alcance orgánico", currentYear), metaFallback, "getMetaKpi(alcance)"),
    safe(getMetaKpi("Redes Sociales", "Engagement rate", currentYear), metaFallback, "getMetaKpi(eng)"),
    // Metas de FACEBOOK — clave separada de IG (plan "Facebook"), no tocan el objetivo estratégico (IG-only).
    safe(getMetaKpi("Facebook", "Alcance orgánico", currentYear), metaFallback, "getMetaKpi(fb-alcance)"),
    safe(getMetaKpi("Facebook", "Engagement rate", currentYear), metaFallback, "getMetaKpi(fb-eng)"),
  ]);

  // Secciones nuevas (sep-2026): lecturas livianas e independientes → en paralelo y fail-safe.
  const [storiesResumen, ownContent, snaps7, igTopPosts] = await Promise.all([
    safe(getIgStoriesResumen(range), null, "getIgStoriesResumen"),
    safe(getOwnContentPosts(range), [], "getOwnContentPosts"),
    safe(getPostSnapshots({ edad: 7 }), [], "getPostSnapshots"),
    // Sentimiento de comentarios por post (social_posts, join por shortcode).
    safe(attachIgSentiment(igOrganic.topPosts, range), igOrganic.topPosts, "attachIgSentiment"),
  ]);
  const mercado = await mercadoP;
  const sosSerie = mercado?.series["Share of Search"]?.realM ?? [];
  const sosRef = lastIdx(sosSerie);
  const sosLast = sosRef >= 0 ? { mes: `${currentYear}-${String(sosRef + 1).padStart(2, "0")}`, share: sosSerie[sosRef]! } : null;

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
  // ER COMPARABLE por marca (corrige el sesgo de maduración): foto a 7 días si la marca tiene ≥3
  // (social_post_snapshots), si no mediana de posts con 7+ días, si no "preliminar". Reemplaza el
  // promedio simple (un sorteo viral de una marca inflaba su promedio ~100×, validado sep-2026).
  const erMarca = erComparablePorMarca(posts, snaps7, red);
  const erGlobal = comparableEr(posts);
  const hayEdadFija = [...erMarca.values()].some((e) => e.metodo === "edad_fija");
  // Tendencia mensual: padea a 12 meses del año actual para mostrar el año completo.
  // Los meses sin posts quedan con `values: {}` => recharts no dibuja punto (gap en la línea).
  // Tendencia: mediana mensual con posts maduros (7+ días) → el mes en curso no se subestima.
  const trendRaw = trendMaduro(posts);
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
      sentiment: toPostSentiment(p),
    }));

  const hasData = posts.length > 0;
  // Sentiment solo aplica para Instagram. Si filtran por FB/TT, lo ocultamos.
  const showSentiment = red === "all" || red === "INSTAGRAM";

  // ===== Snapshot IG del MES EN CURSO para las metas mensuales =====
  // El objetivo estratégico de Redes se mide SOLO con Instagram (FB deprecó su
  // reach orgánico y el reemplazo no separa pago de orgánico → dato no confiable).
  // El dashboard sigue mostrando FB y el combinado; la META es IG. Las metas son
  // MENSUALES: el "real" del semáforo es el valor IG del mes en curso.
  const MES_SHORT = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  const mesIdx = new Date().getMonth(); // 0-11
  const year2 = String(currentYear).slice(2);
  const mesLabel = `${MES_SHORT[mesIdx]} ${year2}`; // formato de igOrganic.monthlyData ("Ago 26")
  const igMes = igOrganic.monthlyData.find((m) => m.mes === mesLabel);
  const alcanceMes = igMes?.alcance ?? null;
  const interaccionesMes = igMes?.engagement ?? null;
  // Engagement rate IG del mes = interacciones / alcance (mismo par que el gráfico IG).
  const engRateMes = alcanceMes && interaccionesMes ? (interaccionesMes / alcanceMes) * 100 : null;
  const igFollowers = getLatestFollowers(followers, OWN_BRAND, "INSTAGRAM") || 145_700;

  // Snapshot FB del mes en curso (para el semáforo del panel de metas de FB).
  const fbMes = fbOrganic.monthlyData.find((m) => m.mes === mesLabel);
  const fbAlcMes = fbMes?.alcance ?? null;
  const fbEngMes = fbMes && fbMes.alcance && fbMes.engagement != null && fbMes.alcance > 0 ? (fbMes.engagement / fbMes.alcance) * 100 : null;

  // Formatos y horarios propios (posts maduros, orgánicos, sin Stories).
  const refNow = new Date();
  const formatos = formatBenchmarks(ownContent, refNow);
  const horarios = bestTimes(ownContent, refNow);

  // Pauta probable + temas de la competencia (sobre los posts filtrados del competitivo).
  const prob = probablePauta(posts);
  const pautaMarcas = pautaPorMarca(posts, prob);
  const pautaPosts = posts
    .filter((p) => prob.has(p.url) && p.marca !== OWN_BRAND)
    .sort((a, b) => (b.views ?? 0) - (a.views ?? 0))
    .slice(0, 6)
    .map((p) => ({ url: p.url, marca: p.marca, fecha: p.fecha, views: p.views, likes: p.likes, comentarios: p.comentarios, prob: prob.get(p.url)!, copy: p.copy }));
  const temasActivos = posts.some((p) => p.tema);
  const temaPosts = posts.map((p) => ({ marca: p.marca, tema: p.tema ?? null, engagement: p.engagement }));
  const temasMarca = temasActivos ? temasPorMarca(temaPosts, 4) : [];
  const temasGap = temasActivos ? temaGaps(temaPosts, OWN_BRAND) : [];

  // Construcción orgánica (alcance/views/interacción por pilar y categoría).
  const organicBuildup = computeOrganicBuildup([...igOrganic.topPosts, ...fbOrganic.topPosts]);

  return (
    <DashTabs
      dash="redes"
      className="space-y-4"
      startDiag={tab === "insights"}
      // Lo que mejor y peor funcionó (top/bottom posts 30 días): dentro del análisis completo del Diagnóstico.
      diagExtra={<TopContentPanel instagram={topContent.instagram} facebook={topContent.facebook} />}
    >
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Redes Sociales</h2>
          <p className="text-sm text-muted-foreground">
            Analítica Orgánica de Drean y Análisis competitivo de RRSS.
          </p>
        </div>
        <DateRangePicker initialFrom={range.from} initialTo={range.to} />
      </header>
      <DataHealth dash="redes" className="-mt-2" />
      <HowToRead slug="redes" />

      <DashTabBar items={[{ key: "analitica", label: "Analítica" }]} />

      {(
        <>

      {/* ===== Instagram orgánico (Drean mide SOLO IG) ===== */}
      <IgOrganicSection data={{ ...igOrganic, topPosts: igTopPosts }} metaAlc={metaAlc} metaEng={metaEng} />

      {/* Stories de IG acumuladas (alcance = piso; tasas de salida/respuesta desde sep-2026) */}
      <IgStoriesResumen data={storiesResumen} />

      {/* ===== Configuración de metas del plan (debajo de Instagram) ===== */}
      <MetaPanel
        plan="Redes Sociales"
        titulo="Configuración de metas de Redes Sociales"
        subtitulo={`Objetivo medido SOLO con Instagram (FB quedó fuera por la deprecación de su reach). El semáforo compara el real IG de ${mesLabel} vs la meta del mes. Seguidores es el total vigente.`}
        kpis={[
          { nombre: "Alcance orgánico", actual: alcanceMes },
          { nombre: "Engagement rate", unidad: "%", actual: engRateMes },
          { nombre: "Sentiment", unidad: "%", actual: kpis.sentimiento_positivo },
          { nombre: "Seguidores", actual: igFollowers },
          { nombre: "Interacciones", actual: interaccionesMes },
        ]}
      />

      <OrganicBuildupPanel byPilar={organicBuildup.byPilar} byCategoria={organicBuildup.byCategoria} />

      {/* Formatos y mejor día/franja del contenido propio (posts maduros) */}
      <RedesContenidoPanel formatos={formatos} horarios={horarios} />

      <FbOrganicSection data={fbOrganic} metaAlc={fbMetaAlc} metaEng={fbMetaEng} />

      {/* Configuración de metas de Facebook (clave separada de IG) */}
      <MetaPanel
        plan="Facebook"
        titulo="Configuración de metas de Facebook"
        subtitulo={`Metas propias de FB (separadas de IG, no afectan el objetivo estratégico). El semáforo compara el real FB de ${mesLabel} vs la meta del mes.`}
        kpis={[
          { nombre: "Alcance orgánico", actual: fbAlcMes },
          { nombre: "Engagement rate", unidad: "%", actual: fbEngMes },
        ]}
      />

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

      {/* Share of engagement del set competitivo (KPI "Mercado y competencia" del Mapa) */}
      <ShareEngagementSection soe={mercado?.soe ?? null} shareSearch={sosLast} />

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
                  {fmtEng(n.engagement_promedio)}
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
        <KpiCard title="Engagement (mediana)" value={`${erGlobal.value.toFixed(3)}%`} hint={`${erGlobal.metodo === "maduro" ? "Posts con 7+ días" : "Preliminar"} · prom. ${fmtEng(kpis.engagement_promedio)}`} />
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
            Tendencia mensual de engagement <span className="normal-case text-muted-foreground/70">(mediana, posts con 7+ días)</span> <LearnButton k="er_comparable" />
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
          <h3 className="mb-3 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Benchmark de marcas · KPIs comparados <LearnButton k="er_comparable" />
          </h3>
          <p className="mb-2 text-[10px] text-muted-foreground">
            ER comp. = mediana del engagement por seguidor ((likes + comentarios) ÷ seguidores) de los posts con 7+ días (° = foto a los 7 días de
            publicado, misma edad para todas las marcas; * = preliminar, pocos posts maduros). Reemplaza el promedio, que un sorteo viral distorsiona.
          </p>
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
                  <th className="px-1 py-1.5 text-right" title={hayEdadFija ? ER_METODO_EDAD_TXT : ER_METODO_TXT}>ER comp.</th>
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
                          <td className="px-1 py-1.5 text-right tabular-nums" title={erMarca.get(b.marca)?.metodo === "edad_fija" ? "Foto a los 7 días de publicado" : erMarca.get(b.marca)?.metodo === "maduro" ? "Mediana de posts con 7+ días" : "Preliminar: pocos posts maduros"}>
                            {(erMarca.get(b.marca)?.value ?? 0).toFixed(3)}%{erMarca.get(b.marca)?.metodo === "edad_fija" ? "°" : erMarca.get(b.marca)?.metodo === "preliminar" ? "*" : ""}
                          </td>
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

      {/* Pauta probable + temas por marca de la competencia */}
      <CompetenciaDiferenciales
        pauta={pautaMarcas}
        pautaPosts={pautaPosts}
        temas={temasMarca}
        gaps={temasGap}
        labels={BRAND_LABELS}
        ownKey={OWN_BRAND}
        temasActivos={temasActivos}
      />

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
    </DashTabs>
  );
}
