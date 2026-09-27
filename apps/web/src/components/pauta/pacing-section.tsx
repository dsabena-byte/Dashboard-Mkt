"use client";
import type { PacingMes } from "@/lib/pauta-pacing";

// Ritmo de inversión del mes en curso (pacing) — tab Impacto Campaña de /performance.
// Barra: gastado (azul #1e40af) + rango esperado a cierre (azul claro: piso → techo) vs plan del mes
// (línea tinta) y "esperado a hoy" (marca gris pizarra). Semáforo SOLO en la pastilla de estado.

const ESTADO: Record<PacingMes["estado"], { label: string; color: string; bg: string }> = {
  en_linea: { label: "En línea con el plan", color: "#15803d", bg: "rgba(22,163,74,.10)" },
  sobre: { label: "Por encima del plan", color: "#b91c1c", bg: "rgba(220,38,38,.08)" },
  sub: { label: "Por debajo del plan", color: "#b45309", bg: "rgba(217,119,6,.10)" },
  sin_plan: { label: "Sin meta cargada", color: "#475569", bg: "rgba(100,116,139,.10)" },
};
const TIPO: Record<string, string> = { api: "API · se proyecta", manual: "OMD · cargado", pendiente: "OMD · falta cargar" };
const money = (v: number) => `$${(Math.abs(v) >= 1e6 ? `${(v / 1e6).toLocaleString("es-AR", { maximumFractionDigits: 1 })}M` : Math.round(v).toLocaleString("es-AR"))}`;
const dPct = (v: number | null) => (v == null ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(0)}%`);

export function PacingSection({ p }: { p: PacingMes }) {
  const e = ESTADO[p.estado];
  const tope = Math.max(p.plan ?? 0, p.rango.techo, p.gastado, p.bgt?.valor ?? 0, p.referencia ?? 0) * 1.04 || 1;
  const x = (v: number) => `${Math.min(100, (v / tope) * 100)}%`;
  const dias = p.diasTranscurridos.toLocaleString("es-AR", { maximumFractionDigits: 1 });
  const baseLbl = p.base === "plan" ? "vs plan" : p.base === "historico" ? "vs promedio 3 meses" : "";
  const Kpi = ({ label, value, sub }: { label: string; value: string; sub?: string }) => (
    <div className="min-w-[140px]">
      <div className="text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold tabular-nums" style={{ color: "#0f172a" }}>{value}</div>
      {sub && <div className="text-[11.5px] text-muted-foreground">{sub}</div>}
    </div>
  );
  return (
    <section className="rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">Ritmo de inversión · {p.mes} {p.anio}</h3>
        <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ color: p.preliminar ? "#475569" : e.color, background: p.preliminar ? "rgba(100,116,139,.10)" : e.bg }}>
          {p.preliminar ? "Preliminar (menos de 5 días)" : p.estado === "sin_plan" || p.base === "plan" ? e.label : `${e.label.replace("del plan", "del promedio")}`}
        </span>
      </div>
      <p className="mb-3 mt-1 text-[11px] text-muted-foreground">
        Día {dias} de {p.diasMes} (hora de la última sync de Meta). Mismo modelo por medio que el Tablero: Meta, DV360, Google Ads y Ecommerce
        se <b>proyectan lineal</b> a cierre; lo que OMD ya cargó (OOH…) se toma como está; los medios sin API que OMD todavía no cargó entran al
        <b> rango</b> con su promedio (central) y su máximo (techo) de los últimos 3 meses. Performance Max fuera. Tolerancia ±{p.tolerancia}%.
      </p>

      <div className="mb-3 flex flex-wrap gap-6">
        <Kpi label="Invertido a la fecha" value={money(p.gastado)} sub={p.avancePct != null ? `${p.avancePct.toFixed(0)}% del plan del mes` : undefined} />
        <Kpi label="Plan del mes (meta)" value={p.plan != null ? money(p.plan) : "—"} sub={p.planALaFecha != null ? `esperado a hoy ${money(p.planALaFecha)}` : "cargá la meta de Inversión abajo"} />
        <Kpi label="Proyección a cierre" value={money(p.rango.central)} sub={`rango ${money(p.rango.piso)} – ${money(p.rango.techo)} · ${dPct(p.desvioPct)} ${baseLbl}`} />
        {p.bgt && <Kpi label={`Presupuesto ${p.bgt.version}`} value={money(p.bgt.valor)} sub="cuenta Publicidad TV · Pauta ATL (referencia)" />}
        {p.base !== "plan" && p.referencia != null && <Kpi label="Promedio 3 meses" value={money(p.referencia)} sub="meses cerrados" />}
      </div>

      <div className="relative h-6 overflow-hidden rounded-md" style={{ background: "#f1f5f9" }} aria-label="Invertido y rango esperado vs plan del mes">
        <div className="absolute inset-y-0" style={{ left: x(p.rango.piso), width: `calc(${x(p.rango.techo)} - ${x(p.rango.piso)})`, background: "#dbeafe" }} title={`Rango esperado ${money(p.rango.piso)} – ${money(p.rango.techo)}`} />
        <div className="absolute inset-y-0 left-0" style={{ width: x(p.rango.piso), background: "#93c5fd" }} title={`Proyección con lo cargado ${money(p.rango.piso)}`} />
        <div className="absolute inset-y-0 left-0" style={{ width: x(p.gastado), background: "#1e40af" }} title={`Invertido ${money(p.gastado)}`} />
        <div className="absolute inset-y-1" style={{ left: x(p.rango.central), width: 2, background: "#1e3a8a" }} title={`Central ${money(p.rango.central)}`} />
        {p.planALaFecha != null && <div className="absolute inset-y-1" style={{ left: x(p.planALaFecha), width: 2, background: "#64748b" }} title={`Esperado a hoy ${money(p.planALaFecha)}`} />}
        {p.plan != null && <div className="absolute inset-y-0" style={{ left: x(p.plan), width: 2, background: "#0f172a" }} title={`Plan del mes ${money(p.plan)}`} />}
        {p.bgt && <div className="absolute inset-y-0" style={{ left: x(p.bgt.valor), width: 0, borderLeft: "2px dashed #94a3b8" }} title={`${p.bgt.version} ${money(p.bgt.valor)}`} />}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <span><i className="mr-1 inline-block h-2 w-2 rounded-sm align-middle" style={{ background: "#1e40af" }} />Invertido</span>
        <span><i className="mr-1 inline-block h-2 w-2 rounded-sm align-middle" style={{ background: "#93c5fd" }} />Proyección con lo cargado (piso)</span>
        <span><i className="mr-1 inline-block h-2 w-2 rounded-sm align-middle" style={{ background: "#dbeafe" }} />Rango hasta el techo</span>
        {p.plan != null && <span><i className="mr-1 inline-block h-2.5 w-0.5 align-middle" style={{ background: "#0f172a" }} />Plan del mes</span>}
        {p.planALaFecha != null && <span><i className="mr-1 inline-block h-2.5 w-0.5 align-middle" style={{ background: "#64748b" }} />Esperado a hoy</span>}
        {p.bgt && <span><i className="mr-1 inline-block h-2.5 align-middle" style={{ borderLeft: "2px dashed #94a3b8" }} />{p.bgt.version}</span>}
      </div>

      {p.porMedio.length > 0 && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[560px] text-xs">
            <thead className="border-b bg-muted/40">
              <tr className="text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2">Medio</th><th className="px-3 py-2">Fuente</th>
                <th className="px-3 py-2 text-right">Invertido</th><th className="px-3 py-2 text-right">A cierre</th>
                <th className="px-3 py-2 text-right">Promedio 3 meses</th><th className="px-3 py-2 text-right">vs promedio</th>
              </tr>
            </thead>
            <tbody>
              {p.porMedio.map((m) => (
                <tr key={m.medio} className="border-b last:border-0">
                  <td className="px-3 py-1.5 font-medium">{m.medio}</td>
                  <td className="px-3 py-1.5 text-muted-foreground">{TIPO[m.tipo]}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{m.tipo === "pendiente" ? "—" : money(m.gastado)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{m.tipo === "pendiente" ? `${money(m.proyeccion)} – ${money(m.maximo ?? m.proyeccion)}` : money(m.proyeccion)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">{m.referencia != null ? money(m.referencia) : "—"}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{dPct(m.desvioPct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1.5 text-[10px] text-muted-foreground">
            La meta de Inversión es del total del mes; por medio se compara contra su propio promedio de los últimos 3 meses cerrados (0 en los meses sin inversión).
            {p.pendientes.length > 0 && <> Los medios &ldquo;falta cargar&rdquo; llegan con el reporte mensual de OMD: hasta entonces el ritmo total es un rango, no un número.</>}
          </p>
        </div>
      )}
    </section>
  );
}
