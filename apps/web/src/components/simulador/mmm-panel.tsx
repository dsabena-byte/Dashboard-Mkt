"use client";
import { useMemo, useState } from "react";
import { Area, Bar, CartesianGrid, ComposedChart, Legend, Line, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ajustarMmm, simularMmm, optimizarMmm, CONFIANZA_TEXTO, MIN_PERIODOS, type Rango } from "@/lib/stats/mmm";
import { inputMmm, type MmmDatos } from "@/lib/mmm-datos";
import { LearnButton } from "@/components/knowledge/learn-button";

// "Qué aporta cada medio" (MMM-lite) dentro del Simulador — portado de BIP (#135). El modelo se AJUSTA
// en el navegador (lib/stats/mmm, puro) sobre las series mensuales que manda el server → cero costo en
// el render. Sistema visual de Drean: estimación en azul #1e40af, banda en azul claro, base en gris
// pizarra; verde/amarillo/rojo SOLO para el semáforo de confianza/evidencia.

const REAL = "#1e40af", BANDA = "#bfdbfe", SLATE = "#94a3b8", GRID = "#e2e8f0", AXIS = "#64748b";
const PALETA = ["#1e40af", "#3b82f6", "#60a5fa", "#93c5fd", "#1e3a8a", "#2563eb", "#bfdbfe"];
const nf = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
const short = (v: number) => (Math.abs(v) >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : Math.abs(v) >= 1e4 ? `${(v / 1e3).toFixed(0)}K` : Math.abs(v) >= 10 ? nf.format(Math.round(v)) : v.toFixed(2));
const money = (v: number) => `$${short(v)}`;
const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const ymLbl = (ym: string) => `${MES[Number(ym.slice(5, 7)) - 1]} ${ym.slice(2, 4)}`;
const SEM: Record<string, { bg: string; fg: string }> = {
  alta: { bg: "#dcfce7", fg: "#166534" }, media: { bg: "#fef3c7", fg: "#92400e" }, baja: { bg: "#fee2e2", fg: "#991b1b" },
  "con evidencia": { bg: "#dcfce7", fg: "#166534" }, "débil": { bg: "#fef3c7", fg: "#92400e" }, "sin evidencia": { bg: "#f1f5f9", fg: "#475569" },
};
const Pill = ({ k, t }: { k: string; t?: string }) => (
  <span className="whitespace-nowrap rounded-full px-2 py-0.5 text-[10.5px] font-semibold" style={{ background: SEM[k]?.bg ?? "#f1f5f9", color: SEM[k]?.fg ?? "#475569" }}>{t ?? k}</span>
);
const LBL = "text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground";

export function MmmPanel({ datos, alloc, onAlloc }: { datos: MmmDatos; alloc: Record<string, number>; onAlloc: (a: Record<string, number>) => void }) {
  const [kpiKey, setKpiKey] = useState(datos.kpis.find((k) => k.key === "transacciones")?.key ?? datos.kpis[0]?.key ?? "");
  const [focus, setFocus] = useState<string>("");
  const [msg, setMsg] = useState<string | null>(null);
  const kpi = datos.kpis.find((k) => k.key === kpiKey);

  const prep = useMemo(() => (kpiKey ? inputMmm(datos, kpiKey) : null), [datos, kpiKey]);
  const res = useMemo(() => (prep ? ajustarMmm(prep.input, { bootstrap: 120, seed: `mmm-${kpiKey}` }) : null), [prep, kpiKey]);
  const ok = res && res.ok ? res : null;
  const fm = ok?.medios.find((m) => m.nombre === focus) ?? ok?.medios[0];
  const esc = useMemo(() => (ok ? simularMmm(ok, alloc) : null), [ok, alloc]);

  if (!datos.kpis.length) {
    return (
      <div className="rounded-xl border bg-card p-4 text-sm shadow-sm">
        <div className="flex items-center gap-1.5 font-semibold">Qué aporta cada medio · MMM-lite <LearnButton k="mmm" /></div>
        <p className="mt-1 text-xs text-muted-foreground">Para estimar cuánto aporta cada medio al negocio hace falta un resultado mensual de GA4 (usuarios, transacciones o ingresos) y no hay series cargadas. Seguí usando las curvas de entrega.</p>
      </div>
    );
  }

  const rng = (r: Rango, f: (v: number) => string) => `${f(r.p50)} (${f(r.p10)} – ${f(r.p90)})`;
  const fmtK = (v: number) => (kpi?.unidad === "$" ? money(v) : short(v));
  const unit = kpi?.unidad === "$" ? "$ de ingresos" : (kpi?.label ?? "").toLowerCase();
  const n = prep?.input.periodos.length ?? 0;

  function optimizar() {
    if (!ok) return;
    const medios = new Set(ok.medios.map((m) => m.nombre));
    const total = ok.medios.reduce((s, m) => s + (alloc[m.nombre] ?? m.inversionHoy), 0);
    const o = optimizarMmm(ok, total);
    const next = { ...alloc };
    for (const [k, v] of Object.entries(o)) if (medios.has(k)) next[k] = v;
    const antes = simularMmm(ok, alloc), despues = simularMmm(ok, next);
    onAlloc(next);
    const d = despues.kpi.p50 - antes.kpi.p50;
    setMsg(d > 1e-6 ? `Reparto optimizado para ${kpi?.label.toLowerCase()}: +${fmtK(d)} por mes (mediana del modelo) moviendo presupuesto entre ${ok.medios.length} medios, dentro de 50%–200% de lo de hoy. Los medios fuera del modelo quedan igual.` : "Con este modelo el reparto actual ya es el mejor dentro de los topes.");
  }

  const decomp = ok ? ok.periodos.map((p, t) => {
    const row: Record<string, number | string> = { mes: ymLbl(p), Real: ok.kpi[t] ?? 0, Base: Math.max(0, ok.base.serie[t] ?? 0) };
    ok.medios.forEach((m) => { row[m.nombre] = m.serie[t] ?? 0; });
    return row;
  }) : [];
  const curva = fm ? fm.curva.map((p) => ({ x: p.inversion, p50: p.p50, banda: [p.p10, p.p90] as [number, number] })) : [];
  const valorEn = (S: number) => {
    if (!fm) return 0;
    const c = fm.curva;
    for (let i = 1; i < c.length; i++) { const a = c[i - 1]!, b = c[i]!; if (b.inversion >= S) { const w = b.inversion > a.inversion ? (S - a.inversion) / (b.inversion - a.inversion) : 0; return a.p50 + w * (b.p50 - a.p50); } }
    return c[c.length - 1]?.p50 ?? 0;
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h3 className="flex items-center gap-1.5 text-sm font-semibold">Qué aporta cada medio · MMM-lite <LearnButton k="mmm" /></h3>
            <p className="mt-1 max-w-3xl text-xs text-muted-foreground">
              Cuánto de {kpi?.label.toLowerCase()} explica cada medio, con <b>adstock</b> (el efecto sigue unos meses) y <b>saturación</b> (cada peso rinde menos).
              Se estima con los meses cerrados de pauta (mismo modelo por medio que el Tablero) y de GA4, en $.
            </p>
          </div>
          <label className="flex flex-col gap-1">
            <span className={LBL}>Resultado a explicar</span>
            <select value={kpiKey} onChange={(e) => { setKpiKey(e.target.value); setMsg(null); setFocus(""); }} className="rounded-md border bg-background px-2 py-1.5 text-sm">
              {datos.kpis.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
            </select>
          </label>
        </div>
        {!ok ? (
          <div className="mt-3 border-l-[3px] pl-3" style={{ borderColor: SLATE }}>
            <div className="text-sm font-semibold">Dato insuficiente para este modelo</div>
            <p className="mt-1 text-xs text-muted-foreground">
              {res && !res.ok ? res.motivo : "No hay meses con pauta y con este resultado a la vez"}. Hoy hay <b>{n} {n === 1 ? "mes cerrado" : "meses cerrados"}</b> con pauta y {kpi?.label.toLowerCase()}
              {prep?.input.periodos.length ? ` (${ymLbl(prep.input.periodos[0]!)} a ${ymLbl(prep.input.periodos[prep.input.periodos.length - 1]!)})` : ""}. El MMM se habilita solo con
              <b> {MIN_PERIODOS.mensual}+ meses</b> y con inversión que <b>varía</b> entre meses (si siempre se invierte lo mismo, no se puede separar el efecto de la pauta del resto).
              Mientras tanto quedan las curvas de entrega (impresiones, alcance, clicks).
            </p>
            {res && !res.ok && res.excluidos.length > 0 && <p className="mt-1 text-[11px] text-muted-foreground">Medios que no se pueden estimar: {res.excluidos.map((e) => `${e.nombre} (${e.motivo})`).join(" · ")}.</p>}
            {prep && prep.input.medios.length > 0 && (
              <p className="mt-1 text-[11px] text-muted-foreground">Medios que entrarían al modelo: {prep.input.medios.map((m) => m.nombre).join(", ")}.</p>
            )}
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Pill k={ok.confianza} t={`Confianza ${ok.confianza}`} />
            <span className="text-xs text-muted-foreground">{CONFIANZA_TEXTO[ok.confianza]} {ok.n} meses · {ok.obsPorParametro.toFixed(1)} datos por parámetro · R² {ok.ajuste.r2.toFixed(2)}{ok.ajuste.backtest?.mape != null ? ` · error fuera de muestra (últimos ${ok.ajuste.backtest.h} meses) ${ok.ajuste.backtest.mape.toFixed(0)}%` : ""}.</span>
          </div>
        )}
      </div>

      {ok && esc && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <div className={LBL}>{kpi?.label} por mes · reparto simulado</div>
              <div className="mt-1 text-2xl font-semibold tabular-nums" style={{ color: REAL }}>{fmtK(esc.kpi.p50)}</div>
              <div className="mt-1 text-xs text-muted-foreground">Rango {fmtK(esc.kpi.p10)} – {fmtK(esc.kpi.p90)} (80% de las réplicas)</div>
            </div>
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <div className={LBL}>Cambio vs hoy</div>
              <div className="mt-1 text-2xl font-semibold tabular-nums" style={{ color: REAL }}>{esc.delta.p50 >= 0 ? "+" : ""}{fmtK(esc.delta.p50)}</div>
              <div className="mt-1 text-xs text-muted-foreground">Entre {fmtK(esc.delta.p10)} y {fmtK(esc.delta.p90)}{esc.delta.p10 < 0 && esc.delta.p90 > 0 ? " · el rango cruza el cero: el efecto no es seguro" : ""}</div>
            </div>
            <div className="flex flex-col justify-center gap-2 rounded-xl border bg-card p-4 shadow-sm">
              <button onClick={optimizar} className="rounded-md px-3 py-1.5 text-sm font-semibold text-white" style={{ background: REAL }}>Optimizar para {kpi?.label.toLowerCase()}</button>
              <span className="text-[11px] text-muted-foreground">Mismo presupuesto, repartido donde el próximo peso suma más {unit} según el modelo.</span>
            </div>
          </div>
          {msg && <p className="-mt-2 text-xs text-foreground">{msg}</p>}

          <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
            <div className="px-4 pb-1 pt-3"><h3 className="inline text-sm font-semibold">Qué aporta cada medio</h3><span className="ml-2 text-[11px] text-muted-foreground">Mediana y rango p10–p90 de {ok.draws.length} réplicas bootstrap.</span></div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-xs">
                <thead>
                  <tr className="text-left text-[10.5px] uppercase tracking-wide text-muted-foreground">
                    {["Medio", "Aporte al resultado", `${kpi?.label} por cada $1.000`, "Próximos $1.000 (marginal)", "Zona de la curva", "Arrastre", "Evidencia"].map((h, i) => <th key={i} className={`px-3 py-2 font-semibold ${i >= 1 && i <= 3 ? "text-right" : ""}`}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {ok.medios.map((m) => (
                    <tr key={m.nombre} className={`cursor-pointer border-t ${fm?.nombre === m.nombre ? "bg-muted/60" : ""}`} onClick={() => setFocus(m.nombre)}>
                      <td className="px-3 py-2 font-semibold">{m.nombre}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{rng(m.contribucionPct, (v) => `${v.toFixed(1)}%`)}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{rng(m.roi, (v) => (kpi?.unidad === "$" ? money(v * 1000) : short(v * 1000)))}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{rng(m.mroi, (v) => (kpi?.unidad === "$" ? money(v * 1000) : short(v * 1000)))}</td>
                      <td className="px-3 py-2">{m.zona}</td>
                      <td className="whitespace-nowrap px-3 py-2" title="Qué parte del efecto de un mes pasa al siguiente (adstock)">{Math.round(m.decay * 100)}% al mes siguiente</td>
                      <td className="px-3 py-2"><Pill k={m.evidencia} /></td>
                    </tr>
                  ))}
                  <tr className="border-t text-muted-foreground">
                    <td className="px-3 py-2 font-semibold">Base</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{rng(ok.base.contribucionPct, (v) => `${v.toFixed(1)}%`)}</td>
                    <td colSpan={5} className="px-3 py-2">Lo que pasaría sin esta pauta: marca construida, orgánico, estacionalidad, precio, trade.</td>
                  </tr>
                </tbody>
              </table>
            </div>
            {ok.excluidos.length > 0 && <p className="px-4 pb-3 pt-1 text-[11px] text-muted-foreground">Fuera del modelo: {ok.excluidos.map((e) => `${e.nombre} (${e.motivo})`).join(" · ")}.</p>}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-sm font-semibold">Curva de respuesta · {fm?.nombre}</h3>
                <select value={fm?.nombre ?? ""} onChange={(e) => setFocus(e.target.value)} className="rounded-md border bg-background px-2 py-1 text-xs">
                  {ok.medios.map((m) => <option key={m.nombre} value={m.nombre}>{m.nombre}</option>)}
                </select>
              </div>
              <ResponsiveContainer width="100%" height={240}>
                <ComposedChart data={curva} margin={{ top: 16, right: 12, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
                  <XAxis dataKey="x" type="number" domain={[0, "dataMax"]} stroke={AXIS} fontSize={10} tickLine={false} axisLine={{ stroke: GRID }} tickFormatter={(v: number) => money(v)} />
                  <YAxis width={56} stroke={AXIS} fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v: number) => fmtK(v)} />
                  <Tooltip formatter={(v, name) => [Array.isArray(v) ? `${fmtK(Number(v[0]))} – ${fmtK(Number(v[1]))}` : fmtK(Number(v)), String(name)]} labelFormatter={(v) => `Inversión mensual ${money(Number(v))}`} />
                  <Area dataKey="banda" name="Rango p10–p90" stroke="none" fill={BANDA} fillOpacity={0.7} type="monotone" />
                  <Line dataKey="p50" name={`Aporte a ${kpi?.label.toLowerCase()} por mes`} stroke={REAL} strokeWidth={2} dot={false} type="monotone" />
                  {fm && <ReferenceDot x={fm.inversionHoy} y={valorEn(fm.inversionHoy)} r={5} fill={SLATE} stroke="#fff" label={{ value: "hoy", position: "top", fontSize: 10, fill: AXIS }} />}
                  {fm && alloc[fm.nombre] != null && <ReferenceDot x={alloc[fm.nombre]} y={valorEn(alloc[fm.nombre] ?? 0)} r={5} fill={REAL} stroke="#fff" label={{ value: "simulado", position: "bottom", fontSize: 10, fill: REAL }} />}
                </ComposedChart>
              </ResponsiveContainer>
              <p className="mt-1 text-[11px] text-muted-foreground">Aporte mensual si se sostiene esa inversión varios meses (incluye el arrastre). La banda se abre donde no hay meses con esa inversión: ahí es extrapolación.</p>
            </div>
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <h3 className="text-sm font-semibold">Mes a mes · base + medios vs real</h3>
              <ResponsiveContainer width="100%" height={240}>
                <ComposedChart data={decomp} margin={{ top: 16, right: 8, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
                  <XAxis dataKey="mes" stroke={AXIS} fontSize={9.5} tickLine={false} axisLine={{ stroke: GRID }} interval="preserveStartEnd" />
                  <YAxis width={56} stroke={AXIS} fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v: number) => fmtK(v)} />
                  <Tooltip formatter={(v, name) => [fmtK(Number(v)), String(name)]} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="Base" stackId="d" fill="#e2e8f0" />
                  {ok.medios.map((m, i) => <Bar key={m.nombre} dataKey={m.nombre} stackId="d" fill={PALETA[i % PALETA.length]} />)}
                  <Line dataKey="Real" stroke="#0f172a" strokeWidth={1.8} dot={{ r: 2 }} type="monotone" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}

      <div className="rounded-xl border bg-muted/40 p-4">
        <h3 className="text-sm font-semibold">Cómo se calcula (y sus límites)</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-relaxed text-muted-foreground">
          <li>Resultado = base + tendencia + Σ medios, donde cada medio pasa por <b>adstock</b> (parte del efecto sigue el mes siguiente) y <b>saturación Hill</b> (rendimientos decrecientes). Misma familia de modelos que Meridian (Google) o Robyn (Meta), en versión liviana.</li>
          <li>Se estima con priors débiles (regresión ridge bayesiana, efectos ≥ 0) y el rango sale de réplicas <b>bootstrap</b> por bloques: con pocos datos o ruidosos el rango se abre — leé el rango, no el punto.</li>
          <li>&ldquo;Por cada $1.000&rdquo; = aporte total ÷ inversión total. &ldquo;Próximos $1.000&rdquo; = cuánto suma un peso más al nivel de hoy (retorno marginal): es el que sirve para decidir.</li>
          <li>Es una asociación estadística condicionada al modelo, no un experimento: sin tests geo o de lift, correlación ≠ causa.</li>
          {ok?.motivosConfianza.map((m) => <li key={m}>{m}.</li>)}
          {[...(ok?.avisos ?? []), ...datos.avisos, ...(prep?.recorte ? [prep.recorte] : [])].map((a) => <li key={a}>{a}</li>)}
        </ul>
      </div>
    </div>
  );
}
