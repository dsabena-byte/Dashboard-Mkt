import { getMercadoRows, mesLabel, type MercadoRow } from "@/lib/mercado-queries";
import { MercadoBrandChart, type BrandChartPoint } from "@/components/mercado/mercado-brand-chart";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const PALETTE = ["#ec4899", "#22c55e", "#f59e0b", "#a855f7", "#06b6d4", "#94a3b8", "#64748b"];
const HIGHLIGHT = "#2b4dff";

type MetricKey = "value_share" | "unit_share" | "index_price";
const METRICS: Array<{ key: MetricKey; label: string; suffix: string; deltaUnit: string }> = [
  { key: "value_share", label: "Value share %", suffix: "%", deltaUnit: " pts" },
  { key: "unit_share", label: "Unit share %", suffix: "%", deltaUnit: " pts" },
  { key: "index_price", label: "Índice de precio (base 100)", suffix: "", deltaUnit: "" },
];

const WINDOWS: Array<{ key: string; label: string; n: number }> = [
  { key: "U4", label: "U4M", n: 4 },
  { key: "U8", label: "U8M", n: 8 },
  { key: "U12", label: "U12M", n: 12 },
];

function pivot(rows: MercadoRow[], brands: string[], metric: MetricKey): BrandChartPoint[] {
  const byMes = new Map<string, BrandChartPoint>();
  for (const r of rows) {
    if (!brands.includes(r.marca)) continue;
    const label = mesLabel(r.mes);
    const p = byMes.get(label) ?? { mes: label };
    p[r.marca] = r[metric];
    byMes.set(label, p);
  }
  return [...byMes.values()];
}

interface Delta {
  marca: string;
  delta: number;
}
interface WindowMovers {
  label: string;
  fromLabel: string | null;
  toLabel: string;
  top: Delta[]; // mayores variaciones (abs), excl. Drean
  drean: number | null;
}

// Para una métrica: variación de cada marca entre el mes actual y N meses atrás
// (U4M / U8M / U12M). Devuelve top movers por |Δ| más el valor de Drean.
function computeMovers(grp: MercadoRow[], metric: MetricKey): WindowMovers[] {
  const months = [...new Set(grp.map((r) => r.mes))].sort();
  if (months.length === 0) return [];
  const latest = months[months.length - 1]!;
  const byBrand = new Map<string, Map<string, number | null>>();
  for (const r of grp) {
    let m = byBrand.get(r.marca);
    if (!m) byBrand.set(r.marca, (m = new Map()));
    m.set(r.mes, r[metric]);
  }
  return WINDOWS.map((w) => {
    const refIdx = months.length - 1 - w.n;
    const refMes = refIdx >= 0 ? months[refIdx]! : null;
    const deltas: Delta[] = [];
    let drean: number | null = null;
    if (refMes) {
      for (const [marca, mm] of byBrand) {
        const a = mm.get(refMes);
        const b = mm.get(latest);
        if (a == null || b == null) continue;
        const d = b - a;
        if (marca === "DREAN") drean = d;
        else deltas.push({ marca, delta: d });
      }
    }
    deltas.sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta));
    return {
      label: w.label,
      fromLabel: refMes ? mesLabel(refMes) : null,
      toLabel: mesLabel(latest),
      top: deltas.slice(0, 3),
      drean,
    };
  });
}

function DeltaPill({ d, unit }: { d: number; unit: string }) {
  const up = d > 0.05;
  const down = d < -0.05;
  const cls = up ? "text-emerald-600" : down ? "text-red-600" : "text-muted-foreground";
  const arrow = up ? "▲" : down ? "▼" : "→";
  const sign = d > 0 ? "+" : "";
  return (
    <span className={`tabular-nums font-medium ${cls}`}>
      {arrow} {sign}
      {d.toFixed(1)}
      {unit}
    </span>
  );
}

function MoversPanel({ windows, deltaUnit }: { windows: WindowMovers[]; deltaUnit: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Mayores variaciones
      </div>
      <div className="space-y-3">
        {windows.map((w) => (
          <div key={w.label}>
            <div className="mb-1 flex items-baseline justify-between">
              <span className="text-xs font-semibold">{w.label}</span>
              {w.fromLabel && (
                <span className="text-[10px] text-muted-foreground">
                  {w.fromLabel} → {w.toLabel}
                </span>
              )}
            </div>
            {w.fromLabel ? (
              <div className="space-y-0.5 text-[11px]">
                <div className="flex items-center justify-between gap-2 rounded bg-[#2b4dff]/10 px-1.5 py-0.5">
                  <span className="font-semibold text-[#2b4dff]">DREAN</span>
                  {w.drean != null ? <DeltaPill d={w.drean} unit={deltaUnit} /> : <span className="text-muted-foreground">s/d</span>}
                </div>
                {w.top.map((t) => (
                  <div key={t.marca} className="flex items-center justify-between gap-2 px-1.5">
                    <span className="truncate text-muted-foreground">{t.marca}</span>
                    <DeltaPill d={t.delta} unit={deltaUnit} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-[10px] text-muted-foreground">Sin histórico suficiente.</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default async function MercadoPage() {
  const rows = await getMercadoRows();

  // Agrupar por categoría · segmento
  const groups = new Map<string, MercadoRow[]>();
  for (const r of rows) {
    const k = `${r.categoria}__${r.segmento}`;
    const arr = groups.get(k);
    if (arr) arr.push(r);
    else groups.set(k, [r]);
  }

  return (
    <div className="space-y-5">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight">Análisis de Mercado</h2>
        <p className="text-sm text-muted-foreground">
          Value share, Unit share e Índice de precio en el tiempo — Drean vs competencia, por categoría y segmento. Al
          costado de cada serie, las marcas con mayor variación en los últimos 4 / 8 / 12 meses. Fuente: Euromonitor (
          <code>mercado_share</code>).
        </p>
      </header>

      {rows.length === 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
          Sin datos de mercado todavía. Aplicá la migración <code>0053_mercado_share.sql</code> y cargá el seed (
          <code>supabase/seed/mercado_lavado.sql</code>). Esta misma data alimenta el Objetivo 4 del dash de Objetivos.
        </div>
      )}

      {[...groups.entries()].map(([key, grp]) => {
        const [categoria, segmento] = key.split("__");
        // último mes del grupo → ranking de marcas por value share
        const lastMes = grp.reduce((m, r) => (r.mes > m ? r.mes : m), grp[0]!.mes);
        const ranked = grp
          .filter((r) => r.mes === lastMes)
          .sort((a, b) => (b.value_share ?? 0) - (a.value_share ?? 0))
          .map((r) => r.marca);
        const brands = [...new Set(["DREAN", ...ranked])].filter((b) => ranked.includes(b)).slice(0, 6);
        if (!brands.includes("DREAN") && ranked.includes("DREAN")) brands[brands.length - 1] = "DREAN";
        const others = brands.filter((b) => b !== "DREAN");

        return (
          <section key={key} className="rounded-xl border bg-card p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-base font-semibold tracking-tight">
                {categoria} <span className="text-sm font-normal text-muted-foreground">· segmento {segmento}</span>
              </h3>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
                <span className="inline-flex items-center gap-1.5 font-semibold">
                  <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: HIGHLIGHT }} />DREAN
                </span>
                {others.map((b, i) => (
                  <span key={b} className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: PALETTE[i % PALETTE.length] }} />
                    {b}
                  </span>
                ))}
              </div>
            </div>
            <div className="space-y-4">
              {METRICS.map((m) => (
                <div key={m.key} className="grid gap-4 lg:grid-cols-[1fr_15rem]">
                  <div>
                    <div className="mb-1 text-xs font-medium text-muted-foreground">{m.label}</div>
                    <MercadoBrandChart data={pivot(grp, brands, m.key)} brands={brands} suffix={m.suffix} />
                  </div>
                  <MoversPanel windows={computeMovers(grp, m.key)} deltaUnit={m.deltaUnit} />
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
