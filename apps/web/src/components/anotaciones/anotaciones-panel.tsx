"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Anotacion } from "@/lib/anotaciones-core";
import { LearnButton } from "@/components/knowledge/learn-button";

// Anotaciones de un tablero ("lanzamiento TV", "corte de stock"): se marcan con una línea punteada en los
// gráficos por fecha de Mis tableros y el Diagnóstico IA las usa como contexto. Portado de BIP (sep-2026).
// Dos modos: con `notas` (lo leyó el server → al guardar hace router.refresh) o sin ellas (se carga sola por
// /api/anotaciones; así va dentro del tab "Diagnóstico e Inteligencia" de cada tablero nativo).
// Estilo sobrio (Tailwind): funciona dentro y fuera de .bip-viz.
export function AnotacionesPanel({ tablero, notas: initial, missing: missing0, defaultOpen = false }: {
  tablero: string; notas?: Anotacion[]; missing?: boolean; defaultOpen?: boolean;
}) {
  const router = useRouter();
  const [notas, setNotas] = useState<Anotacion[] | null>(initial ?? null);
  const [missing, setMissing] = useState(!!missing0);
  const [puedeGlobal, setPuedeGlobal] = useState(false);
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [texto, setTexto] = useState("");
  const [soloEste, setSoloEste] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/anotaciones?tablero=${encodeURIComponent(tablero)}`);
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(d.error ?? "No se pudieron leer las anotaciones"); setNotas([]); return; }
      setNotas(Array.isArray(d.notas) ? d.notas : []);
      setMissing(!!d.missing);
      setPuedeGlobal(!!d.puedeGlobal);
    } catch { setNotas([]); }
  }, [tablero]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (initial) setNotas(initial); }, [initial]);

  const after = async () => { await load(); if (initial) router.refresh(); };

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const res = await fetch("/api/anotaciones", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fecha, texto, tablero: soloEste || !puedeGlobal ? tablero : null }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? "No se pudo guardar");
      setTexto("");
      await after();
    } catch (e2) { setErr(e2 instanceof Error ? e2.message : "Error"); } finally { setBusy(false); }
  }
  async function remove(id: string) {
    if (!confirm("¿Borrar esta anotación?")) return;
    const res = await fetch("/api/anotaciones", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    if (res.ok) await after(); else setErr((await res.json().catch(() => ({}))).error ?? "No se pudo borrar");
  }

  const list = notas ?? [];
  const input = "rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[13px] text-slate-900";
  return (
    <details className="rounded-lg border bg-white px-4 py-3" open={defaultOpen} data-noprint="1">
      <summary className="cursor-pointer text-[13.5px] font-semibold text-slate-900">
        Anotaciones{list.length ? ` (${list.length})` : ""}{" "}
        <span className="text-[12.5px] font-normal text-slate-500">· qué pasó y cuándo (se marcan en los gráficos de Mis tableros y las usa el Diagnóstico IA)</span>{" "}
        <span className="inline-block align-middle"><LearnButton k="anotaciones" /></span>
      </summary>
      <div className="mt-2.5 flex flex-col gap-2">
        {missing && <p className="text-xs text-amber-700">Las anotaciones se activan cuando se corre la migración <code>0119_anotaciones_umbrales.sql</code> en Supabase.</p>}
        {notas == null && <p className="text-xs text-slate-500">Cargando…</p>}
        {notas != null && list.length === 0 && !missing && <p className="text-xs text-slate-500">Todavía no hay anotaciones.</p>}
        {list.slice(0, 50).map((n) => (
          <div key={n.id} className="flex flex-wrap items-baseline gap-2.5 text-[13px]">
            <span className="min-w-[84px] tabular-nums text-slate-500">{n.fecha.split("-").reverse().join("/")}</span>
            <span className="flex-[1_1_240px] text-slate-900">{n.texto}{n.tablero == null && <span className="text-slate-400"> · todos los tableros</span>}</span>
            {n.autor && <span className="text-[11.5px] text-slate-400">{n.autor}</span>}
            <button type="button" className="text-xs font-medium text-red-700 hover:underline" onClick={() => void remove(n.id)}>Borrar</button>
          </div>
        ))}
        {!missing && (
          <form onSubmit={add} className="mt-1 flex flex-wrap items-center gap-2">
            <input type="date" aria-label="Fecha" className={input} value={fecha} onChange={(e) => setFecha(e.target.value)} required />
            <input aria-label="Qué pasó" className={`${input} flex-[1_1_240px]`} maxLength={280} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Ej.: lanzamiento campaña TV, corte de stock, cambio de precios" required />
            {puedeGlobal && <label className="flex items-center gap-1.5 text-[12.5px] text-slate-500"><input type="checkbox" checked={soloEste} onChange={(e) => setSoloEste(e.target.checked)} />Solo este tablero</label>}
            <button type="submit" disabled={busy || !texto.trim()} className="rounded-md px-3.5 py-1.5 text-[13px] font-semibold text-white disabled:opacity-50" style={{ background: "#1e40af" }}>{busy ? "Guardando…" : "Agregar"}</button>
          </form>
        )}
        {err && <div className="text-xs text-red-700">{err}</div>}
      </div>
    </details>
  );
}
