import "server-only";
import { getServerSupabase } from "./supabase-server";

const IG_ACCOUNT_ID = "17841404990509161";

export interface IgPostRow {
  post_id: string;
  fecha_post: string;
  permalink: string | null;
  message: string | null;
  media_type: string | null;
  thumbnail_url: string | null;
  reach: number;
  engagement: number;
  reactions: number;
  video_views: number;
  clicks: number;
}

export interface IgDemoBreakdown {
  category: string;
  value: number;
  pct: number;
}

export interface IgMonthlyDatum {
  mes: string;
  alcance: number;
  engagement: number;
}

export interface IgOrganicSummary {
  totalReach: number;
  totalEngagement: number;
  totalReactions: number;
  totalComments: number;
  totalSaves: number;
  totalVideoViews: number;
  profileViews: number;
  postCount: number;
  topPosts: IgPostRow[];
  monthlyData: IgMonthlyDatum[];
  demoAge: IgDemoBreakdown[];
  demoGender: IgDemoBreakdown[];
  demoCountry: IgDemoBreakdown[];
  demoCity: IgDemoBreakdown[];
  rangeLabel: string;
}

function toBreakdown(rows: Array<{ category: string; value: number }>): IgDemoBreakdown[] {
  const total = rows.reduce((s, r) => s + r.value, 0);
  return rows
    .map((r) => ({
      category: r.category,
      value: r.value,
      pct: total > 0 ? (r.value / total) * 100 : 0,
    }))
    .sort((a, b) => b.value - a.value);
}

export async function getIgOrganicSummary(range: { from: string; to: string }): Promise<IgOrganicSummary> {
  const supabase = getServerSupabase();
  const { from: fromIso, to: toIso } = range;
  const rangeLabel = `${fromIso} → ${toIso}`;

  const MES_SHORT = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

  const [postsRes, demoRes] = await Promise.all([
    supabase
      .from("meta_posts")
      .select("post_id, fecha_post, permalink, message, media_type, thumbnail_url, reach, engagement, reactions, video_views, clicks")
      .eq("platform", "instagram")
      .gte("fecha_post", `${fromIso}T00:00:00Z`)
      .lte("fecha_post", `${toIso}T23:59:59Z`)
      .order("engagement", { ascending: false })
      .limit(200)
      .returns<IgPostRow[]>(),
    supabase
      .from("meta_fb_audience_demographics")
      .select("dimension, category, value")
      .eq("page_id", IG_ACCOUNT_ID)
      .eq("audience_type", "follower")
      .returns<Array<{ dimension: string; category: string; value: number }>>(),
  ]);

  const empty: IgOrganicSummary = {
    totalReach: 0, totalEngagement: 0, totalReactions: 0,
    totalComments: 0, totalSaves: 0, totalVideoViews: 0,
    profileViews: 0, postCount: 0, topPosts: [], monthlyData: [],
    demoAge: [], demoGender: [], demoCountry: [], demoCity: [],
    rangeLabel,
  };

  if (postsRes.error || demoRes.error) return empty;

  const posts = postsRes.data ?? [];
  const demo = demoRes.data ?? [];

  let totalReach = 0;
  let totalEngagement = 0;
  let totalReactions = 0;
  let totalSaves = 0;
  let totalVideoViews = 0;

  const monthlyMap = new Map<string, { alcance: number; engagement: number }>();

  for (const p of posts) {
    totalReach += p.reach ?? 0;
    totalEngagement += p.engagement ?? 0;
    totalReactions += p.reactions ?? 0;
    totalSaves += p.clicks ?? 0;
    totalVideoViews += p.video_views ?? 0;

    const monthKey = p.fecha_post.slice(0, 7);
    const m = monthlyMap.get(monthKey) ?? { alcance: 0, engagement: 0 };
    m.alcance += p.reach ?? 0;
    m.engagement += p.engagement ?? 0;
    monthlyMap.set(monthKey, m);
  }

  const totalComments = totalEngagement - totalReactions - totalSaves;

  const monthlyData: IgMonthlyDatum[] = [...monthlyMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, v]) => {
      const monthIdx = parseInt(key.slice(5, 7), 10) - 1;
      return {
        mes: `${MES_SHORT[monthIdx]} ${key.slice(2, 4)}`,
        alcance: v.alcance,
        engagement: v.engagement,
      };
    });

  const demoByDim = new Map<string, Array<{ category: string; value: number }>>();
  for (const r of demo) {
    const arr = demoByDim.get(r.dimension) ?? [];
    arr.push({ category: r.category, value: r.value });
    demoByDim.set(r.dimension, arr);
  }

  return {
    totalReach,
    totalEngagement,
    totalReactions,
    totalComments: Math.max(0, totalComments),
    totalSaves,
    totalVideoViews,
    profileViews: 0,
    postCount: posts.length,
    topPosts: posts,
    monthlyData,
    demoAge: toBreakdown(demoByDim.get("age") ?? []),
    demoGender: toBreakdown(demoByDim.get("gender") ?? []),
    demoCountry: toBreakdown(demoByDim.get("country") ?? []).slice(0, 10),
    demoCity: toBreakdown(demoByDim.get("city") ?? []).slice(0, 15),
    rangeLabel,
  };
}
