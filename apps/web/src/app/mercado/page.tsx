import { getMercadoRows, mesLabel, type MercadoRow } from "@/lib/mercado-queries";
import { MercadoBrandChart, type BrandChartPoint } from "@/components/mercado/mercado-brand-chart";
import { MercadoStackedBars, type StackedPoint } from "@/components/mercado/mercado-stacked-bars";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const PALETTE = [
  "#ec4899", "#22c55e", "#f59e0b", "#a855f7", "#06b6d4", "#84cc16", "#f43f5e",
  "#0ea5e9", "#eab308", "#14b8a6", "#8b5cf6", "#f97316", "#64748b", "#94a3b8",
];
const HIGHLIGHT = "#2b4dff";

type MetricKey = "value_share" | "unit_share" | "index_price";
const METRICS: Array<{ key: MetricKey; label: string; short: string; suffix: string; deltaUnit: string }> = [
  { key: "value_share", label: "Value share %", short: "Value Share", suffix: "%", deltaUnit: " pts" },
  { key: "unit_share", label: "Unit share %", short: "Unit Share", suffix: "%", deltaUnit: " pts" },
  { key: "index_price", label: "Índice de precio (base 100)", short: "Índice de Precio", suffix: "", deltaUnit: "" },
];

const CAT_ORDER = ["Lavado", "Refrigeración", "Cocción"];
const SEG_ORDER = ["High", "Mid", "Low"];

// Definición de segmentos por categoría.
const SEG_DESC: Record<string, Record<string, string>> = {
  // Lavado: lavarropas automáticos, por capacidad de carga.
  Lavado: { High: "≥ 9 kg", Mid: "8 – 8,9 kg", Low: "< 8 kg" },
  // Refrigeración: heladeras, por tecnología/formato.
  Refrigeración: { High: "Side by Side, Bottom, Multi-Door", Mid: "No Frost resto", Low: "Cíclicas" },
  // Cocción: cocinas, por ancho.
  Cocción: { High: "> 56 cm", Mid: "55 – 56 cm", Low: "< 55 cm" },
};

// Texto del criterio de segmentación por categoría (producto + variable).
const CAT_NOTE: Record<string, string> = {
  Lavado: "(lavarropas automáticos) por capacidad",
  Refrigeración: "(heladeras) por tecnología",
  Cocción: "(cocinas) por ancho",
};

// El dato es MAT (acumulado móvil 12m). U12M = año móvil vs año móvil de hace 12
// meses (variación interanual limpia); U4M/U8M = tendencia más reciente del MAT.
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

// Composición por marca en el primer y último año móvil (MAT) del grupo → barras
// apiladas. Incluye TODAS las marcas para que la pila sume ~100%.
function stackedData(grp: MercadoRow[], metric: MetricKey, allBrands: string[]): StackedPoint[] {
  const months = [...new Set(grp.map((r) => r.mes))].sort();
  if (months.length === 0) return [];
  const ends = months.length > 1 ? [months[0]!, months[months.length - 1]!] : [months[0]!];
  const val = new Map<string, number | null>();
  for (const r of grp) val.set(`${r.mes}__${r.marca}`, r[metric]);
  return ends.map((mes) => {
    const p: StackedPoint = { period: mesLabel(mes) };
    for (const b of allBrands) p[b] = val.get(`${mes}__${b}`) ?? null;
    return p;
  });
}

// Valor por marca en el primer y último año móvil (MAT) → slope chart de 2 puntos.
// Para índice de precio (no es share, no se puede apilar).
function pivotEndpoints(grp: MercadoRow[], brands: string[], metric: MetricKey): BrandChartPoint[] {
  const months = [...new Set(grp.map((r) => r.mes))].sort();
  if (months.length === 0) return [];
  const ends = months.length > 1 ? [months[0]!, months[months.length - 1]!] : [months[0]!];
  const val = new Map<string, number | null>();
  for (const r of grp) if (brands.includes(r.marca)) val.set(`${r.mes}__${r.marca}`, r[metric]);
  return ends.map((mes) => {
    const p: BrandChartPoint = { mes: mesLabel(mes) };
    for (const b of brands) p[b] = val.get(`${mes}__${b}`) ?? null;
    return p;
  });
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

function MoversPanel({ windows, deltaUnit, metricLabel }: { windows: WindowMovers[]; deltaUnit: string; metricLabel: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <div className="mb-2 truncate whitespace-nowrap text-[10px] font-semibold uppercase text-muted-foreground">
        Mayores variaciones · {metricLabel}
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

// Leyenda de marcas con su color. Se repite debajo de cada gráfico.
function BrandLegend({ brands, colorOf }: { brands: string[]; colorOf: Record<string, string> }) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
      {brands.map((b) => (
        <span
          key={b}
          className={`inline-flex items-center gap-1.5 ${b === "DREAN" ? "font-semibold text-foreground" : "text-muted-foreground"}`}
        >
          <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: colorOf[b] }} />
          {b}
        </span>
      ))}
    </div>
  );
}

export default async function MercadoPage({ searchParams }: { searchParams?: { cat?: string; agg?: string } }) {
  const agg: "MAT" | "mensual" = searchParams?.agg === "mensual" ? "mensual" : "MAT";
  const rows = await getMercadoRows(agg);
  const esMAT = agg === "MAT";

  // Categorías presentes en los datos (en orden fijo)
  const present = new Set(rows.map((r) => r.categoria));
  const categorias = [...CAT_ORDER.filter((c) => present.has(c)), ...[...present].filter((c) => !CAT_ORDER.includes(c))];
  const selected = searchParams?.cat && categorias.includes(searchParams.cat) ? searchParams.cat : categorias[0];

  // Agrupar por categoría · segmento, solo la categoría seleccionada
  const groups = new Map<string, MercadoRow[]>();
  for (const r of rows) {
    if (r.categoria !== selected) continue;
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
          costado de cada serie, las marcas con mayor variación en los últimos 4 / 8 / 12 meses. Fuente: GFK (
          <code>mercado_share</code>).
        </p>
        <p className="mt-1 text-xs font-medium text-muted-foreground">
          {esMAT ? (
            <>
              Cada punto del eje es un <strong>MAT</strong>: acumulado móvil de los 12 meses que terminan en ese mes (ej.
              “Abr 26” = May’25–Abr’26).
            </>
          ) : (
            <>
              Cada punto del eje es el <strong>valor del mes</strong> (serie mensual).
            </>
          )}
        </p>
        {SEG_DESC[selected!] && (
          <p className="mt-1 text-xs text-muted-foreground">
            <strong>{selected}</strong> {CAT_NOTE[selected!]}:{" "}
            {SEG_ORDER.filter((s) => SEG_DESC[selected!]![s])
              .map((s) => `${s} ${SEG_DESC[selected!]![s]}`)
              .join(" · ")}
            .
          </p>
        )}
      </header>

      {rows.length === 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
          Sin datos de mercado todavía. Aplicá la migración <code>0053_mercado_share.sql</code> y cargá el seed (
          <code>supabase/seed/mercado_lavado.sql</code>). Esta misma data alimenta el Objetivo 4 del dash de Objetivos.
        </div>
      )}

      {/* Selector de agregación: MAT (acum. 12m) vs Mensual (valor del mes) */}
      <div className="flex flex-wrap items-center gap-2">
        {(["MAT", "mensual"] as const).map((a) => (
          <Link
            key={a}
            href={`/mercado?cat=${encodeURIComponent(selected ?? "")}&agg=${a}`}
            scroll={false}
            className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
              a === agg
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-card text-muted-foreground hover:bg-muted"
            }`}
          >
            {a === "MAT" ? "MAT (12m)" : "Mensual"}
          </Link>
        ))}
      </div>

      {categorias.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {categorias.map((c) => (
            <Link
              key={c}
              href={`/mercado?cat=${encodeURIComponent(c)}&agg=${agg}`}
              scroll={false}
              className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                c === selected
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:bg-muted"
              }`}
            >
              {c}
            </Link>
          ))}
        </div>
      )}

      {[...groups.entries()]
        .sort(([a], [b]) => {
          const sa = SEG_ORDER.indexOf(a.split("__")[1]!);
          const sb = SEG_ORDER.indexOf(b.split("__")[1]!);
          return (sa < 0 ? 99 : sa) - (sb < 0 ? 99 : sb);
        })
        .map(([key, grp]) => {
        const [categoria, segmento] = key.split("__");
        // último mes del grupo → ranking de marcas por value share
        const lastMes = grp.reduce((m, r) => (r.mes > m ? r.mes : m), grp[0]!.mes);
        const allRanked = grp
          .filter((r) => r.mes === lastMes)
          .sort((a, b) => (b.value_share ?? 0) - (a.value_share ?? 0))
          .map((r) => r.marca);
        // Color por marca, compartido entre líneas, barras apiladas y leyenda.
        const colorOf: Record<string, string> = {};
        let pi = 0;
        for (const b of allRanked) colorOf[b] = b === "DREAN" ? HIGHLIGHT : PALETTE[pi++ % PALETTE.length]!;
        // Líneas: Drean + top 6 por value share (legibilidad). Barras: todas.
        const brands = [...new Set(["DREAN", ...allRanked])].filter((b) => allRanked.includes(b)).slice(0, 6);
        if (!brands.includes("DREAN") && allRanked.includes("DREAN")) brands[brands.length - 1] = "DREAN";

        return (
          <section key={key} className="rounded-xl border bg-card p-4">
            <h3 className="mb-3 text-base font-semibold tracking-tight">
              {categoria}{" "}
              <span className="text-sm font-normal text-muted-foreground">
                · segmento {segmento}
                {SEG_DESC[categoria!]?.[segmento!] ? ` (${SEG_DESC[categoria!]![segmento!]})` : ""}
              </span>
            </h3>
            <div className="space-y-6">
              {METRICS.map((m) => {
                const isShare = m.key !== "index_price";
                return (
                  <div key={m.key}>
                    <div className="grid gap-4 lg:grid-cols-[8rem_1fr_15rem]">
                      <div>
                        <div className="mb-1 text-[10px] font-medium text-muted-foreground">
                          {isShare ? `Composición (${esMAT ? "MAT" : "mes"})` : "Inicio vs actual"}
                        </div>
                        {isShare ? (
                          <MercadoStackedBars data={stackedData(grp, m.key, allRanked)} brands={allRanked} colors={colorOf} suffix={m.suffix} />
                        ) : (
                          <MercadoBrandChart data={pivotEndpoints(grp, brands, m.key)} brands={brands} colors={colorOf} suffix={m.suffix} />
                        )}
                      </div>
                      <div>
                        <div className="mb-1 text-xs font-medium text-muted-foreground">{m.label}</div>
                        <MercadoBrandChart data={pivot(grp, brands, m.key)} brands={brands} colors={colorOf} suffix={m.suffix} />
                        <div className="text-[10px] italic text-muted-foreground">
                          {esMAT ? "Cada mes = MAT (acum. móvil 12 meses al mes indicado)" : "Valores mensuales (valor del mes)"}
                        </div>
                        {/* Leyenda pegada justo debajo del gráfico principal */}
                        <BrandLegend brands={allRanked} colorOf={colorOf} />
                      </div>
                      <MoversPanel windows={computeMovers(grp, m.key)} deltaUnit={m.deltaUnit} metricLabel={m.short} />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
