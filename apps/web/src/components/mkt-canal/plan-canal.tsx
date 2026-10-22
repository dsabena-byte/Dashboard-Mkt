"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { totalLinea, totalMes, type CanalConfig, type LineaCanal } from "@/lib/plan-canal";
import { ApiladoMensual, RankingMedios } from "@/components/pauta/plan-anual-charts";

// Pestaña "Plan anual" de Mkt Canal: publicidad por cliente y eventos, mes a mes. Se carga en $ M (se guarda en pesos).
// Guarda con PATCH /api/plan-medios.
const MES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const th = "px-2 py-1.5 text-right font-medium";
const td = "px-1 py-1 text-right tabular-nums";
const M = (v: number) => (v ? `$${(v / 1e6).toLocaleString("es-AR", { maximumFractionDigits: 1 })} M` : "—");
const inputCls = "w-full min-w-[64px] rounded border bg-background px-1 py-0.5 text-right tabular-nums text-xs disabled:opacity-60";

function Grilla({ titulo, ayuda, lineas, onChange, ro, nuevaEtiqueta }: {
  titulo: string; ayuda: string; lineas: LineaCanal[]; onChange: (l: LineaCanal[]) => void; ro: boolean; nuevaEtiqueta: string;
}) {
  const [nuevo, setNuevo] = useState("");
  const tot = totalMes(lineas), anual = tot.reduce((a, b) => a + b, 0);
  const set = (k: number, patch: Partial<LineaCanal>) => onChange(lineas.map((l, j) => (j === k ? { ...l, ...patch } : l)));
  return (
    <section className="space-y-2">
      <h3 className="text-base font-semibold">{titulo}</h3>
      <p className="text-xs text-muted-foreground">{ayuda}</p>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[1100px] text-xs">
          <thead className="bg-muted/50 text-muted-foreground"><tr><th className="px-2 py-1.5 text-left font-medium">{titulo} · $ M</th>{MES.map((m) => <th key={m} className={th}>{m}</th>)}<th className={th}>Año ($ M)</th><th className={th}>%</th>{!ro && <th />}</tr></thead>
          <tbody>
            {lineas.map((l, k) => (
              <tr key={k} className="border-t">
                <td className="px-2 py-1">{ro ? l.nombre : <input className="w-40 rounded border bg-background px-1 py-0.5 text-xs" value={l.nombre} onChange={(e) => set(k, { nombre: e.target.value })} />}</td>
                {l.valores.map((v, i) => (
                  <td key={i} className={td}><input type="number" min={0} step="any" className={inputCls} disabled={ro} value={v ? +(v / 1e6).toFixed(3) : ""} placeholder="0"
                    onChange={(e) => set(k, { valores: l.valores.map((x, j) => (j === i ? Math.round(Math.max(0, Number(e.target.value) || 0) * 1e6) : x)) })} /></td>
                ))}
                <td className={`${td} font-semibold`}>{M(totalLinea(l))}</td>
                <td className={td}>{anual > 0 ? `${((totalLinea(l) / anual) * 100).toFixed(1)}%` : "—"}</td>
                {!ro && <td className="px-1"><button type="button" title="Quitar línea" onClick={() => { if (confirm(`¿Quitar "${l.nombre}"?`)) onChange(lineas.filter((_, j) => j !== k)); }} className="text-muted-foreground hover:text-red-600">✕</button></td>}
              </tr>
            ))}
            <tr className="border-t bg-muted/30 font-semibold"><td className="px-2 py-1">Total</td>{tot.map((v, i) => <td key={i} className={td}>{M(v)}</td>)}<td className={td}>{M(anual)}</td><td className={td}>{anual > 0 ? "100%" : "—"}</td>{!ro && <td />}</tr>
          </tbody>
        </table>
      </div>
      {!ro && (
        <div className="flex gap-2">
          <input className="w-56 rounded border bg-background px-2 py-1 text-xs" placeholder={nuevaEtiqueta} value={nuevo} onChange={(e) => setNuevo(e.target.value)} />
          <button type="button" disabled={!nuevo.trim()} onClick={() => { onChange([...lineas, { nombre: nuevo.trim(), valores: Array(12).fill(0) }]); setNuevo(""); }} className="rounded-md border px-3 py-1 text-xs disabled:opacity-50">+ Agregar línea</button>
        </div>
      )}
      {anual > 0 && (
        <div className="grid gap-3 lg:grid-cols-[2fr_1fr]">
          <div className="rounded-lg border p-2"><div className="text-xs font-semibold">{titulo} · inversión por mes</div><ApiladoMensual series={lineas.filter((l) => totalLinea(l) > 0).map((l) => [l.nombre, l.valores] as [string, number[]])} /></div>
          <div className="rounded-lg border p-2"><div className="text-xs font-semibold">{titulo} · % del año</div><RankingMedios items={lineas.map((l) => [l.nombre, totalLinea(l)] as [string, number])} /></div>
        </div>
      )}
    </section>
  );
}

export function PlanCanal({ anio, inicial, editor, email }: { anio: number; inicial: CanalConfig; editor: boolean; email: string | null }) {
  const router = useRouter();
  const [canal, setCanal] = useState(inicial);
  const [base, setBase] = useState(JSON.stringify(inicial));
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const sucio = JSON.stringify(canal) !== base;
  const ro = !editor;
  const totC = totalMes(canal.clientes), totE = totalMes(canal.eventos);

  async function guardar() {
    setOcupado(true); setMsg(null);
    try {
      const res = await fetch("/api/plan-medios", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ anio, canal }) });
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) { setMsg({ ok: false, t: d.error ?? "No se pudo guardar." }); return; }
      setBase(JSON.stringify(canal)); setMsg({ ok: true, t: "Plan guardado." }); router.refresh();
    } finally { setOcupado(false); }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-3 text-sm">
        <div className="flex-1">
          <b>Plan anual {anio}</b> · Publicidad por cliente {M(totC.reduce((a, b) => a + b, 0))} · Eventos Canal + Consumidores {M(totE.reduce((a, b) => a + b, 0))}
          {sucio && <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">cambios sin guardar</span>}
          {ro && <div className="text-xs text-amber-800">Solo lectura: lo editan los editores del presupuesto{email ? ` (entraste como ${email}, que no está en la lista)` : ""}.</div>}
        </div>
        {editor && <>
          <button type="button" disabled={!sucio || ocupado} onClick={() => { setCanal(JSON.parse(base) as CanalConfig); setMsg(null); }} className="rounded-md border px-3 py-1.5 text-xs disabled:opacity-50">Descartar cambios</button>
          <button type="button" disabled={!sucio || ocupado} onClick={() => void guardar()} className="rounded-md bg-[#1e40af] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50">{ocupado ? "Guardando…" : "Guardar"}</button>
        </>}
      </div>
      {msg && <p className={`text-sm ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>{msg.t}</p>}
      <Grilla titulo="Publicidad por cliente" ayuda="Plan de publicidad de cada cliente (cuenta contable propia), mes a mes, en millones de pesos." lineas={canal.clientes} onChange={(clientes) => setCanal((c) => ({ ...c, clientes }))} ro={ro} nuevaEtiqueta="Nuevo cliente" />
      <Grilla titulo="Eventos Canal + Consumidores" ayuda="Eventos de grupos de compra (canal) y eventos para consumidores, mes a mes, en millones de pesos. Podés agregar más líneas." lineas={canal.eventos} onChange={(eventos) => setCanal((c) => ({ ...c, eventos }))} ro={ro} nuevaEtiqueta="Nuevo evento" />
    </div>
  );
}
