"use client";

import { useMemo, useState } from "react";
import type { MetaPaidCreativeRow } from "@/lib/meta-paid-queries";
import { formatCurrency, formatNumber } from "@/lib/utils";

const fmtNum = (n: number) => formatNumber(Math.round(n));
const fmtARS = formatCurrency;
const PAGE_SIZE = 12;

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

// CPM/CPV se usan para Awareness; CPC para Consideración (tráfico).
function tipoCompraToRol(tc: string | null): "Awareness" | "Consideración" | null {
  if (tc === "CPC") return "Consideración";
  if (tc === "CPM" || tc === "CPV") return "Awareness";
  return null;
}

export function MetaPaidGrid({
  data,
  selMeses,
  selCats,
  selRoles,
}: {
  data: MetaPaidCreativeRow[];
  selMeses: string[];
  selCats: string[];
  selRoles: string[];
}) {
  const [visible, setVisible] = useState(PAGE_SIZE);

  const filtered = useMemo(() => {
    return data.filter(
      (r) =>
        (r.impresiones ?? 0) > 0 &&
        (selMeses.length === 0 || selMeses.includes(r.mes)) &&
        (selCats.length === 0 || (r.categoria != null && selCats.includes(r.categoria))) &&
        (selRoles.length === 0 || selRoles.includes(tipoCompraToRol(r.tipo_compra) ?? "")),
    );
  }, [data, selMeses, selCats, selRoles]);

  // Si los filtros cambian, volvemos a las primeras 12.
  const filtersKey = `${selMeses.join("|")}-${selCats.join("|")}-${selRoles.join("|")}`;
  const [lastKey, setLastKey] = useState(filtersKey);
  if (lastKey !== filtersKey) {
    setLastKey(filtersKey);
    setVisible(PAGE_SIZE);
  }

  if (filtered.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center text-xs text-muted-foreground">
        Sin piezas pautadas para los filtros seleccionados.
      </div>
    );
  }

  const shown = filtered.slice(0, visible);
  const remaining = filtered.length - shown.length;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {shown.map((c) => {
          const img = c.image_url ?? c.thumbnail_url ?? null;
          const link = c.permalink_url ?? c.instagram_permalink_url ?? null;
          const hasVideo = (c.views_total ?? 0) > 0;
          const catColor = CAT_COLORS[c.categoria ?? ""] ?? "#64748b";
          return (
            <a
              key={`${c.ad_id}-${c.mes}`}
              href={link ?? "#"}
              target={link ? "_blank" : undefined}
              rel="noopener"
              className="group flex flex-col overflow-hidden rounded-lg border bg-card transition-colors hover:bg-muted/50"
              aria-disabled={!link}
            >
              <div className="relative aspect-square w-full overflow-hidden bg-muted">
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
                  {c.alcance > 0 && (
                    <>
                      <span className="text-muted-foreground">👥 Alc.</span>
                      <span className="text-right tabular-nums">{fmtNum(c.alcance)}</span>
                    </>
                  )}
                  {c.frecuencia != null && c.frecuencia > 0 && (
                    <>
                      <span className="text-muted-foreground">🔁 Frec.</span>
                      <span className="text-right tabular-nums">{c.frecuencia.toFixed(2)}</span>
                    </>
                  )}
                  <span className="text-muted-foreground">🖱 Clicks</span>
                  <span className="text-right tabular-nums">{fmtNum(c.clicks)}</span>
                  <span className="text-muted-foreground">CTR</span>
                  <span className="text-right tabular-nums">{c.ctr != null ? `${c.ctr.toFixed(2)}%` : "—"}</span>
                  <span className="text-muted-foreground">CPM</span>
                  <span className="text-right tabular-nums">{c.cpm != null ? fmtARS(c.cpm) : "—"}</span>
                  {hasVideo && (
                    <>
                      <span className="text-muted-foreground">▶ Views compl.</span>
                      <span className="text-right tabular-nums">{fmtNum(c.views_completed ?? c.views_total ?? 0)}</span>
                      <span className="text-muted-foreground">VTR</span>
                      <span className="text-right tabular-nums">{c.vtr != null ? `${c.vtr.toFixed(2)}%` : "—"}</span>
                    </>
                  )}
                </div>
                {(c.post_engagement ?? 0) > 0 && (
                  <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 border-t pt-1.5 text-[10px] text-muted-foreground">
                    {(c.reactions ?? 0) > 0 && <span title="Reacciones">❤️ {fmtNum(c.reactions ?? 0)}</span>}
                    {(c.comments ?? 0) > 0 && <span title="Comentarios">💬 {fmtNum(c.comments ?? 0)}</span>}
                    {(c.shares ?? 0) > 0 && <span title="Compartidos">🔁 {fmtNum(c.shares ?? 0)}</span>}
                    {(c.saves ?? 0) > 0 && <span title="Guardados">🔖 {fmtNum(c.saves ?? 0)}</span>}
                  </div>
                )}
              </div>
            </a>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
        <span>
          Mostrando <strong className="text-foreground">{shown.length}</strong> de{" "}
          <strong className="text-foreground">{filtered.length}</strong> piezas
        </span>
        <div className="flex items-center gap-2">
          {visible > PAGE_SIZE && (
            <button
              onClick={() => setVisible(PAGE_SIZE)}
              className="rounded-full border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
            >
              Restablecer {PAGE_SIZE}
            </button>
          )}
          {remaining > 0 && (
            <button
              onClick={() => setVisible((v) => v + PAGE_SIZE)}
              className="rounded-full border bg-card px-4 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
            >
              Mostrar {Math.min(PAGE_SIZE, remaining)} más
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
