"use client";

import type { TopAndBottom, TopPostRow } from "@/lib/insights-queries";

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
}

function truncate(s: string | null, n: number): string {
  if (!s) return "";
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
}

const PLATFORM_BADGE: Record<string, { label: string; bg: string }> = {
  instagram: { label: "Instagram — @dreanargentina", bg: "linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)" },
  facebook: { label: "Facebook — Page Drean", bg: "#1877F2" },
};

function PostCard({ p, rank, variant }: { p: TopPostRow; rank: number; variant: "top" | "bottom" }) {
  const accent = variant === "top" ? "bg-emerald-500" : "bg-rose-500";
  const rateColor = variant === "top" ? "text-emerald-600" : "text-rose-600";
  return (
    <a
      href={p.permalink ?? "#"}
      target={p.permalink ? "_blank" : undefined}
      rel="noreferrer noopener"
      className="group block overflow-hidden rounded-lg border bg-card transition-colors hover:bg-muted/50"
    >
      <div className="relative aspect-square w-full overflow-hidden bg-muted">
        <span className={`absolute left-1.5 top-1.5 z-10 rounded-full px-2 py-0.5 text-[10px] font-bold text-white ${accent}`}>
          #{rank}
        </span>
        {p.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={p.thumbnail_url}
            alt=""
            className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
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
          className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground"
          style={{ display: p.thumbnail_url ? "none" : "flex" }}
        >
          Sin img
        </div>
      </div>
      <div className="p-2.5 text-xs">
        <p className="mb-1.5 line-clamp-2 text-[11px] leading-snug" title={p.message ?? ""}>
          {truncate(p.message, 90) || <span className="italic text-muted-foreground">Sin texto</span>}
        </p>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] tabular-nums text-muted-foreground">
          <span className={`font-semibold ${rateColor}`}>{p.eng_rate.toFixed(2)}%</span>
          <span>eng. rate</span>
          <span className="mx-0.5 opacity-30">•</span>
          <span>{"👁"} {fmtNum(p.reach)}</span>
          <span>{"💬"} {fmtNum(p.engagement)}</span>
        </div>
      </div>
    </a>
  );
}

function PlatformBlock({
  platform,
  data,
}: {
  platform: "instagram" | "facebook";
  data: TopAndBottom;
}) {
  if (data.top.length === 0 && data.bottom.length === 0) return null;
  const badge = PLATFORM_BADGE[platform]!;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span
          className="inline-flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-bold text-white"
          style={{ background: badge.bg }}
        >
          {platform === "instagram" ? "IG" : "FB"}
        </span>
        <span className="text-xs font-semibold">{badge.label}</span>
      </div>

      {data.top.length > 0 && (
        <div>
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
            🟢 Top 5 — mejor performance
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {data.top.map((p, i) => (
              <PostCard key={p.post_id} p={p} rank={i + 1} variant="top" />
            ))}
          </div>
        </div>
      )}

      {data.bottom.length > 0 && (
        <div>
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-rose-700">
            🔴 Bottom 5 — peor performance
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {data.bottom.map((p, i) => (
              <PostCard key={p.post_id} p={p} rank={i + 1} variant="bottom" />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function TopContentPanel({
  instagram,
  facebook,
}: {
  instagram: TopAndBottom;
  facebook: TopAndBottom;
}) {
  if (instagram.top.length === 0 && facebook.top.length === 0) {
    return (
      <section className="rounded-xl border bg-card p-4">
        <h3 className="text-sm font-bold">🏆 Top & Bottom contenidos — últimos 30 días</h3>
        <p className="mt-1 text-xs text-muted-foreground">Sin posts con suficiente alcance en el período.</p>
      </section>
    );
  }

  return (
    <section className="space-y-5 rounded-xl border bg-card p-4">
      <div>
        <h3 className="text-sm font-bold">🏆 Top & Bottom contenidos — últimos 30 días</h3>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          Top 5 (mejor) y Bottom 5 (peor) por engagement rate (engagement / alcance). Filtra reach &lt; 500 para evitar outliers.
        </p>
      </div>
      <PlatformBlock platform="instagram" data={instagram} />
      <PlatformBlock platform="facebook" data={facebook} />
    </section>
  );
}
