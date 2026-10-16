"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ETAPAS, MESES, etapaDe, normTxt, parseMonto, parsePlanilla, type Etapa,
  type ItemCatalogo, type Linea, type LineaIn, type Tc, type Version,
} from "@/lib/presupuesto-core";

// Carga del presupuesto desde el tablero (/funnel/carga). Secciones: Gasto real · Tipos de cambio · Historial ·
// Importar planilla (editores). Todo pasa por /api/presupuesto; cada cambio queda en el historial.

type Seccion = "real" | "tc" | "historial" | "importar";
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
  const res = await fetch(url, { cache: "no-store", ...init, headers: init?.body && !(init.body instanceof FormData) ? { "Content-Type": "application/json" } : undefined });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  return { ok: res.ok, status: res.status, data };
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
    { key: "real", label: "Gastos" },
    { key: "tc", label: "Tipos de cambio" },
    { key: "historial", label: "Historial de cambios" },
    ...(editor ? [{ key: "importar" as const, label: "Traer histórico del Excel" }] : []),
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
      {seccion === "importar" && editor && <Importar onCambio={async () => { await cargar(""); router.refresh(); }} />}
    </div>
  );
}

// ======================================================================= Gastos
const VACIA = (version: string): LineaIn => ({
  version, mes: new Date().getMonth() + 1, ceco: "", cuenta: "", nombre_cta: "", concepto: "", nro_proveedor: null, proveedor: null,
  detalle: null, solped: null, oc: null, nro_recepcion: null, nro_doc_contable: null, fecha_contabilizacion: null, factura: null, provision: null, ars: 0,
});

function Gastos({ datos, version, cargando, onVersion, onCambio }: {
  datos: Datos; version: string; cargando: boolean; onVersion: (v: string) => void; onCambio: () => Promise<void>;
}) {
  const v = datos.versiones.find((x) => x.nombre === version);
  const puede = !!v && !v.cerrada && (v.tipo === "REAL" ? datos.usuario.puedeReal : datos.usuario.editor);
  const formRef = useRef<HTMLDivElement>(null);
  const editar = (l: Linea) => { setEditando(l); setPegar(false); requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })); };
  const tcMes = useMemo(() => new Map(datos.tcs.filter((t) => t.version === version).map((t) => [t.mes, t.tc])), [datos.tcs, version]);
  const [mes, setMes] = useState(0);
  const [cuenta, setCuenta] = useState("");
  const [q, setQ] = useState("");
  const [etapaF, setEtapaF] = useState<Etapa | "">("");
  const [editando, setEditando] = useState<Linea | "nueva" | null>("nueva");
  const [pegar, setPegar] = useState(false);
  const [nuevaN, setNuevaN] = useState(0);

  const filtradas = useMemo(() => {
    const t = normTxt(q);
    return datos.lineas.filter((l) =>
      (!mes || l.mes === mes) && (!cuenta || l.nombre_cta === cuenta) && (!etapaF || etapaDe(l) === etapaF) &&
      (!t || normTxt([l.proveedor, l.nro_proveedor, l.detalle, l.oc, l.solped, l.factura, l.nro_recepcion, l.concepto].join(" ")).includes(t)));
  }, [datos.lineas, mes, cuenta, q, etapaF]);
  const cuentas = useMemo(() => [...new Set(datos.lineas.map((l) => l.nombre_cta).filter(Boolean))].sort(), [datos.lineas]);
  const usdDe = (l: Pick<Linea, "mes" | "ars">) => { const t = tcMes.get(l.mes); return t ? l.ars / t : null; };
  const totArs = filtradas.reduce((s, l) => s + l.ars, 0);
  const sinTc = filtradas.some((l) => !tcMes.get(l.mes));
  const totUsd = filtradas.reduce((s, l) => s + (usdDe(l) ?? 0), 0);

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
    <section className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs text-muted-foreground">Presupuesto<br />
          <select className={selectCls} value={version} onChange={(e) => { onVersion(e.target.value); setEditando(null); setPegar(false); }}>
            {["REAL", "BGT", "4+8", "8+4", "OTRO"].map((tipo) => {
              const vs = datos.versiones.filter((x) => x.tipo === tipo);
              return vs.length ? <optgroup key={tipo} label={tipo === "REAL" ? "Gasto real" : tipo === "OTRO" ? "Otros" : tipo}>{vs.map((x) => <option key={x.nombre} value={x.nombre}>{x.nombre}{x.cerrada ? " (cerrada)" : ""}</option>)}</optgroup> : null;
            })}
          </select>
        </label>
        <label className="text-xs text-muted-foreground">Mes<br />
          <select className={selectCls} value={mes} onChange={(e) => setMes(Number(e.target.value))}>
            <option value={0}>Todos</option>
            {MES_CAP.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
        </label>
        <label className="text-xs text-muted-foreground">Cuenta<br />
          <select className={selectCls} value={cuenta} onChange={(e) => setCuenta(e.target.value)}>
            <option value="">Todas</option>
            {cuentas.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        {v?.tipo === "REAL" && (
          <label className="text-xs text-muted-foreground">Etapa<br />
            <select className={selectCls} value={etapaF} onChange={(e) => setEtapaF(e.target.value as Etapa | "")}>
              <option value="">Todas</option>
              {ETAPAS.map((x) => <option key={x.key} value={x.key}>{x.label === "Solped" ? "Solo Solped (falta OC)" : x.label === "OC emitida" ? "Con OC (falta factura)" : x.label === "Facturado" ? "Facturado (falta contabilizar)" : "Contabilizado"}</option>)}
            </select>
          </label>
        )}
        <label className="min-w-[200px] flex-1 text-xs text-muted-foreground">Buscar (proveedor, detalle, OC, Solped, factura)<br />
          <input className={inputCls} value={q} onChange={(e) => setQ(e.target.value)} placeholder="ej. OMD, 9501302505…" />
        </label>
        {puede && editando !== "nueva" && <button type="button" className={btnPri} onClick={() => { setEditando("nueva"); setPegar(false); }}>+ Cargar {v?.tipo === "REAL" ? "gasto" : "renglón"}</button>}
        {puede && <button type="button" className={btn} onClick={() => { setPegar((p) => !p); setEditando(null); }}>Pegar desde Excel</button>}
        <button type="button" className={btn} onClick={exportar} disabled={!filtradas.length}>Exportar a Excel</button>
      </div>

      {v?.cerrada && <p className="text-xs text-muted-foreground">{v.nombre} está cerrada: se puede ver pero no modificar.</p>}
      {v && !v.cerrada && !puede && <p className="text-xs text-muted-foreground">Solo los editores del presupuesto pueden modificar {v.nombre}.</p>}

      {editando && puede && (
        <div ref={formRef}><FormLinea key={editando === "nueva" ? `nueva-${nuevaN}` : editando.id} datos={datos}
          inicial={editando === "nueva" ? VACIA(version) : editando} id={editando === "nueva" ? null : editando.id}
          onCerrar={() => setEditando(null)} onGuardado={async () => { if (editando === "nueva") setNuevaN((n) => n + 1); else setEditando("nueva"); await onCambio(); }} /></div>
      )}
      {pegar && <Pegar datos={datos} version={version} onCerrar={() => setPegar(false)} onGuardado={async () => { setPegar(false); await onCambio(); }} />}

      <div className="flex flex-wrap gap-4 rounded-lg border bg-card px-4 py-2 text-sm">
        <span><b>{filtradas.length}</b> renglones</span>
        <span>Total <b className="tabular-nums">{ars(totArs)}</b></span>
        <span>≈ <b className="tabular-nums">{usdTxt(totUsd)}</b>{sinTc && <span className="ml-1 text-amber-700">(hay meses sin tipo de cambio)</span>}</span>
        {cargando && <span className="text-muted-foreground">actualizando…</span>}
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[1100px] text-xs">
          <thead className="bg-muted/50 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
            <tr>{["Mes", "Etapa", "Cuenta", "Concepto", "Proveedor", "Detalle", "Solped", "OC", "Recepción", "Contabiliz.", "Factura", "Prov.", "$", "USD", ""].map((h) => <th key={h} className="px-2 py-2 font-semibold">{h}</th>)}</tr>
          </thead>
          <tbody>
            {filtradas.map((l) => (
              <tr key={l.id} onClick={puede ? () => editar(l) : undefined} title={puede ? "Tocá para editar" : undefined}
                className={`border-t align-top hover:bg-muted/30 ${puede ? "cursor-pointer" : ""} ${editando !== "nueva" && editando?.id === l.id ? "bg-amber-50" : ""}`}>
                <td className="px-2 py-1.5">{MES_CAP[l.mes - 1]}</td>
                <td className="px-2 py-1.5"><EtapaChip e={etapaDe(l)} /></td>
                <td className="px-2 py-1.5" title={l.cuenta}>{l.nombre_cta}</td>
                <td className="px-2 py-1.5">{l.concepto}</td>
                <td className="px-2 py-1.5" title={l.nro_proveedor ?? ""}>{l.proveedor ?? l.nro_proveedor ?? "—"}</td>
                <td className="max-w-[260px] px-2 py-1.5">{l.detalle ?? "—"}</td>
                <td className="px-2 py-1.5 tabular-nums">{l.solped ?? "—"}</td>
                <td className="px-2 py-1.5 tabular-nums">{l.oc ?? "—"}</td>
                <td className="px-2 py-1.5 tabular-nums">{l.nro_recepcion ?? "—"}</td>
                <td className="px-2 py-1.5 tabular-nums" title={l.nro_doc_contable ? `Doc. contable ${l.nro_doc_contable}` : ""}>{l.fecha_contabilizacion ? l.fecha_contabilizacion.split("-").reverse().join("/") : l.nro_doc_contable ? `doc ${l.nro_doc_contable}` : "—"}</td>
                <td className="px-2 py-1.5">{l.factura ?? "—"}</td>
                <td className="px-2 py-1.5">{l.provision ?? "—"}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{ars(l.ars)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">{usdTxt(usdDe(l))}</td>
                <td className="whitespace-nowrap px-2 py-1.5 text-right">
                  {puede && <>
                    <button type="button" className="text-primary hover:underline" onClick={(e) => { e.stopPropagation(); editar(l); }}>Editar</button>
                    <button type="button" className="ml-2 text-red-600 hover:underline" onClick={(e) => { e.stopPropagation(); void borrar(l); }}>Borrar</button>
                  </>}
                </td>
              </tr>
            ))}
            {!filtradas.length && <tr><td colSpan={15} className="px-2 py-6 text-center text-muted-foreground">No hay renglones con estos filtros.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const ETAPA_CLS: Record<Etapa, string> = { sin_datos: "bg-muted text-muted-foreground", solped: "bg-slate-100 text-slate-700", oc: "bg-blue-50 text-blue-800", factura: "bg-amber-50 text-amber-800", contabilizado: "bg-emerald-50 text-emerald-800" };
function EtapaChip({ e }: { e: Etapa }) {
  const label = e === "sin_datos" ? "—" : ETAPAS.find((x) => x.key === e)!.label;
  return <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold ${ETAPA_CLS[e]}`}>{label}</span>;
}

// ======================================================================= Formulario de un renglón
// Afuera del formulario: definido adentro se re-crea en cada render y los inputs pierden el foco al tipear.
function Paso({ n, titulo, hecho, actual, children }: { n: number; titulo: string; hecho: boolean; actual: boolean; children: React.ReactNode }) {
  return (
    <div className={`space-y-2 rounded-lg border p-2.5 ${actual ? "border-amber-400 bg-amber-50/60" : hecho ? "bg-emerald-50/50" : "bg-muted/20"}`}>
      <div className="flex items-center gap-1.5 text-xs font-semibold">
        <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${hecho ? "bg-emerald-600 text-white" : actual ? "bg-amber-500 text-white" : "bg-muted text-muted-foreground"}`}>{hecho ? "✓" : n}</span>
        {titulo}{actual && <span className="ml-auto text-[10px] font-medium text-amber-700">siguiente paso</span>}
      </div>
      {children}
    </div>
  );
}
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
  // Conceptos ya usados con la cuenta elegida, primero.
  const usados = new Set(datos.lineas.filter((l) => l.cuenta === f.cuenta).map((l) => l.concepto));
  const conceptosOrd = [...conceptos].sort((a, b) => Number(usados.has(b.clave)) - Number(usados.has(a.clave)) || a.clave.localeCompare(b.clave));
  const provTxt = f.proveedor ?? "";
  const etapa = etapaDe(f);

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
      <div className="text-sm font-semibold">{id ? `Editar renglón · ${f.version}` : `Cargar ${f.version.startsWith("REAL") ? "un gasto" : "un renglón"} · ${f.version}`}</div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <L t="Mes *"><select className={inputCls} value={f.mes} onChange={(e) => set("mes", Number(e.target.value))}>{MES_CAP.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select></L>
        <L t="Cuenta *">
          <select className={inputCls} value={f.cuenta} onChange={(e) => { const c = cuentas.find((x) => x.clave === e.target.value); setF((p) => ({ ...p, cuenta: e.target.value, nombre_cta: c?.nombre ?? p.nombre_cta })); }}>
            <option value="">Elegí…</option>
            {cuentas.map((c) => <option key={c.clave} value={c.clave}>{c.nombre} ({c.clave})</option>)}
          </select>
        </L>
        <L t="Concepto *">
          <select className={inputCls} value={f.concepto} onChange={(e) => set("concepto", e.target.value)}>
            <option value="">Elegí…</option>
            {conceptosOrd.map((c) => <option key={c.clave} value={c.clave}>{c.clave}</option>)}
          </select>
        </L>
        <L t="CECO">
          <select className={inputCls} value={f.ceco} onChange={(e) => set("ceco", e.target.value)}>
            <option value="">—</option>
            {cecos.map((c) => <option key={c.clave} value={c.clave}>{c.nombre ? `${c.nombre} (${c.clave})` : c.clave}</option>)}
          </select>
        </L>
        <L t="Proveedor (nombre o número)" w="sm:col-span-2">
          <input className={inputCls} list="ppto-proveedores" value={provTxt} onChange={(e) => elegirProveedor(e.target.value)} placeholder="Escribí y elegí de la lista; si es nuevo, escribilo" />
          <datalist id="ppto-proveedores">{proveedores.map((p) => <option key={p.clave} value={`${p.nombre} · ${p.clave}`} />)}</datalist>
        </L>
        <L t="Nro proveedor"><input className={inputCls} value={f.nro_proveedor ?? ""} onChange={(e) => set("nro_proveedor", e.target.value || null)} /></L>
        <L t={f.version.startsWith("REAL") ? "Monto en pesos * (el de la Solped; actualizalo con la factura)" : "Monto en pesos *"}><input className={`${inputCls} text-right tabular-nums`} inputMode="decimal" value={montoTxt} onChange={(e) => setMontoTxt(e.target.value)} placeholder="1.810.000" /></L>
        <L t="Detalle" w="sm:col-span-2 lg:col-span-4"><input className={inputCls} value={f.detalle ?? ""} onChange={(e) => set("detalle", e.target.value || null)} /></L>
      </div>
      {f.version.startsWith("REAL") ? (
        <div className="space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Circuito del gasto · completá cada paso cuando ocurra</div>
          <div className="grid gap-2 lg:grid-cols-4">
            <Paso n={1} titulo="Solped" hecho={!!f.solped} actual={etapa === "sin_datos"}>
              <L t="Nro de Solped"><input className={inputCls} value={f.solped ?? ""} onChange={(e) => set("solped", e.target.value || null)} /></L>
            </Paso>
            <Paso n={2} titulo="Orden de compra" hecho={!!f.oc} actual={etapa === "solped"}>
              <L t="Nro de OC"><input className={inputCls} value={f.oc ?? ""} onChange={(e) => set("oc", e.target.value || null)} /></L>
            </Paso>
            <Paso n={3} titulo="Recepción y factura" hecho={!!(f.factura || f.nro_recepcion)} actual={etapa === "oc"}>
              <L t="Nro de recepción"><input className={inputCls} value={f.nro_recepcion ?? ""} onChange={(e) => set("nro_recepcion", e.target.value || null)} /></L>
              <L t="Factura"><input className={inputCls} value={f.factura ?? ""} onChange={(e) => set("factura", e.target.value || null)} placeholder="00001-00000725" /></L>
            </Paso>
            <Paso n={4} titulo="Contabilización" hecho={!!(f.fecha_contabilizacion || f.nro_doc_contable)} actual={etapa === "factura"}>
              <L t="Fecha de contabilización"><input type="date" className={inputCls} value={f.fecha_contabilizacion ?? ""} onChange={(e) => set("fecha_contabilizacion", e.target.value || null)} /></L>
              {f.nro_doc_contable && <L t="Nro doc. contable (de la planilla)"><input className={inputCls} value={f.nro_doc_contable} onChange={(e) => set("nro_doc_contable", e.target.value || null)} /></L>}
              <L t="Provisión">
                <select className={inputCls} value={f.provision ?? ""} onChange={(e) => set("provision", (e.target.value || null) as LineaIn["provision"])}>
                  <option value="">—</option><option value="SI">Sí</option><option value="NO">No</option>
                </select>
              </L>
            </Paso>
          </div>
          <p className="text-[11px] text-muted-foreground">Si el monto final de la factura es distinto al de la Solped, actualizalo arriba: el cambio queda en el historial.</p>
        </div>
      ) : null}
      {msg && <p className="text-xs text-red-600">{msg}</p>}
      <div className="flex gap-2">
        <button type="button" className={btnPri} disabled={guardando} onClick={() => guardar()}>{guardando ? "Guardando…" : "Guardar"}</button>
        <button type="button" className={btn} onClick={onCerrar}>{id ? "Cancelar" : "Cerrar"}</button>
        <span className="self-center text-[11px] text-muted-foreground">{id ? "Cada cambio queda en el historial." : "Los dólares se calculan solos con el tipo de cambio del mes."}</span>
      </div>
    </div>
  );
}

// ======================================================================= Pegar desde Excel
function Pegar({ datos, version, onCerrar, onGuardado }: { datos: Datos; version: string; onCerrar: () => void; onGuardado: () => Promise<void> }) {
  const [txt, setTxt] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const cuentas = useMemo(() => datos.catalogo.filter((c) => c.tipo === "cuenta"), [datos.catalogo]);
  const res = useMemo(() => {
    if (!txt.trim()) return null;
    const aoa = txt.replace(/\r/g, "").split("\n").map((l) => l.split("\t"));
    const r = parsePlanilla(aoa, { versionPorDefecto: version });
    // Completa código ↔ nombre de cuenta con el catálogo.
    for (const l of r.lineas) {
      if (l.cuenta && !l.nombre_cta) l.nombre_cta = cuentas.find((c) => c.clave === l.cuenta)?.nombre ?? "";
      if (!l.cuenta && l.nombre_cta) l.cuenta = cuentas.find((c) => normTxt(c.nombre) === normTxt(l.nombre_cta))?.clave ?? "";
    }
    const otras = r.lineas.filter((l) => l.version !== version).length;
    return { ...r, otras };
  }, [txt, version, cuentas]);

  async function guardar(force = false) {
    if (!res?.lineas.length) return;
    setGuardando(true); setMsg(null);
    const r = await api<{ errores?: { fila: number; error: string }[]; duplicados?: { fila: number; factura: string }[] }>("/api/presupuesto/lineas", { method: "POST", body: JSON.stringify({ lineas: res.lineas, force }) });
    setGuardando(false);
    if (r.status === 409 && !force) {
      const d = r.data.duplicados ?? [];
      if (confirm(`${d.length} renglón(es) parecen repetidos (misma factura, proveedor y monto): ${d.slice(0, 5).map((x) => `fila ${x.fila} factura ${x.factura}`).join("; ")}. ¿Guardo todo igual?`)) return guardar(true);
      return;
    }
    if (!r.ok) { setMsg(r.data.errores?.length ? r.data.errores.slice(0, 5).map((e) => `Fila ${e.fila}: ${e.error}`).join(" · ") : r.data.error ?? "No se pudo guardar."); return; }
    await onGuardado();
  }

  return (
    <div className="space-y-3 rounded-xl border bg-card p-4 shadow-sm">
      <div className="text-sm font-semibold">Pegar renglones desde Excel · {version}</div>
      <p className="text-xs text-muted-foreground">
        En el Excel seleccioná las filas (mejor con la fila de títulos: PRESUPUESTO, CECO, CUENTA, NOMBRE CTA, AÑO, MES, CONCEPTO, NRO PROVEEDOR, PROVEEDOR, DETALLE, SOLPED, OC, NRO RECEPCIÓN, FECHA CONTABILIZ, FACTURA, $), copiá y pegá acá. La columna USD se ignora.
      </p>
      <textarea className={`${inputCls} h-40 font-mono text-[11px]`} value={txt} onChange={(e) => setTxt(e.target.value)} placeholder="Pegá acá (Ctrl+V)" />
      {res && (
        <div className="space-y-1 text-xs">
          <div><b>{res.lineas.length}</b> renglones listos · total <b>{ars(res.lineas.reduce((s, l) => s + l.ars, 0))}</b>{res.omitidas ? ` · ${res.omitidas} filas vacías o sin monto` : ""}</div>
          {res.otras > 0 && <div className="text-amber-700">{res.otras} renglones son de otro presupuesto (columna PRESUPUESTO): se guardan en el suyo.</div>}
          {res.errores.slice(0, 8).map((e) => <div key={e.fila} className="text-red-600">Fila {e.fila}: {e.error}</div>)}
          {res.errores.length > 8 && <div className="text-red-600">…y {res.errores.length - 8} errores más</div>}
        </div>
      )}
      {msg && <p className="text-xs text-red-600">{msg}</p>}
      <div className="flex gap-2">
        <button type="button" className={btnPri} disabled={guardando || !res?.lineas.length || !!res?.errores.length} onClick={() => guardar()}>{guardando ? "Guardando…" : `Guardar ${res?.lineas.length ?? 0} renglones`}</button>
        <button type="button" className={btn} onClick={onCerrar}>Cancelar</button>
      </div>
    </div>
  );
}

// ======================================================================= Tipos de cambio
function TiposDeCambio({ datos, onCambio }: { datos: Datos; onCambio: () => Promise<void> }) {
  const editor = datos.usuario.editor;
  const base = useMemo(() => new Map(datos.tcs.map((t) => [`${t.version}|${t.mes}`, t.tc])), [datos.tcs]);
  const [edit, setEdit] = useState<Record<string, string>>({});
  const [nuevas, setNuevas] = useState<string[]>([]);
  const [nueva, setNueva] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const versiones = [...datos.versiones.map((v) => v.nombre), ...nuevas.filter((n) => !datos.versiones.some((v) => v.nombre === n))];
  const cerrada = (n: string) => datos.versiones.find((v) => v.nombre === n)?.cerrada ?? false;
  const valor = (k: string) => edit[k] ?? (base.get(k) != null ? String(base.get(k)).replace(".", ",") : "");
  const cambios = Object.entries(edit).flatMap(([k, s]) => {
    const [version, mes] = k.split("|");
    const tc = s.trim() ? parseMonto(s) : null;
    const antes = base.get(k) ?? null;
    return tc === antes ? [] : [{ version: version!, mes: Number(mes), tc, invalido: s.trim() !== "" && (tc == null || tc <= 0) }];
  });

  async function guardar() {
    if (cambios.some((c) => c.invalido)) { setMsg("Hay valores que no son números válidos."); return; }
    setGuardando(true); setMsg(null);
    const r = await api("/api/presupuesto/tc", { method: "PUT", body: JSON.stringify({ cambios: cambios.map(({ invalido: _i, ...c }) => c) }) });
    setGuardando(false);
    if (!r.ok) { setMsg(r.data.error ?? "No se pudo guardar."); return; }
    setEdit({}); setNuevas([]);
    await onCambio();
  }
  async function toggleCerrada(n: string) {
    const c = cerrada(n);
    if (!confirm(c ? `¿Reabrir ${n}? Se va a poder modificar de nuevo.` : `¿Cerrar ${n}? Nadie va a poder modificar sus renglones ni sus tipos de cambio hasta reabrirla.`)) return;
    const r = await api("/api/presupuesto", { method: "POST", body: JSON.stringify({ accion: c ? "abrir" : "cerrar", version: n }) });
    if (!r.ok) { alert(r.data.error ?? "No se pudo."); return; }
    await onCambio();
  }

  return (
    <section className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Un tipo de cambio por presupuesto y por mes (pesos por dólar), el que pasa finanzas. Los dólares de cada renglón = pesos ÷ este valor.
        {!editor && " Solo los editores del presupuesto pueden cambiarlos."}
      </p>
      {editor && <TcRapido versiones={versiones} base={base} onCambio={onCambio} />}
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Todos los tipos de cambio</div>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[1100px] text-xs">
          <thead className="bg-muted/50 text-[11px] uppercase tracking-wide text-muted-foreground">
            <tr><th className="px-2 py-2 text-left">Presupuesto</th>{MES_CAP.map((m) => <th key={m} className="px-1 py-2 text-right">{m.slice(0, 3)}</th>)}{editor && <th />}</tr>
          </thead>
          <tbody>
            {versiones.map((n) => (
              <tr key={n} className="border-t">
                <td className="whitespace-nowrap px-2 py-1 font-medium">{n}{cerrada(n) && <span className="ml-1 text-[10px] text-muted-foreground">(cerrada)</span>}</td>
                {MESES.map((_, i) => {
                  const k = `${n}|${i + 1}`;
                  return (
                    <td key={k} className="px-1 py-1">
                      <input className={`w-[72px] rounded border bg-card px-1 py-1 text-right tabular-nums ${edit[k] !== undefined ? "border-amber-400" : ""} ${!valor(k) ? "bg-amber-50" : ""}`}
                        value={valor(k)} disabled={!editor || cerrada(n)} inputMode="decimal"
                        onChange={(e) => setEdit((p) => ({ ...p, [k]: e.target.value }))} />
                    </td>
                  );
                })}
                {editor && <td className="px-2 py-1">{datos.versiones.some((v) => v.nombre === n) && <button type="button" className="text-[11px] text-primary hover:underline" onClick={() => toggleCerrada(n)}>{cerrada(n) ? "Reabrir" : "Cerrar"}</button>}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editor && (
        <div className="flex flex-wrap items-center gap-2">
          <input className={`${inputCls} w-48`} value={nueva} onChange={(e) => setNueva(e.target.value)} placeholder="Nuevo presupuesto (ej. BGT 2027)" />
          <button type="button" className={btn} disabled={!/\b20\d{2}\b/.test(nueva)} onClick={() => { setNuevas((p) => [...p, nueva.trim().toUpperCase()]); setNueva(""); }}>Agregar fila</button>
          <button type="button" className={btnPri} disabled={guardando || !cambios.length} onClick={guardar}>{guardando ? "Guardando…" : `Guardar ${cambios.length} cambio(s)`}</button>
          {msg && <span className="text-xs text-red-600">{msg}</span>}
          <span className="text-[11px] text-muted-foreground">Las celdas amarillas no tienen tipo de cambio: sus dólares salen en 0 en el tablero.</span>
        </div>
      )}
    </section>
  );
}

/** Carga de a uno: presupuesto + mes + valor → Guardar. */
function TcRapido({ versiones, base, onCambio }: { versiones: string[]; base: Map<string, number>; onCambio: () => Promise<void> }) {
  const [version, setVersion] = useState(versiones[0] ?? `REAL ${new Date().getFullYear()}`);
  const [otra, setOtra] = useState("");
  const [mes, setMes] = useState(new Date().getMonth() + 1);
  const [valor, setValor] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const nombre = version === "__otra" ? otra.trim().toUpperCase() : version;
  const actual = base.get(`${nombre}|${mes}`);
  async function guardar() {
    const tc = parseMonto(valor);
    if (!/\b20\d{2}\b/.test(nombre)) { setMsg("Escribí el presupuesto con su año (ej. BGT 2027)."); return; }
    if (tc == null || tc <= 0) { setMsg("Escribí un tipo de cambio válido (ej. 1.522,50)."); return; }
    setGuardando(true); setMsg(null);
    const r = await api("/api/presupuesto/tc", { method: "PUT", body: JSON.stringify({ cambios: [{ version: nombre, mes, tc }] }) });
    setGuardando(false);
    if (!r.ok) { setMsg(r.data.error ?? "No se pudo guardar."); return; }
    setMsg(`Guardado: ${nombre} · ${MES_CAP[mes - 1]} = ${tc.toLocaleString("es-AR")}`); setValor("");
    await onCambio();
  }
  return (
    <div className="flex flex-wrap items-end gap-2 rounded-xl border bg-card p-4 shadow-sm">
      <div className="w-full text-sm font-semibold">Cargar un tipo de cambio</div>
      <label className="text-xs text-muted-foreground">Presupuesto<br />
        <select className={selectCls} value={version} onChange={(e) => setVersion(e.target.value)}>
          {versiones.map((v) => <option key={v} value={v}>{v}</option>)}
          <option value="__otra">Otro (nuevo)…</option>
        </select>
      </label>
      {version === "__otra" && <label className="text-xs text-muted-foreground">Nombre<br /><input className={`${inputCls} w-36`} value={otra} onChange={(e) => setOtra(e.target.value)} placeholder="BGT 2027" /></label>}
      <label className="text-xs text-muted-foreground">Mes<br />
        <select className={selectCls} value={mes} onChange={(e) => setMes(Number(e.target.value))}>{MES_CAP.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select>
      </label>
      <label className="text-xs text-muted-foreground">Pesos por dólar<br />
        <input className={`${inputCls} w-32 text-right tabular-nums`} inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder={actual ? String(actual).replace(".", ",") : "1.522,50"} />
      </label>
      <button type="button" className={btnPri} disabled={guardando || !valor.trim()} onClick={guardar}>{guardando ? "Guardando…" : actual ? "Reemplazar" : "Guardar"}</button>
      <span className="text-[11px] text-muted-foreground">{actual ? `Hoy: ${actual.toLocaleString("es-AR")}` : "Todavía sin valor"}</span>
      {msg && <span className="w-full text-xs">{msg}</span>}
    </div>
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

// ======================================================================= Importar planilla
interface Vista { vistaPrevia?: boolean; totales?: Record<string, number>; renglones?: Record<string, number>; errores?: ({ fila: number; error: string } | string)[]; omitidas?: number; catalogo?: number; tcs?: Tc[]; hoja?: string }

function Importar({ onCambio }: { onCambio: () => Promise<void> }) {
  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <Subida tipo="planilla" titulo="Histórico de la planilla de Seguimiento"
        ayuda='Opcional y por única vez: trae al tablero el histórico de la planilla de Seguimiento (hoja "Planilla carga BGT - Facturas") con proveedores, Solped, OC y facturas, y las listas de "Menu Desplegable". Lo que ya cargaste a mano en el tablero se mantiene. Solo se toman los pesos.'
        onCambio={onCambio} />
      <Subida tipo="tc" titulo="Plantilla de tipos de cambio"
        ayuda="Una fila por mes y una columna por presupuesto (la plantilla que te pasamos). Las celdas vacías no se tocan."
        onCambio={onCambio} />
    </section>
  );
}

function Subida({ tipo, titulo, ayuda, onCambio }: { tipo: "planilla" | "tc"; titulo: string; ayuda: string; onCambio: () => Promise<void> }) {
  const [file, setFile] = useState<File | null>(null);
  const [vista, setVista] = useState<Vista | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  async function enviar(confirmar: boolean) {
    if (!file) return;
    setBusy(true); setMsg(null);
    const fd = new FormData();
    fd.set("archivo", file); fd.set("tipo", tipo); if (confirmar) fd.set("confirmar", "1");
    const r = await api<Vista & { ok?: boolean; cambios?: number; versiones?: Record<string, { antes: number; despues: number; renglones: number }> }>("/api/presupuesto/importar", { method: "POST", body: fd });
    setBusy(false);
    if (!r.ok) { setMsg(r.data.error ?? "No se pudo procesar el archivo."); return; }
    if (confirmar) {
      setMsg(tipo === "tc" ? `Listo: ${r.data.cambios ?? 0} tipos de cambio guardados.` : `Listo: ${Object.keys(r.data.versiones ?? {}).length} presupuestos importados.`);
      setVista(null); setFile(null);
      await onCambio();
    } else setVista(r.data);
  }
  const errores = vista?.errores ?? [];
  return (
    <div className="space-y-3 rounded-xl border bg-card p-4 shadow-sm">
      <div className="text-sm font-semibold">{titulo}</div>
      <p className="text-xs text-muted-foreground">{ayuda}</p>
      <input type="file" accept=".xlsx,.xls" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setVista(null); setMsg(null); }} className="text-xs" />
      <div className="flex gap-2">
        <button type="button" className={btn} disabled={!file || busy} onClick={() => enviar(false)}>{busy && !vista ? "Leyendo…" : "Ver qué se va a cargar"}</button>
        {vista && <button type="button" className={btnPri} disabled={busy} onClick={() => { if (tipo === "tc" || confirm("Se reemplazan los renglones de los presupuestos que trae el archivo. Queda registrado en el historial. ¿Seguimos?")) void enviar(true); }}>{busy ? "Guardando…" : "Confirmar y guardar"}</button>}
      </div>
      {vista?.totales && (
        <table className="w-full text-xs">
          <thead className="text-left text-[11px] uppercase text-muted-foreground"><tr><th className="py-1">Presupuesto</th><th className="py-1 text-right">Renglones</th><th className="py-1 text-right">Total $</th></tr></thead>
          <tbody>{Object.keys(vista.totales).sort().map((k) => <tr key={k} className="border-t"><td className="py-1">{k}</td><td className="py-1 text-right tabular-nums">{vista.renglones?.[k]}</td><td className="py-1 text-right tabular-nums">{ars(vista.totales![k]!)}</td></tr>)}</tbody>
        </table>
      )}
      {vista?.tcs && <p className="text-xs"><b>{vista.tcs.length}</b> tipos de cambio en {new Set(vista.tcs.map((t) => t.version)).size} presupuestos.</p>}
      {vista && vista.omitidas ? <p className="text-[11px] text-muted-foreground">{vista.omitidas} filas vacías o sin monto (no se cargan).</p> : null}
      {errores.length > 0 && (
        <div className="space-y-0.5 text-xs text-red-600">
          <div>{errores.length} filas con problemas {tipo === "planilla" ? "(no se cargan)" : "(corregilas para poder guardar)"}:</div>
          {errores.slice(0, 10).map((e, i) => <div key={i}>{typeof e === "string" ? e : `Fila ${e.fila}: ${e.error}`}</div>)}
        </div>
      )}
      {msg && <p className="text-xs font-medium">{msg}</p>}
    </div>
  );
}
