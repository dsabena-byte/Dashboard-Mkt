"use client";
import { useMemo, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { evaluarPautaDiaria, serieGrafico, addDias, fARS, fFecha, CFG_DIARIA, type EstadoGasto, type EstadoMedio, type PautaDiariaData } from "@/lib/pauta-diaria";
import { LearnButton } from "@/components/knowledge/learn-button";
import { GuiameButton } from "@/components/copiloto/guiame-button";

// Inversión DIARIA por medio (medios con API) — tab Eficiencia Medios de /performance.
// Gasto real por día de Meta / Google Search / Demand Gen (azules), con los días PICO marcados en rojo
// (el rojo es solo estado). DV360 (YouTube / Programmatic) solo informa por mes → va en la tabla con su
// dato mensual, sin inventar días. Detección pura en lib/pauta-diaria (misma que la señal
// `gasto_diario_anomalo` del Diagnóstico y de /alerts).

const COLORES: Record<string, string> = { Meta: "#1e40af", "Google Search": "#3b82f6", "Demand Gen": "#93c5fd" };
const ESTADO: Record<EstadoGasto, { label: string; color: string; bg: string }> = {
  urgente: { label: "Urgente", color: "#b91c1c", bg: "rgba(220,38,38,.08)" },
  revisar: { label: "Revisar", color: "#b45309", bg: "rgba(217,119,6,.10)" },
  ok: { label: "Normal", color: "#15803d", bg: "rgba(22,163,74,.10)" },
  sin_dato: { label: "Sin dato", color: "#475569", bg: "rgba(100,116,139,.10)" },
};
const RANGOS = [
  { k: "mes", label: "Mes en curso" },
  { k: "30", label: "30 días" },
  { k: "60", label: "60 días" },
  { k: "90", label: "90 días" },
] as const;
type Rango = (typeof RANGOS)[number]["k"];
const pct = (v: number | null) => (v == null ? "—" : `${Math.round(v)}%`);
const money = (v: number | null) => (v == null ? "—" : fARS(v));

function Pastilla({ e }: { e: EstadoGasto }) {
  const s = ESTADO[e];
  return <span className="inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ color: s.color, background: s.bg }}>{s.label}</span>;
}

export function InversionDiariaSection({ d }: { d: PautaDiariaData }) {
  const [rango, setRango] = useState<Rango>("mes");
  const res = useMemo(() => evaluarPautaDiaria({ series: d.series, campanias: d.campanias, hoy: d.hoy, plan: d.plan }), [d]);
  const diarias = d.series.filter((s) => s.fuente === "diaria");
  const ultimo = diarias.flatMap((s) => Object.keys(s.dias)).filter((f) => f <= d.hoy).sort().pop() ?? d.hoy;
  const desde = rango === "mes" ? `${d.hoy.slice(0, 7)}-01` : addDias(ultimo, -(Number(rango) - 1));
  const filas = useMemo(() => serieGrafico(d.series, desde, ultimo), [d.series, desde, ultimo]);
  const picosSet = useMemo(() => new Set(res.picos.map((p) => `${p.medio}|${p.fecha}`)), [res.picos]);
  const picosVentana = res.picos.filter((p) => p.fecha >= desde && p.fecha <= ultimo);
  const alertas = res.medios.filter((m) => m.estado === "urgente" || m.estado === "revisar");
  const conc = res.concentracion.filter((c) => c.estado !== "ok").sort((a, b) => b.mes.localeCompare(a.mes));
  const notas = [...new Set(d.series.map((s) => s.nota).filter(Boolean))] as string[];

  const guia = (m: EstadoMedio) => ({
    titulo: `${m.medio}: gasto fuera de lo normal (${ESTADO[m.estado].label.toLowerCase()})`,
    dash: "performance",
    tipo: "alerta",
    dato: m.motivos.join(" "),
    queHacer: ["Revisar con la agencia el presupuesto diario y las fechas de las campañas de ese medio", "Si no estaba planeado, bajar el tope diario o pausar hasta corregir"],
  });

  return (
    <section className="mb-6 rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold">Inversión diaria por medio (medios con API) <LearnButton k="gasto_diario" /></h3>
        <div className="flex gap-1">
          {RANGOS.map((r) => (
            <button key={r.k} type="button" onClick={() => setRango(r.k)}
              className={`rounded-md border px-2 py-0.5 text-[11.5px] ${rango === r.k ? "border-[#1e40af] bg-blue-50 font-semibold text-[#1e40af]" : "text-muted-foreground hover:text-foreground"}`}>
              {r.label}
            </button>
          ))}
        </div>
      </div>
      <p className="mb-3 mt-1 text-[11px] text-muted-foreground">
        Gasto real por día, tal cual lo informa cada plataforma ($ corrientes, no responde a los filtros ni al selector de moneda). Sirve para
        detectar una pauta mal configurada que se gasta el presupuesto del mes en pocos días. Un punto <b style={{ color: "#b91c1c" }}>rojo</b> marca un
        día que gastó más de {CFG_DIARIA.factorPico} veces lo de un día normal de ese medio (mediana de los 14 días anteriores con gasto).
        {d.google.desde && <> Google Ads por día desde el {fFecha(d.google.desde)}.</>}
        {d.meta.diaria && d.meta.desde && <> Meta por día desde el {fFecha(d.meta.desde)}.</>}
      </p>

      {alertas.length > 0 && (
        <div className="mb-3 space-y-1.5 rounded-md border px-3 py-2" style={{ borderColor: alertas.some((a) => a.estado === "urgente") ? "#fecaca" : "#fde68a" }}>
          {alertas.map((m) => (
            <div key={m.medio} className="flex flex-wrap items-start gap-2 text-xs">
              <Pastilla e={m.estado} />
              <span className="font-semibold">{m.medio}:</span>
              <span className="min-w-0 flex-1">{m.motivos.join(" ")}</span>
              <GuiameButton item={guia(m)} />
            </div>
          ))}
        </div>
      )}

      {diarias.length > 0 ? (
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={filas} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="fecha" tickFormatter={(f: string) => fFecha(f)} tick={{ fontSize: 10, fill: "#64748b" }} minTickGap={18} />
              <YAxis width={56} tickFormatter={(v: number) => fARS(v)} tick={{ fontSize: 10, fill: "#64748b" }} />
              <Tooltip
                labelFormatter={(f) => fFecha(String(f))}
                formatter={(v, name) => [fARS(Number(v)), String(name)]}
                contentStyle={{ fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {diarias.map((s) => (
                <Line key={s.medio} type="monotone" dataKey={s.medio} stroke={COLORES[s.medio] ?? "#64748b"} strokeWidth={2} isAnimationActive={false}
                  dot={(p: { cx?: number; cy?: number; payload?: { fecha?: string }; index?: number }) => {
                    const pico = p.payload?.fecha && picosSet.has(`${s.medio}|${p.payload.fecha}`);
                    return pico && p.cx != null && p.cy != null
                      ? <circle key={`${s.medio}-${p.index}`} cx={p.cx} cy={p.cy} r={4.5} fill="#dc2626" stroke="#fff" strokeWidth={1.5} />
                      : <g key={`${s.medio}-${p.index}`} />;
                  }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Todavía no hay gasto diario de ningún medio.</p>
      )}
      {picosVentana.length > 0 && (
        <p className="mt-1 text-[11px] text-muted-foreground">
          Días pico en el período: {picosVentana.slice(0, 8).map((p) => `${p.medio} ${fFecha(p.fecha)} (${fARS(p.gasto)}, ${p.veces.toFixed(1).replace(".", ",")}×)`).join(" · ")}
          {picosVentana.length > 8 ? ` · y ${picosVentana.length - 8} más` : ""}
        </p>
      )}
      {notas.map((n) => <p key={n} className="mt-1 text-[11px] text-muted-foreground">ⓘ {n}</p>)}

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[860px] text-xs">
          <thead className="border-b bg-muted/40">
            <tr className="text-left text-[10px] uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2">Medio</th>
              <th className="px-3 py-2 text-right">Último día</th>
              <th className="px-3 py-2 text-right">Día anterior</th>
              <th className="px-3 py-2 text-right">Promedio diario 14 d</th>
              <th className="px-3 py-2 text-right">Gastado en el mes</th>
              <th className="px-3 py-2 text-right">% de un mes normal</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2">Qué pasa</th>
            </tr>
          </thead>
          <tbody>
            {res.medios.map((m) => (
              <tr key={m.medio} className="border-b align-top last:border-0">
                <td className="px-3 py-2 font-medium">
                  {m.medio}
                  <div className="text-[10px] font-normal text-muted-foreground">{m.fuente === "diaria" ? "dato diario" : "solo dato mensual"}</div>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{m.fuente === "diaria" ? <>{money(m.gastoUltimo)}<div className="text-[10px] text-muted-foreground">{m.ultimoDia ? fFecha(m.ultimoDia) : ""}</div></> : "—"}</td>
                <td className="px-3 py-2 text-right tabular-nums">{m.fuente === "diaria" ? money(m.gastoPrevio) : "—"}</td>
                <td className="px-3 py-2 text-right tabular-nums">{m.fuente === "diaria" ? money(m.prom14) : "—"}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {money(m.acumMes)}
                  <div className="text-[10px] text-muted-foreground">{m.diaDelMes > 0 ? `al día ${m.diaDelMes} de ${m.diasMes}` : ""}</div>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {pct(m.pctRef)}
                  <div className="text-[10px] text-muted-foreground">{m.referenciaMes != null ? `mes normal ${fARS(m.referenciaMes)} · esperable hoy ${m.esperado != null && m.referenciaMes ? `${Math.round((m.esperado / m.referenciaMes) * 100)}%` : "—"}` : "sin meses previos"}</div>
                </td>
                <td className="px-3 py-2"><Pastilla e={m.estado} /></td>
                <td className="px-3 py-2 text-[11.5px]">
                  {m.motivos.length ? m.motivos.join(" ") : m.estado === "sin_dato" ? "Sin gasto registrado." : "Gasta a su ritmo normal."}
                  {(m.estado === "urgente" || m.estado === "revisar") && <div className="mt-1"><GuiameButton item={guia(m)} /></div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[10.5px] text-muted-foreground">
        Mes normal = mediana de los últimos 3 meses cerrados con gasto de ese medio{Object.keys(d.plan).length ? ", llevados a la escala del plan de Inversión del mes (meta de Pauta Mkt: un mes con el doble de plan admite el doble de gasto)" : ""}. Esperable hoy = mes normal × días transcurridos ÷ días del mes.
        <b> Urgente</b>: en {CFG_DIARIA.rapidoDias} días o menos se gastó ≥{CFG_DIARIA.rapidoPct}% de un mes normal (al arrancar el mes o en los últimos {CFG_DIARIA.rapidoDias} días),
        o en los primeros {CFG_DIARIA.diasTempranos} días se gasta ≥{CFG_DIARIA.ritmoUrgente} veces más rápido de lo esperable, o un solo día gastó ≥{CFG_DIARIA.picoUrgentePct}% de un mes normal.
        <b> Revisar</b>: va ≥{CFG_DIARIA.ritmoRevisar} veces más rápido de lo esperable, o hubo un día pico en los últimos {CFG_DIARIA.recientes} días.
      </p>

      {conc.length > 0 && (
        <div className="mt-4">
          <h4 className="mb-1 text-xs font-semibold">Campañas que se gastaron en pocos días (Meta, dato mensual por campaña)</h4>
          <p className="mb-2 text-[11px] text-muted-foreground">
            Meses en que campañas activas {CFG_DIARIA.rapidoDias} días o menos se llevaron una parte grande del gasto del mes (días activos = días con impresiones, que informa Meta).
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-xs">
              <thead className="border-b bg-muted/40">
                <tr className="text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2">Mes</th><th className="px-3 py-2 text-right">Gasto del mes</th><th className="px-3 py-2 text-right">En campañas cortas</th>
                  <th className="px-3 py-2 text-right">%</th><th className="px-3 py-2">Campañas</th><th className="px-3 py-2">Estado</th>
                </tr>
              </thead>
              <tbody>
                {conc.map((c) => (
                  <tr key={`${c.medio}-${c.mes}`} className="border-b align-top last:border-0">
                    <td className="px-3 py-2 font-medium">{c.mes}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fARS(c.totalMes)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fARS(c.gastoRapido)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{Math.round(c.pct)}%</td>
                    <td className="px-3 py-2 text-[11px]">{c.campanias.slice(0, 5).map((x) => `${x.campania} (${fARS(x.gasto)}, ${x.dias} ${x.dias === 1 ? "día" : "días"})`).join(" · ")}</td>
                    <td className="px-3 py-2"><Pastilla e={c.estado} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
