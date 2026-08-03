"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FORMATOS_IMG_PAUTA, type FormatoPauta } from "@/lib/pauta-formatos";

// Adaptación de piezas para pauta (FASE 1: imágenes). Compositor por capas con
// PREVIEW en vivo y control FINO por formato:
//  - FONDO (imagen sin logo/texto) → reframe al ratio (fal) al generar; en el
//    preview se usa el fondo recortado (cover) como referencia.
//  - LOGO (PNG) → posición libre X/Y (%) + tamaño (% del alto), por formato.
//  - TEXTO/copy → Manrope, con **negrita**, posición X/Y (%) + tamaño (%) + color.
// Composición client-side (canvas): píxeles exactos.

interface FmtCfg { on: boolean; logoX: number; logoY: number; logoPct: number; textX: number; textY: number; textPct: number }
interface Word { w: string; bold: boolean }

// x/y en [0,1] (fracción del lienzo). pct = tamaño como fracción del ALTO.
const defaultCfg = (): FmtCfg => ({ on: true, logoX: 0, logoY: 0, logoPct: 0.12, textX: 0.5, textY: 1, textPct: 0.08 });

function parseWords(copy: string): Word[] {
  const out: Word[] = [];
  copy.split("**").forEach((seg, i) => { const bold = i % 2 === 1; for (const w of seg.split(/\s+/).filter(Boolean)) out.push({ w, bold }); });
  return out;
}
const fontFor = (bold: boolean, fs: number) => `${bold ? 800 : 500} ${fs}px "Manrope", Arial, sans-serif`;
function place(frac: number, span: number, size: number, P: number): number {
  const lo = P, hi = span - size - P;
  if (hi <= lo) return (span - size) / 2; // sin espacio → centrar
  return lo + Math.max(0, Math.min(1, frac)) * (hi - lo);
}
function coverDraw(ctx: CanvasRenderingContext2D, img: HTMLImageElement, W: number, H: number) {
  const ir = img.naturalWidth / img.naturalHeight, cr = W / H;
  let sw: number, sh: number, sx: number, sy: number;
  if (ir > cr) { sh = img.naturalHeight; sw = sh * cr; sx = (img.naturalWidth - sw) / 2; sy = 0; }
  else { sw = img.naturalWidth; sh = sw / cr; sx = 0; sy = (img.naturalHeight - sh) / 2; }
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, W, H);
}
function wrapBold(ctx: CanvasRenderingContext2D, words: Word[], maxW: number, fs: number): Word[][] {
  const lines: Word[][] = []; let line: Word[] = []; let lineW = 0;
  for (const tok of words) {
    ctx.font = fontFor(tok.bold, fs);
    const ww = ctx.measureText(tok.w).width;
    const add = (line.length ? ctx.measureText(" ").width : 0) + ww;
    if (lineW + add > maxW && line.length) { lines.push(line); line = [tok]; lineW = ww; }
    else { line.push(tok); lineW += add; }
  }
  if (line.length) lines.push(line);
  return lines;
}
function lineWidth(ctx: CanvasRenderingContext2D, line: Word[], fs: number): number {
  let w = 0; line.forEach((t, j) => { ctx.font = fontFor(t.bold, fs); w += ctx.measureText(t.w).width + (j ? ctx.measureText(" ").width : 0); }); return w;
}
function drawPieza(ctx: CanvasRenderingContext2D, fondo: HTMLImageElement, logo: HTMLImageElement | null, words: Word[], W: number, H: number, c: FmtCfg, color: string) {
  ctx.clearRect(0, 0, W, H);
  coverDraw(ctx, fondo, W, H);
  const P = Math.round(Math.min(W, H) * 0.035);
  if (logo) {
    let lh = H * c.logoPct; let lw = lh * (logo.naturalWidth / Math.max(1, logo.naturalHeight));
    if (lw > W - P * 2) { lw = W - P * 2; lh = lw * (logo.naturalHeight / Math.max(1, logo.naturalWidth)); }
    ctx.drawImage(logo, place(c.logoX, W, lw, P), place(c.logoY, H, lh, P), lw, lh);
  }
  if (words.length) {
    const fs = Math.max(8, Math.round(H * c.textPct));
    ctx.textBaseline = "top"; ctx.fillStyle = color; ctx.shadowColor = "rgba(0,0,0,0.55)"; ctx.shadowBlur = fs * 0.22;
    const lines = wrapBold(ctx, words, W - P * 2, fs);
    const lh = fs * 1.18; const blockH = lines.length * lh;
    const blockW = Math.max(...lines.map((l) => lineWidth(ctx, l, fs)));
    const bx = place(c.textX, W, blockW, P); const by = place(c.textY, H, blockH, P);
    lines.forEach((line, i) => {
      let x = bx; const y = by + i * lh;
      line.forEach((t, j) => { ctx.font = fontFor(t.bold, fs); if (j) x += ctx.measureText(" ").width; ctx.fillText(t.w, x, y); x += ctx.measureText(t.w).width; });
    });
    ctx.shadowBlur = 0;
  }
}

function Slider({ label, value, min, max, step, onChange, fmt }: { label: string; value: number; min: number; max: number; step: number; onChange: (n: number) => void; fmt: (n: number) => string }) {
  return (
    <label className="flex items-center gap-1">
      <span className="w-3 text-[9px] text-muted-foreground">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="h-1 flex-1 accent-[var(--primary)]" />
      <span className="w-9 text-right text-[9px] tabular-nums text-muted-foreground">{fmt(value)}</span>
    </label>
  );
}

function Preview({ f, cfg, fondo, logo, words, color, ready }: { f: FormatoPauta; cfg: FmtCfg; fondo: HTMLImageElement | null; logo: HTMLImageElement | null; words: Word[]; color: string; ready: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const DW = 260; const DH = Math.round(DW * (f.height / f.width));
  useEffect(() => {
    const cv = ref.current; if (!cv) return; const ctx = cv.getContext("2d"); if (!ctx) return;
    if (!fondo) { ctx.clearRect(0, 0, DW, DH); ctx.fillStyle = "#e5e7eb"; ctx.fillRect(0, 0, DW, DH); return; }
    drawPieza(ctx, fondo, logo, words, DW, DH, cfg, color);
  }, [f, cfg, fondo, logo, words, color, ready, DW, DH]);
  return <canvas ref={ref} width={DW} height={DH} className="w-full rounded border bg-muted" />;
}

export function AdaptacionPiezas() {
  const [bg, setBg] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [fondoImg, setFondoImg] = useState<HTMLImageElement | null>(null);
  const [logoImg, setLogoImg] = useState<HTMLImageElement | null>(null);
  const [copy, setCopy] = useState("");
  const [color, setColor] = useState("#ffffff");
  const [cfg, setCfg] = useState<Record<string, FmtCfg>>(() => Object.fromEntries(FORMATOS_IMG_PAUTA.map((f) => [f.key, defaultCfg()])));
  const [resultados, setResultados] = useState<{ key: string; label: string; url: string | null; error: string | null; loading: boolean }[]>([]);
  const [busy, setBusy] = useState(false);
  const [fontReady, setFontReady] = useState(false);

  useEffect(() => { (async () => { try { await document.fonts.load('800 40px "Manrope"'); await document.fonts.load('500 40px "Manrope"'); } catch { /* */ } setFontReady(true); })(); }, []);
  useEffect(() => { if (!bg) { setFondoImg(null); return; } const i = new Image(); i.onload = () => setFondoImg(i); i.src = bg; }, [bg]);
  useEffect(() => { if (!logoUrl) { setLogoImg(null); return; } const i = new Image(); i.onload = () => setLogoImg(i); i.src = logoUrl; }, [logoUrl]);

  const words = useMemo(() => parseWords(copy), [copy]);
  function onFile(file: File | undefined, set: (v: string) => void) { if (!file) return; const r = new FileReader(); r.onload = () => set(String(r.result)); r.readAsDataURL(file); }
  function upd(key: string, patch: Partial<FmtCfg>) { setCfg((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } as FmtCfg })); }
  function aplicarATodos(key: string) { const s = cfg[key]; if (!s) return; setCfg((prev) => Object.fromEntries(Object.entries(prev).map(([k, v]) => [k, { ...v, logoX: s.logoX, logoY: s.logoY, logoPct: s.logoPct, textX: s.textX, textY: s.textY, textPct: s.textPct }]))); }
  const seleccionados = FORMATOS_IMG_PAUTA.filter((f) => cfg[f.key]?.on);

  async function adaptar() {
    if (!bg || seleccionados.length === 0) return;
    setBusy(true);
    setResultados(seleccionados.map((f) => ({ key: f.key, label: f.label, url: null, error: null, loading: true })));
    await Promise.all(seleccionados.map(async (f) => {
      const c = cfg[f.key]!;
      try {
        const r = await fetch("/api/pauta/adaptar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image_url: bg, width: f.width, height: f.height }) });
        const j = (await r.json()) as { ok?: boolean; url?: string; error?: string };
        if (!j.ok || !j.url) throw new Error(j.error ?? "reframe falló");
        const bgImg = await new Promise<HTMLImageElement>((res, rej) => { const im = new Image(); im.crossOrigin = "anonymous"; im.onload = () => res(im); im.onerror = () => rej(new Error("bg")); im.src = j.url!; });
        const canvas = document.createElement("canvas"); canvas.width = f.width; canvas.height = f.height;
        const ctx = canvas.getContext("2d"); if (!ctx) throw new Error("ctx");
        drawPieza(ctx, bgImg, logoImg, words, f.width, f.height, c, color);
        const blob = await new Promise<Blob | null>((rr) => canvas.toBlob(rr, "image/png"));
        if (!blob) throw new Error("toBlob");
        setResultados((prev) => prev.map((x) => x.key === f.key ? { ...x, loading: false, url: URL.createObjectURL(blob) } : x));
      } catch (e) {
        setResultados((prev) => prev.map((x) => x.key === f.key ? { ...x, loading: false, error: e instanceof Error ? e.message : String(e) } : x));
      }
    }));
    setBusy(false);
  }

  const pct = (n: number) => `${Math.round(n)}%`;

  return (
    <div className="space-y-4">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight">Adaptación de piezas para pauta</h2>
        <p className="text-sm text-muted-foreground">Subí un <strong>fondo</strong> (sin logo ni texto), el <strong>logo</strong> (PNG) y el <strong>copy</strong>. Acomodá logo y texto <strong>por formato</strong> con sliders de <strong>posición (X/Y)</strong> y <strong>tamaño</strong>, viendo el preview en vivo. Negrita con <code>**palabra**</code>.</p>
      </header>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border bg-card p-4">
          <label className="text-xs font-semibold uppercase text-muted-foreground">Fondo (imagen, sin logo ni texto)</label>
          <input type="file" accept="image/*" onChange={(e) => onFile(e.target.files?.[0], setBg)} className="mt-2 block text-xs" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {bg && <img src={bg} alt="fondo" className="mt-2 max-h-28 w-auto rounded border" />}
        </div>
        <div className="rounded-lg border bg-card p-4">
          <label className="text-xs font-semibold uppercase text-muted-foreground">Logo (PNG transparente)</label>
          <input type="file" accept="image/png,image/webp" onChange={(e) => onFile(e.target.files?.[0], setLogoUrl)} className="mt-2 block text-xs" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {logoUrl && <img src={logoUrl} alt="logo" className="mt-2 max-h-12 w-auto rounded border bg-neutral-300 p-1" />}
        </div>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <label className="text-xs font-semibold uppercase text-muted-foreground">Texto / copy (opcional · usá **texto** para negrita)</label>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input value={copy} onChange={(e) => setCopy(e.target.value)} placeholder="Ej: **Diseñada** para el mundo" className="flex-1 min-w-[220px] rounded border px-2 py-1 text-xs" />
          <span className="text-[10px] text-muted-foreground">color</span>
          {([["#ffffff", "blanco"], ["#00064F", "azul Drean"], ["#111111", "negro"]] as const).map(([c, n]) => (
            <button key={c} type="button" onClick={() => setColor(c)} className={`h-5 w-5 rounded border ${color === c ? "ring-2 ring-primary" : ""}`} style={{ backgroundColor: c }} title={n} />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {FORMATOS_IMG_PAUTA.map((f) => {
          const c = cfg[f.key]!;
          return (
            <div key={f.key} className={`flex flex-col gap-2 rounded-lg border p-2 ${c.on ? "bg-card" : "bg-muted/40 opacity-70"}`}>
              <label className="flex items-center gap-1.5 text-[12px] font-medium">
                <input type="checkbox" checked={c.on} onChange={(e) => upd(f.key, { on: e.target.checked })} />
                {f.label} <span className="text-[10px] text-muted-foreground">{f.width}×{f.height}</span>
              </label>
              <Preview f={f} cfg={c} fondo={fondoImg} logo={logoImg} words={words} color={color} ready={fontReady} />
              {c.on && (
                <div className="space-y-2 text-[10px]">
                  <div className="space-y-0.5 rounded border p-1.5">
                    <div className="text-[9px] font-semibold uppercase text-muted-foreground">Logo</div>
                    <Slider label="X" value={c.logoX * 100} min={0} max={100} step={1} onChange={(n) => upd(f.key, { logoX: n / 100 })} fmt={pct} />
                    <Slider label="Y" value={c.logoY * 100} min={0} max={100} step={1} onChange={(n) => upd(f.key, { logoY: n / 100 })} fmt={pct} />
                    <Slider label="T" value={c.logoPct * 100} min={2} max={60} step={1} onChange={(n) => upd(f.key, { logoPct: n / 100 })} fmt={pct} />
                  </div>
                  <div className="space-y-0.5 rounded border p-1.5">
                    <div className="text-[9px] font-semibold uppercase text-muted-foreground">Texto</div>
                    <Slider label="X" value={c.textX * 100} min={0} max={100} step={1} onChange={(n) => upd(f.key, { textX: n / 100 })} fmt={pct} />
                    <Slider label="Y" value={c.textY * 100} min={0} max={100} step={1} onChange={(n) => upd(f.key, { textY: n / 100 })} fmt={pct} />
                    <Slider label="T" value={c.textPct * 100} min={2} max={40} step={1} onChange={(n) => upd(f.key, { textPct: n / 100 })} fmt={pct} />
                  </div>
                  <button type="button" onClick={() => aplicarATodos(f.key)} className="text-[10px] font-medium text-primary hover:underline">aplicar esta config a todos →</button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div>
        <button onClick={adaptar} disabled={busy || !bg || seleccionados.length === 0} className="rounded bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50">{busy ? "Generando…" : `Generar (${seleccionados.length})`}</button>
        {!bg && <span className="ml-2 text-[11px] text-muted-foreground">Subí el fondo para habilitar.</span>}
        <span className="ml-3 text-[11px] text-muted-foreground">El preview usa el fondo recortado; al generar, el fondo se extiende con IA (reframe) al ratio real.</span>
      </div>

      {resultados.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {resultados.map((r) => (
            <div key={r.key} className="flex flex-col gap-1 rounded-lg border bg-card p-2">
              <span className="text-[11px] font-medium">{r.label}</span>
              {r.loading && <div className="flex aspect-square items-center justify-center rounded bg-muted text-[11px] text-muted-foreground">generando…</div>}
              {r.error && <div className="rounded bg-red-50 p-2 text-[10px] text-red-700">{r.error}</div>}
              {r.url && (<>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={r.url} alt={r.label} className="w-full rounded border object-contain" />
                <a href={r.url} download={`pieza-${r.key}.png`} className="rounded border px-2 py-1 text-center text-[10px] font-medium hover:bg-secondary">Descargar</a>
              </>)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
