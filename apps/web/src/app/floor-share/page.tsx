import { FloorShareFilters } from "@/components/floor-share/floor-share-filters";
import { FloorShareBrandRanking, FloorShareWeeklyChart } from "@/components/floor-share/floor-share-charts";
import { LastUpdated } from "@/components/last-updated";
import { maxUpdatedAt } from "@/lib/freshness-queries";
import {
  computeOverall,
  OWN_BRAND_FS,
  type CategoryBlock,
  type FloorShareFilter,
} from "@/lib/floor-share-queries";
import { getFloorShareRowsFast, getFsPrecomputed, enriquecerFs } from "@/lib/cb-mirror";
import { isoWeekToMes } from "@/lib/cb-queries";
import { AggTable, type AggCol } from "@/components/trade/agg-table";
import { MapaZonas } from "@/components/trade/mapa-zonas";
import { computeFsView, isFsDefault, type FsView } from "@/lib/fs-view";
import { MetaPanel } from "@/components/metas/meta-panel";
import { getFsObjetivosAnio, mesRefFs, MESES_FS as MESES, FS_KPI, FS_PLAN } from "@/lib/fs-objetivos";
import { puedeEditarActual } from "@/lib/usuarios-server";
import { KpiObjCard } from "@/components/trade/kpi-obj-card";
import { CATEGORIA_PESOS, CATEGORIAS_CORE } from "@/lib/categorias";
import { DashTabBar } from "@/components/diagnostico/dash-tabs";

type Obj = { lavado: number; refri: number; coccion: number };
import { HowToRead } from "@/components/knowledge/how-to-read";

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
    supervisores: paramArr(searchParams, "supervisores"),
    promotores: paramArr(searchParams, "promotores"),
    tiendas: paramArr(searchParams, "tiendas"),
  };

  // Vista DEFAULT (sin filtros) → se lee PRECALCULADA (fs_precomputed, instantáneo).
  // Con filtros activos → se computa sobre el mirror (fetch + agregación).
  let view: FsView | null = null;
  let fetchError: string | null = null;

  if (isFsDefault(filter)) view = await getFsPrecomputed();
  if (view && (!view.byPromotor || !view.byZona)) view = null; // precálculo viejo (sin promotor/zona) → se recalcula

  if (!view) {
    try {
      // Todas las semanas del año (= app vieja); los filtros se aplican en computeFsView.
      view = computeFsView(await enriquecerFs(await getFloorShareRowsFast([])), filter);
    } catch (err) {
      fetchError = err instanceof Error ? err.message : String(err);
    }
  }

  const v: FsView = view ?? {
    options: { meses: [], semanas: [], categorias: [], clientes: [], supervisores: [], promotores: [], tiendas: [] },
    totalRanking: [], catBrand: [], cats: [], byTienda: [], byCliente: [], byPromotor: [],
    overall: computeOverall([]), topMarcas: [], weekly: [], totalTiendasRelevadas: 0, semanaDesde: null, semanaHasta: null, hasData: false,
  };
  const { options, totalRanking, byTienda, byCliente, byPromotor, overall, topMarcas, weekly, totalTiendasRelevadas, hasData } = v;
  const periodo = v.semanaDesde != null && v.semanaHasta != null
    ? `${mesLargo(v.semanaDesde)} — ${mesLargo(v.semanaHasta)}` : "";
  const sub = `${periodo ? `${periodo} · ` : ""}Δ vs objetivo`;

  const esMapa = searchParams.tab === "mapa";
  const lastUpdated = await maxUpdatedAt("floor_share", "cb").catch(() => null);

  // Objetivo = la META MENSUAL por categoría (fuente única, lib/fs-objetivos) del mes de referencia de la vista:
  // el último mes filtrado o el de la última semana relevada. Cada mes usa SU meta (la evolución de abajo
  // compara mes a mes), así que editar un mes no cambia los demás. Mes sin meta → 32 / 25 / 23.
  const sems = filter.semanas?.length ? filter.semanas : weekly.length ? weekly.map((w) => w.semana) : options.semanas;
  const semMax = Math.max(0, ...sems);
  const mesesFiltro = (filter.meses ?? []).map((m) => MESES.indexOf(m)).filter((i) => i >= 0);
  const { anio, mesIdx } = mesRefFs(semMax, mesesFiltro.length ? Math.max(...mesesFiltro) : undefined);
  const [objAnio, editor] = await Promise.all([getFsObjetivosAnio(anio), puedeEditarActual("trade")]);
  const o = objAnio[mesIdx]!;
  const OBJ: Obj = { lavado: o.lavado, refri: o.refrigeracion, coccion: o.coccion };
  const objLabel = (v: number) => `Meta ${MESES[mesIdx]} ${anio}: ${Number(v.toFixed(1))}%`;

  // Objetivo general ponderado (Σ obj_cat × peso / Σ peso) para el card general.
  const genObj = (() => {
    const p = CATEGORIA_PESOS as Record<string, number>;
    const items: Array<[number, number]> = [
      [OBJ.lavado, p.Lavado ?? 0], [OBJ.refri, p["Refrigeración"] ?? 0], [OBJ.coccion, p["Cocción"] ?? 0],
    ];
    const wsum = items.reduce((s, [, w]) => s + w, 0) || 1;
    return items.reduce((s, [o, w]) => s + o * w, 0) / wsum;
  })();

  const metasBloque = (
    <>
      {editor && (
        <MetaPanel
          plan={FS_PLAN}
          catPesos={CATEGORIA_PESOS}
          titulo="Metas de Floor Share (objetivos por mes y categoría)"
          subtitulo="Acá se editan los objetivos: Ene–Dic para Lavado, Refrigeración y Cocción. Cada mes se compara contra su meta (cambiar un mes no toca los otros). El general se calcula solo (Σ categoría × peso). Mes sin meta = 32 / 25 / 23%."
          kpis={[{ nombre: FS_KPI, unidad: "%", categorias: [...CATEGORIAS_CORE] }]}
        />
      )}
    </>
  );

  return (
    <div className="space-y-4">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight">Floor Share</h2>
        <p className="text-sm text-muted-foreground">
          Share de góndola por categoría · Ranking de marcas · Evolución mensual.
        </p>
        <LastUpdated date={lastUpdated} className="mt-1" />
      </header>
      <HowToRead slug="floor-share" />
      {/* Sin pestaña Diagnóstico (pedido del user): sin <DashTabs>, el renglón queda Tablero · Mapa por zona. */}
      <DashTabBar items={[{ key: "tablero", label: "Tablero", href: "/floor-share" }, { key: "mapa", label: "Mapa por zona", href: "/floor-share?tab=mapa" }]} active={esMapa ? "mapa" : "tablero"} />

      <FloorShareFilters current={filter} options={options} />

      {fetchError && (
        <div className="rounded-lg border bg-rose-50 p-4 text-xs text-rose-900">
          <strong>Error cargando floor_share:</strong> <code>{fetchError}</code>
        </div>
      )}

      {!hasData ? (
        <>
          <div className="rounded-lg border bg-amber-50 p-4 text-sm text-amber-900">
            Sin datos para los filtros seleccionados.
          </div>
          {metasBloque}
        </>
      ) : esMapa ? (
        <MapaZonas
          titulo="Floor Share por zona"
          metricas={[{ label: "General", obj: Number(genObj.toFixed(1)) }, { label: "Lavado", obj: OBJ.lavado }, { label: "Refrigeración", obj: OBJ.refri }, { label: "Cocción", obj: OBJ.coccion }]}
          puntos={(v.byZona ?? []).map((z) => ({
            zona: z.cliente, tiendas: z.tiendas,
            vals: [z.total, z.lavado, z.refri, z.coccion].map((b) => [b.drean_units, b.total_units] as [number, number]),
          }))}
        />
      ) : (
        <>
          <section className="grid gap-3 lg:grid-cols-4">
            <KpiObjCard
              title="Floor Share — general" medida="Drean · todas las categorías" value={overall.total.share} obj={Number(genObj.toFixed(1))} objLabel={`Meta ${MESES[mesIdx]} ${anio}: ${genObj.toFixed(1)}% (ponderada)`}
              contexto={`${overall.total.drean_units.toLocaleString()} / ${overall.total.total_units.toLocaleString()} · ${totalTiendasRelevadas} tiendas`}
            />
            <KpiObjCard title="Lavado" medida="Share Drean góndola" value={overall.lavado.share} obj={OBJ.lavado} objLabel={objLabel(OBJ.lavado)}
              contexto={`${overall.lavado.drean_units.toLocaleString()} / ${overall.lavado.total_units.toLocaleString()}`} />
            <KpiObjCard title="Refrigeración" medida="Share Drean góndola" value={overall.refri.share} obj={OBJ.refri} objLabel={objLabel(OBJ.refri)}
              contexto={`${overall.refri.drean_units.toLocaleString()} / ${overall.refri.total_units.toLocaleString()}`} />
            <KpiObjCard title="Cocción" medida="Share Drean góndola" value={overall.coccion.share} obj={OBJ.coccion} objLabel={objLabel(OBJ.coccion)}
              contexto={`${overall.coccion.drean_units.toLocaleString()} / ${overall.coccion.total_units.toLocaleString()}`} />
          </section>

          {/* Como la app vieja: ranking + evolución · cliente + promotor · tienda. */}
          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border bg-card p-4">
              <h3 className="mb-3 text-sm font-bold">📊 Ranking de marcas</h3>
              <FloorShareBrandRanking data={totalRanking.filter((r) => !["otros", "total"].includes(r.marca.toLowerCase())).slice(0, 10)} highlight={OWN_BRAND_FS} />
            </div>
            {weekly.length > 1 && (
              <div className="rounded-xl border bg-card p-4">
                <h3 className="mb-3 text-sm font-bold">📈 Evolución semanal — Drean vs Top marcas</h3>
                <FloorShareWeeklyChart data={weekly} marcas={topMarcas} />
              </div>
            )}
          </section>

          <section className="grid gap-4 xl:grid-cols-2">
            <AggTable titulo="🏢 Performance por cliente" columna="Cliente" totalLabel="FLOORSHARE TOTAL" subtitulo={sub} cols={fsCols(OBJ)}
              filas={byCliente.map((r) => ({ key: r.cliente, nombre: r.cliente, vals: fsVals(r) }))} total={fsVals(overall)} />
            <AggTable titulo="👥 Performance por promotor" columna="Promotor" totalLabel="FLOORSHARE TOTAL EQUIPO" subtitulo={sub} cols={fsCols(OBJ)}
              filas={byPromotor.map((r) => ({ key: r.cliente, nombre: r.cliente, vals: fsVals(r) }))} total={fsVals(overall)} />
          </section>

          <AggTable titulo="📋 Performance por tienda" columna="Tienda" totalLabel="FLOORSHARE TOTAL TIENDAS" subtitulo={sub} cols={fsCols(OBJ)}
            filas={byTienda.map((r) => ({
              key: `${r.numero_tienda}|${r.nombre_tienda}`, vals: fsVals(r),
              nombre: `${["Sin asignar", "Sin cliente"].includes(r.cliente) ? "" : `${r.cliente} — `}${r.numero_tienda} - ${r.nombre_tienda}`,
            }))} total={fsVals(overall)} />
          {/* La app vieja no tenía evolución mensual: solo queda el editor de objetivos (editores Trade). */}
          {metasBloque}
        </>
      )}
    </div>
  );
}

// ===== Helpers de render (= app vieja) =====

const MESES_LARGOS: Record<string, string> = { Ene: "Enero", Feb: "Febrero", Mar: "Marzo", Abr: "Abril", May: "Mayo", Jun: "Junio", Jul: "Julio", Ago: "Agosto", Sep: "Septiembre", Oct: "Octubre", Nov: "Noviembre", Dic: "Diciembre" };
const mesLargo = (sem: number) => { const m = isoWeekToMes(sem); return `${MESES_LARGOS[m] ?? m} ${new Date().getUTCFullYear()}`; };

type Bloques = { lavado: CategoryBlock; refri: CategoryBlock; coccion: CategoryBlock };
const fsVals = (b: Bloques) => (["lavado", "refri", "coccion"] as const).map((k) => (b[k].total_units > 0 ? b[k].share : null));
const fsCols = (OBJ: Obj): AggCol[] => [{ label: "FS Lavado", obj: OBJ.lavado }, { label: "FS Refri", obj: OBJ.refri }, { label: "FS Coccion", obj: OBJ.coccion }];
