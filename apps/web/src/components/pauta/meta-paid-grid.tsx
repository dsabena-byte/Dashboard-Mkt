"use client";

import { useMemo } from "react";
import type { MetaPaidCreativeRow } from "@/lib/meta-paid-queries";
import { formatCurrency, formatNumber } from "@/lib/utils";

const fmtNum = (n: number) => formatNumber(Math.round(n));
const fmtARS = formatCurrency;

function truncate(s: string | null, n: number): string {
  if (!s) return "";
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
}

export function MetaPaidGrid({ data, selMeses }: { data: MetaPaidCreativeRow[]; selMeses: string[] }) {
  const filtered = useMemo(
    () => (selMeses.length === 0 ? data : data.filter((r) => selMeses.includes(r.mes))),
    [data, selMeses],
  );

  if (filtered.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center text-xs text-muted-foreground">
        Sin piezas pautadas sincronizadas todavía. Para cargarlas, llamá al endpoint
        <code className="mx-1 rounded bg-muted px-1.5 py-0.5">/api/cron/meta-paid-sync</code>
        (opcionalmente <code className="rounded bg-muted px-1.5 py-0.5">?mes=2026-05</code>).
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
      {filtered.map((c) => {
        const img = c.image_url ?? c.thumbnail_url ?? null;
        return (
          <a
            key={c.ad_id}
            href={c.permalink_url ?? "#"}
            target="_blank"
            rel="noopener"
            className="group flex flex-col overflow-hidden rounded-lg border bg-card transition-colors hover:bg-muted/50"
          >
            <div className="aspect-square w-full overflow-hidden bg-muted">
              {img ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={img}
                  alt={c.ad_name ?? c.ad_id}
                  className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
                  Sin imagen
                </div>
              )}
            </div>
            <div className="flex-1 p-3 text-xs">
              <div className="mb-1 line-clamp-2 font-medium leading-snug">
                {truncate(c.body, 90) || c.ad_name || "(sin copy)"}
              </div>
              {c.campaign_name && (
                <div className="mb-2 line-clamp-1 text-[10px] text-muted-foreground">
                  {c.campaign_name}
                </div>
              )}
              <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[11px]">
                <span className="text-muted-foreground">👁 Impr</span>
                <span className="text-right tabular-nums">{fmtNum(c.impresiones)}</span>
                <span className="text-muted-foreground">👥 Alc</span>
                <span className="text-right tabular-nums">{fmtNum(c.alcance)}</span>
                <span className="text-muted-foreground">🖱 Clicks</span>
                <span className="text-right tabular-nums">{fmtNum(c.clicks)}</span>
                <span className="text-muted-foreground">CTR</span>
                <span className="text-right tabular-nums">{c.ctr != null ? `${c.ctr.toFixed(2)}%` : "—"}</span>
                <span className="text-muted-foreground">💰 Inv</span>
                <span className="text-right tabular-nums">{fmtARS(c.spend)}</span>
              </div>
            </div>
          </a>
        );
      })}
    </div>
  );
}
