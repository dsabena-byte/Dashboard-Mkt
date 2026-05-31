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
  alcance: number | null;
  engagement: number | null;
}

export interface IgOrganicSummary {
  totalReach: number;
  totalEngagement: number;
  totalReactions: number;
  totalComments: number;
  totalSaves: number;
  totalVideoViews: number;
  reachFollowers: number;
  reachNonFollowers: number;
  postCount: number;
  topPosts: IgPostRow[];
  monthlyData: IgMonthlyDatum[];
  demoAge: IgDemoBreakdown[];
  demoGender: IgDemoBreakdown[];
  demoProvince: IgDemoBreakdown[];
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

// Extrae la provincia del string de ciudad de Meta.
// Ej: "Rosario, Santa Fe" → "Santa Fe", "Córdoba, Córdoba" → "Córdoba",
// "San Nicolás de los Arroyos, Buenos Aires, Buenos Aires" → "Buenos Aires"
function aggregateProvinces(cityRows: Array<{ category: string; value: number }>): Array<{ category: string; value: number }> {
  const map = new Map<string, number>();
  for (const r of cityRows) {
    const parts = r.category.split(",").map((s) => s.trim());
    const province = parts.length > 1 ? parts[1]! : parts[0]!;
    map.set(province, (map.get(province) ?? 0) + r.value);
  }
  return [...map.entries()].map(([category, value]) => ({ category, value }));
}

export async function getIgOrganicSummary(range: { from: string; to: string }): Promise<IgOrganicSummary> {
  const supabase = getServerSupabase();
  const { from: fromIso, to: toIso } = range;
  const rangeLabel = `${fromIso} → ${toIso}`;

  const MES_SHORT = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

  const [postsRes, demoRes] = await Promise.all([
    supabase
      .from("meta_posts")
      .select("post_id, fecha_post, permalink, message, media_type, thumbnail_url, reach, reach_followers, reach_non_followers, engagement, reactions, video_views, clicks")
      .eq("platform", "instagram")
      .gte("fecha_post", `${fromIso}T00:00:00Z`)
      .lte("fecha_post", `${toIso}T23:59:59Z`)
      .order("engagement", { ascending: false })
      .limit(200)
      .returns<IgPostRow[]>(),
    supabase
      .from("meta_fb_audience_demographics")
      .select("fecha, dimension, category, value")
      .eq("page_id", IG_ACCOUNT_ID)
      .eq("audience_type", "fan")
      .order("fecha", { ascending: false })
      .returns<Array<{ fecha: string; dimension: string; category: string; value: number }>>(),
  ]);

  const empty: IgOrganicSummary = {
    totalReach: 0, totalEngagement: 0, totalReactions: 0,
    totalComments: 0, totalSaves: 0, totalVideoViews: 0,
    reachFollowers: 0, reachNonFollowers: 0, postCount: 0, topPosts: [], monthlyData: [],
    demoAge: [], demoGender: [], demoProvince: [],
    rangeLabel,
  };

  if (postsRes.error || demoRes.error) return empty;

  const posts = postsRes.data ?? [];
  const allDemo = demoRes.data ?? [];
  // Solo la fecha más reciente (evita duplicados de múltiples runs)
  const latestDemoDate = allDemo[0]?.fecha;
  const demo = latestDemoDate ? allDemo.filter((r) => r.fecha === latestDemoDate) : [];

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
  const reachFollowers = posts.reduce((s, p: any) => s + (p.reach_followers ?? 0), 0);
  const reachNonFollowers = posts.reduce((s, p: any) => s + (p.reach_non_followers ?? 0), 0);

  // Padea a 12 meses del año con data más reciente (meses sin posts -> null).
  const years = [...monthlyMap.keys()].map((k) => k.slice(0, 4));
  const targetYear = years.length > 0 ? years.sort()[years.length - 1]! : String(new Date().getFullYear());
  const monthlyData: IgMonthlyDatum[] = Array.from({ length: 12 }, (_, i) => {
    const key = `${targetYear}-${String(i + 1).padStart(2, "0")}`;
    const v = monthlyMap.get(key);
    return {
      mes: `${MES_SHORT[i]} ${targetYear.slice(2)}`,
      alcance: v ? v.alcance : null,
      engagement: v ? v.engagement : null,
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
    reachFollowers,
    reachNonFollowers,
    postCount: posts.length,
    topPosts: posts,
    monthlyData,
    demoAge: toBreakdown((demoByDim.get("age_gender") ?? []).filter((r) => /^\d/.test(r.category))),
    demoGender: toBreakdown((demoByDim.get("age_gender") ?? []).filter((r) => /^[A-Z]/.test(r.category))),
    demoProvince: toBreakdown(aggregateProvinces(demoByDim.get("city") ?? [])).slice(0, 12),
    rangeLabel,
  };
}
