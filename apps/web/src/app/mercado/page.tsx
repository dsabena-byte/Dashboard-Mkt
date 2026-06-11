import { getMercadoSeries, mesLabel, type MercadoPoint } from "@/lib/mercado-queries";
import { MercadoLineChart, type MercadoSeriesPoint } from "@/components/mercado/mercado-line-chart";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const CATS = ["Lavado", "Refrigeración", "Cocción"] as const;

// Leyenda de segmentos (compartida)
function SegLegend() {
  const items: Array<[string, string]> = [
    ["High", "#2b4dff"],
    ["Mid", "#22c55e"],
    ["Low", "#f59e0b"],
  ];
  return (
    <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
      {items.map(([label, color]) => (
        <span key={label} className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
          {label}
        </span>
      ))}
    </div>
  );
}

function toSeries(rows: MercadoPoint[], kind: "sv" | "idx"): MercadoSeriesPoint[] {
  return rows.map((r) => ({
    mes: mesLabel(r.mes),
    High: kind === "sv" ? r.svHigh : r.idxHigh,
    Mid: kind === "sv" ? r.svMid : r.idxMid,
    Low: kind === "sv" ? r.svLow : r.idxLow,
  }));
}

export default async function MercadoPage() {
  const series = await getMercadoSeries();
  const byCat = new Map<string, MercadoPoint[]>();
  for (const r of series) {
    const arr = byCat.get(r.categoria);
    if (arr) arr.push(r);
    else byCat.set(r.categoria, [r]);
  }

  return (
    <div className="space-y-5">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight">Análisis de Mercado</h2>
        <p className="text-sm text-muted-foreground">
          Evolución mensual del Share value e Índice de precio por categoría y segmento (High / Mid / Low). Fuente: <code>mercado_categoria</code>.
        </p>
      </header>

      {series.length === 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
          Sin datos de mercado todavía. Aplicá la migración <code>0052_mercado_categoria.sql</code> y cargá los valores (share value e índice de precio por segmento). Esta misma data alimenta el Objetivo 4 del dashboard de Objetivos.
        </div>
      )}

      {CATS.map((cat) => {
        const rows = byCat.get(cat) ?? [];
        return (
          <section key={cat} className="rounded-xl border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-semibold tracking-tight">{cat}</h3>
              <SegLegend />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <div className="mb-1 text-xs font-medium text-muted-foreground">Share value % por segmento</div>
                <MercadoLineChart data={toSeries(rows, "sv")} suffix="%" />
              </div>
              <div>
                <div className="mb-1 text-xs font-medium text-muted-foreground">Índice de precio (base 100) por segmento</div>
                <MercadoLineChart data={toSeries(rows, "idx")} />
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
