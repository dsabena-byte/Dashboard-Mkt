"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CATEGORIAS } from "@/lib/contenido-shared";
import { getModelos } from "@/lib/producto-catalog";

const PILARES = ["Liderazgo marca/porfolio", "Calidad superior", "Respaldo Posventa", "Elegir bien", "Experiencia uso"];
const FORMATOS = [{ v: "imagen", l: "Imagen (post)" }, { v: "carrusel", l: "Carrusel" }];
const ASPECTOS = [{ v: "vertical", l: "Feed vertical 3:4" }, { v: "feed", l: "Cuadrado 1:1" }, { v: "story", l: "Story/Reel 9:16" }];
const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const ESTADO_COLOR: Record<string, string> = { pendiente: "#94a3b8", generado: "#f59e0b", aprobado: "#10b981", publicado: "#2563eb" };
const ESTADO_LABEL: Record<string, string> = { pendiente: "Pendiente", generado: "Generado", aprobado: "Aprobado ✓", publicado: "Publicado" };

interface Cal {
  id: string;
  fecha: string;
  hora: string | null;
  pilar: string | null;
  categoria: string | null;
  modelo: string | null;
  formato: string | null;
  aspecto: string | null;
  detalles: string | null;
  imagen_url: string | null;
  video_url: string | null;
  caption: string | null;
  hashtags: string[] | null;
  mensaje_clave: string | null;
  bajada: string | null;
  estado: string;
  aprobado: boolean;
}

function catLabel(v: string | null): string { return CATEGORIAS.find((c) => c.v === v)?.l ?? v ?? ""; }
function pad(n: number) { return String(n).padStart(2, "0"); }
function ymd(y: number, m: number, d: number) { return `${y}-${pad(m + 1)}-${pad(d)}`; }

export default function CalendarioPage() {
  const now = new Date();
  const [y, setY] = useState(now.getFullYear());
  const [m, setM] = useState(now.getMonth());
  const [items, setItems] = useState<Cal[]>([]);
  const [sel, setSel] = useState<string>(ymd(now.getFullYear(), now.getMonth(), now.getDate()));
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const desde = ymd(y, m, 1);
      const hasta = ymd(y, m, new Date(y, m + 1, 0).getDate());
      const r = await fetch(`/api/contenido/calendario?desde=${desde}&hasta=${hasta}`);
      const j = await r.json();
      if (j.ok) setItems(j.items as Cal[]);
      else setErr(j.error ?? "No se pudo leer el calendario.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [y, m]);

  useEffect(() => { load(); }, [load]);

  const byDay = useMemo(() => {
    const map: Record<string, Cal[]> = {};
    for (const it of items) (map[it.fecha] ??= []).push(it);
    return map;
  }, [items]);

  // Grilla del mes (semanas empezando en lunes).
  const grid = useMemo(() => {
    const firstWeekday = (new Date(y, m, 1).getDay() + 6) % 7; // lun=0
    const days = new Date(y, m + 1, 0).getDate();
    const cells: Array<{ fecha: string; d: number } | null> = [];
    for (let i = 0; i < firstWeekday; i++) cells.push(null);
    for (let d = 1; d <= days; d++) cells.push({ fecha: ymd(y, m, d), d });
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [y, m]);

  function prevMonth() { if (m === 0) { setY(y - 1); setM(11); } else setM(m - 1); }
  function nextMonth() { if (m === 11) { setY(y + 1); setM(0); } else setM(m + 1); }

  async function addEntry() {
    setErr(null);
    try {
      const r = await fetch("/api/contenido/calendario", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fecha: sel, pilar: PILARES[0], categoria: "porfolio", formato: "imagen", aspecto: "vertical", estado: "pendiente" }),
      });
      const j = await r.json();
      if (j.ok) load();
      else setErr(`No se pudo agregar: ${j.error ?? "error"}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  const selItems = byDay[sel] ?? [];

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Calendario de contenido</h2>
          <p className="text-sm text-muted-foreground">Planificá el mes, generá cada pieza, revisá y aprobá. La publicación automática en IG/FB es la próxima etapa.</p>
        </div>
        <Link href="/contenido" className="rounded-md border px-3 py-1.5 text-sm hover:bg-secondary">← Generador</Link>
      </header>

      <div className="flex items-center gap-3">
        <button onClick={prevMonth} className="rounded border px-2 py-1 text-sm hover:bg-secondary">‹</button>
        <div className="min-w-[10rem] text-center text-sm font-medium">{MESES[m]} {y}</div>
        <button onClick={nextMonth} className="rounded border px-2 py-1 text-sm hover:bg-secondary">›</button>
        {loading && <span className="text-xs text-muted-foreground">cargando…</span>}
      </div>

      {err && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-900">
          <strong>Error:</strong> {err}
          {/relation|does not exist|contenido_calendario/i.test(err) && (
            <div className="mt-1">Parece que falta crear la tabla <code>contenido_calendario</code> en Supabase (correr la migración 0075 / el SQL).</div>
          )}
        </div>
      )}

      {/* Grilla del mes */}
      <div className="rounded-xl border bg-card p-2">
        <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-medium uppercase text-muted-foreground">
          {DIAS.map((d) => <div key={d} className="py-1">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {grid.map((cell, i) => {
            if (!cell) return <div key={i} className="min-h-[64px] rounded bg-muted/20" />;
            const dayItems = byDay[cell.fecha] ?? [];
            const isSel = cell.fecha === sel;
            return (
              <button
                key={i}
                onClick={() => setSel(cell.fecha)}
                className={`min-h-[64px] rounded border p-1 text-left transition-colors hover:bg-muted/40 ${isSel ? "border-primary ring-1 ring-primary" : ""}`}
              >
                <div className="text-[11px] font-medium">{cell.d}</div>
                <div className="mt-0.5 space-y-0.5">
                  {dayItems.slice(0, 3).map((it) => (
                    <div key={it.id} className="flex items-center gap-1 rounded bg-muted/40 p-0.5" title={`${it.pilar ?? ""} · ${catLabel(it.categoria)} · ${ESTADO_LABEL[it.estado] ?? it.estado}`}>
                      {it.imagen_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={it.imagen_url} alt="" className="h-7 w-7 shrink-0 rounded object-cover" />
                      ) : (
                        <span className="h-7 w-7 shrink-0 rounded" style={{ backgroundColor: `${ESTADO_COLOR[it.estado] ?? "#94a3b8"}33` }} />
                      )}
                      <div className="min-w-0 flex-1 leading-tight">
                        <div className="truncate text-[9px] font-medium">{it.mensaje_clave || catLabel(it.categoria) || "(sin generar)"}</div>
                        <div className="truncate text-[8px] text-muted-foreground">{catLabel(it.categoria)} · {it.pilar ?? ""}</div>
                      </div>
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: ESTADO_COLOR[it.estado] ?? "#94a3b8" }} />
                    </div>
                  ))}
                  {dayItems.length > 3 && <div className="text-[8px] text-muted-foreground">+{dayItems.length - 3} más</div>}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Panel del día seleccionado */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Piezas del {sel}</h3>
          <button onClick={addEntry} className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90">+ Agregar pieza</button>
        </div>
        {selItems.length === 0 ? (
          <p className="rounded-lg border bg-card p-6 text-center text-xs text-muted-foreground">Sin piezas para este día. Agregá una con el botón de arriba.</p>
        ) : (
          <div className="space-y-3">
            {selItems.map((it) => <EntryCard key={it.id} entry={it} onChange={load} />)}
          </div>
        )}
      </section>

      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
        {Object.entries(ESTADO_LABEL).map(([k, l]) => (
          <span key={k} className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: ESTADO_COLOR[k] }} /> {l}</span>
        ))}
      </div>
    </div>
  );
}

function EntryCard({ entry, onChange }: { entry: Cal; onChange: () => void }) {
  const [e, setE] = useState<Cal>(entry);
  const [busy, setBusy] = useState<string | null>(null);
  const [zoom, setZoom] = useState(false);
  const [videoModelo, setVideoModelo] = useState("kling");
  const [videoPrompt, setVideoPrompt] = useState("");
  const [videoBusy, setVideoBusy] = useState(false);
  const [videoErr, setVideoErr] = useState<string | null>(null);
  const modelos = useMemo(() => getModelos(e.categoria ?? "porfolio"), [e.categoria]);

  useEffect(() => { setE(entry); }, [entry]);

  async function save(patch: Partial<Cal>) {
    setBusy("save");
    try {
      const r = await fetch("/api/contenido/calendario", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: e.id, ...patch }),
      });
      const j = await r.json();
      if (j.ok) { setE(j.item as Cal); onChange(); }
    } finally { setBusy(null); }
  }

  async function generar() {
    setBusy("gen");
    try {
      const r = await fetch("/api/contenido/calendario/generar", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: e.id }),
      });
      const j = await r.json();
      if (j.ok) { setE(j.item as Cal); onChange(); }
      else alert(`Error al generar: ${j.error ?? "?"}`);
    } finally { setBusy(null); }
  }

  async function borrar() {
    if (!confirm("¿Borrar esta pieza?")) return;
    setBusy("del");
    await fetch(`/api/contenido/calendario?id=${e.id}`, { method: "DELETE" });
    onChange();
  }

  async function generarVideo() {
    if (!e.imagen_url) return;
    setVideoBusy(true);
    setVideoErr(null);
    try {
      const r = await fetch("/api/generar-video", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_url: e.imagen_url, modelo: videoModelo, prompt: videoPrompt.trim() || undefined, aspecto: e.aspecto ?? "vertical" }),
      });
      const j = (await r.json()) as { ok?: boolean; video_url?: string; error?: string };
      if (j.ok && j.video_url) await save({ video_url: j.video_url });
      else setVideoErr(j.error ?? "No se pudo generar el video.");
    } catch (err) {
      setVideoErr(err instanceof Error ? err.message : String(err));
    } finally {
      setVideoBusy(false);
    }
  }

  const field = "rounded border px-2 py-1 text-xs";

  return (
    <>
    <div className="rounded-xl border bg-card p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-white" style={{ backgroundColor: ESTADO_COLOR[e.estado] ?? "#94a3b8" }}>{ESTADO_LABEL[e.estado] ?? e.estado}</span>
        <input type="time" value={e.hora?.slice(0, 5) ?? ""} onChange={(ev) => setE({ ...e, hora: ev.target.value })} onBlur={() => save({ hora: e.hora })} className={field} />
        <button onClick={borrar} disabled={busy === "gen" || busy === "del"} className="ml-auto rounded border px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50">Borrar</button>
      </div>

      {/* Parámetros */}
      <div className="mb-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-5">
        <select value={e.pilar ?? ""} onChange={(ev) => setE({ ...e, pilar: ev.target.value })} onBlur={() => save({ pilar: e.pilar })} className={field}>
          {PILARES.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={e.categoria ?? "porfolio"} onChange={(ev) => { const c = ev.target.value; setE({ ...e, categoria: c, modelo: null }); save({ categoria: c, modelo: null }); }} className={field}>
          {CATEGORIAS.map((c) => <option key={c.v} value={c.v}>{c.l}</option>)}
        </select>
        <select value={e.modelo ?? ""} onChange={(ev) => setE({ ...e, modelo: ev.target.value || null })} onBlur={() => save({ modelo: e.modelo })} className={field} disabled={modelos.length === 0}>
          <option value="">{modelos.length === 0 ? "— sin modelo —" : "— genérico —"}</option>
          {modelos.map((mm) => <option key={mm.sku} value={mm.sku}>{mm.nombreCorto ?? mm.nombre}</option>)}
        </select>
        <select value={e.aspecto ?? "vertical"} onChange={(ev) => setE({ ...e, aspecto: ev.target.value })} onBlur={() => save({ aspecto: e.aspecto })} className={field}>
          {ASPECTOS.map((a) => <option key={a.v} value={a.v}>{a.l}</option>)}
        </select>
        <select value={e.formato ?? "imagen"} onChange={(ev) => setE({ ...e, formato: ev.target.value })} onBlur={() => save({ formato: e.formato })} className={field}>
          {FORMATOS.map((f) => <option key={f.v} value={f.v}>{f.l}</option>)}
        </select>
      </div>
      <input value={e.detalles ?? ""} onChange={(ev) => setE({ ...e, detalles: ev.target.value })} onBlur={() => save({ detalles: e.detalles })} placeholder="Detalles (opcional): puertas cerradas, vista frontal…" className={`${field} mb-2 w-full`} />

      <div className="flex flex-wrap items-center gap-2">
        <button onClick={generar} disabled={busy === "gen" || busy === "del"} className="rounded border px-3 py-1.5 text-xs font-medium hover:bg-secondary disabled:opacity-50">
          {busy === "gen" ? "Generando… (~1 min)" : e.imagen_url ? "Regenerar" : "Generar"}
        </button>
      </div>

      {/* Contenido generado */}
      {e.imagen_url && (
        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={e.imagen_url} alt="pieza" onClick={() => setZoom(true)} title="Click para agrandar" className="max-h-64 w-auto max-w-full cursor-zoom-in rounded border object-contain sm:w-48" />
          <div className="flex-1 space-y-2">
            <div>
              <label className="block text-[10px] font-semibold uppercase text-muted-foreground">Título placa</label>
              <input value={e.mensaje_clave ?? ""} onChange={(ev) => setE({ ...e, mensaje_clave: ev.target.value })} onBlur={() => save({ mensaje_clave: e.mensaje_clave })} className={`${field} w-full`} />
            </div>
            <div>
              <label className="block text-[10px] font-semibold uppercase text-muted-foreground">Bajada</label>
              <input value={e.bajada ?? ""} onChange={(ev) => setE({ ...e, bajada: ev.target.value })} onBlur={() => save({ bajada: e.bajada })} className={`${field} w-full`} />
            </div>
            <div>
              <label className="block text-[10px] font-semibold uppercase text-muted-foreground">Caption</label>
              <textarea value={e.caption ?? ""} onChange={(ev) => setE({ ...e, caption: ev.target.value })} onBlur={() => save({ caption: e.caption })} rows={3} className={`${field} w-full`} />
            </div>
            <button
              onClick={() => save({ aprobado: !e.aprobado, estado: !e.aprobado ? "aprobado" : "generado" })}
              disabled={busy === "gen" || busy === "del"}
              className={`rounded px-3 py-1.5 text-xs font-medium ${e.aprobado ? "bg-emerald-600 text-white" : "border hover:bg-secondary"}`}
            >
              {e.aprobado ? "✓ Aprobado (click para desaprobar)" : "Aprobar"}
            </button>

            {/* Video */}
            <div className="space-y-1 border-t pt-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-semibold uppercase text-muted-foreground">Video (≤6s)</span>
                <select value={videoModelo} onChange={(ev) => setVideoModelo(ev.target.value)} className={field}>
                  <option value="kling">Kling (5s)</option>
                  <option value="veo">Veo (~8s)</option>
                </select>
                <input value={videoPrompt} onChange={(ev) => setVideoPrompt(ev.target.value)} placeholder="movimiento (opcional)" className={`${field} min-w-[8rem] flex-1`} />
                <button onClick={generarVideo} disabled={videoBusy} className="rounded border px-3 py-1 text-xs font-medium hover:bg-secondary disabled:opacity-50">
                  {videoBusy ? "Generando… (~1-3 min)" : e.video_url ? "Regenerar video" : "Generar video"}
                </button>
              </div>
              {videoErr && <p className="text-[10px] text-red-700">{videoErr}</p>}
              {e.video_url && (
                <div className="space-y-1">
                  {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                  <video src={e.video_url} controls loop className="max-h-56 w-auto max-w-full rounded border" />
                  <a href={e.video_url} target="_blank" rel="noopener" className="inline-block rounded border px-2 py-0.5 text-[10px] font-medium hover:bg-secondary">Abrir / descargar video</a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
    {zoom && e.imagen_url && (
      <div onClick={() => setZoom(false)} className="fixed inset-0 z-50 flex cursor-zoom-out items-center justify-center bg-black/85 p-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={e.imagen_url} alt="pieza ampliada" className="max-h-[95vh] max-w-[95vw] object-contain" />
      </div>
    )}
    </>
  );
}
