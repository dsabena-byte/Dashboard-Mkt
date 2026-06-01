import "server-only";
import { getCbSupabase } from "./supabase-cb";

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
const PAGE = 5000;

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
  marcas?: string[];
}

// Devuelve las semanas disponibles, descendente. Usado para limitar el
// universo inicial (las últimas N semanas) y evitar fetchear 70K rows.
export async function getAvailableWeeks(): Promise<{ weeks: number[]; debug: string }> {
  const supabase = getCbSupabase();
  const { data, error } = await supabase
    .from(TABLE)
    .select("semana")
    .order("semana", { ascending: false })
    .range(0, 4999);
  if (error) return { weeks: [], debug: `error: ${error.message} (code=${error.code})` };
  const rows = (data ?? []) as Array<{ semana: number }>;
  const weeks = [...new Set(rows.map((r) => r.semana))].sort((a, b) => b - a);
  return { weeks, debug: `rows_scanned=${rows.length} weeks_found=${weeks.length}` };
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
  return out.sort((a, b) => a.categoria.localeCompare(b.categoria) || b.share - a.share);
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

export interface TiendaShare {
  numero_tienda: string;
  nombre_tienda: string;
  total_unidades: number;
  drean_unidades: number;
  drean_share: number;
}

export function shareByTienda(rows: FloorShareRow[]): TiendaShare[] {
  const map = new Map<string, { numero: string; nombre: string; total: number; drean: number }>();
  for (const r of rows) {
    const acc = map.get(r.numero_tienda) ?? {
      numero: r.numero_tienda,
      nombre: r.nombre_tienda,
      total: 0,
      drean: 0,
    };
    acc.total += r.unidades ?? 0;
    if (r.marca === OWN_BRAND_FS) acc.drean += r.unidades ?? 0;
    map.set(r.numero_tienda, acc);
  }
  return [...map.values()]
    .map((v) => ({
      numero_tienda: v.numero,
      nombre_tienda: v.nombre,
      total_unidades: v.total,
      drean_unidades: v.drean,
      drean_share: v.total > 0 ? (v.drean / v.total) * 100 : 0,
    }))
    .sort((a, b) => b.drean_share - a.drean_share);
}

export function normalizeCategoria(c: string): string {
  const v = c.toLowerCase();
  if (v.startsWith("cocci") || v.includes("cocina")) return "Cocción";
  if (v.startsWith("refrig") || v.includes("freezer")) return "Refrigeración";
  if (v.startsWith("lava") || v.includes("seca")) return "Lavado y Secado";
  // Capitaliza primera letra
  return c.charAt(0).toUpperCase() + c.slice(1);
}
