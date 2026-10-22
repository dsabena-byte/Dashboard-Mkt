"use client";
import { Fragment, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  calcPlan, PLAN_CATS, PLAN_META_KPIS, PLAN_ROLES,
  type InflacionMes, type PlanConfig, type PlanMedio, type Reparto,
} from "@/lib/plan-medios-anual";
import type { PautaMesMedios } from "@/lib/pauta-medios-model";
import { ApiladoMensual, BGT_COLORES, CpmMedios, ImpactosMensual, RankingMedios, calor } from "@/components/pauta/plan-anual-charts";
import { MetaEvolChart } from "@/components/pauta/meta-evol-chart";
import { PlanOtros } from "@/components/pauta/plan-otros";
import type { HistOtros } from "@/lib/plan-otros-kpis";

// Editor del Plan de Medios anual (/performance/plan). Todo se recalcula en el navegador con el mismo
// cálculo puro que usa la API al cargar las metas.
const MES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const M = (v: number) => (v / 1e6).toLocaleString("es-AR", { maximumFractionDigits: 1 });
const pct = (v: number, t: number) => (t > 0 ? `${((v / t) * 100).toFixed(1)}%` : "—");
const cant = (v: number | null | undefined) =>
  v == null || !Number.isFinite(v) || v === 0 ? "—" : Math.abs(v) >= 1e6 ? `${(v / 1e6).toLocaleString("es-AR", { maximumFractionDigits: 1 })} M` : Math.round(v).toLocaleString("es-AR");
const inputCls = "w-full min-w-[56px] rounded border bg-background px-1 py-0.5 text-right tabular-nums text-xs disabled:opacity-60";
const th = "px-2 py-1.5 text-right font-medium";
const td = "px-2 py-1 text-right tabular-nums";
const REPARTO_TXT: Record<Reparto, string> = { curva: "Curva (digital)", olas: "Olas", fijo: "Costo fijo" };

function Num({ v, on, disabled, step = "any" }: { v: number; on: (n: number) => void; disabled?: boolean; step?: string }) {
  return <input type="number" step={step} className={inputCls} value={Number.isFinite(v) ? v : 0} disabled={disabled} onChange={(e) => on(Number(e.target.value) || 0)} />;
}

function Tabla({ titulo, filas, total, pie, grafico }: { titulo: string; filas: [string, number[]][]; total: number[]; pie?: string; grafico?: React.ReactNode }) {
  const tAnual = total.reduce((s, v) => s + v, 0);
  return (
    <div className="space-y-1">
      <h4 className="text-sm font-semibold">{titulo}</h4>
      {grafico}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[900px] text-xs">
          <thead className="bg-muted/50 text-muted-foreground"><tr><th className="px-2 py-1.5 text-left font-medium">$ M</th>{MES.map((m) => <th key={m} className={th}>{m}</th>)}<th className={th}>Total</th><th className={th}>%</th></tr></thead>
          <tbody>
            {filas.map(([n, a]) => { const s = a.reduce((x, y) => x + y, 0); return (
              <tr key={n} className="border-t"><td className="px-2 py-1">{n}</td>{a.map((v, i) => <td key={i} className={td}>{v ? M(v) : "—"}</td>)}<td className={`${td} font-medium`}>{M(s)}</td><td className={td}>{pct(s, tAnual)}</td></tr>
            ); })}
            <tr className="border-t bg-muted/30 font-semibold"><td className="px-2 py-1">Total</td>{total.map((v, i) => <td key={i} className={td}>{M(v)}</td>)}<td className={td}>{M(tAnual)}</td><td className={td}>100%</td></tr>
          </tbody>
        </table>
      </div>
      {pie && <p className="text-[11px] text-muted-foreground">{pie}</p>}
    </div>
  );
}

export function PlanAnual({ anio, inicial, guardado, sinTabla, refMeses, infl, inflOrigen, editor, email, metasActuales, hist, metasOtros }: {
  anio: number; inicial: PlanConfig; guardado: { at: string; por: string | null } | null; sinTabla: boolean;
  refMeses: (PautaMesMedios | null)[]; infl: InflacionMes; inflOrigen: Record<string, string>; editor: boolean; email: string | null; metasActuales: Record<string, (number | null)[]>;
  hist: HistOtros; metasOtros: Record<string, (number | null)[]>;
}) {
  const router = useRouter();
  const [cfg, setCfg] = useState(inicial);
  const [base, setBase] = useState(JSON.stringify(inicial));
  const [abierto, setAbierto] = useState<string | null>(null);
  const [nuevo, setNuevo] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const sucio = JSON.stringify(cfg) !== base;
  const r = useMemo(() => calcPlan(cfg, refMeses, infl), [cfg, refMeses, infl]);
  const ro = !editor;

  const setMedio = (i: number, patch: Partial<PlanMedio>) => setCfg((c) => ({ ...c, medios: c.medios.map((m, k) => (k === i ? { ...m, ...patch } : m)) }));
  const setArr = (a: number[], i: number, v: number) => a.map((x, k) => (k === i ? v : x));

  async function enviar(method: "PUT" | "POST", plan?: string) {
    setOcupado(true); setMsg(null);
    try {
      const res = await fetch("/api/plan-medios", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(method === "PUT" ? { anio, config: cfg } : { anio, plan }) });
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) { setMsg({ ok: false, t: d.error ?? "No se pudo." }); return; }
      if (method === "PUT") { setBase(JSON.stringify(cfg)); setMsg({ ok: true, t: "Plan guardado." }); }
      else setMsg({ ok: true, t: plan ? `Metas ${anio} de ${plan} cargadas desde la proyección. Se ajustan en el panel de metas de ese tablero.` : `Metas ${anio} de Pauta Mkt cargadas desde el plan. Podés ajustarlas abajo.` });
      router.refresh();
    } finally { setOcupado(false); }
  }

  const medioFilas = cfg.medios.map((m) => [m.medio, r.inversion.montos[m.medio] ?? []] as [string, number[]]);
  const avisos = [...r.inversion.avisos, ...r.impactos.avisos];
  const tAnual = r.inversion.total.reduce((s, v) => s + v, 0);
  // Gráfico por medio: los 6 de más inversión + "Otros".
  const ordenados = [...medioFilas].sort((x, y) => y[1].reduce((a, b) => a + b, 0) - x[1].reduce((a, b) => a + b, 0));
  const topMedios: [string, number[]][] = ordenados.length > 7
    ? [...ordenados.slice(0, 6), ["Otros", MES.map((_, i) => ordenados.slice(6).reduce((t, f) => t + (f[1][i] ?? 0), 0))]]
    : ordenados;
  const maxMedioCat = Math.max(0, ...Object.values(r.inversion.medioCat).flatMap((mc) => Object.values(mc)));

  return (
    <div className="space-y-6">
      {/* Estado + acciones */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-3 text-sm">
        <div className="flex-1">
          <b>Plan {anio}</b> · {guardado ? `guardado ${new Date(guardado.at).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Argentina/Buenos_Aires" })}${guardado.por ? ` por ${guardado.por}` : ""}` : "todavía no guardado (arranca con el Excel aprobado)"}
          {sucio && <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">cambios sin guardar</span>}
          {ro && <div className="text-xs text-amber-800">Solo lectura: lo editan los editores del presupuesto{email ? ` (entraste como ${email}, que no está en la lista)` : ""}.</div>}
          {sinTabla && <div className="text-xs text-red-600">Falta la tabla plan_medios_anual: corré 0129_plan_medios_anual.sql en el SQL Editor de Supabase.</div>}
        </div>
        {editor && <>
          <button type="button" disabled={!sucio || ocupado} onClick={() => { setCfg(JSON.parse(base) as PlanConfig); setMsg(null); }} className="rounded-md border px-3 py-1.5 text-xs disabled:opacity-50">Descartar cambios</button>
          <button type="button" disabled={(!sucio && !!guardado) || ocupado} title={!sucio && guardado ? "No hay cambios para guardar" : undefined} onClick={() => void enviar("PUT")} className="rounded-md bg-[#1e40af] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50">{ocupado ? "Guardando…" : "Guardar plan"}</button>
        </>}
      </div>
      {msg && <p className={`text-sm ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>{msg.t}</p>}
      {avisos.length > 0 && (
        <ul className="list-disc space-y-0.5 rounded-lg border border-amber-200 bg-amber-50 p-3 pl-6 text-xs text-amber-900">{avisos.map((a) => <li key={a}>{a}</li>)}</ul>
      )}

      {/* 1. BGT */}
      <section className="space-y-2">
        <h3 className="text-base font-semibold">1. BGT de medios por mes ($ M)</h3>
        <ApiladoMensual colores={BGT_COLORES} series={[
          ["Digital", MES.map((_, i) => cfg.medios.filter((m) => !m.offline).reduce((t, m) => t + (r.inversion.montos[m.medio]?.[i] ?? 0), 0))],
          ["Offline (OOH, TV, radio, DOOH)", MES.map((_, i) => cfg.medios.filter((m) => m.offline).reduce((t, m) => t + (r.inversion.montos[m.medio]?.[i] ?? 0), 0))],
        ]} />
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[900px] text-xs" data-noexcel>
            <thead className="bg-muted/50 text-muted-foreground"><tr><th className="px-2 py-1.5 text-left font-medium" />{MES.map((m) => <th key={m} className={th}>{m}</th>)}<th className={th}>Total</th></tr></thead>
            <tbody><tr className="border-t">
              <td className="px-2 py-1">BGT</td>
              {cfg.bgt.map((v, i) => <td key={i} className="px-1 py-1"><Num v={v / 1e6} disabled={ro} on={(n) => setCfg((c) => ({ ...c, bgt: setArr(c.bgt, i, n * 1e6) }))} /></td>)}
              <td className={`${td} font-semibold`}>{M(cfg.bgt.reduce((s, v) => s + v, 0))}</td>
            </tr>
            <tr className="border-t text-muted-foreground"><td className="px-2 py-1">Inflación % (usada)</td>{MES.map((_, i) => { const k = `${anio}-${String(i + 1).padStart(2, "0")}`; return <td key={k} className={td} title={inflOrigen[k] ?? "sin dato"}>{infl[k] != null ? infl[k]!.toLocaleString("es-AR") : "—"}<div className="text-[9px]">{inflOrigen[k]?.split(" ")[0] ?? ""}</div></td>; })}<td className={td} title="Acumulada del año (compuesta)">{(() => { const v = MES.map((_, i) => infl[`${anio}-${String(i + 1).padStart(2, "0")}`]); return v.every((x) => x == null) ? "—" : `${((v.reduce<number>((f, x) => f * (1 + (x ?? 0) / 100), 1) - 1) * 100).toLocaleString("es-AR", { maximumFractionDigits: 1 })}% acum.`; })()}</td></tr></tbody>
          </table>
        </div>
        <p className="text-[11px] text-muted-foreground">Inflación: la REAL (INDEC) si ya salió; si no, la del presupuesto más reciente del año (8+4, 4+8 o BGT). Se carga en Inversión de Marketing → Cargar datos → Inflación.</p>
      </section>

      {/* 2. Medios */}
      <section className="space-y-2">
        <h3 className="text-base font-semibold">2. Medios: reparto, rol y categoría</h3>
        <RankingMedios items={cfg.medios.map((m) => [m.medio, (r.inversion.montos[m.medio] ?? []).reduce((a, b) => a + b, 0)])} />
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[980px] text-xs" data-noexcel>
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-2 py-1.5 text-left font-medium">Medio</th><th className="px-2 py-1.5 text-left font-medium">Reparto</th>
                <th className={th} title="Curva: peso relativo entre digitales · Olas: % del BGT anual">Peso / % anual</th><th className={th}>Costo ene ($ M)</th>
                {PLAN_ROLES.map((x) => <th key={x} className={th}>% {x}</th>)}
                <th className="px-2 py-1.5 text-left font-medium">Referencia de costos</th><th className={th}>$ M anual</th><th className={th}>% plan</th><th />
              </tr>
            </thead>
            <tbody>
              {cfg.medios.map((m, i) => {
                const s = (r.inversion.montos[m.medio] ?? []).reduce((a, b) => a + b, 0);
                const ref = r.refs[m.medio];
                const catTxt = m.cat.every((c) => c == null) ? "mix" : m.cat.every((c) => c === m.cat[0]) ? m.cat[0] : "por mes";
                return (
                  <Fragment key={m.medio}>
                    <tr className="border-t">
                      <td className="px-2 py-1 font-medium">
                        <button type="button" onClick={() => setAbierto(abierto === m.medio ? null : m.medio)} className="text-left">{abierto === m.medio ? "▾" : "▸"} {m.medio}</button>
                        <div className="text-[10px] font-normal text-muted-foreground">categoría: {catTxt}</div>
                      </td>
                      <td className="px-2 py-1">
                        <select className="rounded border bg-background px-1 py-0.5 text-xs" disabled={ro} value={m.reparto} onChange={(e) => setMedio(i, { reparto: e.target.value as Reparto })}>
                          {(Object.keys(REPARTO_TXT) as Reparto[]).map((k) => <option key={k} value={k}>{REPARTO_TXT[k]}</option>)}
                        </select>
                      </td>
                      <td className="px-1 py-1">{m.reparto === "fijo" ? <span className="block text-right text-muted-foreground">—</span> : <Num v={m.peso} disabled={ro} on={(n) => setMedio(i, { peso: n })} />}</td>
                      <td className="px-1 py-1">{m.reparto === "fijo" ? <Num v={m.costoEnero / 1e6} disabled={ro} on={(n) => setMedio(i, { costoEnero: n * 1e6 })} /> : <span className="block text-right text-muted-foreground">—</span>}</td>
                      {m.rol.map((v, k) => <td key={k} className="px-1 py-1"><Num v={v} disabled={ro} on={(n) => setMedio(i, { rol: setArr(m.rol, k, n) })} /></td>)}
                      <td className="px-2 py-1">
                        <select className="rounded border bg-background px-1 py-0.5 text-xs" disabled={ro || m.offline} value={m.ref} onChange={(e) => setMedio(i, { ref: e.target.value === "recientes" ? "recientes" : "anio" })}>
                          <option value="anio">Promedio de los meses cerrados</option><option value="recientes">Últimos 2 meses cerrados</option>
                        </select>
                        <div className="text-[10px] text-muted-foreground">{ref ? `${ref.fuente} · CPM $${ref.impr ? Math.round((ref.inv / ref.impr) * 1000).toLocaleString("es-AR") : "—"}${ref.fijo ? " · contactos fijos" : ""} · confianza ${ref.confianza}` : "sin medición"}</div>
                      </td>
                      <td className={`${td} font-medium`}>{M(s)}</td><td className={td}>{pct(s, tAnual)}</td>
                      <td className="px-1">{editor && <button type="button" title="Quitar medio" className="text-muted-foreground hover:text-red-600" onClick={() => { if (confirm(`¿Quitar ${m.medio} del plan?`)) setCfg((c) => ({ ...c, medios: c.medios.filter((_, k) => k !== i) })); }}>✕</button>}</td>
                    </tr>
                    {abierto === m.medio && (
                      <tr className="border-t bg-muted/20">
                        <td colSpan={12} className="px-2 py-2">
                          <div className="grid gap-1" style={{ gridTemplateColumns: "140px repeat(12, minmax(56px, 1fr))" }}>
                            <span />{MES.map((x) => <span key={x} className="text-center text-[10px] text-muted-foreground">{x}</span>)}
                            {m.reparto === "olas" && <>
                              <span className="text-[11px]">Peso de la ola</span>
                              {m.olas.map((v, k) => <Num key={k} v={v} disabled={ro} on={(n) => setMedio(i, { olas: setArr(m.olas, k, n) })} />)}
                            </>}
                            <span className="text-[11px]">Categoría</span>
                            {m.cat.map((c, k) => (
                              <select key={k} className="rounded border bg-background px-0.5 py-0.5 text-[10px]" disabled={ro} value={c ?? ""} onChange={(e) => setMedio(i, { cat: m.cat.map((x, j) => (j === k ? e.target.value || null : x)) })}>
                                <option value="">mix</option>{PLAN_CATS.map((p) => <option key={p} value={p}>{p}</option>)}
                              </select>
                            ))}
                          </div>
                          {editor && <div className="mt-2 flex gap-2 text-[11px]">
                            <span className="text-muted-foreground">Toda la fila:</span>
                            {[null, ...PLAN_CATS].map((p) => <button key={p ?? "mix"} type="button" className="rounded border px-1.5" onClick={() => setMedio(i, { cat: m.cat.map(() => p) })}>{p ?? "mix"}</button>)}
                            <label className="ml-4 flex items-center gap-1"><input type="checkbox" checked={m.offline} onChange={(e) => setMedio(i, { offline: e.target.checked })} /> offline</label>
                          </div>}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              <tr className="border-t bg-muted/30 font-semibold">
                <td className="px-2 py-1">Total</td><td />
                <td className={td} title="Σ pesos de los digitales · Σ % anual de las olas">{(() => { const c = cfg.medios.filter((m) => m.reparto === "curva").reduce((t, m) => t + m.peso, 0), o = cfg.medios.filter((m) => m.reparto === "olas").reduce((t, m) => t + m.peso, 0); return `${c.toLocaleString("es-AR")} · ${o.toLocaleString("es-AR")}%`; })()}</td>
                <td className={td}>{M(cfg.medios.filter((m) => m.reparto === "fijo").reduce((t, m) => t + m.costoEnero, 0))}</td>
                {PLAN_ROLES.map((x) => <td key={x} className={td} title="% del plan anual">{pct((r.inversion.objetivos[x] ?? []).reduce((a, b) => a + b, 0), tAnual)}</td>)}
                <td /><td className={td}>{M(tAnual)}</td><td className={td}>100%</td><td />
              </tr>
            </tbody>
          </table>
        </div>
        {editor && (
          <form className="flex gap-2 text-xs" onSubmit={(e) => { e.preventDefault(); const n = nuevo.trim(); if (!n || cfg.medios.some((m) => m.medio === n)) return; setCfg((c) => ({ ...c, medios: [...c.medios, { medio: n, offline: false, reparto: "curva", peso: 0, olas: Array(12).fill(0), costoEnero: 0, rol: [50, 50, 0], cat: Array(12).fill(null), ref: "anio" }] })); setNuevo(""); }}>
            <input className="rounded border bg-background px-2 py-1" placeholder="Nombre del medio (como en el Tablero)" value={nuevo} onChange={(e) => setNuevo(e.target.value)} />
            <button className="rounded-md border px-3 py-1">+ Agregar medio</button>
          </form>
        )}
        <p className="text-[11px] text-muted-foreground">Tocá ▸ en un medio para editar sus olas y la categoría de cada mes. El nombre tiene que ser igual al del Tablero para tomar sus costos reales.</p>
      </section>

      {/* 3. Mix por categoría */}
      <section className="space-y-2">
        <h3 className="text-base font-semibold">3. Mix por categoría (% del mes, para los medios en &ldquo;mix&rdquo;)</h3>
        <ApiladoMensual pct series={PLAN_CATS.map((c) => [c, cfg.mix[c] ?? []])} />
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[900px] text-xs" data-noexcel>
            <thead className="bg-muted/50 text-muted-foreground"><tr><th className="px-2 py-1.5 text-left font-medium">Categoría</th>{MES.map((m) => <th key={m} className={th}>{m}</th>)}<th className={th} title="Promedio simple de los 12 meses">Prom.</th><th className={th} title="% del plan total en la categoría (con OOH, TV y radio)">% plan</th></tr></thead>
            <tbody>
              {PLAN_CATS.map((c) => (
                <tr key={c} className="border-t"><td className="px-2 py-1">{c}</td>
                  {(cfg.mix[c] ?? []).map((v, i) => <td key={i} className="px-1 py-1"><Num v={v} disabled={ro} on={(n) => setCfg((x) => ({ ...x, mix: { ...x.mix, [c]: setArr(x.mix[c] ?? Array(12).fill(0), i, n) } }))} /></td>)}
                  <td className={td}>{((cfg.mix[c] ?? []).reduce((a, b) => a + b, 0) / 12).toFixed(1)}%</td>
                  <td className={`${td} font-medium`}>{pct((r.inversion.categorias[c] ?? []).reduce((a, b) => a + b, 0), tAnual)}</td>
                </tr>
              ))}
              <tr className="border-t bg-muted/30"><td className="px-2 py-1 font-medium">Suma</td>{MES.map((_, i) => { const s = PLAN_CATS.reduce((t, c) => t + (cfg.mix[c]?.[i] ?? 0), 0); return <td key={i} className={`${td} ${Math.abs(s - 100) > 0.5 ? "text-red-600" : ""}`}>{s.toFixed(0)}%</td>; })}<td className={td}>{(PLAN_CATS.reduce((t, c) => t + (cfg.mix[c] ?? []).reduce((a, b) => a + b, 0), 0) / 12).toFixed(0)}%</td><td className={td}>100%</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* 4. Resultado: inversión */}
      <section className="space-y-4">
        <h3 className="text-base font-semibold">4. Inversión del plan</h3>
        <Tabla titulo="Por medio" grafico={<ApiladoMensual series={topMedios} />} filas={medioFilas} total={r.inversion.total} pie={`Disponible para digital por mes ($ M): ${r.inversion.digitalDisponible.map(M).join(" · ")}`} />
        <Tabla titulo="Por objetivo" grafico={<ApiladoMensual pct colores={["#1e3a8a", "#3b82f6", "#93c5fd"]} series={PLAN_ROLES.map((x) => [x, r.inversion.objetivos[x] ?? []])} />} filas={PLAN_ROLES.map((x) => [x, r.inversion.objetivos[x] ?? []])} total={r.inversion.total} />
        <Tabla titulo="Por categoría" grafico={<ApiladoMensual series={PLAN_CATS.map((x) => [x, r.inversion.categorias[x] ?? []])} />} filas={PLAN_CATS.map((x) => [x, r.inversion.categorias[x] ?? []])} total={r.inversion.total} />
        <div className="space-y-1">
          <h4 className="text-sm font-semibold">Medio × categoría (anual, $ M)</h4>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[700px] text-xs">
              <thead className="bg-muted/50 text-muted-foreground"><tr><th className="px-2 py-1.5 text-left font-medium">Medio</th>{PLAN_CATS.map((c) => <th key={c} className={th}>{c}</th>)}<th className={th}>Total</th></tr></thead>
              <tbody>
                {cfg.medios.map((m) => { const mc = r.inversion.medioCat[m.medio] ?? {}; return (
                  <tr key={m.medio} className="border-t"><td className="px-2 py-1">{m.medio}</td>{PLAN_CATS.map((c) => <td key={c} className={td} style={calor(mc[c] ?? 0, maxMedioCat)}>{mc[c] ? M(mc[c]!) : "—"}</td>)}<td className={`${td} font-medium`}>{M(Object.values(mc).reduce((s, v) => s + v, 0))}</td></tr>
                ); })}
                <tr className="border-t bg-muted/30 font-semibold"><td className="px-2 py-1">Total</td>{PLAN_CATS.map((c) => <td key={c} className={td}>{M((r.inversion.categorias[c] ?? []).reduce((s, v) => s + v, 0))}</td>)}<td className={td}>{M(tAnual)}</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* 5. Impactos */}
      <section className="space-y-4">
        <h3 className="text-base font-semibold">5. Impactos esperados</h3>
        <div className="grid gap-4 lg:grid-cols-2">
          <div><h4 className="text-sm font-semibold">Impresiones, alcance y frecuencia por mes</h4><ImpactosMensual total={r.impactos.total} /></div>
          <div><h4 className="text-sm font-semibold">Inversión vs CPM por medio (burbuja = impresiones)</h4>
            <CpmMedios items={cfg.medios.flatMap((m) => { const a = r.impactos.porMedio[m.medio]; if (!a) return []; const inv = (r.inversion.montos[m.medio] ?? []).reduce((x, y) => x + y, 0), impr = a.reduce((x, y) => x + y.impr, 0); return impr > 0 ? [{ medio: m.medio, inv, impr, cpm: (inv / impr) * 1000 }] : []; })} /></div>
        </div>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[900px] text-xs">
            <thead className="bg-muted/50 text-muted-foreground"><tr><th className="px-2 py-1.5 text-left font-medium">Medio (anual)</th><th className={th}>Inversión $ M</th><th className={th}>Impresiones</th><th className={th}>Alcance</th><th className={th}>Clicks</th><th className={th}>Views ≥50%</th><th className={th}>VTR ≥50%</th><th className={th}>CPM plan</th><th className="px-2 py-1.5 text-left font-medium">Confianza</th></tr></thead>
            <tbody>
              {cfg.medios.map((m) => {
                const a = r.impactos.porMedio[m.medio];
                const s = (k: "impr" | "alc" | "clic" | "v50" | "vbase") => (a ?? []).reduce((t, x) => t + x[k], 0);
                const inv = (r.inversion.montos[m.medio] ?? []).reduce((t, v) => t + v, 0);
                return (
                  <tr key={m.medio} className="border-t"><td className="px-2 py-1">{m.medio}</td><td className={td}>{M(inv)}</td>
                    {a ? <><td className={td}>{cant(s("impr"))}</td><td className={td}>{cant(s("alc"))}</td><td className={td}>{cant(s("clic"))}</td><td className={td}>{cant(s("v50"))}</td><td className={td}>{s("vbase") > 0 ? `${((s("v50") / s("vbase")) * 100).toFixed(1)}%` : "—"}</td><td className={td}>{s("impr") > 0 ? `$${Math.round((inv / s("impr")) * 1000).toLocaleString("es-AR")}` : "—"}</td><td className="px-2 py-1">{r.refs[m.medio]?.confianza}</td></>
                      : <td colSpan={7} className="px-2 py-1 text-muted-foreground">sin medición (suma solo inversión)</td>}
                  </tr>
                );
              })}
              {(() => {
                const t = r.impactos.total.reduce((a, x) => ({ impr: a.impr + x.impr, alc: a.alc + x.alc, clic: a.clic + x.clic, v50: a.v50 + x.v50, vbase: a.vbase + x.vbase }), { impr: 0, alc: 0, clic: 0, v50: 0, vbase: 0 });
                const invMedido = cfg.medios.filter((m) => r.impactos.porMedio[m.medio]).reduce((s, m) => s + (r.inversion.montos[m.medio] ?? []).reduce((a, b) => a + b, 0), 0);
                return (
                  <tr className="border-t bg-muted/30 font-semibold"><td className="px-2 py-1">Total</td><td className={td}>{M(tAnual)}</td><td className={td}>{cant(t.impr)}</td><td className={td}>{cant(t.alc)}</td><td className={td}>{cant(t.clic)}</td><td className={td}>{cant(t.v50)}</td>
                    <td className={td}>{t.vbase > 0 ? `${((t.v50 / t.vbase) * 100).toFixed(1)}%` : "—"}</td>
                    <td className={td} title="Solo la inversión de los medios con medición">{t.impr > 0 ? `$${Math.round((invMedido / t.impr) * 1000).toLocaleString("es-AR")}` : "—"}</td>
                    <td className="px-2 py-1 text-[10px] font-normal text-muted-foreground">frec. {t.alc > 0 ? (t.impr / t.alc).toFixed(1) : "—"}</td></tr>
                );
              })()}
            </tbody>
          </table>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {PLAN_META_KPIS.map((k) => (
            <div key={k} className="rounded-lg border p-2">
              <div className="text-xs font-semibold">{k}</div>
              <MetaEvolChart mode={k === "Frecuencia" || k === "VTR (≥50%)" ? "line" : "bar"} unidad={k === "Inversión" ? "$" : k === "Frecuencia" ? "x" : k === "VTR (≥50%)" ? "%" : ""}
                realName="Plan" metaName="Meta actual" data={MES.map((mes, i) => ({ mes, real: r.metas[k][i] ?? null, meta: metasActuales[k]?.[i] ?? null }))} />
            </div>
          ))}
        </div>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[900px] text-xs">
            <thead className="bg-muted/50 text-muted-foreground"><tr><th className="px-2 py-1.5 text-left font-medium">KPI · plan vs meta cargada hoy</th>{MES.map((m) => <th key={m} className={th}>{m}</th>)}<th className={th} title="Volúmenes: suma del año · Frecuencia y VTR: promedio de los meses con dato">Año</th></tr></thead>
            <tbody>
              {PLAN_META_KPIS.map((k) => {
                const f = (v: number | null | undefined) => (k === "Inversión" ? (v ? M(v) : "—") : k === "Frecuencia" ? (v != null ? v.toLocaleString("es-AR", { maximumFractionDigits: 1 }) : "—") : k === "VTR (≥50%)" ? (v != null ? `${v.toLocaleString("es-AR", { maximumFractionDigits: 1 })}%` : "—") : cant(v));
                const tasa = k === "Frecuencia" || k === "VTR (≥50%)";
                const anual = (a: (number | null)[]) => { const v = a.filter((x): x is number => x != null); return !v.length ? null : tasa ? v.reduce((s, x) => s + x, 0) / v.length : v.reduce((s, x) => s + x, 0); };
                return (
                  <Fragment key={k}>
                    <tr className="border-t"><td className="px-2 py-1 font-medium">{k} · plan</td>{r.metas[k].map((v, i) => <td key={i} className={td}>{f(v)}</td>)}<td className={`${td} font-semibold`}>{f(anual(r.metas[k]))}</td></tr>
                    <tr className="text-muted-foreground"><td className="px-2 pb-1 pl-4">meta actual</td>{(metasActuales[k] ?? []).map((v, i) => <td key={i} className={`${td} pb-1`}>{f(v)}</td>)}<td className={`${td} pb-1`}>{f(anual(metasActuales[k] ?? []))}</td></tr>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-muted-foreground">Inversión en $ M. El alcance es la suma del alcance de cada medio (igual que Impacto Campaña: no descuenta a quien ve varios medios). Frecuencia = impresiones ÷ alcance.</p>
        {editor && (
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" disabled={sucio || !guardado || ocupado} onClick={() => { if (confirm(`Esto reemplaza las metas ${anio} de Pauta Mkt (los 12 meses de los 6 KPIs) por las del plan. ¿Seguimos?`)) void enviar("POST"); }} className="rounded-md bg-[#1e40af] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50">
              Usar como metas {anio}
            </button>
            {(sucio || !guardado) && <span className="text-xs text-muted-foreground">Guardá el plan primero.</span>}
          </div>
        )}
      </section>

      {/* 6. Campañas + metas de Web, Redes y SEO */}
      <PlanOtros anio={anio} otros={cfg.otros} onChange={(o) => setCfg((c) => ({ ...c, otros: o }))} hist={hist} invPlan={r.inversion.total} ro={ro}
        puedeMetas={!sucio && !!guardado} ocupado={ocupado} onMetas={(p) => void enviar("POST", p)} metasActuales={metasOtros} />
    </div>
  );
}
