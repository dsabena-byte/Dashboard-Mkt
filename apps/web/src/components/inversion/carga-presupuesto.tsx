"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ETAPAS, MESES, conceptosDeCuenta, etapaDe, normTxt, parseMonto, tipoDeVersion, type Etapa,
  type ItemCatalogo, type Linea, type LineaIn, type Tc, type Version,
} from "@/lib/presupuesto-core";

// Carga del presupuesto desde el tablero (/funnel/carga). Secciones: Gasto real · Tipos de cambio · Historial ·
// sin importación desde la pantalla (pedido del user: no pisar datos). Todo pasa por /api/presupuesto y queda en el historial.

type Seccion = "real" | "tc" | "historial";
interface Datos { usuario: { email: string; editor: boolean; puedeReal: boolean }; versiones: Version[]; tcs: Tc[]; catalogo: ItemCatalogo[]; lineas: Linea[] }
interface Movimiento { id: number; at: string; usuario: string | null; entidad: string; accion: string; version: string | null; clave: string | null; antes: Record<string, unknown> | null; despues: Record<string, unknown> | null }

const selectCls = "rounded-lg border bg-card px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30";
const inputCls = "w-full rounded-md border bg-card px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30";
const btnPri = "rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50";
const btn = "rounded border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50";
const MES_CAP = MESES.map((m) => m.charAt(0) + m.slice(1).toLowerCase());
const ars = (n: number) => `$ ${Math.round(n).toLocaleString("es-AR")}`;
const usdTxt = (n: number | null) => (n == null ? "falta TC" : `US$ ${Math.round(n).toLocaleString("es-AR")}`);

async function api<T>(url: string, init?: RequestInit): Promise<{ ok: boolean; status: number; data: T & { error?: string } }> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 45_000);
  try {
    const res = await fetch(url, { cache: "no-store", ...init, signal: ctl.signal, headers: init?.body && !(init.body instanceof FormData) ? { "Content-Type": "application/json" } : undefined });
    const data = (await res.json().catch(() => ({}))) as T & { error?: string };
    if (!res.ok && !data.error) data.error = `El servidor respondió ${res.status}. Probá de nuevo en un rato.`;
    return { ok: res.ok, status: res.status, data };
  } catch (e) {
    const msg = e instanceof Error && e.name === "AbortError" ? "Tardó demasiado en responder. Recargá la página." : "No hay conexión con el servidor. Recargá la página.";
    return { ok: false, status: 0, data: { error: msg } as T & { error?: string } };
  } finally { clearTimeout(t); }
}

export function CargaPresupuesto() {
  const router = useRouter();
  const [seccion, setSeccion] = useState<Seccion>("real");
  const [version, setVersion] = useState("");
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async (v: string) => {
    setCargando(true);
    const r = await api<Datos>(`/api/presupuesto?version=${encodeURIComponent(v)}`);
    setCargando(false);
    if (!r.ok) { setError(r.data.error ?? "No se pudo cargar."); return; }
    setError(null);
    setDatos(r.data);
    if (!v) {
      const real = r.data.versiones.filter((x) => x.tipo === "REAL").sort((a, b) => b.anio - a.anio)[0];
      if (real) { setVersion(real.nombre); void cargar(real.nombre); } else setVersion(`REAL ${new Date().getFullYear()}`);
    }
  }, []);
  useEffect(() => { void cargar(""); }, [cargar]);

  const recargar = useCallback(async () => { await cargar(version); router.refresh(); }, [cargar, version, router]);

  if (error) return <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{error}</div>;
  if (!datos) return <div className="text-sm text-muted-foreground">Cargando…</div>;

  const editor = datos.usuario.editor;
  // Sin nada cargado todavía: el gasto real del año en curso se crea con el primer renglón.
  const anioHoy = new Date().getFullYear();
  const versiones: Version[] = datos.versiones.some((v) => v.nombre === `REAL ${anioHoy}`)
    ? datos.versiones : [{ nombre: `REAL ${anioHoy}`, tipo: "REAL", anio: anioHoy, cerrada: false }, ...datos.versiones];
  const datosUI = { ...datos, versiones };
  const secciones: { key: Seccion; label: string }[] = [
    { key: "real", label: "Seguimiento de Gastos" },
    { key: "tc", label: "Tipos de cambio" },
    { key: "historial", label: "Historial de cambios" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {secciones.map((s) => (
          <button key={s.key} type="button" onClick={() => setSeccion(s.key)}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${seccion === s.key ? "bg-primary text-primary-foreground" : "bg-muted text-foreground hover:bg-muted/70"}`}>
            {s.label}
          </button>
        ))}
        <span className="ml-auto self-center text-[11px] text-muted-foreground">
          {datos.usuario.email} · {editor ? "puede cargar gastos reales, presupuestos y tipos de cambio" : "puede cargar gastos reales"}
        </span>
      </div>

      {seccion === "real" && version && (
        <Gastos datos={datosUI} version={version} cargando={cargando}
          onVersion={(v) => { setVersion(v); void cargar(v); }} onCambio={recargar} />
      )}
      {seccion === "tc" && <TiposDeCambio datos={datosUI} onCambio={recargar} />}
      {seccion === "historial" && <Historial versiones={datos.versiones} />}
    </div>
  );
}

// ======================================================================= Gastos
const VACIA = (version: string): LineaIn => ({
  version, mes: new Date().getMonth() + 1, ceco: "W014402001", cuenta: "", nombre_cta: "", concepto: "", nro_proveedor: null, proveedor: null,
  detalle: null, solped: null, oc: null, nro_recepcion: null, nro_doc_contable: null, fecha_contabilizacion: null, factura: null, provision: null, ars: 0,
});

function Gastos({ datos, version, cargando, onVersion, onCambio }: {
  datos: Datos; version: string; cargando: boolean; onVersion: (v: string) => void; onCambio: () => Promise<void>;
}) {
  const v = datos.versiones.find((x) => x.nombre === version);
  const puede = !!v && !v.cerrada && (v.tipo === "REAL" ? datos.usuario.puedeReal : datos.usuario.editor);
  const formRef = useRef<HTMLDivElement>(null);
  const editar = (l: Linea) => { setEditando(l); requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })); };
  const tcMes = useMemo(() => new Map(datos.tcs.filter((t) => t.version === version).map((t) => [t.mes, t.tc])), [datos.tcs, version]);
  const [filtros, setFiltros] = useState<Record<string, Filtro>>({});
  const [editando, setEditando] = useState<Linea | "nueva" | null>("nueva");
  const [nuevaN, setNuevaN] = useState(0);

  const filtradas = useMemo(() => datos.lineas.filter((l) => COLS.every((c) => pasaFiltro(filtros[c.key], c.get(l)))), [datos.lineas, filtros]);
  const hayFiltros = Object.values(filtros).some((f) => f.txt || f.sel);
  const usdDe = (l: Pick<Linea, "mes" | "ars">) => { const t = tcMes.get(l.mes); return t ? l.ars / t : null; };

  async function borrar(l: Linea) {
    if (!confirm(`¿Borrar el renglón de ${ars(l.ars)} (${l.proveedor ?? l.concepto})? Queda registrado en el historial.`)) return;
    const r = await api("/api/presupuesto/lineas", { method: "DELETE", body: JSON.stringify({ id: l.id }) });
    if (!r.ok) { alert(r.data.error ?? "No se pudo borrar."); return; }
    await onCambio();
  }

  async function exportar() {
    const XLSX = await import("xlsx");
    const aoa: unknown[][] = [["PRESUPUESTO", "CECO", "CUENTA", "NOMBRE CTA", "AÑO", "MES", "CONCEPTO", "NRO PROVEEDOR", "PROVEEDOR", "DETALLE", "SOLPED", "OC", "NRO RECEPCIÓN", "FECHA CONTABILIZACIÓN", "NRO DOC. CONTABLE", "FACTURA", "$", "USD", "PROVISIÓN", "CARGADO POR", "MODIFICADO"]];
    for (const l of filtradas) aoa.push([l.version, l.ceco, l.cuenta, l.nombre_cta, v?.anio, MESES[l.mes - 1], l.concepto, l.nro_proveedor, l.proveedor, l.detalle, l.solped, l.oc, l.nro_recepcion, l.fecha_contabilizacion, l.nro_doc_contable, l.factura, l.ars, usdDe(l), l.provision, l.created_by, l.updated_at?.slice(0, 10)]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), "Gastos");
    XLSX.writeFile(wb, `${version.replace(/[^a-z0-9+]+/gi, "-")}.xlsx`);
  }

  return (
    <section className="space-y-6">
      {v?.cerrada && <p className="text-xs text-muted-foreground">{v.nombre} está cerrada: se puede ver pero no modificar.</p>}
      {v && !v.cerrada && !puede && <p className="text-xs text-muted-foreground">Solo los editores del presupuesto pueden modificar {v.nombre}.</p>}

      {editando && puede && (
        <div ref={formRef}><FormLinea key={editando === "nueva" ? `nueva-${nuevaN}` : editando.id} datos={datos}
          inicial={editando === "nueva" ? VACIA(version) : editando} id={editando === "nueva" ? null : editando.id}
          onCerrar={() => setEditando(null)} onGuardado={async () => { if (editando === "nueva") setNuevaN((n) => n + 1); else setEditando("nueva"); await onCambio(); }} />
          {editando !== "nueva" && <button type="button" className="mt-1 text-[11px] text-red-600 hover:underline" onClick={async () => { await borrar(editando); setEditando("nueva"); }}>Borrar este renglón</button>}</div>
      )}
      {puede && editando !== "nueva" && <button type="button" className={btnPri} onClick={() => setEditando("nueva")}>+ Cargar un gasto nuevo</button>}

      <div className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2 border-t pt-4">
          <div>
            <h3 className="text-sm font-semibold">Seguimiento de Gastos</h3>
            <p className="text-xs text-muted-foreground">Todo lo cargado. Para completar (OC, factura, contabilización) o corregir un renglón, tocá ✎ al final. Cada cambio queda en el historial.</p>
          </div>
          <button type="button" className="text-xs text-primary hover:underline disabled:opacity-50" onClick={exportar} disabled={!filtradas.length}>Descargar esta lista en Excel</button>
        </div>
<div className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-muted-foreground">Ver<br />
          <select className={selectCls} value={version} onChange={(e) => { onVersion(e.target.value); setFiltros({}); }}>
            {["REAL", "BGT", "4+8", "8+4", "OTRO"].map((tipo) => {
              const vs = datos.versiones.filter((x) => x.tipo === tipo);
              return vs.length ? <optgroup key={tipo} label={tipo === "REAL" ? "Gasto real" : tipo === "OTRO" ? "Otros" : tipo}>{vs.map((x) => <option key={x.nombre} value={x.nombre}>{x.nombre}{x.cerrada ? " (cerrada)" : ""}</option>)}</optgroup> : null;
            })}
          </select>
        </label>
        <span className="pb-2 text-[11px] text-muted-foreground">Para filtrar, tocá ▾ en el título de cada columna (como en Excel).</span>
        {hayFiltros && <button type="button" className="pb-2 text-xs text-primary hover:underline" onClick={() => setFiltros({})}>Quitar todos los filtros</button>}
        {cargando && <span className="pb-2 text-xs text-muted-foreground">actualizando…</span>}
      </div>

      <div className="rounded-lg border">
        <table className="w-full table-fixed text-[11px]">
          <colgroup>{COLS.map((c) => <col key={c.key} style={{ width: c.w }} />)}<col style={{ width: "7%" }} /><col style={{ width: "3%" }} /></colgroup>
          <thead className="bg-muted/50 text-left text-[10px] uppercase tracking-wide text-muted-foreground">
            <tr>
              {COLS.map((c) => (
                <th key={c.key} className="px-1.5 py-2 font-semibold">
                  <ColFiltro label={c.label} valores={datos.lineas.map(c.get)} orden={c.orden} filtro={filtros[c.key]}
                    onChange={(f) => setFiltros((p) => ({ ...p, [c.key]: f }))} />
                </th>
              ))}
              <th className="px-1.5 py-2 text-right font-semibold">$ / USD</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filtradas.map((l) => (
              <tr key={l.id}
                className={`border-t align-top hover:bg-muted/30 ${editando !== "nueva" && editando?.id === l.id ? "bg-amber-50" : ""}`}>
                {COLS.map((c) => (
                  <td key={c.key} className="break-words px-1.5 py-1.5">
                    {c.get(l) || "—"}
                  </td>
                ))}
                <td className="px-1.5 py-1.5 text-right tabular-nums">{ars(l.ars)}<div className="text-[10px] text-muted-foreground">{usdTxt(usdDe(l))}</div></td>
                <td className="px-1 py-1.5 text-right">
                  {puede && <button type="button" title="Editar" aria-label="Editar renglón" className="text-base text-primary hover:opacity-70" onClick={() => editar(l)}>✎</button>}
                </td>
              </tr>
            ))}
            {!filtradas.length && <tr><td colSpan={COLS.length + 2} className="px-2 py-6 text-center text-muted-foreground">No hay renglones con estos filtros.</td></tr>}
          </tbody>
        </table>
      </div>
      </div>
    </section>
  );
}

// Columnas de la lista (orden de la planilla). get = texto que se ve y que se filtra.
// orden = cómo se ordenan los valores en el filtro (por defecto alfabético).
const COLS: { key: string; label: string; w: string; get: (l: Linea) => string; orden?: (v: string) => number }[] = [
  { key: "mes", label: "Mes", w: "6%", get: (l) => MES_CAP[l.mes - 1] ?? "", orden: (v) => MES_CAP.indexOf(v) },
  { key: "cuenta", label: "Cuenta", w: "10%", get: (l) => l.nombre_cta },
  { key: "concepto", label: "Concepto", w: "9%", get: (l) => l.concepto },
  { key: "proveedor", label: "Proveedor", w: "9%", get: (l) => l.proveedor ?? l.nro_proveedor ?? "" },
  { key: "detalle", label: "Detalle", w: "18%", get: (l) => l.detalle ?? "" },
  { key: "solped", label: "Solped", w: "7%", get: (l) => l.solped ?? "" },
  { key: "oc", label: "OC", w: "7%", get: (l) => l.oc ?? "" },
  { key: "recepcion", label: "Recepción", w: "7%", get: (l) => l.nro_recepcion ?? "" },
  { key: "contab", label: "Contabiliz.", w: "6%", get: (l) => (l.fecha_contabilizacion ? l.fecha_contabilizacion.split("-").reverse().join("/") : l.nro_doc_contable ? `doc ${l.nro_doc_contable}` : "") },
  { key: "factura", label: "Factura", w: "8%", get: (l) => l.factura ?? "" },
  { key: "provision", label: "Prov.", w: "4%", get: (l) => l.provision ?? "" },
];

interface Filtro { txt: string; sel: string[] | null }
const VACIO = "(vacías)";
function pasaFiltro(f: Filtro | undefined, valor: string): boolean {
  if (!f) return true;
  if (f.txt && !normTxt(valor).includes(normTxt(f.txt))) return false;
  return !f.sel || f.sel.includes(valor || VACIO);
}

/** Encabezado con filtro tipo Excel: buscar por texto + tildar valores. */
function ColFiltro({ label, valores, orden, filtro, onChange }: { label: string; valores: string[]; orden?: (v: string) => number; filtro?: Filtro; onChange: (f: Filtro) => void }) {
  const [abierto, setAbierto] = useState(false);
  const [busca, setBusca] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!abierto) return;
    const cerrar = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setAbierto(false); };
    document.addEventListener("mousedown", cerrar);
    return () => document.removeEventListener("mousedown", cerrar);
  }, [abierto]);
  const unicos = useMemo(() => [...new Set(valores.map((v) => v || VACIO))].sort((a, b) => (orden ? orden(a) - orden(b) : a.localeCompare(b, "es", { numeric: true }))), [valores, orden]);
  const visibles = unicos.filter((v) => !busca || normTxt(v).includes(normTxt(busca)));
  const f = filtro ?? { txt: "", sel: null };
  const activo = !!(f.txt || f.sel);
  const marcado = (v: string) => !f.sel || f.sel.includes(v);
  const toggle = (v: string) => {
    const base = f.sel ?? unicos;
    const sel = base.includes(v) ? base.filter((x) => x !== v) : [...base, v];
    onChange({ ...f, sel: sel.length === unicos.length ? null : sel });
  };
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setAbierto((a) => !a)} className={`flex w-full items-center gap-1 text-left uppercase ${activo ? "text-primary" : ""}`}>
        <span className="truncate">{label}</span><span aria-hidden>{activo ? "▼" : "▾"}</span>
      </button>
      {abierto && (
        <div className="absolute left-0 top-full z-30 mt-1 w-64 space-y-2 rounded-lg border bg-card p-2 text-xs normal-case tracking-normal text-foreground shadow-lg">
          <input autoFocus className={inputCls} placeholder="Buscar…" value={busca}
            onChange={(e) => { setBusca(e.target.value); onChange({ ...f, txt: e.target.value }); }} />
          <div className="flex justify-between text-[11px]">
            <button type="button" className="text-primary hover:underline" onClick={() => onChange({ ...f, sel: null })}>Seleccionar todo</button>
            <button type="button" className="text-primary hover:underline" onClick={() => { setBusca(""); onChange({ txt: "", sel: null }); }}>Quitar filtro</button>
          </div>
          <div className="max-h-56 space-y-0.5 overflow-y-auto">
            {visibles.map((v) => (
              <label key={v} className="flex cursor-pointer items-start gap-1.5 rounded px-1 py-0.5 hover:bg-muted">
                <input type="checkbox" className="mt-0.5" checked={marcado(v)} onChange={() => toggle(v)} />
                <span className="break-words">{v}</span>
              </label>
            ))}
            {!visibles.length && <div className="px-1 text-muted-foreground">Sin coincidencias</div>}
          </div>
        </div>
      )}
    </div>
  );
}

const ETAPA_CLS: Record<Etapa, string> = { sin_datos: "bg-muted text-muted-foreground", solped: "bg-slate-100 text-slate-700", oc: "bg-blue-50 text-blue-800", factura: "bg-amber-50 text-amber-800", contabilizado: "bg-emerald-50 text-emerald-800" };
function EtapaChip({ e }: { e: Etapa }) {
  const label = e === "sin_datos" ? "—" : ETAPAS.find((x) => x.key === e)!.label;
  return <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold ${ETAPA_CLS[e]}`}>{label}</span>;
}

// ======================================================================= Formulario de un renglón
// Afuera del formulario: definido adentro se re-crea en cada render y los inputs pierden el foco al tipear.
function L({ t, children, w = "" }: { t: string; children: React.ReactNode; w?: string }) {
  return <label className={`text-[11px] font-medium text-muted-foreground ${w}`}>{t}<div className="mt-0.5">{children}</div></label>;
}
function FormLinea({ datos, inicial, id, onCerrar, onGuardado }: {
  datos: Datos; inicial: LineaIn; id: string | null; onCerrar: () => void; onGuardado: () => Promise<void>;
}) {
  const [f, setF] = useState<LineaIn>(inicial);
  const [montoTxt, setMontoTxt] = useState(inicial.ars ? String(inicial.ars).replace(".", ",") : "");
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const set = <K extends keyof LineaIn>(k: K, val: LineaIn[K]) => setF((p) => ({ ...p, [k]: val }));
  const cat = (tipo: ItemCatalogo["tipo"]) => datos.catalogo.filter((c) => c.tipo === tipo);
  const cuentas = cat("cuenta"), conceptos = cat("concepto"), proveedores = cat("proveedor"), cecos = cat("ceco");
  // Cada cuenta tiene sus conceptos (CUENTA_CONCEPTOS); sin cuenta elegida, no se ofrece ninguno.
  const deCuenta = conceptosDeCuenta(f.cuenta);
  const conceptosOrd = !f.cuenta ? [] : deCuenta ? deCuenta.map((c) => ({ tipo: "concepto" as const, clave: c, nombre: c })) : conceptos;
  const provTxt = f.proveedor ?? "";
  const etapa = etapaDe(f);
  const tv = tipoDeVersion(f.version) ?? { tipo: "REAL" as const, anio: new Date().getFullYear() };
  const tipos = datos.usuario.editor ? (["REAL", "BGT", "4+8", "8+4"] as const) : (["REAL"] as const);
  const hoy = new Date().getFullYear();
  const anios = [...new Set([hoy - 1, hoy, hoy + 1, ...datos.versiones.map((v) => v.anio)])].sort((a, b) => b - a);
  const setVersion = (tipo: string, anio: number) => set("version", `${tipo} ${anio}`);

  function elegirProveedor(txt: string) {
    const t = normTxt(txt);
    const hit = proveedores.find((p) => normTxt(`${p.nombre} · ${p.clave}`) === t || normTxt(p.nombre) === t || p.clave === txt.trim());
    if (hit) setF((p) => ({ ...p, proveedor: hit.nombre, nro_proveedor: hit.clave }));
    else set("proveedor", txt || null);
  }

  async function guardar(force = false) {
    const monto = parseMonto(montoTxt);
    if (monto == null || monto === 0) { setMsg("Cargá el monto en pesos."); return; }
    setGuardando(true); setMsg(null);
    const linea = { ...f, ars: monto };
    const r = id
      ? await api<{ linea: Linea }>("/api/presupuesto/lineas", { method: "PATCH", body: JSON.stringify({ id, patch: linea }) })
      : await api<{ duplicados?: unknown[]; errores?: { error: string }[] }>("/api/presupuesto/lineas", { method: "POST", body: JSON.stringify({ lineas: [linea], force }) });
    setGuardando(false);
    if (r.status === 409 && !id && !force) {
      if (confirm("Ya hay un gasto con la misma factura, proveedor y monto. ¿Lo guardo igual?")) return guardar(true);
      return;
    }
    if (!r.ok) { setMsg((r.data as { errores?: { error: string }[] }).errores?.[0]?.error ?? r.data.error ?? "No se pudo guardar."); return; }
    await onGuardado();
  }

  return (
    <div className="space-y-3 rounded-xl border bg-card p-4 shadow-sm">
      <div className="text-sm font-semibold">{id ? `Editar renglón · ${f.version}` : "Cargar un gasto"}</div>
      {/* Mismo orden que la planilla de Seguimiento: presupuesto, CECO, cuenta, año, mes, concepto, proveedor, detalle,
          Solped, OC, recepción, contabilización, factura, $, provisión. */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <L t="Presupuesto *">
          <select className={inputCls} value={tv.tipo === "OTRO" ? "REAL" : tv.tipo} onChange={(e) => setVersion(e.target.value, tv.anio)}>
            {tipos.map((t) => <option key={t} value={t}>{t === "REAL" ? "Real (gasto)" : t}</option>)}
          </select>
        </L>
        <L t="CECO">
          <select className={inputCls} value={f.ceco} onChange={(e) => set("ceco", e.target.value)}>
            <option value="">—</option>
            {cecos.map((c) => <option key={c.clave} value={c.clave}>{c.clave}{c.nombre ? ` · ${c.nombre}` : ""}</option>)}
          </select>
        </L>
        <L t="Cuenta *" w="sm:col-span-2">
          <select className={inputCls} value={f.cuenta} onChange={(e) => {
            const c = cuentas.find((x) => x.clave === e.target.value);
            const validos = conceptosDeCuenta(e.target.value);
            setF((p) => ({ ...p, cuenta: e.target.value, nombre_cta: c?.nombre ?? p.nombre_cta,
              concepto: validos ? (validos.includes(p.concepto) ? p.concepto : validos.length === 1 ? validos[0]! : "") : p.concepto }));
          }}>
            <option value="">Elegí…</option>
            {cuentas.map((c) => <option key={c.clave} value={c.clave}>{c.clave} · {c.nombre}</option>)}
          </select>
        </L>
        <L t="Año *">
          <select className={inputCls} value={tv.anio} onChange={(e) => setVersion(tv.tipo === "OTRO" ? "REAL" : tv.tipo, Number(e.target.value))}>
            {anios.map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
        </L>
        <L t="Mes *"><select className={inputCls} value={f.mes} onChange={(e) => set("mes", Number(e.target.value))}>{MES_CAP.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select></L>
        <L t="Concepto *" w="sm:col-span-2">
          <select className={inputCls} value={f.concepto} onChange={(e) => set("concepto", e.target.value)} disabled={!f.cuenta}>
            <option value="">{f.cuenta ? "Elegí…" : "Primero elegí la cuenta"}</option>
            {conceptosOrd.map((c) => <option key={c.clave} value={c.clave}>{c.clave}</option>)}
          </select>
        </L>
        <L t="Nro proveedor"><input className={inputCls} value={f.nro_proveedor ?? ""} onChange={(e) => { const nro = e.target.value.trim(); const hit = proveedores.find((x) => x.clave === nro); setF((p) => ({ ...p, nro_proveedor: nro || null, proveedor: hit?.nombre ?? p.proveedor })); }} /></L>
        <L t="Proveedor" w="sm:col-span-1 lg:col-span-3">
          <input className={inputCls} list="ppto-proveedores" value={provTxt} onChange={(e) => elegirProveedor(e.target.value)} placeholder="Escribí y elegí de la lista; si es nuevo, escribilo" />
          <datalist id="ppto-proveedores">{proveedores.map((x) => <option key={x.clave} value={`${x.nombre} · ${x.clave}`} />)}</datalist>
        </L>
        <L t="Detalle" w="sm:col-span-2 lg:col-span-4"><input className={inputCls} value={f.detalle ?? ""} onChange={(e) => set("detalle", e.target.value || null)} /></L>
        {f.version.startsWith("REAL") && <>
          <L t="Solped"><input className={inputCls} value={f.solped ?? ""} onChange={(e) => set("solped", e.target.value || null)} /></L>
          <L t="OC"><input className={inputCls} value={f.oc ?? ""} onChange={(e) => set("oc", e.target.value || null)} /></L>
          <L t="Nro recepción"><input className={inputCls} value={f.nro_recepcion ?? ""} onChange={(e) => set("nro_recepcion", e.target.value || null)} /></L>
          <L t="Fecha contabilización"><input type="date" className={inputCls} value={f.fecha_contabilizacion ?? ""} onChange={(e) => set("fecha_contabilizacion", e.target.value || null)} /></L>
          <L t="Factura"><input className={inputCls} value={f.factura ?? ""} onChange={(e) => set("factura", e.target.value || null)} placeholder="00001-00000725" /></L>
        </>}
        <L t="$ (pesos) *"><input className={`${inputCls} text-right tabular-nums`} inputMode="decimal" value={montoTxt} onChange={(e) => setMontoTxt(e.target.value)} placeholder="1.810.000" /></L>
        {f.version.startsWith("REAL") && <L t="Provisión">
          <select className={inputCls} value={f.provision ?? ""} onChange={(e) => set("provision", (e.target.value || null) as LineaIn["provision"])}>
            <option value="">—</option><option value="SI">SI</option><option value="NO">NO</option>
          </select>
        </L>}
        {f.nro_doc_contable && <L t="Nro doc. contable (planilla vieja)"><input className={inputCls} value={f.nro_doc_contable} onChange={(e) => set("nro_doc_contable", e.target.value || null)} /></L>}
      </div>
      {f.version.startsWith("REAL") && <p className="text-[11px] text-muted-foreground">El gasto se carga con la Solped y se va completando: OC → recepción y factura → contabilización. Etapa actual: <EtapaChip e={etapa} /></p>}
      {msg && <p className="text-xs text-red-600">{msg}</p>}
      <div className="flex gap-2">
        <button type="button" className={btnPri} disabled={guardando} onClick={() => guardar()}>{guardando ? "Guardando…" : "Guardar"}</button>
        <button type="button" className={btn} onClick={onCerrar}>{id ? "Cancelar" : "Cerrar"}</button>
        <span className="self-center text-[11px] text-muted-foreground">{id ? "Cada cambio queda en el historial." : "Los dólares se calculan solos con el tipo de cambio del mes."}</span>
      </div>
    </div>
  );
}

// ======================================================================= Tipos de cambio
function TiposDeCambio({ datos, onCambio }: { datos: Datos; onCambio: () => Promise<void> }) {
  const editor = datos.usuario.editor;
  const base = useMemo(() => new Map(datos.tcs.map((t) => [`${t.version}|${t.mes}`, t.tc])), [datos.tcs]);
  const [fila, setFila] = useState<string | null>(null); // presupuesto en edición
  const [edit, setEdit] = useState<Record<number, string>>({});
  const [nuevas, setNuevas] = useState<string[]>([]);
  const hoy = new Date().getFullYear();
  const [nuevoTipo, setNuevoTipo] = useState<"BGT" | "4+8" | "8+4">("BGT");
  const [nuevoAnio, setNuevoAnio] = useState(hoy + 1);
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const versiones = [...datos.versiones.map((v) => v.nombre), ...nuevas.filter((n) => !datos.versiones.some((v) => v.nombre === n))];
  const cerrada = (n: string) => datos.versiones.find((v) => v.nombre === n)?.cerrada ?? false;
  const fmt = (n: number | undefined) => (n == null ? "—" : n.toLocaleString("es-AR", { maximumFractionDigits: 2 }));
  const nuevoNombre = `${nuevoTipo} ${nuevoAnio}`;
  const yaExiste = versiones.includes(nuevoNombre);

  function editar(n: string) {
    setFila(n); setMsg(null);
    setEdit(Object.fromEntries(MESES.map((_, i) => [i + 1, base.get(`${n}|${i + 1}`) != null ? String(base.get(`${n}|${i + 1}`)).replace(".", ",") : ""])));
  }
  async function guardar() {
    if (!fila) return;
    const cambios = Object.entries(edit).flatMap(([m, txt]) => {
      const tc = txt.trim() ? parseMonto(txt) : null;
      return tc === (base.get(`${fila}|${m}`) ?? null) ? [] : [{ version: fila, mes: Number(m), tc, invalido: txt.trim() !== "" && (tc == null || tc <= 0) }];
    });
    if (cambios.some((c) => c.invalido)) { setMsg("Hay valores que no son números válidos (ej. 1.522,50)."); return; }
    if (!cambios.length) { setFila(null); return; }
    setGuardando(true); setMsg(null);
    const r = await api("/api/presupuesto/tc", { method: "PUT", body: JSON.stringify({ cambios: cambios.map(({ invalido: _i, ...c }) => c) }) });
    setGuardando(false);
    if (!r.ok) { setMsg(r.data.error ?? "No se pudo guardar."); return; }
    setFila(null); setNuevas((p) => p.filter((x) => x !== fila));
    await onCambio();
  }
  async function toggleCerrada(n: string) {
    const c = cerrada(n);
    if (!confirm(c ? `¿Reabrir ${n}? Se va a poder modificar de nuevo.` : `¿Cerrar ${n}? Nadie va a poder modificar sus renglones ni sus tipos de cambio hasta reabrirla.`)) return;
    const r = await api("/api/presupuesto", { method: "POST", body: JSON.stringify({ accion: c ? "abrir" : "cerrar", version: n }) });
    if (!r.ok) { alert(r.data.error ?? "No se pudo."); return; }
    setFila(null);
    await onCambio();
  }

  return (
    <section className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Pesos por dólar de cada presupuesto y mes (los pasa finanzas). Los dólares = pesos ÷ este valor.
        {editor ? " Para cargar o cambiar, tocá ✎ al final de la fila." : " Solo los editores del presupuesto pueden cambiarlos."}
      </p>
      {editor && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Agregar presupuesto:</span>
          <select className={selectCls} value={nuevoTipo} onChange={(e) => setNuevoTipo(e.target.value as typeof nuevoTipo)}>
            {(["BGT", "4+8", "8+4"] as const).map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select className={selectCls} value={nuevoAnio} onChange={(e) => setNuevoAnio(Number(e.target.value))}>
            {[hoy + 1, hoy, hoy - 1].map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <button type="button" className={btn} disabled={yaExiste} onClick={() => { setNuevas((p) => [...p, nuevoNombre]); editar(nuevoNombre); }}>
            {yaExiste ? `${nuevoNombre} ya está` : "Agregar fila"}
          </button>
        </div>
      )}
      <div className="rounded-lg border">
        <table className="w-full table-fixed text-xs">
          <colgroup><col style={{ width: "12%" }} />{MESES.map((m) => <col key={m} />)}{editor && <col style={{ width: "9%" }} />}</colgroup>
          <thead className="bg-muted/50 text-[11px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-2 py-2 text-left">Presupuesto</th>
              {MES_CAP.map((m) => <th key={m} className="px-1 py-2 text-center">{m.slice(0, 3)}</th>)}
              {editor && <th />}
            </tr>
          </thead>
          <tbody>
            {versiones.map((n) => {
              const enEdicion = fila === n;
              return (
                <tr key={n} className={`border-t ${enEdicion ? "bg-amber-50/60" : ""}`}>
                  <td className="px-2 py-1.5 font-medium">{n}{cerrada(n) && <span className="ml-1 text-[10px] font-normal text-muted-foreground">(cerrada)</span>}</td>
                  {MESES.map((_, i) => (
                    <td key={i} className="px-1 py-1.5 text-center tabular-nums">
                      {enEdicion
                        ? <input className="w-full rounded border bg-card px-1 py-0.5 text-center tabular-nums" inputMode="decimal" value={edit[i + 1] ?? ""} onChange={(e) => setEdit((p) => ({ ...p, [i + 1]: e.target.value }))} />
                        : <span className={base.get(`${n}|${i + 1}`) == null ? "text-muted-foreground/50" : ""}>{fmt(base.get(`${n}|${i + 1}`))}</span>}
                    </td>
                  ))}
                  {editor && (
                    <td className="whitespace-nowrap px-1 py-1.5 text-right">
                      {enEdicion ? (
                        <>
                          <button type="button" className="font-semibold text-primary hover:underline disabled:opacity-50" disabled={guardando} onClick={guardar}>{guardando ? "…" : "Guardar"}</button>
                          <button type="button" title="Cancelar" className="ml-2 text-muted-foreground hover:underline" onClick={() => setFila(null)}>✕</button>
                        </>
                      ) : cerrada(n) ? (
                        <button type="button" title="Reabrir para editar" className="text-[11px] text-muted-foreground hover:underline" onClick={() => toggleCerrada(n)}>Reabrir</button>
                      ) : (
                        <button type="button" title="Editar" aria-label={`Editar ${n}`} className="text-base text-primary hover:opacity-70" onClick={() => editar(n)}>✎</button>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {fila && editor && datos.versiones.some((v) => v.nombre === fila) && (
        <button type="button" className="text-[11px] text-muted-foreground hover:underline" onClick={() => toggleCerrada(fila)}>Cerrar {fila} (que nadie lo modifique)</button>
      )}
      {msg && <p className="text-xs text-red-600">{msg}</p>}
    </section>
  );
}

// ======================================================================= Historial
const CAMPO_TXT: Record<string, string> = {
  version: "presupuesto", mes: "mes", ceco: "CECO", cuenta: "cuenta", nombre_cta: "nombre cta", concepto: "concepto", nro_proveedor: "nro proveedor",
  proveedor: "proveedor", detalle: "detalle", solped: "Solped", oc: "OC", nro_recepcion: "recepción", nro_doc_contable: "doc. contable",
  fecha_contabilizacion: "fecha contab.", factura: "factura", provision: "provisión", ars: "$", tc: "tipo de cambio", cerrada: "cerrada",
  total_ars: "total $", renglones: "renglones", tipo: "tipo", anio: "año",
};
const valTxt = (k: string, v: unknown) => (v == null || v === "" ? "—" : k === "ars" || k === "total_ars" ? ars(Number(v)) : k === "mes" ? MES_CAP[Number(v) - 1] ?? String(v) : String(v));

function describir(m: Movimiento): string {
  const que = m.entidad === "linea" ? "renglón" : m.entidad === "tc" ? `tipo de cambio ${MES_CAP[Number(m.clave) - 1] ?? ""}` : m.entidad === "importacion" ? "importación de la planilla" : "presupuesto";
  const acc: Record<string, string> = { alta: "Alta de", cambio: "Cambio en", baja: "Baja de", importacion: "", cierre: "Cierre del", apertura: "Reapertura del" };
  return `${acc[m.accion] ?? m.accion} ${que}`.trim();
}

function Historial({ versiones }: { versiones: Version[] }) {
  const [v, setV] = useState("");
  const [movs, setMovs] = useState<Movimiento[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setMovs(null);
    void api<{ movimientos: Movimiento[] }>(`/api/presupuesto?historial=1&version=${encodeURIComponent(v)}`).then((r) => {
      if (!r.ok) setError(r.data.error ?? "No se pudo leer el historial."); else { setError(null); setMovs(r.data.movimientos); }
    });
  }, [v]);
  return (
    <section className="space-y-3">
      <label className="text-xs text-muted-foreground">Presupuesto<br />
        <select className={selectCls} value={v} onChange={(e) => setV(e.target.value)}>
          <option value="">Todos</option>
          {versiones.map((x) => <option key={x.nombre} value={x.nombre}>{x.nombre}</option>)}
        </select>
      </label>
      {error && <p className="text-xs text-red-600">{error}</p>}
      {!movs && !error && <p className="text-xs text-muted-foreground">Cargando…</p>}
      {movs && (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[800px] text-xs">
            <thead className="bg-muted/50 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr><th className="px-2 py-2">Cuándo</th><th className="px-2 py-2">Quién</th><th className="px-2 py-2">Presupuesto</th><th className="px-2 py-2">Qué</th><th className="px-2 py-2">Detalle</th></tr>
            </thead>
            <tbody>
              {movs.map((m) => {
                const keys = [...new Set([...Object.keys(m.antes ?? {}), ...Object.keys(m.despues ?? {})])];
                const detalle = m.accion === "cambio" || m.entidad === "tc" || m.entidad === "importacion"
                  ? keys.map((k) => `${CAMPO_TXT[k] ?? k}: ${valTxt(k, m.antes?.[k])} → ${valTxt(k, m.despues?.[k])}`).join(" · ")
                  : (() => { const d = m.despues ?? m.antes ?? {}; return [d.proveedor ?? d.concepto, d.detalle, d.mes ? MES_CAP[Number(d.mes) - 1] : null, d.ars != null ? ars(Number(d.ars)) : null].filter(Boolean).join(" · "); })();
                return (
                  <tr key={m.id} className="border-t align-top">
                    <td className="whitespace-nowrap px-2 py-1.5 tabular-nums">{new Date(m.at).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}</td>
                    <td className="px-2 py-1.5">{m.usuario ?? "—"}</td>
                    <td className="px-2 py-1.5">{m.version ?? "—"}</td>
                    <td className="px-2 py-1.5">{describir(m)}</td>
                    <td className="px-2 py-1.5">{detalle}</td>
                  </tr>
                );
              })}
              {!movs.length && <tr><td colSpan={5} className="px-2 py-6 text-center text-muted-foreground">Todavía no hay cambios registrados.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
