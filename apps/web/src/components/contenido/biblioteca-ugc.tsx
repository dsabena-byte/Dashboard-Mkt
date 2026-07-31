"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getModelo } from "@/lib/producto-catalog";
import { UGC_PERFILES } from "@/lib/ugc-opciones";

// Biblioteca / Stock de videos UGC: galería para producir en volumen, aprobar y
// entregar a la agencia. Lee los mismos datos que el calendario (canal=ugc) y
// muestra SOLO las piezas que ya tienen video generado.

interface Item {
  id: string;
  fecha: string | null;
  video_url: string | null;
  aprobado: boolean | null;
  estado: string | null;
  modelo: string | null;
  perfil: string | null;
  categoria: string | null;
  guion: string | null;
}

type EstadoFiltro = "todos" | "aprobados" | "pendientes";

const perfilLabel = (k: string | null) => UGC_PERFILES.find((p) => p.key === k)?.label ?? (k || "—");
const productoLabel = (sku: string | null) => (sku ? (getModelo(sku)?.nombreCorto ?? getModelo(sku)?.nombre ?? sku) : "—");
const mesDe = (fecha: string | null) => (fecha ? fecha.slice(0, 7) : "");

export function BibliotecaUgc() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [estado, setEstado] = useState<EstadoFiltro>("todos");
  const [prod, setProd] = useState<string>("");
  const [perf, setPerf] = useState<string>("");
  const [mes, setMes] = useState<string>("");
  const [copiado, setCopiado] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const r = await fetch("/api/contenido/calendario?canal=ugc");
      const j = (await r.json()) as { ok?: boolean; items?: Item[]; error?: string };
      if (!j.ok) { setError(j.error ?? "No se pudo cargar."); return; }
      // Solo el STOCK: piezas con video generado.
      setItems((j.items ?? []).filter((i) => !!i.video_url));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void cargar(); }, [cargar]);

  const productos = useMemo(() => [...new Set(items.map((i) => i.modelo).filter(Boolean))] as string[], [items]);
  const perfiles = useMemo(() => [...new Set(items.map((i) => i.perfil).filter(Boolean))] as string[], [items]);
  const meses = useMemo(() => [...new Set(items.map((i) => mesDe(i.fecha)).filter(Boolean))].sort().reverse(), [items]);

  const filtrados = useMemo(() => items.filter((i) => {
    if (estado === "aprobados" && !i.aprobado) return false;
    if (estado === "pendientes" && i.aprobado) return false;
    if (prod && i.modelo !== prod) return false;
    if (perf && i.perfil !== perf) return false;
    if (mes && mesDe(i.fecha) !== mes) return false;
    return true;
  }), [items, estado, prod, perf, mes]);

  const aprobadosTotales = useMemo(() => items.filter((i) => i.aprobado), [items]);

  async function toggleAprobado(it: Item) {
    setSavingId(it.id);
    try {
      const nuevo = !it.aprobado;
      const r = await fetch("/api/contenido/calendario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: it.id, aprobado: nuevo, estado: nuevo ? "aprobado" : "generado" }),
      });
      const j = (await r.json()) as { ok?: boolean };
      if (j.ok) setItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, aprobado: nuevo, estado: nuevo ? "aprobado" : "generado" } : x)));
    } finally { setSavingId(null); }
  }

  async function copiarLinksAprobados() {
    const links = aprobadosTotales.map((i) => i.video_url).filter(Boolean).join("\n");
    if (!links) return;
    try {
      await navigator.clipboard.writeText(links);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch { /* clipboard no disponible */ }
  }

  const field = "rounded border px-2 py-1 text-xs bg-background";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <a href="/contenido/calendario#ugc" className="text-xs font-medium text-primary hover:underline">← Generador UGC</a>
          <h1 className="text-lg font-semibold">Biblioteca UGC · Stock de videos</h1>
          <p className="text-xs text-muted-foreground">
            {aprobadosTotales.length} aprobados · {items.length} videos en total
          </p>
        </div>
        <button
          onClick={copiarLinksAprobados}
          disabled={aprobadosTotales.length === 0}
          className="rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
        >
          {copiado ? "Copiado ✓" : `Copiar links de aprobados (${aprobadosTotales.length})`}
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2 rounded border bg-secondary/30 p-2">
        <div className="flex gap-1">
          {(["todos", "aprobados", "pendientes"] as EstadoFiltro[]).map((e) => (
            <button key={e} onClick={() => setEstado(e)}
              className={`rounded-full border px-2.5 py-0.5 text-[11px] capitalize ${estado === e ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}>
              {e}
            </button>
          ))}
        </div>
        <select value={prod} onChange={(e) => setProd(e.target.value)} className={field}>
          <option value="">Todos los productos</option>
          {productos.map((p) => <option key={p} value={p}>{productoLabel(p)}</option>)}
        </select>
        <select value={perf} onChange={(e) => setPerf(e.target.value)} className={field}>
          <option value="">Todos los perfiles</option>
          {perfiles.map((p) => <option key={p} value={p}>{perfilLabel(p)}</option>)}
        </select>
        <select value={mes} onChange={(e) => setMes(e.target.value)} className={field}>
          <option value="">Todos los meses</option>
          {meses.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <span className="ml-auto text-[11px] text-muted-foreground">{filtrados.length} mostrando</span>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Cargando stock…</p>}
      {error && <p className="rounded border border-red-300 bg-red-50 p-2 text-xs text-red-700">{error}</p>}
      {!loading && !error && filtrados.length === 0 && (
        <p className="text-sm text-muted-foreground">No hay videos con estos filtros. Generá UGC desde el calendario y aparecerán acá.</p>
      )}

      {/* Grid de videos */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {filtrados.map((it) => (
          <div key={it.id} className={`flex flex-col overflow-hidden rounded-lg border ${it.aprobado ? "border-emerald-400 ring-1 ring-emerald-300" : "border-border"}`}>
            <div className="relative bg-black">
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video src={it.video_url ?? undefined} controls loop preload="metadata" className="aspect-[9/16] w-full object-cover" />
              {it.aprobado && (
                <span className="absolute left-1.5 top-1.5 rounded bg-emerald-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">Aprobado ✓</span>
              )}
            </div>
            <div className="flex flex-1 flex-col gap-1 p-2">
              <div className="flex items-center justify-between gap-1">
                <span className="truncate text-[11px] font-medium" title={productoLabel(it.modelo)}>{productoLabel(it.modelo)}</span>
                <span className="shrink-0 text-[10px] text-muted-foreground">{mesDe(it.fecha)}</span>
              </div>
              <span className="truncate text-[10px] text-muted-foreground">{perfilLabel(it.perfil)}</span>
              <div className="mt-auto flex items-center gap-1 pt-1">
                <button
                  onClick={() => toggleAprobado(it)}
                  disabled={savingId === it.id}
                  className={`flex-1 rounded px-2 py-1 text-[10px] font-medium disabled:opacity-50 ${it.aprobado ? "bg-emerald-600 text-white" : "border hover:bg-secondary"}`}
                >
                  {it.aprobado ? "Aprobado ✓" : "Aprobar"}
                </button>
                <a
                  href={it.video_url ?? "#"}
                  target="_blank"
                  rel="noopener"
                  download
                  className="rounded border px-2 py-1 text-[10px] font-medium hover:bg-secondary"
                  title="Descargar / abrir"
                >
                  ↓
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
