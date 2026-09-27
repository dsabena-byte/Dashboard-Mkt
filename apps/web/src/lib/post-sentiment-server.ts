import "server-only";
import { getServerSupabase } from "./supabase-server";
import { getTenant } from "./tenant/current";
import { postKey } from "./post-snapshots-core";
import { toPostSentiment, type PostSentiment } from "./post-sentiment";

function shiftDay(iso: string, days: number): string {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Sentimiento por post de la cuenta PROPIA de IG (`social_posts`), indexado por `postKey`
 * (shortcode). Rango con ±2 días de margen (la fecha del scrape y la de la API pueden diferir
 * por huso). Solo las columnas necesarias, paginado por id.
 */
export async function getOwnIgSentimentByKey(range: { from: string; to: string }): Promise<Map<string, PostSentiment>> {
  const supabase = getServerSupabase();
  const own = getTenant().ownBrand.key;
  const out = new Map<string, PostSentiment>();
  const PAGE = 1000;
  for (let off = 0; off < 20000; off += PAGE) {
    const { data, error } = await supabase
      .from("social_posts")
      .select("id, url, positivo, neutro, negativo, resumen_sentimiento, comentarios")
      .eq("marca", own)
      .eq("red_social", "INSTAGRAM")
      .gte("fecha", shiftDay(range.from, -2))
      .lte("fecha", shiftDay(range.to, 2))
      .order("id", { ascending: true })
      .range(off, off + PAGE - 1);
    if (error) throw new Error(`social_posts (sentimiento): ${error.message}`);
    const rows = (data ?? []) as Array<{ url: string | null; positivo: number | null; neutro: number | null; negativo: number | null; resumen_sentimiento: string | null; comentarios: number | null }>;
    for (const r of rows) {
      const s = toPostSentiment(r);
      if (s && r.url) out.set(postKey(r.url), s);
    }
    if (rows.length < PAGE) break;
  }
  return out;
}

/** Cuelga `sentiment` a cada post (no Stories: no tienen comentarios analizados). */
export async function attachIgSentiment<T extends { permalink: string | null; media_type: string | null }>(
  posts: T[],
  range: { from: string; to: string },
): Promise<Array<T & { sentiment?: PostSentiment | null }>> {
  if (posts.length === 0) return [];
  const byKey = await getOwnIgSentimentByKey(range);
  return posts.map((p) => {
    const isStory = (p.media_type ?? "").toUpperCase() === "STORY";
    const s = !isStory && p.permalink ? byKey.get(postKey(p.permalink)) ?? null : null;
    return { ...p, sentiment: s };
  });
}
