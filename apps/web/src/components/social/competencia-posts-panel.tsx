"use client";

import { useMemo, useState } from "react";

// Panel de posteos de competencia agrupado POR MARCA. Reemplaza el viejo
// "mejores/peores vs promedio". Con la data que tenemos de social_posts
// (engagement, views, likes, comentarios, tipo, pilar, red, link) — sin
// miniatura, porque el scrape de competencia no trae la imagen del post.

export interface CompetenciaPost {
  id: string;
  marca: string;
  red_social: string;          // INSTAGRAM | FACEBOOK | TIKTOK
  content_type: string | null; // IMAGE | VIDEO | SIDECAR | REEL
  url: string;
  fecha: string | null;
  engagement: number | null;   // % ya calculado
  likes: number | null;        // -1 = oculto (IG)
  comentarios: number | null;
  views: number | null;
  pilar: string | null;
  thumbnail_url?: string | null;
}

// Etiquetas/colores locales (no importamos del lib server-only).
const BRAND_LABELS: Record<string, string> = {
  dreanargentina: "Drean",
  "philco.arg": "Philco",
  gafaargentina: "Gafa",
  whirlpoolarg: "Whirlpool",
  electroluxar: "Electrolux",
};
const BRAND_COLORS: Record<string, string> = {
  dreanargentina: "#dc2626",
  "philco.arg": "#f97316",
  gafaargentina: "#0ea5e9",
  whirlpoolarg: "#7c3aed",
  electroluxar: "#64748b",
};
const BRAND_ORDER = ["philco.arg", "gafaargentina", "whirlpoolarg", "electroluxar", "dreanargentina"];

function marcaLabel(m: string): string { return BRAND_LABELS[m] ?? m; }
function marcaColor(m: string): string { return BRAND_COLORS[m] ?? "#94a3b8"; }

// Agrupa content_type en 3 baldes: imagen | video | reel.
function tipoBucket(ct: string | null): "imagen" | "video" | "reel" {
  const v = (ct ?? "").toUpperCase();
  if (v === "REEL") return "reel";
  if (v === "VIDEO") return "video";
  return "imagen"; // IMAGE, SIDECAR, null
}
const TIPO_LABEL: Record<string, string> = { imagen: "Imagen", video: "Video", reel: "Reel" };

function fmtK(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
}
function fmtFecha(f: string | null): string {
  if (!f) return "";
  return f.slice(0, 10);
}

function Chip({ active, onClick, color, children }: { active: boolean; onClick: () => void; color?: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition ${active ? "text-white" : "bg-card hover:bg-secondary"}`}
      style={active && color ? { backgroundColor: color, borderColor: color } : undefined}
    >
      {children}
    </button>
  );
}

export function CompetenciaPostsPanel({ posts }: { posts: CompetenciaPost[] }) {
  // Marcas presentes, ordenadas por preferencia.
  const marcas = useMemo(() => {
    const present = Array.from(new Set(posts.map((p) => p.marca)));
    return present.sort((a, b) => {
      const ia = BRAND_ORDER.indexOf(a); const ib = BRAND_ORDER.indexOf(b);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
  }, [posts]);

  const [marca, setMarca] = useState<string>(marcas[0] ?? "");
  const [tipo, setTipo] = useState<string>("all");
  const [sort, setSort] = useState<"engagement" | "fecha">("engagement");

  const marcaSel = marcas.includes(marca) ? marca : (marcas[0] ?? "");
  const delaMarca = useMemo(() => posts.filter((p) => p.marca === marcaSel), [posts, marcaSel]);

  const avgEng = useMemo(() => {
    if (delaMarca.length === 0) return 0;
    return delaMarca.reduce((s, p) => s + (p.engagement ?? 0), 0) / delaMarca.length;
  }, [delaMarca]);

  // Opciones de tipo presentes para la marca elegida (con conteo).
  const tipoOpts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of delaMarca) { const t = tipoBucket(p.content_type); counts.set(t, (counts.get(t) ?? 0) + 1); }
    return (["imagen", "video", "reel"] as const).filter((t) => counts.has(t)).map((t) => [t, counts.get(t)!] as [string, number]);
  }, [delaMarca]);

  const filtered = useMemo(() => {
    let r = delaMarca;
    if (tipo !== "all") r = r.filter((p) => tipoBucket(p.content_type) === tipo);
    const arr = [...r];
    if (sort === "engagement") arr.sort((a, b) => (b.engagement ?? 0) - (a.engagement ?? 0));
    else arr.sort((a, b) => (b.fecha ?? "").localeCompare(a.fecha ?? ""));
    return arr;
  }, [delaMarca, tipo, sort]);

  if (marcas.length === 0) {
    return <p className="rounded-xl border bg-card p-6 text-center text-xs text-muted-foreground">No hay posteos de competencia para el filtro seleccionado.</p>;
  }

  return (
    <section className="space-y-3 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Posteos por marca — competencia <span className="font-normal text-muted-foreground">(Instagram)</span></h3>
        <span className="text-xs text-muted-foreground">{filtered.length} posts · Eng. promedio {marcaLabel(marcaSel)}: <strong>{avgEng.toFixed(2)}%</strong></span>
      </div>

      {/* Selector de marca */}
      <div className="flex flex-wrap gap-2">
        {marcas.map((m) => (
          <Chip key={m} active={m === marcaSel} onClick={() => setMarca(m)} color={marcaColor(m)}>
            {marcaLabel(m)}
          </Chip>
        ))}
      </div>

      {/* Filtros: tipo, orden */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t pt-3 text-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-semibold uppercase text-muted-foreground">Tipo</span>
          <Chip active={tipo === "all"} onClick={() => setTipo("all")}>Todos ({delaMarca.length})</Chip>
          {tipoOpts.map(([t, c]) => (
            <Chip key={t} active={tipo === t} onClick={() => setTipo(t)}>{TIPO_LABEL[t]} ({c})</Chip>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-semibold uppercase text-muted-foreground">Orden</span>
          <Chip active={sort === "engagement"} onClick={() => setSort("engagement")}>Por engagement</Chip>
          <Chip active={sort === "fecha"} onClick={() => setSort("fecha")}>Por fecha</Chip>
        </div>
      </div>

      {/* Grid de tarjetas */}
      {filtered.length === 0 ? (
        <p className="py-6 text-center text-xs text-muted-foreground">No hay posteos con este filtro.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {filtered.map((p) => {
            const eng = p.engagement ?? 0;
            const arriba = eng >= avgEng;
            return (
              <a
                key={p.id}
                href={p.url}
                target="_blank"
                rel="noopener"
                className="flex flex-col gap-2 overflow-hidden rounded-lg border bg-background transition hover:shadow-sm"
                style={{ borderLeft: `3px solid ${marcaColor(p.marca)}` }}
              >
                {p.thumbnail_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.thumbnail_url} alt="" loading="lazy" className="aspect-square w-full object-cover" />
                )}
                <div className="flex flex-col gap-2 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-medium">{TIPO_LABEL[tipoBucket(p.content_type)]}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">{fmtFecha(p.fecha)}</span>
                </div>

                <div className="flex items-baseline gap-1.5">
                  <span className={`text-lg font-bold ${arriba ? "text-emerald-600" : "text-rose-600"}`}>{eng.toFixed(2)}%</span>
                  <span className={`text-[11px] ${arriba ? "text-emerald-600" : "text-rose-500"}`}>{arriba ? "▲" : "▼"} eng.</span>
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                  {(p.views ?? 0) > 0 && <span>👁 {fmtK(p.views ?? 0)}</span>}
                  <span>❤ {p.likes != null && p.likes >= 0 ? fmtK(p.likes) : "—"}</span>
                  <span>💬 {fmtK(p.comentarios ?? 0)}</span>
                </div>

                <div className="flex items-center justify-between gap-2">
                  {p.pilar ? <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px]">{p.pilar}</span> : <span />}
                  <span className="text-[10px] font-medium text-primary">Ver →</span>
                </div>
                </div>
              </a>
            );
          })}
        </div>
      )}
    </section>
  );
}
