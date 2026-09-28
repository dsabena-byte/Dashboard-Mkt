import "server-only";
// "Mis acciones" (tabla recomendacion_seguimiento, migración 0122). Por REST con la service key.
// Fail-safe: sin la tabla, la lectura devuelve { disponible: false, items: [] } y el guardado falla
// con un mensaje claro (la UI muestra el aviso de la migración, nunca se rompe).
import { sbAdmin } from "@/lib/supabase-admin";
import type { AccionSeguida, EstadoAccion, SnapshotAccion } from "@/lib/recomendacion-seguimiento";

const MISSING_RE = /relation|does not exist|schema cache|PGRST205|42P01|Could not find the table/i;
export const MIGRACION_SEGUIMIENTO = "Para guardar tus acciones falta correr la migración 0122_recomendacion_seguimiento.sql en el SQL Editor de Supabase.";
export class SeguimientoNoDisponible extends Error {}

interface Row { id: string; dash: string; estado: string; titulo: string; snapshot: SnapshotAccion | Record<string, never> | null; autor: string | null; updated_at: string }
const toItem = (r: Row): AccionSeguida => ({
  id: r.id, dash: r.dash, estado: r.estado as EstadoAccion, titulo: r.titulo,
  snapshot: r.snapshot && Object.keys(r.snapshot).length ? (r.snapshot as SnapshotAccion) : null,
  autor: r.autor ?? null, updatedAt: r.updated_at,
});
const SEL = "select=id,dash,estado,titulo,snapshot,autor,updated_at";

export async function listSeguimiento(dash: string): Promise<{ disponible: boolean; items: AccionSeguida[] }> {
  try {
    const res = await sbAdmin(`recomendacion_seguimiento?dash=eq.${encodeURIComponent(dash)}&${SEL}&order=updated_at.desc&limit=200`, { method: "GET" });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      if (res.status === 404 || MISSING_RE.test(t)) return { disponible: false, items: [] };
      console.error(`[recomendaciones/seguimiento] GET ${dash} → HTTP ${res.status}: ${t.slice(0, 300)}`);
      return { disponible: true, items: [] };
    }
    return { disponible: true, items: ((await res.json()) as Row[]).map(toItem) };
  } catch (e) {
    console.error("[recomendaciones/seguimiento] GET", e);
    return { disponible: true, items: [] };
  }
}

/** Alta o cambio de estado (upsert por id). */
export async function guardarSeguimiento(v: { id: string; dash: string; estado: EstadoAccion; titulo: string; snapshot: SnapshotAccion | null }, autor: string | null): Promise<AccionSeguida> {
  const res = await sbAdmin(`recomendacion_seguimiento?on_conflict=id&${SEL}`, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify([{ id: v.id, dash: v.dash, estado: v.estado, titulo: v.titulo, snapshot: v.snapshot ?? {}, autor, updated_at: new Date().toISOString() }]),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    if (res.status === 404 || MISSING_RE.test(t)) throw new SeguimientoNoDisponible(MIGRACION_SEGUIMIENTO);
    console.error(`[recomendaciones/seguimiento] POST ${v.id} → HTTP ${res.status}: ${t.slice(0, 300)}`);
    throw new Error("No se pudo guardar la acción.");
  }
  const rows = (await res.json()) as Row[];
  if (!rows[0]) throw new Error("No se pudo guardar la acción.");
  return toItem(rows[0]);
}
