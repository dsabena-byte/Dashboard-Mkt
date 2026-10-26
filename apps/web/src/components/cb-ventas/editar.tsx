"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ClienteDb } from "@/lib/cb-ventas/server";
import { CATEGORIAS, TIPOLOGIAS, type CatalogoRow } from "@/lib/cb-ventas/core";

// Edición puntual de CB Ventas (solo editores del área trade; el server vuelve a chequear y audita todo).
// "Copiar mes anterior" no existe: la app vieja tenía UN solo cuadro básico vigente (el último CSV), sin meses.

async function enviar(body: Record<string, unknown>): Promise<{ ok: boolean; error?: string; vistaPrevia?: Record<string, number>; resumen?: Record<string, number> }> {
  const r = await fetch("/api/cb-ventas/editar", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  return r.ok ? { ok: true, ...j } : { ok: false, error: j.error ?? `Error ${r.status}` };
}

const inp = "rounded border border-slate-300 px-2 py-1 text-sm";
const btn = "rounded bg-[#1e40af] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50";
const btn2 = "rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50";
const CAT_LABEL: Record<string, string> = { LAVADO: "Lavado", REFRIGERACION: "Refrigeración", COCCION: "Cocción" };

function SubirCsv({ accion, titulo, ayuda }: { accion: "clientes_csv" | "catalogo_csv"; titulo: string; ayuda: string }) {
  const router = useRouter();
  const [csv, setCsv] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [prev, setPrev] = useState<Record<string, number> | null>(null);
  const leer = async (f: File | undefined) => {
    setMsg(null); setPrev(null);
    if (!f) return;
    const buf = new Uint8Array(await f.arrayBuffer());
    let t = new TextDecoder("utf-8").decode(buf);
    if (t.includes("�")) t = new TextDecoder("latin1").decode(buf);
    setCsv(t);
    setBusy(true);
    const r = await enviar({ accion, csv: t });
    setBusy(false);
    if (r.ok && r.vistaPrevia) setPrev(r.vistaPrevia); else setMsg(r.error ?? "No se pudo leer el archivo.");
  };
  const confirmar = async () => {
    setBusy(true);
    const r = await enviar({ accion, csv, confirmar: true });
    setBusy(false);
    setPrev(null);
    setMsg(r.ok ? "Listo: se reemplazó con el archivo." : r.error ?? "Error");
    if (r.ok) router.refresh();
  };
  return (
    <details className="rounded-lg border bg-white p-3 text-sm">
      <summary className="cursor-pointer font-medium text-slate-800">{titulo}</summary>
      <p className="mt-2 text-xs text-slate-500">{ayuda}</p>
      <input type="file" accept=".csv,text/csv" className="mt-2 text-sm" disabled={busy} onChange={(e) => leer(e.target.files?.[0])} />
      {prev && (
        <div className="mt-2 rounded bg-amber-50 p-2 text-xs text-amber-900">
          Vista previa: {Object.entries(prev).map(([k, v]) => `${k}: ${v}`).join(" · ")}. Esto <b>reemplaza todo</b> lo cargado.
          <div className="mt-2 flex gap-2">
            <button className={btn} disabled={busy} onClick={confirmar}>Confirmar y reemplazar</button>
            <button className={btn2} onClick={() => setPrev(null)}>Cancelar</button>
          </div>
        </div>
      )}
      {msg && <p className="mt-2 text-xs text-slate-700">{msg}</p>}
    </details>
  );
}

export function EditarClientes({ clientes }: { clientes: ClienteDb[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<Partial<ClienteDb> & { pesoPct?: string } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const lista = useMemo(() => clientes.filter((c) => !q || `${c.cliente} ${c.vendedor} ${c.gerencia}`.toLowerCase().includes(q.toLowerCase())), [clientes, q]);
  const guardar = async () => {
    if (!edit) return;
    const r = await enviar({ accion: "cliente_guardar", ...edit, peso: Number((edit.pesoPct ?? "0").replace(",", ".")) / 100 });
    setMsg(r.ok ? "Guardado." : r.error ?? "Error");
    if (r.ok) { setEdit(null); router.refresh(); }
  };
  const borrar = async (cliente: string) => {
    if (!confirm(`¿Sacar a ${cliente} de la lista? Deja de contar en CB Ventas.`)) return;
    const r = await enviar({ accion: "cliente_borrar", cliente });
    setMsg(r.ok ? "Cliente sacado." : r.error ?? "Error");
    if (r.ok) router.refresh();
  };
  return (
    <div className="space-y-3">
      <SubirCsv accion="clientes_csv" titulo="Subir la planilla de Clasificación de clientes" ayuda="El mismo CSV de siempre (ID; CLIENTE; PESO FACTURACION; TIPOLOGIA; VENDEDOR; GERENCIA). Reemplaza la lista completa." />
      <div className="flex flex-wrap items-center gap-2">
        <input className={inp} placeholder="Buscar cliente, vendedor o gerencia" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className={btn} onClick={() => setEdit({ cliente: "", tipologia: "SMALL RETAILERS", vendedor: "", gerencia: "", pesoPct: "0", id_sap: "" })}>+ Agregar cliente</button>
        <span className="text-xs text-slate-500">{lista.length} de {clientes.length} clientes</span>
      </div>
      {msg && <p className="text-xs text-slate-700">{msg}</p>}
      {edit && (
        <div className="grid gap-2 rounded-lg border bg-white p-3 text-sm sm:grid-cols-3">
          <label>Razón social<input className={`${inp} w-full`} value={edit.cliente ?? ""} disabled={clientes.some((c) => c.cliente === edit.cliente) && !!edit.orden} onChange={(e) => setEdit({ ...edit, cliente: e.target.value })} /></label>
          <label>ID SAP<input className={`${inp} w-full`} value={edit.id_sap ?? ""} onChange={(e) => setEdit({ ...edit, id_sap: e.target.value })} /></label>
          <label>Tipología<select className={`${inp} w-full`} value={edit.tipologia} onChange={(e) => setEdit({ ...edit, tipologia: e.target.value as ClienteDb["tipologia"] })}>{TIPOLOGIAS.map((t) => <option key={t}>{t}</option>)}</select></label>
          <label>Vendedor<input className={`${inp} w-full`} value={edit.vendedor ?? ""} onChange={(e) => setEdit({ ...edit, vendedor: e.target.value })} /></label>
          <label>Gerencia<input className={`${inp} w-full`} value={edit.gerencia ?? ""} onChange={(e) => setEdit({ ...edit, gerencia: e.target.value })} /></label>
          <label>Peso en la facturación (%)<input className={`${inp} w-full`} value={edit.pesoPct ?? ""} onChange={(e) => setEdit({ ...edit, pesoPct: e.target.value })} /></label>
          <div className="flex gap-2 sm:col-span-3"><button className={btn} onClick={guardar}>Guardar</button><button className={btn2} onClick={() => setEdit(null)}>Cancelar</button></div>
        </div>
      )}
      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-600"><tr><th className="p-2">Cliente</th><th className="p-2">Tipología</th><th className="p-2">Vendedor</th><th className="p-2">Gerencia</th><th className="p-2 text-right">Peso</th><th className="p-2" /></tr></thead>
          <tbody>
            {lista.map((c) => (
              <tr key={c.cliente} className="border-t">
                <td className="p-2">{c.cliente}</td><td className="p-2">{c.tipologia}</td><td className="p-2">{c.vendedor}</td><td className="p-2">{c.gerencia}</td>
                <td className="p-2 text-right">{(Number(c.peso) * 100).toLocaleString("es-AR", { maximumFractionDigits: 2 })}%</td>
                <td className="whitespace-nowrap p-2 text-right">
                  <button className="text-xs text-[#1e40af]" onClick={() => setEdit({ ...c, orden: c.orden || 1, pesoPct: String(Number(c.peso) * 100) })}>✎ Editar</button>
                  <button className="ml-3 text-xs text-rose-600" onClick={() => borrar(c.cliente)}>Sacar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const lista = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

export function EditarCatalogo({ catalogo, clientes }: { catalogo: CatalogoRow[]; clientes: { cliente: string; tipologia: string }[] }) {
  const router = useRouter();
  // Destino = un cliente puntual o "toda la tipología" (renglón sin cliente, se aplica a todos sus clientes).
  const destinos = useMemo(() => {
    const d = new Map<string, { tipologia: string; cliente: string | null }>();
    TIPOLOGIAS.forEach((t) => d.set(`tip:${t}`, { tipologia: t, cliente: null }));
    catalogo.forEach((r) => r.cliente && d.set(`cli:${r.cliente}`, { tipologia: r.tipologia, cliente: r.cliente }));
    clientes.forEach((c) => d.set(`cli:${c.cliente}`, { tipologia: c.tipologia, cliente: c.cliente }));
    return d;
  }, [catalogo, clientes]);
  const [dest, setDest] = useState("tip:SMALL RETAILERS");
  const [msg, setMsg] = useState<string | null>(null);
  const [nuevo, setNuevo] = useState({ categoria: "LAVADO", tipo: "INFALTABLE", modelo: "", homologos: "" });
  const [edit, setEdit] = useState<{ id: number; tipo: string; modelo: string; homologos: string } | null>(null);
  const d = destinos.get(dest)!;
  const set = (p: Partial<{ tipo: string; modelo: string; homologos: string }>) => setEdit((e) => (e ? { ...e, ...p } : e));
  const renglones = catalogo.filter((r) => (d.cliente ? r.cliente === d.cliente : !r.cliente && r.tipologia === d.tipologia));
  const run = async (body: Record<string, unknown>, ok: string) => {
    const r = await enviar(body);
    setMsg(r.ok ? ok : r.error ?? "Error");
    if (r.ok) { setEdit(null); router.refresh(); }
    return r.ok;
  };
  return (
    <div className="space-y-3">
      <SubirCsv accion="catalogo_csv" titulo="Subir el CSV del cuadro básico con homólogos" ayuda="El mismo «Cuadros Basicos-<mes>-hom.csv» de siempre (TIPOLOGIA, CLIENTE, CUADRO BASICO, CATEGORIA, MODELO, HOMOLOGO 1…). Reemplaza el catálogo completo." />
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span>Ver el cuadro básico de</span>
        <select className={inp} value={dest} onChange={(e) => setDest(e.target.value)}>
          <optgroup label="Toda la tipología (vale para todos sus clientes sin cuadro propio)">{TIPOLOGIAS.map((t) => <option key={t} value={`tip:${t}`}>{t}</option>)}</optgroup>
          <optgroup label="Un cliente">{[...destinos.entries()].filter(([k]) => k.startsWith("cli:")).sort().map(([k, v]) => <option key={k} value={k}>{v.cliente}</option>)}</optgroup>
        </select>
      </div>
      <p className="text-xs text-slate-500">
        Un modelo cuenta como comprado si el cliente compró ese modelo o cualquiera de sus homólogos. Los renglones de la tipología se suman a los clientes de esa tipología.
      </p>
      {msg && <p className="text-xs text-slate-700">{msg}</p>}
      {CATEGORIAS.map((cat) => (
        <div key={cat} className="rounded-lg border bg-white">
          <div className="border-b bg-slate-50 px-3 py-2 text-sm font-semibold">{CAT_LABEL[cat]}</div>
          <table className="w-full text-sm" data-noexcel>
            <tbody>
              {renglones.filter((r) => r.categoria === cat).map((r) => edit && edit.id === r.id ? (
                <tr key={r.id} className="border-t">
                  <td className="p-2"><input className={inp} value={edit.modelo} onChange={(e) => set({ modelo: e.target.value })} /></td>
                  <td className="p-2"><select className={inp} value={edit.tipo} onChange={(e) => set({ tipo: e.target.value })}><option value="INFALTABLE">Infaltable</option><option value="ESTRATEGICO">Estratégico</option></select></td>
                  <td className="p-2"><input className={`${inp} w-full`} value={edit.homologos} placeholder="Homólogos separados por coma" onChange={(e) => set({ homologos: e.target.value })} /></td>
                  <td className="whitespace-nowrap p-2 text-right">
                    <button className={btn} onClick={() => run({ accion: "catalogo_guardar", id: r.id, tipo: edit.tipo, modelo: edit.modelo, homologos: lista(edit.homologos) }, "Guardado.")}>Guardar</button>
                    <button className={`${btn2} ml-2`} onClick={() => setEdit(null)}>Cancelar</button>
                  </td>
                </tr>
              ) : (
                <tr key={r.id} className="border-t">
                  <td className="p-2 font-mono">{r.modelo}</td>
                  <td className="p-2"><span className={`rounded px-2 py-0.5 text-xs ${r.tipo === "INFALTABLE" ? "bg-violet-50 text-violet-700" : "bg-pink-50 text-pink-700"}`}>{r.tipo === "INFALTABLE" ? "Infaltable" : "Estratégico"}</span></td>
                  <td className="p-2 text-xs text-slate-600">{r.homologos.length ? r.homologos.join(" · ") : "sin homólogos"}</td>
                  <td className="whitespace-nowrap p-2 text-right">
                    <button className="text-xs text-[#1e40af]" onClick={() => setEdit({ id: r.id!, tipo: r.tipo, modelo: r.modelo, homologos: r.homologos.join(", ") })}>✎ Editar</button>
                    <button className="ml-3 text-xs text-rose-600" onClick={() => confirm(`¿Sacar ${r.modelo} del cuadro básico?`) && run({ accion: "catalogo_borrar", id: r.id }, "Modelo sacado.")}>Sacar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
      <div className="grid gap-2 rounded-lg border bg-white p-3 text-sm sm:grid-cols-5">
        <div className="font-medium sm:col-span-5">Agregar un modelo a {d.cliente ?? `toda la tipología ${d.tipologia}`}</div>
        <select className={inp} value={nuevo.categoria} onChange={(e) => setNuevo({ ...nuevo, categoria: e.target.value })}>{CATEGORIAS.map((c) => <option key={c} value={c}>{CAT_LABEL[c]}</option>)}</select>
        <select className={inp} value={nuevo.tipo} onChange={(e) => setNuevo({ ...nuevo, tipo: e.target.value })}><option value="INFALTABLE">Infaltable</option><option value="ESTRATEGICO">Estratégico</option></select>
        <input className={inp} placeholder="Modelo (código SAP)" value={nuevo.modelo} onChange={(e) => setNuevo({ ...nuevo, modelo: e.target.value })} />
        <input className={inp} placeholder="Homólogos (separados por coma)" value={nuevo.homologos} onChange={(e) => setNuevo({ ...nuevo, homologos: e.target.value })} />
        <button className={btn} onClick={async () => {
          if (await run({ accion: "catalogo_agregar", tipologia: d.tipologia, cliente: d.cliente, categoria: nuevo.categoria, tipo: nuevo.tipo, modelo: nuevo.modelo, homologos: lista(nuevo.homologos) }, "Modelo agregado.")) setNuevo({ ...nuevo, modelo: "", homologos: "" });
        }}>Agregar</button>
      </div>
    </div>
  );
}
