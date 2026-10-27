import { CbFiltersBar } from "@/components/cb/cb-filters";
import { getCbRowsFast, enriquecerCb } from "@/lib/cb-mirror";
import { KpiObjCard } from "@/components/trade/kpi-obj-card";
import { LastUpdated } from "@/components/last-updated";
import { maxUpdatedAt } from "@/lib/freshness-queries";
import { CbWeeklyChart } from "@/components/cb/cb-weekly-chart";
import { CbCategoryChart } from "@/components/cb/cb-category-chart";
import { CbSuggestionsTab } from "@/components/cb/cb-suggestions-tab";
import { CbSugerenciasSku } from "@/components/cb/cb-sugerencias-sku";
import { getSugerenciasSku, MIN_SEMANAS } from "@/lib/cb-sugerencias-sku-server";
import { MetaPanel } from "@/components/metas/meta-panel";
import {
  getCbBaselineMedidas,
  getCbSuggestions,
  getCbSuggestionsDetail,
  type CbFilter,
} from "@/lib/cb-queries";
import { computeCbView, isCbDefault, applyCbFilter, computeSkuDetalle, type CbView, type CbSkuDet } from "@/lib/cb-view";
import { AggTable, type AggCol } from "@/components/trade/agg-table";
import { MapaZonas } from "@/components/trade/mapa-zonas";
import { mapaTrade, exhibicionesDeTiendas } from "@/lib/trade-mapa";
import { ExhibicionesTienda } from "@/components/trade/exhibicion-fotos";
import { CbDetalleTienda } from "@/components/cb/cb-detalle-tienda";
import { getTrPrecalc, trEstado, getTrCbSkuRows } from "@/lib/trade-db";
import { puedeEditarActual } from "@/lib/usuarios-server";
import { CargaDatos } from "@/components/trade/carga-datos";
import { MaestrosTrade } from "@/components/trade/maestros";
import { DashTabBar } from "@/components/diagnostico/dash-tabs";
import { HowToRead } from "@/components/knowledge/how-to-read";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

interface PageProps {
  searchParams: Record<string, string | string[] | undefined>;
}

function paramArr(searchParams: PageProps["searchParams"], key: string): string[] {
  const v = searchParams[key];
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

const OBJ_PCT = 80;




const TABS = [
  { key: "overview", label: "Cuadro Básico Trade", href: "/cuadros-basicos" },
  { key: "mapa", label: "Mapa", href: "/cuadros-basicos?tab=mapa" },
  { key: "sugerencias", label: "Sugerencias de tiendas", href: "/cuadros-basicos?tab=sugerencias" },
  { key: "sku", label: "Sugerencias de SKUs", href: "/cuadros-basicos?tab=sku" },
];
// Solo quien puede editar Trade (exigirEdicion("trade")) ve la carga y los maestros.
const TABS_EDITOR = [
  { key: "carga", label: "Cargar datos", href: "/cuadros-basicos?tab=carga" },
  { key: "tiendas", label: "Tiendas", href: "/cuadros-basicos?tab=tiendas" },
  { key: "cadenas", label: "Cadenas", href: "/cuadros-basicos?tab=cadenas" },
  { key: "skus", label: "SKUs", href: "/cuadros-basicos?tab=skus" },
];
function TabBar({ tab, editor }: { tab: string; editor: boolean }) {
  return <DashTabBar items={TABS} active={tab} after={editor ? TABS_EDITOR : []} />;
}

function Encabezado({ tab, editor, lastUpdated }: { tab: string; editor: boolean; lastUpdated?: string | null }) {
  return (
    <>
      <header>
        <h2 className="text-2xl font-semibold tracking-tight">Cuadros Básicos</h2>
        <p className="text-sm text-muted-foreground">
          Cumplimiento de cuadro básico, infaltables y estratégico por tienda. Objetivo: 80%.
        </p>
        {lastUpdated !== undefined && <LastUpdated date={lastUpdated} className="mt-1" />}
      </header>
      <HowToRead slug="cuadros-basicos" />
      <TabBar tab={tab} editor={editor} />
    </>
  );
}

export default async function CuadrosBasicosPage({ searchParams }: PageProps) {
  const tab = typeof searchParams.tab === "string" ? searchParams.tab : "overview";
  const editor = await puedeEditarActual("trade");

  // Pestañas que cargan su propia data recién al abrirlas (no pagan el overview). Sin pestaña Diagnóstico (pedido del user):
  // por eso NO se envuelve en <DashTabs> (sin ese contexto, <DashTabBar> no agrega "Diagnóstico e Inteligencia").
  if (["carga", "tiendas", "cadenas", "skus"].includes(tab)) {
    return (
      <div className="space-y-4">
        <Encabezado tab={tab} editor={editor} />
        {!editor ? (
          <div className="rounded-lg border bg-amber-50 p-4 text-sm text-amber-900">No tenés permiso para editar Trade. Pedíselo al administrador.</div>
        ) : tab === "carga" ? <CargaDatos /> : <MaestrosTrade entidad={tab as "tiendas" | "cadenas" | "skus"} />}
      </div>
    );
  }

  // Tab "sku": SKUs fuera del CB que ya están exhibidos (archivos de exhibición semanales).
  if (tab === "sku") {
    const num = (k: string) => { const v = Number(typeof searchParams[k] === "string" ? searchParams[k] : ""); return Number.isInteger(v) && v > 0 ? v : undefined; };
    let d: Awaited<ReturnType<typeof getSugerenciasSku>> | null = null, err: string | null = null;
    try { d = await getSugerenciasSku(num("desde"), num("hasta")); } catch (e) { err = e instanceof Error ? e.message : String(e); }
    return (
      <div className="space-y-4">
        <Encabezado tab={tab} editor={editor} />
        {(err || d?.error) && <div className="rounded-lg border bg-rose-50 p-4 text-xs text-rose-900">{err ?? d?.error}</div>}
        {d && <CbSugerenciasSku porCliente={d.porCliente} porTipologia={d.porTipologia} semanas={d.semanas} desde={d.desde} hasta={d.hasta} minSemanas={MIN_SEMANAS} />}
      </div>
    );
  }

  // Tab "sugerencias": render aislado, no toca la lógica del overview existente
  if (tab === "sugerencias") {
    let baseline: Awaited<ReturnType<typeof getCbBaselineMedidas>> = {
      cb_pct_avg: null, infalt_pct_avg: null, tiendas_medidas: 0,
      cb_ok_total: 0, cb_target_total: 0, infalt_ok_total: 0, infalt_target_total: 0,
    };
    let suggestions: Awaited<ReturnType<typeof getCbSuggestions>> = [];
    let details: Awaited<ReturnType<typeof getCbSuggestionsDetail>> = [];
    let sugError: string | null = null;
    try {
      [baseline, suggestions, details] = await Promise.all([
        getCbBaselineMedidas(),
        getCbSuggestions(),
        getCbSuggestionsDetail(),
      ]);
    } catch (err) {
      sugError = err instanceof Error ? err.message : String(err);
    }
    return (
      <div className="space-y-4">
        <Encabezado tab={tab} editor={editor} />
        {sugError && (
          <div className="rounded-lg border bg-rose-50 p-4 text-xs text-rose-900">
            <strong>Error cargando sugerencias:</strong> <code>{sugError}</code>
            <p className="mt-2">
              Asegurate de haber aplicado la migración <code>0042_reporte_existencia.sql</code>{" "}
              en el proyecto CB y de haber sincronizado al menos una vez el archivo{" "}
              <code>Reporte de Existencia U3-sem.csv</code>.
            </p>
          </div>
        )}
        <CbSuggestionsTab baseline={baseline} suggestions={suggestions} details={details} />
      </div>
    );
  }

  // Tab "overview" (default) — comportamiento idéntico al original
  const filter: CbFilter = {
    meses: paramArr(searchParams, "meses"),
    semanas: paramArr(searchParams, "semanas").map(Number).filter((n) => !isNaN(n)),
    divisiones: paramArr(searchParams, "divisiones"),
    clientes: paramArr(searchParams, "clientes"),
    supervisores: paramArr(searchParams, "supervisores"),
    promotores: paramArr(searchParams, "promotores"),
    tiendas: paramArr(searchParams, "tiendas"),
  };

  // Vista DEFAULT (sin filtros) → precalculada en cada carga (tr_precalc 'cb_default', una fila). Con filtros
  // (o sin tablas tr_*) → se computa sobre el CB agregado sin SKU (vw_tr_cb_agg) o el mirror.
  let view: CbView | null = null;
  let skus: ReturnType<typeof computeSkuDetalle> | null = null;
  let fetchError: string | null = null;
  try {
    if (isCbDefault(filter) && (await trEstado()).cb != null) view = await getTrPrecalc<CbView>("cb_default");
    if (view && (!view.byPromotor || !view.byZona)) view = null; // precálculo viejo (sin promotor/zona) → se recalcula
    if (!view) view = computeCbView(await enriquecerCb(await getCbRowsFast()), filter);
    // Detalle de SKUs (= app vieja) cuando se elige una tienda o un cliente.
    const est = await trEstado();
    if ((filter.tiendas?.length || filter.clientes?.length) && est.cb != null) {
      const skuRows = await getTrCbSkuRows(est.cb, { tiendas: filter.tiendas, clientes: filter.clientes });
      skus = computeSkuDetalle(applyCbFilter(skuRows, { ...filter, promotores: [], supervisores: [] }));
    }
  } catch (err) {
    fetchError = err instanceof Error ? err.message : String(err);
  }
  const v: CbView = view ?? computeCbView([], filter);
  const { options, totals, weekly, byDiv, byCliente, byPromotor, byTienda, totalTiendasRelevadas, hasData } = v;
  const cbVals = (r: { cb_pct: number; infalt_pct: number; estrat_pct: number }) => [r.cb_pct, r.infalt_pct, r.estrat_pct];
  const totVals = [totals.cb_pct, totals.infalt_pct, totals.estrat_pct];
  // Pestaña Mapa + filtro de tiendas: sus exhibiciones especiales con fotos (solo en el mapa, pedido del user) (pedido del user: ver la foto en el tablero, no en Drive).
  const exhib = tab === "mapa" && filter.tiendas?.length
    ? await exhibicionesDeTiendas(filter.tiendas.map((t) => { const m = t.match(/^(\d+)\s*[-–]\s*(.+)$/); return { numero: m?.[1] ?? "", nombre: m?.[2] ?? t, label: t }; })).catch(() => [])
    : [];
  const seleccion = [...(filter.tiendas ?? []), ...(filter.clientes ?? [])].join(", ");
  const lastUpdated = await maxUpdatedAt("cuadro_basico_semanal", "cb").catch(() => null);
  const mapa = tab === "mapa" && hasData ? await mapaTrade({ cb: v, cbFilter: filter }) : null;

  return (
    <div className="space-y-4">
      <Encabezado tab={tab} editor={editor} lastUpdated={lastUpdated} />

      {tab !== "mapa" && <MetaPanel
        plan="Cuadros Básicos"
        titulo="Metas de Cuadros Básicos"
        subtitulo="Cargá la meta mensual de % Cumplimiento CB. Alimenta el rollup de objetivos del Seguimiento."
        kpis={[{ nombre: "% Cumplimiento CB", unidad: "%", actual: totals.cb_pct }]}
      />}

      <CbFiltersBar current={filter} options={options} />

      {fetchError && (
        <div className="rounded-lg border bg-rose-50 p-4 text-xs text-rose-900">
          <strong>Error cargando cuadro_basico_semanal:</strong> <code>{fetchError}</code>
        </div>
      )}

      {!hasData ? (
        <div className="rounded-lg border bg-amber-50 p-4 text-sm text-amber-900">
          Sin datos para los filtros seleccionados.
        </div>
      ) : mapa ? (
        <>
          <MapaZonas titulo="Cuadro Básico y Floor Share por tienda" metricas={mapa.metricas} puntos={mapa.puntos} nota={mapa.nota} />
          <ExhibicionesTienda items={exhib} />
        </>
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KpiObjCard
              title="Cuadro Básico — global" medida="% Cumplimiento CB" value={totals.cb_pct} obj={OBJ_PCT}
              contexto={`${totals.cb_ok.toLocaleString()} / ${totals.cb_target.toLocaleString()} · ${totals.tiendas} tiendas`}
            />
            <KpiObjCard
              title="Infaltables" medida="% Infaltables presentes" value={totals.infalt_pct} obj={OBJ_PCT}
              contexto={`${totals.infalt_ok.toLocaleString()} / ${totals.infalt_target.toLocaleString()}`}
            />
            <KpiObjCard
              title="Estratégico" medida="% Estratégicos presentes" value={totals.estrat_pct} obj={OBJ_PCT}
              contexto={`${totals.estrat_ok.toLocaleString()} / ${totals.estrat_target.toLocaleString()}`}
            />
            <KpiObjCard
              title="Tiendas relevadas" medida="Según filtros aplicados" value={totals.tiendas} obj={null} unit="" decimals={0}
              contexto={`Universo histórico: ${totalTiendasRelevadas}`}
            />
          </section>

          {weekly.length > 1 && (
            <section className="rounded-xl border bg-card p-4">
              <h3 className="mb-3 text-sm font-bold">📈 Evolución semanal</h3>
              <CbWeeklyChart data={weekly} />
            </section>
          )}

          <section className="rounded-xl border bg-card p-4">
            <h3 className="mb-3 text-sm font-bold">📊 Cumplimiento por Categoría</h3>
            <CbCategoryChart data={byDiv} />
          </section>

          {/* Como la app vieja: promotor + cliente lado a lado (cada una se oculta si su filtro está activo). */}
          <section className="grid gap-4 xl:grid-cols-2">
            {!filter.promotores?.length && (
              <AggTable titulo="🏆 Cumplimiento por Promotor" columna="Promotor" totalLabel="TOTAL EQUIPO" subtitulo={`Δ vs objetivo ${OBJ_PCT}%`}
                cols={CB_COLS} filas={byPromotor.map((r) => ({ key: r.key, nombre: r.key, vals: cbVals(r) }))} total={totVals} />
            )}
            {!filter.clientes?.length && (
              <AggTable titulo="🏪 Cumplimiento por Cliente/Cadena" columna="Cliente/Cadena" totalLabel="TOTAL CADENAS" subtitulo={`Δ vs objetivo ${OBJ_PCT}%`}
                cols={CB_COLS} filas={byCliente.map((r) => ({ key: r.key, nombre: r.key, vals: cbVals(r) }))} total={totVals} />
            )}
          </section>

          <section className="rounded-xl border bg-card p-4">
            <h3 className="mb-3 text-sm font-bold">📋 Detalle por Tienda</h3>
            <CbDetalleTienda rows={byTienda} />
          </section>

          {skus && (
            <section className="rounded-xl border bg-card p-4">
              <h3 className="mb-1 text-sm font-bold">🔍 Detalle de SKUs — {seleccion}</h3>
              {!filter.tiendas?.length && (
                <p className="mb-3 text-xs text-muted-foreground">📍 Vista agregada de {skus.tiendas} tienda{skus.tiendas !== 1 ? "s" : ""}</p>
              )}
              <div className="grid gap-4 lg:grid-cols-2">
                <SkuCol titulo="📌 Infaltables" items={skus.infaltables} porTienda={!filter.tiendas?.length} />
                <SkuCol titulo="🎯 Estratégicos" items={skus.estrategicos} porTienda={!filter.tiendas?.length} />
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}


const CB_COLS: AggCol[] = [{ label: "% CB", obj: OBJ_PCT }, { label: "% Infaltables", obj: OBJ_PCT }, { label: "% Estratégico", obj: OBJ_PCT }];

function SkuCol({ titulo, items, porTienda }: { titulo: string; items: CbSkuDet[]; porTienda: boolean }) {
  const ok = items.filter((s) => s.cumple).length;
  return (
    <div>
      <h4 className="mb-2 flex items-center justify-between text-sm font-semibold">
        {titulo} <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{ok} / {items.length}</span>
      </h4>
      {items.length === 0 ? (
        <p className="p-2 text-xs text-muted-foreground">No hay SKUs de este tipo en esta selección.</p>
      ) : (
        <div className="space-y-1">
          {items.map((s) => (
            <div key={s.sku} className={`flex items-center gap-2 rounded border px-2 py-1.5 text-xs ${s.cumple ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50"}`}>
              <span>{s.cumple ? "✅" : "❌"}</span>
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{s.sku}</div>
                <div className="text-[10px] text-muted-foreground">{s.division}{porTienda ? ` · ${s.nTiendasCumplen}/${s.nTiendas} tiendas cumplen` : ""}</div>
              </div>
              <div className="text-right">
                <div className="font-bold tabular-nums">{Math.round(s.pct)}%</div>
                <div className="text-[10px] text-muted-foreground">{s.real} / {s.target}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
