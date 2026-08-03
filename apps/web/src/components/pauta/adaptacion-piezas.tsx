"use client";

import { useState } from "react";
import { FORMATOS_IMG_PAUTA, type FormatoPauta } from "@/lib/pauta-formatos";

// Adaptación de piezas para pauta (FASE 1: imágenes). Subís una imagen de
// referencia y el sistema la adapta a los ratios core (1:1, 4:5, 9:16, 1.91:1)
// con outpainting generativo (Ideogram v3 Reframe). Video: fase 2.

interface Resultado { key: string; label: string; width: number; height: number; url: string | null; error: string | null; loading: boolean }

export function AdaptacionPiezas() {
  const [srcDataUrl, setSrcDataUrl] = useState<string | null>(null);
  const [srcName, setSrcName] = useState<string>("");
  const [sel, setSel] = useState<Set<string>>(new Set(FORMATOS_IMG_PAUTA.map((f) => f.key)));
  const [resultados, setResultados] = useState<Resultado[]>([]);
  const [busy, setBusy] = useState(false);

  function onFile(file: File | undefined) {
    if (!file) return;
    setResultados([]);
    setSrcName(file.name);
    const reader = new FileReader();
    reader.onload = () => setSrcDataUrl(String(reader.result));
    reader.readAsDataURL(file);
  }

  const toggle = (k: string) => setSel((prev) => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n; });

  async function adaptar() {
    if (!srcDataUrl) return;
    const formatos = FORMATOS_IMG_PAUTA.filter((f) => sel.has(f.key));
    if (formatos.length === 0) return;
    setBusy(true);
    setResultados(formatos.map((f) => ({ key: f.key, label: f.label, width: f.width, height: f.height, url: null, error: null, loading: true })));
    await Promise.all(formatos.map(async (f: FormatoPauta) => {
      try {
        const r = await fetch("/api/pauta/adaptar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image_url: srcDataUrl, width: f.width, height: f.height }),
        });
        const j = (await r.json()) as { ok?: boolean; url?: string; error?: string };
        setResultados((prev) => prev.map((x) => x.key === f.key ? { ...x, loading: false, url: j.ok ? (j.url ?? null) : null, error: j.ok ? null : (j.error ?? "error") } : x));
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
        <p className="text-sm text-muted-foreground">
          Subí una imagen de referencia y el sistema la adapta a los ratios de pauta (1:1, 4:5, 9:16, 1.91:1) con relleno
          generativo. Cubre Meta y Demand Gen. Video en la próxima fase; banners/display y CTV los deja la agencia (son diseño).
        </p>
      </header>

      {/* Subir imagen */}
      <div className="rounded-lg border bg-card p-4">
        <label className="text-xs font-semibold uppercase text-muted-foreground">Imagen de referencia</label>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <input type="file" accept="image/*" onChange={(e) => onFile(e.target.files?.[0])} className="text-xs" />
          {srcName && <span className="text-xs text-muted-foreground">{srcName}</span>}
        </div>
        {srcDataUrl && (
          <div className="mt-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={srcDataUrl} alt="referencia" className="max-h-52 w-auto rounded border" />
          </div>
        )}
      </div>

      {/* Formatos */}
      <div className="rounded-lg border bg-card p-4">
        <label className="text-xs font-semibold uppercase text-muted-foreground">Formatos a generar</label>
        <div className="mt-2 flex flex-wrap gap-2">
          {FORMATOS_IMG_PAUTA.map((f) => (
            <button key={f.key} type="button" onClick={() => toggle(f.key)}
              className={`rounded-full border px-3 py-1 text-xs ${sel.has(f.key) ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}
              title={`${f.width}×${f.height} · ${f.usos}`}>
              {f.label} ({f.width}×{f.height})
            </button>
          ))}
        </div>
        <button onClick={adaptar} disabled={busy || !srcDataUrl || sel.size === 0}
          className="mt-3 rounded bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50">
          {busy ? "Adaptando…" : `Adaptar (${sel.size})`}
        </button>
        {!srcDataUrl && <p className="mt-2 text-[11px] text-muted-foreground">Subí una imagen para habilitar.</p>}
      </div>

      {/* Resultados */}
      {resultados.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {resultados.map((r) => (
            <div key={r.key} className="flex flex-col gap-1 rounded-lg border bg-card p-2">
              <span className="text-[11px] font-medium">{r.label} · {r.width}×{r.height}</span>
              {r.loading && <div className="flex aspect-square items-center justify-center rounded bg-muted text-[11px] text-muted-foreground">generando…</div>}
              {r.error && <div className="rounded bg-red-50 p-2 text-[10px] text-red-700">{r.error}</div>}
              {r.url && (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={r.url} alt={r.label} className="w-full rounded border object-contain" />
                  <a href={r.url} target="_blank" rel="noopener" download className="rounded border px-2 py-1 text-center text-[10px] font-medium hover:bg-secondary">Descargar</a>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="text-[11px] text-muted-foreground">
        Nota: el relleno generativo funciona muy bien en fotos de producto/lifestyle. Si la imagen tiene mucho texto o logo,
        revisá que hayan quedado bien ubicados en cada ratio (a veces conviene un retoque).
      </p>
    </div>
  );
}
