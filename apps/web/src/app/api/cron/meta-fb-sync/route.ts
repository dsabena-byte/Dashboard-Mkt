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

interface InsightMetric {
  name: string;
  values: Array<{ end_time?: string; value: unknown }>;
}

interface FbPost {
  id: string;
  created_time?: string;
  message?: string;
  permalink_url?: string;
  shares?: { count?: number };
  attachments?: {
    data?: Array<{
      media_type?: string;
      media?: { image?: { src?: string } };
    }>;
  };
  likes?: { summary?: { total_count?: number } };
  comments?: { summary?: { total_count?: number } };
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

  const toDate = new Date();
  toDate.setUTCDate(toDate.getUTCDate() - 1);
  const fromDate = new Date(toDate);
  fromDate.setUTCDate(fromDate.getUTCDate() - (daysParam - 1));
  const sinceUnix = Math.floor(fromDate.getTime() / 1000);
  const untilUnix = Math.floor((toDate.getTime() + 86400000) / 1000);
  results.days = daysParam;

  try {
    // 0. Check token permissions
    const permRes = await graphGetRaw(`${GRAPH_API}/me/permissions?access_token=${token}`);
    const perms = permRes.body as { data?: Array<{ permission: string; status: string }> };
    const grantedPerms = (perms.data ?? [])
      .filter((p) => p.status === "granted")
      .map((p) => p.permission);
    results.permissions = grantedPerms;

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
      return NextResponse.json(
        { error: `Page ${PAGE_ID} no encontrada`, pages: pagesRes.data?.map((p) => ({ id: p.id, name: p.name })) },
        { status: 500 },
      );
    }
    const pt = page.access_token;
    results.page = `${page.name} (${page.id})`;

    // 2. Page daily insights
    const SIMPLE_METRICS: Array<{ metric: string; col: string }> = [
      { metric: "page_post_engagements", col: "post_engagements" },
      { metric: "page_follows", col: "fans_total" },
      { metric: "page_views_total", col: "page_views" },
      { metric: "page_daily_follows", col: "fan_adds" },
    ];

    const metricDiag: Record<string, unknown> = {};
    const dailyMap = new Map<string, Record<string, unknown>>();
    const workingMetrics: string[] = [];

    for (const { metric, col } of SIMPLE_METRICS) {
      for (const dateParam of [
        `since=${sinceUnix}&until=${untilUnix}`,
        `date_preset=last_7d`,
      ]) {
        const raw = await graphGetRaw(
          `${GRAPH_API}/${PAGE_ID}/insights?metric=${metric}&period=day&${dateParam}&access_token=${pt}`,
        );
        const body = raw.body as { data?: InsightMetric[]; error?: unknown };
        const firstMetric = body.data?.[0];
        const hasValues = raw.status === 200 && firstMetric && (firstMetric.values?.length ?? 0) > 0;
        if (hasValues) {
          workingMetrics.push(metric);
          metricDiag[metric] = {
            status: "OK",
            valuesCount: firstMetric.values?.length ?? 0,
            col,
            dateParam,
          };
          for (const m of body.data ?? []) {
            for (const v of m.values ?? []) {
              const fecha = (v.end_time ?? "").slice(0, 10);
              if (!fecha) continue;
              const row = dailyMap.get(fecha) ?? { fecha, page_id: PAGE_ID };
              row[col] = typeof v.value === "number" ? v.value : 0;
              dailyMap.set(fecha, row);
            }
          }
          break;
        }
        if (raw.status !== 200) {
          metricDiag[metric] = { status: raw.status, error: body.error, dateParam };
        }
      }
    }

    // Reactions breakdown: page_actions_post_reactions_total returns {like, love, haha, wow, sorry, anger}
    for (const dateParam of [
      `since=${sinceUnix}&until=${untilUnix}`,
      `date_preset=last_7d`,
    ]) {
      const raw = await graphGetRaw(
        `${GRAPH_API}/${PAGE_ID}/insights?metric=page_actions_post_reactions_total&period=day&${dateParam}&access_token=${pt}`,
      );
      const body = raw.body as { data?: InsightMetric[]; error?: unknown };
      const firstMetric = body.data?.[0];
      const hasValues = raw.status === 200 && firstMetric && (firstMetric.values?.length ?? 0) > 0;
      if (hasValues) {
        workingMetrics.push("page_actions_post_reactions_total");
        metricDiag["page_actions_post_reactions_total"] = { status: "OK", dateParam };
        for (const m of body.data ?? []) {
          for (const v of m.values ?? []) {
            const fecha = (v.end_time ?? "").slice(0, 10);
            if (!fecha) continue;
            const row = dailyMap.get(fecha) ?? { fecha, page_id: PAGE_ID };
            const obj = (v.value && typeof v.value === "object" ? v.value : {}) as Record<string, number>;
            row.reactions_like = obj.like ?? 0;
            row.reactions_love = obj.love ?? 0;
            row.reactions_haha = obj.haha ?? 0;
            row.reactions_wow = obj.wow ?? 0;
            row.reactions_sorry = obj.sorry ?? 0;
            row.reactions_anger = obj.anger ?? 0;
            dailyMap.set(fecha, row);
          }
        }
        break;
      }
      if (raw.status !== 200) {
        metricDiag["page_actions_post_reactions_total"] = { status: raw.status, error: body.error };
      }
    }

    results.working_metrics = workingMetrics;
    results.metric_diagnostics = metricDiag;
    results.daily_rows = dailyMap.size;

    results.daily = await supabaseUpsert(
      "meta_page_daily",
      [...dailyMap.values()],
      "fecha,page_id",
    );

    // 3. Posts - fetch WITHOUT insights subquery, paginate for large ranges
    let postsData: FbPost[] = [];
    const postFields = "id,created_time,message,permalink_url,shares,attachments{media_type,media{image{src}}},likes.summary(true),comments.summary(true)";

    for (const edge of ["published_posts", "posts", "feed"]) {
      let nextUrl: string | null =
        `${GRAPH_API}/${PAGE_ID}/${edge}?fields=${postFields}&since=${sinceUnix}&until=${untilUnix}&limit=100&access_token=${pt}`;
      let edgeFailed = false;

      while (nextUrl && postsData.length < 500) {
        const raw = await graphGetRaw(nextUrl);
        if (raw.status !== 200) {
          if (postsData.length === 0) {
            results[`posts_${edge}_error`] = { status: raw.status, body: raw.body };
            edgeFailed = true;
          }
          break;
        }
        const parsed = raw.body as { data: FbPost[]; paging?: { next?: string } };
        postsData.push(...(parsed.data ?? []));
        nextUrl = parsed.paging?.next ?? null;
      }

      if (!edgeFailed && postsData.length > 0) {
        results.posts_edge = edge;
        results.posts_count = postsData.length;
        break;
      }
    }

    // 4. Fetch post-level insights (impressions, reach, video_views) per post
    const postInsightsMap = new Map<string, Record<string, number>>();
    const postMetricTests = [
      "post_impressions",
      "post_impressions_unique",
      "post_clicks",
      "post_video_views",
      "post_engaged_users",
    ];

    if (postsData.length > 0) {
      // Test which post metrics work on the first post
      const testPostId = postsData[0]!.id;
      const workingPostMetrics: string[] = [];
      for (const m of postMetricTests) {
        const raw = await graphGetRaw(
          `${GRAPH_API}/${testPostId}/insights?metric=${m}&access_token=${pt}`,
        );
        if (raw.status === 200) {
          workingPostMetrics.push(m);
        }
      }
      results.working_post_metrics = workingPostMetrics;

      if (workingPostMetrics.length > 0) {
        const metricsStr = workingPostMetrics.join(",");
        for (const p of postsData) {
          const raw = await graphGetRaw(
            `${GRAPH_API}/${p.id}/insights?metric=${metricsStr}&access_token=${pt}`,
          );
          if (raw.status === 200) {
            const body = raw.body as { data?: InsightMetric[] };
            const vals: Record<string, number> = {};
            for (const d of body.data ?? []) {
              const v = d.values?.[0]?.value;
              if (typeof v === "number") vals[d.name] = v;
            }
            postInsightsMap.set(p.id, vals);
          }
        }
        results.posts_with_insights = postInsightsMap.size;
      }
    }

    const postRows = postsData.map((p) => {
      const ins = postInsightsMap.get(p.id) ?? {};
      return {
        platform: "facebook",
        post_id: p.id,
        cuenta_id: PAGE_ID,
        fecha_post: p.created_time ?? new Date().toISOString(),
        permalink: p.permalink_url ?? null,
        message: p.message ?? null,
        media_type: p.attachments?.data?.[0]?.media_type ?? null,
        thumbnail_url: p.attachments?.data?.[0]?.media?.image?.src ?? null,
        impressions: ins.post_impressions ?? 0,
        reach: ins.post_impressions_unique ?? 0,
        engagement: (p.likes?.summary?.total_count ?? 0) + (p.comments?.summary?.total_count ?? 0) + (p.shares?.count ?? 0),
        reactions: p.likes?.summary?.total_count ?? 0,
        video_views: ins.post_video_views ?? 0,
        clicks: ins.post_clicks ?? 0,
      };
    });

    results.posts = await supabaseUpsert("meta_posts", postRows, "platform,post_id");

    return NextResponse.json({ ok: true, timestamp: new Date().toISOString(), results });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
