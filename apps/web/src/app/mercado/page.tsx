import { getMercadoRows, mesLabel, type MercadoRow } from "@/lib/mercado-queries";
import { MercadoBrandChart, type BrandChartPoint } from "@/components/mercado/mercado-brand-chart";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const PALETTE = ["#ec4899", "#22c55e", "#f59e0b", "#a855f7", "#06b6d4", "#94a3b8", "#64748b"];
const HIGHLIGHT = "#2b4dff";
const METRICS: Array<{ key: "value_share" | "unit_share" | "index_price"; label: string; suffix: string }> = [
  { key: "value_share", label: "Value share %", suffix: "%" },
  { key: "unit_share", label: "Unit share %", suffix: "%" },
  { key: "index_price", label: "Índice de precio (base 100)", suffix: "" },
];

function pivot(rows: MercadoRow[], brands: string[], metric: "value_share" | "unit_share" | "index_price"): BrandChartPoint[] {
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
          Evolución de Value share, Unit share e Índice de precio — Drean vs competencia, por categoría y segmento. Fuente: Euromonitor (<code>mercado_share</code>).
        </p>
      </header>

      {rows.length === 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
          Sin datos de mercado todavía. Aplicá la migración <code>0053_mercado_share.sql</code> y cargá el seed (<code>supabase/seed/mercado_lavado.sql</code>). Esta misma data alimenta el Objetivo 4 del dash de Objetivos.
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
                    <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: PALETTE[i % PALETTE.length] }} />{b}
                  </span>
                ))}
              </div>
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
              {METRICS.map((m) => (
                <div key={m.key}>
                  <div className="mb-1 text-xs font-medium text-muted-foreground">{m.label}</div>
                  <MercadoBrandChart data={pivot(grp, brands, m.key)} brands={brands} suffix={m.suffix} />
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
