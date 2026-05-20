import { KpiCard } from "@/components/kpi-card";
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
  accent = "bg-sky-500",
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
  const hasAnyData = data.totals.diasConData > 0 || data.followersByAgeGender.length > 0;

  return (
    <section className="space-y-4 rounded-lg border bg-card p-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold tracking-tight">
            Instagram orgánico — @dreanargentina
          </h3>
          <p className="text-xs text-muted-foreground">
            KPIs y demografía del público — últimos 30 días{" "}
            <span className="text-muted-foreground/70">({data.rangeLabel})</span>
          </p>
        </div>
      </header>

      {!hasAnyData ? (
        <div className="rounded-lg border bg-amber-50 p-4 text-sm text-amber-900">
          <strong>Sin datos de Instagram orgánico.</strong> Verificá que el
          workflow <code>Meta IG Comprehensive Sync</code> esté corriendo y que
          las tablas <code>meta_ig_daily</code>, <code>meta_posts</code>,{" "}
          <code>meta_ig_audience_demographics</code> tengan filas.
        </div>
      ) : (
        <>
          {/* KPIs principales */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              title="Alcance"
              value={fmtK(data.totals.reach)}
              hint={`${data.totals.diasConData} días con data`}
            />
            <KpiCard
              title="Impresiones"
              value={fmtK(data.totals.impressions)}
            />
            <KpiCard
              title="Followers"
              value={fmtK(data.totals.follower_count)}
              hint="último snapshot"
            />
            <KpiCard
              title="Interacciones totales"
              value={fmtK(data.totals.total_interactions)}
              hint={`${fmtK(data.totals.likes)} likes · ${fmtK(data.totals.comments)} comments`}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard title="Likes" value={fmtK(data.totals.likes)} />
            <KpiCard title="Comments" value={fmtK(data.totals.comments)} />
            <KpiCard title="Saves" value={fmtK(data.totals.saves)} />
            <KpiCard title="Shares" value={fmtK(data.totals.shares)} />
          </div>

          {/* Demografía */}
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-lg border bg-background p-4">
              <h4 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Followers — Edad × Género
              </h4>
              <HorizontalBars
                rows={data.followersByAgeGender}
                emptyText="Sin breakdown demográfico disponible."
                accent="bg-emerald-500"
              />
            </div>

            <div className="rounded-lg border bg-background p-4">
              <h4 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Followers — Top países
              </h4>
              <HorizontalBars
                rows={data.followersByCountry}
                emptyText="Sin breakdown de país."
                accent="bg-sky-500"
              />
            </div>

            <div className="rounded-lg border bg-background p-4">
              <h4 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Followers — Top ciudades
              </h4>
              <HorizontalBars
                rows={data.followersByCity}
                emptyText="Sin breakdown de ciudad."
                accent="bg-violet-500"
              />
            </div>

            <div className="rounded-lg border bg-background p-4 lg:col-span-3">
              <h4 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Público engaged — Edad × Género
              </h4>
              <HorizontalBars
                rows={data.engagedByAgeGender}
                emptyText="Sin breakdown del público engaged (suele aparecer cuando hay volumen suficiente)."
                accent="bg-rose-500"
              />
            </div>
          </div>

          {/* Top posts */}
          {data.topPosts.length > 0 && (
            <div className="rounded-lg border bg-background p-4">
              <h4 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Top posts del período (por interacciones)
              </h4>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {data.topPosts.map((p) => (
                  <a
                    key={p.post_id}
                    href={p.permalink ?? "#"}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="group block rounded-md border bg-card p-3 transition-colors hover:bg-muted/50"
                  >
                    {p.thumbnail_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.thumbnail_url}
                        alt=""
                        className="mb-2 aspect-square w-full rounded object-cover"
                      />
                    ) : (
                      <div className="mb-2 flex aspect-square w-full items-center justify-center rounded bg-muted text-xs text-muted-foreground">
                        Sin thumbnail
                      </div>
                    )}
                    <p className="line-clamp-2 text-xs text-foreground" title={p.message ?? ""}>
                      {p.message || <span className="italic text-muted-foreground">Sin caption</span>}
                    </p>
                    <div className="mt-2 grid grid-cols-3 gap-1 text-[10px] tabular-nums text-muted-foreground">
                      <span>👁 {fmtK(p.reach)}</span>
                      <span>❤ {fmtK(p.likes)}</span>
                      <span>💬 {fmtK(p.comments)}</span>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
