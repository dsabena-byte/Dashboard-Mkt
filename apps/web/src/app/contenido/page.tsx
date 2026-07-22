"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
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
const CANTIDADES = [1, 2, 3, 4];

interface Pieza {
  imagen: string | null;
  caption: string;
  hashtags: string[];
  slides: Array<{ titulo: string; texto: string }>;
  image_prompt: string;
  error?: string;
}
interface Resultado {
  ok: boolean;
  error?: string;
  producto?: string | null;
  engine?: string;
  piezas?: Pieza[];
  style_refs?: string[];
  producto_ref?: string | null;
}
interface RefCandidato {
  post_id: string;
  thumbnail_url: string;
  message: string | null;
  media_type: string | null;
  engagement: number;
}

export default function ContenidoPage() {
  const [pilar, setPilar] = useState<string>(PILARES[0]!);
  const [categoria, setCategoria] = useState("porfolio");
  const [modelo, setModelo] = useState<string>("");
  const [formato, setFormato] = useState("imagen");
  const [aspecto, setAspecto] = useState("vertical");
  const [cantidad, setCantidad] = useState(1);
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState<Resultado | null>(null);

  // Referencias de estilo (selector)
  const [candidatos, setCandidatos] = useState<RefCandidato[]>([]);
  const [refsElegidas, setRefsElegidas] = useState<string[]>([]);
  const [loadingRefs, setLoadingRefs] = useState(false);

  const modelos = useMemo(() => getModelos(categoria), [categoria]);

  const cargarRefs = useCallback(async () => {
    setLoadingRefs(true);
    try {
      const r = await fetch(`/api/contenido/referencias?pilar=${encodeURIComponent(pilar)}&categoria=${encodeURIComponent(categoria)}`);
      const j = (await r.json()) as { candidatos?: RefCandidato[] };
      const cands = j.candidatos ?? [];
      setCandidatos(cands);
      setRefsElegidas(cands.slice(0, 3).map((c) => c.thumbnail_url)); // default: top 3
    } catch {
      setCandidatos([]);
      setRefsElegidas([]);
    } finally {
      setLoadingRefs(false);
    }
  }, [pilar, categoria]);

  useEffect(() => {
    void cargarRefs();
  }, [cargarRefs]);

  function toggleRef(url: string) {
    setRefsElegidas((prev) => {
      if (prev.includes(url)) return prev.filter((u) => u !== url);
      if (prev.length >= 3) return prev; // máx 3 (límite de fal)
      return [...prev, url];
    });
  }

  function onCategoria(v: string) {
    setCategoria(v);
    setModelo("");
  }

  async function generar() {
    setLoading(true);
    setRes(null);
    try {
      const r = await fetch("/api/generar-contenido", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pilar, categoria, modelo: modelo || undefined, formato, aspecto, cantidad, ref_urls: refsElegidas }),
      });
      setRes(await r.json());
    } catch (e) {
      setRes({ ok: false, error: e instanceof Error ? e.message : String(e) });
    } finally {
      setLoading(false);
    }
  }

  const usaProducto = !!modelo;

  return (
    <div className="space-y-5">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight">Generador de contenido</h2>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Genera piezas orgánicas por pilar, inspiradas en lo que mejor performó (Insight Drean). Si elegís un modelo, usa
          el <strong>packshot real</strong> del producto (Drive de la agencia); si no, genera con Ideogram tomando como
          referencia de estilo las imágenes de los posts que elijas abajo. El video se suma en la próxima etapa (Kling / Veo).
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
          <select value={aspecto} onChange={(e) => setAspecto(e.target.value)} className="rounded border px-2 py-1.5 text-sm" disabled={usaProducto} title={usaProducto ? "El producto usa el encuadre del packshot" : ""}>
            {ASPECTOS.map((a) => <option key={a.v} value={a.v}>{a.l}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-medium text-muted-foreground">Cantidad</span>
          <select value={cantidad} onChange={(e) => setCantidad(Number(e.target.value))} className="rounded border px-2 py-1.5 text-sm">
            {CANTIDADES.map((n) => <option key={n} value={n}>{n} pieza{n > 1 ? "s" : ""}</option>)}
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

      {/* Selector de referencias de estilo */}
      <section className="rounded-xl border bg-card p-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Referencias de estilo {usaProducto ? "(se ignoran con producto real)" : `— elegí hasta 3 (${refsElegidas.length}/3)`}
          </div>
          <button type="button" onClick={() => void cargarRefs()} className="text-xs text-blue-600 hover:underline">Recargar</button>
        </div>
        {loadingRefs ? (
          <p className="text-xs text-muted-foreground">Cargando referencias…</p>
        ) : candidatos.length === 0 ? (
          <p className="text-xs text-muted-foreground">No hay posts con imagen para este pilar/categoría.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {candidatos.map((c) => {
              const sel = refsElegidas.includes(c.thumbnail_url);
              return (
                <button
                  key={c.post_id}
                  type="button"
                  onClick={() => toggleRef(c.thumbnail_url)}
                  disabled={usaProducto}
                  title={c.message ?? ""}
                  className={`relative h-20 w-20 overflow-hidden rounded border-2 transition ${sel ? "border-blue-600 ring-2 ring-blue-200" : "border-transparent opacity-80 hover:opacity-100"} ${usaProducto ? "cursor-not-allowed opacity-40" : ""}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={c.thumbnail_url} alt="ref" className="h-full w-full object-cover" />
                  {sel && <span className="absolute right-0.5 top-0.5 rounded bg-blue-600 px-1 text-[9px] text-white">✓</span>}
                </button>
              );
            })}
          </div>
        )}
      </section>

      {res && !res.ok && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-xs text-red-900">
          <strong>Error:</strong> {res.error}
          {/FAL_KEY/.test(res.error ?? "") && <div className="mt-1">Falta configurar la <code>FAL_KEY</code> en Vercel (crear en fal.ai/dashboard/keys).</div>}
        </div>
      )}

      {res?.ok && res.piezas && (
        <section className="space-y-3">
          {res.producto_ref && (
            <div className="flex items-center gap-3 rounded-xl border bg-card p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={res.producto_ref} alt="packshot" className="h-16 w-16 rounded border object-contain" />
              <div className="text-xs text-muted-foreground">
                Packshot real usado {res.producto ? <strong>· {res.producto}</strong> : null}
                <div className="text-[11px]">engine: {res.engine}</div>
              </div>
            </div>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            {res.piezas.map((p, idx) => (
              <div key={idx} className="overflow-hidden rounded-xl border bg-card">
                {p.error ? (
                  <div className="p-4 text-xs text-red-700">Pieza {idx + 1} falló: {p.error}</div>
                ) : (
                  <>
                    {p.imagen ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.imagen} alt={`pieza ${idx + 1}`} className="w-full" />
                    ) : (
                      <div className="flex h-64 items-center justify-center text-xs text-muted-foreground">Sin imagen.</div>
                    )}
                    <div className="space-y-2 p-4">
                      <p className="whitespace-pre-wrap text-sm">{p.caption}</p>
                      {p.hashtags.length > 0 && <p className="text-xs text-blue-600">{p.hashtags.join(" ")}</p>}
                      {p.slides.length > 0 && (
                        <ol className="mt-1 space-y-1 border-t pt-2 text-xs">
                          {p.slides.map((s, i) => (
                            <li key={i}><strong>{i + 1}. {s.titulo}:</strong> {s.texto}</li>
                          ))}
                        </ol>
                      )}
                      <details className="text-[11px]">
                        <summary className="cursor-pointer text-muted-foreground">Prompt de imagen</summary>
                        <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{p.image_prompt}</p>
                      </details>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
