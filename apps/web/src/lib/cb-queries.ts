import "server-only";
import { getCbSupabase } from "./supabase-cb";

// ============================================================================
// Cuadros Básicos — queries contra el proyecto Supabase de CB
// ----------------------------------------------------------------------------
// Tabla: cuadro_basico_semanal
//   semana       int    -- número de semana ISO
//   tienda       text   -- "74 - ALAYIAN LA PLATA CALLE 12"
//   sku          text
//   cliente      text   -- "ALAYIAN HNOS CIA SACIFIA"
//   division     text   -- COCCIÓN / LAVADO Y SECADO / REFRIGERACIÓN
//   target_cb    int    -- 1 si el SKU debe estar en góndola
//   real_cb      int    -- 1 si fue auditado presente
//   target_inf   int    -- 1 si es Infaltable
//   real_inf     int    -- 1 si Infaltable presente
//   tipo_sku     text   -- "Infaltable" / "Estratégico" / null
//   updated_at   timestamptz
// ============================================================================

const TABLE = "cuadro_basico_semanal";

export interface CbFilter {
  semana?: number;
  division?: string;
  cliente?: string;
  tienda?: string;
}

export interface CbRow {
  semana: number;
  tienda: string;
  sku: string;
  cliente: string;
  division: string;
  target_cb: number;
  real_cb: number;
  target_inf: number;
  real_inf: number;
  tipo_sku: string | null;
}

export interface CbTotals {
  cb_pct: number;
  cb_ok: number;
  cb_target: number;
  infalt_pct: number;
  infalt_ok: number;
  infalt_target: number;
  estrat_pct: number;
  estrat_ok: number;
  estrat_target: number;
  tiendas: number;
}

export interface CbFilterOptions {
  semanas: number[];
  divisiones: string[];
  clientes: string[];
  tiendas: string[];
}

const PAGE = 1000;

export async function getCbRows(filter: CbFilter = {}): Promise<CbRow[]> {
  const supabase = getCbSupabase();
  const all: CbRow[] = [];
  let from = 0;
  while (true) {
    let q = supabase
      .from(TABLE)
      .select("semana, tienda, sku, cliente, division, target_cb, real_cb, target_inf, real_inf, tipo_sku")
      .range(from, from + PAGE - 1);
    if (filter.semana != null) q = q.eq("semana", filter.semana);
    if (filter.division) q = q.eq("division", filter.division);
    if (filter.cliente) q = q.eq("cliente", filter.cliente);
    if (filter.tienda) q = q.eq("tienda", filter.tienda);
    const { data, error } = await q.returns<CbRow[]>();
    if (error) {
      console.error(`[cb-queries] ${TABLE}:`, error.message);
      return all;
    }
    const batch = data ?? [];
    all.push(...batch);
    if (batch.length < PAGE) break;
    from += PAGE;
    if (from > 50_000) break; // safety
  }
  return all;
}

export async function getCbFilterOptions(): Promise<CbFilterOptions> {
  const supabase = getCbSupabase();
  // Una sola query con todas las distintas (paginada por las dudas)
  const all: Array<Partial<CbRow>> = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from(TABLE)
      .select("semana, division, cliente, tienda")
      .range(from, from + PAGE - 1)
      .returns<Array<Partial<CbRow>>>();
    if (error || !data) break;
    all.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
    if (from > 50_000) break;
  }
  const uniq = <T>(arr: (T | null | undefined)[]): T[] => [...new Set(arr.filter((x): x is T => x != null))];
  return {
    semanas: uniq(all.map((r) => r.semana)).sort((a, b) => a - b),
    divisiones: uniq(all.map((r) => r.division)).sort(),
    clientes: uniq(all.map((r) => r.cliente)).sort(),
    tiendas: uniq(all.map((r) => r.tienda)).sort(),
  };
}

function isEstratIco(s: string | null): boolean {
  if (!s) return false;
  const v = s.toLowerCase();
  return v.includes("estrat");
}

export function computeTotals(rows: CbRow[]): CbTotals {
  let cb_ok = 0, cb_target = 0;
  let infalt_ok = 0, infalt_target = 0;
  let estrat_ok = 0, estrat_target = 0;
  const tiendas = new Set<string>();
  for (const r of rows) {
    cb_target += r.target_cb ?? 0;
    cb_ok += r.real_cb ?? 0;
    infalt_target += r.target_inf ?? 0;
    infalt_ok += r.real_inf ?? 0;
    if (isEstratIco(r.tipo_sku)) {
      estrat_target += r.target_cb ?? 0;
      estrat_ok += r.real_cb ?? 0;
    }
    if (r.tienda) tiendas.add(r.tienda);
  }
  return {
    cb_ok, cb_target, cb_pct: cb_target > 0 ? (cb_ok / cb_target) * 100 : 0,
    infalt_ok, infalt_target, infalt_pct: infalt_target > 0 ? (infalt_ok / infalt_target) * 100 : 0,
    estrat_ok, estrat_target, estrat_pct: estrat_target > 0 ? (estrat_ok / estrat_target) * 100 : 0,
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
    acc.cb_t += r.target_cb ?? 0; acc.cb_o += r.real_cb ?? 0;
    acc.i_t += r.target_inf ?? 0; acc.i_o += r.real_inf ?? 0;
    if (isEstratIco(r.tipo_sku)) {
      acc.e_t += r.target_cb ?? 0; acc.e_o += r.real_cb ?? 0;
    }
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

export interface CbByDivision {
  division: string;
  cb_pct: number;
  infalt_pct: number;
  estrat_pct: number;
}

export function computeByDivision(rows: CbRow[]): CbByDivision[] {
  const map = new Map<string, { cb_t: number; cb_o: number; i_t: number; i_o: number; e_t: number; e_o: number }>();
  for (const r of rows) {
    const acc = map.get(r.division) ?? { cb_t: 0, cb_o: 0, i_t: 0, i_o: 0, e_t: 0, e_o: 0 };
    acc.cb_t += r.target_cb ?? 0; acc.cb_o += r.real_cb ?? 0;
    acc.i_t += r.target_inf ?? 0; acc.i_o += r.real_inf ?? 0;
    if (isEstratIco(r.tipo_sku)) {
      acc.e_t += r.target_cb ?? 0; acc.e_o += r.real_cb ?? 0;
    }
    map.set(r.division, acc);
  }
  return [...map.entries()].map(([division, v]) => ({
    division,
    cb_pct: v.cb_t > 0 ? (v.cb_o / v.cb_t) * 100 : 0,
    infalt_pct: v.i_t > 0 ? (v.i_o / v.i_t) * 100 : 0,
    estrat_pct: v.e_t > 0 ? (v.e_o / v.e_t) * 100 : 0,
  }));
}

const OBJ_PCT = 80;

export interface CbByDim {
  key: string;
  cb_pct: number;
  cb_delta: number;
  infalt_pct: number;
  infalt_delta: number;
  estrat_pct: number;
  estrat_delta: number;
}

export function computeByDim(rows: CbRow[], dim: "cliente" | "tienda"): CbByDim[] {
  const map = new Map<string, { cb_t: number; cb_o: number; i_t: number; i_o: number; e_t: number; e_o: number }>();
  for (const r of rows) {
    const key = r[dim] ?? "—";
    const acc = map.get(key) ?? { cb_t: 0, cb_o: 0, i_t: 0, i_o: 0, e_t: 0, e_o: 0 };
    acc.cb_t += r.target_cb ?? 0; acc.cb_o += r.real_cb ?? 0;
    acc.i_t += r.target_inf ?? 0; acc.i_o += r.real_inf ?? 0;
    if (isEstratIco(r.tipo_sku)) {
      acc.e_t += r.target_cb ?? 0; acc.e_o += r.real_cb ?? 0;
    }
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
  cliente: string;
  tienda: string;
  cb_lavado: number | null;
  cb_refri: number | null;
  cb_coccion: number | null;
}

function divKind(d: string): "lavado" | "refri" | "coccion" | null {
  const v = d.toLowerCase();
  if (v.includes("lav")) return "lavado";
  if (v.includes("refr") || v.includes("refri") || v.includes("frio")) return "refri";
  if (v.includes("cocci") || v.includes("cocina")) return "coccion";
  return null;
}

export function computeByTienda(rows: CbRow[]): CbByTienda[] {
  const map = new Map<string, { cliente: string; tienda: string; lav_t: number; lav_o: number; ref_t: number; ref_o: number; coc_t: number; coc_o: number }>();
  for (const r of rows) {
    const key = `${r.cliente ?? "—"}__${r.tienda ?? "—"}`;
    const acc = map.get(key) ?? {
      cliente: r.cliente ?? "—",
      tienda: r.tienda ?? "—",
      lav_t: 0, lav_o: 0, ref_t: 0, ref_o: 0, coc_t: 0, coc_o: 0,
    };
    const k = divKind(r.division);
    if (k === "lavado")  { acc.lav_t += r.target_cb ?? 0; acc.lav_o += r.real_cb ?? 0; }
    if (k === "refri")   { acc.ref_t += r.target_cb ?? 0; acc.ref_o += r.real_cb ?? 0; }
    if (k === "coccion") { acc.coc_t += r.target_cb ?? 0; acc.coc_o += r.real_cb ?? 0; }
    map.set(key, acc);
  }
  return [...map.values()].map((v) => ({
    cliente: v.cliente,
    tienda: v.tienda,
    cb_lavado:  v.lav_t > 0 ? (v.lav_o / v.lav_t) * 100 : null,
    cb_refri:   v.ref_t > 0 ? (v.ref_o / v.ref_t) * 100 : null,
    cb_coccion: v.coc_t > 0 ? (v.coc_o / v.coc_t) * 100 : null,
  }));
}
