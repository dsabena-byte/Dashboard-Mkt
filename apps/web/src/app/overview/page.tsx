import { KpiCard } from "@/components/kpi-card";
import { MonthSelector } from "@/components/overview/month-selector";
import { InvestmentDonut } from "@/components/pauta/pauta-charts";
import { WebMonthlyChart } from "@/components/web-monthly-chart";
import {
  MEDIO_COLORS,
  computeFunnel,
  computeByMedio,
  investmentByCategoria,
  extractMeses,
  defaultMes,
} from "@/lib/pauta-data";
import { getPautaPerformance } from "@/lib/pauta-queries";
import {
  getWebDailyKpis,
  aggregateDaily,
  getAllMonthlyUsers,
} from "@/lib/web-queries";
import { getFbOrganicSummary } from "@/lib/meta-fb-queries";
import { getIgOrganicSummary } from "@/lib/meta-ig-queries";
import {
  getSocialPosts,
  getSocialFollowers,
  getLatestFollowers,
  computeBrandStats,
  BRAND_LABELS,
  BRAND_COLORS,
  OWN_BRAND,
} from "@/lib/social-posts-queries";
import { getPlanningMedia, aggregateTotals } from "@/lib/planning-media-queries";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

interface PageProps {
  searchParams: Record<string, string | string[] | undefined>;
}

// Mapeo mes de pauta → rango de fechas + mes de planning (YYYY-MM-01)
const MONTH_MAP: Record<string, { from: string; to: string; planning: string }> = {
  "Abril 2026": { from: "2026-04-01", to: "2026-04-30", planning: "2026-04-01" },
  "Mayo 2026": { from: "2026-05-01", to: "2026-05-31", planning: "2026-05-01" },
};

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
}
function fmtARS(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${Math.round(n)}`;
}

async function safe<T>(p: Promise<T>, fallback: T): Promise<T> {
  try {
    return await p;
  } catch {
    return fallback;
  }
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="mb-3 mt-6 text-sm font-medium text-muted-foreground">{children}</div>;
}

const MES_SHORT = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export default async function OverviewPage({ searchParams }: PageProps) {
  // ===== PAUTA (Supabase, server-side) =====
  const allPauta = await safe(getPautaPerformance(), [] as Awaited<ReturnType<typeof getPautaPerformance>>);
  const pautaMeses = extractMeses(allPauta);
  const fallbackMes = defaultMes(pautaMeses) || "Abril 2026";
  const mesParam = Array.isArray(searchParams.mes) ? searchParams.mes[0] : searchParams.mes;
  const mes = mesParam && MONTH_MAP[mesParam] ? mesParam : fallbackMes;
  const mr = MONTH_MAP[mes] ?? MONTH_MAP[fallbackMes] ?? { from: "2026-04-01", to: "2026-04-30", planning: "2026-04-01" };
  const range = { from: mr.from, to: mr.to };

  const pautaRows = allPauta.filter((r) => r.mes === mes);
  const upper = computeFunnel(pautaRows, "upper");
  const mid = computeFunnel(pautaRows, "mid");
  const totalInv = pautaRows.reduce((s, r) => s + (r.inversion ?? 0), 0);
  const totalViews = pautaRows.reduce((s, r) => s + (r.views ?? 0), 0);
  const catInv = investmentByCategoria(pautaRows);
  const byMedio = computeByMedio(pautaRows);

  // ===== FETCH paralelo y resiliente =====
  const [webRows, monthlyUsers, fb, ig, posts, followers, planningRows] = await Promise.all([
    safe(getWebDailyKpis(range), [] as Awaited<ReturnType<typeof getWebDailyKpis>>),
    safe(getAllMonthlyUsers(), [] as Awaited<ReturnType<typeof getAllMonthlyUsers>>),
    safe(getFbOrganicSummary(range), null),
    safe(getIgOrganicSummary(range), null),
    safe(getSocialPosts({ marca: "all", red: "all", from: range.from, to: range.to }), [] as Awaited<ReturnType<typeof getSocialPosts>>),
    safe(getSocialFollowers(), [] as Awaited<ReturnType<typeof getSocialFollowers>>),
    safe(getPlanningMedia({ fecha: [mr.planning] }), [] as Awaited<ReturnType<typeof getPlanningMedia>>),
  ]);

  const web = aggregateDaily(webRows);
  const planning = aggregateTotals(planningRows);
  const brandStats = computeBrandStats(posts, followers, "all").sort((a, b) => b.engagement_promedio - a.engagement_promedio);

  // Comunidad: followers Drean IG + FB
  const fbFollowers = getLatestFollowers(followers, OWN_BRAND, "FACEBOOK");
  const igFollowers = getLatestFollowers(followers, OWN_BRAND, "INSTAGRAM");
  const comunidad = fbFollowers + igFollowers;

  // Engagement orgánico del mes (FB + IG)
  const fbEng = fb ? fb.totals.reactions_total + fb.totals.clicks + fb.totals.video_views + fb.topPosts.reduce((s, p) => s + p.engagement, 0) : 0;
  const igEng = ig ? ig.totalEngagement : 0;
  const engOrganico = fbEng + igEng;

  // Inversión por etapa sin doble conteo (video → Upper)
  const upperInv = pautaRows.filter((r) => r.objetivo !== "Consider").reduce((s, r) => s + (r.inversion ?? 0), 0);
  const midInv = totalInv - upperInv;

  // Donut mix ON/OFF (ejecutado por tipo de medio)
  let invDigital = 0, invTv = 0, invOoh = 0;
  for (const r of pautaRows) {
    const v = r.inversion ?? 0;
    if (r.medio === "TV Cable") invTv += v;
    else if (r.medio === "DOOH") invOoh += v;
    else invDigital += v;
  }
  const mixOnOff = [
    { name: "Digital", value: invDigital, color: "#2b4dff" },
    { name: "TV Cable", value: invTv, color: "#e63946" },
    { name: "OOH / DOOH", value: invOoh, color: "#f59e0b" },
  ].filter((d) => d.value > 0);

  // Monthly users chart (desde enero 2026 a la fecha)
  const monthlyData = monthlyUsers
    .filter((m) => m.mes >= "2026-01-01")
    .map((m) => {
      const d = new Date(`${m.mes}T00:00:00Z`);
      return {
        mes: `${MES_SHORT[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(2)}`,
        usuarios_curr: m.total_users,
        usuarios_prev: 0,
        sesiones_curr: m.sesiones ?? 0,
        sesiones_prev: 0,
      };
    });

  // Funnel compacto
  const funnelStages = [
    { label: "Impresiones", value: upper.impresiones, w: 100, bg: "#0a1849" },
    { label: "Alcance (suma medios)", value: upper.alcance, w: 80, bg: "#142b6f" },
    { label: "Video Views", value: totalViews, w: 60, bg: "#1e3a8a" },
    { label: "Clicks", value: mid.clics, w: 42, bg: "#2b4dff" },
  ];

  const planExec = planning.total > 0 ? (totalInv / planning.total) * 100 : 0;
  const maxReachMedio = Math.max(...byMedio.map((x) => x.alcance), 1);

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Overview Ejecutivo</h2>
          <p className="text-sm text-muted-foreground">
            Estado de situación de la estrategia de marketing Drean · {mes}
          </p>
        </div>
        <MonthSelector months={pautaMeses} current={mes} />
      </header>

      {/* ===== 1. HERO KPIs ===== */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard title="Inversión ejecutada" value={fmtARS(totalInv)} hint={planning.total > 0 ? `${planExec.toFixed(0)}% del plan (${fmtARS(planning.total)})` : "Pauta del mes"} />
        <KpiCard title="Alcance campañas" value={fmtNum(upper.alcance)} hint="Suma de medios" />
        <KpiCard title="Usuarios web" value={fmtNum(web.usuarios)} hint={`${fmtNum(web.sesiones)} sesiones`} />
        <KpiCard title="Comunidad en redes" value={comunidad > 0 ? fmtNum(comunidad) : "—"} hint="Followers IG + FB" />
        <KpiCard title="Engagement orgánico" value={fmtNum(engOrganico)} hint="FB + IG del mes" />
      </section>

      {/* ===== 2. INVERSIÓN & ESTRATEGIA ===== */}
      <SectionTitle>Inversión &amp; Estrategia</SectionTitle>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border bg-card p-4">
          <h3 className="mb-2 text-sm font-bold">Mix ON / OFF — inversión ejecutada</h3>
          <InvestmentDonut data={mixOnOff} />
        </div>
        <div className="rounded-xl border bg-card p-4">
          <h3 className="mb-2 text-sm font-bold">Inversión por categoría</h3>
          <InvestmentDonut data={catInv} />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <KpiCard title="Ejecutado vs Plan" value={planning.total > 0 ? `${planExec.toFixed(0)}%` : "—"} hint={planning.total > 0 ? `Plan: ${fmtARS(planning.total)}` : "Sin plan cargado"} />
        <KpiCard title="Inversión Upper (Awareness)" value={fmtARS(upperInv)} hint="Reach + Video" />
        <KpiCard title="Inversión Mid (Consideración)" value={fmtARS(midInv)} hint="Tráfico / CPC" />
      </div>

      {/* ===== 3. RESULTADOS DE MEDIOS — FUNNEL ===== */}
      <SectionTitle>Resultados de medios — Funnel</SectionTitle>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border bg-card p-6">
          <div className="flex flex-col items-center gap-1.5">
            {funnelStages.map((s) => (
              <div key={s.label} className="flex items-center justify-between rounded-lg px-5 py-3 text-white" style={{ width: `${s.w}%`, backgroundColor: s.bg }}>
                <span className="text-[11px] font-medium uppercase tracking-wide opacity-90">{s.label}</span>
                <span className="text-lg font-bold">{fmtNum(s.value)}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <h3 className="mb-3 text-sm font-bold">Top plataformas por alcance</h3>
          <div className="space-y-2">
            {byMedio.filter((m) => m.alcance > 0).sort((a, b) => b.alcance - a.alcance).slice(0, 6).map((m) => (
              <div key={m.medio} className="text-xs">
                <div className="mb-1 flex justify-between">
                  <span className="font-medium">{m.medio}</span>
                  <span className="tabular-nums text-muted-foreground">{fmtNum(m.alcance)}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                  <div className="h-full rounded-full" style={{ width: `${(m.alcance / maxReachMedio) * 100}%`, backgroundColor: MEDIO_COLORS[m.medio] ?? "#94a3b8" }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ===== 4. SITIO WEB (GA4) ===== */}
      <SectionTitle>Sitio web propio · GA4</SectionTitle>
      <div className="grid gap-3 sm:grid-cols-4">
        <KpiCard title="Usuarios" value={fmtNum(web.usuarios)} hint="Período seleccionado" />
        <KpiCard title="Sesiones" value={fmtNum(web.sesiones)} />
        <KpiCard title="Conversiones" value={fmtNum(web.conversiones)} hint={web.conversion_rate != null ? `${(web.conversion_rate * 100).toFixed(2)}% conv.` : undefined} />
        <KpiCard title="Pageviews" value={fmtNum(web.pageviews)} hint={web.pages_per_session != null ? `${web.pages_per_session.toFixed(1)} pág/sesión` : undefined} />
      </div>
      {monthlyData.length > 0 && (
        <div className="rounded-xl border bg-card p-4">
          <h3 className="mb-3 text-sm font-bold">Evolución mensual de usuarios y sesiones</h3>
          <WebMonthlyChart data={monthlyData} labels={{ curr: "Usuarios", prev: "" }} />
        </div>
      )}

      {/* ===== 5. MARCA EN REDES ===== */}
      <SectionTitle>Marca en redes — Drean vs competencia</SectionTitle>
      <div className="rounded-xl border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="border-b bg-muted/40">
              <tr className="text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2">Marca</th>
                <th className="px-3 py-2 text-right">Followers</th>
                <th className="px-3 py-2 text-right">Posts</th>
                <th className="px-3 py-2 text-right">Eng. prom</th>
                <th className="px-3 py-2 text-right">% Pos</th>
                <th className="px-3 py-2 text-right">Likes</th>
                <th className="px-3 py-2 text-right">Views</th>
              </tr>
            </thead>
            <tbody>
              {brandStats.length === 0 ? (
                <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">Sin datos de redes en el período.</td></tr>
              ) : brandStats.map((b) => (
                <tr key={b.marca} className="border-b last:border-0">
                  <td className="px-3 py-2 font-medium">
                    <span className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle" style={{ backgroundColor: BRAND_COLORS[b.marca] ?? "#94a3b8" }} />
                    {BRAND_LABELS[b.marca] ?? b.marca}
                    {b.marca === OWN_BRAND && <span className="ml-1 text-rose-500">★</span>}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{b.followers > 0 ? fmtNum(b.followers) : "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{b.posts}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold">{b.engagement_promedio.toFixed(2)}%</td>
                  <td className="px-3 py-2 text-right tabular-nums text-emerald-600">{Math.round(b.positivo)}%</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtNum(b.total_likes)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{b.total_views > 0 ? fmtNum(b.total_views) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <KpiCard title="Instagram Drean" value={ig ? fmtNum(ig.totalReach) : "—"} hint={ig ? `Alcance · ${fmtNum(ig.totalEngagement)} eng.` : undefined} />
        <KpiCard title="Facebook Drean" value={fb ? fmtNum(fb.totals.impressions_unique) : "—"} hint={fb ? `Alcance · ${fmtNum(fbEng)} eng.` : undefined} />
        <KpiCard title="Comunidad total" value={comunidad > 0 ? fmtNum(comunidad) : "—"} hint="Followers IG + FB" />
      </div>

      {/* ===== 6. ACCESOS RÁPIDOS ===== */}
      <SectionTitle>Accesos rápidos</SectionTitle>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { href: "/performance", label: "Performance Pauta", desc: "Resultados de medios por categoría" },
          { href: "/planning", label: "Planning Pauta", desc: "Inversión planificada ON + OFF" },
          { href: "/web", label: "Análisis Web", desc: "GA4: tráfico, canales, audiencia" },
          { href: "/redes", label: "Análisis Redes", desc: "Orgánico Drean + competencia" },
        ].map((l) => (
          <a key={l.href} href={l.href} className="rounded-xl border bg-card p-4 transition-colors hover:bg-muted/50">
            <div className="text-sm font-bold">{l.label}</div>
            <div className="mt-1 text-xs text-muted-foreground">{l.desc}</div>
          </a>
        ))}
      </div>
    </div>
  );
}
