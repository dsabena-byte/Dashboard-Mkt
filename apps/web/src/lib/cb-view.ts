// Vista de /cuadros-basicos (totales, evolución, división, cliente, tienda, opciones de filtros) desde filas CB.
// La vista DEFAULT (sin filtros) se precalcula en cada carga (tr_precalc 'cb_default') → el tablero la lee al
// instante; con filtros se computa sobre vw_tr_cb_agg.
import { PERSONA_PLACEHOLDERS } from "./fs-enrich";
import {
  computeTotals, computeWeeklyEvolution, computeByDivision, computeByDim, computeByTienda, isoWeekToMes,
  type CbFilter, type CbRow,
} from "./cb-queries";

export interface CbView {
  options: { meses: string[]; semanas: number[]; divisiones: string[]; supervisores: string[]; promotores: string[]; clientes: string[]; tiendas: string[] };
  totals: ReturnType<typeof computeTotals>;
  weekly: ReturnType<typeof computeWeeklyEvolution>;
  byDiv: ReturnType<typeof computeByDivision>;
  byCliente: ReturnType<typeof computeByDim>;
  byPromotor: ReturnType<typeof computeByDim>;
  /** Por zona del maestro de tiendas (mapa): objetivos y cumplidos para sumar lo que entra en la vista. */
  byZona?: CbZona[];
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
    (!f.supervisores?.length || f.supervisores.includes(r.supervisor ?? "")) &&
    (!f.promotores?.length || f.promotores.includes(r.promotor ?? "")) &&
    (!f.tiendas?.length || f.tiendas.includes(r.tienda)));
}

export function isCbDefault(f: CbFilter): boolean {
  return !(f.meses?.length || f.semanas?.length || f.divisiones?.length || f.clientes?.length || f.tiendas?.length
    || f.supervisores?.length || f.promotores?.length);
}

export function computeCbView(allRows: CbRow[], filter: CbFilter): CbView {
  const rows = applyCbFilter(allRows, filter);
  const options = {
    meses: uniq(applyCbFilter(allRows, { ...filter, meses: [] }).map((r) => isoWeekToMes(r.semana))).sort((a, b) => MES_ORDER.indexOf(a) - MES_ORDER.indexOf(b)),
    semanas: uniq(applyCbFilter(allRows, { ...filter, semanas: [] }).map((r) => r.semana)).sort((a, b) => a - b),
    divisiones: uniq(applyCbFilter(allRows, { ...filter, divisiones: [] }).map((r) => r.division || null)).sort(),
    supervisores: uniq(applyCbFilter(allRows, { ...filter, supervisores: [] }).map((r) => r.supervisor)).sort(),
    promotores: uniq(applyCbFilter(allRows, { ...filter, promotores: [] }).map((r) => r.promotor)).sort(),
    clientes: uniq(applyCbFilter(allRows, { ...filter, clientes: [] }).map((r) => r.cliente)).sort(),
    tiendas: uniq(applyCbFilter(allRows, { ...filter, tiendas: [] }).map((r) => r.tienda)).sort(),
  };
  return {
    options,
    totals: computeTotals(rows),
    weekly: computeWeeklyEvolution(rows),
    byDiv: computeByDivision(rows),
    byCliente: computeByDim(rows, "cliente").filter((r) => !PERSONA_PLACEHOLDERS.has(r.key)),
    byPromotor: computeByDim(rows, "promotor").filter((r) => !PERSONA_PLACEHOLDERS.has(r.key)),
    byZona: computeCbZonas(rows),
    // Todas las tiendas, peor % CB primero (= app vieja).
    byTienda: computeByTienda(rows).sort((a, b) => (a.cb_total ?? 0) - (b.cb_total ?? 0)),
    totalTiendasRelevadas: new Set(allRows.map((r) => r.tienda)).size,
    hasData: rows.length > 0,
  };
}

export type CbZona = { zona: string; tiendas: number; cb: [number, number]; inf: [number, number]; est: [number, number] };
/** [cumplidos, objetivo] por zona; Estratégico = CB − Infaltable (= app vieja). */
export function computeCbZonas(rows: CbRow[]): CbZona[] {
  const m = new Map<string, { t: Set<string>; cb: [number, number]; inf: [number, number] }>();
  for (const r of rows) {
    const z = r.geo ? `${r.tienda}@${r.geo}` : r.zona || "Sin zona"; // tienda geocodificada = su propio punto
    const e = m.get(z) ?? { t: new Set<string>(), cb: [0, 0], inf: [0, 0] };
    e.t.add(r.tienda); e.cb[0] += r.real_cb ?? 0; e.cb[1] += r.target_cb ?? 0; e.inf[0] += r.real_inf ?? 0; e.inf[1] += r.target_inf ?? 0;
    m.set(z, e);
  }
  return [...m].map(([zona, e]) => ({ zona, tiendas: e.t.size, cb: e.cb, inf: e.inf, est: [e.cb[0] - e.inf[0], e.cb[1] - e.inf[1]] }));
}

// ── Detalle de SKUs de una tienda o cliente (= app vieja): cada SKU es Infaltable si targetCB = targetInf. ──
export type CbSkuDet = { sku: string; division: string; target: number; real: number; pct: number; cumple: boolean; nTiendas: number; nTiendasCumplen: number };
export function computeSkuDetalle(rows: CbRow[]): { infaltables: CbSkuDet[]; estrategicos: CbSkuDet[]; tiendas: number } {
  const map = new Map<string, { sku: string; inf: boolean; division: string; t: number; r: number; tiendas: Set<string>; ok: Set<string> }>();
  for (const x of rows) {
    const inf = (x.target_cb ?? 0) - (x.target_inf ?? 0) === 0;
    const k = `${x.sku}|${inf}`;
    const e = map.get(k) ?? { sku: x.sku, inf, division: x.division, t: 0, r: 0, tiendas: new Set<string>(), ok: new Set<string>() };
    const tgt = inf ? x.target_inf ?? 0 : (x.target_cb ?? 0) - (x.target_inf ?? 0);
    const rl = inf ? x.real_inf ?? 0 : (x.real_cb ?? 0) - (x.real_inf ?? 0);
    e.t += tgt; e.r += rl; e.tiendas.add(x.tienda);
    if (tgt > 0 && rl >= tgt) e.ok.add(x.tienda);
    map.set(k, e);
  }
  const all = [...map.values()].filter((e) => e.t > 0).map((e) => ({
    inf: e.inf, sku: e.sku, division: e.division, target: e.t, real: e.r, pct: Math.min(100, (e.r / e.t) * 100),
    cumple: e.r >= e.t, nTiendas: e.tiendas.size, nTiendasCumplen: e.ok.size,
  }));
  const orden = (a: CbSkuDet, b: CbSkuDet) => Number(a.cumple) - Number(b.cumple) || b.nTiendas - a.nTiendas || a.sku.localeCompare(b.sku);
  const sinInf = ({ inf: _i, ...d }: (typeof all)[number]): CbSkuDet => d;
  return {
    infaltables: all.filter((e) => e.inf).map(sinInf).sort(orden),
    estrategicos: all.filter((e) => !e.inf).map(sinInf).sort(orden),
    tiendas: new Set(rows.map((r) => r.tienda)).size,
  };
}
