import "server-only";

// Cómputo de la vista de Floor Share (rankings, tablas, overall, weekly, opciones)
// desde las filas crudas. Se usa en DOS lugares:
//  - el cron cb-mirror precalcula la vista DEFAULT (últimas 26 sem, sin filtro) y la
//    guarda como JSON en fs_precomputed → el dash la lee al instante (sin agregar 135k
//    filas en cada visita, que costaba ~6s).
//  - el dash, cuando hay filtros activos, la computa sobre las filas traídas (fallback).

import {
  normalizeCategoria, shareByBrand, shareByCatBrand, shareByTienda, shareByCliente,
  computeOverall, weeklyShareByBrand, OWN_BRAND_FS,
  type FloorShareRow, type FloorShareFilter,
} from "./floor-share-queries";
import { isoWeekToMes } from "./cb-queries";

export type FsEnrichedRow = FloorShareRow & { cliente: string };

export interface FsView {
  options: {
    meses: string[];
    semanas: number[];
    categorias: string[];
    clientes: string[];
    tiendas: { value: string; label: string }[];
  };
  totalRanking: ReturnType<typeof shareByBrand>;
  catBrand: ReturnType<typeof shareByCatBrand>;
  cats: string[];
  byTienda: ReturnType<typeof shareByTienda>;
  byCliente: ReturnType<typeof shareByCliente>;
  overall: ReturnType<typeof computeOverall>;
  top5: string[];
  weekly: ReturnType<typeof weeklyShareByBrand>;
  totalTiendasRelevadas: number;
  hasData: boolean;
}

const MES_ORDER = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const uniq = <T,>(arr: (T | null | undefined)[]): T[] => [...new Set(arr.filter((x): x is T => x != null))];

function applyFilter(rs: FsEnrichedRow[], f: FloorShareFilter): FsEnrichedRow[] {
  return rs.filter((r) => {
    if (r.semana == null) return false;
    if (f.meses && f.meses.length > 0 && !f.meses.includes(isoWeekToMes(r.semana))) return false;
    if (f.semanas && f.semanas.length > 0 && !f.semanas.includes(r.semana)) return false;
    if (f.categorias && f.categorias.length > 0 && !f.categorias.includes(normalizeCategoria(r.categoria ?? ""))) return false;
    if (f.clientes && f.clientes.length > 0 && !f.clientes.includes(r.cliente)) return false;
    if (f.tiendas && f.tiendas.length > 0 && !f.tiendas.includes(r.numero_tienda ?? "")) return false;
    if (f.marcas && f.marcas.length > 0 && !f.marcas.includes(r.marca ?? "")) return false;
    return true;
  });
}

export function computeFsView(allRows: FsEnrichedRow[], filter: FloorShareFilter): FsView {
  const rows = applyFilter(allRows, filter);

  const options: FsView["options"] = {
    meses: uniq(applyFilter(allRows, { ...filter, meses: [] }).map((r) => isoWeekToMes(r.semana)))
      .sort((a, b) => MES_ORDER.indexOf(a) - MES_ORDER.indexOf(b)),
    semanas: uniq(applyFilter(allRows, { ...filter, semanas: [] }).map((r) => r.semana)).sort((a, b) => a - b),
    categorias: uniq(applyFilter(allRows, { ...filter, categorias: [] }).map((r) => normalizeCategoria(r.categoria))).sort(),
    clientes: uniq(applyFilter(allRows, { ...filter, clientes: [] }).map((r) => r.cliente)).sort(),
    tiendas: uniq(applyFilter(allRows, { ...filter, tiendas: [] })
      .map((r) => ({ value: r.numero_tienda, label: r.nombre_tienda ?? r.numero_tienda })))
      .filter((v, i, arr) => arr.findIndex((x) => x.value === v.value) === i)
      .sort((a, b) => a.label.localeCompare(b.label, "es", { sensitivity: "base" })),
  };

  const totalRanking = shareByBrand(rows);
  const catBrand = shareByCatBrand(rows);
  const byTienda = shareByTienda(rows);
  const byCliente = shareByCliente(rows);
  const overall = computeOverall(rows);

  const top5 = totalRanking.slice(0, 5).map((r) => r.marca);
  if (!top5.includes(OWN_BRAND_FS) && rows.some((r) => r.marca === OWN_BRAND_FS)) top5.unshift(OWN_BRAND_FS);
  const weekly = weeklyShareByBrand(rows, top5);

  const cats = uniq(rows.map((r) => normalizeCategoria(r.categoria))).sort();
  const totalTiendasRelevadas = new Set(allRows.map((r) => r.numero_tienda)).size;

  return { options, totalRanking, catBrand, cats, byTienda, byCliente, overall, top5, weekly, totalTiendasRelevadas, hasData: rows.length > 0 };
}

// ¿El filtro es la vista DEFAULT (sin nada seleccionado)? → puede leerse del precálculo.
export function isFsDefault(f: FloorShareFilter): boolean {
  return !(f.meses?.length || f.semanas?.length || f.categorias?.length || f.clientes?.length || f.tiendas?.length || f.marcas?.length);
}
