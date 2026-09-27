import "server-only";
import { getServerSupabase } from "./supabase-server";
import { storyFromRow, summarizeStories, type StoriesResumen, type StoryExtra } from "./ig-stories";
import { contPostFromRow, type ContPost } from "./redes-contenido";
import { fbPaidDecision, readViewsSplit } from "./fb-paid";

// Lecturas livianas para las secciones nuevas de /redes (sep-2026). Una query indexada cada una sobre
// meta_posts (cientos de filas por año): nada pesado en el render. Nunca tiran (null / [] ante error).

/** Resumen de Stories de IG del rango (meta_posts STORY; respuestas/navegación desde raw.story). */
export async function getIgStoriesResumen(range: { from: string; to: string }): Promise<StoriesResumen | null> {
  try {
    const { data, error } = await getServerSupabase()
      .from("meta_posts")
      .select("post_id, fecha_post, reach, video_views, story:raw->story")
      .eq("platform", "instagram")
      .eq("media_type", "STORY")
      .gte("fecha_post", `${range.from}T00:00:00Z`)
      .lte("fecha_post", `${range.to}T23:59:59Z`)
      .limit(3000)
      .returns<{ post_id: string; fecha_post: string; reach: number | null; video_views: number | null; story: StoryExtra | null }[]>();
    if (error || !data) return null;
    const rows = data as { post_id: string; fecha_post: string; reach: number | null; video_views: number | null; story: StoryExtra | null }[];
    return summarizeStories(rows.map((r) => storyFromRow({ ...r, raw: r.story ? { story: r.story } : null })));
  } catch {
    return null;
  }
}

/** Posts propios (IG sin Stories + FB orgánico) para formatos y horarios. FB pautado (API o heurística) afuera. */
export async function getOwnContentPosts(range: { from: string; to: string }): Promise<ContPost[]> {
  try {
    const { data, error } = await getServerSupabase()
      .from("meta_posts")
      .select("platform, post_id, fecha_post, media_type, reach, engagement, reactions, clicks, video_views, views_split:raw->views_split")
      .in("platform", ["instagram", "facebook"])
      .or("media_type.is.null,media_type.neq.STORY")
      .gte("fecha_post", `${range.from}T00:00:00Z`)
      .lte("fecha_post", `${range.to}T23:59:59Z`)
      .order("fecha_post", { ascending: false })
      .limit(3000)
      .returns<{ platform: string; post_id: string; fecha_post: string; media_type: string | null; reach: number | null; engagement: number | null; reactions: number | null; clicks: number | null; video_views: number | null; views_split: unknown }[]>();
    if (error || !data) return [];
    type Row = { platform: string; post_id: string; fecha_post: string; media_type: string | null; reach: number | null; engagement: number | null; reactions: number | null; clicks: number | null; video_views: number | null; views_split: unknown };
    return (data as Row[])
      .filter((r: Row) => r.platform !== "facebook" || !fbPaidDecision({ reach: r.reach, reactions: r.reactions, views_split: readViewsSplit(r.views_split) }).paid)
      .map((r: Row) => contPostFromRow(r))
      .filter((p: ContPost | null): p is ContPost => p != null);
  } catch {
    return [];
  }
}
