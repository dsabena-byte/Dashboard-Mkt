"use client";

import { useState } from "react";
import { KpiCard } from "@/components/kpi-card";
import { FbMonthlyChart } from "@/components/social/fb-monthly-chart";
import type { IgOrganicSummary, IgDemoBreakdown } from "@/lib/meta-ig-queries";

function fmtK(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
}

function HorizontalBars({
  rows,
  emptyText,
  accent = "bg-pink-500",
}: {
  rows: IgDemoBreakdown[];
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

export function IgOrganicSection({ data }: { data: IgOrganicSummary }) {
  const [showAllPosts, setShowAllPosts] = useState(false);
  const [sortBy, setSortBy] = useState<"engagement" | "fecha">("engagement");
  const [filterType, setFilterType] = useState<"all" | "feed" | "reels" | "stories">("all");

  function matchesType(p: { media_type: string | null }, t: typeof filterType): boolean {
    if (t === "all") return true;
    const mt = (p.media_type ?? "").toUpperCase();
    if (t === "feed") return mt === "FEED" || mt === "IMAGE" || mt === "CAROUSEL_ALBUM";
    if (t === "reels") return mt === "REELS" || mt === "REEL" || mt === "VIDEO";
    if (t === "stories") return mt === "STORY";
    return true;
  }

  const filteredPosts = data.topPosts.filter((p) => matchesType(p, filterType));
  const sortedPosts =
    sortBy === "fecha"
      ? [...filteredPosts].sort((a, b) => (b.fecha_post ?? "").localeCompare(a.fecha_post ?? ""))
      : [...filteredPosts].sort(
          (a, b) => (b.reach + b.engagement + b.video_views) - (a.reach + a.engagement + a.video_views),
        );
  const visiblePosts = showAllPosts ? sortedPosts : sortedPosts.slice(0, 12);

  if (data.postCount === 0 && data.demoAge.length === 0) {
    return (
      <section className="rounded-lg border bg-card p-6">
        <h3 className="text-base font-semibold tracking-tight">Instagram org&aacute;nico &mdash; @dreanargentina</h3>
        <div className="mt-3 rounded-lg border bg-amber-50 p-4 text-sm text-amber-900">
          <strong>Sin datos de Instagram.</strong> Ejecut&aacute; <code>/api/cron/ig-sync?days=148</code> para cargar datos.
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-lg border bg-card p-6">
      <header className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg text-white text-xs font-bold" style={{ background: "linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)" }}>IG</div>
        <div>
        <h3 className="text-base font-semibold tracking-tight">
          Instagram organico &mdash; @dreanargentina
        </h3>
        <p className="text-xs text-muted-foreground">
          KPIs del periodo <span className="text-muted-foreground/70">({data.rangeLabel})</span>
        </p>
        </div>
      </header>

      {/* KPIs principales (por post, respeta el filtro de fecha) */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-2">
        <KpiCard
          title="Alcance (personas)"
          value={fmtK(data.totalReach)}
          hint={`Suma reach de ${data.postCount} posts del período`}
        />
        <KpiCard
          title="Followers"
          value="145.7K"
        />
      </div>

      {/* Engagement resaltado + sub-cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-lg border-2 border-blue-200 bg-blue-50/50 p-4">
          <div className="text-xs font-medium text-blue-600">Engagement total</div>
          <div className="mt-1 text-2xl font-bold text-blue-700">
            {fmtK(data.totalEngagement)}
          </div>
          <div className="mt-1 text-[10px] text-blue-500">{data.postCount} posts</div>
        </div>
        <KpiCard
          title="Likes"
          value={fmtK(data.totalReactions)}
          hint={`${"❤️"} ${fmtK(data.totalReactions)}`}
        />
        <KpiCard
          title="Comentarios"
          value={fmtK(data.totalComments)}
        />
        <KpiCard
          title="Guardados"
          value={fmtK(data.totalSaves)}
        />
        <KpiCard
          title="Video views"
          value={fmtK(data.totalVideoViews)}
        />
      </div>

      {/* Gr&aacute;fico mensual */}
      {data.monthlyData.length > 0 && (
        <div className="rounded-lg border bg-background p-4">
          <h4 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Evoluci&oacute;n mensual &mdash; Alcance vs Engagement
          </h4>
          <FbMonthlyChart data={data.monthlyData} />
        </div>
      )}

      {/* Demografia */}
      {(data.demoAge.length > 0 || data.demoGender.length > 0) && (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-lg border bg-background p-4">
            <h4 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Edad
            </h4>
            <HorizontalBars rows={data.demoAge} emptyText="Sin datos." accent="bg-pink-500" />
          </div>
          <div className="rounded-lg border bg-background p-4">
            <h4 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Genero
            </h4>
            <HorizontalBars rows={data.demoGender} emptyText="Sin datos." accent="bg-purple-500" />
          </div>
          <div className="rounded-lg border bg-background p-4">
            <h4 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Top Provincias
            </h4>
            <HorizontalBars rows={data.demoProvince} emptyText="Sin datos." accent="bg-blue-500" />
          </div>
        </div>
      )}

      {/* Top posts */}
      {data.topPosts.length > 0 && (
        <div className="rounded-lg border bg-background p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Top posts del per&iacute;odo
            </h4>
            <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
              {(["all", "feed", "reels", "stories"] as const).map((t) => {
                const count = data.topPosts.filter((p) => matchesType(p, t)).length;
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
                  />
                ) : (
                  <div className="mb-1.5 flex aspect-square w-full items-center justify-center rounded bg-muted text-[10px] text-muted-foreground">
                    Sin img
                  </div>
                )}
                <p className="line-clamp-2 text-[10px] text-foreground" title={p.message ?? ""}>
                  {p.message || <span className="italic text-muted-foreground">Sin texto</span>}
                </p>
                <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[9px] tabular-nums text-muted-foreground">
                  {p.reach > 0 && <span>{"👁"} {fmtK(p.reach)}</span>}
                  <span>{"❤"} {fmtK(p.reactions)}</span>
                  <span>{"💬"} {fmtK(p.engagement)}</span>
                  {p.clicks > 0 && <span>{"🔖"} {fmtK(p.clicks)}</span>}
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
    </section>
  );
}
