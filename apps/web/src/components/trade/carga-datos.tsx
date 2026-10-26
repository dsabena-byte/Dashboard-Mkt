"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CATEGORIAS_FS, CAT_LABEL, TIPO_LABEL, decodificar, detectarTipo, infoDesdeNombre, normClave, parseCsv, parsear, resumir, splitTienda,
  type CategoriaFs, type FilaCb, type FilaU3, type Faltante, type MaestrosResumen, type Resumen, type TipoCarga, type Cargado,
} from "@/lib/trade-carga-core";

// "Cargar datos" de Trade (reemplaza al Drive + Apps Script). El archivo se lee y valida en el navegador; recién al
// confirmar se sube por partes y se reemplaza la semana en una sola transacción (ver app/api/trade/carga).

interface Carga { id: number; tipo: TipoCarga; archivo: string | null; anio: number | null; semana: number | null; categoria: string | null; filas: number; estado: string; usuario: string | null; created_at: string }
interface Estado { cargas: Carga[]; cargado: Cargado[]; faltantes: Faltante[]; maestros: MaestrosResumen }
interface Archivo {
  id: string; nombre: string; tipo: TipoCarga | null; motivo: string; aviso: string | null;
  anio: number; semana: number | null; categoria: CategoriaFs | null;
  filas: unknown[]; avisos: string[]; errores: string[]; resumen: Resumen | null;
  alias: Record<string, string>; estado: "listo" | "subiendo" | "ok" | "error"; msg: string | null;
}

const LOTE = 2000;
const anioActual = new Date().getFullYear();

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { ...init, headers: { "Content-Type": "application/json" } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j as { error?: string }).error ?? `Error ${r.status}`);
  return j as T;
}

export function CargaDatos() {
  const router = useRouter();
  const [estado, setEstado] = useState<Estado | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [archivos, setArchivos] = useState<Archivo[]>([]);
  const [arrastrando, setArrastrando] = useState(false);

  const cargarEstado = useCallback(async () => {
    try { setEstado(await api<Estado>("/api/trade/carga")); setError(null); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  }, []);
  useEffect(() => { void cargarEstado(); }, [cargarEstado]);

  const set = (id: string, p: Partial<Archivo>) => setArchivos((xs) => xs.map((a) => (a.id === id ? { ...a, ...p } : a)));

  async function leer(files: FileList | File[]) {
    const nuevos: Archivo[] = [];
    for (const f of Array.from(files)) {
      const id = `${f.name}-${f.size}-${Date.now()}-${Math.random()}`;
      const grid = parseCsv(decodificar(new Uint8Array(await f.arrayBuffer())));
      const { tipo, motivo } = detectarTipo(grid);
      const info = infoDesdeNombre(f.name);
      const p = tipo ? parsear(tipo, grid) : { filas: [], avisos: [], errores: [motivo] };
      const aviso = tipo === "cb" && info.categoria
        ? `El nombre dice Floor Share ${CAT_LABEL[info.categoria]}, pero el contenido es un Cuadro Básico. Si querías subir el Floor Share, este archivo es otro.`
        : tipo === "fs" && !info.categoria ? "El nombre no dice la categoría: elegila abajo." : null;
      nuevos.push({
        id, nombre: f.name, tipo, motivo, aviso, anio: info.anio ?? anioActual, semana: info.semana, categoria: tipo === "fs" ? info.categoria : null,
        filas: p.filas, avisos: p.avisos, errores: p.errores, resumen: tipo ? resumir(tipo, p.filas, estado?.maestros ?? null) : null,
        alias: {}, estado: "listo", msg: null,
      });
    }
    setArchivos((xs) => [...nuevos, ...xs]);
  }

  function yaCargado(a: Archivo): number {
    if (!estado || a.semana == null) return 0;
    return estado.cargado.filter((c) => c.anio === a.anio && c.semana === a.semana && c.tipo === a.tipo && (a.tipo !== "fs" || c.categoria === a.categoria))
      .reduce((s, c) => s + c.filas, 0);
  }

  async function confirmar(a: Archivo) {
    if (!a.tipo || !a.resumen) return;
    if ((a.tipo === "cb" || a.tipo === "fs") && (!a.semana || a.semana < 1 || a.semana > 53)) return set(a.id, { msg: "Completá la semana (1 a 53)." });
    if (a.tipo === "fs" && !a.categoria) return set(a.id, { msg: "Elegí la categoría del Floor Share." });
    set(a.id, { estado: "subiendo", msg: "Subiendo…" });
    const alias = Object.entries(a.alias).filter(([, v]) => v).map(([de, aa]) => ({ de, a: aa }));
    try {
      if (a.tipo === "tiendas") {
        const r = await api<{ tiendas: number; reasignadas: number; cadenas_nuevas: number }>("/api/trade/carga", {
          method: "POST", body: JSON.stringify({ accion: "tiendas", archivo: a.nombre, filas: a.filas, alias }),
        });
        set(a.id, { estado: "ok", msg: `Listo: ${r.tiendas} tiendas actualizadas · ${r.reasignadas} cambios de promotor/supervisor · ${r.cadenas_nuevas} cadenas nuevas.` });
      } else {
        const { carga_id } = await api<{ carga_id: number }>("/api/trade/carga", {
          method: "POST", body: JSON.stringify({ accion: "iniciar", tipo: a.tipo, archivo: a.nombre, anio: a.anio, semana: a.semana, categoria: a.categoria }),
        });
        for (let i = 0; i < a.filas.length; i += LOTE) {
          set(a.id, { msg: `Subiendo ${Math.min(i + LOTE, a.filas.length).toLocaleString("es-AR")} de ${a.filas.length.toLocaleString("es-AR")} filas…` });
          await api("/api/trade/carga", { method: "POST", body: JSON.stringify({ accion: "filas", carga_id, filas: a.filas.slice(i, i + LOTE) }) });
        }
        set(a.id, { msg: "Reemplazando la semana y recalculando los tableros…" });
        const r = await api<{ filas: number; reemplazadas: number }>("/api/trade/carga", {
          method: "POST", body: JSON.stringify({ accion: "confirmar", carga_id, alias, nuevas: nuevasDe(a) }),
        });
        set(a.id, { estado: "ok", msg: `Listo: ${r.filas.toLocaleString("es-AR")} filas cargadas${r.reemplazadas ? ` (reemplazaron ${r.reemplazadas.toLocaleString("es-AR")})` : ""}.` });
      }
      await cargarEstado();
      router.refresh();
    } catch (e) {
      set(a.id, { estado: "error", msg: e instanceof Error ? e.message : String(e) });
    }
  }

  async function deshacer(c: Carga) {
    if (!confirm(`¿Deshacer la carga "${c.archivo ?? c.tipo}"? Vuelven los datos que había antes.`)) return;
    try { await api(`/api/trade/carga?id=${c.id}`, { method: "DELETE" }); await cargarEstado(); router.refresh(); }
    catch (e) { alert(e instanceof Error ? e.message : String(e)); }
  }

  const cadenasExistentes = estado ? [...new Set(Object.values(estado.maestros.cadenas))].sort() : [];

  return (
    <div className="space-y-4">
      <section
        onDragOver={(e) => { e.preventDefault(); setArrastrando(true); }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={(e) => { e.preventDefault(); setArrastrando(false); void leer(e.dataTransfer.files); }}
        className={`rounded-xl border-2 border-dashed p-6 text-center ${arrastrando ? "border-blue-500 bg-blue-50" : "border-border bg-card"}`}
      >
        <p className="text-sm font-semibold">Arrastrá acá los archivos de la semana (uno o varios)</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Los mismos CSV que se subían al Drive: Cuadro Básico (<code>42.csv</code>), Floor Share (<code>42-Lavado.csv</code>),
          Reporte de Existencias U3 y Tienda-promotor-supervisor. Reconocemos el tipo por el contenido. Nada se guarda hasta que confirmes.
        </p>
        <label className="mt-3 inline-block cursor-pointer rounded-md bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white">
          Elegir archivos
          <input type="file" accept=".csv,text/csv" multiple className="hidden" onChange={(e) => { if (e.target.files) void leer(e.target.files); e.target.value = ""; }} />
        </label>
      </section>

      {error && <div className="rounded-lg border bg-rose-50 p-3 text-xs text-rose-900">{error}</div>}

      {archivos.map((a) => {
        const prev = yaCargado(a);
        const r = a.resumen;
        return (
          <section key={a.id} className="space-y-2 rounded-xl border bg-card p-4 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-semibold">{a.nombre}</div>
                <div className="text-xs text-muted-foreground">{a.tipo ? `${TIPO_LABEL[a.tipo]} · ${a.motivo}` : "Tipo no reconocido"}</div>
              </div>
              <button className="text-xs text-muted-foreground underline" onClick={() => setArchivos((xs) => xs.filter((x) => x.id !== a.id))}>Quitar</button>
            </div>
            {a.aviso && <div className="rounded-md bg-amber-50 p-2 text-xs text-amber-900">{a.aviso}</div>}
            {a.errores.map((e) => <div key={e} className="rounded-md bg-rose-50 p-2 text-xs text-rose-900">{e}</div>)}
            {a.tipo && !a.errores.length && r && (
              <>
                {(a.tipo === "cb" || a.tipo === "fs") && (
                  <div className="flex flex-wrap items-end gap-3 text-xs">
                    <label className="flex flex-col">Año<input type="number" className="w-20 rounded border px-2 py-1" value={a.anio} onChange={(e) => set(a.id, { anio: Number(e.target.value) })} /></label>
                    <label className="flex flex-col">Semana<input type="number" className="w-20 rounded border px-2 py-1" value={a.semana ?? ""} onChange={(e) => set(a.id, { semana: e.target.value ? Number(e.target.value) : null })} /></label>
                    {a.tipo === "fs" && (
                      <label className="flex flex-col">Categoría
                        <select className="rounded border px-2 py-1" value={a.categoria ?? ""} onChange={(e) => set(a.id, { categoria: (e.target.value || null) as CategoriaFs | null })}>
                          <option value="">Elegí…</option>
                          {CATEGORIAS_FS.map((c) => <option key={c} value={c}>{CAT_LABEL[c]}</option>)}
                        </select>
                      </label>
                    )}
                  </div>
                )}
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                  <span><b>{r.filas.toLocaleString("es-AR")}</b> filas</span>
                  {r.tiendas > 0 && <span><b>{r.tiendas}</b> tiendas</span>}
                  {r.skus > 0 && <span><b>{r.skus}</b> SKUs</span>}
                  {r.cadenas > 0 && <span><b>{r.cadenas}</b> cadenas</span>}
                  {r.marcas > 0 && <span><b>{r.marcas}</b> marcas</span>}
                </div>
                {a.avisos.map((x) => <div key={x} className="text-xs text-muted-foreground">{x}</div>)}
                {a.tipo === "u3" && <div className="rounded-md bg-amber-50 p-2 text-xs text-amber-900">Reemplaza el Reporte de Existencias completo (es la foto vigente).</div>}
                {prev > 0 && (
                  <div className="rounded-md bg-amber-50 p-2 text-xs text-amber-900">
                    La semana {a.semana}{a.tipo === "fs" && a.categoria ? ` de ${CAT_LABEL[a.categoria]}` : ""} ya está cargada ({prev.toLocaleString("es-AR")} filas): se va a REEMPLAZAR por este archivo.
                  </div>
                )}
                {r.nuevasCadenas.length > 0 && (
                  <details open className="rounded-md border p-2 text-xs">
                    <summary className="cursor-pointer font-semibold">{r.nuevasCadenas.length} cadenas que no conocemos</summary>
                    <p className="my-1 text-muted-foreground">Si es otra forma de escribir una cadena que ya existe, elegila; si no, se crea nueva.</p>
                    {r.nuevasCadenas.map((c) => (
                      <div key={c} className="flex items-center gap-2 py-0.5">
                        <span className="w-56 truncate">{c}</span>
                        <select className="rounded border px-1 py-0.5" value={a.alias[c] ?? ""} onChange={(e) => set(a.id, { alias: { ...a.alias, [c]: e.target.value } })}>
                          <option value="">Crear nueva</option>
                          {cadenasExistentes.map((x) => <option key={x} value={x}>Es la misma que {x}</option>)}
                        </select>
                      </div>
                    ))}
                  </details>
                )}
                {r.nuevasTiendas.length > 0 && (
                  <details className="rounded-md border p-2 text-xs">
                    <summary className="cursor-pointer font-semibold">
                      {r.nuevasTiendas.length} tiendas que no están en el maestro {a.tipo === "fs" ? "(revisalas en Tiendas)" : "(se dan de alta)"}
                    </summary>
                    <div className="mt-1 max-h-40 overflow-auto text-muted-foreground">{r.nuevasTiendas.join(" · ")}</div>
                  </details>
                )}
                {r.nuevosSkus.length > 0 && (
                  <details className="rounded-md border p-2 text-xs">
                    <summary className="cursor-pointer font-semibold">{r.nuevosSkus.length} SKUs nuevos (se dan de alta; editalos en SKUs)</summary>
                    <div className="mt-1 max-h-40 overflow-auto text-muted-foreground">{r.nuevosSkus.join(" · ")}</div>
                  </details>
                )}
                <div className="flex items-center gap-3">
                  <button
                    disabled={a.estado === "subiendo" || a.estado === "ok"}
                    onClick={() => void confirmar(a)}
                    className="rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    {a.tipo === "tiendas" ? "Actualizar tiendas" : prev > 0 ? "Confirmar y reemplazar" : "Confirmar carga"}
                  </button>
                  {a.msg && <span className={`text-xs ${a.estado === "error" ? "text-rose-700" : a.estado === "ok" ? "text-emerald-700" : "text-muted-foreground"}`}>{a.msg}</span>}
                </div>
              </>
            )}
          </section>
        );
      })}

      {estado && (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-xl border bg-card p-4">
            <h3 className="mb-2 text-sm font-bold">Qué falta cargar</h3>
            {estado.faltantes.length === 0 ? (
              <p className="text-xs text-muted-foreground">Está todo: cada semana tiene CB y las 3 categorías de Floor Share.</p>
            ) : (
              <ul className="max-h-64 space-y-1 overflow-auto text-xs">
                {estado.faltantes.map((f) => <li key={`${f.anio}-${f.semana}`}><b>Semana {f.semana}</b> ({f.anio}): falta {f.falta.join(", ")}</li>)}
              </ul>
            )}
          </section>
          <section className="rounded-xl border bg-card p-4">
            <h3 className="mb-2 text-sm font-bold">Últimas cargas</h3>
            <table className="w-full text-xs" data-noexcel>
              <tbody>
                {estado.cargas.map((c) => (
                  <tr key={c.id} className="border-b last:border-0">
                    <td className="py-1 pr-2">{new Date(c.created_at).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", dateStyle: "short", timeStyle: "short" })}</td>
                    <td className="pr-2">{TIPO_LABEL[c.tipo]}{c.semana ? ` · sem ${c.semana}` : ""}{c.categoria ? ` · ${CAT_LABEL[c.categoria as CategoriaFs] ?? c.categoria}` : ""}</td>
                    <td className="pr-2 text-right tabular-nums">{c.filas.toLocaleString("es-AR")}</td>
                    <td className="pr-2 text-muted-foreground">{c.usuario ?? ""}</td>
                    <td className="text-right">
                      {c.estado === "deshecha" ? <span className="text-muted-foreground">deshecha</span>
                        : c.estado === "ok" && c.tipo !== "tiendas" ? <button className="text-rose-700 underline" onClick={() => void deshacer(c)}>Deshacer</button> : null}
                    </td>
                  </tr>
                ))}
                {!estado.cargas.length && <tr><td className="text-muted-foreground">Todavía no hay cargas desde el tablero.</td></tr>}
              </tbody>
            </table>
          </section>
        </div>
      )}
    </div>
  );
}

/** Altas de maestros que trae el archivo (las cadenas mapeadas a una existente no se crean). */
function nuevasDe(a: Archivo) {
  const r = a.resumen!;
  const cadenas = r.nuevasCadenas.filter((c) => !a.alias[c]);
  const destino = (c: string) => a.alias[c] || c;
  if (a.tipo === "cb") {
    const filas = a.filas as FilaCb[];
    const nt = new Set(r.nuevasTiendas), ns = new Set(r.nuevosSkus);
    const tiendas = new Map<string, { cadena: string; numero: string; nombre: string }>();
    const skus = new Map<string, { sku: string; division: string | null }>();
    for (const f of filas) {
      if (nt.has(f.tienda) && f.numero_tienda) tiendas.set(f.tienda, { cadena: normClave(destino(f.cliente)), numero: f.numero_tienda, nombre: splitTienda(f.tienda)?.nombre ?? f.tienda });
      if (ns.has(f.sku) && !skus.has(f.sku)) skus.set(f.sku, { sku: f.sku, division: f.division || null });
    }
    return { cadenas, tiendas: [...tiendas.values()], skus: [...skus.values()] };
  }
  if (a.tipo === "u3") {
    const ns = new Set(r.nuevosSkus);
    const skus = new Map<string, { sku: string; descripcion: string | null; division: string | null; marca: string | null }>();
    for (const f of a.filas as FilaU3[]) if (f.sku && ns.has(f.sku) && !skus.has(f.sku)) skus.set(f.sku, { sku: f.sku, descripcion: f.descripcion, division: f.division, marca: f.marca });
    return { cadenas, tiendas: [], skus: [...skus.values()] };
  }
  return { cadenas: [], tiendas: [], skus: [] };
}
