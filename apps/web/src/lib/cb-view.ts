// Vista de /cuadros-basicos (totales, evolución, división, cliente, tienda, opciones de filtros) desde filas CB.
// La vista DEFAULT (sin filtros) se precalcula en cada carga (tr_precalc 'cb_default') → el tablero la lee al
// instante; con filtros se computa sobre vw_tr_cb_agg.
import {
  computeTotals, computeWeeklyEvolution, computeByDivision, computeByDim, computeByTienda, isoWeekToMes,
  type CbFilter, type CbRow,
} from "./cb-queries";

export interface CbView {
  options: { meses: string[]; semanas: number[]; divisiones: string[]; clientes: string[]; tiendas: string[] };
  totals: ReturnType<typeof computeTotals>;
  weekly: ReturnType<typeof computeWeeklyEvolution>;
  byDiv: ReturnType<typeof computeByDivision>;
  byCliente: ReturnType<typeof computeByDim>;
  /** Top 50 (lo que muestra el tablero), no todas las tiendas. */
  byTienda: ReturnType<typeof computeByTienda>;
  totalTiendasRelevadas: number;
  hasData: boolean;
}

const MES_ORDER = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const uniq = <T,>(arr: (T | null | undefined)[]): T[] => [...new Set(arr.filter((x): x is T => x != null))];

export function applyCbFilter(rs: CbRow[], f: CbFilter): CbRow[] {
  return rs.filter((r) =>
    (!f.meses?.length || f.meses.includes(isoWeekToMes(r.semana))) &&
    (!f.semanas?.length || f.semanas.includes(r.semana)) &&
    (!f.divisiones?.length || f.divisiones.includes(r.division)) &&
    (!f.clientes?.length || f.clientes.includes(r.cliente)) &&
    (!f.tiendas?.length || f.tiendas.includes(r.tienda)));
}

export function isCbDefault(f: CbFilter): boolean {
  return !(f.meses?.length || f.semanas?.length || f.divisiones?.length || f.clientes?.length || f.tiendas?.length);
}

export function computeCbView(allRows: CbRow[], filter: CbFilter): CbView {
  const rows = applyCbFilter(allRows, filter);
  const options = {
    meses: uniq(applyCbFilter(allRows, { ...filter, meses: [] }).map((r) => isoWeekToMes(r.semana))).sort((a, b) => MES_ORDER.indexOf(a) - MES_ORDER.indexOf(b)),
    semanas: uniq(applyCbFilter(allRows, { ...filter, semanas: [] }).map((r) => r.semana)).sort((a, b) => a - b),
    divisiones: uniq(applyCbFilter(allRows, { ...filter, divisiones: [] }).map((r) => r.division)).sort(),
    clientes: uniq(applyCbFilter(allRows, { ...filter, clientes: [] }).map((r) => r.cliente)).sort(),
    tiendas: uniq(applyCbFilter(allRows, { ...filter, tiendas: [] }).map((r) => r.tienda)).sort(),
  };
  return {
    options,
    totals: computeTotals(rows),
    weekly: computeWeeklyEvolution(rows),
    byDiv: computeByDivision(rows),
    byCliente: computeByDim(rows, "cliente"),
    byTienda: computeByTienda(rows).slice(0, 50),
    totalTiendasRelevadas: new Set(allRows.map((r) => r.tienda)).size,
    hasData: rows.length > 0,
  };
}
