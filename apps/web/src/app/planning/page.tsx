import { KpiCard } from "@/components/kpi-card";
import { PlanningFilters } from "@/components/planning/planning-filters";
import { DonutChart } from "@/components/planning/donut-chart";
import { StackedBarChart } from "@/components/planning/stacked-bar-chart";
import {
  aggregateByCategoria,
  aggregateBySistemaFormato,
  aggregateCostos,
  aggregateTotals,
  classifyMedio,
  colorFor,
  formatMonthLabel,
  getDefaultMonth,
  getPlanningFilterOptions,
  getPlanningMedia,
  PALETA_CATEGORIA,
  PALETA_FORMATO,
  PALETA_SISTEMA,
} from "@/lib/planning-media-queries";
import type { PlanningMediaRow } from "@/lib/planning-media-queries";
import { formatCurrency, formatNumber } from "@/lib/utils";

interface PageProps {
  searchParams: Record<string, string | string[] | undefined>;
}

function pickParam(v: string | string[] | undefined): string | null {
  if (!v) return null;
  return Array.isArray(v) ? v[0] ?? null : v;
}

function pickArray(v: string | string[] | undefined): string[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

export default async function PlanningPage({ searchParams }: PageProps) {
  const options = await getPlanningFilterOptions();
  const defaultMonth = await getDefaultMonth();

  const mesArr = pickArray(searchParams.mes);
  const mes = mesArr.length > 0 ? mesArr : [defaultMonth];
  const campania = pickArray(searchParams.campania);
  const rol = pickArray(searchParams.rol);
  const sistema = pickArray(searchParams.sistema);
  const medio = pickParam(searchParams.medio) as
    | "Digital" | "TV Cable" | "OOH" | "Costos" | null;

  const rows = await getPlanningMedia({
    fecha: mes,
    campania: campania.length > 0 ? campania : undefined,
    rol: rol.length > 0 ? rol : undefined,
    sistema: sistema.length > 0 ? sistema : undefined,
    medio: medio ?? undefined,
  });

  const totals = aggregateTotals(rows);
  const byCategoria = aggregateByCategoria(rows);
  const bySistemaFormato = aggregateBySistemaFormato(rows);
  const costos = aggregateCostos(rows);

  // Donut 1: Mix ON vs OFF
  const mixOnOff = [
    { name: "Digital", value: totals.digital, color: "#3b82f6" },
    { name: "TV Cable", value: totals.tv, color: "#f43f5e" },
    { name: "OOH", value: totals.ooh, color: "#facc15" },
  ].filter((d) => d.value > 0);

  // Donut 2: Por categoría (solo media)
  const catSums = new Map<string, number>();
  for (const r of rows) {
    if (r.tipo !== "media") continue;
    catSums.set(r.campania, (catSums.get(r.campania) ?? 0) + r.inversion);
  }
  const mixCategoria = [...catSums.entries()]
    .sort(([, a], [, b]) => b - a)
    .map(([name, value]) => ({ name, value, color: colorFor(PALETA_CATEGORIA, name) }));

  // Donut 3: Por plataforma digital
  const sisSums = new Map<string, number>();
  for (const r of rows) {
    if (r.tipo !== "media" || !r.sistema) continue;
    if (classifyMedio(r) !== "Digital") continue;
    sisSums.set(r.sistema, (sisSums.get(r.sistema) ?? 0) + r.inversion);
  }
  const mixSistema = [...sisSums.entries()]
    .sort(([, a], [, b]) => b - a)
    .map(([name, value]) => ({ name, value, color: colorFor(PALETA_SISTEMA, name) }));

  // Stacked bar 1: Sistema × Formato
  const allFormats = new Set<string>();
  for (const s of bySistemaFormato) Object.keys(s.byFormato).forEach((f) => allFormats.add(f));
  const formatList = [...allFormats];
  const sistemaFormatoData = bySistemaFormato.map((s) => {
    const datum: { category: string; [k: string]: string | number } = { category: s.sistema };
    for (const f of formatList) datum[f] = s.byFormato[f] ?? 0;
    return datum;
  });
  const formatoColors = Object.fromEntries(
    formatList.map((f) => [f, colorFor(PALETA_FORMATO, f)]),
  );

  // Bar 2: Build vs Consider por categoría
  const bvcData = byCategoria.map((c) => ({
    category: c.campania,
    Build: c.build,
    Consider: c.consider,
  }));

  // Tabla TV
  const tvRows = rows.filter((r) => classifyMedio(r) === "TV Cable");
  const tvByCanal = new Map<string, PlanningMediaRow[]>();
  for (const r of tvRows) {
    const canal = r.touchpoint ?? r.sistema ?? "Sin canal";
    if (!tvByCanal.has(canal)) tvByCanal.set(canal, []);
    tvByCanal.get(canal)!.push(r);
  }

  // Tabla Digital
  const digitalRows = rows
    .filter((r) => r.tipo === "media" && classifyMedio(r) === "Digital")
    .sort((a, b) => b.inversion - a.inversion);

  const buildVsConsider =
    totals.consider > 0
      ? `${(totals.build / totals.consider).toFixed(1)}x`
      : totals.build > 0
        ? "100% Build"
        : "—";

  const hasData = rows.length > 0;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Pauta · Planning</h2>
          <p className="text-sm text-muted-foreground">
            Drean · ON + OFF + Costos. {mes.length === 1 ? `Mes: ${formatMonthLabel(mes[0]!)}` : `${mes.length} meses seleccionados`}.
          </p>
        </div>
        <div className="text-xs text-muted-foreground">
          {hasData ? `${rows.length} líneas · ${formatCurrency(totals.total)}` : "Sin datos"}
        </div>
      </header>

      <PlanningFilters
        current={{ mes, campania, rol, sistema, medio }}
        options={options}
      />

      {!hasData && (
        <div className="rounded-lg border bg-amber-50 p-4 text-sm text-amber-900">
          <strong>Sin datos de planning todavía.</strong> Aplicá la migración{" "}
          <code>0004_planning_media.sql</code>, configurá el workflow{" "}
          <code>sheets-planning-media-sync</code> en N8N y cargá tu Sheet Pauta-omd con la pauta del mes.
        </div>
      )}

      {/* KPIs */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Inversión total"
          value={formatCurrency(totals.total)}
          hint={mes.length === 1 ? formatMonthLabel(mes[0]!) : `${mes.length} meses`}
        />
        <KpiCard
          title="Digital (ON)"
          value={formatCurrency(totals.digital)}
          hint={totals.total ? `${((totals.digital / totals.total) * 100).toFixed(1)}% del total` : ""}
        />
        <KpiCard
          title="TV Cable"
          value={formatCurrency(totals.tv)}
          hint={totals.total ? `${((totals.tv / totals.total) * 100).toFixed(1)}% del total` : ""}
        />
        <KpiCard
          title="OOH"
          value={formatCurrency(totals.ooh)}
          hint={totals.total ? `${((totals.ooh / totals.total) * 100).toFixed(1)}% del total` : ""}
        />
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Costos adicionales"
          value={formatCurrency(totals.costos)}
          hint={`IIBB ${formatCurrency(costos.iibb)} · Cheque ${formatCurrency(costos.cheque)}`}
        />
        <KpiCard
          title="Mayor categoría"
          value={totals.topCategoria?.nombre ?? "—"}
          hint={totals.topCategoria ? formatCurrency(totals.topCategoria.inversion) : ""}
        />
        <KpiCard
          title="Mayor plataforma"
          value={totals.topSistema?.nombre ?? "—"}
          hint={totals.topSistema ? formatCurrency(totals.topSistema.inversion) : ""}
        />
        <KpiCard
          title="Build vs Consider"
          value={buildVsConsider}
          hint={`${formatCurrency(totals.build)} Build`}
        />
      </section>

      {/* Donuts */}
      <section className="grid gap-4 lg:grid-cols-3">
        <ChartCard title="Mix ON vs OFF">
          <DonutChart data={mixOnOff} />
        </ChartCard>
        <ChartCard title="Por categoría digital">
          <DonutChart data={mixCategoria} />
        </ChartCard>
        <ChartCard title="Por plataforma digital">
          <DonutChart data={mixSistema} />
        </ChartCard>
      </section>

      {/* Stacked bars */}
      <section className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Mix plataformas · formato">
          <StackedBarChart
            data={sistemaFormatoData}
            seriesKeys={formatList}
            seriesColors={formatoColors}
            height={300}
          />
        </ChartCard>
        <ChartCard title="Build vs Consideración por categoría">
          <StackedBarChart
            data={bvcData}
            seriesKeys={["Build", "Consider"]}
            seriesColors={{ Build: "#3b82f6", Consider: "#22c55e" }}
          />
        </ChartCard>
      </section>

      {/* Tabla TV */}
      {tvByCanal.size > 0 && (
        <section className="rounded-lg border bg-card">
          <header className="flex items-center justify-between border-b p-4">
            <h3 className="text-sm font-medium text-muted-foreground">TV Cable · detalle</h3>
            <span className="text-xs font-medium text-red-500">
              Total: {formatCurrency(totals.tv)}
            </span>
          </header>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40">
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2">Canal</th>
                  <th className="px-4 py-2">Formato</th>
                  <th className="px-4 py-2">Campaña</th>
                  <th className="px-4 py-2">Rol</th>
                  <th className="px-4 py-2 text-right">Inversión</th>
                  <th className="px-4 py-2 text-right">%</th>
                </tr>
              </thead>
              <tbody>
                {[...tvByCanal.entries()].map(([canal, items]) => {
                  const subtotal = items.reduce((s, r) => s + r.inversion, 0);
                  return (
                    <>
                      {items.map((r, i) => (
                        <tr key={`${canal}-${i}`} className="border-b last:border-0">
                          <td className="px-4 py-2 font-medium">{i === 0 ? canal : ""}</td>
                          <td className="px-4 py-2 text-muted-foreground">{r.formato ?? "—"}</td>
                          <td className="px-4 py-2">{r.campania}</td>
                          <td className="px-4 py-2 text-muted-foreground">{r.rol ?? "—"}</td>
                          <td className="px-4 py-2 text-right tabular-nums">
                            {formatCurrency(r.inversion)}
                          </td>
                          <td className="px-4 py-2 text-right text-muted-foreground">
                            {totals.tv ? ((r.inversion / totals.tv) * 100).toFixed(1) + "%" : "—"}
                          </td>
                        </tr>
                      ))}
                      <tr className="border-b bg-muted/20 last:border-0">
                        <td className="px-4 py-2 text-xs uppercase tracking-wide text-muted-foreground">
                          Subtotal {canal}
                        </td>
                        <td colSpan={3} />
                        <td className="px-4 py-2 text-right text-sm font-medium">
                          {formatCurrency(subtotal)}
                        </td>
                        <td className="px-4 py-2 text-right text-muted-foreground">
                          {totals.tv ? ((subtotal / totals.tv) * 100).toFixed(1) + "%" : "—"}
                        </td>
                      </tr>
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Tabla Digital */}
      <section className="rounded-lg border bg-card">
        <header className="flex items-center justify-between border-b p-4">
          <h3 className="text-sm font-medium text-muted-foreground">Digital · detalle por línea</h3>
          <span className="text-xs text-muted-foreground">
            {digitalRows.length} líneas · Total: {formatCurrency(totals.digital)}
          </span>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40">
              <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2">Categoría</th>
                <th className="px-4 py-2">Rol</th>
                <th className="px-4 py-2">Plataforma</th>
                <th className="px-4 py-2">Formato</th>
                <th className="px-4 py-2 text-right">Inversión</th>
                <th className="px-4 py-2 text-right">%</th>
                <th className="px-4 py-2">Peso</th>
              </tr>
            </thead>
            <tbody>
              {digitalRows.map((r, i) => {
                const pct = totals.digital ? r.inversion / totals.digital : 0;
                const peso = pct >= 0.05 ? "Alto" : pct >= 0.02 ? "Medio" : "Bajo";
                const pesoCls =
                  peso === "Alto"
                    ? "bg-emerald-100 text-emerald-700"
                    : peso === "Medio"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-red-100 text-red-700";
                return (
                  <tr key={i} className="border-b last:border-0">
                    <td className="px-4 py-2 font-medium">
                      <span className="flex items-center gap-2">
                        <span
                          className="inline-block h-2 w-2 rounded-sm"
                          style={{ backgroundColor: colorFor(PALETA_CATEGORIA, r.campania) }}
                        />
                        {r.campania}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{r.rol ?? "—"}</td>
                    <td className="px-4 py-2">{r.sistema ?? "—"}</td>
                    <td className="px-4 py-2 text-muted-foreground">{r.formato ?? "—"}</td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {formatCurrency(r.inversion)}
                    </td>
                    <td className="px-4 py-2 text-right text-muted-foreground">
                      {formatNumber(pct * 100)}%
                    </td>
                    <td className="px-4 py-2">
                      <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${pesoCls}`}>
                        {peso}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-card p-6">
      <h3 className="mb-4 text-sm font-medium text-muted-foreground">{title}</h3>
      {children}
    </div>
  );
}
