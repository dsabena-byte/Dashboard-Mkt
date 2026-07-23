"use client";

import { useState } from "react";
import { formatNumber } from "@/lib/utils";

// Grilla de tarjetas de piezas pautadas, genérica (mismo formato que Meta) para
// medios que NO son Meta: Programmatic/DV360 hoy, y Google Ads / TikTok cuando
// tengan data. Acepta piezas ya normalizadas + un formateador de moneda (DV360
// usa USD/ARS según el toggle, por eso `money` es prop).

const fmtNum = (n: number) => formatNumber(Math.round(n));
const PAGE_SIZE = 12;

function truncate(s: string | null | undefined, n: number): string {
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
  General: "#64748b",
};

export interface PiezaCard {
  id: string;
  titulo: string;
  categoria?: string | null;
  badges?: string[]; // etiquetas extra (canal, tipo de compra, etc.)
  img?: string | null;
  link?: string | null;
  inv: number;
  impr: number;
  alcance?: number | null;
  frecuencia?: number | null;
  clicks?: number | null;
  ctr?: number | null;
  cpm?: number | null;
  viewsCompl?: number | null;
  vtr?: number | null;
  engagement?: { reactions?: number; comments?: number; shares?: number; saves?: number };
}

export function PiezaGrid({ pieces, money }: { pieces: PiezaCard[]; money: (n: number) => string }) {
  const [visible, setVisible] = useState(PAGE_SIZE);

  if (pieces.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center text-xs text-muted-foreground">
        Sin piezas pautadas para los filtros seleccionados.
      </div>
    );
  }

  const shown = pieces.slice(0, visible);
  const remaining = pieces.length - shown.length;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {shown.map((c) => {
          const catColor = CAT_COLORS[c.categoria ?? ""] ?? "#64748b";
          const hasVideo = (c.vtr ?? 0) > 0 || (c.viewsCompl ?? 0) > 0;
          const eng = c.engagement;
          const hasEng = eng && ((eng.reactions ?? 0) > 0 || (eng.comments ?? 0) > 0 || (eng.shares ?? 0) > 0 || (eng.saves ?? 0) > 0);
          const link = c.link ?? null;
          return (
            <a
              key={c.id}
              href={link ?? "#"}
              target={link ? "_blank" : undefined}
              rel="noopener"
              className="group flex flex-col overflow-hidden rounded-lg border bg-card transition-colors hover:bg-muted/50"
              aria-disabled={!link}
            >
              <div className="relative aspect-square w-full overflow-hidden bg-muted">
                {(c.categoria || (c.badges && c.badges.length > 0)) && (
                  <div className="absolute left-1.5 top-1.5 z-10 flex flex-wrap items-center gap-1">
                    {c.categoria && (
                      <span
                        className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold text-white shadow"
                        style={{ backgroundColor: catColor }}
                      >
                        {c.categoria}
                      </span>
                    )}
                    {c.badges?.map((b) => (
                      <span key={b} className="rounded-full bg-black/70 px-1.5 py-0.5 text-[9px] font-semibold text-white">
                        {b}
                      </span>
                    ))}
                  </div>
                )}
                {c.img ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.img}
                    alt={c.titulo}
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
                <div className="mb-2 line-clamp-2 font-medium leading-snug">{truncate(c.titulo, 90) || "(sin nombre)"}</div>
                <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[11px]">
                  <span className="text-muted-foreground">💰 Inv.</span>
                  <span className="text-right font-semibold tabular-nums">{money(c.inv)}</span>
                  <span className="text-muted-foreground">👁 Impr.</span>
                  <span className="text-right tabular-nums">{fmtNum(c.impr)}</span>
                  {c.alcance != null && c.alcance > 0 && (
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
                  {c.clicks != null && (
                    <>
                      <span className="text-muted-foreground">🖱 Clicks</span>
                      <span className="text-right tabular-nums">{fmtNum(c.clicks)}</span>
                    </>
                  )}
                  <span className="text-muted-foreground">CTR</span>
                  <span className="text-right tabular-nums">{c.ctr != null ? `${c.ctr.toFixed(2)}%` : "—"}</span>
                  <span className="text-muted-foreground">CPM</span>
                  <span className="text-right tabular-nums">{c.cpm != null ? money(c.cpm) : "—"}</span>
                  {hasVideo && (
                    <>
                      {c.viewsCompl != null && c.viewsCompl > 0 && (
                        <>
                          <span className="text-muted-foreground">▶ Views compl.</span>
                          <span className="text-right tabular-nums">{fmtNum(c.viewsCompl)}</span>
                        </>
                      )}
                      <span className="text-muted-foreground">VTR</span>
                      <span className="text-right tabular-nums">{c.vtr != null ? `${c.vtr.toFixed(2)}%` : "—"}</span>
                    </>
                  )}
                </div>
                {hasEng && (
                  <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 border-t pt-1.5 text-[10px] text-muted-foreground">
                    {(eng!.reactions ?? 0) > 0 && <span title="Reacciones">❤️ {fmtNum(eng!.reactions ?? 0)}</span>}
                    {(eng!.comments ?? 0) > 0 && <span title="Comentarios">💬 {fmtNum(eng!.comments ?? 0)}</span>}
                    {(eng!.shares ?? 0) > 0 && <span title="Compartidos">🔁 {fmtNum(eng!.shares ?? 0)}</span>}
                    {(eng!.saves ?? 0) > 0 && <span title="Guardados">🔖 {fmtNum(eng!.saves ?? 0)}</span>}
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
          <strong className="text-foreground">{pieces.length}</strong> piezas
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
