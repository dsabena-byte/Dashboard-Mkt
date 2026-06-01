import { KpiCard } from "@/components/kpi-card";
import { CbFiltersBar } from "@/components/cb/cb-filters";
import { CbWeeklyChart } from "@/components/cb/cb-weekly-chart";
import { CbCategoryChart } from "@/components/cb/cb-category-chart";
import {
  computeTotals,
  computeWeeklyEvolution,
  computeByDivision,
  computeByDim,
  computeByTienda,
  getCbFilterOptions,
  getCbRows,
  type CbFilter,
} from "@/lib/cb-queries";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Record<string, string | string[] | undefined>;
}

function param(searchParams: PageProps["searchParams"], key: string): string | undefined {
  const v = searchParams[key];
  if (Array.isArray(v)) return v[0];
  return v;
}

const OBJ_PCT = 80;

function deltaPp(value: number): string {
  const diff = value - OBJ_PCT;
  return `${diff >= 0 ? "+" : ""}${diff.toFixed(1)} pp`;
}

function deltaClass(value: number): string {
  return value >= OBJ_PCT ? "text-emerald-600" : "text-rose-600";
}

function cellBg(pct: number | null): string {
  if (pct == null) return "text-muted-foreground";
  if (pct >= 80) return "bg-emerald-50 text-emerald-700";
  if (pct >= 60) return "bg-amber-50 text-amber-700";
  return "bg-rose-50 text-rose-700";
}

export default async function CuadrosBasicosPage({ searchParams }: PageProps) {
  const filter: CbFilter = {
    semana: param(searchParams, "semana") ? Number(param(searchParams, "semana")) : undefined,
    division: param(searchParams, "division"),
    cliente: param(searchParams, "cliente"),
    tienda: param(searchParams, "tienda"),
  };

  const [rows, options] = await Promise.all([
    getCbRows(filter),
    getCbFilterOptions(),
  ]);

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

      <CbFiltersBar current={filter} options={options} />

      {!hasData ? (
        <div className="rounded-lg border bg-amber-50 p-4 text-sm text-amber-900">
          Sin datos para los filtros seleccionados.
        </div>
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              title="% Cuadro Básico"
              value={`${totals.cb_pct.toFixed(0)}%`}
              hint={`${totals.cb_ok.toLocaleString()} / ${totals.cb_target.toLocaleString()} · Obj 80% (${deltaPp(totals.cb_pct)})`}
            />
            <KpiCard
              title="% Infaltables"
              value={`${totals.infalt_pct.toFixed(0)}%`}
              hint={`${totals.infalt_ok.toLocaleString()} / ${totals.infalt_target.toLocaleString()} · ${deltaPp(totals.infalt_pct)}`}
            />
            <KpiCard
              title="% Estratégico"
              value={`${totals.estrat_pct.toFixed(0)}%`}
              hint={`${totals.estrat_ok.toLocaleString()} / ${totals.estrat_target.toLocaleString()} · ${deltaPp(totals.estrat_pct)}`}
            />
            <KpiCard
              title="Tiendas"
              value={String(totals.tiendas)}
              hint="auditadas en el período"
            />
          </section>

          <section className="rounded-xl border bg-card p-4">
            <h3 className="mb-3 text-sm font-bold">📈 Evolución semanal</h3>
            <CbWeeklyChart data={weekly} />
          </section>

          <section className="rounded-xl border bg-card p-4">
            <h3 className="mb-3 text-sm font-bold">📊 Cumplimiento por División</h3>
            <CbCategoryChart data={byDiv} />
          </section>

          <section className="rounded-xl border bg-card">
            <div className="border-b px-4 py-3">
              <h3 className="text-sm font-bold">🏬 Cumplimiento por Cliente / Cadena</h3>
              <p className="text-[11px] text-muted-foreground">Top 30 por % CB. Δ vs objetivo 80%.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/40 text-[10px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">Cliente/Cadena</th>
                    <th className="px-2 py-2 text-right">% CB</th>
                    <th className="px-2 py-2 text-right">Δ</th>
                    <th className="px-2 py-2 text-right">% Inf.</th>
                    <th className="px-2 py-2 text-right">Δ</th>
                    <th className="px-2 py-2 text-right">% Est.</th>
                    <th className="px-2 py-2 text-right">Δ</th>
                  </tr>
                </thead>
                <tbody>
                  {byCliente.slice(0, 30).map((r) => (
                    <tr key={r.key} className="border-b last:border-0">
                      <td className="px-3 py-1.5 font-medium">{r.key}</td>
                      <td className={`px-2 py-1.5 text-right tabular-nums ${cellBg(r.cb_pct)}`}>{r.cb_pct.toFixed(0)}%</td>
                      <td className={`px-2 py-1.5 text-right tabular-nums ${deltaClass(r.cb_pct)}`}>{deltaPp(r.cb_pct)}</td>
                      <td className={`px-2 py-1.5 text-right tabular-nums ${cellBg(r.infalt_pct)}`}>{r.infalt_pct.toFixed(0)}%</td>
                      <td className={`px-2 py-1.5 text-right tabular-nums ${deltaClass(r.infalt_pct)}`}>{deltaPp(r.infalt_pct)}</td>
                      <td className={`px-2 py-1.5 text-right tabular-nums ${cellBg(r.estrat_pct)}`}>{r.estrat_pct.toFixed(0)}%</td>
                      <td className={`px-2 py-1.5 text-right tabular-nums ${deltaClass(r.estrat_pct)}`}>{deltaPp(r.estrat_pct)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-xl border bg-card">
            <div className="border-b px-4 py-3">
              <h3 className="text-sm font-bold">📋 Detalle por Tienda</h3>
              <p className="text-[11px] text-muted-foreground">% CB desglosado por división. Top 50 por defecto.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/40 text-[10px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">Cliente</th>
                    <th className="px-3 py-2 text-left">Tienda</th>
                    <th className="px-2 py-2 text-right">% CB Lavado</th>
                    <th className="px-2 py-2 text-right">% CB Refri</th>
                    <th className="px-2 py-2 text-right">% CB Cocción</th>
                  </tr>
                </thead>
                <tbody>
                  {byTienda.slice(0, 50).map((r, i) => (
                    <tr key={`${r.cliente}-${r.tienda}-${i}`} className="border-b last:border-0">
                      <td className="px-3 py-1.5 text-muted-foreground">{r.cliente}</td>
                      <td className="px-3 py-1.5">{r.tienda}</td>
                      <td className={`px-2 py-1.5 text-right tabular-nums ${cellBg(r.cb_lavado)}`}>
                        {r.cb_lavado != null ? `${r.cb_lavado.toFixed(0)}%` : "—"}
                      </td>
                      <td className={`px-2 py-1.5 text-right tabular-nums ${cellBg(r.cb_refri)}`}>
                        {r.cb_refri != null ? `${r.cb_refri.toFixed(0)}%` : "—"}
                      </td>
                      <td className={`px-2 py-1.5 text-right tabular-nums ${cellBg(r.cb_coccion)}`}>
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
