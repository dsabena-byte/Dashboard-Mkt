import { FloorShareFilters } from "@/components/floor-share/floor-share-filters";
import { FloorShareBrandRanking, FloorShareWeeklyChart } from "@/components/floor-share/floor-share-charts";
import { LastUpdated } from "@/components/last-updated";
import { maxUpdatedAt } from "@/lib/freshness-queries";
import { colorForBrand } from "@/lib/floor-share-colors";
import {
  computeOverall,
  FS_OBJ_PCT,
  getAvailableWeeks,
  getFloorShareRows,
  getTiendaClienteMap,
  getTotalTiendasRelevadas,
  shareByBrand,
  shareByCatBrand,
  shareByCliente,
  shareByTienda,
  weeklyShareByBrand,
  normalizeCategoria,
  OWN_BRAND_FS,
  type CategoryBlock,
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
  };

  // Por performance: si no hay semanas seleccionadas, limitamos el universo
  // a las últimas 26 semanas con data (≈6 meses) para abarcar todas las
  // tiendas activas. Si el user selecciona semanas/meses, fetcheamos solo esas.
  async function fetchRows(): Promise<{ rows: FloorShareRow[]; error: string | null; weeks_used: number[]; weeks_debug: string }> {
    try {
      const baseFilter: FloorShareFilter = { ...filter };
      let weeks_used: number[] = baseFilter.semanas ?? [];
      let weeks_debug = "filter-provided";
      if (!baseFilter.semanas || baseFilter.semanas.length === 0) {
        const { weeks, debug } = await getAvailableWeeks();
        weeks_used = weeks.slice(0, 26);
        baseFilter.semanas = weeks_used;
        weeks_debug = debug;
      }
      const data = await getFloorShareRows({ semanas: baseFilter.semanas });
      return { rows: data, error: null, weeks_used, weeks_debug };
    } catch (err) {
      return { rows: [], error: err instanceof Error ? err.message : String(err), weeks_used: [], weeks_debug: "exception" };
    }
  }

  const [
    { rows: allRowsRaw, error: fetchError },
    clienteMap,
    totalTiendasRelevadas,
  ] = await Promise.all([
    fetchRows(),
    getTiendaClienteMap(),
    getTotalTiendasRelevadas(),
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
  };

  const totalRanking = shareByBrand(rows);
  const catBrand = shareByCatBrand(rows);
  const byTienda = shareByTienda(rows);
  const byCliente = shareByCliente(rows);
  const overall = computeOverall(rows);

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
  const lastUpdated = await maxUpdatedAt("floor_share", "cb").catch(() => null);

  return (
    <div className="space-y-4">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight">Floor Share</h2>
        <p className="text-sm text-muted-foreground">
          Share de góndola por categoría · Ranking de marcas · Evolución mensual.
        </p>
        <LastUpdated date={lastUpdated} className="mt-1" />
      </header>

      <FloorShareFilters current={filter} options={options} />

      {fetchError && (
        <div className="rounded-lg border bg-rose-50 p-4 text-xs text-rose-900">
          <strong>Error cargando floor_share:</strong> <code>{fetchError}</code>
        </div>
      )}

      {!hasData ? (
        <div className="rounded-lg border bg-amber-50 p-4 text-sm text-amber-900">
          Sin datos para los filtros seleccionados.
        </div>
      ) : (
        <>
          <section className="grid gap-3 lg:grid-cols-4">
            <div className="rounded-xl bg-[#0a1849] p-5 text-white">
              <div className="text-[10px] font-semibold uppercase tracking-wide opacity-80">
                Floor Share Drean — Todas las categorías
              </div>
              <div className="mt-2 text-4xl font-bold text-rose-300">
                {overall.total.share.toFixed(1)}%
              </div>
              <div className="mt-2 text-[11px] opacity-80">
                {totalTiendasRelevadas} tiendas relevadas · {overall.total.drean_units.toLocaleString()} unidades exhibidas / {overall.total.total_units.toLocaleString()} total piso
              </div>
            </div>
            <CategoryCard label="Cocción" obj={FS_OBJ_PCT.coccion} block={overall.coccion} />
            <CategoryCard label="Lavado" obj={FS_OBJ_PCT.lavado} block={overall.lavado} />
            <CategoryCard label="Refrigeración" obj={FS_OBJ_PCT.refri} block={overall.refri} />
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

          <ClienteTable rows={byCliente} />
          <TiendaTable rows={byTienda} />
        </>
      )}
    </div>
  );
}

// ===== Helpers de render =====

function CategoryCard({ label, obj, block }: { label: string; obj: number; block: CategoryBlock }) {
  const delta = block.share - obj;
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-3xl font-bold text-rose-500">{block.share.toFixed(1)}%</div>
      <div className="mt-1 text-[11px] text-muted-foreground tabular-nums">
        {block.drean_units.toLocaleString()} / {block.total_units.toLocaleString()}
      </div>
      <div className="mt-3 border-t pt-2 text-[11px] flex items-center justify-between">
        <span className="text-muted-foreground">Obj {obj}%</span>
        <span className={`rounded-full px-2 py-0.5 font-semibold tabular-nums ${delta >= 0 ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
          {delta >= 0 ? "+" : ""}{delta.toFixed(1)} pp
        </span>
      </div>
    </div>
  );
}

function pctCellBg(pct: number | null, obj: number): string {
  if (pct == null || pct === 0) return "bg-muted/30 text-muted-foreground";
  if (pct >= obj) return "bg-emerald-50 text-emerald-700 font-semibold";
  if (pct >= obj - 5) return "bg-amber-50 text-amber-700 font-semibold";
  return "bg-rose-50 text-rose-600 font-semibold";
}

function deltaClassFs(value: number): string {
  return value >= 0 ? "text-emerald-600" : "text-rose-500";
}

function deltaPpFs(value: number, obj: number): string {
  const diff = value - obj;
  const arrow = diff >= 0 ? "↑" : "↓";
  return `${diff >= 0 ? "+" : ""}${diff.toFixed(0)} pp ${arrow}`;
}

function CategoriaCols({ block, obj }: { block: CategoryBlock; obj: number }) {
  return (
    <>
      <td className={`px-3 py-1.5 text-center tabular-nums ${pctCellBg(block.share, obj)}`}>
        {block.total_units > 0 ? `${block.share.toFixed(0)}%` : "—"}
      </td>
      <td className={`px-3 py-1.5 text-right tabular-nums ${deltaClassFs(block.share - obj)}`}>
        {block.total_units > 0 ? deltaPpFs(block.share, obj) : ""}
      </td>
    </>
  );
}

function ClienteTable({ rows }: { rows: import("@/lib/floor-share-queries").ClienteShare[] }) {
  return (
    <section className="rounded-xl border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3">
        <h3 className="text-sm font-bold">🏢 Performance por cliente</h3>
        <span className="text-[11px] text-muted-foreground">Δ vs objetivo</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-[#0a1849] text-white">
            <tr>
              <th rowSpan={2} className="border-r border-white/10 px-3 py-2 text-left align-bottom">Cliente</th>
              <th colSpan={2} className="border-r border-white/10 px-3 py-1 text-center text-[11px] uppercase tracking-wide">FS Lavado</th>
              <th colSpan={2} className="hidden border-r border-white/10 px-3 py-1 text-center text-[11px] uppercase tracking-wide md:table-cell">FS Refri</th>
              <th colSpan={2} className="hidden px-3 py-1 text-center text-[11px] uppercase tracking-wide md:table-cell">FS Cocción</th>
            </tr>
            <tr className="text-[10px] uppercase tracking-wide opacity-80">
              <th className="px-2 py-1 text-center">%</th>
              <th className="border-r border-white/10 px-2 py-1 text-right">Δ</th>
              <th className="hidden px-2 py-1 text-center md:table-cell">%</th>
              <th className="hidden border-r border-white/10 px-2 py-1 text-right md:table-cell">Δ</th>
              <th className="hidden px-2 py-1 text-center md:table-cell">%</th>
              <th className="hidden px-2 py-1 text-right md:table-cell">Δ</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.cliente} className="border-b last:border-0">
                <td className="px-3 py-1.5 font-medium">{r.cliente}</td>
                <CategoriaCols block={r.lavado} obj={FS_OBJ_PCT.lavado} />
                <td className={`hidden px-3 py-1.5 text-center tabular-nums md:table-cell ${pctCellBg(r.refri.share, FS_OBJ_PCT.refri)}`}>
                  {r.refri.total_units > 0 ? `${r.refri.share.toFixed(0)}%` : "—"}
                </td>
                <td className={`hidden border-r border-border px-3 py-1.5 text-right tabular-nums md:table-cell ${deltaClassFs(r.refri.share - FS_OBJ_PCT.refri)}`}>
                  {r.refri.total_units > 0 ? deltaPpFs(r.refri.share, FS_OBJ_PCT.refri) : ""}
                </td>
                <td className={`hidden px-3 py-1.5 text-center tabular-nums md:table-cell ${pctCellBg(r.coccion.share, FS_OBJ_PCT.coccion)}`}>
                  {r.coccion.total_units > 0 ? `${r.coccion.share.toFixed(0)}%` : "—"}
                </td>
                <td className={`hidden px-3 py-1.5 text-right tabular-nums md:table-cell ${deltaClassFs(r.coccion.share - FS_OBJ_PCT.coccion)}`}>
                  {r.coccion.total_units > 0 ? deltaPpFs(r.coccion.share, FS_OBJ_PCT.coccion) : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function TiendaTable({ rows }: { rows: import("@/lib/floor-share-queries").TiendaShare[] }) {
  return (
    <section className="rounded-xl border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3">
        <h3 className="text-sm font-bold">📋 Performance por tienda</h3>
        <span className="text-[11px] text-muted-foreground">Δ vs objetivo</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-[#0a1849] text-white">
            <tr>
              <th rowSpan={2} className="border-r border-white/10 px-3 py-2 text-left align-bottom">Tienda</th>
              <th colSpan={2} className="border-r border-white/10 px-3 py-1 text-center text-[11px] uppercase tracking-wide">FS Lavado</th>
              <th colSpan={2} className="hidden border-r border-white/10 px-3 py-1 text-center text-[11px] uppercase tracking-wide md:table-cell">FS Refri</th>
              <th colSpan={2} className="hidden px-3 py-1 text-center text-[11px] uppercase tracking-wide md:table-cell">FS Cocción</th>
            </tr>
            <tr className="text-[10px] uppercase tracking-wide opacity-80">
              <th className="px-2 py-1 text-center">%</th>
              <th className="border-r border-white/10 px-2 py-1 text-right">Δ</th>
              <th className="hidden px-2 py-1 text-center md:table-cell">%</th>
              <th className="hidden border-r border-white/10 px-2 py-1 text-right md:table-cell">Δ</th>
              <th className="hidden px-2 py-1 text-center md:table-cell">%</th>
              <th className="hidden px-2 py-1 text-right md:table-cell">Δ</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.numero_tienda} className="border-b last:border-0">
                <td className="px-3 py-1.5">
                  <span className="text-muted-foreground">{r.cliente}</span>
                  {" — "}
                  <span className="font-medium">{r.numero_tienda} - {r.nombre_tienda}</span>
                </td>
                <CategoriaCols block={r.lavado} obj={FS_OBJ_PCT.lavado} />
                <td className={`hidden px-3 py-1.5 text-center tabular-nums md:table-cell ${pctCellBg(r.refri.share, FS_OBJ_PCT.refri)}`}>
                  {r.refri.total_units > 0 ? `${r.refri.share.toFixed(0)}%` : "—"}
                </td>
                <td className={`hidden border-r border-border px-3 py-1.5 text-right tabular-nums md:table-cell ${deltaClassFs(r.refri.share - FS_OBJ_PCT.refri)}`}>
                  {r.refri.total_units > 0 ? deltaPpFs(r.refri.share, FS_OBJ_PCT.refri) : ""}
                </td>
                <td className={`hidden px-3 py-1.5 text-center tabular-nums md:table-cell ${pctCellBg(r.coccion.share, FS_OBJ_PCT.coccion)}`}>
                  {r.coccion.total_units > 0 ? `${r.coccion.share.toFixed(0)}%` : "—"}
                </td>
                <td className={`hidden px-3 py-1.5 text-right tabular-nums md:table-cell ${deltaClassFs(r.coccion.share - FS_OBJ_PCT.coccion)}`}>
                  {r.coccion.total_units > 0 ? deltaPpFs(r.coccion.share, FS_OBJ_PCT.coccion) : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
