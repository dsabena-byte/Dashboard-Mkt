import { NextResponse } from "next/server";

const PAGE_ID = "257587170945975";
const GRAPH_API = "https://graph.facebook.com/v21.0";

function env(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Env var ${key} no configurada`);
  return v;
}

async function graphGet<T = unknown>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Graph API ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
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
  attachments?: {
    data?: Array<{
      media_type?: string;
      media?: { image?: { src?: string } };
    }>;
  };
  insights?: { data?: InsightMetric[] };
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = env("META_SYSTEM_USER_TOKEN");
  const results: Record<string, string> = {};

  const toDate = new Date();
  toDate.setUTCDate(toDate.getUTCDate() - 1);
  const fromDate = new Date(toDate);
  fromDate.setUTCDate(fromDate.getUTCDate() - 29);
  const sinceUnix = Math.floor(fromDate.getTime() / 1000);
  const untilUnix = Math.floor((toDate.getTime() + 86400000) / 1000);
  const todayIso = new Date().toISOString().slice(0, 10);

  try {
    // 1. Get Page Access Token
    const pagesRes = await graphGet<{
      data: Array<{ id: string; name: string; access_token: string }>;
    }>(`${GRAPH_API}/me/accounts?fields=id,name,access_token&access_token=${token}`);

    const page = pagesRes.data?.find((p) => p.id === PAGE_ID);
    if (!page?.access_token) {
      return NextResponse.json(
        { error: `Page ${PAGE_ID} no encontrada o sin access_token` },
        { status: 500 },
      );
    }
    const pt = page.access_token;
    results.page = `${page.name} (${page.id})`;

    // 2. Page daily insights — cada grupo por separado para tolerancia a fallos
    const METRIC_GROUPS: Array<{ metrics: string; map: Record<string, string> }> = [
      { metrics: "page_impressions,page_impressions_unique", map: { page_impressions: "impressions", page_impressions_unique: "impressions_unique" } },
      { metrics: "page_engaged_users,page_post_engagements", map: { page_engaged_users: "engaged_users", page_post_engagements: "post_engagements" } },
      { metrics: "page_fans", map: { page_fans: "fans_total" } },
      { metrics: "page_fan_adds,page_fan_removes", map: { page_fan_adds: "fan_adds", page_fan_removes: "fan_removes" } },
      { metrics: "page_views_total", map: { page_views_total: "page_views" } },
    ];

    const dailyMap = new Map<string, Record<string, unknown>>();
    const failedMetrics: string[] = [];

    for (const group of METRIC_GROUPS) {
      try {
        const gRes = await graphGet<{ data: InsightMetric[] }>(
          `${GRAPH_API}/${PAGE_ID}/insights?metric=${group.metrics}&period=day&since=${sinceUnix}&until=${untilUnix}&access_token=${pt}`,
        );
        for (const m of gRes.data ?? []) {
          const col = group.map[m.name];
          if (!col) continue;
          for (const v of m.values ?? []) {
            const fecha = (v.end_time ?? "").slice(0, 10);
            if (!fecha) continue;
            const row = dailyMap.get(fecha) ?? { fecha, page_id: PAGE_ID };
            row[col] = typeof v.value === "number" ? v.value : 0;
            dailyMap.set(fecha, row);
          }
        }
      } catch {
        failedMetrics.push(group.metrics);
      }
    }

    if (failedMetrics.length > 0) {
      results.metrics_failed = failedMetrics.join(" | ");
    }

    results.daily = await supabaseUpsert(
      "meta_page_daily",
      [...dailyMap.values()],
      "fecha,page_id",
    );

    // 3. Posts
    let postsRes: { data: FbPost[] } = { data: [] };
    try {
      postsRes = await graphGet<{ data: FbPost[] }>(
        `${GRAPH_API}/${PAGE_ID}/posts?fields=id,created_time,message,permalink_url,attachments{media_type,media{image{src}}},insights.metric(post_impressions,post_impressions_unique,post_engaged_users,post_reactions_by_type_total)&since=${sinceUnix}&until=${untilUnix}&limit=100&access_token=${pt}`,
      );
    } catch (e) {
      results.posts = `error: ${e instanceof Error ? e.message : String(e)}`;
    }

    const postRows = (postsRes.data ?? []).map((p) => {
      const im: Record<string, number> = {};
      for (const i of p.insights?.data ?? []) {
        if (Array.isArray(i.values) && i.values.length > 0) {
          const v = i.values[0]?.value;
          if (typeof v === "number") im[i.name] = v;
          else if (typeof v === "object" && v !== null) {
            im[i.name] = Object.values(v as Record<string, number>).reduce(
              (a, b) => a + (typeof b === "number" ? b : 0),
              0,
            );
          }
        }
      }
      return {
        platform: "facebook",
        post_id: p.id,
        cuenta_id: PAGE_ID,
        fecha_post: p.created_time ?? new Date().toISOString(),
        permalink: p.permalink_url ?? null,
        message: p.message ?? null,
        media_type: p.attachments?.data?.[0]?.media_type ?? null,
        thumbnail_url: p.attachments?.data?.[0]?.media?.image?.src ?? null,
        impressions: im.post_impressions ?? 0,
        reach: im.post_impressions_unique ?? 0,
        engagement: im.post_engaged_users ?? 0,
        reactions: im.post_reactions_by_type_total ?? 0,
        video_views: im.post_video_views ?? 0,
        clicks: im.post_clicks ?? 0,
      };
    });

    results.posts = await supabaseUpsert("meta_posts", postRows, "platform,post_id");

    // 4. Demographics — fans (lifetime)
    const demoConfigs = [
      { metric: "page_fans_gender_age", dimension: "age_gender" },
      { metric: "page_fans_country", dimension: "country" },
      { metric: "page_fans_city", dimension: "city" },
    ];

    const demoRows: Array<Record<string, unknown>> = [];
    const demoFailed: string[] = [];

    for (const dm of demoConfigs) {
      let dRes: { data: InsightMetric[] };
      try {
        dRes = await graphGet<{ data: InsightMetric[] }>(
          `${GRAPH_API}/${PAGE_ID}/insights?metric=${dm.metric}&period=lifetime&access_token=${pt}`,
        );
      } catch {
        demoFailed.push(dm.metric);
        continue;
      }
      const v0 = dRes.data?.[0]?.values?.[0];
      const fecha = ((v0?.end_time as string) ?? todayIso + "T00:00:00+0000").slice(0, 10);
      const dict = v0?.value;
      if (dict && typeof dict === "object") {
        for (const [k, v] of Object.entries(dict as Record<string, number>)) {
          if (typeof v === "number") {
            demoRows.push({
              fecha,
              page_id: PAGE_ID,
              audience_type: "fan",
              dimension: dm.dimension,
              category: k,
              value: v,
            });
          }
        }
      }
    }

    // 5. Demographics — reached (daily age × gender)
    try {
      const reachedRes = await graphGet<{ data: InsightMetric[] }>(
        `${GRAPH_API}/${PAGE_ID}/insights?metric=page_impressions_by_age_gender_unique&period=day&since=${sinceUnix}&until=${untilUnix}&access_token=${pt}`,
      );
      for (const vEntry of reachedRes.data?.[0]?.values ?? []) {
        const fecha = ((vEntry.end_time as string) ?? "").slice(0, 10);
        if (!fecha) continue;
        const dict = vEntry.value;
        if (dict && typeof dict === "object") {
          for (const [k, v] of Object.entries(dict as Record<string, number>)) {
            if (typeof v === "number") {
              demoRows.push({
                fecha,
                page_id: PAGE_ID,
                audience_type: "reached",
                dimension: "age_gender",
                category: k,
                value: v,
              });
            }
          }
        }
      }
    } catch {
      results.reached_demo = "no disponible";
    }

    if (demoFailed.length > 0) {
      results.demo_failed = demoFailed.join(", ");
    }

    results.demographics = await supabaseUpsert(
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
