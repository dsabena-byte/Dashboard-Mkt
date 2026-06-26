import { NextResponse } from "next/server";
import { mirrorMetaImage } from "@/lib/meta-image-mirror";

export const maxDuration = 300;

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
  reactions?: { summary?: { total_count?: number } };
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

    // Sondeo del reemplazo de reach/impresiones a nivel PÁGINA. Meta deprecó el page
    // reach el 2026-06-15 y reemplaza 'impressions' por 'views'. Diagnóstico (no almacena):
    // reporta qué métrica acepta la cuenta + valor de muestra, sin asumir el nombre.
    const pageMetricProbe = [
      // Unificados (estilo IG) por si el reach de página migró a estos nombres.
      "reach",
      "content_views",
      "total_interactions",
      "accounts_engaged",
      // Nombres clásicos de página.
      "views",
      "page_views",
      "page_impressions",
      "page_impressions_unique",
      "page_impressions_organic_v2",
      "page_impressions_organic_unique_v2",
      "page_posts_impressions",
      "page_posts_impressions_unique",
      "page_content_activity",
    ];
    const pageMetricDiag: Record<string, unknown> = {};
    for (const m of pageMetricProbe) {
      const raw = await graphGetRaw(
        `${GRAPH_API}/${PAGE_ID}/insights?metric=${m}&period=day&date_preset=last_7d&access_token=${pt}`,
      );
      const body = raw.body as { data?: InsightMetric[]; error?: { message?: string } };
      if (raw.status === 200) {
        pageMetricDiag[m] = { works: true, sample: body.data?.[0]?.values?.[0]?.value ?? null };
      } else {
        pageMetricDiag[m] = { works: false, status: raw.status, error: body.error?.message ?? body.error };
      }
    }
    results.page_metric_probe = pageMetricDiag;

    // Última variable: la VERSIÓN de la API. Usamos v22.0 (vieja); el reemplazo
    // 'views' puede existir solo en versiones nuevas. Probamos views (y un control
    // que ya anda) en v23/v25 para saber si conviene subir de versión.
    const versionProbe: Record<string, unknown> = {};
    for (const ver of ["v23.0", "v25.0"]) {
      for (const m of ["views", "page_views_total"]) {
        const raw = await graphGetRaw(
          `https://graph.facebook.com/${ver}/${PAGE_ID}/insights?metric=${m}&period=day&date_preset=last_7d&access_token=${pt}`,
        );
        const body = raw.body as { data?: InsightMetric[]; error?: { message?: string } };
        versionProbe[`${ver}/${m}`] = raw.status === 200
          ? { works: true, sample: body.data?.[0]?.values?.[0]?.value ?? null }
          : { works: false, status: raw.status, error: body.error?.message ?? body.error };
      }
    }
    results.version_probe = versionProbe;

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
    const postFields = "id,created_time,message,permalink_url,shares,attachments{media_type,media{image{src}}},reactions.summary(true),comments.summary(true)";

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
    // Candidatos a sondear. Meta deprecó el reach de posts (post_impressions_unique)
    // el 2026-06-15 y reemplaza 'impressions' por 'views'. NO asumimos cuál anda: se
    // prueba cada uno contra un post real y se reporta status + valor de muestra / error.
    const postMetricTests = [
      // Nombres UNIFICADOS (los que usa Instagram y sí funcionan en v22): Meta unificó
      // métricas cross-platform; probamos si los posts de FB ya los adoptaron.
      "reach",
      "impressions",
      "views",
      "total_interactions",
      "saved",
      "shares",
      "likes",
      "comments",
      "content_views",
      "profile_activity",
      // Viejos (deprecados 2026-06-15) — para confirmar el corte.
      "post_impressions",
      "post_impressions_unique",
      "post_clicks",
      "post_video_views",
      "post_engaged_users",
      "post_reactions_by_type_total",
      "post_activity_by_action_type",
    ];

    if (postsData.length > 0) {
      // Probar qué métricas acepta la cuenta (status 200) + valor de muestra / error.
      const testPostId = postsData[0]!.id;
      const workingPostMetrics: string[] = [];
      const postMetricDiag: Record<string, unknown> = {};
      for (const m of postMetricTests) {
        const raw = await graphGetRaw(
          `${GRAPH_API}/${testPostId}/insights?metric=${m}&access_token=${pt}`,
        );
        const body = raw.body as { data?: InsightMetric[]; error?: { message?: string } };
        if (raw.status === 200) {
          workingPostMetrics.push(m);
          postMetricDiag[m] = { works: true, sample: body.data?.[0]?.values?.[0]?.value ?? null };
        } else {
          postMetricDiag[m] = { works: false, status: raw.status, error: body.error?.message ?? body.error };
        }
      }
      results.working_post_metrics = workingPostMetrics;
      results.post_metric_diagnostics = postMetricDiag;

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

    // No perder data: traer los valores ya guardados para no pisarlos con 0 cuando
    // Meta deprecó la métrica (reach de posts deprecado el 2026-06-15).
    const existing = new Map<string, { reach: number; impressions: number; video_views: number; clicks: number }>();
    if (postsData.length > 0) {
      const sbUrl = env("NEXT_PUBLIC_SUPABASE_URL");
      const sbKey = env("SUPABASE_SERVICE_ROLE_KEY");
      const inList = `(${postsData.map((p) => `"${p.id}"`).join(",")})`;
      const exRes = await fetch(
        `${sbUrl}/rest/v1/meta_posts?platform=eq.facebook&post_id=in.${encodeURIComponent(inList)}&select=post_id,reach,impressions,video_views,clicks`,
        { headers: { apikey: sbKey, Authorization: `Bearer ${sbKey}` } },
      );
      if (exRes.ok) {
        const exRows = (await exRes.json()) as Array<{ post_id: string; reach: number | null; impressions: number | null; video_views: number | null; clicks: number | null }>;
        for (const r of exRows) existing.set(r.post_id, { reach: r.reach ?? 0, impressions: r.impressions ?? 0, video_views: r.video_views ?? 0, clicks: r.clicks ?? 0 });
      }
    }

    const postRows: Array<Record<string, unknown>> = [];
    for (const p of postsData) {
      const ins = postInsightsMap.get(p.id) ?? {};
      const ex = existing.get(p.id);
      const rawThumb = p.attachments?.data?.[0]?.media?.image?.src ?? null;
      const mirroredThumb = await mirrorMetaImage(rawThumb, `facebook/${p.id}.jpg`);
      postRows.push({
        platform: "facebook",
        post_id: p.id,
        cuenta_id: PAGE_ID,
        fecha_post: p.created_time ?? new Date().toISOString(),
        permalink: p.permalink_url ?? null,
        message: p.message ?? null,
        media_type: p.attachments?.data?.[0]?.media_type ?? null,
        thumbnail_url: mirroredThumb,
        // Self-healing: cuando Meta active la métrica nueva (reach / views = Media
        // Views/Viewers, fin jun-2026), el sondeo la mete en workingPostMetrics y acá
        // la leemos SIN recodear. Fallback a los nombres viejos, y si todo viene 0/
        // deprecado, conservamos el valor histórico (no destructivo).
        impressions: (ins.views ?? ins.post_impressions ?? 0) || (ex?.impressions ?? 0),
        reach: (ins.reach ?? ins.post_impressions_unique ?? 0) || (ex?.reach ?? 0),
        engagement: (p.comments?.summary?.total_count ?? 0) + (p.shares?.count ?? 0),
        reactions: p.reactions?.summary?.total_count ?? 0,
        video_views: (ins.post_video_views ?? 0) || (ex?.video_views ?? 0),
        clicks: (ins.post_clicks ?? 0) || (ex?.clicks ?? 0),
      });
    }

    // ===== FB Stories — DESHABILITADO =====
    // Junio 2026: el endpoint /{page-id}/stores de Graph API v22 devuelve
    // objects sin `id` (solo `creation_time` + `media_type`). Sin id no
    // podemos pedir insights ni hacer upsert con post_id único.
    //
    // Diagnóstico real capturado (?fields=id,creation_time,permalink_url,media_type,media_url,thumbnail_url):
    //   story_sample_keys: ["creation_time", "media_type"]
    //   story_sample:     {"creation_time": "1780159401", "media_type": "photo"}
    //
    // Esto es una limitación conocida de Meta: las Page Stories quedaron
    // restringidas en v18+ por privacidad. Solo Instagram Business expone
    // stories vía Graph API — eso ya lo cubre /api/cron/ig-sync.
    //
    // Para volver a habilitar:
    //   1) Verificar si una nueva versión de Graph API restaura el campo id
    //   2) O migrar a un workflow alternativo (scraper / n8n)
    results.stories = "deshabilitado (Graph API no devuelve id para FB Page Stories)";

    results.posts = await supabaseUpsert("meta_posts", postRows, "platform,post_id");

    return NextResponse.json({ ok: true, timestamp: new Date().toISOString(), results });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
