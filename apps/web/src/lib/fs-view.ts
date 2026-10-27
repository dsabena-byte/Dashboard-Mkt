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
import { PERSONA_PLACEHOLDERS } from "./fs-enrich";

/** Fila con cliente/promotor/supervisor (lib/fs-enrich). La tienda se identifica por número + nombre. */
export type FsEnrichedRow = FloorShareRow & { cliente: string; promotor: string; supervisor: string; zona?: string; geo?: string };
export const tiendaKeyFs = (r: { numero_tienda: string; nombre_tienda: string | null }) => `${r.numero_tienda}|${r.nombre_tienda ?? ""}`;
const NO_MARCA = new Set(["otros", "total"]);

export interface FsView {
  options: {
    meses: string[];
    semanas: number[];
    categorias: string[];
    clientes: string[];
    supervisores: string[];
    promotores: string[];
    tiendas: { value: string; label: string }[];
  };
  totalRanking: ReturnType<typeof shareByBrand>;
  catBrand: ReturnType<typeof shareByCatBrand>;
  cats: string[];
  byTienda: ReturnType<typeof shareByTienda>;
  byCliente: ReturnType<typeof shareByCliente>;
  byPromotor: ReturnType<typeof shareByCliente>;
  /** Para el mapa: `cliente` = zona, o "N - tienda@lat|lon|prov" si la tienda tiene dirección geocodificada. */
  byZona?: ReturnType<typeof shareByCliente>;
  overall: ReturnType<typeof computeOverall>;
  /** Drean + top 9 marcas (= app vieja). La evolución semanal ignora los filtros de mes y semana. */
  topMarcas: string[];
  weekly: ReturnType<typeof weeklyShareByBrand>;
  totalTiendasRelevadas: number;
  /** Semanas del período mostrado (para el subtítulo "Abril 2026 — Octubre 2026"). */
  semanaDesde: number | null;
  semanaHasta: number | null;
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
    if (f.supervisores && f.supervisores.length > 0 && !f.supervisores.includes(r.supervisor)) return false;
    if (f.promotores && f.promotores.length > 0 && !f.promotores.includes(r.promotor)) return false;
    if (f.tiendas && f.tiendas.length > 0 && !f.tiendas.includes(tiendaKeyFs(r))) return false;
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
    supervisores: uniq(applyFilter(allRows, { ...filter, supervisores: [] }).map((r) => r.supervisor)).sort(),
    promotores: uniq(applyFilter(allRows, { ...filter, promotores: [] }).map((r) => r.promotor)).sort(),
    tiendas: [...new Map(applyFilter(allRows, { ...filter, tiendas: [] })
      .map((r) => [tiendaKeyFs(r), { value: tiendaKeyFs(r), label: `${r.numero_tienda} - ${r.nombre_tienda ?? ""}` }])).values()]
      .sort((a, b) => a.label.localeCompare(b.label, "es", { sensitivity: "base", numeric: true })),
  };

  const totalRanking = shareByBrand(rows);
  const catBrand = shareByCatBrand(rows);
  const byTienda = shareByTienda(applyFilter(allRows, { ...filter, tiendas: [] }));
  // Cada tabla ignora su propio filtro (= app vieja) y saca los "sin asignar".
  const byCliente = shareByCliente(applyFilter(allRows, { ...filter, clientes: [] }).filter((r) => !PERSONA_PLACEHOLDERS.has(r.cliente)));
  const byPromotor = shareByCliente(applyFilter(allRows, { ...filter, promotores: [] })
    .filter((r) => !PERSONA_PLACEHOLDERS.has(r.promotor)).map((r) => ({ ...r, cliente: r.promotor })));
  const overall = computeOverall(rows);
  const byZona = shareByCliente(rows.map((r) => ({ ...r, cliente: r.geo ? `${r.numero_tienda} - ${r.nombre_tienda}@${r.geo}` : r.zona || "Sin zona" })));

  // Evolución semanal: Drean + top 9 sin los filtros de mes/semana (se ve toda la serie).
  const evolRows = applyFilter(allRows, { ...filter, meses: [], semanas: [] });
  const topMarcas = [OWN_BRAND_FS, ...shareByBrand(evolRows).map((r) => r.marca)
    .filter((m) => m !== OWN_BRAND_FS && !NO_MARCA.has(m.toLowerCase())).slice(0, 9)];
  const weekly = weeklyShareByBrand(evolRows, topMarcas);

  const cats = uniq(rows.map((r) => normalizeCategoria(r.categoria))).sort();
  const totalTiendasRelevadas = new Set(rows.map(tiendaKeyFs)).size;
  let semMin = Infinity, semMax = -Infinity; // sin spread: son ~140k filas
  for (const r of rows) { if (r.semana < semMin) semMin = r.semana; if (r.semana > semMax) semMax = r.semana; }

  return {
    options, totalRanking, catBrand, cats, byTienda, byCliente, byPromotor, byZona, overall, topMarcas, weekly, totalTiendasRelevadas,
    semanaDesde: rows.length ? semMin : null, semanaHasta: rows.length ? semMax : null,
    hasData: rows.length > 0,
  };
}

// ¿El filtro es la vista DEFAULT (sin nada seleccionado)? → puede leerse del precálculo.
export function isFsDefault(f: FloorShareFilter): boolean {
  return !(f.meses?.length || f.semanas?.length || f.categorias?.length || f.clientes?.length || f.tiendas?.length || f.marcas?.length
    || f.supervisores?.length || f.promotores?.length);
}
