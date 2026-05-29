"use client";

import { useMemo, useState } from "react";
import {
  type PautaRow,
  PAUTA_CATEGORIAS,
  PAUTA_INSIGHTS,
  MEDIO_COLORS,
  computeFunnel,
  computeByMedio,
  reachByMedio,
  investmentByCategoria,
  extractMeses,
  defaultMes,
} from "@/lib/pauta-data";
import { InvestmentDonut, HBarChart } from "@/components/pauta/pauta-charts";
import { KpiCard } from "@/components/kpi-card";
import { formatCurrency, formatNumber } from "@/lib/utils";

function fmtNum(n: number): string {
  return formatNumber(Math.round(n));
}
function fmtARS(n: number): string {
  return formatCurrency(n);
}
const fmtMoney = fmtARS;

const TABS = ["Overview", "Por Medio"] as const;
type Tab = (typeof TABS)[number];

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string; accent?: string }) {
  return <KpiCard title={label} value={value} hint={sub} />;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 mt-6 text-sm font-medium text-muted-foreground">{children}</div>
  );
}

const INSIGHT_STYLES: Record<string, string> = {
  good: "border-emerald-500 bg-emerald-50",
  warn: "border-amber-500 bg-amber-50",
  alert: "border-rose-500 bg-rose-50",
  info: "border-blue-500 bg-blue-50",
};

function Insight({ type, title, text }: { type: "good" | "warn" | "alert" | "info"; title: string; text: string }) {
  return (
    <div className={`rounded-lg border-l-4 p-3 text-xs leading-relaxed ${INSIGHT_STYLES[type]}`}>
      <div className="mb-1 font-semibold text-foreground">{title}</div>
      <div className="text-foreground/80">{text}</div>
    </div>
  );
}

export function PerformanceClient({ data }: { data: PautaRow[] }) {
  const meses = useMemo(() => extractMeses(data), [data]);
  const [cat, setCat] = useState("Todas");
  const [mes, setMes] = useState(defaultMes(meses));
  const [tab, setTab] = useState<Tab>("Overview");

  const rows = useMemo(
    () =>
      data.filter((r) => r.mes === mes && (cat === "Todas" || r.categoria === cat)),
    [data, cat, mes],
  );
  const upper = useMemo(() => computeFunnel(rows, "upper"), [rows]);
  const mid = useMemo(() => computeFunnel(rows, "mid"), [rows]);
  const byMedio = useMemo(() => computeByMedio(rows), [rows]);
  const reach = useMemo(() => reachByMedio(rows), [rows]);

  // Inversión total: cada línea UNA vez (no upper+mid, porque Build&Consider está en ambas)
  const totalInv = useMemo(() => rows.reduce((s, r) => s + (r.inversion ?? 0), 0), [rows]);
  const totalInvPlan = useMemo(() => rows.reduce((s, r) => s + (r.inversion_plan ?? 0), 0), [rows]);
  // Inversión por etapa SIN doble conteo: video (Build & Consider) se asigna a Upper.
  const upperInv = useMemo(() => rows.filter((r) => r.objetivo !== "Consider").reduce((s, r) => s + (r.inversion ?? 0), 0), [rows]);
  const midInv = totalInv - upperInv;
  // Alcance máximo de una sola plataforma (proxy honesto; sumar duplica personas)
  const maxReach = useMemo(() => Math.max(0, ...rows.map((r) => r.alcance ?? 0)), [rows]);
  const sumReach = upper.alcance;
  const totalViews = useMemo(() => rows.reduce((s, r) => s + (r.views ?? 0), 0), [rows]);
  const insight = cat !== "Todas" ? PAUTA_INSIGHTS[cat] : null;

  const donutData = byMedio.map((m) => ({ name: m.medio, value: m.inversion, color: MEDIO_COLORS[m.medio] ?? "#94a3b8" }));
  const catDonutData = useMemo(() => investmentByCategoria(rows), [rows]);
  const reachData = reach.map((r) => ({ name: r.medio, value: r.alcance }));
  // Funnel stages (proporcionales para el ancho visual)
  const funnelStages = [
    { label: "Impresiones", value: upper.impresiones, w: 100, bg: "#0a1849" },
    { label: "Alcance (suma medios)", value: sumReach, w: 82, bg: "#142b6f" },
    { label: "Video Views", value: totalViews, w: 64, bg: "#1e3a8a" },
    { label: "Clicks", value: mid.clics, w: 46, bg: "#2b4dff" },
  ];

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Performance Pauta</h2>
          <p className="text-sm text-muted-foreground">
            Resultados ejecutados (Digital ON + TV + OOH) · Fuente: OMD
          </p>
        </div>
        <div className="flex items-end gap-4">
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Mes</label>
            <select
              value={mes}
              onChange={(e) => setMes(e.target.value)}
              className="mt-1 rounded-md border bg-card px-3 py-1.5 text-sm font-medium"
            >
              {meses.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            Ejecutado / Planificado
            <div className="text-lg font-semibold text-foreground">
              {fmtARS(totalInv)} <span className="text-muted-foreground">/ {fmtARS(totalInvPlan)}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Filtro categoría */}
      <div className="flex flex-wrap gap-2">
        {PAUTA_CATEGORIAS.map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              cat === c ? "bg-foreground text-background" : "text-muted-foreground hover:bg-secondary"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === t ? "border-amber-500 text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ===== OVERVIEW ===== */}
      {tab === "Overview" && (
        <div>
          <SectionTitle>KPIs globales de campaña</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Kpi label="Inversión ejecutada" value={fmtARS(totalInv)} sub={`Plan: ${fmtARS(totalInvPlan)}`} accent="#e63946" />
            <Kpi label="Alcance" value={fmtNum(sumReach)} sub={`Suma medios · máx 1: ${fmtNum(maxReach)}`} accent="#e63946" />
            <Kpi label="Impresiones" value={fmtNum(upper.impresiones)} sub="Total período" accent="#e63946" />
            <Kpi label="Clicks" value={fmtNum(mid.clics)} sub="Mid funnel" accent="#e63946" />
            <Kpi label="Video Views" value={fmtNum(totalViews)} sub="CPV" accent="#e63946" />
            <Kpi label="CTR" value={`${mid.ctr.toFixed(2)}%`} sub="Mid funnel" accent="#e63946" />
          </div>

          <SectionTitle>Desempeño por etapa del funnel</SectionTitle>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border bg-card p-4" style={{ borderTopWidth: 4, borderTopColor: "#2b4dff" }}>
              <h3 className="mb-3 text-sm font-bold">🎯 Upper Funnel — Awareness</h3>
              <div className="grid grid-cols-2 gap-2">
                <Kpi label="Alcance (suma)" value={fmtNum(sumReach)} accent="#2b4dff" />
                <Kpi label="Impresiones" value={fmtNum(upper.impresiones)} accent="#2b4dff" />
                <Kpi label="Frecuencia" value={upper.frecuenciaPond.toFixed(2)} accent="#2b4dff" />
                <Kpi label="CPM prom." value={fmtMoney(upper.cpm)} accent="#2b4dff" />
              </div>
              <p className="mt-3 text-xs text-muted-foreground">Inversión Upper: <strong className="text-foreground">{fmtARS(upperInv)}</strong> <span className="text-muted-foreground/70">(incluye video)</span></p>
            </div>
            <div className="rounded-xl border bg-card p-4" style={{ borderTopWidth: 4, borderTopColor: "#c9a227" }}>
              <h3 className="mb-3 text-sm font-bold">🔥 Mid Funnel — Consideración</h3>
              <div className="grid grid-cols-2 gap-2">
                <Kpi label="Clicks" value={fmtNum(mid.clics)} accent="#c9a227" />
                <Kpi label="Video Views" value={fmtNum(totalViews)} accent="#c9a227" />
                <Kpi label="CTR" value={`${mid.ctr.toFixed(2)}%`} accent="#c9a227" />
                <Kpi label="CPC" value={fmtMoney(mid.cpc)} accent="#c9a227" />
              </div>
              <p className="mt-3 text-xs text-muted-foreground">Inversión Mid: <strong className="text-foreground">{fmtARS(midInv)}</strong> <span className="text-muted-foreground/70">(solo CPC)</span></p>
            </div>
          </div>

          <SectionTitle>Distribución de inversión por plataforma</SectionTitle>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border bg-card p-4">
              <h3 className="mb-2 text-sm font-bold">Inversión ejecutada por medio</h3>
              <InvestmentDonut data={donutData} />
            </div>
            <div className="rounded-xl border bg-card p-4">
              <h3 className="mb-2 text-sm font-bold">Inversión por categoría</h3>
              <InvestmentDonut data={catDonutData} />
            </div>
          </div>

          <SectionTitle>Embudo de conversión del período</SectionTitle>
          <div className="rounded-xl border bg-card p-6">
            <div className="flex flex-col items-center gap-1.5">
              {funnelStages.map((s) => (
                <div
                  key={s.label}
                  className="flex items-center justify-between rounded-lg px-6 py-3.5 text-white"
                  style={{ width: `${s.w}%`, backgroundColor: s.bg }}
                >
                  <span className="text-[11px] font-medium uppercase tracking-wide opacity-90">{s.label}</span>
                  <span className="text-xl font-bold">{fmtNum(s.value)}</span>
                </div>
              ))}
            </div>
          </div>

          <SectionTitle>Aporte de cada medio al funnel</SectionTitle>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border bg-card p-4">
              <h3 className="text-sm font-bold">Upper Funnel — Alcance por plataforma</h3>
              <p className="mb-2 text-[10px] text-muted-foreground">Alcance sumado por plataforma — incluye solapamiento entre medios (la misma persona puede estar en varios).</p>
              <HBarChart data={reachData} color="#2b4dff" />
            </div>
            <div className="rounded-xl border bg-card p-4">
              <h3 className="mb-2 text-sm font-bold">Mid Funnel — Clicks por plataforma</h3>
              <HBarChart
                data={byMedio.filter((m) => m.clics > 0).map((m) => ({ name: m.medio, value: m.clics })).sort((a, b) => b.value - a.value)}
                color="#c9a227"
              />
            </div>
          </div>

          {insight && (
            <>
              <SectionTitle>Highlights de ejecución · {cat}</SectionTitle>
              <p className="mb-3 text-sm leading-relaxed text-foreground/90">{insight.conclusion}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {insight.positivos.map((p, i) => (
                  <Insight key={`p${i}`} type="good" title="✓ Positivo" text={p} />
                ))}
                {insight.alertas.map((a, i) => (
                  <Insight key={`a${i}`} type="warn" title="⚠ Alerta" text={a} />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ===== POR MEDIO ===== */}
      {tab === "Por Medio" && (
        <div>
          <SectionTitle>Detalle Real vs Planificado por línea</SectionTitle>
          <div className="rounded-xl border bg-card">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="border-b bg-muted/40">
                  <tr className="text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-2">Plataforma</th>
                    <th className="px-3 py-2">Etapa</th>
                    {cat === "Todas" && <th className="px-3 py-2">Categoría</th>}
                    <th className="px-3 py-2 text-right">Inv. Plan</th>
                    <th className="px-3 py-2 text-right">Inv. Real</th>
                    <th className="px-3 py-2 text-right">Impresiones</th>
                    <th className="px-3 py-2 text-right">Alcance</th>
                    <th className="px-3 py-2 text-right">Costo</th>
                    <th className="px-3 py-2 text-right">CTR</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="px-3 py-2 font-medium">
                        <span className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle" style={{ backgroundColor: MEDIO_COLORS[r.medio] ?? "#94a3b8" }} />
                        {r.medio}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{r.objetivo === "Build" ? "Upper" : r.objetivo === "Consider" ? "Mid" : "Upper+Mid"}</td>
                      {cat === "Todas" && <td className="px-3 py-2 text-muted-foreground">{r.categoria}</td>}
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{r.inversion_plan ? fmtARS(r.inversion_plan) : "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{r.inversion ? fmtARS(r.inversion) : "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{r.impresiones ? fmtNum(r.impresiones) : "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{r.alcance ? fmtNum(r.alcance) : "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{r.costo != null ? `${fmtMoney(r.costo)} ${r.tipo_compra}` : r.tipo_compra}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{r.ctr != null ? `${r.ctr.toFixed(2)}%` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <SectionTitle>Desglose por plataforma</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {byMedio.map((p) => (
              <div key={p.medio} className="rounded-lg border bg-card p-4">
                <div className="mb-3 flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: MEDIO_COLORS[p.medio] ?? "#94a3b8" }} />
                  <span className="text-xs font-semibold">{p.medio}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><div className="text-muted-foreground">Inversión</div><div className="font-semibold">{fmtARS(p.inversion)}</div></div>
                  <div><div className="text-muted-foreground">CPM</div><div className="font-semibold">{fmtMoney(p.cpm)}</div></div>
                  <div><div className="text-muted-foreground">Impresiones</div><div className="font-semibold">{fmtNum(p.impresiones)}</div></div>
                  <div><div className="text-muted-foreground">Alcance</div><div className="font-semibold">{p.alcance > 0 ? fmtNum(p.alcance) : "—"}</div></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
