import { KpiCard } from "@/components/kpi-card";
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
  const hasAnyData = data.totals.diasConData > 0 || data.fansByAgeGender.length > 0;

  return (
    <section className="space-y-4 rounded-lg border bg-card p-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold tracking-tight">
            Facebook orgánico — Page Drean
          </h3>
          <p className="text-xs text-muted-foreground">
            KPIs y demografía del público — últimos 30 días{" "}
            <span className="text-muted-foreground/70">({data.rangeLabel})</span>
          </p>
        </div>
      </header>

      {!hasAnyData ? (
        <div className="rounded-lg border bg-amber-50 p-4 text-sm text-amber-900">
          <strong>Sin datos de Facebook orgánico.</strong> Verificá que el
          workflow <code>Meta FB Comprehensive Sync</code> esté corriendo y que
          las tablas <code>meta_page_daily</code>, <code>meta_posts</code> y{" "}
          <code>meta_fb_audience_demographics</code> tengan filas.
        </div>
      ) : (
        <>
          {/* KPIs principales */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              title="Alcance (impressions únicas)"
              value={fmtK(data.totals.impressions_unique)}
              hint={`${data.totals.diasConData} días con data`}
            />
            <KpiCard
              title="Impresiones"
              value={fmtK(data.totals.impressions)}
              hint={data.totals.impressions_organic > 0 ? `${fmtK(data.totals.impressions_organic)} orgánicas` : undefined}
            />
            <KpiCard
              title="Fans (followers)"
              value={fmtK(data.totals.fans_total)}
              hint={`${data.totals.fan_delta >= 0 ? "+" : ""}${fmtK(data.totals.fan_delta)} en el período`}
            />
            <KpiCard
              title="Engagement (post)"
              value={fmtK(data.totals.post_engagements)}
              hint={`${fmtK(data.totals.engaged_users)} usuarios únicos`}
            />
          </div>

          {/* Reactions y video */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              title="Reacciones totales"
              value={fmtK(data.totals.reactions_total)}
              hint={`👍 ${fmtK(data.totals.reactions_like)} · ❤️ ${fmtK(data.totals.reactions_love)} · 😂 ${fmtK(data.totals.reactions_haha)}`}
            />
            <KpiCard
              title="Video views"
              value={fmtK(data.totals.video_views)}
            />
            <KpiCard
              title="Page views"
              value={fmtK(data.totals.page_views)}
              hint="visitas al perfil"
            />
            <KpiCard
              title="Fans ganados / perdidos"
              value={`+${fmtK(data.totals.fan_adds)} / -${fmtK(data.totals.fan_removes)}`}
            />
          </div>

          {/* Demografía */}
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-lg border bg-background p-4">
              <h4 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Fans — Edad × Género
              </h4>
              <HorizontalBars
                rows={data.fansByAgeGender}
                emptyText="Sin breakdown demográfico disponible."
                accent="bg-emerald-500"
              />
            </div>

            <div className="rounded-lg border bg-background p-4">
              <h4 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Fans — Top países
              </h4>
              <HorizontalBars
                rows={data.fansByCountry}
                emptyText="Sin breakdown de país."
                accent="bg-blue-500"
              />
            </div>

            <div className="rounded-lg border bg-background p-4">
              <h4 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Fans — Top ciudades
              </h4>
              <HorizontalBars
                rows={data.fansByCity}
                emptyText="Sin breakdown de ciudad."
                accent="bg-violet-500"
              />
            </div>

            <div className="rounded-lg border bg-background p-4 lg:col-span-3">
              <h4 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Público alcanzado en el período — Edad × Género
              </h4>
              <HorizontalBars
                rows={data.reachedByAgeGender}
                emptyText="Sin breakdown del público alcanzado en este período."
                accent="bg-rose-500"
              />
            </div>
          </div>

          {/* Top posts */}
          {data.topPosts.length > 0 && (
            <div className="rounded-lg border bg-background p-4">
              <h4 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Top posts del período (por engagement)
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
                      {p.message || <span className="italic text-muted-foreground">Sin texto</span>}
                    </p>
                    <div className="mt-2 grid grid-cols-3 gap-1 text-[10px] tabular-nums text-muted-foreground">
                      <span>👁 {fmtK(p.reach)}</span>
                      <span>👍 {fmtK(p.reactions)}</span>
                      <span>💬 {fmtK(p.engagement)}</span>
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
