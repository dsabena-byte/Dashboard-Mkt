import "server-only";
import { createHash } from "node:crypto";
import { postKey } from "@/lib/post-snapshots-core";

// Texto de los comentarios de redes (tabla social_post_comments, migración 0145). Se guardan para poder
// recalcular el sentimiento sin volver a bajarlos. Fail-safe: sin la tabla devuelve el error y no tira.

export interface ComentarioRow {
  clave: string; post_url: string; post_key: string; red_social: string; marca: string;
  texto: string; like_count: number | null; fecha: string | null; fuente: "graph" | "apify";
}

/** Apify no da id de comentario: la clave es el shortcode + hash del texto (el mismo texto no se duplica). */
export const claveApify = (url: string, texto: string) =>
  `apify:${postKey(url)}:${createHash("sha1").update(texto).digest("hex").slice(0, 16)}`;

export async function guardarComentarios(rows: ComentarioRow[]): Promise<{ guardados: number; error?: string }> {
  if (!rows.length) return { guardados: 0 };
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { guardados: 0, error: "Supabase no configurado" };
  const uniq = [...new Map(rows.map((r) => [r.clave, r])).values()];
  for (let i = 0; i < uniq.length; i += 500) {
    const r = await fetch(`${url}/rest/v1/social_post_comments?on_conflict=clave`, {
      method: "POST", cache: "no-store",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(uniq.slice(i, i + 500).map((x) => ({ ...x, fetched_at: new Date().toISOString() }))),
    });
    if (!r.ok) return { guardados: i, error: `${r.status}: ${(await r.text()).slice(0, 200)}` };
  }
  return { guardados: uniq.length };
}
