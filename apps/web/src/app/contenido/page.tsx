"use client";

import { useState, useMemo } from "react";
import { CATEGORIAS } from "@/lib/contenido-shared";
import { getModelos } from "@/lib/producto-catalog";

const PILARES = [
  "Liderazgo marca/porfolio",
  "Calidad superior",
  "Respaldo Posventa",
  "Elegir bien",
  "Experiencia uso",
];
const FORMATOS = [
  { v: "imagen", l: "Imagen (post)" },
  { v: "carrusel", l: "Carrusel" },
];
const ASPECTOS = [
  { v: "vertical", l: "Feed vertical 3:4" },
  { v: "feed", l: "Cuadrado 1:1" },
  { v: "story", l: "Story/Reel 9:16" },
];

interface Resultado {
  ok: boolean;
  error?: string;
  pilar?: string;
  categoria?: string;
  producto?: string | null;
  engine?: string;
  imagen?: string | null;
  caption?: string;
  hashtags?: string[];
  slides?: Array<{ titulo: string; texto: string }>;
  image_prompt?: string;
  style_refs?: string[];
  producto_ref?: string | null;
  referencias?: Array<{ permalink: string | null; message: string | null; media_type: string | null; engagement: number; video_views: number }>;
}

export default function ContenidoPage() {
  const [pilar, setPilar] = useState(PILARES[0]);
  const [categoria, setCategoria] = useState("porfolio");
  const [modelo, setModelo] = useState<string>("");
  const [formato, setFormato] = useState("imagen");
  const [aspecto, setAspecto] = useState("vertical");
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState<Resultado | null>(null);

  const modelos = useMemo(() => getModelos(categoria), [categoria]);

  function onCategoria(v: string) {
    setCategoria(v);
    setModelo(""); // reset modelo al cambiar de categoría
  }

  async function generar() {
    setLoading(true);
    setRes(null);
    try {
      const r = await fetch("/api/generar-contenido", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pilar, categoria, modelo: modelo || undefined, formato, aspecto }),
      });
      setRes(await r.json());
    } catch (e) {
      setRes({ ok: false, error: e instanceof Error ? e.message : String(e) });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight">Generador de contenido</h2>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Genera piezas orgánicas por pilar, inspiradas en lo que mejor performó (Insight Drean). Si elegís un modelo, usa
          el <strong>packshot real</strong> del producto (Drive de la agencia); si no, genera con Ideogram tomando como
          referencia de estilo las imágenes reales de los posts. El video se suma en la próxima etapa (Kling / Veo).
        </p>
      </header>

      <section className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4">
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-medium text-muted-foreground">Pilar</span>
          <select value={pilar} onChange={(e) => setPilar(e.target.value)} className="rounded border px-2 py-1.5 text-sm">
            {PILARES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-medium text-muted-foreground">Categoría</span>
          <select value={categoria} onChange={(e) => onCategoria(e.target.value)} className="rounded border px-2 py-1.5 text-sm">
            {CATEGORIAS.map((c) => <option key={c.v} value={c.v}>{c.l}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-medium text-muted-foreground">Modelo (producto real)</span>
          <select value={modelo} onChange={(e) => setModelo(e.target.value)} className="rounded border px-2 py-1.5 text-sm" disabled={modelos.length === 0}>
            <option value="">{modelos.length === 0 ? "— sin modelos cargados —" : "— sin producto (genérico) —"}</option>
            {modelos.map((m) => <option key={m.sku} value={m.sku}>{m.nombre}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-medium text-muted-foreground">Formato</span>
          <select value={formato} onChange={(e) => setFormato(e.target.value)} className="rounded border px-2 py-1.5 text-sm">
            {FORMATOS.map((f) => <option key={f.v} value={f.v}>{f.l}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-medium text-muted-foreground">Formato de imagen</span>
          <select value={aspecto} onChange={(e) => setAspecto(e.target.value)} className="rounded border px-2 py-1.5 text-sm">
            {ASPECTOS.map((a) => <option key={a.v} value={a.v}>{a.l}</option>)}
          </select>
        </label>
        <button
          type="button"
          onClick={generar}
          disabled={loading}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Generando…" : "Generar"}
        </button>
      </section>

      {res && !res.ok && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-xs text-red-900">
          <strong>Error:</strong> {res.error}
          {/FAL_KEY/.test(res.error ?? "") && <div className="mt-1">Falta configurar la <code>FAL_KEY</code> en Vercel (crear en fal.ai/dashboard/keys).</div>}
        </div>
      )}

      {res?.ok && (
        <section className="grid gap-4 lg:grid-cols-[22rem_1fr]">
          <div className="space-y-3">
            <div className="overflow-hidden rounded-xl border bg-card">
              {res.imagen ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={res.imagen} alt="contenido generado" className="w-full" />
              ) : (
                <div className="flex h-64 items-center justify-center text-xs text-muted-foreground">Sin imagen.</div>
              )}
            </div>
            {res.producto_ref && (
              <div className="rounded-xl border bg-card p-3">
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Packshot real usado {res.producto ? `· ${res.producto}` : ""}</div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={res.producto_ref} alt="packshot" className="w-24 rounded border" />
              </div>
            )}
          </div>
          <div className="space-y-3">
            <div className="rounded-xl border bg-card p-4">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Caption</div>
              <p className="whitespace-pre-wrap text-sm">{res.caption}</p>
              {res.hashtags && res.hashtags.length > 0 && (
                <p className="mt-2 text-xs text-blue-600">{res.hashtags.join(" ")}</p>
              )}
            </div>
            {res.slides && res.slides.length > 0 && (
              <div className="rounded-xl border bg-card p-4">
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Guión del carrusel</div>
                <ol className="space-y-1.5 text-sm">
                  {res.slides.map((s, i) => (
                    <li key={i}><strong>{i + 1}. {s.titulo}:</strong> {s.texto}</li>
                  ))}
                </ol>
              </div>
            )}
            <details className="rounded-xl border bg-card p-4 text-xs">
              <summary className="cursor-pointer font-medium text-muted-foreground">
                Prompt, referencias de estilo y engine {res.engine ? `(${res.engine})` : ""}
              </summary>
              <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{res.image_prompt}</p>
              {res.style_refs && res.style_refs.length > 0 && (
                <div className="mt-3">
                  <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Referencias de estilo (posts reales)</div>
                  <div className="flex flex-wrap gap-2">
                    {res.style_refs.map((u, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={i} src={u} alt={`ref ${i + 1}`} className="h-16 w-16 rounded border object-cover" />
                    ))}
                  </div>
                </div>
              )}
              {res.referencias && res.referencias.length > 0 && (
                <ul className="mt-3 space-y-1 text-muted-foreground">
                  {res.referencias.map((r, i) => (
                    <li key={i}>· [{r.media_type}] eng {r.engagement} / views {r.video_views} — {(r.message ?? "").slice(0, 100)}</li>
                  ))}
                </ul>
              )}
            </details>
          </div>
        </section>
      )}
    </div>
  );
}
