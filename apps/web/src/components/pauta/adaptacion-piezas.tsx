"use client";

import { useState } from "react";
import { FORMATOS_IMG_PAUTA } from "@/lib/pauta-formatos";

// Adaptación de piezas para pauta (FASE 1: imágenes). Compositor por capas:
//  1) FONDO (imagen sin logo/texto) → se adapta a cada ratio con reframe (fal).
//  2) LOGO (PNG transparente) → posición + tamaño, POR FORMATO.
//  3) TEXTO/copy → Manrope, posición + tamaño POR FORMATO (+ color global).
// Composición client-side (canvas): píxeles exactos, control total.

type PosV = "top" | "center" | "bottom";
type PosH = "left" | "center" | "right";
interface Pos { v: PosV; h: PosH }
interface FmtCfg { on: boolean; logoPos: Pos; logoSize: number; textPos: Pos; textSize: number }

const SIZES = [{ k: "chico", m: 0.6 }, { k: "igual", m: 1 }, { k: "x2", m: 2 }, { k: "x3", m: 3 }] as const;
const defaultCfg = (): FmtCfg => ({ on: true, logoPos: { v: "top", h: "left" }, logoSize: 1, textPos: { v: "bottom", h: "center" }, textSize: 1 });

interface Resultado { key: string; label: string; width: number; height: number; url: string | null; error: string | null; loading: boolean }

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => { const i = new Image(); i.crossOrigin = "anonymous"; i.onload = () => res(i); i.onerror = () => rej(new Error("no se pudo cargar imagen")); i.src = src; });
}
function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(/\s+/).filter(Boolean); const lines: string[] = []; let cur = "";
  for (const w of words) { const t = cur ? `${cur} ${w}` : w; if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; }
  if (cur) lines.push(cur); return lines;
}
function xFor(h: PosH, W: number, ew: number, P: number): number { return h === "left" ? P : h === "right" ? W - ew - P : (W - ew) / 2; }
function yFor(v: PosV, H: number, eh: number, P: number): number { return v === "top" ? P : v === "bottom" ? H - eh - P : (H - eh) / 2; }

async function componer(bgUrl: string, logoUrl: string | null, texto: string, W: number, H: number, o: { logoPos: Pos; logoSize: number; textPos: Pos; textSize: number; textColor: string }): Promise<Blob> {
  const canvas = document.createElement("canvas"); canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d"); if (!ctx) throw new Error("ctx");
  const bg = await loadImg(bgUrl);
  ctx.drawImage(bg, 0, 0, W, H);
  const P = Math.round(W * 0.04);
  if (logoUrl) {
    const logo = await loadImg(logoUrl);
    const lw = Math.min(W * 0.7, W * 0.16 * o.logoSize);
    const lh = lw * (logo.naturalHeight / Math.max(1, logo.naturalWidth));
    ctx.drawImage(logo, xFor(o.logoPos.h, W, lw, P), yFor(o.logoPos.v, H, lh, P), lw, lh);
  }
  if (texto.trim()) {
    const fs = Math.round(W * 0.045 * o.textSize);
    try { await document.fonts.load(`800 ${fs}px Manrope`); } catch { /* fallback */ }
    ctx.font = `800 ${fs}px "Manrope", Arial, sans-serif`;
    ctx.fillStyle = o.textColor; ctx.textBaseline = "top";
    ctx.shadowColor = "rgba(0,0,0,0.45)"; ctx.shadowBlur = fs * 0.25;
    const maxW = W - P * 2; const lines = wrap(ctx, texto, maxW); const lh = fs * 1.2; const blockH = lines.length * lh;
    const y0 = yFor(o.textPos.v, H, blockH, P);
    lines.forEach((ln, i) => { const w = ctx.measureText(ln).width; ctx.fillText(ln, xFor(o.textPos.h, W, w, P), y0 + i * lh); });
    ctx.shadowBlur = 0;
  }
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
  if (!blob) throw new Error("toBlob"); return blob;
}

function GrillaPos({ value, onChange }: { value: Pos; onChange: (p: Pos) => void }) {
  const vs: PosV[] = ["top", "center", "bottom"]; const hs: PosH[] = ["left", "center", "right"];
  return (
    <div className="inline-grid grid-cols-3 gap-0.5">
      {vs.map((v) => hs.map((h) => {
        const active = value.v === v && value.h === h;
        return <button key={`${v}-${h}`} type="button" onClick={() => onChange({ v, h })} className={`h-5 w-5 rounded-sm border ${active ? "bg-primary" : "bg-muted hover:bg-secondary"}`} title={`${v} ${h}`} />;
      }))}
    </div>
  );
}

function Capa({ label, pos, setPos, size, setSize }: { label: string; pos: Pos; setPos: (p: Pos) => void; size: number; setSize: (n: number) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded border p-2">
      <span className="w-12 text-[11px] font-semibold uppercase text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1"><span className="text-[10px] text-muted-foreground">pos.</span><GrillaPos value={pos} onChange={setPos} /></div>
      <div className="flex items-center gap-1">
        <span className="text-[10px] text-muted-foreground">tamaño</span>
        {SIZES.map((s) => <button key={s.k} type="button" onClick={() => setSize(s.m)} className={`rounded border px-2 py-0.5 text-[10px] ${size === s.m ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}>{s.k}</button>)}
      </div>
    </div>
  );
}

export function AdaptacionPiezas() {
  const [bg, setBg] = useState<string | null>(null);
  const [logo, setLogo] = useState<string | null>(null);
  const [texto, setTexto] = useState("");
  const [textColor, setTextColor] = useState("#ffffff");
  const [cfg, setCfg] = useState<Record<string, FmtCfg>>(() => Object.fromEntries(FORMATOS_IMG_PAUTA.map((f) => [f.key, defaultCfg()])));
  const [resultados, setResultados] = useState<Resultado[]>([]);
  const [busy, setBusy] = useState(false);

  function onFile(file: File | undefined, set: (v: string) => void) { if (!file) return; const r = new FileReader(); r.onload = () => set(String(r.result)); r.readAsDataURL(file); }
  function upd(key: string, patch: Partial<FmtCfg>) { setCfg((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } as FmtCfg })); }
  function aplicarATodos(key: string) { const src = cfg[key]; if (!src) return; setCfg((prev) => Object.fromEntries(Object.entries(prev).map(([k, v]) => [k, { ...v, logoPos: src.logoPos, logoSize: src.logoSize, textPos: src.textPos, textSize: src.textSize }]))); }

  const seleccionados = FORMATOS_IMG_PAUTA.filter((f) => cfg[f.key]?.on);

  async function adaptar() {
    if (!bg || seleccionados.length === 0) return;
    setBusy(true);
    setResultados(seleccionados.map((f) => ({ key: f.key, label: f.label, width: f.width, height: f.height, url: null, error: null, loading: true })));
    await Promise.all(seleccionados.map(async (f) => {
      const c = cfg[f.key]!;
      try {
        const r = await fetch("/api/pauta/adaptar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image_url: bg, width: f.width, height: f.height }) });
        const j = (await r.json()) as { ok?: boolean; url?: string; error?: string };
        if (!j.ok || !j.url) throw new Error(j.error ?? "reframe falló");
        const blob = await componer(j.url, logo, texto, f.width, f.height, { logoPos: c.logoPos, logoSize: c.logoSize, textPos: c.textPos, textSize: c.textSize, textColor });
        const url = URL.createObjectURL(blob);
        setResultados((prev) => prev.map((x) => x.key === f.key ? { ...x, loading: false, url } : x));
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
        <p className="text-sm text-muted-foreground">Compositor por capas: <strong>fondo</strong> (imagen sin logo ni texto) adaptado a cada ratio + <strong>logo</strong> (PNG) + <strong>texto</strong>, con posición y tamaño <strong>configurables por formato</strong>. Cubre Meta y Demand Gen. Video en la próxima fase.</p>
      </header>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border bg-card p-4">
          <label className="text-xs font-semibold uppercase text-muted-foreground">Fondo (imagen, sin logo ni texto)</label>
          <input type="file" accept="image/*" onChange={(e) => onFile(e.target.files?.[0], setBg)} className="mt-2 block text-xs" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {bg && <img src={bg} alt="fondo" className="mt-2 max-h-40 w-auto rounded border" />}
        </div>
        <div className="rounded-lg border bg-card p-4">
          <label className="text-xs font-semibold uppercase text-muted-foreground">Logo (PNG transparente)</label>
          <input type="file" accept="image/png,image/webp" onChange={(e) => onFile(e.target.files?.[0], setLogo)} className="mt-2 block text-xs" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {logo && <img src={logo} alt="logo" className="mt-2 max-h-16 w-auto rounded border bg-neutral-200 p-1" />}
        </div>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <label className="text-xs font-semibold uppercase text-muted-foreground">Texto / copy (opcional)</label>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Ej: Diseñada para el mundo" className="flex-1 min-w-[220px] rounded border px-2 py-1 text-xs" />
          <span className="text-[10px] text-muted-foreground">color</span>
          {([["#ffffff", "blanco"], ["#00064F", "azul Drean"], ["#111111", "negro"]] as const).map(([c, n]) => (
            <button key={c} type="button" onClick={() => setTextColor(c)} className={`h-5 w-5 rounded border ${textColor === c ? "ring-2 ring-primary" : ""}`} style={{ backgroundColor: c }} title={n} />
          ))}
        </div>
      </div>

      {/* Config POR FORMATO */}
      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase text-muted-foreground">Formatos — posición y tamaño por formato</label>
        {FORMATOS_IMG_PAUTA.map((f) => {
          const c = cfg[f.key]!;
          return (
            <div key={f.key} className={`rounded-lg border p-3 ${c.on ? "bg-card" : "bg-muted/40 opacity-70"}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input type="checkbox" checked={c.on} onChange={(e) => upd(f.key, { on: e.target.checked })} />
                  {f.label} <span className="text-[11px] text-muted-foreground">({f.width}×{f.height} · {f.usos})</span>
                </label>
                {c.on && <button type="button" onClick={() => aplicarATodos(f.key)} className="text-[10px] font-medium text-primary hover:underline" title="Copiar esta config de logo/texto a todos los formatos">aplicar a todos →</button>}
              </div>
              {c.on && (
                <div className="mt-2 space-y-2">
                  <Capa label="Logo" pos={c.logoPos} setPos={(p) => upd(f.key, { logoPos: p })} size={c.logoSize} setSize={(s) => upd(f.key, { logoSize: s })} />
                  <Capa label="Texto" pos={c.textPos} setPos={(p) => upd(f.key, { textPos: p })} size={c.textSize} setSize={(s) => upd(f.key, { textSize: s })} />
                </div>
              )}
            </div>
          );
        })}
        <button onClick={adaptar} disabled={busy || !bg || seleccionados.length === 0} className="rounded bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50">{busy ? "Generando…" : `Generar (${seleccionados.length})`}</button>
        {!bg && <span className="ml-2 text-[11px] text-muted-foreground">Subí el fondo para habilitar.</span>}
      </div>

      {resultados.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {resultados.map((r) => (
            <div key={r.key} className="flex flex-col gap-1 rounded-lg border bg-card p-2">
              <span className="text-[11px] font-medium">{r.label} · {r.width}×{r.height}</span>
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
