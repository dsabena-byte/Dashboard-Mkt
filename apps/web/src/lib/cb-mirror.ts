import "server-only";

// Lectura RÁPIDA de la data CB desde el mirror en el proyecto PRINCIPAL (lo llena
// el cron cb-mirror). Reemplaza a getCbRows/getFloorShareRows (proyecto CB lento)
// en el render de los dashboards. Fallback al proyecto CB si el mirror está vacío.

import { getCbRows, type CbRow } from "./cb-queries";
import { getFloorShareRows, type FloorShareRow } from "./floor-share-queries";

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
  const rows = await fetchAllPrincipal<CbRow>(`cb_semanal_mirror?select=${CB_SEL}`);
  if (rows.length > 0) return rows;
  return getCbRows({}); // fallback: proyecto CB (lento) si el mirror está vacío
}

export async function getFloorShareRowsFast(semanas: number[]): Promise<FloorShareRow[]> {
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
  const rows = await fetchAllPrincipal<{ numero_tienda: string; cliente: string }>(`cb_tienda_cliente_mirror?select=numero_tienda,cliente`);
  return new Map(rows.map((r) => [r.numero_tienda, r.cliente]));
}
