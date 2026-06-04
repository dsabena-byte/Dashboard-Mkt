"use client";

import type { MedioEfficiency, PautaInsight } from "@/lib/pauta-insights";

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

const PRIO_STYLE: Record<string, { bg: string; border: string; text: string; chip: string; label: string }> = {
  alta:  { bg: "bg-rose-50",  border: "border-rose-300",  text: "text-rose-900",  chip: "bg-rose-500 text-white",  label: "ALTA" },
  media: { bg: "bg-amber-50", border: "border-amber-300", text: "text-amber-900", chip: "bg-amber-500 text-white", label: "MEDIA" },
  baja:  { bg: "bg-slate-50", border: "border-slate-200", text: "text-slate-900", chip: "bg-slate-400 text-white", label: "BAJA" },
};

const TIPO_ICON: Record<string, string> = { alerta: "🔴", oportunidad: "🟢", info: "ℹ️" };

function InsightCard({ i }: { i: PautaInsight }) {
  const style = PRIO_STYLE[i.prioridad] ?? PRIO_STYLE.baja!;
  const icon = TIPO_ICON[i.tipo] ?? "•";
  return (
    <div className={`rounded-lg border-l-4 ${style.border} ${style.bg} ${style.text} p-3`}>
      <div className="flex items-center gap-1.5 text-xs">
        <span>{icon}</span>
        <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${style.chip}`}>{style.label}</span>
      </div>
      <div className="mt-2 text-sm font-semibold leading-snug">{i.titulo}</div>
      <p className="mt-1 text-[11px] leading-relaxed opacity-80">{i.descripcion}</p>
      {i.acciones.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-[11px]">
          {i.acciones.map((a, idx) => (
            <li key={idx} className="flex gap-1.5">
              <span className="shrink-0 opacity-50">→</span>
              <span>{a}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function efficiencyColor(e: MedioEfficiency): string {
  // verde si entregó >= plan, ambar si entre 80-100%, rojo si <80%
  if (e.delivery_pct >= 100) return "text-emerald-600";
  if (e.delivery_pct >= 80) return "text-amber-600";
  return "text-rose-600";
}

function overrunColor(pct: number | null): string {
  if (pct == null) return "text-muted-foreground";
  if (pct < -10) return "text-emerald-600";
  if (pct <= 10) return "text-foreground";
  if (pct <= 30) return "text-amber-600";
  return "text-rose-600";
}

export function PautaInsightsPanel({
  efficiency,
  insights,
  benchmarks,
}: {
  efficiency: MedioEfficiency[];
  insights: PautaInsight[];
  benchmarks: { upper_cpm: number; mid_cpc: number };
}) {
  const upperRanking = efficiency
    .filter((e) => e.stage === "upper" && e.cpm_real != null)
    .sort((a, b) => (a.cpm_real ?? 0) - (b.cpm_real ?? 0));
  const midRanking = efficiency
    .filter((e) => e.stage === "mid" && e.cpc_real != null)
    .sort((a, b) => (a.cpc_real ?? 0) - (b.cpc_real ?? 0));
  const totalInv = efficiency.reduce((s, e) => s + e.inversion, 0);

  return (
    <div className="space-y-5">
      {/* Resumen */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border bg-card p-3">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Inversión total</div>
          <div className="mt-1 text-2xl font-bold">{fmtARS(totalInv)}</div>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">CPM promedio Awareness</div>
          <div className="mt-1 text-2xl font-bold">{benchmarks.upper_cpm > 0 ? fmtARS(benchmarks.upper_cpm) : "—"}</div>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">CPC promedio Consideración</div>
          <div className="mt-1 text-2xl font-bold">{benchmarks.mid_cpc > 0 ? fmtARS(benchmarks.mid_cpc) : "—"}</div>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Señales detectadas</div>
          <div className="mt-1 text-2xl font-bold">{insights.length}</div>
          <div className="text-[10px] text-muted-foreground">
            {insights.filter((i) => i.prioridad === "alta").length} alta · {insights.filter((i) => i.prioridad === "media").length} media
          </div>
        </div>
      </section>

      {/* Insights cards */}
      {insights.length > 0 ? (
        <section className="space-y-2">
          <h3 className="text-sm font-bold">💡 Recomendaciones de mix óptimo</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {insights.map((i) => (
              <InsightCard key={i.signal_key} i={i} />
            ))}
          </div>
        </section>
      ) : (
        <div className="rounded-lg border bg-amber-50 p-3 text-xs text-amber-900">
          Sin señales claras con los filtros actuales. Probá ampliar el rango o sacar filtros para tener más volumen analizable.
        </div>
      )}

      {/* Ranking eficiencia Awareness */}
      {upperRanking.length > 0 && (
        <section className="rounded-xl border bg-card overflow-hidden">
          <div className="px-4 py-3">
            <h3 className="text-sm font-bold">🎯 Ranking de eficiencia — Awareness (CPM)</h3>
            <p className="text-[11px] text-muted-foreground">Del más eficiente al menos. Δ vs plan en la última columna.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-[#0a1849] text-white text-[11px] uppercase tracking-wide">
                <tr>
                  <th className="px-3 py-2 text-left">#</th>
                  <th className="px-3 py-2 text-left">Medio</th>
                  <th className="px-3 py-2 text-right">Inversión</th>
                  <th className="px-3 py-2 text-right">Impresiones</th>
                  <th className="px-3 py-2 text-right">CPM real</th>
                  <th className="px-3 py-2 text-right">vs promedio</th>
                  <th className="hidden px-3 py-2 text-right md:table-cell">% entregado</th>
                </tr>
              </thead>
              <tbody>
                {upperRanking.map((e, i) => {
                  const deltaVsAvg = benchmarks.upper_cpm > 0 && e.cpm_real
                    ? ((e.cpm_real - benchmarks.upper_cpm) / benchmarks.upper_cpm) * 100
                    : 0;
                  return (
                    <tr key={`${e.medio}-${e.tipo_compra}`} className="border-b last:border-0">
                      <td className="px-3 py-1.5 text-muted-foreground">#{i + 1}</td>
                      <td className="px-3 py-1.5 font-medium">{e.medio} <span className="text-[10px] text-muted-foreground">({e.tipo_compra})</span></td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{fmtARS(e.inversion)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">{fmtNum(e.impresiones)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums font-semibold">{e.cpm_real != null ? fmtARS(e.cpm_real) : "—"}</td>
                      <td className={`px-3 py-1.5 text-right tabular-nums ${overrunColor(deltaVsAvg)}`}>{deltaVsAvg !== 0 ? `${deltaVsAvg > 0 ? "+" : ""}${deltaVsAvg.toFixed(0)}%` : "—"}</td>
                      <td className={`hidden px-3 py-1.5 text-right tabular-nums md:table-cell ${efficiencyColor(e)}`}>{e.delivery_pct > 0 ? `${e.delivery_pct.toFixed(0)}%` : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Ranking eficiencia Consideración */}
      {midRanking.length > 0 && (
        <section className="rounded-xl border bg-card overflow-hidden">
          <div className="px-4 py-3">
            <h3 className="text-sm font-bold">🔥 Ranking de eficiencia — Consideración (CPC)</h3>
            <p className="text-[11px] text-muted-foreground">Del más eficiente al menos. Δ vs plan en la última columna.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-[#0a1849] text-white text-[11px] uppercase tracking-wide">
                <tr>
                  <th className="px-3 py-2 text-left">#</th>
                  <th className="px-3 py-2 text-left">Medio</th>
                  <th className="px-3 py-2 text-right">Inversión</th>
                  <th className="px-3 py-2 text-right">Clics</th>
                  <th className="px-3 py-2 text-right">CTR</th>
                  <th className="px-3 py-2 text-right">CPC real</th>
                  <th className="px-3 py-2 text-right">vs promedio</th>
                </tr>
              </thead>
              <tbody>
                {midRanking.map((e, i) => {
                  const deltaVsAvg = benchmarks.mid_cpc > 0 && e.cpc_real
                    ? ((e.cpc_real - benchmarks.mid_cpc) / benchmarks.mid_cpc) * 100
                    : 0;
                  return (
                    <tr key={`${e.medio}-${e.tipo_compra}`} className="border-b last:border-0">
                      <td className="px-3 py-1.5 text-muted-foreground">#{i + 1}</td>
                      <td className="px-3 py-1.5 font-medium">{e.medio}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{fmtARS(e.inversion)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">{fmtNum(e.clics)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{e.ctr.toFixed(2)}%</td>
                      <td className="px-3 py-1.5 text-right tabular-nums font-semibold">{e.cpc_real != null ? fmtARS(e.cpc_real) : "—"}</td>
                      <td className={`px-3 py-1.5 text-right tabular-nums ${overrunColor(deltaVsAvg)}`}>{deltaVsAvg !== 0 ? `${deltaVsAvg > 0 ? "+" : ""}${deltaVsAvg.toFixed(0)}%` : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
