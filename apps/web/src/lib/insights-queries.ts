import "server-only";
import { getServerSupabase } from "./supabase-server";

export interface InsightRow {
  id: string;
  fecha_generado: string;
  categoria: string;
  signal_key: string;
  prioridad: "alta" | "media" | "baja";
  tipo: "alerta" | "oportunidad" | "info";
  titulo: string;
  descripcion: string;
  acciones: string[] | null;
  datos: Record<string, unknown> | null;
  estado: "nuevo" | "visto" | "cerrado";
  updated_at: string;
}

export async function getInsightsByCategoria(categoria: string, limit = 10): Promise<InsightRow[]> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("insights_log")
    .select("*")
    .eq("categoria", categoria)
    .neq("estado", "cerrado")
    .order("fecha_generado", { ascending: false })
    .limit(limit)
    .returns<InsightRow[]>();
  if (error) {
    console.error(`[insights-queries] ${categoria}:`, error.message);
    return [];
  }
  return data ?? [];
}

// ============================================================================
// Top contenidos (orgánico Drean) — usado por el panel de "Insights"
// ============================================================================

export interface TopPostRow {
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
  eng_rate: number; // % calculado
}

export interface TopAndBottom {
  top: TopPostRow[];
  bottom: TopPostRow[];
}

// Devuelve top N (mejor eng_rate) y bottom N (peor) por platform sobre los
// últimos `days` días. Filtra outliers con reach < 500 (de stories o posts
// recién publicados que aún no acumularon alcance).
export async function getTopAndBottomPostsLastNDays(
  days = 30,
  perPlatform = 5,
): Promise<{ instagram: TopAndBottom; facebook: TopAndBottom }> {
  const supabase = getServerSupabase();
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);
  const { data, error } = await supabase
    .from("meta_posts")
    .select("post_id, platform, fecha_post, permalink, message, media_type, thumbnail_url, reach, engagement, reactions, video_views")
    .gte("fecha_post", since.toISOString())
    .returns<Array<Omit<TopPostRow, "eng_rate">>>();
  if (error) {
    console.error("[insights-queries] getTopAndBottomPostsLastNDays:", error.message);
    return { instagram: { top: [], bottom: [] }, facebook: { top: [], bottom: [] } };
  }
  const rows = (data ?? []).filter((r) => (r.reach ?? 0) >= 500);
  const withRate: TopPostRow[] = rows.map((r) => ({
    ...r,
    eng_rate: r.reach > 0 ? (r.engagement / r.reach) * 100 : 0,
  }));
  function split(platform: string): TopAndBottom {
    const filtered = withRate.filter((r) => r.platform === platform);
    const top = [...filtered].sort((a, b) => b.eng_rate - a.eng_rate).slice(0, perPlatform);
    const topIds = new Set(top.map((p) => p.post_id));
    // Bottom: los con peor eng_rate excluyendo los que están en top.
    const bottom = [...filtered]
      .filter((p) => !topIds.has(p.post_id))
      .sort((a, b) => a.eng_rate - b.eng_rate)
      .slice(0, perPlatform);
    return { top, bottom };
  }
  return { instagram: split("instagram"), facebook: split("facebook") };
}

// Wrapper de back-compat — solo top (lo que ya usaba la página).
export async function getTopPostsLastNDays(days = 30, perPlatform = 5): Promise<{ instagram: TopPostRow[]; facebook: TopPostRow[] }> {
  const both = await getTopAndBottomPostsLastNDays(days, perPlatform);
  return { instagram: both.instagram.top, facebook: both.facebook.top };
}
