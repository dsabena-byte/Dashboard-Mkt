import { CbFiltersBar } from "@/components/cb/cb-filters";
import { getCbRowsFast } from "@/lib/cb-mirror";
import { KpiObjCard } from "@/components/trade/kpi-obj-card";
import { LastUpdated } from "@/components/last-updated";
import { maxUpdatedAt } from "@/lib/freshness-queries";
import { CbWeeklyChart } from "@/components/cb/cb-weekly-chart";
import { CbCategoryChart } from "@/components/cb/cb-category-chart";
import { CbSuggestionsTab } from "@/components/cb/cb-suggestions-tab";
import { MetaPanel } from "@/components/metas/meta-panel";
import {
  getCbBaselineMedidas,
  getCbSuggestions,
  getCbSuggestionsDetail,
  type CbFilter,
} from "@/lib/cb-queries";
import { computeCbView, isCbDefault, type CbView } from "@/lib/cb-view";
import { getTrPrecalc, trEstado } from "@/lib/trade-db";
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

function deltaPp(value: number): string {
  const diff = value - OBJ_PCT;
  const arrow = diff >= 0 ? "↑" : "↓";
  return `${diff >= 0 ? "+" : ""}${diff.toFixed(0)} pp ${arrow}`;
}

function deltaClass(value: number): string {
  return value >= OBJ_PCT ? "text-emerald-600" : "text-rose-500";
}

function cellBg(pct: number | null): string {
  if (pct == null) return "text-muted-foreground";
  if (pct >= 80) return "bg-emerald-50 text-emerald-700 font-semibold";
  if (pct >= 70) return "bg-amber-50 text-amber-700 font-semibold";
  return "bg-rose-50 text-rose-600 font-semibold";
}

const TABS = [
  { key: "overview", label: "Cuadro Básico Trade", href: "/cuadros-basicos" },
  { key: "sugerencias", label: "Sugerencias de tiendas", href: "/cuadros-basicos?tab=sugerencias" },
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
    tiendas: paramArr(searchParams, "tiendas"),
  };

  // Vista DEFAULT (sin filtros) → precalculada en cada carga (tr_precalc 'cb_default', una fila). Con filtros
  // (o sin tablas tr_*) → se computa sobre el CB agregado sin SKU (vw_tr_cb_agg) o el mirror.
  let view: CbView | null = null;
  let fetchError: string | null = null;
  try {
    if (isCbDefault(filter) && (await trEstado()).cb != null) view = await getTrPrecalc<CbView>("cb_default");
    if (!view) view = computeCbView(await getCbRowsFast(), filter);
  } catch (err) {
    fetchError = err instanceof Error ? err.message : String(err);
  }
  const v: CbView = view ?? computeCbView([], filter);
  const { options, totals, weekly, byDiv, byCliente, byTienda, totalTiendasRelevadas, hasData } = v;
  const lastUpdated = await maxUpdatedAt("cuadro_basico_semanal", "cb").catch(() => null);

  return (
    <div className="space-y-4">
      <Encabezado tab={tab} editor={editor} lastUpdated={lastUpdated} />

      <MetaPanel
        plan="Cuadros Básicos"
        titulo="Metas de Cuadros Básicos"
        subtitulo="Cargá la meta mensual de % Cumplimiento CB. Alimenta el rollup de objetivos del Seguimiento."
        kpis={[{ nombre: "% Cumplimiento CB", unidad: "%", actual: totals.cb_pct }]}
      />

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

          <section className="rounded-xl border bg-card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3">
              <h3 className="text-sm font-bold">🏬 Cumplimiento por Cliente / Cadena</h3>
              <span className="text-[11px] text-muted-foreground">Δ vs objetivo 80%</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="border-b bg-muted/40 text-muted-foreground">
                  <tr>
                    <th rowSpan={2} className="border-r border-border px-3 py-2 text-left align-bottom">Cliente/Cadena</th>
                    <th colSpan={2} className="border-r border-border px-3 py-1 text-center text-[11px] font-semibold uppercase tracking-wide">% CB</th>
                    <th colSpan={2} className="hidden border-r border-border px-3 py-1 text-center text-[11px] font-semibold uppercase tracking-wide md:table-cell">% Infaltables</th>
                    <th colSpan={2} className="hidden px-3 py-1 text-center text-[11px] font-semibold uppercase tracking-wide md:table-cell">% Estratégico</th>
                  </tr>
                  <tr className="text-[10px] uppercase tracking-wide">
                    <th className="px-2 py-1 text-right">%</th>
                    <th className="border-r border-border px-2 py-1 text-right">Δ</th>
                    <th className="hidden px-2 py-1 text-right md:table-cell">%</th>
                    <th className="hidden border-r border-border px-2 py-1 text-right md:table-cell">Δ</th>
                    <th className="hidden px-2 py-1 text-right md:table-cell">%</th>
                    <th className="hidden px-2 py-1 text-right md:table-cell">Δ</th>
                  </tr>
                </thead>
                <tbody>
                  {byCliente.slice(0, 30).map((r) => (
                    <tr key={r.key} className="border-b last:border-0">
                      <td className="px-3 py-1.5 font-medium">{r.key}</td>
                      <td className={`px-2 py-1.5 text-right tabular-nums ${cellBg(r.cb_pct)}`}>{r.cb_pct.toFixed(0)}%</td>
                      <td className={`border-r border-border px-2 py-1.5 text-right tabular-nums ${deltaClass(r.cb_pct)}`}>{deltaPp(r.cb_pct)}</td>
                      <td className={`hidden px-2 py-1.5 text-right tabular-nums md:table-cell ${cellBg(r.infalt_pct)}`}>{r.infalt_pct.toFixed(0)}%</td>
                      <td className={`hidden border-r border-border px-2 py-1.5 text-right tabular-nums md:table-cell ${deltaClass(r.infalt_pct)}`}>{deltaPp(r.infalt_pct)}</td>
                      <td className={`hidden px-2 py-1.5 text-right tabular-nums md:table-cell ${cellBg(r.estrat_pct)}`}>{r.estrat_pct.toFixed(0)}%</td>
                      <td className={`hidden px-2 py-1.5 text-right tabular-nums md:table-cell ${deltaClass(r.estrat_pct)}`}>{deltaPp(r.estrat_pct)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 bg-muted font-bold text-foreground">
                    <td className="px-3 py-2">TOTAL CADENAS</td>
                    <td className="px-2 py-2 text-right tabular-nums">{totals.cb_pct.toFixed(0)}%</td>
                    <td className="px-2 py-2 text-right tabular-nums">{deltaPp(totals.cb_pct)}</td>
                    <td className="hidden px-2 py-2 text-right tabular-nums md:table-cell">{totals.infalt_pct.toFixed(0)}%</td>
                    <td className="hidden px-2 py-2 text-right tabular-nums md:table-cell">{deltaPp(totals.infalt_pct)}</td>
                    <td className="hidden px-2 py-2 text-right tabular-nums md:table-cell">{totals.estrat_pct.toFixed(0)}%</td>
                    <td className="hidden px-2 py-2 text-right tabular-nums md:table-cell">{deltaPp(totals.estrat_pct)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>

          <section className="rounded-xl border bg-card overflow-hidden">
            <div className="px-4 py-3">
              <h3 className="text-sm font-bold">📋 Detalle por Tienda</h3>
              <p className="text-[11px] text-muted-foreground">% CB desglosado por división. Top 50 por defecto.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[11px] font-semibold uppercase tracking-wide">
                    <th className="hidden border-b bg-muted/40 px-3 py-2 text-left text-muted-foreground sm:table-cell">Cliente</th>
                    <th className="border-b bg-muted/40 px-3 py-2 text-left text-muted-foreground">Tienda</th>
                    <th className="border-b bg-blue-100 px-3 py-2 text-center text-blue-800">Lavado</th>
                    <th className="border-b bg-cyan-100 px-3 py-2 text-center text-cyan-800">Refri</th>
                    <th className="border-b bg-pink-100 px-3 py-2 text-center text-pink-800">Cocción</th>
                  </tr>
                </thead>
                <tbody>
                  {byTienda.slice(0, 50).map((r, i) => (
                    <tr key={`${r.cliente}-${r.tienda}-${i}`} className="border-b last:border-0">
                      <td className="hidden px-3 py-1.5 text-muted-foreground sm:table-cell">{r.cliente}</td>
                      <td className="px-3 py-1.5">
                        <div>{r.tienda}</div>
                        <div className="text-[10px] text-muted-foreground sm:hidden">{r.cliente}</div>
                      </td>
                      <td className={`px-2 py-1.5 text-center tabular-nums ${cellBg(r.cb_lavado)}`}>
                        {r.cb_lavado != null ? `${r.cb_lavado.toFixed(0)}%` : "—"}
                      </td>
                      <td className={`px-2 py-1.5 text-center tabular-nums ${cellBg(r.cb_refri)}`}>
                        {r.cb_refri != null ? `${r.cb_refri.toFixed(0)}%` : "—"}
                      </td>
                      <td className={`px-2 py-1.5 text-center tabular-nums ${cellBg(r.cb_coccion)}`}>
                        {r.cb_coccion != null ? `${r.cb_coccion.toFixed(0)}%` : "—"}
                      </td>
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

