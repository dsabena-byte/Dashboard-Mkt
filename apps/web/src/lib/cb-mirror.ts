import "server-only";

// Lectura RÁPIDA de Trade para el render de los dashboards. Orden de fuentes:
//  1) tablas tr_* del principal (0138, cargadas desde "Cargar datos" / migración trade-migrar);
//  2) mirror del principal (cron cb-mirror) si tr_* está vacío o 0138 no corrió;
//  3) proyecto CB (lento) si el mirror también está vacío.

import { getCbRows, type CbRow } from "./cb-queries";
import { getFloorShareRows, type FloorShareRow } from "./floor-share-queries";
import type { FsView, FsEnrichedRow } from "./fs-view";
import { crearEnriquecedorFs, PROMOTOR_NO_MAPEO } from "./fs-enrich";
import { trEstado, getTrCbRows, getTrFsRows, getTrMaxSemanaFs, getTrTiendaCliente, getTrContactos } from "./trade-db";

// El principal (rápido) devuelve hasta 10k filas por request → páginas grandes para
// leer floor_share_mirror (~135k filas) en pocas idas. Con PAGE=1000 eran 136 páginas.
const PAGE = 10000;
const CONC = 6;

// Paginación en paralelo por REST contra el principal (rápido).
async function fetchAllPrincipal<T>(query: string): Promise<T[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return [];
  const base = { apikey: key, Authorization: `Bearer ${key}` };
  const get = async (from: number, withCount: boolean): Promise<{ rows: T[]; total: number }> => {
    const res = await fetch(`${url}/rest/v1/${query}`, {
      headers: { ...base, Range: `${from}-${from + PAGE - 1}`, ...(withCount ? { Prefer: "count=exact" } : {}) },
      cache: "no-store",
    });
    if (!res.ok) return { rows: [], total: 0 };
    const rows = (await res.json()) as T[];
    const cr = res.headers.get("content-range"); // "0-999/12345"
    const total = cr && cr.includes("/") ? Number(cr.split("/")[1]) : rows.length;
    return { rows, total: Number.isFinite(total) ? total : rows.length };
  };
  const first = await get(0, true);
  const all: T[] = [...first.rows];
  const offsets: number[] = [];
  for (let from = PAGE; from < first.total; from += PAGE) offsets.push(from);
  for (let i = 0; i < offsets.length; i += CONC) {
    const res = await Promise.all(offsets.slice(i, i + CONC).map((off) => get(off, false)));
    for (const r of res) all.push(...r.rows);
  }
  return all;
}

const CB_SEL = "semana,tienda,sku,cliente,division,target_cb,real_cb,target_inf,real_inf,tipo_sku";
const FS_SEL = "periodo,semana,categoria,numero_tienda,nombre_tienda,marca,unidades,pct_raw";

export async function getCbRowsFast(): Promise<CbRow[]> {
  const est = await trEstado();
  if (est.cb != null) return getTrCbRows(est.cb); // agregado sin SKU (sku = ""): mismos totales
  const rows = await fetchAllPrincipal<CbRow>(`cb_semanal_mirror?select=${CB_SEL}`);
  if (rows.length > 0) return rows;
  return getCbRows({}); // fallback: proyecto CB (lento) si el mirror está vacío
}

export async function getFloorShareRowsFast(semanas: number[]): Promise<FloorShareRow[]> {
  const est = await trEstado();
  if (est.fs != null) return getTrFsRows(est.fs, semanas);
  const filt = semanas.length > 0 ? `&semana=in.(${semanas.join(",")})` : "";
  const rows = await fetchAllPrincipal<FloorShareRow>(`floor_share_mirror?select=${FS_SEL}${filt}`);
  if (rows.length > 0) return rows;
  return getFloorShareRows({ semanas }); // fallback
}

// Últimas 26 semanas con dato — desde el mirror (rápido) en vez del proyecto CB.
export async function getAvailableWeeksFast(): Promise<{ weeks: number[]; debug: string }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { weeks: [], debug: "no-env" };
  const est = await trEstado();
  if (est.fs != null) {
    const maxSem = await getTrMaxSemanaFs(est.fs).catch(() => null);
    const weeks: number[] = [];
    for (let i = 0; maxSem != null && i < 26 && maxSem - i > 0; i++) weeks.push(maxSem - i);
    return { weeks, debug: `tr max=${maxSem}` };
  }
  try {
    const res = await fetch(`${url}/rest/v1/floor_share_mirror?select=semana&order=semana.desc&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "no-store",
    });
    if (!res.ok) return { weeks: [], debug: `err ${res.status}` };
    const rows = (await res.json()) as Array<{ semana: number | null }>;
    const maxSem = rows[0]?.semana ?? null;
    if (maxSem == null) return { weeks: [], debug: "no-max" };
    const weeks: number[] = [];
    for (let i = 0; i < 26 && maxSem - i > 0; i++) weeks.push(maxSem - i);
    return { weeks, debug: `max=${maxSem}` };
  } catch {
    return { weeks: [], debug: "exception" };
  }
}

export async function getTiendaClienteMapFast(): Promise<Map<string, string>> {
  if ((await trEstado()).cb != null) return getTrTiendaCliente();
  const rows = await fetchAllPrincipal<{ numero_tienda: string; cliente: string }>(`cb_tienda_cliente_mirror?select=numero_tienda,cliente`);
  return new Map(rows.map((r) => [r.numero_tienda, r.cliente]));
}

/** Filas de Floor Share listas para la vista: cliente/promotor/supervisor como la app vieja; sin tiendas excluidas. */
export async function enriquecerFs(raw: FloorShareRow[]): Promise<FsEnrichedRow[]> {
  const contactos = (await trEstado()).fs != null ? await getTrContactos().catch(() => []) : [];
  const enr = crearEnriquecedorFs(contactos);
  const out: FsEnrichedRow[] = [];
  for (const r of raw) {
    if (r.marca == null || r.categoria == null || r.numero_tienda == null || r.semana == null || !(r.unidades > 0)) continue;
    const p = enr(r.numero_tienda, r.nombre_tienda ?? "");
    if (p) out.push({ ...r, ...p });
  }
  return out;
}

/** Promotor/supervisor de cada fila de CB (tienda "557 - ON CITY…" → maestro de tiendas), = app vieja. */
export async function enriquecerCb(rows: CbRow[]): Promise<CbRow[]> {
  const contactos = (await trEstado()).cb != null ? await getTrContactos().catch(() => []) : [];
  const enr = crearEnriquecedorFs(contactos);
  return rows.map((r) => {
    const m = (r.tienda ?? "").trim().match(/^(\d+)\s*[-–]\s*(.+)$/);
    const p = enr(m?.[1] ?? "", m?.[2] ?? r.tienda ?? "");
    return { ...r, promotor: p?.promotor ?? PROMOTOR_NO_MAPEO, supervisor: p?.supervisor ?? PROMOTOR_NO_MAPEO, zona: p?.zona ?? "Sin zona", ...(p?.geo ? { geo: p.geo } : {}) };
  });
}

// Filas de Floor Share enriquecidas para la vista CON FILTROS. Bajarlas tarda ~10 s (≈200k filas, 35 MB), así que
// quedan en memoria mientras no cambie el precálculo (fs_precomputed.updated_at se reescribe en cada carga).
// shortcut: caché por instancia serverless; la 1ª consulta con filtros de cada instancia sigue tardando ~10 s.
let fsFilasCache: { ver: string; at: number; rows: FsEnrichedRow[] } | null = null;
export async function getFsFilasEnriquecidas(): Promise<FsEnrichedRow[]> {
  const ver = await fsPrecomputedVersion();
  if (fsFilasCache && ver && fsFilasCache.ver === ver && Date.now() - fsFilasCache.at < 60 * 60_000) return fsFilasCache.rows;
  const rows = await enriquecerFs(await getFloorShareRowsFast([]));
  if (ver) fsFilasCache = { ver, at: Date.now(), rows };
  return rows;
}

async function fsPrecomputedVersion(): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  try {
    const res = await fetch(`${url}/rest/v1/fs_precomputed?id=eq.1&select=updated_at`, { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "no-store" });
    if (!res.ok) return null;
    return ((await res.json()) as Array<{ updated_at: string }>)[0]?.updated_at ?? null;
  } catch { return null; }
}

// Vista default de Floor Share PRECALCULADA (la llena el cron). null si no existe.
export async function getFsPrecomputed(): Promise<FsView | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  try {
    const res = await fetch(`${url}/rest/v1/fs_precomputed?id=eq.1&select=data`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "no-store",
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as Array<{ data: FsView }>;
    return rows[0]?.data ?? null;
  } catch {
    return null;
  }
}
