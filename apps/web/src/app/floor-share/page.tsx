import { FloorShareFilters } from "@/components/floor-share/floor-share-filters";
import { FloorShareBrandRanking, FloorShareWeeklyChart } from "@/components/floor-share/floor-share-charts";
import { LastUpdated } from "@/components/last-updated";
import { maxUpdatedAt } from "@/lib/freshness-queries";
import { colorForBrand } from "@/lib/floor-share-colors";
import {
  computeOverall,
  FS_OBJ_PCT,
  normalizeCategoria,
  OWN_BRAND_FS,
  type CategoryBlock,
  type FloorShareFilter,
} from "@/lib/floor-share-queries";
import { getFloorShareRowsFast, getTiendaClienteMapFast, getAvailableWeeksFast, getFsPrecomputed } from "@/lib/cb-mirror";
import { computeFsView, isFsDefault, type FsView, type FsEnrichedRow } from "@/lib/fs-view";
import { MetaPanel } from "@/components/metas/meta-panel";
import { KpiObjCard } from "@/components/trade/kpi-obj-card";
import { NavTimer } from "@/components/nav-timer";
import { CATEGORIA_PESOS, CATEGORIAS_CORE } from "@/lib/categorias";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
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
  const t0 = Date.now(); // instrumentación temporal (server-timing en el header)
  const filter: FloorShareFilter = {
    meses: paramArr(searchParams, "meses"),
    semanas: paramArr(searchParams, "semanas").map(Number).filter((n) => !isNaN(n)),
    categorias: paramArr(searchParams, "categorias"),
    clientes: paramArr(searchParams, "clientes"),
    tiendas: paramArr(searchParams, "tiendas"),
  };

  // Vista DEFAULT (sin filtros) → se lee PRECALCULADA (fs_precomputed, instantáneo).
  // Con filtros activos → se computa sobre el mirror (fetch + agregación).
  let view: FsView | null = null;
  let fetchError: string | null = null;
  let readMs = 0;

  if (isFsDefault(filter)) view = await getFsPrecomputed();

  if (!view) {
    try {
      let semanas = filter.semanas ?? [];
      if (semanas.length === 0) {
        const { weeks } = await getAvailableWeeksFast();
        semanas = weeks.slice(0, 26);
      }
      const [rawRows, clienteMap] = await Promise.all([getFloorShareRowsFast(semanas), getTiendaClienteMapFast()]);
      readMs = Date.now() - t0;
      const enriched: FsEnrichedRow[] = rawRows
        .filter((r) => r.marca != null && r.categoria != null && r.numero_tienda != null && r.semana != null)
        .map((r) => ({ ...r, cliente: clienteMap.get(r.numero_tienda) ?? "Sin cliente" }));
      view = computeFsView(enriched, filter);
    } catch (err) {
      fetchError = err instanceof Error ? err.message : String(err);
    }
  }

  const v: FsView = view ?? {
    options: { meses: [], semanas: [], categorias: [], clientes: [], tiendas: [] },
    totalRanking: [], catBrand: [], cats: [], byTienda: [], byCliente: [],
    overall: computeOverall([]), top5: [], weekly: [], totalTiendasRelevadas: 0, hasData: false,
  };
  const { options, totalRanking, catBrand, cats, byTienda, byCliente, overall, top5, weekly, totalTiendasRelevadas, hasData } = v;

  const aggMs = Date.now() - t0 - readMs;
  const lastUpdated = await maxUpdatedAt("floor_share", "cb").catch(() => null);
  const serverMs = Date.now() - t0;

  // Objetivo general ponderado (Σ obj_cat × peso / Σ peso) para el card general.
  const genObj = (() => {
    const p = CATEGORIA_PESOS as Record<string, number>;
    const items: Array<[number, number]> = [
      [FS_OBJ_PCT.lavado, p.Lavado ?? 0], [FS_OBJ_PCT.refri, p["Refrigeración"] ?? 0], [FS_OBJ_PCT.coccion, p["Cocción"] ?? 0],
    ];
    const wsum = items.reduce((s, [, w]) => s + w, 0) || 1;
    return items.reduce((s, [o, w]) => s + o * w, 0) / wsum;
  })();

  return (
    <div className="space-y-4">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight">Floor Share</h2>
        <p className="text-sm text-muted-foreground">
          Share de góndola por categoría · Ranking de marcas · Evolución mensual.
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <LastUpdated date={lastUpdated} />
          <NavTimer path="/floor-share" />
          <span className="font-mono text-[10px] text-muted-foreground/60" title="Cómputo server (no incluye cold start ni red)">
            server {serverMs}ms (read {readMs} · agg {aggMs})
          </span>
        </div>
      </header>

      <MetaPanel
        plan="Floor Share"
        catPesos={CATEGORIA_PESOS}
        titulo="Metas de Floor Share"
        subtitulo="Cargá la meta mensual POR CATEGORÍA (Lavado/Refrigeración/Cocción). El Floor Share general se calcula solo (Σ categoría × peso). Alimenta el rollup de objetivos del Seguimiento."
        kpis={[{ nombre: "Floor Share (exhibición)", unidad: "%", categorias: [...CATEGORIAS_CORE] }]}
      />

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
            <KpiObjCard
              title="Floor Share — general" medida="Drean · todas las categorías" value={overall.total.share} obj={Number(genObj.toFixed(1))}
              contexto={`${overall.total.drean_units.toLocaleString()} / ${overall.total.total_units.toLocaleString()} · ${totalTiendasRelevadas} tiendas`}
            />
            <KpiObjCard title="Lavado" medida="Share Drean góndola" value={overall.lavado.share} obj={FS_OBJ_PCT.lavado}
              contexto={`${overall.lavado.drean_units.toLocaleString()} / ${overall.lavado.total_units.toLocaleString()}`} />
            <KpiObjCard title="Refrigeración" medida="Share Drean góndola" value={overall.refri.share} obj={FS_OBJ_PCT.refri}
              contexto={`${overall.refri.drean_units.toLocaleString()} / ${overall.refri.total_units.toLocaleString()}`} />
            <KpiObjCard title="Cocción" medida="Share Drean góndola" value={overall.coccion.share} obj={FS_OBJ_PCT.coccion}
              contexto={`${overall.coccion.drean_units.toLocaleString()} / ${overall.coccion.total_units.toLocaleString()}`} />
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
                    <tr className="border-b bg-muted/40 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
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
          <thead className="border-b bg-muted/40 text-muted-foreground">
            <tr>
              <th rowSpan={2} className="border-r border-border px-3 py-2 text-left align-bottom">Cliente</th>
              <th colSpan={2} className="border-r border-border px-3 py-1 text-center text-[11px] uppercase tracking-wide">FS Lavado</th>
              <th colSpan={2} className="hidden border-r border-border px-3 py-1 text-center text-[11px] uppercase tracking-wide md:table-cell">FS Refri</th>
              <th colSpan={2} className="hidden px-3 py-1 text-center text-[11px] uppercase tracking-wide md:table-cell">FS Cocción</th>
            </tr>
            <tr className="text-[10px] uppercase tracking-wide">
              <th className="px-2 py-1 text-center">%</th>
              <th className="border-r border-border px-2 py-1 text-right">Δ</th>
              <th className="hidden px-2 py-1 text-center md:table-cell">%</th>
              <th className="hidden border-r border-border px-2 py-1 text-right md:table-cell">Δ</th>
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
          <thead className="border-b bg-muted/40 text-muted-foreground">
            <tr>
              <th rowSpan={2} className="border-r border-border px-3 py-2 text-left align-bottom">Tienda</th>
              <th colSpan={2} className="border-r border-border px-3 py-1 text-center text-[11px] uppercase tracking-wide">FS Lavado</th>
              <th colSpan={2} className="hidden border-r border-border px-3 py-1 text-center text-[11px] uppercase tracking-wide md:table-cell">FS Refri</th>
              <th colSpan={2} className="hidden px-3 py-1 text-center text-[11px] uppercase tracking-wide md:table-cell">FS Cocción</th>
            </tr>
            <tr className="text-[10px] uppercase tracking-wide">
              <th className="px-2 py-1 text-center">%</th>
              <th className="border-r border-border px-2 py-1 text-right">Δ</th>
              <th className="hidden px-2 py-1 text-center md:table-cell">%</th>
              <th className="hidden border-r border-border px-2 py-1 text-right md:table-cell">Δ</th>
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
