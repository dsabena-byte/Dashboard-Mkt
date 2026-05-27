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

  const toDate = new Date();
  toDate.setUTCDate(toDate.getUTCDate() - 1);
  const fromDate = new Date(toDate);
  fromDate.setUTCDate(fromDate.getUTCDate() - 29);
  const sinceUnix = Math.floor(fromDate.getTime() / 1000);
  const untilUnix = Math.floor((toDate.getTime() + 86400000) / 1000);
  const todayIso = new Date().toISOString().slice(0, 10);

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
    const METRIC_TESTS = [
      "page_post_engagements",
      "page_follows",
      "page_views_total",
      "page_fan_adds",
      "page_daily_follows",
      "page_daily_follows_unique",
      "page_actions_post_reactions_total",
    ];

    const metricDiag: Record<string, unknown> = {};
    const dailyMap = new Map<string, Record<string, unknown>>();
    const workingMetrics: string[] = [];

    for (const metric of METRIC_TESTS) {
      for (const dateParam of [
        `date_preset=last_7d`,
        `since=${sinceUnix}&until=${untilUnix}`,
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
            sample: firstMetric.values?.[0] ?? null,
            dateParam,
          };
          for (const m of body.data ?? []) {
            for (const v of m.values ?? []) {
              const fecha = (v.end_time ?? "").slice(0, 10);
              if (!fecha) continue;
              const row = dailyMap.get(fecha) ?? { fecha, page_id: PAGE_ID };
              row[m.name] = typeof v.value === "number" ? v.value : 0;
              dailyMap.set(fecha, row);
            }
          }
          break;
        }
        if (raw.status !== 200) {
          metricDiag[metric] = { status: raw.status, error: body.error, dateParam };
        } else {
          metricDiag[metric] = { status: 200, dataLen: body.data?.length ?? 0, valuesLen: firstMetric?.values?.length ?? 0, dateParam };
        }
      }
    }

    results.working_metrics = workingMetrics;
    results.metric_diagnostics = metricDiag;
    results.date_range = { from: new Date(sinceUnix * 1000).toISOString().slice(0, 10), to: new Date(untilUnix * 1000).toISOString().slice(0, 10) };

    results.daily = await supabaseUpsert(
      "meta_page_daily",
      [...dailyMap.values()],
      "fecha,page_id",
    );

    // 3. Posts - fetch WITHOUT insights subquery
    let postsData: FbPost[] = [];
    const postFields = "id,created_time,message,permalink_url,shares,attachments{media_type,media{image{src}}},likes.summary(true),comments.summary(true)";

    for (const edge of ["published_posts", "posts", "feed"]) {
      const raw = await graphGetRaw(
        `${GRAPH_API}/${PAGE_ID}/${edge}?fields=${postFields}&since=${sinceUnix}&until=${untilUnix}&limit=100&access_token=${pt}`,
      );
      if (raw.status === 200) {
        const parsed = raw.body as { data: FbPost[] };
        postsData = parsed.data ?? [];
        results.posts_edge = edge;
        results.posts_count = postsData.length;
        if (postsData.length > 0) {
          const first = postsData[0];
          results.posts_sample = {
            id: first?.id,
            date: first?.created_time,
            hasLikes: !!(first?.likes?.summary),
            hasComments: !!(first?.comments?.summary),
            hasShares: !!(first?.shares),
          };
        }
        break;
      }
      results[`posts_${edge}_error`] = { status: raw.status, body: raw.body };
    }

    const postRows = postsData.map((p) => ({
      platform: "facebook",
      post_id: p.id,
      cuenta_id: PAGE_ID,
      fecha_post: p.created_time ?? new Date().toISOString(),
      permalink: p.permalink_url ?? null,
      message: p.message ?? null,
      media_type: p.attachments?.data?.[0]?.media_type ?? null,
      thumbnail_url: p.attachments?.data?.[0]?.media?.image?.src ?? null,
      impressions: 0,
      reach: 0,
      engagement: (p.likes?.summary?.total_count ?? 0) + (p.comments?.summary?.total_count ?? 0) + (p.shares?.count ?? 0),
      reactions: p.likes?.summary?.total_count ?? 0,
      video_views: 0,
      clicks: 0,
    }));

    results.posts = await supabaseUpsert("meta_posts", postRows, "platform,post_id");

    // 4. Demographics
    const demoTests = [
      { metric: "page_fans_gender_age", dimension: "age_gender" },
      { metric: "page_fans_country", dimension: "country" },
      { metric: "page_fans_city", dimension: "city" },
      { metric: "page_follows_by_age_gender_unique", dimension: "age_gender" },
    ];

    const demoRows: Array<Record<string, unknown>> = [];
    const demoDiag: Record<string, unknown> = {};

    for (const dm of demoTests) {
      const raw = await graphGetRaw(
        `${GRAPH_API}/${PAGE_ID}/insights?metric=${dm.metric}&period=lifetime&access_token=${pt}`,
      );
      const body = raw.body as { data?: InsightMetric[]; error?: unknown };
      const firstData = body.data?.[0];
      if (raw.status === 200 && firstData) {
        const v0 = firstData.values?.[0];
        const fecha = ((v0?.end_time as string | undefined) ?? todayIso + "T00:00:00+0000").slice(0, 10);
        const dict = v0?.value;
        demoDiag[dm.metric] = { status: "OK", keys: dict ? Object.keys(dict as object).length : 0 };
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
      } else {
        demoDiag[dm.metric] = { status: raw.status, error: body.error ?? "no data" };
      }
    }

    results.demo_diagnostics = demoDiag;
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
