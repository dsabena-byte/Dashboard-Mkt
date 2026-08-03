"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FORMATOS_IMG_PAUTA, type FormatoPauta } from "@/lib/pauta-formatos";

// Adaptación de piezas para pauta (FASE 1: imágenes). Compositor por capas con
// PREVIEW en vivo y config POR FORMATO:
//  - FONDO (imagen sin logo/texto) → reframe al ratio (fal) al generar; en el
//    preview se usa el fondo recortado (cover) como referencia.
//  - LOGO (PNG) → posición (9 puntos) + tamaño (% del alto), por formato.
//  - TEXTO/copy → Manrope, con **negrita**, posición + tamaño (% del alto), color.
// La composición es client-side (canvas): píxeles exactos.

type PosV = "top" | "center" | "bottom";
type PosH = "left" | "center" | "right";
interface Pos { v: PosV; h: PosH }
interface FmtCfg { on: boolean; logoPos: Pos; logoPct: number; textPos: Pos; textPct: number }
interface Word { w: string; bold: boolean }

const PCTS = [0.05, 0.08, 0.1, 0.12, 0.15, 0.2, 0.25, 0.3];
const pctLabel = (p: number) => `${Math.round(p * 100)}%`;
const defaultCfg = (): FmtCfg => ({ on: true, logoPos: { v: "top", h: "left" }, logoPct: 0.1, textPos: { v: "bottom", h: "center" }, textPct: 0.08 });

// ---- Parseo de **negrita** → palabras con flag bold ----
function parseWords(copy: string): Word[] {
  const out: Word[] = [];
  copy.split("**").forEach((seg, i) => { const bold = i % 2 === 1; for (const w of seg.split(/\s+/).filter(Boolean)) out.push({ w, bold }); });
  return out;
}
const fontFor = (bold: boolean, fs: number) => `${bold ? 800 : 500} ${fs}px "Manrope", Arial, sans-serif`;
const xFor = (h: PosH, W: number, ew: number, P: number) => (h === "left" ? P : h === "right" ? W - ew - P : (W - ew) / 2);
const yFor = (v: PosV, H: number, eh: number, P: number) => (v === "top" ? P : v === "bottom" ? H - eh - P : (H - eh) / 2);

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
function drawPieza(ctx: CanvasRenderingContext2D, fondo: HTMLImageElement, logo: HTMLImageElement | null, words: Word[], W: number, H: number, cfg: FmtCfg, color: string) {
  ctx.clearRect(0, 0, W, H);
  coverDraw(ctx, fondo, W, H);
  const P = Math.round(Math.min(W, H) * 0.045);
  if (logo) {
    let lh = H * cfg.logoPct; let lw = lh * (logo.naturalWidth / Math.max(1, logo.naturalHeight));
    if (lw > W - P * 2) { lw = W - P * 2; lh = lw * (logo.naturalHeight / Math.max(1, logo.naturalWidth)); }
    ctx.drawImage(logo, xFor(cfg.logoPos.h, W, lw, P), yFor(cfg.logoPos.v, H, lh, P), lw, lh);
  }
  if (words.length) {
    const fs = Math.round(H * cfg.textPct);
    ctx.fillStyle = color; ctx.textBaseline = "top"; ctx.shadowColor = "rgba(0,0,0,0.5)"; ctx.shadowBlur = fs * 0.22;
    const lines = wrapBold(ctx, words, W - P * 2, fs); const lh = fs * 1.18; const y0 = yFor(cfg.textPos.v, H, lines.length * lh, P);
    lines.forEach((line, i) => {
      let tw = 0; line.forEach((t, j) => { ctx.font = fontFor(t.bold, fs); tw += ctx.measureText(t.w).width + (j ? ctx.measureText(" ").width : 0); });
      let x = xFor(cfg.textPos.h, W, tw, P); const y = y0 + i * lh;
      line.forEach((t, j) => { ctx.font = fontFor(t.bold, fs); if (j) x += ctx.measureText(" ").width; ctx.fillText(t.w, x, y); x += ctx.measureText(t.w).width; });
    });
    ctx.shadowBlur = 0;
  }
}

function PosGrid({ value, onChange }: { value: Pos; onChange: (p: Pos) => void }) {
  const vs: PosV[] = ["top", "center", "bottom"]; const hs: PosH[] = ["left", "center", "right"];
  return (
    <div className="inline-grid grid-cols-3 gap-0.5">
      {vs.map((v) => hs.map((h) => {
        const active = value.v === v && value.h === h;
        return <button key={`${v}-${h}`} type="button" onClick={() => onChange({ v, h })} className={`h-4 w-4 rounded-sm border ${active ? "bg-primary" : "bg-muted hover:bg-secondary"}`} title={`${v} ${h}`} />;
      }))}
    </div>
  );
}

// Preview en vivo por formato: dibuja fondo(cover) + logo + texto a escala chica.
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
  function aplicarATodos(key: string) { const s = cfg[key]; if (!s) return; setCfg((prev) => Object.fromEntries(Object.entries(prev).map(([k, v]) => [k, { ...v, logoPos: s.logoPos, logoPct: s.logoPct, textPos: s.textPos, textPct: s.textPct }]))); }
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

  return (
    <div className="space-y-4">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight">Adaptación de piezas para pauta</h2>
        <p className="text-sm text-muted-foreground">Subí un <strong>fondo</strong> (sin logo ni texto), el <strong>logo</strong> (PNG) y el <strong>copy</strong>. Acomodá posición y tamaño <strong>por formato</strong> con el preview en vivo. Negrita en el copy con <code>**palabra**</code>. Cubre Meta y Demand Gen.</p>
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

      {/* 4 columnas: preview + controles por formato */}
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
                <div className="space-y-1.5 text-[10px]">
                  <div className="flex items-center justify-between gap-1">
                    <span className="w-9 font-semibold uppercase text-muted-foreground">Logo</span>
                    <PosGrid value={c.logoPos} onChange={(p) => upd(f.key, { logoPos: p })} />
                    <select value={c.logoPct} onChange={(e) => upd(f.key, { logoPct: Number(e.target.value) })} className="rounded border px-1 py-0.5 text-[10px]" title="Tamaño (% del alto)">
                      {PCTS.map((p) => <option key={p} value={p}>{pctLabel(p)}</option>)}
                    </select>
                  </div>
                  <div className="flex items-center justify-between gap-1">
                    <span className="w-9 font-semibold uppercase text-muted-foreground">Texto</span>
                    <PosGrid value={c.textPos} onChange={(p) => upd(f.key, { textPos: p })} />
                    <select value={c.textPct} onChange={(e) => upd(f.key, { textPct: Number(e.target.value) })} className="rounded border px-1 py-0.5 text-[10px]" title="Tamaño (% del alto)">
                      {PCTS.map((p) => <option key={p} value={p}>{pctLabel(p)}</option>)}
                    </select>
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
