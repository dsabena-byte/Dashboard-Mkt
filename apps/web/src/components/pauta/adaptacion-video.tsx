"use client";

import { useRef, useState } from "react";
import { FORMATOS_VIDEO_PAUTA, type FormatoVideoPauta } from "@/lib/pauta-formatos";

// Adaptación de piezas para pauta (FASE 2: VIDEO). Reframe generativo del encuadre
// a los ratios que pide la pauta (9:16, 1:1, 16:9) con Luma Ray 2 Flash Reframe en
// fal. El modelo EXTIENDE el encuadre al ratio destino sin deformar el foco (no es
// un crop). Flujo:
//   1) Se sube el video (≤10s) DIRECTO a Supabase Storage (URL firmada) → URL pública.
//   2) Por cada ratio elegido: submit a la cola async de fal → se poolea el estado.
//   3) Cuando termina, se muestra el mp4 y se puede descargar.
// v1 = SOLO reframe (sin logo/texto encima): el overlay sobre video es fase posterior.

const MAX_SEG = 10;
const POLL_MS = 6000;
const POLL_MAX = 100; // ~10 min tope por ratio

interface Job {
  key: string;
  label: string;
  aspectRatio: string;
  status: "idle" | "submitting" | "processing" | "done" | "error";
  videoUrl: string | null;
  error: string | null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function videoDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => { URL.revokeObjectURL(v.src); resolve(v.duration || 0); };
    v.onerror = () => { URL.revokeObjectURL(v.src); resolve(0); };
    v.src = URL.createObjectURL(file);
  });
}

export function AdaptacionVideo() {
  const [file, setFile] = useState<File | null>(null);
  const [localUrl, setLocalUrl] = useState<string | null>(null);
  const [dur, setDur] = useState<number | null>(null);
  const [sel, setSel] = useState<Record<string, boolean>>(() => Object.fromEntries(FORMATOS_VIDEO_PAUTA.map((f) => [f.key, true])));
  const [jobs, setJobs] = useState<Job[]>([]);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<string>("");
  const cancelRef = useRef(false);

  async function onFile(f: File | undefined) {
    if (!f) return;
    const d = await videoDuration(f);
    setFile(f); setDur(d);
    if (localUrl) URL.revokeObjectURL(localUrl);
    setLocalUrl(URL.createObjectURL(f));
    setJobs([]);
  }

  const seleccionados = FORMATOS_VIDEO_PAUTA.filter((f) => sel[f.key]);
  const tooLong = dur !== null && dur > MAX_SEG + 0.5;
  const puedeGenerar = !!file && seleccionados.length > 0 && !tooLong && !busy;

  async function subirVideo(f: File): Promise<string> {
    const r = await fetch("/api/contenido/calendario/upload-url", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "pauta-video", kind: "video", filename: f.name }),
    });
    const j = (await r.json()) as { ok?: boolean; uploadUrl?: string; publicUrl?: string; error?: string };
    if (!j.ok || !j.uploadUrl || !j.publicUrl) throw new Error(j.error ?? "No se pudo preparar la subida.");
    const up = await fetch(j.uploadUrl, { method: "PUT", headers: { "Content-Type": f.type || "video/mp4" }, body: f });
    if (!up.ok) throw new Error(`Subida falló (${up.status}).`);
    return j.publicUrl;
  }

  async function generar() {
    if (!file || !puedeGenerar) return;
    cancelRef.current = false;
    setBusy(true);
    setJobs(seleccionados.map((f) => ({ key: f.key, label: f.label, aspectRatio: f.aspectRatio, status: "submitting", videoUrl: null, error: null })));
    try {
      setPhase("Subiendo el video…");
      const publicUrl = await subirVideo(file);

      setPhase("Enviando a reencuadrar (IA)…");
      // Encolamos TODOS los ratios en paralelo; después pooleamos cada uno.
      await Promise.all(seleccionados.map(async (f) => {
        try {
          const r = await fetch("/api/pauta/reframe-video", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ video_url: publicUrl, aspect_ratio: f.aspectRatio }),
          });
          const j = (await r.json()) as { ok?: boolean; statusUrl?: string; responseUrl?: string; error?: string };
          if (!j.ok || !j.statusUrl || !j.responseUrl) throw new Error(j.error ?? "No se pudo encolar.");
          setJobs((prev) => prev.map((x) => x.key === f.key ? { ...x, status: "processing" } : x));
          await poll(f.key, j.statusUrl, j.responseUrl);
        } catch (e) {
          setJobs((prev) => prev.map((x) => x.key === f.key ? { ...x, status: "error", error: e instanceof Error ? e.message : String(e) } : x));
        }
      }));
      setPhase("");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setJobs((prev) => prev.map((x) => x.status === "submitting" || x.status === "processing" ? { ...x, status: "error", error: msg } : x));
      setPhase("");
    }
    setBusy(false);
  }

  async function poll(key: string, statusUrl: string, responseUrl: string) {
    for (let i = 0; i < POLL_MAX; i++) {
      if (cancelRef.current) return;
      await sleep(POLL_MS);
      const r = await fetch("/api/pauta/reframe-video/status", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statusUrl, responseUrl }),
      });
      const j = (await r.json()) as { ok?: boolean; status?: string; video_url?: string | null; error?: string };
      if (!j.ok) throw new Error(j.error ?? "Error consultando estado.");
      if (j.status === "FAILED") throw new Error("El reencuadre falló en el modelo.");
      if (j.status === "COMPLETED") {
        if (!j.video_url) throw new Error("Terminó sin devolver el video.");
        setJobs((prev) => prev.map((x) => x.key === key ? { ...x, status: "done", videoUrl: j.video_url! } : x));
        return;
      }
    }
    throw new Error("Se agotó el tiempo de espera del render.");
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card p-4">
        <label className="text-xs font-semibold uppercase text-muted-foreground">Video de referencia (máx. 10 s)</label>
        <input type="file" accept="video/*" onChange={(e) => onFile(e.target.files?.[0])} className="mt-2 block text-xs" disabled={busy} />
        {localUrl && (
          <div className="mt-2 flex items-center gap-3">
            <video src={localUrl} controls className="max-h-40 w-auto rounded border" />
            <div className="text-[11px] text-muted-foreground">
              {dur !== null && <div>Duración: <strong>{dur.toFixed(1)}s</strong></div>}
              {tooLong && <div className="text-red-600">Supera los 10 s. Recortalo antes de generar.</div>}
              {file && <div className="max-w-[220px] truncate">{file.name}</div>}
            </div>
          </div>
        )}
        <p className="mt-2 text-[11px] text-muted-foreground">
          El modelo <strong>extiende el encuadre</strong> al ratio destino sin deformar el foco (no recorta). v1: solo reencuadre, sin logo ni texto encima.
        </p>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <div className="text-xs font-semibold uppercase text-muted-foreground">Ratios a generar</div>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {FORMATOS_VIDEO_PAUTA.map((f: FormatoVideoPauta) => (
            <label key={f.key} className={`flex flex-col gap-0.5 rounded border p-2 text-[12px] ${sel[f.key] ? "bg-secondary/40" : "opacity-70"}`}>
              <span className="flex items-center gap-1.5 font-medium">
                <input type="checkbox" checked={!!sel[f.key]} onChange={(e) => setSel((p) => ({ ...p, [f.key]: e.target.checked }))} disabled={busy} />
                {f.label}
              </span>
              <span className="text-[10px] text-muted-foreground">{f.usos}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={generar} disabled={!puedeGenerar} className="rounded bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50">
          {busy ? "Generando…" : `Reencuadrar (${seleccionados.length})`}
        </button>
        {!file && <span className="text-[11px] text-muted-foreground">Subí un video para empezar.</span>}
        {phase && <span className="text-[11px] text-amber-600">{phase}</span>}
      </div>

      {jobs.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {jobs.map((j) => (
            <div key={j.key} className="flex flex-col gap-1.5 rounded-lg border bg-card p-2">
              <span className="text-[11px] font-medium">{j.label} <span className="text-muted-foreground">({j.aspectRatio})</span></span>
              {(j.status === "submitting" || j.status === "processing") && (
                <div className="flex aspect-video items-center justify-center rounded bg-muted text-center text-[11px] text-muted-foreground">
                  {j.status === "submitting" ? "encolando…" : "reencuadrando… (puede tardar 1-3 min)"}
                </div>
              )}
              {j.status === "error" && <div className="rounded bg-red-50 p-2 text-[10px] text-red-700">{j.error}</div>}
              {j.status === "done" && j.videoUrl && (<>
                <video src={j.videoUrl} controls className="w-full rounded border" />
                <a href={j.videoUrl} download={`pieza-${j.key}.mp4`} target="_blank" rel="noreferrer" className="rounded border px-2 py-1 text-center text-[10px] font-medium hover:bg-secondary">Descargar</a>
              </>)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
