"use client";

import { useState, useMemo } from "react";
import { CATEGORIAS, ESTILOS } from "@/lib/contenido-shared";
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

// Placa de mensaje clave sobre la imagen + descarga con el texto grabado.
function PiezaCard({ pieza, idx }: { pieza: Pieza; idx: number }) {
  const [msg, setMsg] = useState(pieza.mensaje_clave ?? "");
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
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("ctx");
      ctx.drawImage(img, 0, 0);
      if (msg.trim()) {
        const W = canvas.width;
        const pad = Math.round(W * 0.06);
        const fs = Math.round(W * 0.055);
        ctx.font = `700 ${fs}px Arial, sans-serif`;
        ctx.fillStyle = "#ffffff";
        ctx.textBaseline = "alphabetic";
        ctx.shadowColor = "rgba(0,0,0,0.55)";
        ctx.shadowBlur = fs * 0.35;
        ctx.shadowOffsetY = 2;
        // wrap
        const maxW = W - pad * 2;
        const words = msg.trim().split(/\s+/);
        const lines: string[] = [];
        let line = "";
        for (const w of words) {
          const test = line ? `${line} ${w}` : w;
          if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; }
          else line = test;
        }
        if (line) lines.push(line);
        let y = canvas.height - pad - (lines.length - 1) * fs * 1.15;
        for (const l of lines) { ctx.fillText(l, pad, y); y += fs * 1.15; }
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
      // CORS u otro: bajamos la imagen limpia y avisamos.
      window.open(pieza.imagen, "_blank");
      alert("No se pudo grabar la placa en la imagen (restricción del proveedor). Se abrió la imagen limpia; el mensaje está en el campo para copiarlo.");
    } finally {
      setBajando(false);
    }
  }

  if (pieza.error) {
    return <div className="rounded-xl border bg-card p-4 text-xs text-red-700">Pieza {idx + 1} falló: {pieza.error}</div>;
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="relative bg-neutral-100">
        {pieza.imagen ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={pieza.imagen} alt={`pieza ${idx + 1}`} className="mx-auto max-h-72 w-full object-contain" />
        ) : (
          <div className="flex h-64 items-center justify-center text-xs text-muted-foreground">Sin imagen.</div>
        )}
        {/* Placa de mensaje clave (preview) */}
        {msg.trim() && pieza.imagen && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 p-3">
            <span className="text-lg font-bold leading-tight text-white [text-shadow:_0_2px_6px_rgb(0_0_0_/_60%)]">{msg}</span>
          </div>
        )}
      </div>
      <div className="space-y-2 p-4">
        <label className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Mensaje clave (placa)</label>
        <div className="flex gap-2">
          <input value={msg} onChange={(e) => setMsg(e.target.value)} className="flex-1 rounded border px-2 py-1.5 text-sm" placeholder="Mensaje sobre la imagen" />
          <button type="button" onClick={descargar} disabled={bajando || !pieza.imagen} className="rounded border px-3 py-1.5 text-xs font-medium hover:bg-secondary disabled:opacity-50">
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
  const [estilo, setEstilo] = useState(ESTILOS[0]!.v);
  const [personas, setPersonas] = useState(false);
  const [formato, setFormato] = useState("imagen");
  const [aspecto, setAspecto] = useState("vertical");
  const [cantidad, setCantidad] = useState(1);
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState<Resultado | null>(null);

  const modelos = useMemo(() => getModelos(categoria), [categoria]);
  const estiloSel = useMemo(() => ESTILOS.find((e) => e.v === estilo) ?? ESTILOS[0]!, [estilo]);

  function onEstilo(v: string) {
    setEstilo(v);
    const e = ESTILOS.find((x) => x.v === v);
    if (e) setPersonas(e.personasDefault); // default de personas según el estilo
  }

  async function generar() {
    setLoading(true);
    setRes(null);
    try {
      const r = await fetch("/api/generar-contenido", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pilar, categoria, modelo: modelo || undefined, estilo, personas, formato, aspecto, cantidad }),
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
          Generá piezas orgánicas por pilar con un <strong>estilo definido</strong> (no random). Si elegís un modelo y el
          estilo trata el producto como protagonista, usa el <strong>packshot real</strong>. El mensaje clave va como
          placa editable sobre la imagen. Video en la próxima etapa (Kling / Veo).
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
          <span className="font-medium text-muted-foreground">Estilo</span>
          <select value={estilo} onChange={(e) => onEstilo(e.target.value)} className="rounded border px-2 py-1.5 text-sm">
            {ESTILOS.map((e) => <option key={e.v} value={e.v}>{e.label}</option>)}
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
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={personas} onChange={(e) => setPersonas(e.target.checked)} className="h-4 w-4" />
          <span className="font-medium text-muted-foreground">Con personas</span>
        </label>
        <button type="button" onClick={generar} disabled={loading} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90 disabled:opacity-50">
          {loading ? "Generando…" : "Generar"}
        </button>
      </section>

      <p className="text-xs text-muted-foreground">
        <strong>{estiloSel.label}</strong> — {estiloSel.producto === "hero" ? "producto protagonista (usa packshot real si elegís modelo)." : "el producto aparece en la escena; el foco es el contexto/las personas."}
      </p>

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
                <div className="text-[11px]">estilo: {res.estilo} · engine: {res.engine}</div>
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
