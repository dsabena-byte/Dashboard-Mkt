// Piezas chicas del pace-to-goal (portado de BIP, sep-2026). Sin "use client" ni hooks: sirven en
// server y client components. Paleta sobria: el valor proyectado va en tinta; el semáforo SOLO marca
// el ESTADO de la probabilidad (≥70% probable · 30-70% en riesgo · <30% improbable).
import { SEMAFORO_COLOR, type Semaforo } from "@/lib/metas";
import type { PronosticoMeta } from "@/lib/stats/meta";
import type { ProyeccionAgregada, PorQue } from "@/lib/objetivos-pronostico";
import type { KpiUnit } from "@/lib/objetivos-kpis";

const SEM_BG: Record<Semaforo, string> = {
  verde: "rgba(22,163,74,.12)",
  amarillo: "rgba(217,119,6,.14)",
  rojo: "rgba(220,38,38,.12)",
  "sin-meta": "rgba(100,116,139,.12)",
};
const MES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

const semProb = (p: number): Semaforo => (p >= 0.7 ? "verde" : p >= 0.3 ? "amarillo" : "rojo");
const lectura = (p: number) => (p >= 0.7 ? "probable" : p >= 0.3 ? "en riesgo" : "improbable");

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

export function ProbChip({ p, title }: { p: number; title?: string }) {
  const sem = semProb(p);
  return (
    <span title={title} className="inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-px text-[11px] font-semibold tabular-nums" style={{ color: SEMAFORO_COLOR[sem], background: SEM_BG[sem] }}>
      {Math.round(p * 100)}% · {lectura(p)}
    </span>
  );
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
      {pr.probabilidad != null ? <ProbChip p={pr.probabilidad} title="Probabilidad de llegar a la meta anual" /> : <span className="whitespace-nowrap text-[10.5px] text-muted-foreground/70">dato insuficiente</span>}
    </div>
  );
}

/** Línea para las cards de objetivo y la Salud de Marca. */
export function ProyeccionObjetivo({ pr }: { pr?: ProyeccionAgregada }) {
  if (!pr) return null;
  const pc = (v: number | null) => (v == null ? "—" : `${Math.round(v)}%`);
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
      {pr.suficiente ? (
        <>
          <span>Cierre proyectado <b className="tabular-nums text-foreground">{pc(pr.p50)}</b> <span className="text-muted-foreground/70">({pc(pr.p10)}–{pc(pr.p90)})</span></span>
          {pr.probabilidad != null && <span className="inline-flex items-center gap-1">· llegar al 100% <ProbChip p={pr.probabilidad} /></span>}
        </>
      ) : (
        <span title={pr.motivo ?? undefined} className="text-muted-foreground/70">Cierre proyectado: dato insuficiente</span>
      )}
    </div>
  );
}

/** "Por qué se movió" (volumen × tasa) bajo el nombre del KPI en el scorecard. */
export function PorQueLinea({ pq }: { pq?: PorQue | null }) {
  if (!pq) return null;
  const s = (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(0)}`;
  return (
    <span className="block text-[10.5px] text-muted-foreground" title="Descomposición exacta de la variación (Shapley de 2 factores): los puntos suman la variación total.">
      {MES[pq.mesDespues]} vs {MES[pq.mesAntes]}: {s(pq.variacionPct)}% = {s(pq.ptsVolumen)} pts {pq.volumen} {s(pq.ptsTasa)} pts {pq.tasa}
    </span>
  );
}
