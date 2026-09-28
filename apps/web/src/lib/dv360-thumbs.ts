import "server-only";
import { cache } from "react";
import { DV360_MANIFEST_KEY, resolveThumbs, type Dv360Thumb, type Dv360ThumbManifest } from "./dv360-thumbs-shared";

// Lee el manifiesto de miniaturas DV360 (bucket público `meta-thumbs`, lo escribe /api/cron/dv360-thumbs) y
// resuelve nombre de creative del reporte → miniatura. Fail-safe: sin manifiesto → {} (el dash muestra el
// placeholder del tamaño como antes). Memoizado por request.
export const getDv360ThumbManifest = cache(async (): Promise<Dv360ThumbManifest | null> => {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "");
  if (!base) return null;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const r = await fetch(`${base}/storage/v1/object/public/meta-thumbs/${DV360_MANIFEST_KEY}`, {
      cache: "no-store",
      signal: ctrl.signal,
    }).finally(() => clearTimeout(t));
    if (!r.ok) return null;
    const m = (await r.json()) as Dv360ThumbManifest;
    return Array.isArray(m?.items) ? m : null;
  } catch {
    return null;
  }
});

/** Mapa nombre crudo del creative (dv360_creatives.creative) → miniatura, solo para los que matchean. */
export async function getDv360ThumbMap(names: Iterable<string>): Promise<Record<string, Dv360Thumb>> {
  const m = await getDv360ThumbManifest();
  if (!m) return {};
  return resolveThumbs(names, m.items).map;
}
