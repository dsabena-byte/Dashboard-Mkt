"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { type FmtCfg, type Trim, parseWords, computeTrim, loadImg, drawPieza } from "@/lib/pieza-compositor";

// Editor de diseño de UNA pieza: sobre la imagen generada se acomoda el logo de
// Drean y el texto (título + bajada) con la misma flexibilidad que la Adaptación
// de piezas — posición X/Y, tamaño y color. Compone el PNG final WYSIWYG y lo
// guarda (imagen_final_url) para publicar exactamente lo que se ve.

const LOGO_URL = "/drean-logo.png";

// Config de diseño persistida por pieza (fracciones 0..1 + color del texto).
export interface Diseno {
  on: boolean; // logo visible
  logoX: number; logoY: number; logoPct: number;
  textX: number; textY: number; textPct: number;
  color: string;
}

const DEFAULT: Diseno = { on: true, logoX: 0.04, logoY: 0.04, logoPct: 0.12, textX: 0.04, textY: 0.96, textPct: 0.075, color: "#ffffff" };

function toCfg(d: Diseno): FmtCfg {
  return { on: d.on, logoX: d.logoX, logoY: d.logoY, logoPct: d.logoPct, textX: d.textX, textY: d.textY, textPct: d.textPct, bandPct: 0 };
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

export function PiezaDisenador({ imagenUrl, titulo, bajada, caption, diseno, save, uploadBlob }: {
  imagenUrl: string;
  titulo: string;
  bajada: string;
  caption: string;
  diseno: Diseno | null | undefined;
  save: (patch: Record<string, unknown>) => void;
  uploadBlob: (blob: Blob) => Promise<string>;
}) {
  const [bgImg, setBgImg] = useState<HTMLImageElement | null>(null);
  const [bgErr, setBgErr] = useState<string | null>(null);
  const [logoImg, setLogoImg] = useState<HTMLImageElement | null>(null);
  const [logoTrim, setLogoTrim] = useState<Trim | null>(null);
  const [d, setD] = useState<Diseno>({ ...DEFAULT, ...(diseno ?? {}) });
  const [fontReady, setFontReady] = useState(false);
  const [composing, setComposing] = useState(false);
  const ref = useRef<HTMLCanvasElement>(null);
  const firstSave = useRef(true);

  // Cargar fondo (la imagen de la pieza), logo y fuente Manrope.
  useEffect(() => { let cancel = false; setBgErr(null); setBgImg(null);
    (async () => { try { const i = await loadImg(imagenUrl, true); if (!cancel) setBgImg(i); } catch { if (!cancel) setBgErr("No se pudo cargar la imagen para el editor."); } })();
    return () => { cancel = true; }; }, [imagenUrl]);
  useEffect(() => { let cancel = false;
    (async () => { try { const i = await loadImg(LOGO_URL); if (!cancel) { setLogoImg(i); setLogoTrim(computeTrim(i)); } } catch { /* sin logo */ } })();
    return () => { cancel = true; }; }, []);
  useEffect(() => { (async () => { try { await document.fonts.load('800 40px "Manrope"'); await document.fonts.load('500 40px "Manrope"'); } catch { /* */ } setFontReady(true); })(); }, []);

  const words = useMemo(() => parseWords(`${titulo.trim() ? `**${titulo.trim()}**` : ""}${bajada.trim() ? ` ${bajada.trim()}` : ""}`.trim()), [titulo, bajada]);

  // Persistir la config (posiciones) con debounce, sin recomponer la imagen.
  useEffect(() => {
    if (firstSave.current) { firstSave.current = false; return; }
    const t = setTimeout(() => save({ diseno: d }), 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d]);

  // Preview en vivo.
  const DW = 300;
  const DH = bgImg ? Math.round(DW * (bgImg.naturalHeight / bgImg.naturalWidth)) : Math.round(DW * 1.25);
  useEffect(() => {
    const cv = ref.current; if (!cv) return; const ctx = cv.getContext("2d"); if (!ctx) return;
    ctx.clearRect(0, 0, DW, DH);
    if (bgImg) drawPieza(ctx, bgImg, d.on ? logoImg : null, d.on ? logoTrim : null, words, DW, DH, toCfg(d), d.color, "#00064F");
    else { ctx.fillStyle = "#e5e7eb"; ctx.fillRect(0, 0, DW, DH); }
  }, [bgImg, logoImg, logoTrim, words, d, DW, DH, fontReady]);

  const upd = (patch: Partial<Diseno>) => setD((prev) => ({ ...prev, ...patch }));
  const pct = (n: number) => `${Math.round(n)}%`;

  async function componer() {
    if (!bgImg) return;
    setComposing(true);
    try {
      const W = bgImg.naturalWidth, H = bgImg.naturalHeight;
      const canvas = document.createElement("canvas"); canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext("2d"); if (!ctx) throw new Error("ctx");
      try { await document.fonts.load(`800 ${Math.round(H * 0.08)}px "Manrope"`); await document.fonts.load(`500 ${Math.round(H * 0.08)}px "Manrope"`); } catch { /* fallback */ }
      drawPieza(ctx, bgImg, d.on ? logoImg : null, d.on ? logoTrim : null, words, W, H, toCfg(d), d.color, "#00064F");
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
      if (!blob) throw new Error("toBlob");
      const url = await uploadBlob(blob);
      // con_placa=false: el diseño ya está quemado en imagen_final_url, no re-componemos placa.
      // Guardamos primero la imagen final (siempre funciona) y aparte el diseño
      // (best-effort: si la columna `diseno` aún no existe, no rompe la compo).
      save({ imagen_final_url: url, con_placa: false });
      save({ diseno: d });
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
            <label className="block text-[10px] font-semibold uppercase text-muted-foreground">Título</label>
            <input defaultValue={titulo} onBlur={(e) => save({ mensaje_clave: e.target.value })} className={`${field} w-full`} />
          </div>
          <div>
            <label className="block text-[10px] font-semibold uppercase text-muted-foreground">Bajada</label>
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
            <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase text-muted-foreground">
              <input type="checkbox" checked={d.on} onChange={(e) => upd({ on: e.target.checked })} /> Logo Drean
            </label>
            <Slider label="X" value={d.logoX * 100} min={0} max={100} step={1} onChange={(n) => upd({ logoX: n / 100 })} fmt={pct} />
            <Slider label="Y" value={d.logoY * 100} min={0} max={100} step={1} onChange={(n) => upd({ logoY: n / 100 })} fmt={pct} />
            <Slider label="T" value={d.logoPct * 100} min={3} max={60} step={1} onChange={(n) => upd({ logoPct: n / 100 })} fmt={pct} />
          </div>
          {/* Texto */}
          <div className="space-y-1 rounded border p-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase text-muted-foreground">Texto</span>
              <div className="flex items-center gap-1">
                {colores.map(([c, n]) => (
                  <button key={c} type="button" onClick={() => upd({ color: c })} className={`h-4 w-4 rounded border ${d.color === c ? "ring-2 ring-primary" : ""}`} style={{ backgroundColor: c }} title={n} />
                ))}
              </div>
            </div>
            <Slider label="X" value={d.textX * 100} min={0} max={100} step={1} onChange={(n) => upd({ textX: n / 100 })} fmt={pct} />
            <Slider label="Y" value={d.textY * 100} min={0} max={100} step={1} onChange={(n) => upd({ textY: n / 100 })} fmt={pct} />
            <Slider label="T" value={d.textPct * 100} min={2} max={20} step={1} onChange={(n) => upd({ textPct: n / 100 })} fmt={pct} />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={componer} disabled={composing || !bgImg} className="rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50">
            {composing ? "Componiendo…" : "Guardar diseño"}
          </button>
          <span className="text-[10px] text-muted-foreground">Quema logo + texto en la imagen final. Después pasá a <b>Biblioteca</b>.</span>
        </div>
      </div>
    </div>
  );
}
