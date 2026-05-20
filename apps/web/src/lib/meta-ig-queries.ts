import "server-only";
import { getServerSupabase } from "./supabase-server";

export interface IgDailyRow {
  fecha: string;
  reach: number;
  impressions: number;
  follower_count: number | null;
  profile_views: number;
  website_clicks: number;
  likes: number;
  comments: number;
  saves: number;
  shares: number;
  total_interactions: number;
}

export interface IgPostRow {
  post_id: string;
  fecha_post: string;
  permalink: string | null;
  message: string | null;
  media_type: string | null;
  thumbnail_url: string | null;
  impressions: number;
  reach: number;
  engagement: number;
  likes: number;
  comments: number;
  shares: number;
  saved: number;
  video_views: number;
}

export interface IgDemographicRow {
  fecha: string;
  audience_type: "follower" | "reached" | "engaged";
  dimension: "age" | "gender" | "age_gender" | "country" | "city" | "locale";
  category: string;
  value: number;
}

export interface IgKpiTotals {
  reach: number;
  impressions: number;
  likes: number;
  comments: number;
  saves: number;
  shares: number;
  total_interactions: number;
  follower_count: number | null;
  profile_views: number;
  diasConData: number;
}

export interface IgDemoBreakdown {
  category: string;
  value: number;
  pct: number;
}

export interface IgOrganicSummary {
  totals: IgKpiTotals;
  topPosts: IgPostRow[];
  followersByAgeGender: IgDemoBreakdown[];
  followersByCountry: IgDemoBreakdown[];
  followersByCity: IgDemoBreakdown[];
  engagedByAgeGender: IgDemoBreakdown[];
  rangeLabel: string;
}

const EMPTY_TOTALS: IgKpiTotals = {
  reach: 0,
  impressions: 0,
  likes: 0,
  comments: 0,
  saves: 0,
  shares: 0,
  total_interactions: 0,
  follower_count: null,
  profile_views: 0,
  diasConData: 0,
};

function isMissingTable(err: { message: string } | null): boolean {
  return !!err && /does not exist|relation .* does not exist/i.test(err.message);
}

function toBreakdown(rows: IgDemographicRow[]): IgDemoBreakdown[] {
  const total = rows.reduce((s, r) => s + r.value, 0);
  return rows
    .map((r) => ({
      category: r.category,
      value: r.value,
      pct: total > 0 ? (r.value / total) * 100 : 0,
    }))
    .sort((a, b) => b.value - a.value);
}

/**
 * Devuelve el resumen orgánico de Instagram de Drean para los últimos 30 días.
 *
 * Hardcodeado a últimos 30 días porque el workflow de IG mantiene 30 días
 * móviles y los demographics son snapshot lifetime (no por rango).
 */
export async function getIgOrganicSummary(): Promise<IgOrganicSummary> {
  const supabase = getServerSupabase();

  const today = new Date();
  const to = new Date(today);
  to.setUTCDate(to.getUTCDate() - 1);
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - 29);
  const toIso = to.toISOString().slice(0, 10);
  const fromIso = from.toISOString().slice(0, 10);
  const rangeLabel = `${fromIso} → ${toIso}`;

  const [dailyRes, postsRes, demoRes] = await Promise.all([
    supabase
      .from("meta_ig_daily")
      .select(
        "fecha, reach, impressions, follower_count, profile_views, website_clicks, likes, comments, saves, shares, total_interactions",
      )
      .gte("fecha", fromIso)
      .lte("fecha", toIso)
      .returns<IgDailyRow[]>(),
    supabase
      .from("meta_posts")
      .select(
        "post_id, fecha_post, permalink, message, media_type, thumbnail_url, impressions, reach, engagement, likes, comments, shares, saved, video_views",
      )
      .eq("platform", "instagram")
      .gte("fecha_post", `${fromIso}T00:00:00Z`)
      .lte("fecha_post", `${toIso}T23:59:59Z`)
      .order("engagement", { ascending: false })
      .limit(6)
      .returns<IgPostRow[]>(),
    supabase
      .from("meta_ig_audience_demographics")
      .select("fecha, audience_type, dimension, category, value")
      .order("fecha", { ascending: false })
      .returns<IgDemographicRow[]>(),
  ]);

  // Tablas inexistentes → devolvemos vacio en lugar de tirar.
  if (isMissingTable(dailyRes.error) || isMissingTable(postsRes.error) || isMissingTable(demoRes.error)) {
    return {
      totals: EMPTY_TOTALS,
      topPosts: [],
      followersByAgeGender: [],
      followersByCountry: [],
      followersByCity: [],
      engagedByAgeGender: [],
      rangeLabel,
    };
  }

  if (dailyRes.error) throw new Error(`meta_ig_daily: ${dailyRes.error.message}`);
  if (postsRes.error) throw new Error(`meta_posts: ${postsRes.error.message}`);
  if (demoRes.error) throw new Error(`meta_ig_audience_demographics: ${demoRes.error.message}`);

  const daily = dailyRes.data ?? [];
  const posts = postsRes.data ?? [];
  const demo = demoRes.data ?? [];

  // KPIs: sumamos día a día. follower_count tomamos el último valor disponible.
  const totals: IgKpiTotals = { ...EMPTY_TOTALS, diasConData: daily.length };
  let lastFollower: number | null = null;
  let lastFollowerDate = "";
  for (const r of daily) {
    totals.reach += r.reach;
    totals.impressions += r.impressions;
    totals.likes += r.likes;
    totals.comments += r.comments;
    totals.saves += r.saves;
    totals.shares += r.shares;
    totals.total_interactions += r.total_interactions;
    totals.profile_views += r.profile_views;
    if (r.follower_count != null && r.fecha > lastFollowerDate) {
      lastFollower = r.follower_count;
      lastFollowerDate = r.fecha;
    }
  }
  totals.follower_count = lastFollower;

  // Demographics: nos quedamos con el snapshot más reciente por tipo+dimensión.
  // El workflow upsertea cada día con fecha=hoy y reemplaza el snapshot.
  const latestByKey = new Map<string, IgDemographicRow[]>();
  const seenLatest = new Map<string, string>(); // key → max fecha
  for (const r of demo) {
    const key = `${r.audience_type}|${r.dimension}`;
    const prev = seenLatest.get(key);
    if (!prev || r.fecha >= prev) {
      if (!prev || r.fecha > prev) {
        seenLatest.set(key, r.fecha);
        latestByKey.set(key, []);
      }
      latestByKey.get(key)!.push(r);
    }
  }

  const followersByAgeGender = toBreakdown(latestByKey.get("follower|age_gender") ?? []);
  const followersByCountry = toBreakdown(latestByKey.get("follower|country") ?? []).slice(0, 10);
  const followersByCity = toBreakdown(latestByKey.get("follower|city") ?? []).slice(0, 10);
  const engagedByAgeGender = toBreakdown(latestByKey.get("engaged|age_gender") ?? []);

  return {
    totals,
    topPosts: posts,
    followersByAgeGender,
    followersByCountry,
    followersByCity,
    engagedByAgeGender,
    rangeLabel,
  };
}
