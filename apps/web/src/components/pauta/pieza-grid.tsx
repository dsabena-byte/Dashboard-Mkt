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

// DV360 no expone el archivo del creative. Pero el nombre suele encodear el
// formato: banners con el tamaño ("Lavado-300x600") y videos con la duración
// ("... - 15 SEG (1920x1080)"). Con eso dibujamos un placeholder informativo
// en vez de un "Sin imagen" muerto: para display, un rectángulo a escala del
// banner con su tamaño; para video, un indicador de reproducción.
function parseFormato(titulo: string, esVideo: boolean): { w: number; h: number; label: string; video: boolean } | null {
  const m = titulo.match(/(\d{2,4})\s*[x×]\s*(\d{2,4})/i);
  const seg = titulo.match(/(\d+)\s*SEG/i);
  if (!m && !seg) return null;
  const w = m ? parseInt(m[1]!, 10) : 16;
  const h = m ? parseInt(m[2]!, 10) : 9;
  const label = m ? `${m[1]}×${m[2]}` : seg ? `${seg[1]}s` : "";
  return { w, h, label, video: esVideo || !!seg };
}

function FormatoPlaceholder({ titulo, esVideo }: { titulo: string; esVideo: boolean }) {
  const f = parseFormato(titulo, esVideo);
  if (!f) {
    return (
      <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
        {esVideo ? "▶ Video (sin thumbnail)" : "Sin imagen"}
      </div>
    );
  }
  // Rectángulo a escala del banner (máx 78% del alto/ancho del contenedor).
  const ratio = f.w / f.h;
  const maxPct = 78;
  const boxW = ratio >= 1 ? maxPct : maxPct * ratio;
  const boxH = ratio >= 1 ? maxPct / ratio : maxPct;
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 bg-gradient-to-br from-muted to-muted/40">
      <div
        className="flex items-center justify-center rounded border border-dashed border-muted-foreground/40 bg-card/60"
        style={{ width: `${boxW}%`, height: `${boxH}%` }}
      >
        {f.video && <span className="text-lg text-muted-foreground/70">▶</span>}
      </div>
      <span className="rounded bg-black/60 px-1.5 py-0.5 text-[9px] font-semibold tabular-nums text-white">
        {f.video ? `▶ ${f.label}` : f.label}
      </span>
    </div>
  );
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
  activa?: boolean | null;
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

  // Activas primero, pausadas después (estado desconocido al final); dentro de
  // cada grupo se preserva el orden que trae el caller (inversión desc).
  const ordered = [...pieces].sort(
    (a, b) => (a.activa === true ? 0 : a.activa === false ? 1 : 2) - (b.activa === true ? 0 : b.activa === false ? 1 : 2),
  );
  const shown = ordered.slice(0, visible);
  const remaining = ordered.length - shown.length;

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
                {c.activa != null && (
                  <div className="absolute right-1.5 top-1.5 z-10">
                    <span
                      className={`flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold text-white shadow ${c.activa ? "bg-emerald-500" : "bg-slate-500"}`}
                      title={c.activa ? "Línea activa en DV360" : "Pausada o archivada"}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-white" />
                      {c.activa ? "Activa" : "Pausada"}
                    </span>
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
                  <FormatoPlaceholder titulo={c.titulo} esVideo={hasVideo} />
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
