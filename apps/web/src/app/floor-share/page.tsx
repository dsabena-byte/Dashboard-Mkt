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
import { computeFsView, isFsDefault, type FsView } from "@/lib/fs-view";
import { MetaPanel } from "@/components/metas/meta-panel";
import { MetaEvolChart } from "@/components/pauta/meta-evol-chart";
import { getFsObjetivosAnio, mesRefFs, MESES_FS as MESES, FS_KPI, FS_PLAN } from "@/lib/fs-objetivos";
import { getTradeMonthly } from "@/lib/trade-monthly";
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
  if (view && !view.byPromotor) view = null; // precálculo viejo (antes de promotor/supervisor) → se recalcula

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

  const lastUpdated = await maxUpdatedAt("floor_share", "cb").catch(() => null);

  // Objetivo = la META MENSUAL por categoría (fuente única, lib/fs-objetivos) del mes de referencia de la vista:
  // el último mes filtrado o el de la última semana relevada. Cada mes usa SU meta (la evolución de abajo
  // compara mes a mes), así que editar un mes no cambia los demás. Mes sin meta → 32 / 25 / 23.
  const sems = filter.semanas?.length ? filter.semanas : weekly.length ? weekly.map((w) => w.semana) : options.semanas;
  const semMax = Math.max(0, ...sems);
  const mesesFiltro = (filter.meses ?? []).map((m) => MESES.indexOf(m)).filter((i) => i >= 0);
  const { anio, mesIdx } = mesRefFs(semMax, mesesFiltro.length ? Math.max(...mesesFiltro) : undefined);
  const [objAnio, tm, editor] = await Promise.all([getFsObjetivosAnio(anio), getTradeMonthly(anio), puedeEditarActual("trade")]);
  const o = objAnio[mesIdx]!;
  const OBJ: Obj = { lavado: o.lavado, refri: o.refrigeracion, coccion: o.coccion };
  const objLabel = (v: number) => `Meta ${MESES[mesIdx]} ${anio}: ${Number(v.toFixed(1))}%`;
  const evol = ([["Lavado", "lavado"], ["Refrigeración", "refrigeracion"], ["Cocción", "coccion"]] as const).map(([cat, k]) => ({
    cat,
    data: MESES.map((mes, i) => ({ mes, real: tm.fsCat[cat]?.[i] ?? null, meta: objAnio[i]![k] })),
  }));

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
      <section className="rounded-xl border bg-card p-4">
        <h3 className="text-sm font-bold">Evolución mensual · real vs meta {anio}</h3>
        <p className="mb-3 text-[11px] text-muted-foreground">Share Drean de cada mes contra la meta de ESE mes (sin meta cargada: 32 / 25 / 23%).</p>
        <div className="grid gap-4 lg:grid-cols-3">
          {evol.map((e) => (
            <div key={e.cat}>
              <div className="mb-1 text-xs font-semibold text-muted-foreground">{e.cat}</div>
              <MetaEvolChart data={e.data} mode="bar" unidad="%" realName={`Floor Share ${e.cat}`} />
            </div>
          ))}
        </div>
      </section>
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
      {/* Sin pestaña Diagnóstico (pedido del user): sin <DashTabs>, el renglón queda solo con "Tablero". */}
      <DashTabBar />

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

          {/* Estructura estándar: cards → evolución real vs meta (+ metas) → contenido. */}
          {metasBloque}

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

          <section className="grid gap-4 lg:grid-cols-2">
            <AggTable titulo="🏢 Performance por cliente" columna="Cliente" totalLabel="FLOORSHARE TOTAL" periodo={periodo}
              filas={byCliente.map((r) => ({ key: r.cliente, nombre: r.cliente, b: r }))} total={overall} OBJ={OBJ} />
            <AggTable titulo="👥 Performance por promotor" columna="Promotor" totalLabel="FLOORSHARE TOTAL EQUIPO" periodo={periodo}
              filas={byPromotor.map((r) => ({ key: r.cliente, nombre: r.cliente, b: r }))} total={overall} OBJ={OBJ} />
          </section>

          <AggTable titulo="📋 Performance por tienda" columna="Tienda" totalLabel="FLOORSHARE TOTAL TIENDAS" periodo={periodo}
            filas={byTienda.map((r) => ({
              key: `${r.numero_tienda}|${r.nombre_tienda}`, b: r,
              nombre: `${["Sin asignar", "Sin cliente"].includes(r.cliente) ? "" : `${r.cliente} — `}${r.numero_tienda} - ${r.nombre_tienda}`,
            }))} total={overall} OBJ={OBJ} />
        </>
      )}
    </div>
  );
}

// ===== Helpers de render (= app vieja) =====

const MESES_LARGOS: Record<string, string> = { Ene: "Enero", Feb: "Febrero", Mar: "Marzo", Abr: "Abril", May: "Mayo", Jun: "Junio", Jul: "Julio", Ago: "Agosto", Sep: "Septiembre", Oct: "Octubre", Nov: "Noviembre", Dic: "Diciembre" };
const mesLargo = (sem: number) => { const m = isoWeekToMes(sem); return `${MESES_LARGOS[m] ?? m} ${new Date().getUTCFullYear()}`; };

// Semáforo de la app vieja: verde hasta −2 pp del objetivo, amarillo hasta −6, rojo debajo.
function celda(share: number, obj: number): string {
  const d = share - obj;
  if (d >= -2) return "bg-[#c6f6d5] text-[#064e3b]";
  if (d >= -6) return "bg-[#fef3c7] text-[#78350f]";
  return "bg-[#fecaca] text-[#7f1d1d]";
}

type Bloques = { lavado: CategoryBlock; refri: CategoryBlock; coccion: CategoryBlock };
const CATS = [["lavado", "FS LAVADO"], ["refri", "FS REFRI"], ["coccion", "FS COCCION"]] as const;

function Celdas({ b, OBJ, total = false }: { b: Bloques; OBJ: Obj; total?: boolean }) {
  return (
    <>
      {CATS.map(([k]) => {
        const blk = b[k];
        if (blk.total_units <= 0) return [
          <td key={`${k}p`} className="border border-slate-200 bg-slate-100 px-2 py-1.5 text-center text-slate-400">—</td>,
          <td key={`${k}d`} className="border border-slate-200 px-2 py-1.5" />,
        ];
        const d = Math.round(blk.share - OBJ[k]);
        return [
          <td key={`${k}p`} className={`border px-2 py-1.5 text-center font-bold tabular-nums ${total ? "border-[#1e3a8a]" : `border-slate-200 ${celda(blk.share, OBJ[k])}`}`}>{blk.share.toFixed(0)}%</td>,
          <td key={`${k}d`} className={`whitespace-nowrap border px-2 py-1.5 text-center tabular-nums ${total ? "border-[#1e3a8a] text-white/85" : "border-slate-200"}`}>
            {d > 0 ? "+" : ""}{d} pp <span className={d >= 0 ? "font-bold text-green-600" : "font-bold text-red-600"}>{d >= 0 ? "↑" : "↓"}</span>
          </td>,
        ];
      })}
    </>
  );
}

function AggTable({ titulo, columna, totalLabel, periodo, filas, total, OBJ }: {
  titulo: string; columna: string; totalLabel: string; periodo: string;
  filas: Array<{ key: string; nombre: string; b: Bloques }>; total: Bloques; OBJ: Obj;
}) {
  if (filas.length === 0) return null;
  return (
    <section className="rounded-xl border bg-card p-4">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-bold">{titulo}</h3>
        <span className="text-[11px] text-muted-foreground">{periodo ? `${periodo} · ` : ""}Δ vs objetivo</span>
      </div>
      <div className="max-h-[440px] overflow-auto">
        <table className="w-full border-collapse text-xs">
          <thead className="sticky top-0 z-10">
            <tr>
              <th className="border border-slate-200 bg-slate-50 px-2 py-1.5 text-center text-[11px] font-bold text-slate-800">{columna}</th>
              {CATS.map(([k, label]) => (
                <th key={k} colSpan={2} className="border border-[#1e3a8a] bg-[#1e3a8a] px-2 py-1.5 text-center text-[11px] font-bold tracking-wide text-white">{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.key}>
                <td className="whitespace-nowrap border border-slate-200 px-2 py-1.5 text-slate-800">{f.nombre}</td>
                <Celdas b={f.b} OBJ={OBJ} />
              </tr>
            ))}
          </tbody>
          <tfoot className="sticky bottom-0">
            <tr className="bg-[#1e3a8a] font-extrabold text-white">
              <td className="whitespace-nowrap border border-[#1e3a8a] px-2 py-1.5">{totalLabel}</td>
              <Celdas b={total} OBJ={OBJ} total />
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
