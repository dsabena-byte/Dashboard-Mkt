import "server-only";
import { getServerSupabase } from "./supabase-server";

// Los 5 pilares de contenido (mismos que el clasificador y el tab Insight Drean).
export const PILARES = [
  "Liderazgo marca/porfolio",
  "Calidad superior",
  "Respaldo Posventa",
  "Elegir bien",
  "Experiencia uso",
] as const;
export type Pilar = (typeof PILARES)[number];

// Categorías de producto + helpers viven en contenido-shared (sin "server-only")
// para poder usarse también en la página (client component). Se re-exportan
// acá por conveniencia para el resto del server code.
export { CATEGORIAS, categoriaBrief, filtrarPorCategoria } from "./contenido-shared";
export type { CategoriaKey } from "./contenido-shared";

export interface TopPost {
  post_id: string;
  platform: string;
  fecha_post: string;
  permalink: string | null;
  message: string | null;
  media_type: string | null;
  thumbnail_url: string | null;
  reach: number;
  engagement: number;
  reactions: number;
  video_views: number;
  pilar_contenido: string | null;
  score: number;
}

// Score de performance: interacciones + una fracción de las views (para que el
// video no domine solo por reproducciones). Filtra reach<500 (stories / posts
// recién publicados sin alcance acumulado). Devuelve top N por pilar.
export async function getTopByPilar(days = 120, perPilar = 6): Promise<Record<string, TopPost[]>> {
  const supabase = getServerSupabase();
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);
  const { data, error } = await supabase
    .from("meta_posts")
    .select("post_id, platform, fecha_post, permalink, message, media_type, thumbnail_url, reach, engagement, reactions, video_views, pilar_contenido")
    .gte("fecha_post", since.toISOString())
    .limit(5000)
    .returns<Array<Omit<TopPost, "score">>>();
  if (error) {
    console.error("[contenido-queries] getTopByPilar:", error.message);
    return {};
  }
  const rows = (data ?? [])
    .filter((r) => (r.reach ?? 0) >= 500 && r.pilar_contenido)
    .map((r) => ({ ...r, score: (r.engagement ?? 0) + (r.video_views ?? 0) * 0.05 }));

  const out: Record<string, TopPost[]> = {};
  for (const p of PILARES) out[p] = [];
  for (const r of rows) {
    const key = (r.pilar_contenido ?? "").trim();
    if (out[key]) out[key]!.push(r);
  }
  for (const p of PILARES) out[p] = out[p]!.sort((a, b) => b.score - a.score).slice(0, perPilar);
  return out;
}

export interface RefCandidato {
  post_id: string;
  thumbnail_url: string;
  message: string | null;
  media_type: string | null;
  pilar: string | null;
  fecha: string | null;
  platform: string | null;
}

// Candidatos de referencia para el selector: los posteos MÁS RECIENTES con
// imagen, con su pilar (tal como están tipificados). El usuario elige cuáles
// usar como referencia de estilo. Sin filtro de performance — recencia.
export async function getReferenciaCandidatos(n = 150): Promise<RefCandidato[]> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("meta_posts")
    .select("post_id, platform, thumbnail_url, message, media_type, pilar_contenido, fecha_post")
    .eq("platform", "instagram")
    .not("thumbnail_url", "is", null)
    .order("fecha_post", { ascending: false })
    .limit(600);
  if (error) {
    console.error("[contenido-queries] getReferenciaCandidatos:", error.message);
    return [];
  }
  type Row = { post_id: string; platform: string | null; thumbnail_url: string | null; message: string | null; media_type: string | null; pilar_contenido: string | null; fecha_post: string | null };
  const rows = (data ?? []) as unknown as Row[];
  // dedup por thumbnail y por mensaje normalizado (evita repetidos/variantes).
  const seenThumb = new Set<string>();
  const seenMsg = new Set<string>();
  const out: RefCandidato[] = [];
  for (const r of rows) {
    if (!r.thumbnail_url || seenThumb.has(r.thumbnail_url)) continue;
    const msgKey = (r.message ?? "").trim().toLowerCase().slice(0, 80);
    if (msgKey && seenMsg.has(msgKey)) continue;
    seenThumb.add(r.thumbnail_url);
    if (msgKey) seenMsg.add(msgKey);
    out.push({ post_id: r.post_id, thumbnail_url: r.thumbnail_url, message: r.message, media_type: r.media_type, pilar: r.pilar_contenido, fecha: r.fecha_post, platform: r.platform });
    if (out.length >= n) break;
  }
  return out;
}
