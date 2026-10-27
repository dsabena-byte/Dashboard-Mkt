import "server-only";

// Trade en el proyecto PRINCIPAL (migración 0138): lectura/escritura por REST con la service key.
// Las tablas tr_* reemplazan al proyecto Supabase CB + el mirror. Si 0138 no corrió o las tablas están vacías,
// `trTieneDatos()` da false y los lectores de lib/cb-mirror.ts siguen con el mirror / proyecto CB (fail-safe).

import type { CbRow } from "./cb-queries";
import type { FloorShareRow } from "./floor-share-queries";

const PAGE = 10000;
const CONC = 6;

function cfg(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? { url: url.replace(/\/+$/, ""), key } : null;
}

export class TradeDbError extends Error {
  constructor(public status: number, msg: string) { super(msg); }
}

/** fetch a PostgREST con la service key. Tira TradeDbError si !ok. */
export async function trRest(path: string, init: RequestInit & { prefer?: string } = {}): Promise<Response> {
  const c = cfg();
  if (!c) throw new TradeDbError(500, "Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  const headers: Record<string, string> = { apikey: c.key, Authorization: `Bearer ${c.key}`, ...(init.headers as Record<string, string> | undefined) };
  if (init.body) headers["Content-Type"] = "application/json";
  if (init.prefer) headers.Prefer = init.prefer;
  const res = await fetch(`${c.url}/rest/v1/${path}`, { ...init, headers, cache: "no-store" });
  if (!res.ok) throw new TradeDbError(res.status, `${path.split("?")[0]}: ${res.status} ${(await res.text()).slice(0, 300)}`);
  return res;
}

export async function trJson<T>(path: string): Promise<T> {
  return (await (await trRest(path)).json()) as T;
}

/** Todas las filas (paginado en paralelo, orden estable por `order`). */
export async function trAll<T>(query: string, order = "id"): Promise<T[]> {
  const q = `${query}${query.includes("?") ? "&" : "?"}order=${order}`;
  const get = async (from: number, count: boolean) => {
    const res = await trRest(q, { headers: { Range: `${from}-${from + PAGE - 1}`, ...(count ? { Prefer: "count=exact" } : {}) } });
    const cr = res.headers.get("content-range");
    return { rows: (await res.json()) as T[], total: cr?.includes("/") ? Number(cr.split("/")[1]) : 0 };
  };
  const first = await get(0, true);
  const all = [...first.rows];
  const offs: number[] = [];
  for (let o = PAGE; o < first.total; o += PAGE) offs.push(o);
  for (let i = 0; i < offs.length; i += CONC) {
    for (const r of await Promise.all(offs.slice(i, i + CONC).map((o) => get(o, false)))) all.push(...r.rows);
  }
  return all;
}

/** Upsert en lotes (idempotente). */
export async function trUpsert(table: string, rows: unknown[], onConflict: string, ignore = false): Promise<void> {
  for (let i = 0; i < rows.length; i += 1000) {
    await trRest(`${table}?on_conflict=${onConflict}`, {
      method: "POST", body: JSON.stringify(rows.slice(i, i + 1000)),
      prefer: `resolution=${ignore ? "ignore" : "merge"}-duplicates,return=minimal`,
    });
  }
}

export async function trRpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  return (await (await trRest(`rpc/${fn}`, { method: "POST", body: JSON.stringify(args) })).json()) as T;
}

/** ¿La tabla falta (0138 sin correr)? */
export const esFaltaTabla = (e: unknown) => e instanceof TradeDbError && (e.status === 404 || /PGRST205|42P01|does not exist/.test(e.message));

// ───────────── estado (memo corto: se consulta en cada render) ─────────────
let memo: { at: number; v: { cb: number | null; fs: number | null } } | null = null;

/** Año más reciente con datos en tr_cb_semanal / tr_floor_share (null = vacío o sin migración). */
export async function trEstado(): Promise<{ cb: number | null; fs: number | null }> {
  if (memo && Date.now() - memo.at < 30_000) return memo.v;
  const anio = async (t: string, extra = "") => {
    try {
      const r = await trJson<Array<{ anio: number }>>(`${t}?select=anio${extra}&order=anio.desc&limit=1`);
      return r[0]?.anio ?? null;
    } catch { return null; }
  };
  const [cb, fs] = await Promise.all([anio("tr_cb_semanal"), anio("tr_floor_share", "&semana=not.is.null")]);
  memo = { at: Date.now(), v: { cb, fs } };
  return memo.v;
}
export const trInvalidarEstado = () => { memo = null; };

// ───────────── lectores (mismas formas que el mirror) ─────────────
const CB_SEL = "semana,tienda,cliente,division,target_cb,real_cb,target_inf,real_inf,tipo_sku";

/** CB agregado sin SKU (vw_tr_cb_agg) del año más reciente. Mismos totales que el detalle. */
export async function getTrCbRows(anio: number): Promise<CbRow[]> {
  const rows = await trAll<Omit<CbRow, "sku">>(`vw_tr_cb_agg?select=${CB_SEL}&anio=eq.${anio}`, "semana,tienda,cliente,division,tipo_sku");
  return rows.map((r) => ({ ...r, sku: "" }));
}

const FS_SEL = "periodo,semana,categoria,numero_tienda,nombre_tienda,marca,unidades,pct_raw";
export async function getTrFsRows(anio: number, semanas: number[]): Promise<FloorShareRow[]> {
  const f = semanas.length ? `&semana=in.(${semanas.join(",")})` : "&semana=not.is.null";
  return trAll<FloorShareRow>(`tr_floor_share?select=${FS_SEL}&anio=eq.${anio}${f}`);
}

export async function getTrMaxSemanaFs(anio: number): Promise<number | null> {
  const r = await trJson<Array<{ semana: number }>>(`tr_floor_share?select=semana&anio=eq.${anio}&semana=not.is.null&order=semana.desc&limit=1`);
  return r[0]?.semana ?? null;
}

export async function getTrTiendaCliente(): Promise<Map<string, string>> {
  const rows = await trAll<{ numero_tienda: string; cliente: string }>("vw_tr_tienda_cadena?select=numero_tienda,cliente", "numero_tienda");
  return new Map(rows.map((r) => [r.numero_tienda, r.cliente]));
}

export async function getTrPrecalc<T>(clave: string): Promise<T | null> {
  try {
    const r = await trJson<Array<{ data: T }>>(`tr_precalc?clave=eq.${encodeURIComponent(clave)}&select=data`);
    return r[0]?.data ?? null;
  } catch { return null; }
}

export async function setTrPrecalc(clave: string, data: unknown): Promise<void> {
  await trUpsert("tr_precalc", [{ clave, data, updated_at: new Date().toISOString() }], "clave");
}

export async function auditar(usuario: string | null, entidad: string, clave: string, antes: unknown, despues: unknown): Promise<void> {
  await trRest("tr_auditoria", {
    method: "POST", prefer: "return=minimal",
    body: JSON.stringify([{ usuario, entidad, clave, antes: antes ?? null, despues: despues ?? null }]),
  });
}
