import "server-only";
import { getServerSupabase } from "./supabase-server";
import { filtrarPorCategoria as _filtrarPorCategoria } from "./contenido-shared";

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
  engagement: number;
}

// Candidatos de referencia de estilo para el selector: top posts del pilar,
// priorizando la categoría, que tengan imagen (thumbnail). Devuelve más que el
// generador (para poder elegir) — por defecto 12.
export async function getReferenciaCandidatos(pilar: string, categoria: string, n = 12): Promise<RefCandidato[]> {
  const tops = (await getTopByPilar(180, 40))[pilar] ?? [];
  const conImagen = tops.filter((t): t is TopPost & { thumbnail_url: string } => !!t.thumbnail_url);
  const filtrados = _filtrarPorCategoria(conImagen, categoria);
  return filtrados.slice(0, n).map((t) => ({
    post_id: t.post_id,
    thumbnail_url: t.thumbnail_url,
    message: t.message,
    media_type: t.media_type,
    engagement: t.engagement,
  }));
}
