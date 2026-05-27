import "server-only";
import { getServerSupabase } from "./supabase-server";

export interface FbDailyRow {
  fecha: string;
  impressions: number;
  impressions_unique: number;
  impressions_organic: number;
  reach_organic: number;
  engaged_users: number;
  post_engagements: number;
  page_views: number;
  fans_total: number | null;
  fan_adds: number;
  fan_removes: number;
  video_views: number;
  reactions_like: number;
  reactions_love: number;
  reactions_wow: number;
  reactions_haha: number;
  reactions_sorry: number;
  reactions_anger: number;
}

export interface FbPostRow {
  post_id: string;
  fecha_post: string;
  permalink: string | null;
  message: string | null;
  media_type: string | null;
  thumbnail_url: string | null;
  impressions: number;
  reach: number;
  engagement: number;
  reactions: number;
  video_views: number;
  clicks: number;
}

export interface FbDemographicRow {
  fecha: string;
  audience_type: "fan" | "reached" | "viewer";
  dimension: "age_gender" | "country" | "city" | "locale";
  category: string;
  value: number;
}

export interface FbDemoBreakdown {
  category: string;
  value: number;
  pct: number;
}

export interface FbKpiTotals {
  impressions: number;
  impressions_unique: number;
  impressions_organic: number;
  reach_organic: number;
  engaged_users: number;
  post_engagements: number;
  page_views: number;
  video_views: number;
  fan_adds: number;
  fan_removes: number;
  fan_delta: number;
  fans_total: number | null;
  reactions_total: number;
  reactions_like: number;
  reactions_love: number;
  reactions_wow: number;
  reactions_haha: number;
  reactions_sorry: number;
  reactions_anger: number;
  diasConData: number;
}

export interface FbOrganicSummary {
  totals: FbKpiTotals;
  topPosts: FbPostRow[];
  fansByAgeGender: FbDemoBreakdown[];
  fansByCountry: FbDemoBreakdown[];
  fansByCity: FbDemoBreakdown[];
  reachedByAgeGender: FbDemoBreakdown[];
  rangeLabel: string;
}

const EMPTY_TOTALS: FbKpiTotals = {
  impressions: 0,
  impressions_unique: 0,
  impressions_organic: 0,
  reach_organic: 0,
  engaged_users: 0,
  post_engagements: 0,
  page_views: 0,
  video_views: 0,
  fan_adds: 0,
  fan_removes: 0,
  fan_delta: 0,
  fans_total: null,
  reactions_total: 0,
  reactions_like: 0,
  reactions_love: 0,
  reactions_wow: 0,
  reactions_haha: 0,
  reactions_sorry: 0,
  reactions_anger: 0,
  diasConData: 0,
};

function isMissingTable(err: { message: string } | null): boolean {
  return !!err && /does not exist|relation .* does not exist/i.test(err.message);
}

function toBreakdown(rows: FbDemographicRow[]): FbDemoBreakdown[] {
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
 * Devuelve el resumen organico de la Page de Facebook (Drean) para los ultimos 30 dias.
 */
export async function getFbOrganicSummary(): Promise<FbOrganicSummary> {
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
      .from("meta_page_daily")
      .select(
        "fecha, impressions, impressions_unique, impressions_organic, reach_organic, engaged_users, post_engagements, page_views, fans_total, fan_adds, fan_removes, video_views, reactions_like, reactions_love, reactions_wow, reactions_haha, reactions_sorry, reactions_anger",
      )
      .gte("fecha", fromIso)
      .lte("fecha", toIso)
      .returns<FbDailyRow[]>(),
    supabase
      .from("meta_posts")
      .select(
        "post_id, fecha_post, permalink, message, media_type, thumbnail_url, impressions, reach, engagement, reactions, video_views, clicks",
      )
      .eq("platform", "facebook")
      .gte("fecha_post", `${fromIso}T00:00:00Z`)
      .lte("fecha_post", `${toIso}T23:59:59Z`)
      .order("engagement", { ascending: false })
      .limit(12)
      .returns<FbPostRow[]>(),
    supabase
      .from("meta_fb_audience_demographics")
      .select("fecha, audience_type, dimension, category, value")
      .order("fecha", { ascending: false })
      .returns<FbDemographicRow[]>(),
  ]);

  if (isMissingTable(dailyRes.error) || isMissingTable(postsRes.error) || isMissingTable(demoRes.error)) {
    return {
      totals: EMPTY_TOTALS,
      topPosts: [],
      fansByAgeGender: [],
      fansByCountry: [],
      fansByCity: [],
      reachedByAgeGender: [],
      rangeLabel,
    };
  }

  if (dailyRes.error) throw new Error(`meta_page_daily: ${dailyRes.error.message}`);
  if (postsRes.error) throw new Error(`meta_posts: ${postsRes.error.message}`);
  if (demoRes.error) throw new Error(`meta_fb_audience_demographics: ${demoRes.error.message}`);

  const daily = dailyRes.data ?? [];
  const posts = postsRes.data ?? [];
  const demo = demoRes.data ?? [];

  const totals: FbKpiTotals = { ...EMPTY_TOTALS, diasConData: daily.length };
  let lastFans: number | null = null;
  let lastFansDate = "";
  for (const r of daily) {
    totals.impressions += r.impressions;
    totals.impressions_unique += r.impressions_unique;
    totals.impressions_organic += r.impressions_organic;
    totals.reach_organic += r.reach_organic;
    totals.engaged_users += r.engaged_users;
    totals.post_engagements += r.post_engagements;
    totals.page_views += r.page_views;
    totals.video_views += r.video_views;
    totals.fan_adds += r.fan_adds;
    totals.fan_removes += r.fan_removes;
    totals.reactions_like += r.reactions_like;
    totals.reactions_love += r.reactions_love;
    totals.reactions_wow += r.reactions_wow;
    totals.reactions_haha += r.reactions_haha;
    totals.reactions_sorry += r.reactions_sorry;
    totals.reactions_anger += r.reactions_anger;
    if (r.fans_total != null && r.fecha > lastFansDate) {
      lastFans = r.fans_total;
      lastFansDate = r.fecha;
    }
  }
  totals.fans_total = lastFans;
  totals.fan_delta = totals.fan_adds - totals.fan_removes;
  totals.reactions_total =
    totals.reactions_like +
    totals.reactions_love +
    totals.reactions_wow +
    totals.reactions_haha +
    totals.reactions_sorry +
    totals.reactions_anger;

  const fanLatestByDim = new Map<string, FbDemographicRow[]>();
  const fanLatestDateByDim = new Map<string, string>();
  const reachedSumByDim = new Map<string, Map<string, number>>();

  for (const r of demo) {
    if (r.audience_type === "fan") {
      const key = r.dimension;
      const prev = fanLatestDateByDim.get(key);
      if (!prev || r.fecha > prev) {
        fanLatestDateByDim.set(key, r.fecha);
        fanLatestByDim.set(key, []);
      }
      if (r.fecha === fanLatestDateByDim.get(key)) {
        fanLatestByDim.get(key)!.push(r);
      }
    } else if (r.audience_type === "reached") {
      if (r.fecha < fromIso || r.fecha > toIso) continue;
      const key = r.dimension;
      let m = reachedSumByDim.get(key);
      if (!m) {
        m = new Map();
        reachedSumByDim.set(key, m);
      }
      m.set(r.category, (m.get(r.category) ?? 0) + r.value);
    }
  }

  const reachedToRows = (m: Map<string, number> | undefined): FbDemographicRow[] => {
    if (!m) return [];
    return [...m.entries()].map(([category, value]) => ({
      fecha: toIso,
      audience_type: "reached" as const,
      dimension: "age_gender" as const,
      category,
      value,
    }));
  };

  const fansByAgeGender = toBreakdown(fanLatestByDim.get("age_gender") ?? []);
  const fansByCountry = toBreakdown(fanLatestByDim.get("country") ?? []).slice(0, 10);
  const fansByCity = toBreakdown(fanLatestByDim.get("city") ?? []).slice(0, 10);
  const reachedByAgeGender = toBreakdown(reachedToRows(reachedSumByDim.get("age_gender")));

  return {
    totals,
    topPosts: posts,
    fansByAgeGender,
    fansByCountry,
    fansByCity,
    reachedByAgeGender,
    rangeLabel,
  };
}
