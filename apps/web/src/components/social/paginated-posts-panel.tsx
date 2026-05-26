"use client";

import { useState } from "react";

interface PaginatedPost {
  id: string;
  url: string;
  marca: string;
  red_social: string;
  fecha: string | null;
  engagement: number | null;
  positivo: number | null;
  negativo: number | null;
  pilar: string | null;
  likes: number | null;
  comentarios: number | null;
  views: number | null;
  resumen_sentimiento?: string | null;
}

const BRAND_COLORS: Record<string, string> = {
  dreanargentina: "#dc2626",
  philco_argentina: "#3b82f6",
  gaborealargentina: "#22c55e",
  electrolux_ar: "#f97316",
  whirlpoolargentina: "#8b5cf6",
};

const BRAND_LABELS: Record<string, string> = {
  dreanargentina: "Drean",
  philco_argentina: "Philco",
  gaborealargentina: "Gafa",
  electrolux_ar: "Electrolux",
  whirlpoolargentina: "Whirlpool",
};

function fmtK(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
}

export function PaginatedPostsPanel({
  title,
  posts,
  color,
  avgEngagement,
  pageSize = 10,
}: {
  title: string;
  posts: PaginatedPost[];
  color: "emerald" | "rose";
  avgEngagement: number;
  pageSize?: number;
}) {
  const [page, setPage] = useState(0);
  const totalPages = Math.ceil(posts.length / pageSize);
  const visible = posts.slice(page * pageSize, (page + 1) * pageSize);

  const accent = color === "emerald" ? "text-emerald-600" : "text-rose-600";
  const bg = color === "emerald" ? "bg-emerald-50" : "bg-rose-50";
  const border = color === "emerald" ? "border-emerald-500" : "border-rose-500";

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className={`mb-1 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wide ${accent}`}>
        <span>● {title}</span>
        <span className={`rounded px-1.5 py-0.5 ${bg}`}>{posts.length} posts</span>
      </div>
      <div className="mb-3 text-[10px] text-muted-foreground">
        Eng. promedio de la marca: {avgEngagement.toFixed(2)}%
      </div>

      {posts.length === 0 ? (
        <div className="py-8 text-center text-xs text-muted-foreground">Sin posts en el período.</div>
      ) : (
        <>
          <div className="space-y-2">
            {visible.map((p) => (
              <a
                key={p.id}
                href={p.url}
                target="_blank"
                rel="noreferrer noopener"
                className={`block rounded-md border-l-2 ${border} ${bg} p-2 transition-colors hover:opacity-80`}
              >
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-bold">{(p.engagement ?? 0).toFixed(2)}%</span>
                  <span
                    className="rounded px-1.5 py-0.5 text-[10px]"
                    style={{
                      backgroundColor: `${BRAND_COLORS[p.marca] ?? "#94a3b8"}22`,
                      color: BRAND_COLORS[p.marca] ?? "#64748b",
                    }}
                  >
                    {BRAND_LABELS[p.marca] ?? p.marca}
                  </span>
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px]">{p.red_social}</span>
                  {p.pilar && <span className="rounded bg-muted px-1.5 py-0.5 text-[10px]">{p.pilar}</span>}
                  <span className="ml-auto text-[10px] text-muted-foreground">
                    {p.fecha ?? "—"}
                  </span>
                </div>
                <div className="mt-1 flex gap-3 text-[10px] text-muted-foreground">
                  {p.likes != null && <span>❤ {fmtK(p.likes)}</span>}
                  {p.comentarios != null && <span>💬 {fmtK(p.comentarios)}</span>}
                  {p.views != null && p.views > 0 && <span>👁 {fmtK(p.views)}</span>}
                </div>
                {p.resumen_sentimiento ? (
                  <p className="mt-1 text-[10px] leading-snug text-muted-foreground/80 italic">
                    {p.resumen_sentimiento.length > 120 ? p.resumen_sentimiento.slice(0, 120) + "…" : p.resumen_sentimiento}
                  </p>
                ) : p.red_social !== "INSTAGRAM" ? (
                  <p className="mt-1 text-[10px] text-muted-foreground/50 italic">Sin comentarios</p>
                ) : null}
              </a>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="mt-3 flex items-center justify-center gap-3 text-xs">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="rounded border px-2 py-1 disabled:opacity-30"
              >
                ← Anterior
              </button>
              <span className="tabular-nums text-muted-foreground">
                {page + 1} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="rounded border px-2 py-1 disabled:opacity-30"
              >
                Siguiente →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
