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

const CAT_COLORS: Record<string, string> = {
  Brand: "#0a1849",
  Lavado: "#2b4dff",
  Refrigeración: "#06b6d4",
  Cocción: "#f59e0b",
  Promoción: "#e63946",
  UGC: "#8b5cf6",
};

export function MetaPaidGrid({ data, selMeses }: { data: MetaPaidCreativeRow[]; selMeses: string[] }) {
  const filtered = useMemo(
    () => (selMeses.length === 0 ? data : data.filter((r) => selMeses.includes(r.mes))),
    [data, selMeses],
  );

  if (filtered.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center text-xs text-muted-foreground">
        Sin piezas pautadas sincronizadas todavía. Cargá datos manualmente desde Looker
        (ver migración 0033 + INSERTs con <code className="rounded bg-muted px-1.5 py-0.5">source=&apos;looker_export&apos;</code>)
        o llamá al endpoint
        <code className="mx-1 rounded bg-muted px-1.5 py-0.5">/api/cron/meta-paid-sync</code>
        cuando esté el acceso a la Ad Account.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
      {filtered.map((c) => {
        const img = c.image_url ?? c.thumbnail_url ?? null;
        const hasVideo = (c.views_total ?? 0) > 0;
        const catColor = CAT_COLORS[c.categoria ?? ""] ?? "#64748b";
        return (
          <a
            key={`${c.ad_id}-${c.mes}`}
            href={c.permalink_url ?? "#"}
            target={c.permalink_url ? "_blank" : undefined}
            rel="noopener"
            className="group flex flex-col overflow-hidden rounded-lg border bg-card transition-colors hover:bg-muted/50"
            aria-disabled={!c.permalink_url}
          >
            <div className="relative aspect-square w-full overflow-hidden bg-muted">
              {/* Badge categoria + tipo_compra arriba */}
              {(c.categoria || c.tipo_compra) && (
                <div className="absolute left-1.5 top-1.5 z-10 flex items-center gap-1">
                  {c.categoria && (
                    <span
                      className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold text-white shadow"
                      style={{ backgroundColor: catColor }}
                    >
                      {c.categoria}
                    </span>
                  )}
                  {c.tipo_compra && (
                    <span className="rounded-full bg-black/70 px-1.5 py-0.5 text-[9px] font-semibold text-white">
                      {c.tipo_compra}
                    </span>
                  )}
                </div>
              )}
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
              <div className="mb-2 line-clamp-2 font-medium leading-snug">
                {truncate(c.body, 90) || c.ad_name || "(sin nombre)"}
              </div>
              <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[11px]">
                <span className="text-muted-foreground">💰 Inv.</span>
                <span className="text-right font-semibold tabular-nums">{fmtARS(c.spend)}</span>
                <span className="text-muted-foreground">👁 Impr.</span>
                <span className="text-right tabular-nums">{fmtNum(c.impresiones)}</span>
                <span className="text-muted-foreground">🖱 Clicks</span>
                <span className="text-right tabular-nums">{fmtNum(c.clicks)}</span>
                <span className="text-muted-foreground">CTR</span>
                <span className="text-right tabular-nums">{c.ctr != null ? `${c.ctr.toFixed(2)}%` : "—"}</span>
                <span className="text-muted-foreground">CPM</span>
                <span className="text-right tabular-nums">{c.cpm != null ? fmtARS(c.cpm) : "—"}</span>
                {hasVideo && (
                  <>
                    <span className="text-muted-foreground">▶ Views</span>
                    <span className="text-right tabular-nums">{fmtNum(c.views_total ?? 0)}</span>
                    <span className="text-muted-foreground">VTR</span>
                    <span className="text-right tabular-nums">{c.vtr != null ? `${c.vtr.toFixed(2)}%` : "—"}</span>
                  </>
                )}
              </div>
            </div>
          </a>
        );
      })}
    </div>
  );
}
