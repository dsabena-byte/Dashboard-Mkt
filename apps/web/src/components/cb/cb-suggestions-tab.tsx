import { KpiCard } from "@/components/kpi-card";
import type { CbBaselineMedidas, CbSuggestion, CbSuggestionsByCadena } from "@/lib/cb-queries";

interface Props {
  baseline: CbBaselineMedidas;
  suggestions: CbSuggestion[];
  byCadena: CbSuggestionsByCadena[];
}

function pctCell(pct: number | null): string {
  if (pct == null) return "text-muted-foreground";
  if (pct >= 80) return "bg-emerald-50 text-emerald-700 font-semibold";
  if (pct >= 70) return "bg-amber-50 text-amber-700 font-semibold";
  return "bg-rose-50 text-rose-600 font-semibold";
}

export function CbSuggestionsTab({ baseline, suggestions, byCadena }: Props) {
  const threshold = baseline.cb_pct_avg ?? 0;

  // Sugeridas: tiendas con cb_pct >= threshold y cb_target > 0
  const sugeridas = suggestions
    .filter((s) => s.cb_target > 0 && (s.cb_pct ?? 0) >= threshold)
    .sort((a, b) => (b.cb_pct ?? 0) - (a.cb_pct ?? 0));

  // Resto: tiendas analizadas pero bajo threshold
  const resto = suggestions
    .filter((s) => s.cb_target > 0 && (s.cb_pct ?? 0) < threshold)
    .sort((a, b) => (b.cb_pct ?? 0) - (a.cb_pct ?? 0));

  // Sin catálogo: tiendas cuya cadena no está en el programa CB (cb_target=0)
  const sinCatalogo = suggestions.filter((s) => s.cb_target === 0);

  // Sumatoria de las sugeridas
  const sumOkSug = sugeridas.reduce((a, s) => a + s.cb_ok, 0);
  const sumTargetSug = sugeridas.reduce((a, s) => a + s.cb_target, 0);
  const cbPromSugeridas = sumTargetSug > 0 ? (sumOkSug / sumTargetSug) * 100 : 0;

  // % CB global REAL si se suman las sugeridas a las tiendas medidas hoy.
  // Suma algebraica simple — ambos universos cubren las últimas 3 semanas:
  // nuevo = (cb_ok_medidas + ok_sugeridas) / (cb_target_medidas + target_sugeridas)
  const cbNuevoGlobal = (baseline.cb_target_total + sumTargetSug) > 0
    ? ((baseline.cb_ok_total + sumOkSug) / (baseline.cb_target_total + sumTargetSug)) * 100
    : 0;
  const cbDeltaPp = baseline.cb_pct_avg != null ? cbNuevoGlobal - baseline.cb_pct_avg : 0;

  return (
    <div className="space-y-4">
      <header className="rounded-xl border bg-sky-50 p-4 text-xs text-sky-900">
        <strong>¿Cómo funciona?</strong> Se analiza el archivo{" "}
        <code>Reporte de Existencias U3</code> contra el catálogo CB definido por cadena en{" "}
        <code>cuadro_basico_semanal</code>. Las tiendas que <strong>no medimos hoy</strong> pero
        cuyo % CB calculado supera el <strong>promedio actual de medidas</strong>{" "}
        ({threshold.toFixed(1)}%) son candidatas a sumar al programa para mejorar el cumplimiento global.
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard
          title="Baseline · % CB medidas"
          value={baseline.cb_pct_avg != null ? `${baseline.cb_pct_avg.toFixed(1)}%` : "—"}
          hint={`${baseline.tiendas_medidas} tiendas hoy en el programa CB · últimas 3 semanas`}
        />
        <KpiCard
          title="Tiendas analizadas"
          value={String(suggestions.length)}
          hint={`No medidas · presentes en reporte últimas 3 semanas`}
        />
        <KpiCard
          title="✅ Sugeridas (≥ baseline)"
          value={String(sugeridas.length)}
          hint={`% CB promedio de las sugeridas: ${cbPromSugeridas.toFixed(1)}%`}
        />
        <KpiCard
          title="🎯 % CB nuevo global"
          value={`${cbNuevoGlobal.toFixed(1)}%`}
          hint={`Sumando las ${sugeridas.length} sugeridas a las ${baseline.tiendas_medidas} medidas · ${cbDeltaPp >= 0 ? "+" : ""}${cbDeltaPp.toFixed(1)} pp vs baseline`}
        />
        <KpiCard
          title="⚠ Sin catálogo CB"
          value={String(sinCatalogo.length)}
          hint={`Cadenas no definidas en CB · imposible computar % hoy`}
        />
      </section>

      {byCadena.length > 0 && (
        <section className="rounded-xl border bg-card overflow-hidden">
          <div className="px-4 py-3">
            <h3 className="text-sm font-bold">📊 Cumplimiento promedio por cadena (no medidas)</h3>
            <p className="text-[11px] text-muted-foreground">
              Tiendas analizadas y su % CB promedio agrupadas por cadena.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-[#0a1849] text-white">
                <tr>
                  <th className="px-3 py-2 text-left">Cadena</th>
                  <th className="px-3 py-2 text-right">Tiendas</th>
                  <th className="px-3 py-2 text-right">% CB promedio</th>
                  <th className="px-3 py-2 text-right">Δ vs baseline</th>
                </tr>
              </thead>
              <tbody>
                {byCadena.map((c) => {
                  const delta = c.cb_pct_promedio - threshold;
                  const deltaClass = delta >= 0 ? "text-emerald-600" : "text-rose-500";
                  return (
                    <tr key={c.cadena} className="border-b last:border-0">
                      <td className="px-3 py-1.5 font-medium">{c.cadena}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{c.tiendas}</td>
                      <td className={`px-3 py-1.5 text-right tabular-nums ${pctCell(c.cb_pct_promedio)}`}>
                        {c.cb_pct_promedio.toFixed(1)}%
                      </td>
                      <td className={`px-3 py-1.5 text-right tabular-nums ${deltaClass}`}>
                        {delta >= 0 ? "+" : ""}{delta.toFixed(1)} pp
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="rounded-xl border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <h3 className="text-sm font-bold">✅ Tiendas sugeridas para sumar al programa</h3>
          <span className="text-[11px] text-muted-foreground">
            % CB ≥ baseline ({threshold.toFixed(1)}%) · ordenado por % CB descendente
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-[#0a1849] text-white">
              <tr>
                <th rowSpan={2} className="border-r border-white/10 px-3 py-2 text-left align-bottom">#</th>
                <th rowSpan={2} className="border-r border-white/10 px-3 py-2 text-left align-bottom">Tienda</th>
                <th rowSpan={2} className="border-r border-white/10 px-3 py-2 text-left align-bottom">Cadena</th>
                <th colSpan={2} className="border-r border-white/10 px-3 py-1 text-center text-[11px] uppercase">% CB</th>
                <th colSpan={2} className="hidden border-r border-white/10 px-3 py-1 text-center text-[11px] uppercase md:table-cell">% Infaltable</th>
                <th colSpan={2} className="hidden px-3 py-1 text-center text-[11px] uppercase md:table-cell">% Estratégico</th>
              </tr>
              <tr className="text-[10px] uppercase opacity-80">
                <th className="px-2 py-1 text-right">%</th>
                <th className="border-r border-white/10 px-2 py-1 text-right">ok/tot</th>
                <th className="hidden px-2 py-1 text-right md:table-cell">%</th>
                <th className="hidden border-r border-white/10 px-2 py-1 text-right md:table-cell">ok/tot</th>
                <th className="hidden px-2 py-1 text-right md:table-cell">%</th>
                <th className="hidden px-2 py-1 text-right md:table-cell">ok/tot</th>
              </tr>
            </thead>
            <tbody>
              {sugeridas.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-6 text-center text-sm text-muted-foreground">
                    Ninguna tienda no-medida supera el baseline actual de {threshold.toFixed(1)}%.
                  </td>
                </tr>
              ) : (
                sugeridas.map((s, i) => (
                  <tr key={s.numero_tienda} className="border-b last:border-0">
                    <td className="px-3 py-1.5 text-muted-foreground">{i + 1}</td>
                    <td className="px-3 py-1.5 font-medium">{s.tienda}</td>
                    <td className="px-3 py-1.5">{s.cadena}</td>
                    <td className={`px-2 py-1.5 text-right tabular-nums ${pctCell(s.cb_pct)}`}>
                      {s.cb_pct != null ? `${s.cb_pct.toFixed(1)}%` : "—"}
                    </td>
                    <td className="border-r border-border px-2 py-1.5 text-right tabular-nums text-muted-foreground">
                      {s.cb_ok}/{s.cb_target}
                    </td>
                    <td className={`hidden px-2 py-1.5 text-right tabular-nums md:table-cell ${pctCell(s.infalt_pct)}`}>
                      {s.infalt_pct != null ? `${s.infalt_pct.toFixed(1)}%` : "—"}
                    </td>
                    <td className="hidden border-r border-border px-2 py-1.5 text-right tabular-nums text-muted-foreground md:table-cell">
                      {s.infalt_ok}/{s.infalt_target}
                    </td>
                    <td className={`hidden px-2 py-1.5 text-right tabular-nums md:table-cell ${pctCell(s.estrat_pct)}`}>
                      {s.estrat_pct != null ? `${s.estrat_pct.toFixed(1)}%` : "—"}
                    </td>
                    <td className="hidden px-2 py-1.5 text-right tabular-nums text-muted-foreground md:table-cell">
                      {s.estrat_ok}/{s.estrat_target}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {resto.length > 0 && (
        <section className="rounded-xl border bg-card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <h3 className="text-sm font-bold">📉 Resto de tiendas analizadas (bajo baseline)</h3>
            <span className="text-[11px] text-muted-foreground">No sumar por ahora — % CB &lt; {threshold.toFixed(1)}%</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/40">
                <tr className="text-[11px] uppercase tracking-wide">
                  <th className="border-b px-3 py-2 text-left">Tienda</th>
                  <th className="border-b px-3 py-2 text-left">Cadena</th>
                  <th className="border-b px-2 py-2 text-right">% CB</th>
                  <th className="hidden border-b px-2 py-2 text-right md:table-cell">% Infalt</th>
                  <th className="hidden border-b px-2 py-2 text-right md:table-cell">% Estrat</th>
                </tr>
              </thead>
              <tbody>
                {resto.slice(0, 50).map((s) => (
                  <tr key={s.numero_tienda} className="border-b last:border-0">
                    <td className="px-3 py-1.5">{s.tienda}</td>
                    <td className="px-3 py-1.5 text-muted-foreground">{s.cadena}</td>
                    <td className={`px-2 py-1.5 text-right tabular-nums ${pctCell(s.cb_pct)}`}>
                      {s.cb_pct != null ? `${s.cb_pct.toFixed(1)}%` : "—"}
                    </td>
                    <td className={`hidden px-2 py-1.5 text-right tabular-nums md:table-cell ${pctCell(s.infalt_pct)}`}>
                      {s.infalt_pct != null ? `${s.infalt_pct.toFixed(1)}%` : "—"}
                    </td>
                    <td className={`hidden px-2 py-1.5 text-right tabular-nums md:table-cell ${pctCell(s.estrat_pct)}`}>
                      {s.estrat_pct != null ? `${s.estrat_pct.toFixed(1)}%` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {resto.length > 50 && (
            <p className="px-4 py-2 text-[11px] text-muted-foreground">
              Mostrando 50 de {resto.length}
            </p>
          )}
        </section>
      )}
    </div>
  );
}
