import "server-only";
import { sbAdmin } from "@/lib/supabase-admin";
import { isPathAllowed } from "@/lib/dashboard-access";
import type { Anotacion } from "@/lib/anotaciones-core";

// Anotaciones en gráficos (tabla tablero_anotaciones, migración 0119). Por REST con la service key.
// Fail-safe: sin la tabla, la lectura devuelve [] con `missing: true` y el alta falla con un mensaje claro.
const MISSING_RE = /relation|does not exist|schema cache|PGRST205|42P01|Could not find the table/i;
export const MIGRACION_ANOTACIONES = "Falta correr la migración 0119_anotaciones_umbrales.sql en el SQL Editor de Supabase.";
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;

/** Ruta de acceso de un tablero (dashboard_access): "t-…" = Mis tableros; el resto = /<slug>. */
export const pathDeTablero = (tablero: string) => (tablero.startsWith("t-") ? "/tableros" : `/${tablero}`);

/** ¿El usuario puede ver/escribir anotaciones de ese tablero? null (todo el dashboard) = solo sin restricción. */
export function puedeAnotar(tablero: string | null, allowed: string[] | null): boolean {
  if (tablero == null) return allowed === null;
  return SLUG_RE.test(tablero) && isPathAllowed(pathDeTablero(tablero), allowed);
}

export async function listAnotaciones(opts: { tablero?: string | null; desde?: string } = {}): Promise<{ notas: Anotacion[]; missing: boolean }> {
  try {
    let q = "tablero_anotaciones?select=id,fecha,tablero,texto,autor&order=fecha.desc&limit=300";
    if (opts.desde && /^\d{4}-\d{2}-\d{2}$/.test(opts.desde)) q += `&fecha=gte.${opts.desde}`;
    if (opts.tablero && SLUG_RE.test(opts.tablero)) q += `&or=(tablero.is.null,tablero.eq.${opts.tablero})`;
    const res = await sbAdmin(q, { method: "GET" });
    if (!res.ok) { const t = await res.text().catch(() => ""); return { notas: [], missing: res.status === 404 || MISSING_RE.test(t) }; }
    const rows = (await res.json()) as { id: string; fecha: string; tablero: string | null; texto: string; autor: string | null }[];
    return { notas: rows.map((r) => ({ id: String(r.id), fecha: String(r.fecha).slice(0, 10), tablero: r.tablero ?? null, texto: String(r.texto), autor: r.autor ?? null })), missing: false };
  } catch { return { notas: [], missing: true }; }
}

export async function addAnotacion(a: Omit<Anotacion, "id">): Promise<Anotacion> {
  const res = await sbAdmin("tablero_anotaciones", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify([{ fecha: a.fecha, tablero: a.tablero, texto: a.texto, autor: a.autor ?? null }]) });
  if (!res.ok) { const t = await res.text().catch(() => ""); throw new Error(res.status === 404 || MISSING_RE.test(t) ? MIGRACION_ANOTACIONES : `No se pudo guardar: ${t.slice(0, 200)}`); }
  const rows = (await res.json()) as { id: string }[];
  return { ...a, id: String(rows[0]?.id ?? "") };
}

export async function getAnotacion(id: string): Promise<Anotacion | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const res = await sbAdmin(`tablero_anotaciones?id=eq.${id}&select=id,fecha,tablero,texto,autor`, { method: "GET" });
  if (!res.ok) return null;
  const r = ((await res.json()) as Anotacion[])[0];
  return r ? { ...r, fecha: String(r.fecha).slice(0, 10) } : null;
}

export async function removeAnotacion(id: string): Promise<void> {
  const res = await sbAdmin(`tablero_anotaciones?id=eq.${id}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
  if (!res.ok) { const t = await res.text().catch(() => ""); throw new Error(res.status === 404 || MISSING_RE.test(t) ? MIGRACION_ANOTACIONES : `No se pudo borrar: ${t.slice(0, 200)}`); }
}
