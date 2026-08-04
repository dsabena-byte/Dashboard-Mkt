"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { type Trim, parseWords, computeTrim, loadImg, drawBg, drawLogoLayer, drawTextBlock } from "@/lib/pieza-compositor";

// Editor de diseño de UNA pieza: sobre la imagen se acomodan el logo y DOS
// bloques de texto independientes (título y bajada), cada uno con su posición
// X/Y, tamaño, negrita y cursiva. Compone el PNG final WYSIWYG y lo guarda
// (imagen_final_url) dejando la pieza lista en la Biblioteca.

const LOGO_URL = "/drean-logo.png";

// Config de diseño persistida por pieza (fracciones 0..1 + estilos).
export interface Diseno {
  on: boolean; // logo visible
  logoX: number; logoY: number; logoPct: number;
  color: string; // color de ambos textos
  titX: number; titY: number; titPct: number; titBold: boolean; titItalic: boolean;
  bajX: number; bajY: number; bajPct: number; bajBold: boolean; bajItalic: boolean;
}

const DEFAULT: Diseno = {
  on: true, logoX: 0.04, logoY: 0.04, logoPct: 0.12, color: "#ffffff",
  titX: 0.04, titY: 0.84, titPct: 0.075, titBold: true, titItalic: false,
  bajX: 0.04, bajY: 0.93, bajPct: 0.045, bajBold: false, bajItalic: false,
};

// Envuelve el texto en el markup que entiende el compositor (**negrita**, _cursiva_).
function withMarks(text: string, bold: boolean, italic: boolean): string {
  let t = text.trim();
  if (!t) return "";
  if (italic) t = `_${t}_`;
  if (bold) t = `**${t}**`;
  return t;
}

function Slider({ label, value, min, max, step, onChange, fmt }: { label: string; value: number; min: number; max: number; step: number; onChange: (n: number) => void; fmt: (n: number) => string }) {
  return (
    <label className="flex items-center gap-1.5">
      <span className="w-3 text-[9px] text-muted-foreground">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="h-1 flex-1 accent-[var(--primary)]" />
      <span className="w-9 text-right text-[9px] tabular-nums text-muted-foreground">{fmt(value)}</span>
    </label>
  );
}

const pctFmt = (n: number) => `${Math.round(n)}%`;

// Controles de un bloque de texto (posición/tamaño + negrita/cursiva). A nivel
// de módulo para no remontarse en cada render (rompería el arrastre del slider).
function TextoBox({ nombre, bold, italic, x, y, t, onBold, onItalic, onX, onY, onT }: {
  nombre: string; bold: boolean; italic: boolean; x: number; y: number; t: number;
  onBold: () => void; onItalic: () => void; onX: (n: number) => void; onY: (n: number) => void; onT: (n: number) => void;
}) {
  const tog = "rounded border px-1.5 py-0.5 text-[10px] font-medium leading-none";
  return (
    <div className="space-y-1 rounded border p-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase text-muted-foreground">{nombre}</span>
        <div className="flex items-center gap-1">
          <button type="button" onClick={onBold} className={`${tog} ${bold ? "bg-foreground text-background" : "hover:bg-secondary"}`} title="Negrita"><b>N</b></button>
          <button type="button" onClick={onItalic} className={`${tog} ${italic ? "bg-foreground text-background" : "hover:bg-secondary"}`} title="Cursiva"><i>C</i></button>
        </div>
      </div>
      <Slider label="X" value={x * 100} min={0} max={100} step={1} onChange={(n) => onX(n / 100)} fmt={pctFmt} />
      <Slider label="Y" value={y * 100} min={0} max={100} step={1} onChange={(n) => onY(n / 100)} fmt={pctFmt} />
      <Slider label="T" value={t * 100} min={2} max={20} step={1} onChange={(n) => onT(n / 100)} fmt={pctFmt} />
    </div>
  );
}

export function PiezaDisenador({ imagenUrl, titulo, bajada, caption, diseno, save, uploadBlob, onDone }: {
  imagenUrl: string;
  titulo: string;
  bajada: string;
  caption: string;
  diseno: Diseno | null | undefined;
  save: (patch: Record<string, unknown>) => void;
  uploadBlob: (blob: Blob) => Promise<string>;
  onDone?: () => void;
}) {
  const [bgImg, setBgImg] = useState<HTMLImageElement | null>(null);
  const [bgErr, setBgErr] = useState<string | null>(null);
  const [logoImg, setLogoImg] = useState<HTMLImageElement | null>(null);
  const [logoTrim, setLogoTrim] = useState<Trim | null>(null);
  const [logoSrc, setLogoSrc] = useState<string>(LOGO_URL);
  const [d, setD] = useState<Diseno>({ ...DEFAULT, ...(diseno ?? {}) });
  const [fontReady, setFontReady] = useState(false);
  const [composing, setComposing] = useState(false);
  const ref = useRef<HTMLCanvasElement>(null);
  const firstSave = useRef(true);

  useEffect(() => { let cancel = false; setBgErr(null); setBgImg(null);
    (async () => { try { const i = await loadImg(imagenUrl, true); if (!cancel) setBgImg(i); } catch { if (!cancel) setBgErr("No se pudo cargar la imagen para el editor."); } })();
    return () => { cancel = true; }; }, [imagenUrl]);
  useEffect(() => { let cancel = false;
    (async () => { try { const i = await loadImg(logoSrc); if (!cancel) { setLogoImg(i); setLogoTrim(computeTrim(i)); } } catch { /* sin logo */ } })();
    return () => { cancel = true; }; }, [logoSrc]);
  useEffect(() => { (async () => { try { await document.fonts.load('800 40px "Manrope"'); await document.fonts.load('500 40px "Manrope"'); } catch { /* */ } setFontReady(true); })(); }, []);

  const titWords = useMemo(() => parseWords(withMarks(titulo, d.titBold, d.titItalic)), [titulo, d.titBold, d.titItalic]);
  const bajWords = useMemo(() => parseWords(withMarks(bajada, d.bajBold, d.bajItalic)), [bajada, d.bajBold, d.bajItalic]);

  // Persistir la config (posiciones/estilos) con debounce, sin recomponer.
  useEffect(() => {
    if (firstSave.current) { firstSave.current = false; return; }
    const t = setTimeout(() => save({ diseno: d }), 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d]);

  // Dibuja fondo + logo + los dos bloques de texto en el contexto dado.
  function render(ctx: CanvasRenderingContext2D, W: number, H: number) {
    if (!bgImg) return;
    drawBg(ctx, bgImg, W, H);
    if (d.on && logoImg && logoTrim) drawLogoLayer(ctx, logoImg, logoTrim, W, H, d.logoX, d.logoY, d.logoPct);
    drawTextBlock(ctx, titWords, W, H, d.titX, d.titY, d.titPct, d.color);
    drawTextBlock(ctx, bajWords, W, H, d.bajX, d.bajY, d.bajPct, d.color);
  }

  // Preview en vivo.
  const DW = 300;
  const DH = bgImg ? Math.round(DW * (bgImg.naturalHeight / bgImg.naturalWidth)) : Math.round(DW * 1.25);
  useEffect(() => {
    const cv = ref.current; if (!cv) return; const ctx = cv.getContext("2d"); if (!ctx) return;
    ctx.clearRect(0, 0, DW, DH);
    if (bgImg) render(ctx, DW, DH);
    else { ctx.fillStyle = "#e5e7eb"; ctx.fillRect(0, 0, DW, DH); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bgImg, logoImg, logoTrim, titWords, bajWords, d, DW, DH, fontReady]);

  const upd = (patch: Partial<Diseno>) => setD((prev) => ({ ...prev, ...patch }));
  function onLogoFile(file: File | undefined) {
    if (!file) return;
    const r = new FileReader();
    r.onload = () => { setLogoSrc(String(r.result)); upd({ on: true }); };
    r.readAsDataURL(file);
  }

  async function componer() {
    if (!bgImg) return;
    setComposing(true);
    try {
      const W = bgImg.naturalWidth, H = bgImg.naturalHeight;
      const canvas = document.createElement("canvas"); canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext("2d"); if (!ctx) throw new Error("ctx");
      try { await document.fonts.load(`800 ${Math.round(H * 0.08)}px "Manrope"`); await document.fonts.load(`500 ${Math.round(H * 0.08)}px "Manrope"`); } catch { /* fallback */ }
      render(ctx, W, H);
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
      if (!blob) throw new Error("toBlob");
      const url = await uploadBlob(blob);
      // "Guardar" en Diseñar = pieza terminada → queda EN BIBLIOTECA (aprobada).
      save({ imagen_final_url: url, con_placa: false, aprobado: true, estado: "aprobado" });
      save({ diseno: d });
      onDone?.();
    } catch (e) {
      alert(`No se pudo componer el diseño: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setComposing(false);
    }
  }

  const field = "rounded border px-2 py-1 text-xs";
  const colores: [string, string][] = [["#ffffff", "blanco"], ["#00064F", "azul Drean"], ["#111111", "negro"]];

  return (
    <div className="mt-3 flex flex-col gap-4 sm:flex-row">
      {/* Preview WYSIWYG */}
      <div className="shrink-0 self-start">
        <canvas ref={ref} width={DW} height={DH} className="w-[300px] max-w-full rounded border bg-muted" />
        {bgErr && <p className="mt-1 text-[10px] text-red-700">{bgErr}</p>}
        <p className="mt-1 text-[10px] text-muted-foreground">Lo que ves es lo que se publica.</p>
      </div>

      {/* Controles */}
      <div className="flex-1 space-y-3">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div>
            <label className="block text-[10px] font-semibold uppercase text-muted-foreground">Título (texto)</label>
            <input defaultValue={titulo} onBlur={(e) => save({ mensaje_clave: e.target.value })} className={`${field} w-full`} />
          </div>
          <div>
            <label className="block text-[10px] font-semibold uppercase text-muted-foreground">Bajada (texto)</label>
            <input defaultValue={bajada} onBlur={(e) => save({ bajada: e.target.value })} className={`${field} w-full`} />
          </div>
        </div>
        <div>
          <label className="block text-[10px] font-semibold uppercase text-muted-foreground">Caption (copy del posteo)</label>
          <textarea defaultValue={caption} onBlur={(e) => save({ caption: e.target.value })} rows={3} className={`${field} w-full`} />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {/* Logo */}
          <div className="space-y-1 rounded border p-2">
            <div className="flex items-center justify-between gap-2">
              <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase text-muted-foreground">
                <input type="checkbox" checked={d.on} onChange={(e) => upd({ on: e.target.checked })} /> Logo
              </label>
              <div className="flex items-center gap-1">
                <label className="cursor-pointer rounded border px-1.5 py-0.5 text-[9px] font-medium hover:bg-secondary" title="Subir tu propio logo (PNG con fondo transparente)">
                  ⬆ Subir
                  <input type="file" accept="image/png,image/webp" className="hidden" onChange={(e) => { onLogoFile(e.target.files?.[0]); e.target.value = ""; }} />
                </label>
                {logoSrc !== LOGO_URL && <button type="button" onClick={() => setLogoSrc(LOGO_URL)} className="rounded border px-1.5 py-0.5 text-[9px] font-medium hover:bg-secondary">Drean</button>}
              </div>
            </div>
            <Slider label="X" value={d.logoX * 100} min={0} max={100} step={1} onChange={(n) => upd({ logoX: n / 100 })} fmt={pctFmt} />
            <Slider label="Y" value={d.logoY * 100} min={0} max={100} step={1} onChange={(n) => upd({ logoY: n / 100 })} fmt={pctFmt} />
            <Slider label="T" value={d.logoPct * 100} min={3} max={60} step={1} onChange={(n) => upd({ logoPct: n / 100 })} fmt={pctFmt} />
          </div>

          {/* Color de los textos */}
          <div className="space-y-1 rounded border p-2">
            <span className="text-[11px] font-semibold uppercase text-muted-foreground">Color texto</span>
            <div className="flex items-center gap-1.5 pt-1">
              {colores.map(([c, n]) => (
                <button key={c} type="button" onClick={() => upd({ color: c })} className={`h-5 w-5 rounded border ${d.color === c ? "ring-2 ring-primary" : ""}`} style={{ backgroundColor: c }} title={n} />
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TextoBox nombre="Título · posición" bold={d.titBold} italic={d.titItalic} x={d.titX} y={d.titY} t={d.titPct}
            onBold={() => upd({ titBold: !d.titBold })} onItalic={() => upd({ titItalic: !d.titItalic })}
            onX={(n) => upd({ titX: n })} onY={(n) => upd({ titY: n })} onT={(n) => upd({ titPct: n })} />
          <TextoBox nombre="Bajada · posición" bold={d.bajBold} italic={d.bajItalic} x={d.bajX} y={d.bajY} t={d.bajPct}
            onBold={() => upd({ bajBold: !d.bajBold })} onItalic={() => upd({ bajItalic: !d.bajItalic })}
            onX={(n) => upd({ bajX: n })} onY={(n) => upd({ bajY: n })} onT={(n) => upd({ bajPct: n })} />
        </div>

        <div className="flex items-center gap-2">
          <button onClick={componer} disabled={composing || !bgImg} className="rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50">
            {composing ? "Guardando…" : "Guardar y pasar a Biblioteca ✓"}
          </button>
          <span className="text-[10px] text-muted-foreground">Quema logo + texto en la imagen final y la manda a la <b>Biblioteca</b>.</span>
        </div>
      </div>
    </div>
  );
}
