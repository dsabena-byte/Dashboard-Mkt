"use client";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { SIM_METRICS, simulate, optimize, defaultBounds, rescaleTo, predict, costPer, type SimModel, type SimMetric, type Bounds, type DemandPoint } from "@/lib/simulador";

// Simulador de presupuesto (cliente) — portado de BIP (sep-2026). Sistema visual de Drean: dato real /
// hoy en azul #1e40af, simulado en azul claro, referencias en gris pizarra; verde/rojo SOLO para el
// signo de la variación y el semáforo de confianza de la curva.

const REAL = "#1e40af", SIM = "#93c5fd", SLATE = "#94a3b8", GRID = "#e2e8f0", AXIS = "#64748b";
const nf = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
const short = (v: number) => (Math.abs(v) >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : Math.abs(v) >= 1e4 ? `${(v / 1e3).toFixed(0)}K` : nf.format(Math.round(v)));
const money = (v: number) => `$${short(v)}`;
const moneyFull = (v: number) => `$${nf.format(Math.round(v))}`;
const pctTxt = (a: number, b: number) => (b > 0 ? `${a >= b ? "+" : ""}${(((a - b) / b) * 100).toFixed(1)}%` : "—");
const CONF: Record<string, { bg: string; fg: string; t: string }> = {
  alta: { bg: "#dcfce7", fg: "#166534", t: "Confianza alta" },
  media: { bg: "#fef3c7", fg: "#92400e", t: "Confianza media" },
  baja: { bg: "#fee2e2", fg: "#991b1b", t: "Aproximada" },
};
const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const ymLbl = (ym: string) => `${MES[Number(ym.slice(5, 7)) - 1]} ${ym.slice(2, 4)}`;
const LBL = "text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground";
const NUM = "rounded-md border bg-background px-2 py-1 text-right text-xs tabular-nums";

export interface DemandaCat { categoria: string; serie: DemandPoint[]; puntos: DemandPoint[]; metodo: string }

export function Simulador({ model, demanda }: { model: SimModel; demanda: DemandaCat[] }) {
  const baseAlloc = useMemo(() => Object.fromEntries(model.channels.map((c) => [c.canal, c.currentSpend])), [model]);
  const baseTotal = useMemo(() => model.channels.reduce((s, c) => s + c.currentSpend, 0), [model]);

  const [alloc, setAlloc] = useState<Record<string, number>>(baseAlloc);
  const [fixed, setFixed] = useState(true);
  const [total, setTotal] = useState(baseTotal);
  const [metric, setMetric] = useState<SimMetric>(() => (model.channels.some((c) => c.curves.alcance) ? "alcance" : "impresiones"));
  const [bounds, setBounds] = useState<Record<string, Bounds>>(() => defaultBounds(model));
  const [focus, setFocus] = useState<string>(model.channels.find((c) => Object.keys(c.curves).length)?.canal ?? model.channels[0]?.canal ?? "");
  const [optMsg, setOptMsg] = useState<string | null>(null);

  const sim = useMemo(() => simulate(model, alloc), [model, alloc]);
  const sliderMax = (canal: string) => Math.max(bounds[canal]?.max ?? 0, (baseAlloc[canal] ?? 0) * 3, 1);

  function move(canal: string, v: number) {
    setOptMsg(null);
    const next = { ...alloc, [canal]: Math.max(0, v) };
    setAlloc(fixed ? rescaleTo(next, total, canal) : next);
  }
  function runOpt() {
    const t = fixed ? total : Object.values(alloc).reduce((a, b) => a + b, 0);
    // Los medios que no informan la métrica quedan fijos (no se les saca presupuesto "gratis").
    const o = optimize(model, t, metric, bounds, 400, alloc);
    const before = simulate(model, alloc).total.values[metric], after = simulate(model, o).total.values[metric];
    setAlloc(o);
    const m = SIM_METRICS.find((x) => x.key === metric)!;
    setOptMsg(after > before + 1e-6
      ? `Reparto optimizado para ${m.label.toLowerCase()}: ${pctTxt(after, before)} con el mismo presupuesto, dentro de los topes por medio. Los medios sin esa métrica quedaron fijos.`
      : `El reparto actual ya es el mejor para ${m.label.toLowerCase()} dentro de los topes elegidos.`);
  }
  function reset() { setAlloc(baseAlloc); setTotal(baseTotal); setBounds(defaultBounds(model)); setOptMsg(null); }

  const spendNow = Object.values(alloc).reduce((a, b) => a + b, 0);
  const fch = model.channels.find((c) => c.canal === focus);
  const fcurve = fch?.curves[metric];
  const curveData = useMemo(() => {
    if (!fch || !fcurve) return [];
    const max = sliderMax(fch.canal);
    return Array.from({ length: 31 }, (_, i) => { const x = (max * i) / 30; return { x, y: predict(fcurve, x) }; });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fch, fcurve, bounds]);
  const barData = model.channels.map((c) => ({ canal: c.canal, hoy: c.currentSpend, sim: alloc[c.canal] ?? 0 }));
  const metricLabel = SIM_METRICS.find((m) => m.key === metric)!.label;

  return (
    <div className="space-y-4">
      {/* Controles */}
      <div className="flex flex-wrap items-end gap-4 rounded-xl border bg-card p-4 shadow-sm">
        <label className="flex flex-col gap-1">
          <span className={LBL}>Presupuesto mensual</span>
          {fixed ? (
            <input type="number" className={`${NUM} w-40 text-sm`} value={Math.round(total)} min={0}
              onChange={(e) => { const t = Math.max(0, Number(e.target.value) || 0); setTotal(t); setAlloc(rescaleTo(alloc, t)); setOptMsg(null); }} />
          ) : <span className="py-1 text-base font-semibold tabular-nums">{moneyFull(spendNow)}</span>}
        </label>
        <label className="flex cursor-pointer items-center gap-2 pb-1.5 text-sm">
          <input type="checkbox" checked={fixed} onChange={(e) => { setFixed(e.target.checked); if (e.target.checked) setTotal(spendNow); }} />
          Total fijo (al mover un medio se ajustan los otros)
        </label>
        <label className="flex flex-col gap-1">
          <span className={LBL}>Optimizar para</span>
          <select value={metric} onChange={(e) => { setMetric(e.target.value as SimMetric); setOptMsg(null); }} className="rounded-md border bg-background px-2 py-1.5 text-sm">
            {SIM_METRICS.filter((m) => model.channels.some((c) => c.curves[m.key])).map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
          </select>
        </label>
        <div className="flex gap-2">
          <button onClick={runOpt} className="rounded-md px-3 py-1.5 text-sm font-semibold text-white" style={{ background: REAL }}>Optimizar automáticamente</button>
          <button onClick={reset} className="rounded-md border px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">Volver a hoy</button>
        </div>
      </div>
      {optMsg && <p className="-mt-2 text-xs text-foreground">{optMsg}</p>}

      {/* KPIs hoy vs simulado */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className={LBL}>Inversión mensual</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums" style={{ color: REAL }}>{money(sim.total.spend)}</div>
          <div className="mt-1 text-xs text-muted-foreground">Hoy {money(sim.total.baseSpend)} · {pctTxt(sim.total.spend, sim.total.baseSpend)}</div>
        </div>
        {SIM_METRICS.filter((m) => sim.total.base[m.key] > 0).map((m) => {
          const v = sim.total.values[m.key], b = sim.total.base[m.key];
          const cSim = costPer(m.key, sim.byChannel.filter((x) => x.values[m.key] != null).reduce((s, x) => s + x.spend, 0), v);
          const cBase = costPer(m.key, model.channels.filter((c) => c.curves[m.key]).reduce((s, c) => s + c.currentSpend, 0), b);
          const same = Math.abs(v - b) < 1e-6 * Math.max(1, b);
          return (
            <div key={m.key} className="rounded-xl border bg-card p-4 shadow-sm" style={metric === m.key ? { borderColor: REAL } : undefined}>
              <div className={LBL}>{m.label}{metric === m.key ? " · objetivo" : ""}</div>
              <div className="mt-1 text-2xl font-semibold tabular-nums" style={{ color: REAL }}>{short(v)}</div>
              <div className="mt-1 text-xs text-muted-foreground">Hoy {short(b)} · <span className="font-semibold" style={{ color: same ? AXIS : v >= b ? "#16a34a" : "#dc2626" }}>{pctTxt(v, b)}</span></div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">{m.costLabel}: {cSim != null ? money(cSim) : "—"} (hoy {cBase != null ? money(cBase) : "—"})</div>
            </div>
          );
        })}
      </div>

      {/* Tabla por medio */}
      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-2 px-4 pb-1 pt-3">
          <h3 className="text-sm font-semibold">Reparto por medio</h3>
          <span className="text-[11px] text-muted-foreground">Hoy = promedio de {model.meses === 1 ? "1 mes cerrado" : `${model.meses} meses cerrados`} ({model.mesesLabel.map(ymLbl).join(", ")}). Mín./máx. = topes para la optimización.</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] border-collapse text-xs">
            <thead>
              <tr className="text-left text-[10.5px] uppercase tracking-wide text-muted-foreground">
                {["Medio", "Inversión", "", "vs hoy", "Mín. / Máx.", "Impr./contactos", "Alcance", "Clicks", "Curva"].map((h, i) => (
                  <th key={i} className={`px-3 py-2 font-semibold ${i >= 3 && i <= 7 ? "text-right" : ""}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {model.channels.map((c) => {
                const row = sim.byChannel.find((x) => x.canal === c.canal)!;
                const cv = c.curves[metric] ?? Object.values(c.curves)[0];
                const conf = cv ? CONF[cv.confianza] : null;
                return (
                  <tr key={c.canal} className={`cursor-pointer border-t ${focus === c.canal ? "bg-muted/60" : ""}`} onClick={() => setFocus(c.canal)}>
                    <td className="whitespace-nowrap px-3 py-2 font-semibold">
                      {c.canal}
                      {c.offline && <span className="ml-1.5 rounded border px-1 text-[10px] font-medium text-muted-foreground">offline</span>}
                    </td>
                    <td className="min-w-[180px] px-3 py-2">
                      <input type="range" min={0} max={sliderMax(c.canal)} step={Math.max(1, sliderMax(c.canal) / 200)} value={alloc[c.canal] ?? 0}
                        onChange={(e) => move(c.canal, Number(e.target.value))} className="w-full" style={{ accentColor: REAL }} aria-label={`Inversión ${c.canal}`} />
                    </td>
                    <td className="px-1 py-2"><input type="number" className={`${NUM} w-28`} value={Math.round(alloc[c.canal] ?? 0)} min={0} onChange={(e) => move(c.canal, Number(e.target.value) || 0)} /></td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{pctTxt(alloc[c.canal] ?? 0, c.currentSpend)}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                      <input type="number" className={`${NUM} w-24`} value={Math.round(bounds[c.canal]?.min ?? 0)} min={0} aria-label="Mínimo"
                        onChange={(e) => setBounds({ ...bounds, [c.canal]: { min: Math.max(0, Number(e.target.value) || 0), max: bounds[c.canal]?.max ?? 0 } })} />{" "}
                      <input type="number" className={`${NUM} w-24`} value={Math.round(bounds[c.canal]?.max ?? 0)} min={0} aria-label="Máximo"
                        onChange={(e) => setBounds({ ...bounds, [c.canal]: { min: bounds[c.canal]?.min ?? 0, max: Math.max(0, Number(e.target.value) || 0) } })} />
                    </td>
                    {(["impresiones", "alcance", "clicks"] as SimMetric[]).map((k) => (
                      <td key={k} className="px-3 py-2 text-right tabular-nums">
                        {row.values[k] == null ? <span className="text-muted-foreground/60">—</span> : <>{short(row.values[k]!)} <span className="text-[10.5px] text-muted-foreground">{pctTxt(row.values[k]!, row.base[k]!)}</span></>}
                      </td>
                    ))}
                    <td className="whitespace-nowrap px-3 py-2">
                      {conf && cv ? (
                        <span title={`${cv.method === "promedio" ? "Eficiencia promedio con rendimiento decreciente supuesto" : `Regresión sobre ${cv.n} meses`}${cv.r2 != null ? ` · R² ${cv.r2.toFixed(2)}` : ""} · elasticidad ${cv.b.toFixed(2)}`}
                          className="cursor-help rounded-full px-2 py-0.5 text-[10.5px] font-semibold" style={{ background: conf.bg, color: conf.fg }}>{conf.t}</span>
                      ) : <span className="text-[10.5px] text-muted-foreground">sin performance cargada</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <h3 className="text-sm font-semibold">Inversión por medio · hoy vs simulado</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={barData} margin={{ top: 16, right: 8, left: 0, bottom: 4 }} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
              <XAxis dataKey="canal" stroke={AXIS} fontSize={10} tickLine={false} axisLine={{ stroke: GRID }} interval={0} angle={-30} textAnchor="end" height={60} />
              <YAxis width={56} stroke={AXIS} fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v: number) => short(v)} />
              <Tooltip formatter={(v) => moneyFull(Number(v))} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="hoy" name="Hoy" fill={REAL} radius={[3, 3, 0, 0]} />
              <Bar dataKey="sim" name="Simulado" fill={SIM} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-sm font-semibold">Curva de respuesta · {focus}</h3>
            <select value={focus} onChange={(e) => setFocus(e.target.value)} className="rounded-md border bg-background px-2 py-1 text-xs">
              {model.channels.map((c) => <option key={c.canal} value={c.canal}>{c.canal}</option>)}
            </select>
          </div>
          {fcurve && fch ? (
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={curveData} margin={{ top: 16, right: 12, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
                <XAxis dataKey="x" type="number" domain={[0, "dataMax"]} stroke={AXIS} fontSize={10} tickLine={false} axisLine={{ stroke: GRID }} tickFormatter={(v: number) => money(v)} />
                <YAxis width={56} stroke={AXIS} fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v: number) => short(v)} />
                <Tooltip formatter={(v) => short(Number(v))} labelFormatter={(v) => `Inversión ${moneyFull(Number(v))}`} />
                <Line dataKey="y" name={metricLabel} stroke={REAL} strokeWidth={2} dot={false} type="monotone" />
                <ReferenceDot x={fch.currentSpend} y={predict(fcurve, fch.currentSpend)} r={5} fill={SLATE} stroke="#fff" label={{ value: "hoy", position: "top", fontSize: 10, fill: AXIS }} />
                <ReferenceDot x={alloc[fch.canal] ?? 0} y={predict(fcurve, alloc[fch.canal] ?? 0)} r={5} fill={REAL} stroke="#fff" label={{ value: "simulado", position: "bottom", fontSize: 10, fill: REAL }} />
              </ComposedChart>
            </ResponsiveContainer>
          ) : <p className="mt-3 text-xs text-muted-foreground">{focus} no informa {metricLabel.toLowerCase()} (los medios offline no tienen alcance ni clicks, y los que no tienen performance cargada no proyectan). Elegí otra métrica u otro medio.</p>}
          <p className="mt-1 text-[11px] text-muted-foreground">La pendiente se aplana: cada peso extra rinde menos. Ahí está el punto en el que conviene pasar presupuesto a otro medio.</p>
        </div>
      </div>

      {/* Supuestos */}
      <div className="rounded-xl border bg-muted/40 p-4">
        <h3 className="text-sm font-semibold">Cómo se calcula (y qué tener en cuenta)</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-relaxed text-muted-foreground">
          <li>Para cada medio se estima resultado = a × inversión<sup>b</sup> con sus meses de pauta (año en curso + anterior). <b className="font-semibold">b</b> menor a 1 = rendimientos decrecientes.</li>
          <li>Datos = el mismo modelo del Tablero: Meta siempre por la API, OMD solo para medios sin API, DV360 convertido a pesos con el tipo de cambio del mes, UGC incluido, Performance Max excluido, solo meses cerrados.</li>
          <li>La curva se ajusta para que, sin cambios, dé el resultado mensual de hoy. Fuera del rango ya invertido, la proyección es una extrapolación.</li>
          <li>El alcance total es la suma del alcance de cada medio (sin deduplicar entre medios), igual que en Impacto Campaña.</li>
          <li>La optimización reparte el presupuesto donde el próximo peso rinde más, respetando los mínimos y máximos de cada medio; los medios que no informan la métrica elegida quedan fijos.</li>
          {model.nota.map((n) => <li key={n}>{n}</li>)}
        </ul>
      </div>

      {/* Demanda */}
      {demanda.length > 0 && (
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <h3 className="text-sm font-semibold">Proyección de demanda de la categoría</h3>
          <p className="mb-2 mt-0.5 text-xs text-muted-foreground">Búsquedas mensuales en Google de la categoría (keyword genérica, sin marca · DataForSEO). Sirve para anticipar cuándo sube la demanda y acompañarla con presupuesto.</p>
          <div className="grid gap-4 lg:grid-cols-3">
            {demanda.map((d) => {
              const data = [
                ...d.serie.map((p) => ({ mes: ymLbl(p.mes), real: p.v as number | null, proy: null as number | null })),
                ...d.puntos.map((p) => ({ mes: ymLbl(p.mes), real: null as number | null, proy: p.v as number | null })),
              ];
              return (
                <div key={d.categoria}>
                  <div className="text-xs font-semibold capitalize">{d.categoria}</div>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={data} margin={{ top: 12, right: 6, left: 0, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
                      <XAxis dataKey="mes" stroke={AXIS} fontSize={9.5} tickLine={false} axisLine={{ stroke: GRID }} interval={0} angle={-35} textAnchor="end" height={40} />
                      <YAxis width={56} stroke={AXIS} fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v: number) => short(v)} />
                      <Tooltip formatter={(v) => nf.format(Number(v))} />
                      <Bar dataKey="real" name="Búsquedas" fill={REAL} radius={[3, 3, 0, 0]} />
                      <Bar dataKey="proy" name="Proyección" fill="#cbd5e1" stroke={SLATE} strokeDasharray="3 2" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="text-[11px] text-muted-foreground">Método: {d.metodo}.</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
