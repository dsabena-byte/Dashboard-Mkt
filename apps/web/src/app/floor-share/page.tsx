import { KpiCard } from "@/components/kpi-card";
import { FloorShareFilters } from "@/components/floor-share/floor-share-filters";
import { FloorShareBrandRanking, FloorShareWeeklyChart } from "@/components/floor-share/floor-share-charts";
import { colorForBrand } from "@/lib/floor-share-colors";
import {
  getAvailableWeeks,
  getFloorShareRows,
  getTiendaClienteMap,
  shareByBrand,
  shareByCatBrand,
  shareByCliente,
  shareByTienda,
  weeklyShareByBrand,
  normalizeCategoria,
  OWN_BRAND_FS,
  type FloorShareFilter,
  type FloorShareRow,
} from "@/lib/floor-share-queries";
import { isoWeekToMes } from "@/lib/cb-queries";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface PageProps {
  searchParams: Record<string, string | string[] | undefined>;
}

function paramArr(searchParams: PageProps["searchParams"], key: string): string[] {
  const v = searchParams[key];
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

function cellBg(pct: number | null): string {
  if (pct == null) return "text-muted-foreground";
  if (pct >= 30) return "bg-emerald-50 text-emerald-700 font-semibold";
  if (pct >= 15) return "bg-amber-50 text-amber-700 font-semibold";
  return "bg-rose-50 text-rose-600 font-semibold";
}

export default async function FloorSharePage({ searchParams }: PageProps) {
  try {
    return await renderFloorShare(searchParams);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack ?? "" : "";
    return (
      <div className="space-y-4">
        <header>
          <h2 className="text-2xl font-semibold tracking-tight">Floor Share</h2>
          <p className="text-sm text-muted-foreground">
            Share de góndola por categoría · Ranking de marcas · Evolución mensual.
          </p>
        </header>
        <div className="rounded-lg border bg-rose-50 p-4 text-xs text-rose-900">
          <strong>Render error:</strong>
          <pre className="mt-2 whitespace-pre-wrap break-words text-[10px]">{message}</pre>
          {stack && (
            <details className="mt-2">
              <summary className="cursor-pointer text-[10px]">stack</summary>
              <pre className="mt-1 whitespace-pre-wrap break-words text-[9px]">{stack}</pre>
            </details>
          )}
        </div>
      </div>
    );
  }
}

async function renderFloorShare(searchParams: PageProps["searchParams"]) {
  const filter: FloorShareFilter = {
    meses: paramArr(searchParams, "meses"),
    semanas: paramArr(searchParams, "semanas").map(Number).filter((n) => !isNaN(n)),
    categorias: paramArr(searchParams, "categorias"),
    clientes: paramArr(searchParams, "clientes"),
    tiendas: paramArr(searchParams, "tiendas"),
    marcas: paramArr(searchParams, "marcas"),
  };

  // Por performance: si no hay semanas seleccionadas, limitamos el universo
  // a las últimas 12 semanas con data (de 70K rows totales). Si el user
  // selecciona semanas/meses, fetcheamos solo esas.
  async function fetchRows(): Promise<{ rows: FloorShareRow[]; error: string | null; weeks_used: number[]; weeks_debug: string }> {
    try {
      const baseFilter: FloorShareFilter = { ...filter };
      let weeks_used: number[] = baseFilter.semanas ?? [];
      let weeks_debug = "filter-provided";
      if (!baseFilter.semanas || baseFilter.semanas.length === 0) {
        const { weeks, debug } = await getAvailableWeeks();
        weeks_used = weeks.slice(0, 12);
        baseFilter.semanas = weeks_used;
        weeks_debug = debug;
      }
      const data = await getFloorShareRows({ semanas: baseFilter.semanas });
      return { rows: data, error: null, weeks_used, weeks_debug };
    } catch (err) {
      return { rows: [], error: err instanceof Error ? err.message : String(err), weeks_used: [], weeks_debug: "exception" };
    }
  }

  const [{ rows: allRowsRaw, error: fetchError, weeks_used, weeks_debug }, clienteMap] = await Promise.all([
    fetchRows(),
    getTiendaClienteMap(),
  ]);

  // Filtramos rows con campos críticos null antes de cualquier aggregation.
  // Cualquier null en marca/categoria/numero_tienda rompía las agregaciones.
  // Y enriquecemos cada row con cliente derivado del map (cb_visitas).
  type EnrichedRow = FloorShareRow & { cliente: string };
  const allRows: EnrichedRow[] = allRowsRaw
    .filter((r) => r.marca != null && r.categoria != null && r.numero_tienda != null && r.semana != null)
    .map((r) => ({ ...r, cliente: clienteMap.get(r.numero_tienda) ?? "Sin cliente" }));

  function applyFilter(rs: EnrichedRow[], f: FloorShareFilter): EnrichedRow[] {
    return rs.filter((r) => {
      if (r.semana == null) return false;
      if (f.meses && f.meses.length > 0 && !f.meses.includes(isoWeekToMes(r.semana))) return false;
      if (f.semanas && f.semanas.length > 0 && !f.semanas.includes(r.semana)) return false;
      if (f.categorias && f.categorias.length > 0 && !f.categorias.includes(normalizeCategoria(r.categoria ?? ""))) return false;
      if (f.clientes && f.clientes.length > 0 && !f.clientes.includes(r.cliente)) return false;
      if (f.tiendas && f.tiendas.length > 0 && !f.tiendas.includes(r.numero_tienda ?? "")) return false;
      if (f.marcas && f.marcas.length > 0 && !f.marcas.includes(r.marca ?? "")) return false;
      return true;
    });
  }

  const rows = applyFilter(allRows, filter);

  const uniq = <T,>(arr: (T | null | undefined)[]): T[] =>
    [...new Set(arr.filter((x): x is T => x != null))];

  const MES_ORDER = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

  const options = {
    meses: uniq(applyFilter(allRows, { ...filter, meses: [] }).map((r) => isoWeekToMes(r.semana)))
      .sort((a, b) => MES_ORDER.indexOf(a) - MES_ORDER.indexOf(b)),
    semanas: uniq(applyFilter(allRows, { ...filter, semanas: [] }).map((r) => r.semana)).sort((a, b) => a - b),
    categorias: uniq(applyFilter(allRows, { ...filter, categorias: [] }).map((r) => normalizeCategoria(r.categoria))).sort(),
    clientes: uniq(applyFilter(allRows, { ...filter, clientes: [] }).map((r) => r.cliente)).sort(),
    tiendas: uniq(applyFilter(allRows, { ...filter, tiendas: [] })
      .map((r) => ({ value: r.numero_tienda, label: r.nombre_tienda ?? r.numero_tienda })))
      .filter((v, i, arr) => arr.findIndex((x) => x.value === v.value) === i)
      .sort((a, b) => a.label.localeCompare(b.label, "es", { sensitivity: "base" })),
    marcas: uniq(applyFilter(allRows, { ...filter, marcas: [] }).map((r) => r.marca)).sort(),
  };

  const totalRanking = shareByBrand(rows);
  const dreanRank = totalRanking.findIndex((r) => r.marca === OWN_BRAND_FS);
  const dreanShare = totalRanking.find((r) => r.marca === OWN_BRAND_FS)?.share ?? 0;
  const catBrand = shareByCatBrand(rows);
  const byTienda = shareByTienda(rows);
  const byCliente = shareByCliente(rows);
  const totalUnidades = rows.reduce((s, r) => s + (r.unidades ?? 0), 0);
  const totalTiendas = new Set(rows.map((r) => r.numero_tienda)).size;
  const totalMarcas = new Set(rows.map((r) => r.marca)).size;

  // Top 5 marcas para el chart semanal
  const top5 = totalRanking.slice(0, 5).map((r) => r.marca);
  // Drean siempre incluido aunque no esté en top 5
  if (!top5.includes(OWN_BRAND_FS) && rows.some((r) => r.marca === OWN_BRAND_FS)) {
    top5.unshift(OWN_BRAND_FS);
  }
  const weekly = weeklyShareByBrand(rows, top5);

  // Share por categoría — agrupado para la tabla
  const cats = uniq(rows.map((r) => normalizeCategoria(r.categoria))).sort();

  const hasData = rows.length > 0;

  return (
    <div className="space-y-4">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight">Floor Share</h2>
        <p className="text-sm text-muted-foreground">
          Share de góndola por categoría · Ranking de marcas · Evolución mensual.
        </p>
      </header>

      <FloorShareFilters current={filter} options={options} />

      {fetchError && (
        <div className="rounded-lg border bg-rose-50 p-4 text-xs text-rose-900">
          <strong>Error cargando floor_share:</strong> <code>{fetchError}</code>
        </div>
      )}

      <div className="rounded-lg border bg-sky-50 p-2 text-[11px] text-sky-900">
        debug: {allRows.length} rows fetched · weeks_used = [{weeks_used.join(", ") || "ninguna"}] · rows filtrados = {rows.length} · weeks_debug = {weeks_debug}
      </div>

      {!hasData ? (
        <div className="rounded-lg border bg-amber-50 p-4 text-sm text-amber-900">
          Sin datos para los filtros seleccionados.
        </div>
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              title="Share Drean"
              value={`${dreanShare.toFixed(1)}%`}
              hint={`Ranking #${dreanRank + 1} de ${totalRanking.length} marcas`}
            />
            <KpiCard
              title="Unidades en góndola"
              value={totalUnidades.toLocaleString()}
              hint="Suma del período / filtro"
            />
            <KpiCard
              title="Tiendas auditadas"
              value={String(totalTiendas)}
              hint="con presencia"
            />
            <KpiCard
              title="Marcas activas"
              value={String(totalMarcas)}
              hint="en góndola"
            />
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border bg-card p-4">
              <h3 className="mb-3 text-sm font-bold">🏆 Ranking de marcas (share total)</h3>
              <FloorShareBrandRanking data={totalRanking.slice(0, 12)} highlight={OWN_BRAND_FS} />
            </div>
            <div className="rounded-xl border bg-card overflow-hidden">
              <div className="px-4 py-3">
                <h3 className="text-sm font-bold">📊 Share por categoría</h3>
                <p className="text-[11px] text-muted-foreground">Top 5 marcas en cada categoría.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-[#0a1849] text-white text-[11px] uppercase tracking-wide">
                      <th className="px-3 py-2 text-left">Categoría</th>
                      <th className="px-3 py-2 text-left">Marca</th>
                      <th className="px-3 py-2 text-right">Share</th>
                      <th className="px-3 py-2 text-right">Unidades</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cats.flatMap((cat) => {
                      const items = catBrand.filter((r) => normalizeCategoria(r.categoria) === cat).slice(0, 5);
                      return items.map((r, i) => (
                        <tr key={`${cat}-${r.marca}`} className="border-b last:border-0">
                          {i === 0 ? (
                            <td rowSpan={items.length} className="px-3 py-1.5 font-semibold align-top bg-muted/30">{cat}</td>
                          ) : null}
                          <td className="px-3 py-1.5">
                            <span
                              className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle"
                              style={{ backgroundColor: colorForBrand(r.marca) }}
                            />
                            {r.marca}
                            {r.marca === OWN_BRAND_FS && <span className="ml-1 text-rose-500">★</span>}
                          </td>
                          <td className={`px-3 py-1.5 text-right tabular-nums ${cellBg(r.share)}`}>{r.share.toFixed(1)}%</td>
                          <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">{r.unidades.toLocaleString()}</td>
                        </tr>
                      ));
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {weekly.length > 1 && (
            <section className="rounded-xl border bg-card p-4">
              <h3 className="mb-3 text-sm font-bold">📈 Evolución semanal — Top 5 marcas</h3>
              <FloorShareWeeklyChart data={weekly} marcas={top5} />
            </section>
          )}

          <section className="rounded-xl border bg-card overflow-hidden">
            <div className="px-4 py-3">
              <h3 className="text-sm font-bold">🏢 Detalle por Cliente / Cadena — Share Drean</h3>
              <p className="text-[11px] text-muted-foreground">Ordenado por % share Drean descendente.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-[#0a1849] text-white text-[11px] uppercase tracking-wide">
                    <th className="px-3 py-2 text-left">Cliente / Cadena</th>
                    <th className="hidden px-3 py-2 text-right sm:table-cell">Tiendas</th>
                    <th className="px-3 py-2 text-right">Share Drean</th>
                    <th className="hidden px-3 py-2 text-right md:table-cell">Unid. Drean</th>
                    <th className="hidden px-3 py-2 text-right md:table-cell">Total unid.</th>
                  </tr>
                </thead>
                <tbody>
                  {byCliente.map((r) => (
                    <tr key={r.cliente} className="border-b last:border-0">
                      <td className="px-3 py-1.5 font-medium">{r.cliente}</td>
                      <td className="hidden px-3 py-1.5 text-right tabular-nums text-muted-foreground sm:table-cell">{r.tiendas}</td>
                      <td className={`px-3 py-1.5 text-right tabular-nums ${cellBg(r.drean_share)}`}>{r.drean_share.toFixed(1)}%</td>
                      <td className="hidden px-3 py-1.5 text-right tabular-nums md:table-cell">{r.drean_unidades.toLocaleString()}</td>
                      <td className="hidden px-3 py-1.5 text-right tabular-nums text-muted-foreground md:table-cell">{r.total_unidades.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-xl border bg-card overflow-hidden">
            <div className="px-4 py-3">
              <h3 className="text-sm font-bold">🏬 Detalle por Tienda — Share Drean</h3>
              <p className="text-[11px] text-muted-foreground">Top 50 tiendas con mayor share de Drean.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-[#0a1849] text-white text-[11px] uppercase tracking-wide">
                    <th className="px-3 py-2 text-left">#</th>
                    <th className="px-3 py-2 text-left">Tienda</th>
                    <th className="px-3 py-2 text-right">Share Drean</th>
                    <th className="px-3 py-2 text-right">Unid. Drean</th>
                    <th className="px-3 py-2 text-right">Total unid.</th>
                  </tr>
                </thead>
                <tbody>
                  {byTienda.slice(0, 50).map((r) => (
                    <tr key={r.numero_tienda} className="border-b last:border-0">
                      <td className="px-3 py-1.5 text-muted-foreground">{r.numero_tienda}</td>
                      <td className="px-3 py-1.5">{r.nombre_tienda}</td>
                      <td className={`px-3 py-1.5 text-right tabular-nums ${cellBg(r.drean_share)}`}>{r.drean_share.toFixed(1)}%</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{r.drean_unidades.toLocaleString()}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">{r.total_unidades.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
