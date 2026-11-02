"use client";
import { useEffect, useMemo, useState } from "react";
import { CATEGORIAS_AACC, MESES_AACC, type Acuerdo, type CategoriaAacc, type Email, type FilaProvision, type MesResumen } from "@/lib/aacc-core";
import type { AaccDatos } from "@/lib/aacc-server";

// Pestaña «AACC» de Mkt Canal: acuerdos por cliente (BGT), provisión mensual → mail a Finanzas, provisión real y falta liquidar.
const MES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const $ = (n: number | null | undefined) => (n == null ? "—" : `$ ${Math.round(n).toLocaleString("es-AR")}`);
const card = "space-y-3 rounded-xl border bg-card p-4";
const btn = "rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted disabled:opacity-50";
const btnPri = "rounded-md bg-[#1e40af] px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50";
const inp = "rounded border bg-background px-2 py-1 text-sm";
type Datos = AaccDatos & { editor: boolean };

async function api(body: unknown) {
  const r = await fetch("/api/mkt-canal/aacc", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j.error || `Error ${r.status}`), { data: j });
  return j;
}

export function AaccTab({ anio }: { anio: number }) {
  const [d, setD] = useState<Datos | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const cargar = () => fetch(`/api/mkt-canal/aacc?anio=${anio}`).then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error); setD(j); }).catch((e) => setErr(e.message));
  useEffect(() => { void cargar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [anio]);
  if (err) return <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</p>;
  if (!d) return <p className="text-sm text-muted-foreground">Cargando AACC…</p>;
  return (
    <div className="space-y-4">
      <Provision anio={anio} d={d} onCambio={cargar} />
      <Resumen d={d} />
      <Acuerdos anio={anio} d={d} onCambio={cargar} />
      <Destinatarios anio={anio} d={d} onCambio={cargar} />
    </div>
  );
}

function Provision({ anio, d, onCambio }: { anio: number; d: Datos; onCambio: () => void }) {
  const hoy = new Date();
  const [mes, setMes] = useState(anio === hoy.getFullYear() ? hoy.getMonth() : 11);
  const [filas, setFilas] = useState<FilaProvision[] | null>(null);
  const [sinImporte, setSinImporte] = useState(false);
  const [email, setEmail] = useState<Email | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const cerrado = anio < hoy.getFullYear() || (anio === hoy.getFullYear() && mes < hoy.getMonth());
  const key = `${anio}-${String(mes + 1).padStart(2, "0")}`;
  const yaGenerada = d.mensual.filter((m) => m.mes === key);
  const correr = async (accion: "calcular" | "generar" | "real") => {
    if (accion === "real" && !confirm(`¿Guardar la provisión REAL de ${MESES_AACC[mes]}? Reemplaza la que haya para ese mes.`)) return;
    if (accion === "generar" && yaGenerada.length && !confirm(`Ya hay una provisión de ${MESES_AACC[mes]} generada. ¿Reemplazarla con los datos de hoy?`)) return;
    setBusy(true); setMsg(null); setEmail(null);
    try {
      const j = await api({ accion, anio, mes });
      setFilas(j.filas); setSinImporte(!!j.sinImporte);
      if (accion === "generar") { setEmail(j.email); onCambio(); }
      if (accion === "real") { setMsg(`Provisión real de ${MESES_AACC[mes]} guardada.`); onCambio(); }
    } catch (e) {
      const data = (e as { data?: { filas?: FilaProvision[]; sinImporte?: boolean } }).data;
      if (data?.filas) { setFilas(data.filas); setSinImporte(!!data.sinImporte); }
      setMsg((e as Error).message);
    } finally { setBusy(false); }
  };
  const copiar = async () => {
    if (!email) return;
    try {
      await navigator.clipboard.write([new ClipboardItem({ "text/html": new Blob([email.html], { type: "text/html" }), "text/plain": new Blob([email.texto], { type: "text/plain" }) })]);
      setMsg("Mail copiado: pegalo en Outlook.");
    } catch { await navigator.clipboard.writeText(email.texto); setMsg("Copiado como texto (el navegador no permitió copiar el formato)."); }
  };
  const total = filas?.reduce((s, f) => s + f.aacc, 0) ?? 0;
  return (
    <section className={card}>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="mr-auto text-base font-semibold">Provisión del mes</h3>
        <select className={inp} value={mes} onChange={(e) => { setMes(Number(e.target.value)); setFilas(null); setEmail(null); setMsg(null); }}>
          {MESES_AACC.map((m, i) => <option key={m} value={i}>{m} {anio}</option>)}
        </select>
        <button className={btn} disabled={busy} onClick={() => correr("calcular")}>Ver cálculo</button>
        {d.editor && <button className={btnPri} disabled={busy} onClick={() => correr("generar")}>Generar provisión</button>}
        {d.editor && cerrado && <button className={btn} disabled={busy} onClick={() => correr("real")}>Guardar provisión real</button>}
      </div>
      <p className="text-xs text-muted-foreground">
        <b>Generar provisión</b> calcula con la facturación a hoy (solo facturado, sin back order), guarda la foto como «Provisión mensual» y arma el mail
        para Finanzas. <b>Guardar provisión real</b> (meses cerrados) recalcula con la facturación del mes calendario completo: es el monto para la Solped y la OC.
        {yaGenerada.length > 0 && <> Provisión de {MESES_AACC[mes]} generada el {new Date(yaGenerada[0]!.generado_at).toLocaleString("es-AR")}.</>}
      </p>
      {sinImporte && <p className="rounded-md bg-amber-50 p-2 text-xs text-amber-800">La facturación en $ todavía no llega a la base (falta sumar el importe al Office Script de CB Sell In): los acuerdos por % quedan sin calcular.</p>}
      {msg && <p className="text-sm text-[#1e40af]">{msg}</p>}
      {filas && (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground"><tr>{["Cliente", "Categorías", "Acuerdo", "Facturación", "AACC", ""].map((h) => <th key={h} className="px-3 py-1.5 text-left font-medium">{h}</th>)}</tr></thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.cliente} className="border-t">
                  <td className="px-3 py-1.5">{f.razon_social}</td><td className="px-3 py-1.5">{f.categorias}</td><td className="px-3 py-1.5">{f.acuerdo}</td>
                  <td className="px-3 py-1.5 tabular-nums">{$(f.facturacion)}</td><td className="px-3 py-1.5 font-semibold tabular-nums">{$(f.aacc)}</td>
                  <td className="px-3 py-1.5 text-xs text-amber-700">{f.aviso}</td>
                </tr>
              ))}
              <tr className="border-t bg-muted/30 font-semibold"><td className="px-3 py-1.5" colSpan={4}>Total</td><td className="px-3 py-1.5 tabular-nums">{$(total)}</td><td /></tr>
            </tbody>
          </table>
        </div>
      )}
      {email && (
        <div className="space-y-2 rounded-lg border p-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="mr-auto text-sm"><b>{email.asunto}</b> · Para: {d.destinatarios.para.join(", ") || "—"}{d.destinatarios.cc.length ? ` · CC: ${d.destinatarios.cc.join(", ")}` : ""}</p>
            <a className={btnPri} href={`/api/mkt-canal/aacc?anio=${anio}&mes=${mes}&eml=1`}>Abrir en Outlook</a>
            <button className={btn} onClick={copiar}>Copiar mail</button>
          </div>
          <p className="text-xs text-muted-foreground">«Abrir en Outlook» baja el mail como borrador (.eml) con destinatarios, asunto y tablas: abrilo, revisalo, adjuntá lo que haga falta y tocá Enviar.</p>
          <div className="max-h-[520px] overflow-auto rounded border bg-white p-3" dangerouslySetInnerHTML={{ __html: email.html }} />
        </div>
      )}
    </section>
  );
}

// Grilla por cliente × mes (como la planilla «Tablero de liquidación de AACC»): cada celda = AACC del mes (provisión real, o la
// mensual si el mes no cerró); negro = liquidado (factura recepcionada en Inversión), ROJO = falta liquidar / presentar factura.
function Resumen({ d }: { d: Datos }) {
  const { clientes, celda } = useMemo(() => {
    const idx = (mes: string) => Number(mes.slice(5, 7)) - 1;
    const prov = new Map<string, number[]>(), liq = new Map<string, number[]>();
    const add = (m: Map<string, number[]>, c: string, i: number, v: number) => { const a = m.get(c) ?? Array(12).fill(0); a[i] += v; m.set(c, a); };
    const conReal = new Set(d.real.map((r) => idx(r.mes)));
    for (const r of d.real) add(prov, r.cliente, idx(r.mes), r.aacc);
    for (const m of d.mensual) if (!conReal.has(idx(m.mes)) && m.cliente !== "(total planilla)") add(prov, m.cliente, idx(m.mes), m.aacc);
    for (const l of d.liquidado) add(liq, l.cliente, idx(l.mes), l.monto);
    const orden = new Map(d.acuerdos.map((a, i) => [a.cliente, i]));
    const clientes = [...new Set([...prov.keys(), ...liq.keys()])].sort((a, b) => (orden.get(a) ?? 99) - (orden.get(b) ?? 99) || a.localeCompare(b, "es"));
    const celda = (c: string, i: number) => {
      const p = prov.get(c)?.[i] ?? 0, l = liq.get(c)?.[i] ?? 0;
      return { prov: p, liq: Math.min(l, p || l), falta: Math.max(0, p - l) };
    };
    return { clientes, celda };
  }, [d]);
  const sumCli = (c: string) => Array.from({ length: 12 }, (_, i) => celda(c, i)).reduce((a, x) => ({ liq: a.liq + x.liq, falta: a.falta + x.falta }), { liq: 0, falta: 0 });
  const Celda = ({ liq, falta }: { liq: number; falta: number }) => (
    <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums">
      {liq > 0 && <div>{$(liq)}</div>}
      {falta > 0 && <div className="rounded bg-red-50 px-1 font-semibold text-red-700" title="Falta liquidar: el cliente no presentó la factura o no está recepcionada en Inversión">{$(falta)}</div>}
      {liq <= 0 && falta <= 0 && <span className="text-muted-foreground/50">—</span>}
    </td>
  );
  const tot = (f: (r: MesResumen) => number | null) => d.resumen.reduce((s, r) => s + (f(r) ?? 0), 0);
  const filasTot: [string, (r: MesResumen) => number | null][] = [
    ["Provisión mensual", (r) => r.provMensual], ["Provisión real", (r) => r.provReal], ["Diferencia real vs mensual", (r) => r.diferencia],
  ];
  const sinCliente = d.liquidado.filter((l) => l.cliente === "(sin cliente)");
  return (
    <section className={card}>
      <h3 className="text-base font-semibold">Liquidación por cliente</h3>
      <p className="text-xs text-muted-foreground">
        Cada celda es el AACC del mes (provisión real, o la mensual si el mes no cerró). En negro, lo <b>liquidado</b>; en <b className="text-red-700">rojo</b>,
        lo que <b>falta liquidar</b> (el cliente no presentó la factura o no está recepcionada). Lo liquidado sale de{" "}
        <a className="underline" href="/funnel/carga">Inversión de Marketing → Cargar datos</a>: gastos de la cuenta 6202010084 (Acciones compartidas) con Nº de recepción.
      </p>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[1200px] text-xs">
          <thead className="bg-[#44546a] text-white"><tr><th className="px-2 py-1.5 text-left">Cliente</th>{MES.map((m) => <th key={m} className="px-2 py-1.5 text-right">{m}</th>)}<th className="px-2 py-1.5 text-right">Año</th></tr></thead>
          <tbody>
            {clientes.map((c) => {
              const s = sumCli(c);
              return (
                <tr key={c} className="border-t align-top">
                  <td className="whitespace-nowrap px-2 py-1.5 font-medium">{c}</td>
                  {MES.map((_, i) => <Celda key={i} {...celda(c, i)} />)}
                  <Celda liq={s.liq} falta={s.falta} />
                </tr>
              );
            })}
            <tr className="border-t-2 border-[#44546a] bg-muted/40 font-semibold">
              <td className="px-2 py-1.5">Total liquidado</td>
              {d.resumen.map((r) => <td key={r.mes} className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums">{r.liquidado ? $(r.liquidado) : ""}</td>)}
              <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums">{$(tot((r) => r.liquidado))}</td>
            </tr>
            {filasTot.map(([t, f]) => (
              <tr key={t} className="border-t bg-muted/20">
                <td className="whitespace-nowrap px-2 py-1.5 font-medium">{t}</td>
                {d.resumen.map((r) => <td key={r.mes} className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums">{f(r) == null ? "" : $(f(r))}</td>)}
                <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums">{$(tot(f))}</td>
              </tr>
            ))}
            <tr className="border-t bg-red-50/60 font-semibold text-red-700">
              <td className="px-2 py-1.5">Falta liquidar</td>
              {d.resumen.map((r) => <td key={r.mes} className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums">{r.faltaLiquidar > 0 ? $(r.faltaLiquidar) : ""}</td>)}
              <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums">{$(tot((r) => r.faltaLiquidar))}</td>
            </tr>
          </tbody>
        </table>
      </div>
      {sinCliente.length > 0 && (
        <p className="text-xs text-amber-700">
          {sinCliente.length} gasto(s) de AACC recepcionados en Inversión no se pudieron asignar a un cliente (proveedor: {[...new Set(sinCliente.map((l) => l.proveedor ?? "sin proveedor"))].join(", ")}):
          cargá ese proveedor en el acuerdo del cliente.
        </p>
      )}
    </section>
  );
}

function Acuerdos({ anio, d, onCambio }: { anio: number; d: Datos; onCambio: () => void }) {
  const [lista, setLista] = useState<Acuerdo[]>(d.acuerdos);
  const [msg, setMsg] = useState<string | null>(null);
  const [cambios, setCambios] = useState(false);
  useEffect(() => { setLista(d.acuerdos); setCambios(false); }, [d.acuerdos]);
  const ro = !d.editor;
  const set = (i: number, p: Partial<Acuerdo>) => { setLista(lista.map((a, j) => (j === i ? { ...a, ...p } : a))); setCambios(true); };
  const guardar = async () => { setMsg(null); try { await api({ accion: "acuerdos", anio, acuerdos: lista }); setMsg("Acuerdos guardados."); onCambio(); } catch (e) { setMsg((e as Error).message); } };
  const nuevo = () => { setLista([...lista, { anio, cliente: "", razon_social: "", cliente_sap: null, proveedor: null, tipo: "fijo", pct: null, categorias: [], montos: Array(12).fill(0), orden: lista.length }]); setCambios(true); };
  return (
    <section className={card}>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="mr-auto text-base font-semibold">Acuerdos {anio} por cliente (BGT)</h3>
        {!ro && <button className={btn} onClick={nuevo}>+ Cliente</button>}
        {!ro && <button className={btnPri} disabled={!cambios} onClick={guardar}>Guardar acuerdos</button>}
      </div>
      <p className="text-xs text-muted-foreground">Monto fijo: lo acordado por mes ($ M). % de facturación: se aplica a lo facturado (sin back order) del mes calendario en las categorías elegidas; sin categorías = todas. «Cliente en facturación» = el nombre tal cual figura en el Excel de FC.</p>
      {msg && <p className="text-sm text-[#1e40af]">{msg}</p>}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[1400px] text-xs">
          <thead className="bg-muted/50 text-muted-foreground"><tr>
            <th className="px-2 py-1.5 text-left font-medium">Cliente</th><th className="px-2 py-1.5 text-left font-medium">Razón social (mail) · proveedor</th><th className="px-2 py-1.5 text-left font-medium">Acuerdo</th>
            {MES.map((m) => <th key={m} className="px-1 py-1.5 text-right font-medium">{m} ($ M)</th>)}<th className="px-2 py-1.5 text-right font-medium">Año</th>{!ro && <th />}
          </tr></thead>
          <tbody>{lista.map((a, i) => (
            <tr key={i} className="border-t align-top">
              <td className="px-2 py-1"><input disabled={ro} className={`${inp} w-28 text-xs`} value={a.cliente} onChange={(e) => set(i, { cliente: e.target.value })} /></td>
              <td className="px-2 py-1"><input disabled={ro} className={`${inp} w-44 text-xs`} value={a.razon_social} onChange={(e) => set(i, { razon_social: e.target.value })} />
                <input disabled={ro} placeholder="Proveedor en Inversión (nº o nombre)" title="Con este Nº o nombre de proveedor se cargan sus facturas en Inversión de Marketing" className={`${inp} mt-1 w-44 text-xs`} value={a.proveedor ?? ""} onChange={(e) => set(i, { proveedor: e.target.value || null })} /></td>
              <td className="px-2 py-1">
                <select disabled={ro} className={`${inp} text-xs`} value={a.tipo} onChange={(e) => set(i, { tipo: e.target.value as Acuerdo["tipo"] })}><option value="fijo">Monto fijo</option><option value="pct">% de facturación</option></select>
                {a.tipo === "pct" && (
                  <div className="mt-1 space-y-1">
                    <label className="block">% <input disabled={ro} type="number" step="0.1" className={`${inp} w-16 text-xs`} value={a.pct ?? ""} onChange={(e) => set(i, { pct: Number(e.target.value) || null })} /></label>
                    <input disabled={ro} placeholder="Cliente en facturación" className={`${inp} w-44 text-xs`} value={a.cliente_sap ?? ""} onChange={(e) => set(i, { cliente_sap: e.target.value || null })} />
                    <div className="flex flex-wrap gap-1">{CATEGORIAS_AACC.map((c) => (
                      <label key={c} className="flex items-center gap-0.5"><input disabled={ro} type="checkbox" checked={a.categorias.includes(c)} onChange={(e) => set(i, { categorias: e.target.checked ? [...a.categorias, c] : a.categorias.filter((x) => x !== c) as CategoriaAacc[] })} />{c}</label>
                    ))}</div>
                  </div>
                )}
              </td>
              {a.montos.map((v, m) => (
                <td key={m} className="px-1 py-1">{a.tipo === "fijo"
                  ? <input disabled={ro} type="number" min={0} step="any" className={`${inp} w-16 text-right text-xs`} value={v ? +(v / 1e6).toFixed(3) : ""} placeholder="0" onChange={(e) => set(i, { montos: a.montos.map((x, j) => (j === m ? Math.round(Math.max(0, Number(e.target.value) || 0) * 1e6) : x)) })} />
                  : <span className="text-muted-foreground">{a.pct ? `${a.pct}%` : ""}</span>}</td>
              ))}
              <td className="px-2 py-1 text-right tabular-nums">{a.tipo === "fijo" ? $(a.montos.reduce((s, x) => s + x, 0)) : "—"}</td>
              {!ro && <td className="px-1 py-1"><button className="text-muted-foreground hover:text-red-600" title="Quitar" onClick={() => { if (confirm(`¿Quitar ${a.cliente || "este acuerdo"}?`)) { setLista(lista.filter((_, j) => j !== i)); setCambios(true); } }}>✕</button></td>}
            </tr>
          ))}</tbody>
        </table>
      </div>
    </section>
  );
}

function Destinatarios({ anio, d, onCambio }: { anio: number; d: Datos; onCambio: () => void }) {
  const [para, setPara] = useState(d.destinatarios.para.join(", "));
  const [cc, setCc] = useState(d.destinatarios.cc.join(", "));
  const [msg, setMsg] = useState<string | null>(null);
  if (!d.editor) return null;
  const guardar = async () => { setMsg(null); try { await api({ accion: "destinatarios", anio, destinatarios: { para, cc } }); setMsg("Guardado."); onCambio(); } catch (e) { setMsg((e as Error).message); } };
  return (
    <section className={card}>
      <h3 className="text-base font-semibold">Destinatarios del mail a Finanzas</h3>
      <div className="grid gap-2 md:grid-cols-2">
        <label className="text-xs">Para<br /><input className={`${inp} w-full`} value={para} onChange={(e) => setPara(e.target.value)} placeholder="nombre@mabe.com.ar, …" /></label>
        <label className="text-xs">CC<br /><input className={`${inp} w-full`} value={cc} onChange={(e) => setCc(e.target.value)} placeholder="nombre@mabe.com.ar, …" /></label>
      </div>
      <div className="flex items-center gap-2"><button className={btn} onClick={guardar}>Guardar destinatarios</button>{msg && <span className="text-sm text-[#1e40af]">{msg}</span>}</div>
    </section>
  );
}
