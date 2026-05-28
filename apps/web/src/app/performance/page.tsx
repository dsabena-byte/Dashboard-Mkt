"use client";

import { useState, useMemo } from "react";
import { KpiCard } from "@/components/kpi-card";
import {
  PAUTA_DATA,
  PAUTA_CATEGORIAS,
  PAUTA_MES,
  PAUTA_INSIGHTS,
  MEDIO_COLORS,
  computeFunnel,
  computeByMedio,
} from "@/lib/pauta-data";

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
}

function fmtARS(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${Math.round(n)}`;
}

function fmtMoney(n: number): string {
  return `$${n.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;
}

function variance(real: number, plan: number): number {
  if (!plan) return 0;
  return ((real - plan) / plan) * 100;
}

function VarBadge({ v }: { v: number }) {
  const color = v >= 0 ? "text-emerald-600" : "text-rose-600";
  const sign = v >= 0 ? "+" : "";
  return <span className={`tabular-nums ${color}`}>{sign}{v.toFixed(0)}%</span>;
}

export default function PerformancePautaPage() {
  const [cat, setCat] = useState("Todas");

  const rows = useMemo(
    () => (cat === "Todas" ? PAUTA_DATA : PAUTA_DATA.filter((r) => r.categoria === cat)),
    [cat],
  );

  const upper = useMemo(() => computeFunnel(rows, "upper"), [rows]);
  const mid = useMemo(() => computeFunnel(rows, "mid"), [rows]);
  const byMedio = useMemo(() => computeByMedio(rows), [rows]);

  const totalInv = upper.inversion + mid.inversion;
  const insight = cat !== "Todas" ? PAUTA_INSIGHTS[cat] : null;

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Performance Pauta</h2>
          <p className="text-sm text-muted-foreground">
            Resultados reales ejecutados (Digital ON + TV + OOH) por categoría · {PAUTA_MES} · Fuente: OMD. Funnel: Awareness → Consideración.
          </p>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          Inversión ejecutada<br />
          <span className="text-lg font-bold text-foreground">{fmtARS(totalInv)}</span>
        </div>
      </header>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        {PAUTA_CATEGORIAS.map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              cat === c ? "bg-foreground text-background" : "text-muted-foreground hover:bg-secondary"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Aprendizajes OMD */}
      {insight && (
        <div className="rounded-lg border bg-card p-4 space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Aprendizajes OMD · {cat}
          </h3>
          <p className="text-sm leading-relaxed text-foreground/90">{insight.conclusion}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-600">✓ Aspectos positivos</div>
              <ul className="space-y-1 text-xs text-muted-foreground">
                {insight.positivos.map((p, i) => (
                  <li key={i} className="flex gap-1.5"><span className="text-emerald-500">·</span>{p}</li>
                ))}
              </ul>
            </div>
            <div>
              <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-amber-600">⚠ Alertas a monitorear</div>
              <ul className="space-y-1 text-xs text-muted-foreground">
                {insight.alertas.map((a, i) => (
                  <li key={i} className="flex gap-1.5"><span className="text-amber-500">·</span>{a}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* UPPER FUNNEL */}
      <section>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Upper Funnel · Awareness
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <KpiCard title="Alcance total" value={fmtNum(upper.alcance)} hint="Usuarios únicos alcanzados" />
          <KpiCard title="Impresiones" value={fmtNum(upper.impresiones)} hint="Total del período" />
          <KpiCard title="Frecuencia" value={upper.frecuenciaPond.toFixed(2)} hint="Promedio ponderado" />
          <KpiCard title="CPM promedio" value={fmtMoney(upper.cpm)} hint="Costo por mil impresiones" />
          <KpiCard title="Inversión" value={fmtARS(upper.inversion)} hint="ARS ejecutado" />
        </div>
      </section>

      {/* MID FUNNEL */}
      <section>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Mid Funnel · Consideración
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <KpiCard title="Clicks totales" value={fmtNum(mid.clics)} hint="Total del período" />
          <KpiCard title="Video Views" value={fmtNum(upper.views + mid.views)} hint="Total del período (CPV)" />
          <KpiCard title="CTR promedio" value={`${mid.ctr.toFixed(2)}%`} hint="Click-through rate" />
          <KpiCard title="CPC" value={fmtMoney(mid.cpc)} hint="Costo por click" />
          <KpiCard title="Inversión" value={fmtARS(mid.inversion)} hint="ARS ejecutado" />
        </div>
      </section>

      {/* Desglose por plataforma */}
      <section>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Desglose por plataforma
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {byMedio.map((p) => (
            <div key={p.medio} className="rounded-lg border bg-card p-4">
              <div className="mb-3 flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: MEDIO_COLORS[p.medio] ?? "#94a3b8" }} />
                <span className="text-xs font-semibold">{p.medio}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <div className="text-muted-foreground">Inversión</div>
                  <div className="font-semibold">{fmtARS(p.inversion)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">CPM</div>
                  <div className="font-semibold">{fmtMoney(p.cpm)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Impresiones</div>
                  <div className="font-semibold">{fmtNum(p.impresiones)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Alcance</div>
                  <div className="font-semibold">{p.alcance > 0 ? fmtNum(p.alcance) : "—"}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Real vs Planificado */}
      <section>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Real vs Planificado
        </h3>
        <div className="rounded-lg border bg-card">
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
                  <th className="px-3 py-2 text-right">Costo Real</th>
                  <th className="px-3 py-2 text-right">CTR</th>
                  <th className="px-3 py-2 text-right">Var Inv%</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={`${r.categoria}-${r.medio}-${r.objetivo}-${i}`} className="border-b last:border-0">
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
                    <td className="px-3 py-2 text-right tabular-nums">{r.costo != null ? `${fmtMoney(r.costo)} ${r.tipo_compra}` : "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.ctr != null ? `${r.ctr.toFixed(2)}%` : "—"}</td>
                    <td className="px-3 py-2 text-right">{r.inversion && r.inversion_plan ? <VarBadge v={variance(r.inversion, r.inversion_plan)} /> : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
