import "server-only";
import { getServerSupabase } from "./supabase-server";

// ============================================================================
// Cuadros Básicos — types y queries
// ----------------------------------------------------------------------------
// La tabla fuente todavía no está confirmada (esperando /api/diag/cb-tables).
// Asumimos un schema basado en lo que muestra el dashboard original:
//
//   cb_visitas (o similar):
//     fecha           date
//     semana          int        -- semana del año
//     mes             text       -- "Enero", "Mayo", ...
//     anio            int
//     categoria       text       -- "Lavado y Secado" / "Cocción" / "Refrigeración"
//     supervisor      text
//     promotor        text
//     cliente_cadena  text       -- "ALOISE Y CIA SA", "ON CITY", ...
//     tienda_id       text       -- "81 - ALOISE LA PLATA CALLE 12 Y 57"
//     tienda_nombre   text
//     cb_total        int        -- # items totales del cuadro básico para esa visita
//     cb_ok           int        -- # items presentes
//     infalt_total    int        -- idem infaltables
//     infalt_ok       int
//     estrat_total    int        -- idem estratégicos
//     estrat_ok       int
//
// El % se calcula como ok/total. Cuando la tabla real esté confirmada
// se ajusta el SELECT y el mapeo.
// ============================================================================

export interface CbFilter {
  mes?: string;
  semana?: number;
  categoria?: string;
  supervisor?: string;
  promotor?: string;
  cliente_cadena?: string;
  tienda?: string;
}

export interface CbRow {
  fecha: string;
  semana: number;
  mes: string;
  categoria: string;
  supervisor: string | null;
  promotor: string | null;
  cliente_cadena: string | null;
  tienda_id: string | null;
  tienda_nombre: string | null;
  cb_total: number;
  cb_ok: number;
  infalt_total: number;
  infalt_ok: number;
  estrat_total: number;
  estrat_ok: number;
}

export interface CbTotals {
  cb_total: number;
  cb_ok: number;
  cb_pct: number;
  infalt_total: number;
  infalt_ok: number;
  infalt_pct: number;
  estrat_total: number;
  estrat_ok: number;
  estrat_pct: number;
  tiendas: number;
}

export interface CbFilterOptions {
  meses: string[];
  semanas: number[];
  categorias: string[];
  supervisores: string[];
  promotores: string[];
  clientes: string[];
  tiendas: string[];
}

const TABLE = "cb_visitas"; // ← ajustar cuando se confirme tabla real

export async function getCbRows(filter: CbFilter = {}): Promise<CbRow[]> {
  const supabase = getServerSupabase();
  let q = supabase
    .from(TABLE)
    .select("fecha, semana, mes, categoria, supervisor, promotor, cliente_cadena, tienda_id, tienda_nombre, cb_total, cb_ok, infalt_total, infalt_ok, estrat_total, estrat_ok")
    .returns<CbRow[]>();

  if (filter.mes) q = q.eq("mes", filter.mes);
  if (filter.semana != null) q = q.eq("semana", filter.semana);
  if (filter.categoria) q = q.eq("categoria", filter.categoria);
  if (filter.supervisor) q = q.eq("supervisor", filter.supervisor);
  if (filter.promotor) q = q.eq("promotor", filter.promotor);
  if (filter.cliente_cadena) q = q.eq("cliente_cadena", filter.cliente_cadena);
  if (filter.tienda) q = q.eq("tienda_id", filter.tienda);

  const { data, error } = await q;
  if (error) {
    // Mientras no esté la tabla, devolvemos vacío silenciosamente para
    // que la página no rompa.
    console.error(`[cb-queries] ${TABLE} falló:`, error.message);
    return [];
  }
  return data ?? [];
}

export async function getCbFilterOptions(): Promise<CbFilterOptions> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from(TABLE)
    .select("mes, semana, categoria, supervisor, promotor, cliente_cadena, tienda_id")
    .returns<Array<Partial<CbRow>>>();
  if (error) {
    return { meses: [], semanas: [], categorias: [], supervisores: [], promotores: [], clientes: [], tiendas: [] };
  }
  const rows = data ?? [];
  const uniq = <T>(arr: (T | null | undefined)[]): T[] => [...new Set(arr.filter((x): x is T => x != null))];
  return {
    meses: uniq(rows.map((r) => r.mes)).sort(),
    semanas: uniq(rows.map((r) => r.semana)).sort((a, b) => a - b),
    categorias: uniq(rows.map((r) => r.categoria)).sort(),
    supervisores: uniq(rows.map((r) => r.supervisor)).sort(),
    promotores: uniq(rows.map((r) => r.promotor)).sort(),
    clientes: uniq(rows.map((r) => r.cliente_cadena)).sort(),
    tiendas: uniq(rows.map((r) => r.tienda_id)).sort(),
  };
}

export function computeTotals(rows: CbRow[]): CbTotals {
  let cb_total = 0, cb_ok = 0, infalt_total = 0, infalt_ok = 0, estrat_total = 0, estrat_ok = 0;
  const tiendas = new Set<string>();
  for (const r of rows) {
    cb_total += r.cb_total;
    cb_ok += r.cb_ok;
    infalt_total += r.infalt_total;
    infalt_ok += r.infalt_ok;
    estrat_total += r.estrat_total;
    estrat_ok += r.estrat_ok;
    if (r.tienda_id) tiendas.add(r.tienda_id);
  }
  return {
    cb_total, cb_ok,
    cb_pct: cb_total > 0 ? (cb_ok / cb_total) * 100 : 0,
    infalt_total, infalt_ok,
    infalt_pct: infalt_total > 0 ? (infalt_ok / infalt_total) * 100 : 0,
    estrat_total, estrat_ok,
    estrat_pct: estrat_total > 0 ? (estrat_ok / estrat_total) * 100 : 0,
    tiendas: tiendas.size,
  };
}

export interface CbWeeklyPoint {
  semana: number;
  cb_pct: number | null;
  infalt_pct: number | null;
  estrat_pct: number | null;
}

export function computeWeeklyEvolution(rows: CbRow[]): CbWeeklyPoint[] {
  const byWeek = new Map<number, { cb_t: number; cb_o: number; i_t: number; i_o: number; e_t: number; e_o: number }>();
  for (const r of rows) {
    const acc = byWeek.get(r.semana) ?? { cb_t: 0, cb_o: 0, i_t: 0, i_o: 0, e_t: 0, e_o: 0 };
    acc.cb_t += r.cb_total; acc.cb_o += r.cb_ok;
    acc.i_t += r.infalt_total; acc.i_o += r.infalt_ok;
    acc.e_t += r.estrat_total; acc.e_o += r.estrat_ok;
    byWeek.set(r.semana, acc);
  }
  return [...byWeek.entries()]
    .sort(([a], [b]) => a - b)
    .map(([semana, v]) => ({
      semana,
      cb_pct: v.cb_t > 0 ? (v.cb_o / v.cb_t) * 100 : null,
      infalt_pct: v.i_t > 0 ? (v.i_o / v.i_t) * 100 : null,
      estrat_pct: v.e_t > 0 ? (v.e_o / v.e_t) * 100 : null,
    }));
}

export interface CbByCategory {
  categoria: string;
  cb_pct: number;
  infalt_pct: number;
  estrat_pct: number;
}

export function computeByCategoria(rows: CbRow[]): CbByCategory[] {
  const map = new Map<string, { cb_t: number; cb_o: number; i_t: number; i_o: number; e_t: number; e_o: number }>();
  for (const r of rows) {
    const acc = map.get(r.categoria) ?? { cb_t: 0, cb_o: 0, i_t: 0, i_o: 0, e_t: 0, e_o: 0 };
    acc.cb_t += r.cb_total; acc.cb_o += r.cb_ok;
    acc.i_t += r.infalt_total; acc.i_o += r.infalt_ok;
    acc.e_t += r.estrat_total; acc.e_o += r.estrat_ok;
    map.set(r.categoria, acc);
  }
  return [...map.entries()].map(([categoria, v]) => ({
    categoria,
    cb_pct: v.cb_t > 0 ? (v.cb_o / v.cb_t) * 100 : 0,
    infalt_pct: v.i_t > 0 ? (v.i_o / v.i_t) * 100 : 0,
    estrat_pct: v.e_t > 0 ? (v.e_o / v.e_t) * 100 : 0,
  }));
}

export interface CbByDim {
  key: string;
  cb_pct: number;
  cb_delta: number;
  infalt_pct: number;
  infalt_delta: number;
  estrat_pct: number;
  estrat_delta: number;
}

// Agregado por dimension (promotor o cliente_cadena). Devuelve delta vs objetivo 80%.
const OBJ_PCT = 80;
export function computeByDim(rows: CbRow[], dim: "promotor" | "cliente_cadena"): CbByDim[] {
  const map = new Map<string, { cb_t: number; cb_o: number; i_t: number; i_o: number; e_t: number; e_o: number }>();
  for (const r of rows) {
    const key = r[dim] ?? "—";
    const acc = map.get(key) ?? { cb_t: 0, cb_o: 0, i_t: 0, i_o: 0, e_t: 0, e_o: 0 };
    acc.cb_t += r.cb_total; acc.cb_o += r.cb_ok;
    acc.i_t += r.infalt_total; acc.i_o += r.infalt_ok;
    acc.e_t += r.estrat_total; acc.e_o += r.estrat_ok;
    map.set(key, acc);
  }
  return [...map.entries()]
    .map(([key, v]) => {
      const cb_pct = v.cb_t > 0 ? (v.cb_o / v.cb_t) * 100 : 0;
      const infalt_pct = v.i_t > 0 ? (v.i_o / v.i_t) * 100 : 0;
      const estrat_pct = v.e_t > 0 ? (v.e_o / v.e_t) * 100 : 0;
      return {
        key,
        cb_pct, cb_delta: cb_pct - OBJ_PCT,
        infalt_pct, infalt_delta: infalt_pct - OBJ_PCT,
        estrat_pct, estrat_delta: estrat_pct - OBJ_PCT,
      };
    })
    .sort((a, b) => b.cb_pct - a.cb_pct);
}

export interface CbByTienda {
  cliente_cadena: string;
  tienda: string;
  cb_lavado: number | null;
  cb_refri: number | null;
  cb_coccion: number | null;
}

const CAT_LAVADO = "Lavado y Secado";
const CAT_REFRI = "Refrigeración";
const CAT_COCCION = "Cocción";

export function computeByTienda(rows: CbRow[]): CbByTienda[] {
  const map = new Map<string, { cliente: string; tienda: string; lav_t: number; lav_o: number; ref_t: number; ref_o: number; coc_t: number; coc_o: number }>();
  for (const r of rows) {
    const key = `${r.cliente_cadena ?? "—"}__${r.tienda_id ?? r.tienda_nombre ?? "—"}`;
    const acc = map.get(key) ?? {
      cliente: r.cliente_cadena ?? "—",
      tienda: r.tienda_nombre ?? r.tienda_id ?? "—",
      lav_t: 0, lav_o: 0, ref_t: 0, ref_o: 0, coc_t: 0, coc_o: 0,
    };
    if (r.categoria === CAT_LAVADO) { acc.lav_t += r.cb_total; acc.lav_o += r.cb_ok; }
    if (r.categoria === CAT_REFRI)  { acc.ref_t += r.cb_total; acc.ref_o += r.cb_ok; }
    if (r.categoria === CAT_COCCION){ acc.coc_t += r.cb_total; acc.coc_o += r.cb_ok; }
    map.set(key, acc);
  }
  return [...map.values()].map((v) => ({
    cliente_cadena: v.cliente,
    tienda: v.tienda,
    cb_lavado: v.lav_t > 0 ? (v.lav_o / v.lav_t) * 100 : null,
    cb_refri: v.ref_t > 0 ? (v.ref_o / v.ref_t) * 100 : null,
    cb_coccion: v.coc_t > 0 ? (v.coc_o / v.coc_t) * 100 : null,
  }));
}
