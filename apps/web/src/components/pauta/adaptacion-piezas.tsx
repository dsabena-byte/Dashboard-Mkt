"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FORMATOS_IMG_PAUTA, type FormatoPauta } from "@/lib/pauta-formatos";
import { AdaptacionVideo } from "@/components/pauta/adaptacion-video";
import { type FmtCfg, type Word, type Trim, defaultCfg, parseWords, computeTrim, loadImg, drawPieza } from "@/lib/pieza-compositor";
import { brandLabel } from "@/lib/demo/anonymize";

// Adaptación de piezas para pauta (FASE 1: imágenes). Compositor por capas con
// PREVIEW FIEL: al subir el fondo se hace el reframe (fal) a cada ratio UNA vez;
// tanto el preview como el resultado usan ese MISMO fondo real, así lo que
// acomodás es exactamente lo que se genera. "Generar" solo compone (instantáneo).
//  - LOGO (PNG) → se auto-recorta el margen transparente; posición X/Y + tamaño.
//  - TEXTO/copy → Manrope, **negrita** / _cursiva_, posición X/Y + tamaño + color.
//  - FRANJA → banda de color arriba/abajo para dar espacio (formatos apretados).

interface BgState { status: "loading" | "ready" | "error"; img?: HTMLImageElement; error?: string }

function Slider({ label, value, min, max, step, onChange, fmt }: { label: string; value: number; min: number; max: number; step: number; onChange: (n: number) => void; fmt: (n: number) => string }) {
  return (
    <label className="flex items-center gap-1">
      <span className="w-3 text-[9px] text-muted-foreground">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="h-1 flex-1 accent-[var(--primary)]" />
      <span className="w-9 text-right text-[9px] tabular-nums text-muted-foreground">{fmt(value)}</span>
    </label>
  );
}

function Preview({ f, cfg, bgImg, status, logo, trim, words, color, bandColor, ready }: { f: FormatoPauta; cfg: FmtCfg; bgImg: HTMLImageElement | null; status: string; logo: HTMLImageElement | null; trim: Trim | null; words: Word[]; color: string; bandColor: string; ready: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const DW = 260; const DH = Math.round(DW * (f.height / f.width));
  useEffect(() => {
    const cv = ref.current; if (!cv) return; const ctx = cv.getContext("2d"); if (!ctx) return;
    ctx.clearRect(0, 0, DW, DH);
    if (bgImg) drawPieza(ctx, bgImg, logo, trim, words, DW, DH, cfg, color, bandColor);
    else { ctx.fillStyle = "#e5e7eb"; ctx.fillRect(0, 0, DW, DH); ctx.fillStyle = "#94a3b8"; ctx.font = "12px sans-serif"; ctx.textAlign = "center"; ctx.fillText(status === "loading" ? "preparando fondo…" : status === "error" ? "error de fondo" : "subí el fondo", DW / 2, DH / 2); ctx.textAlign = "left"; }
  }, [f, cfg, bgImg, status, logo, trim, words, color, bandColor, ready, DW, DH]);
  return <canvas ref={ref} width={DW} height={DH} className="w-full rounded border bg-muted" />;
}

export function AdaptacionPiezas() {
  const [modo, setModo] = useState<"imagen" | "video">("imagen");
  return (
    <div className="space-y-4">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight">Adaptación de piezas para pauta</h2>
        <p className="text-sm text-muted-foreground">Adaptá una pieza a los ratios que pide la pauta con reframe generativo (IA): extiende el encuadre sin deformar el foco.</p>
      </header>

      <div className="flex gap-1 rounded-lg border bg-muted/40 p-1 text-sm">
        <button onClick={() => setModo("imagen")} className={`rounded px-3 py-1 font-medium ${modo === "imagen" ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>Imagen</button>
        <button onClick={() => setModo("video")} className={`rounded px-3 py-1 font-medium ${modo === "video" ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>Video</button>
      </div>

      {modo === "video" ? <AdaptacionVideo /> : <ImagenBody />}
    </div>
  );
}

function ImagenBody() {
  const [bg, setBg] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoImg, setLogoImg] = useState<HTMLImageElement | null>(null);
  const [logoTrim, setLogoTrim] = useState<Trim | null>(null);
  const [bgFmt, setBgFmt] = useState<Record<string, BgState>>({});
  const [copy, setCopy] = useState("");
  const [color, setColor] = useState("#ffffff");
  const [bandColor, setBandColor] = useState("#00064F");
  const [cfg, setCfg] = useState<Record<string, FmtCfg>>(() => Object.fromEntries(FORMATOS_IMG_PAUTA.map((f) => [f.key, defaultCfg()])));
  const [resultados, setResultados] = useState<{ key: string; label: string; url: string | null; error: string | null; loading: boolean }[]>([]);
  const [busy, setBusy] = useState(false);
  const [fontReady, setFontReady] = useState(false);
  const copyRef = useRef<HTMLInputElement>(null);

  useEffect(() => { (async () => { try { await document.fonts.load('800 40px "Manrope"'); await document.fonts.load('500 40px "Manrope"'); } catch { /* */ } setFontReady(true); })(); }, []);
  useEffect(() => { if (!logoUrl) { setLogoImg(null); setLogoTrim(null); return; } (async () => { try { const i = await loadImg(logoUrl); setLogoImg(i); setLogoTrim(computeTrim(i)); } catch { /* */ } })(); }, [logoUrl]);

  // Reframe del fondo a cada ratio, UNA vez, al subir el fondo. Preview + resultado usan esto.
  useEffect(() => {
    if (!bg) { setBgFmt({}); return; }
    let cancel = false;
    setBgFmt(Object.fromEntries(FORMATOS_IMG_PAUTA.map((f) => [f.key, { status: "loading" as const }])));
    FORMATOS_IMG_PAUTA.forEach(async (f) => {
      try {
        const r = await fetch("/api/pauta/adaptar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image_url: bg, width: f.width, height: f.height }) });
        const j = (await r.json()) as { ok?: boolean; url?: string; error?: string };
        if (!j.ok || !j.url) throw new Error(j.error ?? "reframe falló");
        const img = await loadImg(j.url, true);
        if (!cancel) setBgFmt((prev) => ({ ...prev, [f.key]: { status: "ready", img } }));
      } catch (e) { if (!cancel) setBgFmt((prev) => ({ ...prev, [f.key]: { status: "error", error: e instanceof Error ? e.message : String(e) } })); }
    });
    return () => { cancel = true; };
  }, [bg]);

  const words = useMemo(() => parseWords(copy), [copy]);
  function onFile(file: File | undefined, set: (v: string) => void) { if (!file) return; const r = new FileReader(); r.onload = () => set(String(r.result)); r.readAsDataURL(file); }
  function upd(key: string, patch: Partial<FmtCfg>) { setCfg((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } as FmtCfg })); }
  function aplicarATodos(key: string) { const s = cfg[key]; if (!s) return; setCfg((prev) => Object.fromEntries(Object.entries(prev).map(([k, v]) => [k, { ...v, logoX: s.logoX, logoY: s.logoY, logoPct: s.logoPct, textX: s.textX, textY: s.textY, textPct: s.textPct, bandPct: s.bandPct }]))); }
  function mark(sym: string) {
    const el = copyRef.current; const s = el?.selectionStart ?? copy.length; const e = el?.selectionEnd ?? copy.length;
    const sel = copy.slice(s, e) || "texto"; setCopy(copy.slice(0, s) + sym + sel + sym + copy.slice(e));
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(s + sym.length, s + sym.length + sel.length); });
  }
  const seleccionados = FORMATOS_IMG_PAUTA.filter((f) => cfg[f.key]?.on);
  const listos = seleccionados.length > 0 && seleccionados.every((f) => bgFmt[f.key]?.status === "ready");

  async function adaptar() {
    if (!listos) return;
    setBusy(true);
    setResultados(seleccionados.map((f) => ({ key: f.key, label: f.label, url: null, error: null, loading: true })));
    for (const f of seleccionados) {
      const c = cfg[f.key]!; const bgImg = bgFmt[f.key]?.img;
      try {
        if (!bgImg) throw new Error("fondo no listo");
        const canvas = document.createElement("canvas"); canvas.width = f.width; canvas.height = f.height;
        const ctx = canvas.getContext("2d"); if (!ctx) throw new Error("ctx");
        drawPieza(ctx, bgImg, logoImg, logoTrim, words, f.width, f.height, c, color, bandColor);
        const blob = await new Promise<Blob | null>((rr) => canvas.toBlob(rr, "image/png"));
        if (!blob) throw new Error("toBlob");
        setResultados((prev) => prev.map((x) => x.key === f.key ? { ...x, loading: false, url: URL.createObjectURL(blob) } : x));
      } catch (e) { setResultados((prev) => prev.map((x) => x.key === f.key ? { ...x, loading: false, error: e instanceof Error ? e.message : String(e) } : x)); }
    }
    setBusy(false);
  }

  const pct = (n: number) => `${Math.round(n)}%`;
  const prep = FORMATOS_IMG_PAUTA.some((f) => bgFmt[f.key]?.status === "loading");

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border bg-card p-4">
          <label className="text-xs font-semibold uppercase text-muted-foreground">Fondo (imagen, sin logo ni texto)</label>
          <input type="file" accept="image/*" onChange={(e) => onFile(e.target.files?.[0], setBg)} className="mt-2 block text-xs" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {bg && <img src={bg} alt="fondo" className="mt-2 max-h-24 w-auto rounded border" />}
          {prep && <p className="mt-1 text-[11px] text-amber-600">Preparando fondos con IA a cada ratio… (unos segundos)</p>}
        </div>
        <div className="rounded-lg border bg-card p-4">
          <label className="text-xs font-semibold uppercase text-muted-foreground">Logo (PNG transparente)</label>
          <input type="file" accept="image/png,image/webp" onChange={(e) => onFile(e.target.files?.[0], setLogoUrl)} className="mt-2 block text-xs" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {logoUrl && <img src={logoUrl} alt="logo" className="mt-2 max-h-12 w-auto rounded border bg-neutral-300 p-1" />}
        </div>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <label className="text-xs font-semibold uppercase text-muted-foreground">Texto / copy (opcional)</label>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => mark("**")} className="rounded border px-2 py-1 text-xs hover:bg-secondary" title="Negrita: seleccioná texto y tocá N"><b>N</b></button>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => mark("_")} className="rounded border px-2 py-1 text-xs hover:bg-secondary" title="Cursiva: seleccioná texto y tocá C"><i>C</i></button>
          <input ref={copyRef} value={copy} onChange={(e) => setCopy(e.target.value)} placeholder="Ej: Diseñada para el mundo" className="flex-1 min-w-[200px] rounded border px-2 py-1 text-xs" />
          <span className="text-[10px] text-muted-foreground">color texto</span>
          {([["#ffffff", "blanco"], ["#00064F", "azul Drean"], ["#111111", "negro"]] as const).map(([c, n]) => (
            <button key={c} type="button" onClick={() => setColor(c)} className={`h-5 w-5 rounded border ${color === c ? "ring-2 ring-primary" : ""}`} style={{ backgroundColor: c }} title={n.replace(/Drean/g, brandLabel("Drean"))} />
          ))}
          <span className="ml-1 text-[10px] text-muted-foreground">franja</span>
          {([["#00064F", "azul Drean"], ["#000000", "negro"], ["#ffffff", "blanco"]] as const).map(([c, n]) => (
            <button key={c} type="button" onClick={() => setBandColor(c)} className={`h-5 w-5 rounded border ${bandColor === c ? "ring-2 ring-primary" : ""}`} style={{ backgroundColor: c }} title={n.replace(/Drean/g, brandLabel("Drean"))} />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {FORMATOS_IMG_PAUTA.map((f) => {
          const c = cfg[f.key]!; const st = bgFmt[f.key];
          return (
            <div key={f.key} className={`flex flex-col gap-2 rounded-lg border p-2 ${c.on ? "bg-card" : "bg-muted/40 opacity-70"}`}>
              <label className="flex items-center gap-1.5 text-[12px] font-medium">
                <input type="checkbox" checked={c.on} onChange={(e) => upd(f.key, { on: e.target.checked })} />
                {f.label} <span className="text-[10px] text-muted-foreground">{f.width}×{f.height}</span>
              </label>
              <Preview f={f} cfg={c} bgImg={st?.img ?? null} status={st?.status ?? "empty"} logo={logoImg} trim={logoTrim} words={words} color={color} bandColor={bandColor} ready={fontReady} />
              {c.on && (
                <div className="space-y-2 text-[10px]">
                  <div className="space-y-0.5 rounded border p-1.5">
                    <div className="text-[9px] font-semibold uppercase text-muted-foreground">Logo</div>
                    <Slider label="X" value={c.logoX * 100} min={0} max={100} step={1} onChange={(n) => upd(f.key, { logoX: n / 100 })} fmt={pct} />
                    <Slider label="Y" value={c.logoY * 100} min={0} max={100} step={1} onChange={(n) => upd(f.key, { logoY: n / 100 })} fmt={pct} />
                    <Slider label="T" value={c.logoPct * 100} min={2} max={100} step={1} onChange={(n) => upd(f.key, { logoPct: n / 100 })} fmt={pct} />
                  </div>
                  <div className="space-y-0.5 rounded border p-1.5">
                    <div className="text-[9px] font-semibold uppercase text-muted-foreground">Texto</div>
                    <Slider label="X" value={c.textX * 100} min={0} max={100} step={1} onChange={(n) => upd(f.key, { textX: n / 100 })} fmt={pct} />
                    <Slider label="Y" value={c.textY * 100} min={0} max={100} step={1} onChange={(n) => upd(f.key, { textY: n / 100 })} fmt={pct} />
                    <Slider label="T" value={c.textPct * 100} min={2} max={40} step={1} onChange={(n) => upd(f.key, { textPct: n / 100 })} fmt={pct} />
                  </div>
                  <div className="rounded border p-1.5">
                    <Slider label="F" value={c.bandPct * 100} min={0} max={35} step={1} onChange={(n) => upd(f.key, { bandPct: n / 100 })} fmt={(v) => v < 1 ? "sin franja" : pct(v)} />
                  </div>
                  <button type="button" onClick={() => aplicarATodos(f.key)} className="text-[10px] font-medium text-primary hover:underline">aplicar esta config a todos →</button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div>
        <button onClick={adaptar} disabled={busy || !listos} className="rounded bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50">{busy ? "Generando…" : `Generar (${seleccionados.length})`}</button>
        {!bg && <span className="ml-2 text-[11px] text-muted-foreground">Subí el fondo para empezar.</span>}
        {bg && !listos && !busy && <span className="ml-2 text-[11px] text-amber-600">Esperá a que se preparen los fondos.</span>}
        <span className="ml-3 text-[11px] text-muted-foreground">Descargá cada pieza. Es idéntica al preview.</span>
      </div>

      {resultados.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {resultados.map((r) => (
            <div key={r.key} className="flex flex-col gap-1 rounded-lg border bg-card p-2">
              <span className="text-[11px] font-medium">{r.label}</span>
              {r.loading && <div className="flex aspect-square items-center justify-center rounded bg-muted text-[11px] text-muted-foreground">componiendo…</div>}
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
