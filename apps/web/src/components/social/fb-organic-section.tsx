"use client";

import { useState } from "react";
import { KpiCard } from "@/components/kpi-card";
import { FbMonthlyChart } from "@/components/social/fb-monthly-chart";
import { ClasifBadge } from "@/components/social/clasif-badge";
import type { FbOrganicSummary, FbDemoBreakdown } from "@/lib/meta-fb-queries";

function fmtK(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
}

function HorizontalBars({
  rows,
  emptyText,
  accent = "bg-blue-500",
}: {
  rows: FbDemoBreakdown[];
  emptyText: string;
  accent?: string;
}) {
  if (rows.length === 0) {
    return <div className="text-xs text-muted-foreground">{emptyText}</div>;
  }
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.category} className="text-xs">
          <div className="mb-1 flex items-baseline justify-between gap-2">
            <span className="max-w-[180px] truncate font-medium" title={r.category}>
              {r.category}
            </span>
            <span className="tabular-nums text-muted-foreground">
              {fmtK(r.value)} ({r.pct.toFixed(1)}%)
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className={`${accent} h-full rounded-full`}
              style={{ width: `${(r.value / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function FbOrganicSection({ data }: { data: FbOrganicSummary }) {
  const hasAnyData = data.totals.diasConData > 0 || data.topPosts.length > 0;
  const [showAllPosts, setShowAllPosts] = useState(false);

  const posts = data.topPosts;
  const totalReactions = posts.reduce((s, p) => s + (p.reactions ?? 0), 0);
  const totalCommentsShares = posts.reduce((s, p) => s + (p.engagement ?? 0), 0);
  const totalClicks = posts.reduce((s, p) => s + (p.clicks ?? 0), 0);
  const totalVideoViews = posts.reduce((s, p) => s + (p.video_views ?? 0), 0);
  const engagementTotal = totalReactions + totalCommentsShares + totalClicks + totalVideoViews;

  const [sortBy, setSortBy] = useState<"engagement" | "fecha">("fecha");
  const [filterType, setFilterType] = useState<"all" | "feed" | "reels" | "stories">("all");

  function matchesType(p: { media_type: string | null }, t: typeof filterType): boolean {
    if (t === "all") return true;
    const mt = (p.media_type ?? "").toUpperCase();
    // Mapeo Meta para FB: PHOTO/ALBUM/STATUS/LINK = feed; VIDEO/REEL = reels; STORY = stories
    if (t === "feed") return mt === "PHOTO" || mt === "ALBUM" || mt === "STATUS" || mt === "LINK";
    if (t === "reels") return mt === "VIDEO" || mt === "REEL" || mt === "REELS";
    if (t === "stories") return mt === "STORY";
    return true;
  }

  const filteredPosts = posts.filter((p) => matchesType(p, filterType));
  const sortedPosts =
    sortBy === "fecha"
      ? [...filteredPosts].sort((a, b) => (b.fecha_post ?? "").localeCompare(a.fecha_post ?? ""))
      : [...filteredPosts].sort(
          (a, b) => (b.reach + b.engagement + b.reactions + b.video_views + b.clicks) - (a.reach + a.engagement + a.reactions + a.video_views + a.clicks),
        );
  const visiblePosts = showAllPosts ? sortedPosts : sortedPosts.slice(0, 12);

  return (
    <section className="space-y-4 rounded-lg border bg-card p-6">
      <header className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg text-white text-xs font-bold" style={{ backgroundColor: "#1877F2" }}>FB</div>
        <div>
          <h3 className="text-base font-semibold tracking-tight">
            Facebook organico &mdash; Page Drean
          </h3>
          <p className="text-xs text-muted-foreground">
            KPIs del periodo{" "}
            <span className="text-muted-foreground/70">({data.rangeLabel})</span>
          </p>
        </div>
      </header>

      {!hasAnyData ? (
        <div className="rounded-lg border bg-amber-50 p-4 text-sm text-amber-900">
          <strong>Sin datos de Facebook org&aacute;nico.</strong> Ejecut&aacute; el cron
          <code> /api/cron/meta-fb-sync</code> para cargar datos.
        </div>
      ) : (
        <>
          {/* KPIs principales */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <KpiCard
              title="Alcance (personas únicas)"
              value={fmtK(data.totals.impressions_unique)}
              hint={`${posts.length} posts · Total Unique Media Views`}
            />
            <KpiCard
              title="Fans (followers)"
              value={fmtK(data.totals.fans_total)}
              hint={`${data.totals.fan_delta >= 0 ? "+" : ""}${fmtK(data.totals.fan_delta)} en el período`}
            />
            <KpiCard
              title="Visitas al perfil"
              value={fmtK(data.totals.page_views)}
            />
          </div>

          {/* Engagement total como card resaltado + sub-cards */}
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
            <div className="rounded-lg border-2 border-blue-200 bg-blue-50/50 p-4">
              <div className="text-xs font-medium text-blue-600">Engagement total</div>
              <div className="mt-1 text-2xl font-bold text-blue-700">
                {fmtK(engagementTotal)}
              </div>
              <div className="mt-1 text-[10px] text-blue-500">{posts.length} posts</div>
            </div>
            <KpiCard
              title="Reacciones"
              value={fmtK(totalReactions)}
              hint={`${"👍"} likes + ${"❤️"} love + ${"😂"} haha + ${"😮"} wow`}
            />
            <KpiCard
              title="Comments + Shares"
              value={fmtK(totalCommentsShares)}
            />
            <KpiCard
              title="Clicks en posts"
              value={fmtK(totalClicks)}
            />
            <KpiCard
              title="Video views"
              value={fmtK(totalVideoViews)}
            />
          </div>

          {/* Gráfico mensual */}
          {data.monthlyData.length > 0 && (
            <div className="rounded-lg border bg-background p-4">
              <h4 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Evolución mensual &mdash; Alcance vs Engagement
              </h4>
              <p className="mb-3 text-[10px] leading-relaxed text-muted-foreground">
                ℹ️ <strong>Alcance = alcance mensual de la Página</strong> (Graph API <code>period=month</code>, mes calendario
                completo), no la suma del reach de posts. Evita el sesgo de la métrica nueva de posts (que es
                <em>lifetime</em> y hace caer los meses recientes hasta que maduran). Donde todavía no hay dato mensual de la
                Página, se cae a la suma de posts. <strong>No incluye Stories</strong>: Meta no expone las Stories de Páginas de
                FB por API (IG sí), así que IG suma sus Stories y FB no. Detalle: <code>docs/meta-fb-reach-deprecation.md</code>.
              </p>
              <FbMonthlyChart data={data.monthlyData} />
            </div>
          )}

          {/* Demografía */}
          {(data.fansByAgeGender.length > 0 || data.fansByCountry.length > 0 || data.fansByCity.length > 0) && (
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="rounded-lg border bg-background p-4">
                <h4 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Fans &mdash; Edad &times; Género
                </h4>
                <HorizontalBars
                  rows={data.fansByAgeGender}
                  emptyText="Sin breakdown demográfico disponible."
                  accent="bg-emerald-500"
                />
              </div>
              <div className="rounded-lg border bg-background p-4">
                <h4 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Fans &mdash; Top países
                </h4>
                <HorizontalBars
                  rows={data.fansByCountry}
                  emptyText="Sin breakdown de país."
                  accent="bg-blue-500"
                />
              </div>
              <div className="rounded-lg border bg-background p-4">
                <h4 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Fans &mdash; Top ciudades
                </h4>
                <HorizontalBars
                  rows={data.fansByCity}
                  emptyText="Sin breakdown de ciudad."
                  accent="bg-violet-500"
                />
              </div>
            </div>
          )}

          {/* Top posts */}
          {posts.length > 0 && (
            <div className="rounded-lg border bg-background p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Top posts del per&iacute;odo
                </h4>
                <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                  {(["all", "feed", "reels", "stories"] as const).map((t) => {
                    const count = posts.filter((p) => matchesType(p, t)).length;
                    return (
                      <button
                        key={t}
                        onClick={() => { setFilterType(t); setShowAllPosts(false); }}
                        className={`rounded-full px-2 py-0.5 transition-colors ${
                          filterType === t ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:bg-muted/80"
                        }`}
                      >
                        {t === "all" ? "Todos" : t === "feed" ? "Feed" : t === "reels" ? "Reels" : "Stories"} ({count})
                      </button>
                    );
                  })}
                  <span className="mx-1 h-3 w-px bg-border" aria-hidden />
                  {(["engagement", "fecha"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setSortBy(s)}
                      className={`rounded-full px-2 py-0.5 transition-colors ${
                        sortBy === s ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      {s === "engagement" ? "Por engagement" : "Por fecha"}
                    </button>
                  ))}
                </div>
              </div>
              {sortedPosts.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground">Sin posts de tipo &quot;{filterType}&quot; en el per&iacute;odo.</div>
              ) : (
              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {visiblePosts.map((p) => (
                  <a
                    key={p.post_id}
                    href={p.permalink ?? "#"}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="group block rounded-md border bg-card p-2 transition-colors hover:bg-muted/50"
                  >
                    {p.thumbnail_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.thumbnail_url}
                        alt=""
                        className="mb-1.5 aspect-square w-full rounded object-cover"
                        loading="lazy"
                        onError={(e) => {
                          const t = e.currentTarget;
                          t.style.display = "none";
                          if (t.nextElementSibling instanceof HTMLElement) {
                            t.nextElementSibling.style.display = "flex";
                          }
                        }}
                      />
                    ) : null}
                    <div
                      className="mb-1.5 flex aspect-square w-full items-center justify-center rounded bg-muted text-[10px] text-muted-foreground"
                      style={{ display: p.thumbnail_url ? "none" : "flex" }}
                    >
                      Sin img
                    </div>
                    {/* Clasificación: categoría + pilar */}
                    <ClasifBadge categoria={p.categoria} pilar={p.pilar_contenido} />
                    <p className="line-clamp-2 text-[10px] text-foreground" title={p.message ?? ""}>
                      {p.message || <span className="italic text-muted-foreground">Sin texto</span>}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[9px] tabular-nums text-muted-foreground">
                      {p.reach > 0 && <span>{"👁"} {fmtK(p.reach)}</span>}
                      <span>{"👍"} {fmtK(p.reactions)}</span>
                      <span>{"💬"} {fmtK(p.engagement)}</span>
                      {p.clicks > 0 && <span>{"🔗"} {fmtK(p.clicks)}</span>}
                      {p.video_views > 0 && <span>{"▶"} {fmtK(p.video_views)}</span>}
                    </div>
                  </a>
                ))}
              </div>
              )}
              {sortedPosts.length > 12 && (
                <div className="mt-3 text-center">
                  <button
                    onClick={() => setShowAllPosts(!showAllPosts)}
                    className="rounded border px-4 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary"
                  >
                    {showAllPosts ? "Mostrar menos" : `Ver todos (${sortedPosts.length} posts)`}
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
