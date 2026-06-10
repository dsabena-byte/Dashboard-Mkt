import "server-only";
import { getCbSupabase } from "./supabase-cb";
import { isoWeekToMes } from "./cb-queries";

// ============================================================================
// Floor Share — queries contra cuadros-basicos.supabase / tabla floor_share
// ----------------------------------------------------------------------------
// Tabla: floor_share
//   periodo         text   -- "2026-W14"
//   semana          int    -- 14
//   categoria       text   -- "coccion" / "lavado" / "refrigeracion" (lowercase)
//   numero_tienda   text
//   nombre_tienda   text
//   marca           text   -- "Drean", "Electrolux", "Whirlpool", ...
//   unidades        int    -- # de unidades en góndola para esa marca/cat/tienda
//   pct_raw         float  -- share (0..1) de la marca dentro de esa cat/tienda/sem
// ============================================================================

const TABLE = "floor_share";
// PostgREST default max_rows = 1000. Si pedimos más, igual nos devuelve 1000
// y el loop corta pensando que terminó. PAGE = 1000 hace que pagine bien.
const PAGE = 1000;

export interface FloorShareRow {
  periodo: string;
  semana: number;
  categoria: string;
  numero_tienda: string;
  nombre_tienda: string;
  marca: string;
  unidades: number;
  pct_raw: number;
}

export interface FloorShareFilter {
  meses?: string[];
  semanas?: number[];
  categorias?: string[];
  tiendas?: string[];
  clientes?: string[];
  marcas?: string[];
}

// Cuenta total de tiendas relevadas en floor_share: distinct numero_tienda
// con al menos una fila con datos reales (cualquier semana, cualquier categoría).
// Tiendas sin ninguna data no se cuentan. Sin filtro de período — es el
// universo histórico de relevamiento.
export async function getTotalTiendasRelevadas(): Promise<number> {
  const supabase = getCbSupabase();
  const ids = new Set<string>();
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data, error } = await supabase
      .from("floor_share")
      .select("numero_tienda")
      .range(from, from + PAGE - 1);
    if (error || !data) break;
    for (const r of data as Array<{ numero_tienda: string | null }>) {
      if (r.numero_tienda) ids.add(r.numero_tienda);
    }
    if (data.length < PAGE) break;
    from += PAGE;
    if (from > 200_000) break;
  }
  return ids.size;
}

// Devuelve el universo total de tiendas Drean (parseando el prefix numérico
// del campo `tienda` en cuadro_basico_semanal). El dash original de CB
// reporta este número como el "total tiendas" de Floor Share aunque algunas
// no tengan registro en la tabla floor_share.
export async function getUniversoTiendas(): Promise<number> {
  const supabase = getCbSupabase();
  const ids = new Set<string>();
  let from = 0;
  const PAGE_CB = 1000;
  while (true) {
    const { data, error } = await supabase
      .from("cuadro_basico_semanal")
      .select("tienda")
      .range(from, from + PAGE_CB - 1);
    if (error || !data) break;
    for (const r of data as Array<{ tienda: string | null }>) {
      if (!r.tienda) continue;
      const m = r.tienda.match(/^\s*(\d+)\s*[-–]/);
      if (m) ids.add(m[1]!);
    }
    if (data.length < PAGE_CB) break;
    from += PAGE_CB;
    if (from > 200_000) break;
  }
  return ids.size;
}

// Carga el mapping numero_tienda → cliente desde cuadro_basico_semanal.
// El campo "tienda" en CB viene como "74 - NOMBRE..." → extraemos el prefix.
// Paginamos por si la tabla tiene más de 10K rows.
export async function getTiendaClienteMap(): Promise<Map<string, string>> {
  const supabase = getCbSupabase();
  const map = new Map<string, string>();
  let from = 0;
  const PAGE_CB = 1000;
  while (true) {
    const { data, error } = await supabase
      .from("cuadro_basico_semanal")
      .select("tienda, cliente")
      .range(from, from + PAGE_CB - 1);
    if (error || !data) break;
    for (const r of data as Array<{ tienda: string | null; cliente: string | null }>) {
      if (!r.tienda || !r.cliente) continue;
      const match = r.tienda.match(/^\s*(\d+)\s*[-–]/);
      if (match) {
        map.set(match[1]!, r.cliente);
      }
    }
    if (data.length < PAGE_CB) break;
    from += PAGE_CB;
    if (from > 100_000) break;
  }
  return map;
}

// Devuelve las semanas disponibles, descendente. Usado para limitar el
// universo inicial (las últimas N semanas) y evitar fetchear 70K rows.
export async function getAvailableWeeks(): Promise<{ weeks: number[]; debug: string }> {
  const supabase = getCbSupabase();
  // Estrategia robusta: tomamos max(semana) y derivamos las últimas N semanas
  // hacia atrás. No podemos hacer .select("semana") con .range() porque la
  // tabla tiene ~12K rows por semana y la primera página queda toda en una.
  const { data, error } = await supabase
    .from(TABLE)
    .select("semana")
    .order("semana", { ascending: false })
    .limit(1);
  if (error) return { weeks: [], debug: `error: ${error.message} (code=${error.code})` };
  const maxRow = (data ?? [])[0] as { semana: number | null } | undefined;
  const maxSem = typeof maxRow?.semana === "number" ? maxRow.semana : null;
  if (maxSem == null) return { weeks: [], debug: "no max semana" };
  // Asumimos semanas continuas hacia atrás (12 últimas).
  const weeks: number[] = [];
  for (let i = 0; i < 26 && maxSem - i > 0; i++) weeks.push(maxSem - i);
  return { weeks, debug: `max=${maxSem} derived=${weeks.length}` };
}

export async function getFloorShareRows(filter: FloorShareFilter = {}): Promise<FloorShareRow[]> {
  const supabase = getCbSupabase();
  const all: FloorShareRow[] = [];
  let from = 0;
  while (true) {
    let q = supabase
      .from(TABLE)
      .select("periodo, semana, categoria, numero_tienda, nombre_tienda, marca, unidades, pct_raw")
      .range(from, from + PAGE - 1);
    if (filter.semanas && filter.semanas.length > 0) q = q.in("semana", filter.semanas);
    if (filter.categorias && filter.categorias.length > 0) q = q.in("categoria", filter.categorias);
    if (filter.tiendas && filter.tiendas.length > 0) q = q.in("numero_tienda", filter.tiendas);
    if (filter.marcas && filter.marcas.length > 0) q = q.in("marca", filter.marcas);
    const { data, error } = await q.returns<FloorShareRow[]>();
    if (error) {
      console.error(`[floor-share] ${TABLE}:`, error.message);
      return all;
    }
    const batch = data ?? [];
    all.push(...batch);
    if (batch.length < PAGE) break;
    from += PAGE;
    if (from > 200_000) break;
  }
  return all;
}

// ===== Agregaciones =====

export const OWN_BRAND_FS = "Drean";

export interface BrandShare {
  marca: string;
  unidades: number;
  share: number; // 0..100
}

// Share total por marca (sum unidades_marca / sum unidades_total)
export function shareByBrand(rows: FloorShareRow[]): BrandShare[] {
  const map = new Map<string, number>();
  let total = 0;
  for (const r of rows) {
    map.set(r.marca, (map.get(r.marca) ?? 0) + (r.unidades ?? 0));
    total += r.unidades ?? 0;
  }
  return [...map.entries()]
    .map(([marca, unidades]) => ({ marca, unidades, share: total > 0 ? (unidades / total) * 100 : 0 }))
    .sort((a, b) => b.share - a.share);
}

export interface CatBrandShare {
  categoria: string;
  marca: string;
  unidades: number;
  share: number;
}

// Share por (categoria, marca)
export function shareByCatBrand(rows: FloorShareRow[]): CatBrandShare[] {
  const catTotal = new Map<string, number>();
  const catMarca = new Map<string, number>();
  for (const r of rows) {
    catTotal.set(r.categoria, (catTotal.get(r.categoria) ?? 0) + (r.unidades ?? 0));
    const key = `${r.categoria}__${r.marca}`;
    catMarca.set(key, (catMarca.get(key) ?? 0) + (r.unidades ?? 0));
  }
  const out: CatBrandShare[] = [];
  for (const [key, unidades] of catMarca) {
    const [categoria, marca] = key.split("__");
    const tot = catTotal.get(categoria!) ?? 0;
    out.push({
      categoria: categoria!,
      marca: marca!,
      unidades,
      share: tot > 0 ? (unidades / tot) * 100 : 0,
    });
  }
  return out.sort((a, b) => (a.categoria ?? "").localeCompare(b.categoria ?? "") || b.share - a.share);
}

export interface WeeklyBrandPoint {
  semana: number;
  shares: Record<string, number>; // marca → share %
}

export function weeklyShareByBrand(rows: FloorShareRow[], topMarcas: string[]): WeeklyBrandPoint[] {
  const byWeek = new Map<number, { tot: number; perMarca: Map<string, number> }>();
  for (const r of rows) {
    const acc = byWeek.get(r.semana) ?? { tot: 0, perMarca: new Map() };
    acc.tot += r.unidades ?? 0;
    acc.perMarca.set(r.marca, (acc.perMarca.get(r.marca) ?? 0) + (r.unidades ?? 0));
    byWeek.set(r.semana, acc);
  }
  return [...byWeek.entries()]
    .sort(([a], [b]) => a - b)
    .map(([semana, v]) => {
      const shares: Record<string, number> = {};
      for (const m of topMarcas) {
        const u = v.perMarca.get(m) ?? 0;
        shares[m] = v.tot > 0 ? (u / v.tot) * 100 : 0;
      }
      return { semana, shares };
    });
}

// Objetivos por categoría (% share Drean)
export const FS_OBJ_PCT: Record<"lavado" | "refri" | "coccion", number> = {
  lavado: 32,
  refri: 25,
  coccion: 23,
};

function categoriaKind(c: string | null | undefined): "lavado" | "refri" | "coccion" | null {
  if (!c) return null;
  const v = c.toLowerCase();
  if (v.includes("lava") || v.includes("seca")) return "lavado";
  if (v.includes("refrig") || v.includes("freezer") || v.includes("frio")) return "refri";
  if (v.includes("cocci") || v.includes("cocina")) return "coccion";
  return null;
}

export interface CategoryBlock {
  drean_units: number;
  total_units: number;
  share: number; // 0..100
}

function emptyBlock(): CategoryBlock {
  return { drean_units: 0, total_units: 0, share: 0 };
}

function finalize(b: CategoryBlock): CategoryBlock {
  b.share = b.total_units > 0 ? (b.drean_units / b.total_units) * 100 : 0;
  return b;
}

export interface OverallShare {
  total: CategoryBlock;
  lavado: CategoryBlock;
  refri: CategoryBlock;
  coccion: CategoryBlock;
  tiendas: number;
}

export function computeOverall<T extends FloorShareRow>(rows: T[]): OverallShare {
  const out: OverallShare = {
    total: emptyBlock(),
    lavado: emptyBlock(),
    refri: emptyBlock(),
    coccion: emptyBlock(),
    tiendas: 0,
  };
  const tiendas = new Set<string>();
  for (const r of rows) {
    const u = r.unidades ?? 0;
    out.total.total_units += u;
    if (r.marca === OWN_BRAND_FS) out.total.drean_units += u;
    const k = categoriaKind(r.categoria);
    if (k) {
      out[k].total_units += u;
      if (r.marca === OWN_BRAND_FS) out[k].drean_units += u;
    }
    if (r.numero_tienda) tiendas.add(r.numero_tienda);
  }
  finalize(out.total);
  finalize(out.lavado);
  finalize(out.refri);
  finalize(out.coccion);
  out.tiendas = tiendas.size;
  return out;
}

export interface ClienteShare {
  cliente: string;
  total: CategoryBlock;
  lavado: CategoryBlock;
  refri: CategoryBlock;
  coccion: CategoryBlock;
  tiendas: number;
}

export function shareByCliente<T extends FloorShareRow & { cliente: string }>(rows: T[]): ClienteShare[] {
  const map = new Map<string, ClienteShare>();
  const tiendasByCliente = new Map<string, Set<string>>();
  for (const r of rows) {
    let acc = map.get(r.cliente);
    if (!acc) {
      acc = { cliente: r.cliente, total: emptyBlock(), lavado: emptyBlock(), refri: emptyBlock(), coccion: emptyBlock(), tiendas: 0 };
      map.set(r.cliente, acc);
      tiendasByCliente.set(r.cliente, new Set());
    }
    const u = r.unidades ?? 0;
    acc.total.total_units += u;
    if (r.marca === OWN_BRAND_FS) acc.total.drean_units += u;
    const k = categoriaKind(r.categoria);
    if (k) {
      acc[k].total_units += u;
      if (r.marca === OWN_BRAND_FS) acc[k].drean_units += u;
    }
    if (r.numero_tienda) tiendasByCliente.get(r.cliente)!.add(r.numero_tienda);
  }
  for (const v of map.values()) {
    finalize(v.total);
    finalize(v.lavado);
    finalize(v.refri);
    finalize(v.coccion);
    v.tiendas = tiendasByCliente.get(v.cliente)?.size ?? 0;
  }
  return [...map.values()].sort((a, b) => a.cliente.localeCompare(b.cliente, "es", { sensitivity: "base" }));
}

export interface TiendaShare {
  numero_tienda: string;
  nombre_tienda: string;
  cliente: string;
  total: CategoryBlock;
  lavado: CategoryBlock;
  refri: CategoryBlock;
  coccion: CategoryBlock;
}

export function shareByTienda<T extends FloorShareRow & { cliente: string }>(rows: T[]): TiendaShare[] {
  const map = new Map<string, TiendaShare>();
  for (const r of rows) {
    let acc = map.get(r.numero_tienda);
    if (!acc) {
      acc = {
        numero_tienda: r.numero_tienda,
        nombre_tienda: r.nombre_tienda,
        cliente: r.cliente,
        total: emptyBlock(),
        lavado: emptyBlock(),
        refri: emptyBlock(),
        coccion: emptyBlock(),
      };
      map.set(r.numero_tienda, acc);
    }
    const u = r.unidades ?? 0;
    acc.total.total_units += u;
    if (r.marca === OWN_BRAND_FS) acc.total.drean_units += u;
    const k = categoriaKind(r.categoria);
    if (k) {
      acc[k].total_units += u;
      if (r.marca === OWN_BRAND_FS) acc[k].drean_units += u;
    }
  }
  for (const v of map.values()) {
    finalize(v.total);
    finalize(v.lavado);
    finalize(v.refri);
    finalize(v.coccion);
  }
  return [...map.values()].sort((a, b) => {
    const c = a.cliente.localeCompare(b.cliente, "es", { sensitivity: "base" });
    return c !== 0 ? c : (a.nombre_tienda ?? "").localeCompare(b.nombre_tienda ?? "", "es", { sensitivity: "base" });
  });
}

export function normalizeCategoria(c: string | null | undefined): string {
  if (!c) return "Otros";
  const v = c.toLowerCase();
  if (v.startsWith("cocci") || v.includes("cocina")) return "Cocción";
  if (v.startsWith("refrig") || v.includes("freezer")) return "Refrigeración";
  if (v.startsWith("lava") || v.includes("seca")) return "Lavado y Secado";
  // Capitaliza primera letra
  return c.charAt(0).toUpperCase() + c.slice(1);
}

// ============================================================================
// Objetivo 2 (Overview) — Floor Share por categoría core, promedio U4 meses.
// Devuelve, además del promedio del objetivo, la trayectoria mensual, el
// último mes (cómo venimos hoy) y una proyección lineal simple del próximo mes.
// ============================================================================

const MES_ORDER_FS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
export type FsCatKey = "lavado" | "refri" | "coccion";
export const FS_CAT_LABEL: Record<FsCatKey, string> = {
  lavado: "Lavado",
  refri: "Refrigeración",
  coccion: "Cocción",
};

export interface FsMonthShare {
  mes: string;
  share: number; // 0..100
}

export interface FsCatU4M {
  target: number;
  avgU4M: number;          // promedio de los shares mensuales de la ventana
  latest: number | null;   // share del último mes con dato
  projection: number | null; // proyección lineal del próximo mes
  meetsAvg: boolean;
  months: FsMonthShare[];  // trayectoria (orden calendario)
}

export interface FloorShareU4M {
  mesesUsados: string[];
  lavado: FsCatU4M;
  refri: FsCatU4M;
  coccion: FsCatU4M;
}

// Proyección del próximo punto por regresión lineal simple sobre la serie.
function linearNext(values: number[]): number | null {
  const n = values.length;
  if (n === 0) return null;
  if (n === 1) return values[0]!;
  let sx = 0, sy = 0, sxy = 0, sxx = 0;
  for (let i = 0; i < n; i++) {
    sx += i; sy += values[i]!; sxy += i * values[i]!; sxx += i * i;
  }
  const denom = n * sxx - sx * sx;
  if (denom === 0) return values[n - 1]!;
  const slope = (n * sxy - sx * sy) / denom;
  const intercept = (sy - slope * sx) / n;
  return Math.max(0, intercept + slope * n); // próximo índice = n
}

export async function getFloorShareU4M(monthsBack = 4): Promise<FloorShareU4M | null> {
  const { weeks } = await getAvailableWeeks();
  if (weeks.length === 0) return null;

  // Semanas candidatas → mes (sin fetchear: isoWeekToMes es determinístico).
  const weekMes = weeks
    .map((w) => ({ w, mes: isoWeekToMes(w) }))
    .filter((x) => x.mes);
  const mesesPresentes = [...new Set(weekMes.map((x) => x.mes))]
    .sort((a, b) => MES_ORDER_FS.indexOf(a) - MES_ORDER_FS.indexOf(b));
  const u4 = mesesPresentes.slice(-monthsBack);
  const u4Set = new Set(u4);
  const semanas = weekMes.filter((x) => u4Set.has(x.mes)).map((x) => x.w);
  if (semanas.length === 0) return null;

  const rows = await getFloorShareRows({ semanas });
  if (rows.length === 0) return null;

  // Agrupar rows por mes.
  const byMes = new Map<string, FloorShareRow[]>();
  for (const r of rows) {
    if (r.semana == null) continue;
    const mes = isoWeekToMes(r.semana);
    if (!u4Set.has(mes)) continue;
    const arr = byMes.get(mes);
    if (arr) arr.push(r);
    else byMes.set(mes, [r]);
  }

  const buildCat = (cat: FsCatKey): FsCatU4M => {
    const months: FsMonthShare[] = [];
    for (const mes of u4) {
      const rs = byMes.get(mes);
      if (!rs || rs.length === 0) continue;
      const block = computeOverall(rs)[cat];
      if (block.total_units > 0) months.push({ mes, share: block.share });
    }
    const avgU4M = months.length ? months.reduce((s, m) => s + m.share, 0) / months.length : 0;
    const latest = months.length ? months[months.length - 1]!.share : null;
    const projection = linearNext(months.map((m) => m.share));
    return {
      target: FS_OBJ_PCT[cat],
      avgU4M,
      latest,
      projection,
      meetsAvg: months.length > 0 && avgU4M >= FS_OBJ_PCT[cat],
      months,
    };
  };

  return {
    mesesUsados: u4,
    lavado: buildCat("lavado"),
    refri: buildCat("refri"),
    coccion: buildCat("coccion"),
  };
}
