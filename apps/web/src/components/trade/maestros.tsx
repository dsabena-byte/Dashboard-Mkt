"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

// Edición puntual de los maestros de Trade: Tiendas (alta/baja, datos, promotor/supervisor con fecha y sugerencias
// del último U3), Cadenas (cliente SAP, unir duplicadas), SKUs y Objetivos de Floor Share. Cada cambio se audita.

type Entidad = "tiendas" | "cadenas" | "skus" | "objetivos";
type Fila = Record<string, unknown>;

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { ...init, headers: { "Content-Type": "application/json" } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j as { error?: string }).error ?? `Error ${r.status}`);
  return j as T;
}
const patch = (body: unknown) => api<{ ok: boolean; movidas?: number; quedaron?: number }>("/api/trade/maestros", { method: "PATCH", body: JSON.stringify(body) });
const txt = (v: unknown) => (v == null ? "" : String(v));
const POR_PAGINA = 50;

export function MaestrosTrade({ entidad }: { entidad: Entidad }) {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const cargar = useCallback(async () => {
    try { setData(await api(`/api/trade/maestros?entidad=${entidad}`)); setError(null); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  }, [entidad]);
  useEffect(() => { void cargar(); }, [cargar]);
  const hacer = async (body: unknown, ok = "Guardado.") => {
    try { const r = await patch(body); setAviso(r.movidas != null ? `Unidas: ${r.movidas} tiendas movidas${r.quedaron ? `, ${r.quedaron} quedaron (mismo número en las dos)` : ""}.` : ok); await cargar(); }
    catch (e) { setAviso(e instanceof Error ? e.message : String(e)); }
  };

  if (error) return <div className="rounded-lg border bg-rose-50 p-3 text-xs text-rose-900">{error}</div>;
  if (!data) return <div className="text-xs text-muted-foreground">Cargando…</div>;
  return (
    <div className="space-y-3">
      {aviso && <div className="rounded-md bg-blue-50 p-2 text-xs text-blue-900">{aviso}</div>}
      {entidad === "tiendas" && <Tiendas data={data} hacer={hacer} />}
      {entidad === "cadenas" && <Cadenas filas={(data.cadenas as Fila[]) ?? []} hacer={hacer} />}
      {entidad === "skus" && <Skus filas={(data.skus as Fila[]) ?? []} hacer={hacer} />}
      {entidad === "objetivos" && <Objetivos data={data.objetivos as { valor: Record<string, number> } | null} hacer={hacer} />}
    </div>
  );
}

type Hacer = (body: unknown, ok?: string) => Promise<void>;

function useBusqueda(filas: Fila[], campos: string[]) {
  const [q, setQ] = useState("");
  const [n, setN] = useState(POR_PAGINA);
  const vis = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? filas.filter((f) => campos.some((c) => txt(f[c]).toLowerCase().includes(t))) : filas;
  }, [filas, q, campos]);
  const caja = (
    <input placeholder="Buscar…" value={q} onChange={(e) => { setQ(e.target.value); setN(POR_PAGINA); }} className="w-64 rounded border px-2 py-1 text-xs" />
  );
  const mas = vis.length > n ? <button className="text-xs underline" onClick={() => setN(n + POR_PAGINA)}>Ver {Math.min(POR_PAGINA, vis.length - n)} más (de {vis.length})</button> : null;
  return { vis: vis.slice(0, n), total: vis.length, caja, mas };
}

function Editable({ valor, onSave, ancho = "w-40" }: { valor: unknown; onSave: (v: string) => void; ancho?: string }) {
  const [v, setV] = useState(txt(valor));
  useEffect(() => setV(txt(valor)), [valor]);
  return <input className={`${ancho} rounded border px-1 py-0.5`} value={v} onChange={(e) => setV(e.target.value)} onBlur={() => { if (v !== txt(valor)) onSave(v); }} />;
}

const TIENDA_CAMPOS = ["cadena", "numero", "nombre", "promotor", "supervisor", "provincia"];
function Tiendas({ data, hacer }: { data: Record<string, unknown>; hacer: Hacer }) {
  const filas = useMemo(() => (data.tiendas as Fila[]) ?? [], [data]);
  const cadenas = (data.cadenas as Array<{ clave: string }>) ?? [];
  const personas = (data.personas as Array<{ nombre: string; rol: string }>) ?? [];
  const [soloSug, setSoloSug] = useState(false);
  const base = useMemo(() => (soloSug ? filas.filter((f) => f.sugerencia) : filas), [filas, soloSug]);
  const { vis, total, caja, mas } = useBusqueda(base, TIENDA_CAMPOS);
  const [alta, setAlta] = useState({ cadena: "", numero: "", nombre: "" });
  const nSug = filas.filter((f) => f.sugerencia).length;
  const hoy = new Date().toISOString().slice(0, 10);
  const asignar = (f: Fila, promotor: unknown, supervisor: unknown, desde = hoy) =>
    hacer({ entidad: "asignacion", tienda_id: f.id, promotor, supervisor, desde }, "Asignación actualizada (la anterior queda en el historial).");

  return (
    <>
      <datalist id="tr-personas">{personas.map((p) => <option key={p.nombre} value={p.nombre} />)}</datalist>
      <datalist id="tr-cadenas">{cadenas.map((c) => <option key={c.clave} value={c.clave} />)}</datalist>
      <div className="flex flex-wrap items-center gap-3">
        {caja}
        <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={soloSug} onChange={(e) => setSoloSug(e.target.checked)} /> Solo las que el último U3 dice que cambiaron ({nSug})</label>
        <span className="text-xs text-muted-foreground">{total} tiendas</span>
      </div>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-xs">
          <thead className="bg-muted/40 text-left text-muted-foreground">
            <tr><th className="px-2 py-1">Cadena</th><th className="px-2">N°</th><th className="px-2">Nombre</th><th className="px-2">Segmentación</th><th className="px-2">Provincia</th><th className="px-2">Promotor</th><th className="px-2">Supervisor</th><th className="px-2">Activa</th></tr>
          </thead>
          <tbody>
            {vis.map((f) => {
              const sug = f.sugerencia as { promotor: string | null; supervisor: string | null; fecha: string } | null;
              const id = f.id;
              return (
                <tr key={String(id)} className="border-t align-top">
                  <td className="px-2 py-1"><input list="tr-cadenas" defaultValue={txt(f.cadena)} className="w-36 rounded border px-1 py-0.5" onBlur={(e) => { if (e.target.value !== txt(f.cadena)) void hacer({ entidad: "tienda", id, cambios: { cadena: e.target.value } }); }} /></td>
                  <td className="px-2 tabular-nums">{txt(f.numero)}</td>
                  <td className="px-2"><Editable valor={f.nombre} ancho="w-48" onSave={(v) => void hacer({ entidad: "tienda", id, cambios: { nombre: v } })} /></td>
                  <td className="px-2"><Editable valor={f.segmentacion} ancho="w-32" onSave={(v) => void hacer({ entidad: "tienda", id, cambios: { segmentacion: v } })} /></td>
                  <td className="px-2"><Editable valor={f.provincia} ancho="w-28" onSave={(v) => void hacer({ entidad: "tienda", id, cambios: { provincia: v } })} /></td>
                  <td className="px-2">
                    <input list="tr-personas" defaultValue={txt(f.promotor)} className="w-36 rounded border px-1 py-0.5" onBlur={(e) => { if (e.target.value !== txt(f.promotor)) void asignar(f, e.target.value, f.supervisor); }} />
                    {sug && (
                      <div className="mt-0.5 text-[10px] text-amber-800">
                        El U3 del {sug.fecha} dice: {sug.promotor ?? "—"}{sug.supervisor ? ` / ${sug.supervisor}` : ""}{" "}
                        <button className="underline" onClick={() => void asignar(f, sug.promotor, sug.supervisor ?? f.supervisor, sug.fecha || hoy)}>Aplicar</button>
                      </div>
                    )}
                    {f.desde ? <div className="text-[10px] text-muted-foreground">desde {txt(f.desde)}</div> : null}
                  </td>
                  <td className="px-2"><input list="tr-personas" defaultValue={txt(f.supervisor)} className="w-36 rounded border px-1 py-0.5" onBlur={(e) => { if (e.target.value !== txt(f.supervisor)) void asignar(f, f.promotor, e.target.value); }} /></td>
                  <td className="px-2"><input type="checkbox" checked={f.activa !== false} onChange={(e) => void hacer({ entidad: "tienda", id, cambios: { activa: e.target.checked } }, e.target.checked ? "Tienda dada de alta." : "Tienda dada de baja.")} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {mas}
      <section className="flex flex-wrap items-end gap-2 rounded-xl border bg-card p-3 text-xs">
        <b className="w-full">Nueva tienda</b>
        <label className="flex flex-col">Cadena<input list="tr-cadenas" className="rounded border px-1 py-0.5" value={alta.cadena} onChange={(e) => setAlta({ ...alta, cadena: e.target.value })} /></label>
        <label className="flex flex-col">Número<input className="w-20 rounded border px-1 py-0.5" value={alta.numero} onChange={(e) => setAlta({ ...alta, numero: e.target.value })} /></label>
        <label className="flex flex-col">Nombre<input className="w-56 rounded border px-1 py-0.5" value={alta.nombre} onChange={(e) => setAlta({ ...alta, nombre: e.target.value })} /></label>
        <button className="rounded bg-blue-700 px-3 py-1 font-semibold text-white" onClick={() => void hacer({ entidad: "tienda_alta", ...alta }, "Tienda creada.").then(() => setAlta({ cadena: "", numero: "", nombre: "" }))}>Crear</button>
      </section>
    </>
  );
}

const CADENA_CAMPOS = ["clave", "nombre", "cliente"];
function Cadenas({ filas, hacer }: { filas: Fila[]; hacer: Hacer }) {
  const { vis, caja, mas } = useBusqueda(filas, CADENA_CAMPOS);
  const [unir, setUnir] = useState({ de: "", a: "" });
  const activas = filas.filter((f) => f.activa !== false).map((f) => txt(f.clave)).sort();
  return (
    <>
      <section className="flex flex-wrap items-end gap-2 rounded-xl border bg-card p-3 text-xs">
        <b className="w-full">Unir cadenas duplicadas (ej. “CHANGO MAS” y “CHANGOMAS”)</b>
        <label className="flex flex-col">Esta<select className="rounded border px-1 py-0.5" value={unir.de} onChange={(e) => setUnir({ ...unir, de: e.target.value })}><option value="" />{activas.map((c) => <option key={c}>{c}</option>)}</select></label>
        <label className="flex flex-col">es la misma que<select className="rounded border px-1 py-0.5" value={unir.a} onChange={(e) => setUnir({ ...unir, a: e.target.value })}><option value="" />{activas.map((c) => <option key={c}>{c}</option>)}</select></label>
        <button className="rounded bg-blue-700 px-3 py-1 font-semibold text-white" onClick={() => { if (confirm(`¿Unir ${unir.de} dentro de ${unir.a}?`)) void hacer({ entidad: "cadena_unir", ...unir }); }}>Unir</button>
      </section>
      {caja}
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-xs">
          <thead className="bg-muted/40 text-left text-muted-foreground">
            <tr><th className="px-2 py-1">Cadena (relevamiento)</th><th className="px-2">Nombre</th><th className="px-2">Cliente SAP (razón social)</th><th className="px-2">Otras grafías</th><th className="px-2 text-right">Tiendas</th><th className="px-2">Activa</th></tr>
          </thead>
          <tbody>
            {vis.map((f) => (
              <tr key={txt(f.clave)} className="border-t">
                <td className="px-2 py-1 font-medium">{txt(f.clave)}</td>
                <td className="px-2"><Editable valor={f.nombre} onSave={(v) => void hacer({ entidad: "cadena", clave: f.clave, cambios: { nombre: v } })} /></td>
                <td className="px-2"><Editable valor={f.cliente} ancho="w-56" onSave={(v) => void hacer({ entidad: "cadena", clave: f.clave, cambios: { cliente: v } })} /></td>
                <td className="px-2 text-muted-foreground">{((f.alias as string[]) ?? []).join(", ")}</td>
                <td className="px-2 text-right tabular-nums">{txt(f.tiendas)}</td>
                <td className="px-2"><input type="checkbox" checked={f.activa !== false} onChange={(e) => void hacer({ entidad: "cadena", clave: f.clave, cambios: { activa: e.target.checked } })} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {mas}
    </>
  );
}

const SKU_CAMPOS = ["sku", "descripcion", "nombre_comercial", "categoria"];
function Skus({ filas, hacer }: { filas: Fila[]; hacer: Hacer }) {
  const { vis, caja, mas } = useBusqueda(filas, SKU_CAMPOS);
  const campo = (f: Fila, c: string, ancho?: string) => <Editable valor={f[c]} ancho={ancho} onSave={(v) => void hacer({ entidad: "sku", sku: f.sku, cambios: { [c]: v } })} />;
  return (
    <>
      {caja}
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-xs">
          <thead className="bg-muted/40 text-left text-muted-foreground">
            <tr><th className="px-2 py-1">SKU</th><th className="px-2">Descripción</th><th className="px-2">Nombre comercial</th><th className="px-2">División</th><th className="px-2">Categoría</th><th className="px-2">Marca</th><th className="px-2">EAN</th></tr>
          </thead>
          <tbody>
            {vis.map((f) => (
              <tr key={txt(f.sku)} className="border-t">
                <td className="px-2 py-1 font-mono">{txt(f.sku)}</td>
                <td className="px-2">{campo(f, "descripcion", "w-56")}</td>
                <td className="px-2">{campo(f, "nombre_comercial")}</td>
                <td className="px-2">{campo(f, "division", "w-32")}</td>
                <td className="px-2">{campo(f, "categoria", "w-32")}</td>
                <td className="px-2">{campo(f, "marca", "w-24")}</td>
                <td className="px-2">{campo(f, "ean", "w-32")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {mas}
    </>
  );
}

function Objetivos({ data, hacer }: { data: { valor: Record<string, number> } | null; hacer: Hacer }) {
  const [v, setV] = useState({ lavado: 32, refrigeracion: 25, coccion: 23, ...(data?.valor ?? {}) });
  return (
    <section className="space-y-3 rounded-xl border bg-card p-4 text-sm">
      <p className="text-xs text-muted-foreground">Objetivo de share de góndola de Drean por categoría. Se usa en Floor Share (tarjetas y semáforos) y en el cruce CB × Floor Share.</p>
      <div className="flex flex-wrap gap-4">
        {(["lavado", "refrigeracion", "coccion"] as const).map((k) => (
          <label key={k} className="flex flex-col text-xs capitalize">{k === "refrigeracion" ? "Refrigeración" : k === "coccion" ? "Cocción" : "Lavado"} (%)
            <input type="number" step="0.5" className="w-24 rounded border px-2 py-1" value={v[k]} onChange={(e) => setV({ ...v, [k]: Number(e.target.value) })} />
          </label>
        ))}
      </div>
      <button className="rounded bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white" onClick={() => void hacer({ entidad: "objetivos", valor: v }, "Objetivos guardados.")}>Guardar</button>
      <p className="text-[11px] text-muted-foreground">El calendario (semana → mes) sigue siendo el de semanas ISO de todo el tablero; no se edita acá.</p>
    </section>
  );
}
