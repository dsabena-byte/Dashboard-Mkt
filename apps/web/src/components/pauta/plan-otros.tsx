"use client";
import { Fragment, useMemo } from "react";
import {
  EFECTO_CALIBRADO, INTENSIDADES, PLANES_OTROS, TIPOS_CAMPANA, proyectarOtros,
  type HistOtros, type KpiProyectado, type OtrosConfig, type TipoCampana,
} from "@/lib/plan-otros-kpis";
import { MetaEvolChart } from "@/components/pauta/meta-evol-chart";

// Sección 6 del Plan anual: calendario de campañas de Redes + metas proyectadas de Web, Redes (IG/FB) y SEO.
// Mismo cálculo puro que usa la API al cargar las metas (lib/plan-otros-kpis.ts).
const MES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const CELDA = ["", "bg-[#bfdbfe] text-[#1e3a8a]", "bg-[#3b82f6] text-white", "bg-[#1e3a8a] text-white"];
const th = "px-2 py-1.5 text-right font-medium";
const td = "px-2 py-1 text-right tabular-nums";
const inputCls = "w-16 rounded border bg-background px-1 py-0.5 text-right tabular-nums text-xs disabled:opacity-60";

const fmt = (u: string) => (v: number | null | undefined) => {
  if (v == null || !Number.isFinite(v)) return "—";
  if (u === "$") return `$${(v / 1e6).toLocaleString("es-AR", { maximumFractionDigits: 1 })} M`;
  if (u === "%") return `${v.toLocaleString("es-AR", { maximumFractionDigits: 2 })}%`;
  if (u === "x" || u === "pts") return v.toLocaleString("es-AR", { maximumFractionDigits: 2 });
  if (u === "s") return `${Math.round(v)} s`;
  return Math.abs(v) >= 1e6 ? `${(v / 1e6).toLocaleString("es-AR", { maximumFractionDigits: 2 })} M` : Math.round(v).toLocaleString("es-AR");
};
const anual = (k: KpiProyectado, a: (number | null)[]) => {
  const v = a.filter((x): x is number => x != null);
  if (!v.length) return null;
  if (k.kpi === "Seguidores") return v.at(-1)!; // stock: el de diciembre
  return k.tipo === "sum" ? v.reduce((s, x) => s + x, 0) : v.reduce((s, x) => s + x, 0) / v.length;
};

export function PlanOtros({ anio, otros, onChange, hist, invPlan, ro, puedeMetas, ocupado, onMetas, metasActuales }: {
  anio: number; otros: OtrosConfig; onChange: (o: OtrosConfig) => void; hist: HistOtros; invPlan: number[]; ro: boolean;
  puedeMetas: boolean; ocupado: boolean; onMetas: (plan: string) => void; metasActuales: Record<string, (number | null)[]>;
}) {
  const proy = useMemo(() => proyectarOtros(otros, hist, anio, invPlan), [otros, hist, anio, invPlan]);
  const setGantt = (t: TipoCampana, i: number) => onChange({ ...otros, gantt: { ...otros.gantt, [t]: otros.gantt[t].map((v, k) => (k === i ? (v + 1) % 4 : v)) } });
  const setEf = (t: TipoCampana, campo: "alc" | "int" | "seg", v: number) => onChange({ ...otros, efectos: { ...otros.efectos, [t]: { ...otros.efectos[t], [campo]: v } } });
  const setAmb = (campo: keyof OtrosConfig["amb"], v: number) => onChange({ ...otros, amb: { ...otros.amb, [campo]: v } });
  const num = (v: string) => (Number.isFinite(Number(v)) ? Number(v) : 0);

  return (
    <section className="space-y-4">
      <h3 className="text-base font-semibold">6. Calendario de campañas y metas de Web, Redes y SEO</h3>
      <p className="text-xs text-muted-foreground">
        Web: mismo mes de {hist.anioBase} mejorado por la ambición (los meses que todavía no cerraron se pronostican). Instagram: un mes normal
        (mediana de los últimos 6 meses cerrados) más el efecto de las campañas del calendario. Facebook: mes normal × ambición. SEO y mercado:
        continuidad de {hist.anioBase}.
      </p>

      {/* Gantt */}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[820px] text-xs">
          <thead className="bg-muted/50 text-muted-foreground"><tr><th className="px-2 py-1.5 text-left font-medium">Campañas de Redes · tocá un mes para cambiar la intensidad</th>{MES.map((m) => <th key={m} className="px-1 py-1.5 text-center font-medium">{m}</th>)}</tr></thead>
          <tbody>
            {TIPOS_CAMPANA.map((t) => (
              <tr key={t.id} className="border-t">
                <td className="px-2 py-1"><div className="font-medium">{t.label}</div><div className="text-[10px] text-muted-foreground">{t.ej}</div></td>
                {otros.gantt[t.id].map((v, i) => (
                  <td key={i} className="px-0.5 py-1 text-center">
                    <button type="button" disabled={ro} onClick={() => setGantt(t.id, i)} aria-label={`${t.label} ${MES[i]}: ${INTENSIDADES[v]}`}
                      className={`h-7 w-full min-w-[44px] rounded border text-[10px] ${CELDA[v]} disabled:cursor-default`}>{v ? INTENSIDADES[v] : ""}</button>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Efectos + ambición */}
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 text-muted-foreground"><tr><th className="px-2 py-1.5 text-left font-medium">Efecto de un mes de intensidad media</th><th className={th}>Alcance %</th><th className={th}>Interacciones %</th><th className={th}>Seguidores</th><th className="px-2 py-1.5 text-left font-medium">De dónde sale</th></tr></thead>
            <tbody>
              {TIPOS_CAMPANA.map((t) => (
                <tr key={t.id} className="border-t">
                  <td className="px-2 py-1">{t.label}</td>
                  {(["alc", "int", "seg"] as const).map((c) => (
                    <td key={c} className={td}><input type="number" className={inputCls} disabled={ro} value={otros.efectos[t.id][c]} onChange={(e) => setEf(t.id, c, num(e.target.value))} /></td>
                  ))}
                  <td className="px-2 py-1 text-[10px] text-muted-foreground">{EFECTO_CALIBRADO[t.id] ? <>dato real: {EFECTO_CALIBRADO[t.id]}; seguidores: supuesto</> : "supuesto, sin dato (editalo)"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-2 py-1.5 text-[10px] text-muted-foreground">Baja = la mitad, alta = 1,5 veces. Si en un mes hay varias campañas, los efectos se suman.</p>
        </div>
        <div className="space-y-2 rounded-lg border p-3 text-xs">
          <div className="font-semibold">Ambición sobre la base (%)</div>
          {([["web", "Web / Ecommerce"], ["fb", "Facebook"], ["seo", "SEO / mercado"]] as const).map(([k, l]) => (
            <label key={k} className="flex items-center justify-between gap-2">{l}<input type="number" className={inputCls} disabled={ro} value={otros.amb[k]} onChange={(e) => setAmb(k, num(e.target.value))} /></label>
          ))}
          <p className="text-[10px] text-muted-foreground">0 = sostener lo que ya se hizo. En Instagram la ambición la ponen las campañas del calendario.</p>
        </div>
      </div>

      {/* Proyección por tablero */}
      {PLANES_OTROS.map(({ plan, titulo }) => {
        const kpis = proy[plan] ?? [];
        return (
          <div key={plan} className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <h4 className="flex-1 text-sm font-semibold">{titulo}</h4>
              {!ro && (
                <button type="button" disabled={!puedeMetas || ocupado || !kpis.length}
                  onClick={() => { if (confirm(`Esto reemplaza las metas ${anio} de "${plan}" (los 12 meses de ${kpis.length} KPIs) por la proyección. ¿Seguimos?`)) onMetas(plan); }}
                  className="rounded-md bg-[#1e40af] px-3 py-1 text-xs font-medium text-white disabled:opacity-50">Usar como metas {anio}</button>
              )}
            </div>
            {!kpis.length ? <p className="text-xs text-muted-foreground">Sin datos reales de {hist.anioBase} para proyectar.</p> : (
              <>
                {plan === "Redes Sociales" && (
                  <div className="grid gap-3 md:grid-cols-2">
                    {kpis.filter((k) => k.kpi === "Alcance orgánico" || k.kpi === "Interacciones").map((k) => (
                      <div key={k.kpi} className="rounded-lg border p-2">
                        <div className="text-xs font-semibold">{k.kpi} · proyección vs mes normal</div>
                        <MetaEvolChart mode="bar" unidad="" realName="Proyección" metaName="Mes normal" data={MES.map((mes, i) => ({ mes, real: k.valores[i] ?? null, meta: k.base[i] ?? null }))} />
                      </div>
                    ))}
                  </div>
                )}
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full min-w-[980px] text-xs">
                    <thead className="bg-muted/50 text-muted-foreground"><tr><th className="px-2 py-1.5 text-left font-medium">KPI · proyección vs meta cargada hoy</th>{MES.map((m) => <th key={m} className={th}>{m}</th>)}<th className={th} title="Volúmenes: suma · tasas: promedio · seguidores: diciembre">Año</th></tr></thead>
                    <tbody>
                      {kpis.map((k) => {
                        const f = fmt(k.unidad), actual = metasActuales[`${plan}|${k.kpi}`] ?? [];
                        return (
                          <Fragment key={k.kpi}>
                            <tr className="border-t"><td className="px-2 py-1"><span className="font-medium">{k.kpi}</span><div className="text-[10px] text-muted-foreground">{k.metodo}</div></td>{k.valores.map((v, i) => <td key={i} className={td}>{f(v)}</td>)}<td className={`${td} font-semibold`}>{f(anual(k, k.valores))}</td></tr>
                            <tr className="text-muted-foreground"><td className="px-2 pb-1 pl-4">meta actual</td>{MES.map((_, i) => <td key={i} className={`${td} pb-1`}>{f(actual[i])}</td>)}<td className={`${td} pb-1`}>{f(anual(k, actual))}</td></tr>
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        );
      })}
      {!ro && !puedeMetas && <p className="text-xs text-muted-foreground">Guardá el plan antes de usar la proyección como metas.</p>}
    </section>
  );
}
