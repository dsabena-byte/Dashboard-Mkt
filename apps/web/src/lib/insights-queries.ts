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

// Devuelve los top N posts de los últimos `days` días para cada platform,
// rankeados por engagement rate (eng / reach). Filtra outliers (reach < 500).
export async function getTopPostsLastNDays(days = 30, perPlatform = 5): Promise<{ instagram: TopPostRow[]; facebook: TopPostRow[] }> {
  const supabase = getServerSupabase();
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);
  const { data, error } = await supabase
    .from("meta_posts")
    .select("post_id, platform, fecha_post, permalink, message, media_type, thumbnail_url, reach, engagement, reactions, video_views")
    .gte("fecha_post", since.toISOString())
    .returns<Array<Omit<TopPostRow, "eng_rate">>>();
  if (error) {
    console.error("[insights-queries] getTopPostsLastNDays:", error.message);
    return { instagram: [], facebook: [] };
  }
  const rows = (data ?? []).filter((r) => (r.reach ?? 0) >= 500);
  const withRate: TopPostRow[] = rows.map((r) => ({
    ...r,
    eng_rate: r.reach > 0 ? (r.engagement / r.reach) * 100 : 0,
  }));
  const ig = withRate
    .filter((r) => r.platform === "instagram")
    .sort((a, b) => b.eng_rate - a.eng_rate)
    .slice(0, perPlatform);
  const fb = withRate
    .filter((r) => r.platform === "facebook")
    .sort((a, b) => b.eng_rate - a.eng_rate)
    .slice(0, perPlatform);
  return { instagram: ig, facebook: fb };
}
