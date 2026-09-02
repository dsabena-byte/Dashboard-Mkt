"use client";

// Matriz de gaps KPI × Categoría + ranking de oportunidades. Toggle Mes / YTD.
// Objetivo: encontrar de un vistazo en qué KPI y categoría estás más lejos de la meta.

import { useState } from "react";
import { semaforoDe, SEMAFORO_COLOR, type Semaforo } from "@/lib/metas";
import { CATEGORIAS_CORE } from "@/lib/categorias";
import type { GapData, GapKpi, GapCell, GapOportunidad, KpiUnit } from "@/lib/objetivos-gaps";

function fmtVal(v: number | null, unit: KpiUnit): string {
  if (v == null) return "—";
  const abs = Math.abs(v);
  if (unit === "$") return abs >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : abs >= 1e3 ? `$${(v / 1e3).toFixed(0)}K` : `$${v.toFixed(0)}`;
  if (unit === "") return abs >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : abs >= 1e3 ? `${(v / 1e3).toFixed(0)}K` : `${v.toFixed(0)}`;
  if (unit === "x") return `${v.toFixed(2)}x`;
  if (unit === "s") return `${v.toFixed(0)}s`;
  return `${v.toFixed(1)}%`;
}
const pct = (v: number | null) => (v == null ? "—" : `${v.toFixed(0)}%`);

function tint(sem: Semaforo): string {
  return { verde: "#16a34a1f", amarillo: "#d977061f", rojo: "#dc26261f", "sin-meta": "#94a3b814" }[sem];
}

type Modo = "mes" | "ytd";

function Cell({ c, k, modo }: { c: GapCell; k: GapKpi; modo: Modo }) {
  const cumpl = modo === "mes" ? c.cumplMes : c.cumplYtd;
  const other = modo === "mes" ? c.cumplYtd : c.cumplMes;
  const real = modo === "mes" ? c.realMes : c.realYtd;
  const meta = modo === "mes" ? c.metaMes : c.metaYtd;
  const sem = semaforoDe(cumpl, k);
  const color = SEMAFORO_COLOR[sem];
  return (
    <td className="px-2 py-1.5 text-center align-middle" style={{ background: tint(sem) }}
      title={`Real ${fmtVal(real, k.unit)} · Meta ${fmtVal(meta, k.unit)} — ${modo === "mes" ? "YTD" : "mes"} ${pct(other)}`}>
      <div className="text-[13px] font-bold tabular-nums" style={{ color }}>{pct(cumpl)}</div>
      <div className="text-[9px] tabular-nums text-muted-foreground/70">{fmtVal(real, k.unit)}<span className="text-muted-foreground/40"> / {fmtVal(meta, k.unit)}</span></div>
    </td>
  );
}

const PLAN_ORDER = ["Pauta Mkt", "Web / Ecommerce", "Instagram", "Cuadros Básicos", "Floor Share"];

export function GapMatrix({ data }: { data: GapData }) {
  const [modo, setModo] = useState<Modo>("mes");
  if (!data.disponible) {
    return <div className="rounded-xl border border-dashed bg-card p-5 text-sm text-muted-foreground">No hay KPIs con meta cargada para calcular gaps.</div>;
  }
  const grupos = PLAN_ORDER.map((plan) => ({ plan, kpis: data.kpis.filter((k) => k.plan === plan) })).filter((g) => g.kpis.length);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold tracking-tight">Gaps por KPI × Categoría</h3>
          <p className="text-[11px] text-muted-foreground">Cumplimiento real vs meta por categoría. Color = semáforo · a {data.refMes} {modo === "mes" ? "(mes)" : "(YTD)"}.</p>
        </div>
        <div className="flex rounded-lg border p-0.5 text-[11px] font-medium">
          {(["mes", "ytd"] as const).map((m) => (
            <button key={m} onClick={() => setModo(m)}
              className={`rounded-md px-2.5 py-1 transition-colors ${modo === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              {m === "mes" ? "Mes" : "YTD"}
            </button>
          ))}
        </div>
      </div>

      {/* Matriz */}
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-[10px] uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2 text-left font-semibold">KPI</th>
              {CATEGORIAS_CORE.map((c) => <th key={c} className="px-2 py-2 text-center font-semibold">{c}</th>)}
              <th className="px-2 py-2 text-center font-semibold text-muted-foreground/60">Total</th>
            </tr>
          </thead>
          <tbody>
            {grupos.map((g) => (
              <GrupoRows key={g.plan} plan={g.plan} kpis={g.kpis} modo={modo} />
            ))}
          </tbody>
        </table>
      </div>

      {/* Ranking de oportunidades */}
      <Oportunidades items={data.oportunidades} />
    </div>
  );
}

function GrupoRows({ plan, kpis, modo }: { plan: string; kpis: GapKpi[]; modo: Modo }) {
  return (
    <>
      <tr className="border-b bg-muted/20">
        <td colSpan={5} className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/80">{plan}</td>
      </tr>
      {kpis.map((k) => {
        const totCumpl = modo === "mes" ? k.cumplMesTotal : k.cumplYtdTotal;
        const totSem = semaforoDe(totCumpl, k);
        return (
          <tr key={k.kpi} className="border-b last:border-0 hover:bg-muted/20">
            <td className="px-3 py-1.5">
              <div className="text-[12px] font-medium">{k.kpi}</div>
              {k.esGeneral && <div className="text-[9px] uppercase tracking-wide text-muted-foreground/50">general · igual a las 3</div>}
            </td>
            {k.celdas.map((c) => <Cell key={c.categoria} c={c} k={k} modo={modo} />)}
            <td className="px-2 py-1.5 text-center align-middle">
              <div className="text-[13px] font-bold tabular-nums" style={{ color: SEMAFORO_COLOR[totSem] }}>{pct(totCumpl)}</div>
            </td>
          </tr>
        );
      })}
    </>
  );
}

function Oportunidades({ items }: { items: GapOportunidad[] }) {
  const top = items.slice(0, 12);
  if (!top.length) {
    return (
      <div className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
        🎉 No hay KPIs por debajo de la meta en el mes de referencia.
      </div>
    );
  }
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="mb-2 flex items-baseline justify-between">
        <h4 className="text-sm font-bold tracking-tight">Top oportunidades de mejora</h4>
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground/60">mayor gap vs meta (mes)</span>
      </div>
      <div className="space-y-1">
        {top.map((o, i) => {
          const color = SEMAFORO_COLOR[o.cumplMes >= 90 ? "amarillo" : "rojo"];
          return (
            <div key={`${o.kpi}-${o.categoria}-${i}`} className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 border-b py-1.5 text-[12px] last:border-0">
              <span className="w-4 text-right text-[10px] font-semibold text-muted-foreground/50 tabular-nums">{i + 1}</span>
              <span className="truncate">
                <span className="font-medium">{o.kpi}</span>
                <span className="text-muted-foreground"> · {o.categoria}</span>
                <span className="ml-1 text-[10px] text-muted-foreground/50">({o.plan})</span>
              </span>
              <span className="text-right text-[11px] tabular-nums text-muted-foreground/70">
                {fmtVal(o.realMes, o.unit)}<span className="text-muted-foreground/40"> / {fmtVal(o.metaMes, o.unit)}</span>
              </span>
              <span className="flex w-24 items-center justify-end gap-2">
                <span className="text-[11px] font-semibold tabular-nums" style={{ color }}>{o.cumplMes.toFixed(0)}%</span>
                <span className="text-[10px] font-semibold tabular-nums" style={{ color }}>▼{Math.abs(o.gapPct).toFixed(0)}%</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
