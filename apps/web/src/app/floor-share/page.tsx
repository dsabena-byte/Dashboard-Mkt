import { FloorShareFilters } from "@/components/floor-share/floor-share-filters";
import { FloorShareBrandRanking } from "@/components/floor-share/floor-share-charts";
import { FsEvolucion } from "@/components/floor-share/fs-evolucion";
import { LastUpdated } from "@/components/last-updated";
import { maxUpdatedAt } from "@/lib/freshness-queries";
import {
  computeOverall,
  OWN_BRAND_FS,
  type CategoryBlock,
  type FloorShareFilter,
} from "@/lib/floor-share-queries";
import { getFsFilasEnriquecidas, getFsPrecomputed, getFloorShareRowsFast, enriquecerFs } from "@/lib/cb-mirror";
import { isoWeekToMes } from "@/lib/cb-queries";
import { AggTable, type AggCol } from "@/components/trade/agg-table";
import { MapaZonas } from "@/components/trade/mapa-zonas";
import { mapaTrade, exhibicionesDeTiendas } from "@/lib/trade-mapa";
import { ExhibicionesTienda } from "@/components/trade/exhibicion-fotos";
import { computeFsView, isFsDefault, fsIdMes, fsIdSemana, fsVistaConBase, type FsView, type FsVistaPeriodo } from "@/lib/fs-view";
import { MetaPanel } from "@/components/metas/meta-panel";
import { getFsObjetivosAnio, mesRefFs, MESES_FS as MESES, FS_KPI, FS_PLAN } from "@/lib/fs-objetivos";
import { puedeEditarActual } from "@/lib/usuarios-server";
import { MetaKpiCard } from "@/components/metas/meta-kpi-card";
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
  if (view && (!view.byPromotor || !view.byZona || !view.monthly || !view.porMes)) view = null; // precálculo viejo → se recalcula

  // Filtro SOLO de mes/semana (el caso común): se bajan únicamente esas semanas (~20k filas, ~1,4 s medidos) en vez del
  // año entero (~200k, ~11 s). La evolución y las opciones ignoran el filtro de tiempo → salen del precálculo default.
  const soloTiempo = Boolean(filter.meses?.length || filter.semanas?.length)
    && !(filter.categorias?.length || filter.clientes?.length || filter.supervisores?.length || filter.promotores?.length || filter.tiendas?.length);
  // UN mes o UNA semana (lo más usado): vista ya calculada al cargar los datos → una sola lectura.
  const idPeriodo = !soloTiempo ? null
    : filter.meses?.length === 1 && !filter.semanas?.length ? fsIdMes(filter.meses[0]!)
    : filter.semanas?.length === 1 && !filter.meses?.length ? fsIdSemana(filter.semanas[0]!) : null;
  if (!view && idPeriodo) {
    const [base, per] = await Promise.all([getFsPrecomputed(), getFsPrecomputed<FsVistaPeriodo>(idPeriodo)]);
    if (base?.monthly && per?.porMes) view = fsVistaConBase(per, base);
  }
  if (!view && soloTiempo) {
    try {
      const base = await getFsPrecomputed();
      if (base?.monthly && base.porMes) {
        const semanas = base.options.semanas.filter((sem) =>
          (!filter.semanas?.length || filter.semanas.includes(sem)) && (!filter.meses?.length || filter.meses.includes(isoWeekToMes(sem))));
        const parcial = computeFsView(await enriquecerFs(await getFloorShareRowsFast(semanas.length ? semanas : [-1])), filter);
        view = { ...parcial, options: base.options, topMarcas: base.topMarcas, weekly: base.weekly, monthly: base.monthly };
      }
    } catch { view = null; /* cae al camino completo */ }
  }

  if (!view) {
    try {
      // Todas las semanas del año (= app vieja); los filtros se aplican en computeFsView.
      view = computeFsView(await getFsFilasEnriquecidas(), filter);
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
  const periodo = v.mesDesde && v.mesHasta ? `${mesLargo(v.mesDesde)} — ${mesLargo(v.mesHasta)}` : "";
  const sub = `${periodo ? `${periodo} · ` : ""}Δ vs objetivo`;

  const esMapa = searchParams.tab === "mapa";
  // Pestaña Mapa + filtro de tiendas: sus exhibiciones especiales con fotos (solo en el mapa, pedido del user) (clave de tienda FS = "número|nombre").
  const exhib = esMapa && filter.tiendas?.length
    ? await exhibicionesDeTiendas(filter.tiendas.map((k) => { const [numero = "", nombre = ""] = k.split("|"); return { numero, nombre, label: `${numero} - ${nombre}` }; })).catch(() => [])
    : [];
  const mapa = esMapa && hasData ? await mapaTrade({ fs: v, fsFilter: filter }) : null;
  const lastUpdated = await maxUpdatedAt("floor_share", "cb").catch(() => null);

  // Objetivo = la META MENSUAL por categoría (fuente única, lib/fs-objetivos) del mes de referencia de la vista:
  // el último mes filtrado o el de la última semana relevada. Cada mes usa SU meta (la evolución de abajo
  // compara mes a mes), así que editar un mes no cambia los demás. Mes sin meta → 32 / 25 / 23.
  const sems = filter.semanas?.length ? filter.semanas : weekly.length ? weekly.map((w) => w.semana) : options.semanas;
  const semMax = Math.max(0, ...sems);
  const mesesFiltro = (filter.meses ?? []).map((m) => MESES.indexOf(m)).filter((i) => i >= 0);
  const { anio, mesIdx } = mesRefFs(semMax, mesesFiltro.length ? Math.max(...mesesFiltro) : undefined);
  const [objAnio, objAnt, editor] = await Promise.all([getFsObjetivosAnio(anio), getFsObjetivosAnio(anio - 1), puedeEditarActual("trade")]);
  const o = objAnio[mesIdx]!;
  const OBJ: Obj = { lavado: o.lavado, refri: o.refrigeracion, coccion: o.coccion };
  // Cards (sistema de Redes): fila "Mes" = mes de referencia vs SU meta · fila "Período" = la vista entera vs el
  // promedio de las metas de sus meses (el mes de dic del año anterior usa la meta de ese año).
  const objDeMes = (k: string) => { const [y, m] = k.split("-").map(Number); const o2 = (y === anio ? objAnio : objAnt)[m! - 1] ?? o; return { lavado: o2.lavado, refri: o2.refrigeracion, coccion: o2.coccion }; };
  const general = (ob: Obj) => { const p = CATEGORIA_PESOS as Record<string, number>; const it: Array<[number, number]> = [[ob.lavado, p.Lavado ?? 0], [ob.refri, p["Refrigeración"] ?? 0], [ob.coccion, p["Cocción"] ?? 0]]; return it.reduce((s, [x, w]) => s + x * w, 0) / (it.reduce((s, [, w]) => s + w, 0) || 1); };
  const refKey = `${anio}-${String(mesIdx + 1).padStart(2, "0")}`;
  const mesRef = (v.porMes ?? []).find((m) => m.mes === refKey)?.overall ?? null;
  const mesesVista = (v.porMes ?? []).map((m) => m.mes);
  const corto = (k: string) => `${MESES[Number(k.slice(5)) - 1]} ${k.slice(2, 4)}`;
  const etiquetaPeriodo = v.mesDesde && v.mesHasta ? (v.mesDesde === v.mesHasta ? corto(v.mesDesde) : `${corto(v.mesDesde)}–${corto(v.mesHasta)}`) : "Período";
  const metaProm = (f: (ob: Obj) => number) => mesesVista.length ? mesesVista.reduce((s, k) => s + f(objDeMes(k)), 0) / mesesVista.length : f(OBJ);
  const card = (title: string, medida: string, key: "total" | "lavado" | "refri" | "coccion", metaDe: (ob: Obj) => number, ctx?: string) => (
    <MetaKpiCard key={key} title={title} medida={medida} unidad="%" decimales={1} delta="pp"
      headlineActual={mesRef ? mesRef[key].share : overall[key].share} headlineLabel={mesRef ? corto(refKey) : etiquetaPeriodo}
      contexto={ctx ?? `${overall[key].drean_units.toLocaleString()} / ${overall[key].total_units.toLocaleString()} en ${etiquetaPeriodo}`}
      rows={[
        ...(mesRef ? [{ label: `Mes ${corto(refKey)}`, actual: mesRef[key].share, meta: metaDe(OBJ) }] : []),
        // Si el período es un solo mes, la fila "Período" repetiría la de "Mes".
        ...(mesRef && mesesVista.length <= 1 ? [] : [{ label: `Período ${etiquetaPeriodo}`, actual: overall[key].share, meta: metaProm(metaDe) }]),
      ]} />
  );

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
      {/* Sin pestaña Diagnóstico (pedido del user): sin <DashTabs>, el renglón queda Tablero · Mapa. */}
      <DashTabBar items={[{ key: "tablero", label: "Tablero", href: "/floor-share" }, { key: "mapa", label: "Heat Map", href: "/floor-share?tab=mapa" }]} active={esMapa ? "mapa" : "tablero"} />

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
      ) : mapa ? (
        <>
          <MapaZonas titulo="Floor Share y Cuadro Básico por tienda" metricas={mapa.metricas} puntos={mapa.puntos} nota={mapa.nota} inicial={6} />
          <ExhibicionesTienda items={exhib} />
        </>
      ) : (
        <>
          <section className="grid gap-3 lg:grid-cols-4">
            {card("Floor Share — general", "Drean · todas las categorías (meta ponderada)", "total", general,
              `${overall.total.drean_units.toLocaleString()} / ${overall.total.total_units.toLocaleString()} · ${totalTiendasRelevadas} tiendas · ${etiquetaPeriodo}`)}
            {card("Lavado", "Share Drean góndola", "lavado", (ob) => ob.lavado)}
            {card("Refrigeración", "Share Drean góndola", "refri", (ob) => ob.refri)}
            {card("Cocción", "Share Drean góndola", "coccion", (ob) => ob.coccion)}
          </section>

          {/* Como la app vieja: ranking + evolución · cliente + promotor · tienda. */}
          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border bg-card p-4">
              <h3 className="mb-3 text-sm font-bold">📊 Ranking de marcas</h3>
              <FloorShareBrandRanking data={totalRanking.filter((r) => !["otros", "total"].includes(r.marca.toLowerCase())).slice(0, 10)} highlight={OWN_BRAND_FS} />
            </div>
            {weekly.length > 1 && (
              <div className="rounded-xl border bg-card p-4">
                <FsEvolucion semanal={weekly} mensual={v.monthly ?? []} marcas={topMarcas} />
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
const mesLargo = (k: string) => { const m = MESES[Number(k.slice(5)) - 1] ?? ""; return `${MESES_LARGOS[m] ?? m} ${k.slice(0, 4)}`; };

type Bloques = { lavado: CategoryBlock; refri: CategoryBlock; coccion: CategoryBlock };
const fsVals = (b: Bloques) => (["lavado", "refri", "coccion"] as const).map((k) => (b[k].total_units > 0 ? b[k].share : null));
const fsCols = (OBJ: Obj): AggCol[] => [{ label: "FS Lavado", obj: OBJ.lavado }, { label: "FS Refri", obj: OBJ.refri }, { label: "FS Coccion", obj: OBJ.coccion }];
