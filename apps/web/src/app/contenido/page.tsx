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
const CANTIDADES = [1, 2, 3, 4];

interface Pieza {
  imagen: string | null;
  caption: string;
  hashtags: string[];
  mensaje_clave: string;
  bajada: string;
  slides: Array<{ titulo: string; texto: string }>;
  image_prompt: string;
  error?: string;
}
interface Resultado {
  ok: boolean;
  error?: string;
  estilo?: string;
  personas?: boolean;
  producto?: string | null;
  usa_packshot?: boolean;
  engine?: string;
  piezas?: Pieza[];
  producto_ref?: string | null;
}

// Envuelve el texto según el ancho disponible (canvas).
function wrapCanvas(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; }
    else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

// Placa (título + bajada) DENTRO de la imagen + descarga con el texto grabado.
function PiezaCard({ pieza, idx }: { pieza: Pieza; idx: number }) {
  const [titulo, setTitulo] = useState(pieza.mensaje_clave ?? "");
  const [bajada, setBajada] = useState(pieza.bajada ?? "");
  const [bajando, setBajando] = useState(false);

  async function descargar() {
    if (!pieza.imagen) return;
    setBajando(true);
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("load"));
        img.src = pieza.imagen as string;
      });
      const canvas = document.createElement("canvas");
      const W = (canvas.width = img.naturalWidth);
      const H = (canvas.height = img.naturalHeight);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("ctx");
      ctx.drawImage(img, 0, 0);

      if (titulo.trim() || bajada.trim()) {
        // Scrim inferior para legibilidad.
        const gradH = H * 0.4;
        const grad = ctx.createLinearGradient(0, H - gradH, 0, H);
        grad.addColorStop(0, "rgba(0,0,0,0)");
        grad.addColorStop(1, "rgba(0,0,0,0.72)");
        ctx.fillStyle = grad;
        ctx.fillRect(0, H - gradH, W, gradH);

        const pad = Math.round(W * 0.055);
        ctx.fillStyle = "#ffffff";
        ctx.textBaseline = "alphabetic";
        ctx.shadowColor = "rgba(0,0,0,0.5)";
        ctx.shadowBlur = W * 0.02;
        let yBottom = H - pad;

        if (bajada.trim()) {
          const fsB = Math.round(W * 0.036);
          ctx.font = `600 ${fsB}px Arial, sans-serif`;
          const bl = wrapCanvas(ctx, bajada, W - pad * 2);
          let y = yBottom - (bl.length - 1) * fsB * 1.25;
          for (const l of bl) { ctx.fillText(l, pad, y); y += fsB * 1.25; }
          yBottom -= bl.length * fsB * 1.25 + fsB * 0.4;
        }
        if (titulo.trim()) {
          const fsT = Math.round(W * 0.065);
          ctx.font = `800 ${fsT}px Arial, sans-serif`;
          const tl = wrapCanvas(ctx, titulo, W - pad * 2);
          let y = yBottom - (tl.length - 1) * fsT * 1.12;
          for (const l of tl) { ctx.fillText(l, pad, y); y += fsT * 1.12; }
        }
      }

      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
      if (!blob) throw new Error("toBlob");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pieza-${idx + 1}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      window.open(pieza.imagen, "_blank");
      alert("No se pudo grabar la placa en la imagen (restricción del proveedor). Se abrió la imagen limpia.");
    } finally {
      setBajando(false);
    }
  }

  if (pieza.error) {
    return <div className="rounded-xl border bg-card p-4 text-xs text-red-700">Pieza {idx + 1} falló: {pieza.error}</div>;
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="flex justify-center bg-neutral-900">
        {pieza.imagen ? (
          <div className="relative inline-block max-w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={pieza.imagen} alt={`pieza ${idx + 1}`} className="block max-h-[26rem] w-auto max-w-full" />
            {/* Placa DENTRO de la imagen: scrim + título + bajada */}
            {(titulo.trim() || bajada.trim()) && (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent px-4 pb-4 pt-10">
                {titulo.trim() && <div className="text-xl font-extrabold leading-tight text-white [text-shadow:_0_2px_8px_rgb(0_0_0_/_55%)]">{titulo}</div>}
                {bajada.trim() && <div className="mt-1 text-sm font-medium leading-snug text-white/90 [text-shadow:_0_2px_8px_rgb(0_0_0_/_55%)]">{bajada}</div>}
              </div>
            )}
          </div>
        ) : (
          <div className="flex h-64 w-full items-center justify-center text-xs text-muted-foreground">Sin imagen.</div>
        )}
      </div>
      <div className="space-y-2 p-4">
        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-1">
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Título de la placa</label>
            <input value={titulo} onChange={(e) => setTitulo(e.target.value)} className="w-full rounded border px-2 py-1.5 text-sm" placeholder="Título" />
            <input value={bajada} onChange={(e) => setBajada(e.target.value)} className="w-full rounded border px-2 py-1.5 text-xs" placeholder="Bajada (subtítulo)" />
          </div>
          <button type="button" onClick={descargar} disabled={bajando || !pieza.imagen} className="rounded border px-3 py-2 text-xs font-medium hover:bg-secondary disabled:opacity-50">
            {bajando ? "…" : "Descargar"}
          </button>
        </div>
        <p className="whitespace-pre-wrap pt-1 text-sm">{pieza.caption}</p>
        {pieza.hashtags.length > 0 && <p className="text-xs text-blue-600">{pieza.hashtags.join(" ")}</p>}
        {pieza.slides.length > 0 && (
          <ol className="mt-1 space-y-1 border-t pt-2 text-xs">
            {pieza.slides.map((s, i) => (<li key={i}><strong>{i + 1}. {s.titulo}:</strong> {s.texto}</li>))}
          </ol>
        )}
        <details className="text-[11px]">
          <summary className="cursor-pointer text-muted-foreground">Prompt de imagen</summary>
          <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{pieza.image_prompt}</p>
        </details>
      </div>
    </div>
  );
}

export default function ContenidoPage() {
  const [pilar, setPilar] = useState<string>(PILARES[0]!);
  const [categoria, setCategoria] = useState("porfolio");
  const [modelo, setModelo] = useState<string>("");
  const [formato, setFormato] = useState("imagen");
  const [aspecto, setAspecto] = useState("vertical");
  const [cantidad, setCantidad] = useState(1);
  const [productoReal, setProductoReal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState<Resultado | null>(null);

  const modelos = useMemo(() => getModelos(categoria), [categoria]);

  async function generar() {
    setLoading(true);
    setRes(null);
    try {
      const r = await fetch("/api/generar-contenido", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pilar, categoria, modelo: modelo || undefined, productoReal: modelo ? productoReal : false, formato, aspecto, cantidad }),
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
          Generá piezas orgánicas por pilar con la <strong>estética premium de Drean</strong> (cálida, oscura, minimalista,
          maderas y mármol). Si elegís un modelo podés usar la <strong>foto real del producto</strong> (tildando “Foto real”) o
          dejar que Ideogram lo <strong>recree</strong> en la estética. El mensaje clave va como placa editable sobre la imagen.
          Video en la próxima etapa (Kling / Veo).
        </p>
      </header>

      <details className="rounded-xl border bg-card p-4 text-sm">
        <summary className="cursor-pointer font-medium">¿Cómo se generan las imágenes? (plataforma, estilo, proceso)</summary>
        <div className="mt-3 space-y-3 text-muted-foreground">
          <div>
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide">Plataforma / herramientas</div>
            <ul className="list-disc space-y-1 pl-5">
              <li><strong>Imagen:</strong> fal.ai — <strong>Ideogram v3</strong> (recrea el electrodoméstico en la estética premium) o, con “Foto real” tildado, <strong>Nano Banana</strong> (Gemini 2.5 Flash Image: usa el packshot real y arma la escena alrededor).</li>
              <li><strong>Copy y brief:</strong> OpenAI <strong>gpt-4o-mini</strong> — arma el prompt de imagen, el caption, hashtags y el mensaje clave (título + bajada).</li>
              <li><strong>Datos:</strong> Supabase (top posts por pilar como insumo del brief) + catálogo de modelos (Drive).</li>
            </ul>
          </div>
          <div>
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide">Estilo (fijo)</div>
            <p>Estética Drean premium aplicada siempre: <strong>cálida, oscura, low-key y cinematográfica</strong> — maderas de nogal, mármol/piedra, negro mate, acero; luz dramática cálida; minimalista, un solo producto, sin cargar. (Evita lo claro/aireado/stock.)</p>
          </div>
          <div>
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide">Proceso</div>
            <ol className="list-decimal space-y-1 pl-5">
              <li>Elegís pilar, categoría, modelo (opcional), formato, aspecto y cantidad.</li>
              <li>OpenAI diseña el brief (escena + mensaje clave + copy) según el pilar y lo que mejor performó.</li>
              <li>Ideogram genera la imagen en la estética premium (proporción por categoría: heladera alta, cocina/lavarropas altura mesada).</li>
              <li>Editás el título/bajada de la placa y descargás la pieza (imagen + texto).</li>
            </ol>
          </div>
          <p className="text-xs">Notas: con un modelo elegido, <strong>“Foto real”</strong> usa el packshot exacto (Nano Banana arma la escena alrededor); sin tildar, Ideogram <strong>recrea</strong> el electrodoméstico (no es pixel-exacto). En pilar <strong>Experiencia uso</strong> la escena incluye personas usando el producto.</p>
        </div>
      </details>

      <section className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4">
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-medium text-muted-foreground">Pilar</span>
          <select value={pilar} onChange={(e) => setPilar(e.target.value)} className="rounded border px-2 py-1.5 text-sm">
            {PILARES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-medium text-muted-foreground">Categoría</span>
          <select value={categoria} onChange={(e) => { setCategoria(e.target.value); setModelo(""); }} className="rounded border px-2 py-1.5 text-sm">
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
          <span className="font-medium text-muted-foreground">Imagen del producto</span>
          <label className={`flex items-center gap-1.5 rounded border px-2 py-1.5 text-sm ${!modelo ? "opacity-50" : "cursor-pointer"}`} title={!modelo ? "Elegí un modelo para usar la foto real" : "Foto real del packshot vs. recreación de Ideogram"}>
            <input type="checkbox" checked={modelo ? productoReal : false} disabled={!modelo} onChange={(e) => setProductoReal(e.target.checked)} />
            <span>{productoReal && modelo ? "Foto real (Nano Banana)" : "Recreada (Ideogram)"}</span>
          </label>
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
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-medium text-muted-foreground">Cantidad</span>
          <select value={cantidad} onChange={(e) => setCantidad(Number(e.target.value))} className="rounded border px-2 py-1.5 text-sm">
            {CANTIDADES.map((n) => <option key={n} value={n}>{n} pieza{n > 1 ? "s" : ""}</option>)}
          </select>
        </label>
        <button type="button" onClick={generar} disabled={loading} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90 disabled:opacity-50">
          {loading ? "Generando…" : "Generar"}
        </button>
      </section>

      {res && !res.ok && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-xs text-red-900">
          <strong>Error:</strong> {res.error}
          {/FAL_KEY/.test(res.error ?? "") && <div className="mt-1">Falta configurar la <code>FAL_KEY</code> en Vercel (crear en fal.ai/dashboard/keys).</div>}
        </div>
      )}

      {res?.ok && res.piezas && (
        <section className="space-y-3">
          {res.producto_ref && res.usa_packshot && (
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
            {res.piezas.map((p, idx) => <PiezaCard key={idx} pieza={p} idx={idx} />)}
          </div>
        </section>
      )}
    </div>
  );
}
