import { NextResponse } from "next/server";

const PAGE_ID = "257587170945975";
const GRAPH_API = "https://graph.facebook.com/v22.0";

function env(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Env var ${key} no configurada`);
  return v;
}

async function graphGetRaw(url: string): Promise<{ status: number; body: unknown }> {
  const res = await fetch(url);
  const body = await res.json();
  return { status: res.status, body };
}

async function supabaseUpsert(
  table: string,
  rows: unknown[],
  onConflict: string,
): Promise<string> {
  if (rows.length === 0) return "sin data";
  const url = env("NEXT_PUBLIC_SUPABASE_URL");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  const res = await fetch(`${url}/rest/v1/${table}?on_conflict=${onConflict}`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    const body = await res.text();
    return `error ${res.status}: ${body}`;
  }
  return `${rows.length} filas OK`;
}

interface IgMedia {
  id: string;
  timestamp?: string;
  caption?: string;
  permalink?: string;
  media_type?: string;
  media_url?: string;
  thumbnail_url?: string;
  like_count?: number;
  comments_count?: number;
}

interface IgInsightMetric {
  name: string;
  values: Array<{ value: number }>;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = env("META_SYSTEM_USER_TOKEN");
  const results: Record<string, unknown> = {};

  const url = new URL(request.url);
  const daysParam = Math.min(Number(url.searchParams.get("days")) || 30, 365);

  try {
    // 1. Get Page Access Token
    const pagesRaw = await graphGetRaw(
      `${GRAPH_API}/me/accounts?fields=id,name,access_token&access_token=${token}`,
    );
    if (pagesRaw.status !== 200) {
      return NextResponse.json({ error: "No se pudo obtener paginas", detail: pagesRaw.body }, { status: 500 });
    }
    const pagesRes = pagesRaw.body as { data: Array<{ id: string; name: string; access_token: string }> };
    const page = pagesRes.data?.find((p) => p.id === PAGE_ID);
    if (!page?.access_token) {
      return NextResponse.json({ error: `Page ${PAGE_ID} no encontrada` }, { status: 500 });
    }
    const pt = page.access_token;
    results.page = `${page.name} (${page.id})`;

    // 2. Get Instagram Business Account ID
    const igRaw = await graphGetRaw(
      `${GRAPH_API}/${PAGE_ID}?fields=instagram_business_account&access_token=${pt}`,
    );
    if (igRaw.status !== 200) {
      return NextResponse.json({ error: "No se pudo obtener IG Business Account", detail: igRaw.body }, { status: 500 });
    }
    const igData = igRaw.body as { instagram_business_account?: { id: string } };
    const igId = igData.instagram_business_account?.id;
    if (!igId) {
      return NextResponse.json({
        error: "La página no tiene una cuenta de Instagram Business vinculada",
        detail: igRaw.body,
      }, { status: 500 });
    }
    results.ig_account_id = igId;

    // 3. Get IG account info
    const igInfoRaw = await graphGetRaw(
      `${GRAPH_API}/${igId}?fields=username,name,followers_count,media_count,profile_picture_url&access_token=${pt}`,
    );
    if (igInfoRaw.status === 200) {
      results.ig_info = igInfoRaw.body;
    } else {
      results.ig_info_error = igInfoRaw.body;
    }

    // 3b. Get IG profile views (last 30 days)
    let profileViews = 0;
    const pvRaw = await graphGetRaw(
      `${GRAPH_API}/${igId}/insights?metric=profile_views&period=day&metric_type=total_value&access_token=${pt}`,
    );
    if (pvRaw.status === 200) {
      const pvData = pvRaw.body as { data?: Array<{ total_value?: { value?: number } }> };
      profileViews = pvData.data?.[0]?.total_value?.value ?? 0;
      results.profile_views = profileViews;
    } else {
      results.profile_views_error = pvRaw.body;
    }

    // 4. Fetch IG media (posts) with pagination
    const sinceDate = new Date();
    sinceDate.setUTCDate(sinceDate.getUTCDate() - daysParam);
    const sinceIso = sinceDate.toISOString();

    let mediaData: IgMedia[] = [];
    let nextUrl: string | null =
      `${GRAPH_API}/${igId}/media?fields=id,timestamp,caption,permalink,media_type,media_url,thumbnail_url,like_count,comments_count&limit=50&access_token=${pt}`;

    while (nextUrl && mediaData.length < 500) {
      const raw = await graphGetRaw(nextUrl);
      if (raw.status !== 200) {
        results.media_error = raw.body;
        break;
      }
      const parsed = raw.body as { data: IgMedia[]; paging?: { next?: string } };
      const batch = parsed.data ?? [];

      let reachedOldPost = false;
      for (const m of batch) {
        if (m.timestamp && m.timestamp < sinceIso) {
          reachedOldPost = true;
          break;
        }
        mediaData.push(m);
      }
      if (reachedOldPost) break;
      nextUrl = parsed.paging?.next ?? null;
    }

    results.media_count = mediaData.length;

    // 5. Fetch insights per media (v22.0 supported metrics)
    const MEDIA_INSIGHT_METRICS_IMAGE = "reach,saved,shares,total_interactions";
    const MEDIA_INSIGHT_METRICS_VIDEO = "reach,saved,shares,total_interactions";
    const MEDIA_INSIGHT_METRICS_REEL = "reach,saved,shares,total_interactions,ig_reels_video_view_total_time";

    const postRows: Array<Record<string, unknown>> = [];
    let insightsOk = 0;
    let insightsFailed = 0;

    for (const m of mediaData) {
      const mediaType = m.media_type ?? "IMAGE";
      let metricsStr = MEDIA_INSIGHT_METRICS_IMAGE;
      if (mediaType === "VIDEO") metricsStr = MEDIA_INSIGHT_METRICS_VIDEO;
      if (mediaType === "REEL" || mediaType === "REELS") metricsStr = MEDIA_INSIGHT_METRICS_REEL;

      let reach = 0;
      let saved = 0;
      let shares = 0;
      let totalInteractions = 0;
      let reelViewTime = 0;

      const insRaw = await graphGetRaw(
        `${GRAPH_API}/${m.id}/insights?metric=${metricsStr}&access_token=${pt}`,
      );
      if (insRaw.status === 200) {
        const insData = insRaw.body as { data?: IgInsightMetric[] };
        for (const metric of insData.data ?? []) {
          const val = metric.values?.[0]?.value ?? 0;
          if (metric.name === "reach") reach = val;
          if (metric.name === "saved") saved = val;
          if (metric.name === "shares") shares = val;
          if (metric.name === "total_interactions") totalInteractions = val;
          if (metric.name === "ig_reels_video_view_total_time") reelViewTime = val;
        }
        insightsOk++;
      } else {
        insightsFailed++;
        if (insightsFailed <= 3) {
          results[`insight_error_sample_${m.id}`] = insRaw.body;
        }
      }

      postRows.push({
        platform: "instagram",
        post_id: m.id,
        cuenta_id: igId,
        fecha_post: m.timestamp ?? new Date().toISOString(),
        permalink: m.permalink ?? null,
        message: m.caption ?? null,
        media_type: mediaType,
        thumbnail_url: m.thumbnail_url ?? m.media_url ?? null,
        impressions: 0,
        reach,
        engagement: totalInteractions > 0 ? totalInteractions : (m.like_count ?? 0) + (m.comments_count ?? 0) + shares + saved,
        reactions: m.like_count ?? 0,
        video_views: Math.round(reelViewTime / 1000),
        clicks: saved,
      });
    }

    results.insights_ok = insightsOk;
    results.insights_failed = insightsFailed;

    results.posts = await supabaseUpsert("meta_posts", postRows, "platform,post_id");

    // 6. IG account insights (followers demographics with breakdown) → store in Supabase
    const demoBreakdowns: Array<{ breakdown: string; dimension: string }> = [
      { breakdown: "age", dimension: "age" },
      { breakdown: "gender", dimension: "gender" },
      { breakdown: "country", dimension: "country" },
      { breakdown: "city", dimension: "city" },
    ];
    const demoDiag: Record<string, unknown> = {};
    const demoRows: Array<Record<string, unknown>> = [];
    const todayIso = new Date().toISOString().slice(0, 10);

    for (const { breakdown, dimension } of demoBreakdowns) {
      const raw = await graphGetRaw(
        `${GRAPH_API}/${igId}/insights?metric=follower_demographics&period=lifetime&metric_type=total_value&breakdown=${breakdown}&access_token=${pt}`,
      );
      if (raw.status === 200) {
        const body = raw.body as {
          data?: Array<{
            total_value?: {
              breakdowns?: Array<{
                results?: Array<{ dimension_values: string[]; value: number }>;
              }>;
            };
          }>;
        };
        const breakdownResults = body.data?.[0]?.total_value?.breakdowns?.[0]?.results ?? [];
        demoDiag[`follower_demographics_${breakdown}`] = { status: "OK", count: breakdownResults.length };
        for (const r of breakdownResults) {
          demoRows.push({
            fecha: todayIso,
            page_id: igId,
            audience_type: "follower",
            dimension,
            category: r.dimension_values[0] ?? "unknown",
            value: r.value,
          });
        }
      } else {
        demoDiag[`follower_demographics_${breakdown}`] = { status: raw.status, error: raw.body };
      }
    }

    results.demographics = demoDiag;
    results.demo_rows = demoRows.length;
    results.demo_upsert = await supabaseUpsert(
      "meta_fb_audience_demographics",
      demoRows,
      "fecha,page_id,audience_type,dimension,category",
    );

    return NextResponse.json({ ok: true, timestamp: new Date().toISOString(), results });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
