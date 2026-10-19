import "server-only";
import { cache } from "react";
import { TIKTOK_MANIFEST_KEY, type TikTokManifest } from "./tiktok-piezas";

// Lee el manifiesto de piezas de TikTok (lo escribe /api/cron/tiktok-sync). Fail-safe: sin manifiesto → null.
export const getTikTokPiezas = cache(async (): Promise<TikTokManifest | null> => {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "");
  if (!base) return null;
  try {
    const r = await fetch(`${base}/storage/v1/object/public/meta-thumbs/${TIKTOK_MANIFEST_KEY}`, { cache: "no-store", signal: AbortSignal.timeout(5000) });
    if (!r.ok) return null;
    const m = (await r.json()) as TikTokManifest;
    return Array.isArray(m?.items) ? m : null;
  } catch {
    return null;
  }
});
