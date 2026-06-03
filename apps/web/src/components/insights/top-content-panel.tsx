import type { TopPostRow } from "@/lib/insights-queries";

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
}

function truncate(s: string | null, n: number): string {
  if (!s) return "";
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
}

const PLATFORM_BADGE: Record<string, { label: string; bg: string; emoji: string }> = {
  instagram: { label: "Instagram", bg: "linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)", emoji: "IG" },
  facebook: { label: "Facebook", bg: "#1877F2", emoji: "FB" },
};

function PostCard({ p, rank }: { p: TopPostRow; rank: number }) {
  return (
    <a
      href={p.permalink ?? "#"}
      target={p.permalink ? "_blank" : undefined}
      rel="noreferrer noopener"
      className="group block overflow-hidden rounded-lg border bg-card transition-colors hover:bg-muted/50"
    >
      <div className="relative aspect-square w-full overflow-hidden bg-muted">
        <span className="absolute left-1.5 top-1.5 z-10 rounded-full bg-foreground/85 px-2 py-0.5 text-[10px] font-bold text-background">
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
          <span className="font-semibold text-foreground">{p.eng_rate.toFixed(2)}%</span>
          <span>eng. rate</span>
          <span className="mx-0.5 opacity-30">•</span>
          <span>{"👁"} {fmtNum(p.reach)}</span>
          <span>{"💬"} {fmtNum(p.engagement)}</span>
        </div>
      </div>
    </a>
  );
}

export function TopContentPanel({
  instagram,
  facebook,
}: {
  instagram: TopPostRow[];
  facebook: TopPostRow[];
}) {
  if (instagram.length === 0 && facebook.length === 0) {
    return (
      <section className="rounded-xl border bg-card p-4">
        <h3 className="text-sm font-bold">🏆 Top contenidos últimos 30 días</h3>
        <p className="mt-1 text-xs text-muted-foreground">Sin posts con suficiente alcance en el período.</p>
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-xl border bg-card p-4">
      <div>
        <h3 className="text-sm font-bold">🏆 Top contenidos últimos 30 días</h3>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          Top 5 por engagement rate (engagement / alcance). Filtrados con reach ≥ 500.
        </p>
      </div>

      {instagram.length > 0 && (
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span
              className="inline-flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-bold text-white"
              style={{ background: PLATFORM_BADGE.instagram!.bg }}
            >
              IG
            </span>
            <span className="text-xs font-semibold">Instagram — @dreanargentina</span>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {instagram.map((p, i) => (
              <PostCard key={p.post_id} p={p} rank={i + 1} />
            ))}
          </div>
        </div>
      )}

      {facebook.length > 0 && (
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span
              className="inline-flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-bold text-white"
              style={{ background: PLATFORM_BADGE.facebook!.bg }}
            >
              FB
            </span>
            <span className="text-xs font-semibold">Facebook — Page Drean</span>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {facebook.map((p, i) => (
              <PostCard key={p.post_id} p={p} rank={i + 1} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
