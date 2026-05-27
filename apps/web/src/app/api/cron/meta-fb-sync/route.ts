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

function sumObjectValues(v: unknown): number {
  if (typeof v === "number") return v;
  if (v && typeof v === "object") {
    return Object.values(v as Record<string, number>).reduce(
      (a, b) => a + (typeof b === "number" ? b : 0),
      0,
    );
  }
  return 0;
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

    // 2. Page daily insights - metric name to DB column mapping
    const METRICS: Array<{ metric: string; col: string }> = [
      { metric: "page_post_engagements", col: "post_engagements" },
      { metric: "page_follows", col: "fan_adds" },
      { metric: "page_views_total", col: "page_views" },
      { metric: "page_daily_follows", col: "daily_follows" },
      { metric: "page_daily_follows_unique", col: "daily_follows_unique" },
    ];

    const metricDiag: Record<string, unknown> = {};
    const dailyMap = new Map<string, Record<string, unknown>>();
    const workingMetrics: string[] = [];

    for (const { metric, col } of METRICS) {
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
            dateParam,
          };
          for (const m of body.data ?? []) {
            for (const v of m.values ?? []) {
              const fecha = (v.end_time ?? "").slice(0, 10);
              if (!fecha) continue;
              const row = dailyMap.get(fecha) ?? { fecha, page_id: PAGE_ID };
              row[col] = sumObjectValues(v.value);
              dailyMap.set(fecha, row);
            }
          }
          break;
        }
        if (raw.status !== 200) {
          metricDiag[metric] = { status: raw.status, error: body.error, dateParam };
        } else {
          metricDiag[metric] = { status: 200, dataLen: body.data?.length ?? 0, dateParam };
        }
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

    return NextResponse.json({ ok: true, timestamp: new Date().toISOString(), results });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
