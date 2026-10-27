"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ClienteDb } from "@/lib/cb-ventas/server";
import { CATEGORIAS, TIPOLOGIAS, type CatalogoRow } from "@/lib/cb-ventas/core";
import { hoyAR, vigenteEnFecha } from "@/lib/cb-ventas/vigencia";
import { MESES_LABEL } from "@/lib/cb-ventas/metrics";

// Edición de CB Ventas desde el tablero (solo editores del área trade; el server vuelve a chequear y audita todo).
// Sin subida de CSV (pedido del dueño). El cuadro básico tiene VIGENCIA: un cambio vale desde el 1º del mes en curso
// y los meses anteriores quedan como estaban (ver app/api/cb-ventas/editar).

async function enviar(body: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> {
  const r = await fetch("/api/cb-ventas/editar", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  return r.ok ? { ok: true } : { ok: false, error: j.error ?? `Error ${r.status}` };
}

const inp = "rounded border border-slate-300 px-2 py-1 text-sm";
const btn = "rounded bg-[#1e40af] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50";
const btn2 = "rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50";
const CAT_LABEL: Record<string, string> = { LAVADO: "Lavado", REFRIGERACION: "Refrigeración", COCCION: "Cocción" };
const TIPO_LABEL: Record<string, string> = { INFALTABLE: "Infaltable", ESTRATEGICO: "Estratégico" };

type EditCliente = Partial<ClienteDb> & { pesoPct?: string; nuevo?: boolean };

function FilaClienteEdit({ edit, setEdit, guardar, original }: { edit: EditCliente; setEdit: (e: EditCliente | null) => void; guardar: () => void; original?: ClienteDb }) {
  const cambiaTip = original && edit.tipologia !== original.tipologia;
  return (
    <tr className="border-t bg-slate-50 align-top">
      <td className="p-2">
        <input className={`${inp} w-full`} value={edit.cliente ?? ""} disabled={!edit.nuevo} placeholder="Razón social" onChange={(e) => setEdit({ ...edit, cliente: e.target.value })} />
        <input className={`${inp} mt-1 w-full`} value={edit.id_sap ?? ""} placeholder="ID SAP (opcional)" onChange={(e) => setEdit({ ...edit, id_sap: e.target.value })} />
      </td>
      <td className="p-2">
        <select className={inp} value={edit.tipologia} onChange={(e) => setEdit({ ...edit, tipologia: e.target.value as ClienteDb["tipologia"] })}>{TIPOLOGIAS.map((t) => <option key={t}>{t}</option>)}</select>
        {cambiaTip && <p className="mt-1 max-w-[16rem] text-[11px] text-amber-700">Ojo: cambiar la tipología cambia qué cuadro básico de tipología le toca, también en los meses pasados.</p>}
      </td>
      <td className="p-2"><input className={`${inp} w-full`} value={edit.vendedor ?? ""} onChange={(e) => setEdit({ ...edit, vendedor: e.target.value })} /></td>
      <td className="p-2"><input className={`${inp} w-full`} value={edit.gerencia ?? ""} onChange={(e) => setEdit({ ...edit, gerencia: e.target.value })} /></td>
      <td className="p-2 text-right"><input className={`${inp} w-20 text-right`} value={edit.pesoPct ?? ""} onChange={(e) => setEdit({ ...edit, pesoPct: e.target.value })} />%</td>
      <td className="whitespace-nowrap p-2 text-right">
        <button className={btn} onClick={guardar}>Guardar</button>
        <button className={`${btn2} ml-2`} onClick={() => setEdit(null)}>Cancelar</button>
      </td>
    </tr>
  );
}

export function EditarClientes({ clientes }: { clientes: ClienteDb[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<EditCliente | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const lista = useMemo(() => clientes.filter((c) => !q || `${c.cliente} ${c.vendedor} ${c.gerencia} ${c.tipologia}`.toLowerCase().includes(q.toLowerCase())), [clientes, q]);
  const guardar = async () => {
    if (!edit) return;
    const r = await enviar({ accion: "cliente_guardar", ...edit, peso: Number((edit.pesoPct ?? "0").replace(",", ".")) / 100 });
    setMsg(r.ok ? "Guardado." : r.error ?? "Error");
    if (r.ok) { setEdit(null); router.refresh(); }
  };
  const borrar = async (cliente: string) => {
    if (!confirm(`¿Sacar a ${cliente} de la lista? Deja de contar en CB Ventas, también en los meses pasados.`)) return;
    const r = await enviar({ accion: "cliente_borrar", cliente });
    setMsg(r.ok ? "Cliente sacado." : r.error ?? "Error");
    if (r.ok) router.refresh();
  };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input className={inp} placeholder="Buscar cliente, vendedor, gerencia o tipología" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className={btn} onClick={() => setEdit({ nuevo: true, cliente: "", tipologia: "SMALL RETAILERS", vendedor: "", gerencia: "", pesoPct: "0", id_sap: "" })}>+ Agregar cliente</button>
        <span className="text-xs text-slate-500">{lista.length} de {clientes.length} clientes</span>
      </div>
      <p className="text-xs text-slate-500">Vendedor y gerencia definen de quién es la cartera hoy (los filtros del tablero usan la asignación actual).</p>
      {msg && <p className="text-xs text-slate-700">{msg}</p>}
      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-600"><tr><th className="p-2">Cliente</th><th className="p-2">Tipología</th><th className="p-2">Vendedor</th><th className="p-2">Gerencia</th><th className="p-2 text-right">Peso</th><th className="p-2" /></tr></thead>
          <tbody>
            {edit?.nuevo && <FilaClienteEdit edit={edit} setEdit={setEdit} guardar={guardar} />}
            {lista.map((c) => (!edit?.nuevo && edit?.cliente === c.cliente) ? (
              <FilaClienteEdit key={c.cliente} edit={edit} setEdit={setEdit} guardar={guardar} original={c} />
            ) : (
              <tr key={c.cliente} className="border-t">
                <td className="p-2">{c.cliente}</td><td className="p-2">{c.tipologia}</td><td className="p-2">{c.vendedor}</td><td className="p-2">{c.gerencia}</td>
                <td className="p-2 text-right">{(Number(c.peso) * 100).toLocaleString("es-AR", { maximumFractionDigits: 2 })}%</td>
                <td className="whitespace-nowrap p-2 text-right">
                  <button className="text-xs text-[#1e40af]" onClick={() => setEdit({ ...c, pesoPct: String(Number(c.peso) * 100) })}>✎ Editar</button>
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

const sinVacios = (xs: string[]) => xs.map((x) => x.trim()).filter(Boolean);

export function EditarCatalogo({ catalogo, clientes }: { catalogo: CatalogoRow[]; clientes: { cliente: string; tipologia: string }[] }) {
  const router = useRouter();
  const hoy = hoyAR();
  const mesLabel = (MESES_LABEL[Number(hoy.slice(5, 7)) - 1] ?? "").toLowerCase();
  // Solo lo vigente hoy se edita; la historia queda en la base y la usa el tablero mes a mes.
  const vigente = useMemo(() => catalogo.filter((r) => vigenteEnFecha({ desde: r.vigente_desde, hasta: r.vigente_hasta }, hoy)), [catalogo, hoy]);
  // Clientes por tipología: los de la clasificación + los que tienen cuadro propio (aunque no estén en la lista).
  const clientesPorTip = useMemo(() => {
    const m = new Map<string, Set<string>>(TIPOLOGIAS.map((t) => [t, new Set<string>()]));
    clientes.forEach((c) => m.get(c.tipologia)?.add(c.cliente));
    vigente.forEach((r) => r.cliente && m.get(r.tipologia)?.add(r.cliente));
    return m;
  }, [clientes, vigente]);
  const [dest, setDest] = useState("tip:TOP 10");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [nuevo, setNuevo] = useState({ categoria: "LAVADO", tipo: "INFALTABLE", modelo: "", homologos: "" });
  const [editModelo, setEditModelo] = useState<{ id: number; modelo: string } | null>(null);
  const [nuevoHom, setNuevoHom] = useState<Record<number, string>>({});

  const [kind, val] = [dest.slice(0, 3), dest.slice(4)];
  const cliente = kind === "cli" ? val : null;
  const tipologia = cliente ? clientes.find((c) => c.cliente === cliente)?.tipologia ?? vigente.find((r) => r.cliente === cliente)?.tipologia ?? "TOP 10" : val;
  const renglones = vigente.filter((r) => (cliente ? r.cliente === cliente : !r.cliente && r.tipologia === tipologia));
  const heredados = cliente ? vigente.filter((r) => !r.cliente && r.tipologia === tipologia) : [];
  const conPropio = [...(clientesPorTip.get(tipologia) ?? [])].filter((c) => vigente.some((r) => r.cliente === c)).sort();

  const run = async (body: Record<string, unknown>, ok: string) => {
    setBusy(true);
    const r = await enviar(body);
    setBusy(false);
    setMsg(r.ok ? ok : r.error ?? "Error");
    if (r.ok) router.refresh();
    return r.ok;
  };
  const guardar = (r: CatalogoRow, p: Partial<Pick<CatalogoRow, "tipo" | "modelo" | "homologos">>, ok: string) =>
    run({ accion: "catalogo_guardar", id: r.id, tipo: p.tipo ?? r.tipo, modelo: p.modelo ?? r.modelo, homologos: p.homologos ?? r.homologos }, ok);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span>Ver el cuadro básico de</span>
        <select className={inp} value={dest} onChange={(e) => { setDest(e.target.value); setMsg(null); setEditModelo(null); }}>
          {TIPOLOGIAS.map((t) => (
            <optgroup key={t} label={t}>
              <option value={`tip:${t}`}>Toda la tipología {t}</option>
              {[...(clientesPorTip.get(t) ?? [])].sort().map((c) => <option key={c} value={`cli:${c}`}>{c}</option>)}
            </optgroup>
          ))}
        </select>
      </div>
      <p className="text-xs text-slate-500">
        Un modelo cuenta como comprado si el cliente compró ese modelo o cualquiera de sus homólogos. Los cambios valen desde el 1º de {mesLabel};
        los meses anteriores del tablero quedan como estaban.
      </p>
      {msg && <p className="text-xs text-slate-700">{msg}</p>}

      {!cliente && renglones.length === 0 && conPropio.length > 0 && (
        <div className="rounded-lg border bg-white p-3 text-sm">
          <p className="text-slate-700">En {tipologia} cada cliente tiene su propio cuadro básico. Elegí uno:</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {conPropio.map((c) => <button key={c} className={btn2} onClick={() => setDest(`cli:${c}`)}>{c}</button>)}
          </div>
        </div>
      )}
      {heredados.length > 0 && (
        <p className="rounded-lg border bg-white p-3 text-xs text-slate-600">
          Además, {cliente} recibe los {heredados.length} modelos de toda la tipología {tipologia}.{" "}
          <button className="text-[#1e40af] underline" onClick={() => setDest(`tip:${tipologia}`)}>Ver o editar esos</button>
        </p>
      )}

      {CATEGORIAS.map((cat) => {
        const filas = renglones.filter((r) => r.categoria === cat).sort((a, b) => (a.tipo === b.tipo ? 0 : a.tipo === "INFALTABLE" ? -1 : 1));
        return (
          <div key={cat} className="rounded-lg border bg-white">
            <div className="border-b bg-slate-50 px-3 py-2 text-sm font-semibold">{CAT_LABEL[cat]} <span className="font-normal text-slate-500">· {filas.length} modelos</span></div>
            <table className="w-full text-sm" data-noexcel>
              <tbody>
                {filas.length === 0 && <tr><td className="p-2 text-xs text-slate-500">Sin modelos en esta categoría.</td></tr>}
                {filas.map((r) => (
                  <tr key={r.id} className="border-t align-top">
                    <td className="p-2 font-mono">
                      {editModelo && editModelo.id === r.id ? (
                        <span className="flex gap-1">
                          <input className={inp} value={editModelo.modelo} onChange={(e) => setEditModelo({ id: r.id!, modelo: e.target.value })} />
                          <button className={btn} disabled={busy || !editModelo.modelo.trim()} onClick={async () => { if (await guardar(r, { modelo: editModelo.modelo.trim() }, "Código cambiado.")) setEditModelo(null); }}>OK</button>
                          <button className={btn2} onClick={() => setEditModelo(null)}>✕</button>
                        </span>
                      ) : (
                        <button className="hover:underline" title="Cambiar el código" onClick={() => setEditModelo({ id: r.id!, modelo: r.modelo })}>{r.modelo} ✎</button>
                      )}
                    </td>
                    <td className="p-2">
                      <button
                        disabled={busy}
                        title="Cambiar entre Infaltable y Estratégico"
                        className={`rounded px-2 py-0.5 text-xs ${r.tipo === "INFALTABLE" ? "bg-violet-50 text-violet-700" : "bg-pink-50 text-pink-700"}`}
                        onClick={() => guardar(r, { tipo: r.tipo === "INFALTABLE" ? "ESTRATEGICO" : "INFALTABLE" }, `${r.modelo} pasó a ${TIPO_LABEL[r.tipo === "INFALTABLE" ? "ESTRATEGICO" : "INFALTABLE"]}.`)}
                      >{TIPO_LABEL[r.tipo]} ⇄</button>
                    </td>
                    <td className="p-2">
                      <div className="flex flex-wrap items-center gap-1">
                        {r.homologos.map((h) => (
                          <span key={h} className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-700">
                            {h}
                            <button disabled={busy} aria-label={`Sacar homólogo ${h}`} className="text-slate-400 hover:text-rose-600" onClick={() => guardar(r, { homologos: r.homologos.filter((x) => x !== h) }, `Homólogo ${h} sacado.`)}>×</button>
                          </span>
                        ))}
                        <input
                          className={`${inp} w-28 py-0.5 text-xs`}
                          placeholder="+ homólogo"
                          value={nuevoHom[r.id!] ?? ""}
                          onChange={(e) => setNuevoHom({ ...nuevoHom, [r.id!]: e.target.value })}
                          onKeyDown={async (e) => {
                            const v = (nuevoHom[r.id!] ?? "").trim();
                            if (e.key !== "Enter" || !v) return;
                            if (await guardar(r, { homologos: [...r.homologos, v] }, `Homólogo ${v} agregado.`)) setNuevoHom({ ...nuevoHom, [r.id!]: "" });
                          }}
                        />
                      </div>
                    </td>
                    <td className="whitespace-nowrap p-2 text-right">
                      <button className="text-xs text-rose-600" disabled={busy} onClick={() => confirm(`¿Sacar ${r.modelo} del cuadro básico desde ${mesLabel}? Los meses anteriores no cambian.`) && run({ accion: "catalogo_borrar", id: r.id }, "Modelo sacado.")}>Sacar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}

      <div className="grid gap-2 rounded-lg border bg-white p-3 text-sm sm:grid-cols-5">
        <div className="font-medium sm:col-span-5">Agregar un modelo a {cliente ?? `toda la tipología ${tipologia}`}</div>
        <select className={inp} value={nuevo.categoria} onChange={(e) => setNuevo({ ...nuevo, categoria: e.target.value })}>{CATEGORIAS.map((c) => <option key={c} value={c}>{CAT_LABEL[c]}</option>)}</select>
        <select className={inp} value={nuevo.tipo} onChange={(e) => setNuevo({ ...nuevo, tipo: e.target.value })}><option value="INFALTABLE">Infaltable</option><option value="ESTRATEGICO">Estratégico</option></select>
        <input className={inp} placeholder="Modelo (código SAP)" value={nuevo.modelo} onChange={(e) => setNuevo({ ...nuevo, modelo: e.target.value })} />
        <input className={inp} placeholder="Homólogos (separados por coma)" value={nuevo.homologos} onChange={(e) => setNuevo({ ...nuevo, homologos: e.target.value })} />
        <button className={btn} disabled={busy || !nuevo.modelo.trim()} onClick={async () => {
          if (await run({ accion: "catalogo_agregar", tipologia, cliente, categoria: nuevo.categoria, tipo: nuevo.tipo, modelo: nuevo.modelo.trim(), homologos: sinVacios(nuevo.homologos.split(",")) }, "Modelo agregado.")) setNuevo({ ...nuevo, modelo: "", homologos: "" });
        }}>Agregar</button>
      </div>
    </div>
  );
}

