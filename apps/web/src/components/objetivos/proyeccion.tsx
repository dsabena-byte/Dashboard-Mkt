// Piezas chicas del pace-to-goal (portado de BIP, sep-2026). Sin "use client" ni hooks: sirven en
// server y client components. El valor proyectado va en tinta. Sin probabilidad de llegar a la meta
// (pedido del user, 20-nov-2026).
import type { PronosticoMeta } from "@/lib/stats/meta";
import type { KpiUnit } from "@/lib/objetivos-kpis";

export function fmtKpi(v: number | null | undefined, u: KpiUnit | string): string {
  if (v == null || !Number.isFinite(v)) return "—";
  if (u === "%") return `${v.toFixed(2)}%`;
  if (u === "s") return `${Math.round(v)}s`;
  if (u === "x") return `${v.toFixed(1)}×`;
  if (u === "pts") return v.toFixed(1);
  const a = Math.abs(v);
  const s = a >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : a >= 1e3 ? `${(v / 1e3).toFixed(0)}K` : String(Math.round(v));
  return u === "$" ? `$${s}` : s;
}

const tituloMetodo = (pr: PronosticoMeta) =>
  `Método: ${pr.metodoTexto} · ${pr.n} meses con dato${pr.cvError != null ? ` · error típico ${Math.round(pr.cvError * 100)}%` : ""}${pr.motivo ? ` · ${pr.motivo}` : ""}. 2.000 simulaciones del resto del año con la variabilidad histórica del KPI.`;

/** Celda del scorecard: cierre proyectado (mediana), rango p10–p90 y probabilidad de llegar a la meta anual. */
export function ProyeccionKpi({ pr, unit }: { pr?: PronosticoMeta; unit: KpiUnit }) {
  if (!pr || !pr.cierre) return <span className="text-muted-foreground/60">—</span>;
  const c = pr.cierre;
  return (
    <div title={tituloMetodo(pr)} className="flex flex-col items-end gap-0.5">
      <span className="font-semibold tabular-nums text-foreground">{pr.suficiente || pr.cerrado ? "" : "≈ "}{fmtKpi(c.p50, unit)}</span>
      {c.p10 != null && c.p90 != null && !pr.cerrado && <span className="text-[10.5px] tabular-nums text-muted-foreground">{fmtKpi(c.p10, unit)}–{fmtKpi(c.p90, unit)}</span>}
      {!pr.suficiente && !pr.cerrado && <span className="whitespace-nowrap text-[10.5px] text-muted-foreground/70">dato insuficiente</span>}
    </div>
  );
}

