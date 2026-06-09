"use client";

import { useMemo, useState } from "react";
import type { CbBaselineMedidas, CbSuggestion, CbSuggestionDetail } from "@/lib/cb-queries";

interface Props {
  baseline: CbBaselineMedidas;
  suggestions: CbSuggestion[];
  details: CbSuggestionDetail[];
}

function pctCell(pct: number | null): string {
  if (pct == null) return "text-muted-foreground";
  if (pct >= 80) return "bg-emerald-50 text-emerald-700 font-semibold";
  if (pct >= 70) return "bg-amber-50 text-amber-700 font-semibold";
  return "bg-rose-50 text-rose-600 font-semibold";
}

function StatCard({ label, value, hint, pill, pillColor }: {
  label: string;
  value: string;
  hint?: string;
  pill?: string;
  pillColor?: "emerald" | "rose" | "slate";
}) {
  const pillClass =
    pillColor === "emerald" ? "bg-emerald-100 text-emerald-700"
    : pillColor === "rose" ? "bg-rose-100 text-rose-700"
    : "bg-slate-100 text-slate-700";
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-3xl font-bold text-rose-500">{value}</div>
      {hint && <div className="mt-1 text-[11px] text-muted-foreground tabular-nums">{hint}</div>}
      {pill && (
        <div className="mt-3 border-t pt-2 text-[11px] flex items-center justify-end">
          <span className={`rounded-full px-2 py-0.5 font-semibold tabular-nums ${pillClass}`}>
            {pill}
          </span>
        </div>
      )}
    </div>
  );
}

// Panel de detalle: lista de modelos infaltables + estratégicos para una tienda
function DetailPanel({ tiendaLabel, items }: { tiendaLabel: string; items: CbSuggestionDetail[] }) {
  const inf = items.filter((i) => i.cuadro_basico === "INFALTABLE");
  const est = items.filter((i) => i.cuadro_basico === "ESTRATEGICO");
  const infOk = inf.filter((i) => i.presente === 1).length;
  const estOk = est.filter((i) => i.presente === 1).length;
  return (
    <div className="space-y-3 bg-slate-50 p-4">
      <div className="text-xs font-semibold">🔍 Detalle de SKUs — {tiendaLabel}</div>
      <div className="grid gap-3 md:grid-cols-2">
        <DetailColumn title="📌 Infaltables" count={`${infOk} / ${inf.length}`} pillColor="bg-violet-100 text-violet-700" items={inf} />
        <DetailColumn title="🎯 Estratégicos" count={`${estOk} / ${est.length}`} pillColor="bg-rose-100 text-rose-700" items={est} />
      </div>
    </div>
  );
}

function DetailColumn({ title, count, pillColor, items }: {
  title: string; count: string; pillColor: string; items: CbSuggestionDetail[];
}) {
  // Orden: ausentes primero (los rojos arriba para llamar la atención), después presentes
  const sorted = [...items].sort((a, b) => (a.presente - b.presente) || a.modelo.localeCompare(b.modelo));
  return (
    <div className="rounded-lg border bg-white">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <span className="text-xs font-semibold">{title}</span>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${pillColor}`}>{count}</span>
      </div>
      <div className="divide-y">
        {sorted.length === 0 ? (
          <div className="px-3 py-3 text-[11px] text-muted-foreground">Sin modelos en esta sección.</div>
        ) : sorted.map((i, idx) => (
          <div key={`${i.modelo}-${idx}`} className={`flex items-center justify-between px-3 py-2 text-xs ${i.presente ? "bg-emerald-50/40" : "bg-rose-50/40"}`}>
            <div className="flex items-center gap-2">
              <span className={`inline-flex h-5 w-5 items-center justify-center rounded ${i.presente ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-600"}`}>
                {i.presente ? "✓" : "✗"}
              </span>
              <div>
                <div className="font-semibold tabular-nums">{i.modelo}</div>
                <div className="text-[10px] uppercase text-muted-foreground">{i.categoria}</div>
              </div>
            </div>
            <div className={`text-right tabular-nums ${i.presente ? "text-emerald-700" : "text-rose-600"}`}>
              <div className="font-semibold">{i.presente ? "100%" : "0%"}</div>
              <div className="text-[10px]">{i.presente}/1</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Fila expandible: cuando se hace click, expande mostrando el detalle
function ExpandableRow({ s, index, details, colSpan }: {
  s: CbSuggestion;
  index: number;
  details: CbSuggestionDetail[];
  colSpan: number;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <tr
        onClick={() => setOpen((v) => !v)}
        className="cursor-pointer border-b last:border-0 hover:bg-slate-50 transition-colors"
      >
        <td className="px-3 py-1.5 text-muted-foreground">
          <span className="mr-1 inline-block w-3 text-[10px]">{open ? "▼" : "▶"}</span>
          {index + 1}
        </td>
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
      {open && (
        <tr className="border-b last:border-0">
          <td colSpan={colSpan} className="p-0">
            <DetailPanel tiendaLabel={s.tienda} items={details} />
          </td>
        </tr>
      )}
    </>
  );
}

export function CbSuggestionsTab({ baseline, suggestions, details }: Props) {
  const threshold = baseline.cb_pct_avg ?? 0;

  // Sugeridas: tiendas con cb_pct >= threshold y cb_target > 0
  const sugeridas = useMemo(
    () => suggestions
      .filter((s) => s.cb_target > 0 && (s.cb_pct ?? 0) >= threshold)
      .sort((a, b) => (b.cb_pct ?? 0) - (a.cb_pct ?? 0)),
    [suggestions, threshold],
  );

  // Resto: tiendas analizadas pero bajo threshold
  const resto = useMemo(
    () => suggestions
      .filter((s) => s.cb_target > 0 && (s.cb_pct ?? 0) < threshold)
      .sort((a, b) => (b.cb_pct ?? 0) - (a.cb_pct ?? 0)),
    [suggestions, threshold],
  );

  // Sin catálogo: tiendas cuya cadena no está en el programa CB (cb_target=0)
  const sinCatalogo = useMemo(
    () => suggestions.filter((s) => s.cb_target === 0),
    [suggestions],
  );

  // Group details por numero_tienda para lookup O(1) al expandir
  const detailsByTienda = useMemo(() => {
    const map = new Map<string, CbSuggestionDetail[]>();
    for (const d of details) {
      const arr = map.get(d.numero_tienda) ?? [];
      arr.push(d);
      map.set(d.numero_tienda, arr);
    }
    return map;
  }, [details]);

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
        <code>cb_homologos</code>. Las tiendas que <strong>no medimos hoy</strong> pero
        cuyo % CB calculado supera el <strong>promedio actual de medidas</strong>{" "}
        ({threshold.toFixed(1)}%) son candidatas a sumar al programa.{" "}
        <strong>Click en cualquier tienda</strong> para ver el detalle de SKUs cumplidos / faltantes.
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-xl bg-[#0a1849] p-5 text-white">
          <div className="text-[10px] font-semibold uppercase tracking-wide opacity-80">
            Baseline · Cumplimiento medidas
          </div>
          <div className="mt-2 text-4xl font-bold text-rose-300">
            {baseline.cb_pct_avg != null ? `${baseline.cb_pct_avg.toFixed(1)}%` : "—"}
          </div>
          <div className="mt-2 text-[11px] opacity-80">
            {baseline.tiendas_medidas} tiendas en programa CB · últimas 3 semanas
          </div>
        </div>

        <StatCard
          label="Tiendas analizadas"
          value={String(suggestions.length)}
          hint="No medidas · presentes en reporte"
        />

        <StatCard
          label="✅ Sugeridas (≥ baseline)"
          value={String(sugeridas.length)}
          hint={`% CB promedio: ${cbPromSugeridas.toFixed(1)}%`}
          pill={`+${(cbPromSugeridas - (baseline.cb_pct_avg ?? 0)).toFixed(1)} pp`}
          pillColor="emerald"
        />

        <StatCard
          label="🎯 % CB nuevo global"
          value={`${cbNuevoGlobal.toFixed(1)}%`}
          hint={`Sumando ${sugeridas.length} sugeridas a ${baseline.tiendas_medidas} medidas`}
          pill={`${cbDeltaPp >= 0 ? "+" : ""}${cbDeltaPp.toFixed(1)} pp vs baseline`}
          pillColor={cbDeltaPp >= 0 ? "emerald" : "rose"}
        />

        <StatCard
          label="⚠ Sin catálogo CB"
          value={String(sinCatalogo.length)}
          hint="Cadenas no definidas en CB"
        />
      </section>

      <section className="rounded-xl border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <h3 className="text-sm font-bold">✅ Tiendas sugeridas para sumar al programa</h3>
          <span className="text-[11px] text-muted-foreground">
            % CB ≥ baseline ({threshold.toFixed(1)}%) · click para detalle
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
                  <ExpandableRow
                    key={s.numero_tienda}
                    s={s}
                    index={i}
                    details={detailsByTienda.get(s.numero_tienda) ?? []}
                    colSpan={9}
                  />
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
            <span className="text-[11px] text-muted-foreground">
              No sumar por ahora — % CB &lt; {threshold.toFixed(1)}% · click para detalle
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
                {resto.slice(0, 50).map((s, i) => (
                  <ExpandableRow
                    key={s.numero_tienda}
                    s={s}
                    index={i}
                    details={detailsByTienda.get(s.numero_tienda) ?? []}
                    colSpan={9}
                  />
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
