import { CbFiltersBar } from "@/components/cb/cb-filters";
import { CbWeeklyChart } from "@/components/cb/cb-weekly-chart";
import { CbCategoryChart } from "@/components/cb/cb-category-chart";
import { CbTabsNav } from "@/components/cb/cb-tabs-nav";
import { CbSuggestionsTab } from "@/components/cb/cb-suggestions-tab";
import {
  computeTotals,
  computeWeeklyEvolution,
  computeByDivision,
  computeByDim,
  computeByTienda,
  getCbRows,
  getTotalTiendasRelevadasCB,
  getCbBaselineMedidas,
  getCbSuggestions,
  isoWeekToMes,
  type CbFilter,
  type CbRow,
} from "@/lib/cb-queries";

export const dynamic = "force-dynamic";

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

export default async function CuadrosBasicosPage({ searchParams }: PageProps) {
  const tab = typeof searchParams.tab === "string" ? searchParams.tab : "overview";

  // Tab "sugerencias": render aislado, no toca la lógica del overview existente
  if (tab === "sugerencias") {
    let baseline: Awaited<ReturnType<typeof getCbBaselineMedidas>> = {
      cb_pct_avg: null, infalt_pct_avg: null, tiendas_medidas: 0,
      cb_ok_total: 0, cb_target_total: 0, infalt_ok_total: 0, infalt_target_total: 0,
    };
    let suggestions: Awaited<ReturnType<typeof getCbSuggestions>> = [];
    let sugError: string | null = null;
    try {
      [baseline, suggestions] = await Promise.all([
        getCbBaselineMedidas(),
        getCbSuggestions(),
      ]);
    } catch (err) {
      sugError = err instanceof Error ? err.message : String(err);
    }
    return (
      <div className="space-y-4">
        <header>
          <h2 className="text-2xl font-semibold tracking-tight">Cuadros Básicos</h2>
          <p className="text-sm text-muted-foreground">
            Cumplimiento de cuadro básico, infaltables y estratégico por tienda. Objetivo: 80%.
          </p>
        </header>
        <CbTabsNav />
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
        <CbSuggestionsTab baseline={baseline} suggestions={suggestions} />
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

  // Trae TODO una sola vez y filtra en JS. La tabla es chica (~6K rows)
  // y nos permite armar filtros encadenados (elegir Cliente acota Tienda)
  // sin múltiples queries.
  let allRows: CbRow[] = [];
  let fetchError: string | null = null;
  let totalTiendasRelevadas = 0;
  try {
    const [rows, totalTiendas] = await Promise.all([
      getCbRows({}),
      getTotalTiendasRelevadasCB(),
    ]);
    allRows = rows;
    totalTiendasRelevadas = totalTiendas;
  } catch (err) {
    fetchError = err instanceof Error ? err.message : String(err);
  }

  function applyFilter(rs: CbRow[], f: CbFilter): CbRow[] {
    return rs.filter((r) =>
      (!f.meses || f.meses.length === 0 || f.meses.includes(isoWeekToMes(r.semana))) &&
      (!f.semanas || f.semanas.length === 0 || f.semanas.includes(r.semana)) &&
      (!f.divisiones || f.divisiones.length === 0 || f.divisiones.includes(r.division)) &&
      (!f.clientes || f.clientes.length === 0 || f.clientes.includes(r.cliente)) &&
      (!f.tiendas || f.tiendas.length === 0 || f.tiendas.includes(r.tienda))
    );
  }

  const rows = applyFilter(allRows, filter);

  // Opciones: cada dropdown muestra valores válidos según el resto de los filtros
  const uniq = <T,>(arr: (T | null | undefined)[]): T[] =>
    [...new Set(arr.filter((x): x is T => x != null))];

  const MES_ORDER = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  const options = {
    meses: uniq(applyFilter(allRows, { ...filter, meses: [] }).map((r) => isoWeekToMes(r.semana)))
      .sort((a, b) => MES_ORDER.indexOf(a) - MES_ORDER.indexOf(b)),
    semanas: uniq(applyFilter(allRows, { ...filter, semanas: [] }).map((r) => r.semana)).sort((a, b) => a - b),
    divisiones: uniq(applyFilter(allRows, { ...filter, divisiones: [] }).map((r) => r.division)).sort(),
    clientes: uniq(applyFilter(allRows, { ...filter, clientes: [] }).map((r) => r.cliente)).sort(),
    tiendas: uniq(applyFilter(allRows, { ...filter, tiendas: [] }).map((r) => r.tienda)).sort(),
  };

  const totals = computeTotals(rows);
  const weekly = computeWeeklyEvolution(rows);
  const byDiv = computeByDivision(rows);
  const byCliente = computeByDim(rows, "cliente");
  const byTienda = computeByTienda(rows);

  const hasData = rows.length > 0;

  return (
    <div className="space-y-4">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight">Cuadros Básicos</h2>
        <p className="text-sm text-muted-foreground">
          Cumplimiento de cuadro básico, infaltables y estratégico por tienda. Objetivo: 80%.
        </p>
      </header>

      <CbTabsNav />

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
            <div className="rounded-xl bg-[#0a1849] p-5 text-white">
              <div className="text-[10px] font-semibold uppercase tracking-wide opacity-80">
                Cuadro Básico Drean — Cumplimiento global
              </div>
              <div className="mt-2 text-4xl font-bold text-rose-300">
                {totals.cb_pct.toFixed(1)}%
              </div>
              <div className="mt-2 text-[11px] opacity-80">
                {totalTiendasRelevadas} tiendas relevadas · {totals.cb_ok.toLocaleString()} cumplidos / {totals.cb_target.toLocaleString()} target
              </div>
            </div>
            <CbMetricCard label="Infaltables" pct={totals.infalt_pct} ok={totals.infalt_ok} target={totals.infalt_target} obj={OBJ_PCT} />
            <CbMetricCard label="Estratégico" pct={totals.estrat_pct} ok={totals.estrat_ok} target={totals.estrat_target} obj={OBJ_PCT} />
            <div className="rounded-xl border bg-card p-5">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Tiendas relevadas</div>
              <div className="mt-1 text-3xl font-bold text-rose-500">{totalTiendasRelevadas}</div>
              <div className="mt-1 text-[11px] text-muted-foreground tabular-nums">Universo histórico</div>
              <div className="mt-3 border-t pt-2 text-[11px] flex items-center justify-between">
                <span className="text-muted-foreground">Con data filtrada</span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold tabular-nums text-slate-700">
                  {totals.tiendas}
                </span>
              </div>
            </div>
          </section>

          {weekly.length > 1 && (
            <section className="rounded-xl border bg-card p-4">
              <h3 className="mb-3 text-sm font-bold">📈 Evolución semanal</h3>
              <CbWeeklyChart data={weekly} />
            </section>
          )}

          <section className="rounded-xl border bg-card p-4">
            <h3 className="mb-3 text-sm font-bold">📊 Cumplimiento por División</h3>
            <CbCategoryChart data={byDiv} />
          </section>

          <section className="rounded-xl border bg-card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3">
              <h3 className="text-sm font-bold">🏬 Cumplimiento por Cliente / Cadena</h3>
              <span className="text-[11px] text-muted-foreground">Δ vs objetivo 80%</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-[#0a1849] text-white">
                  <tr>
                    <th rowSpan={2} className="border-r border-white/10 px-3 py-2 text-left align-bottom">Cliente/Cadena</th>
                    <th colSpan={2} className="border-r border-white/10 px-3 py-1 text-center text-[11px] uppercase tracking-wide">% CB</th>
                    <th colSpan={2} className="hidden border-r border-white/10 px-3 py-1 text-center text-[11px] uppercase tracking-wide md:table-cell">% Infaltables</th>
                    <th colSpan={2} className="hidden px-3 py-1 text-center text-[11px] uppercase tracking-wide md:table-cell">% Estratégico</th>
                  </tr>
                  <tr className="text-[10px] uppercase tracking-wide opacity-80">
                    <th className="px-2 py-1 text-right">%</th>
                    <th className="border-r border-white/10 px-2 py-1 text-right">Δ</th>
                    <th className="hidden px-2 py-1 text-right md:table-cell">%</th>
                    <th className="hidden border-r border-white/10 px-2 py-1 text-right md:table-cell">Δ</th>
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
                  <tr className="bg-[#0a1849] text-white font-bold">
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

function CbMetricCard({ label, pct, ok, target, obj }: { label: string; pct: number; ok: number; target: number; obj: number }) {
  const delta = pct - obj;
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-3xl font-bold text-rose-500">{pct.toFixed(1)}%</div>
      <div className="mt-1 text-[11px] text-muted-foreground tabular-nums">
        {ok.toLocaleString()} / {target.toLocaleString()}
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
