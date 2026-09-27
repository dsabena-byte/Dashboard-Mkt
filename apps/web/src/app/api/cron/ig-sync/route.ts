import { NextResponse } from "next/server";
import { mirrorMetaImage } from "@/lib/meta-image-mirror";
import { parseNavigation, mergeStoryMax, type StoryMetricRow, type StoryNav } from "@/lib/ig-stories";
import { snapshotRows, type SnapInputPost } from "@/lib/post-snapshots-core";
import { recordPostSnapshots } from "@/lib/post-snapshots";

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

interface IgMedia {
  id: string;
  timestamp?: string;
  caption?: string;
  permalink?: string;
  media_type?: string;
  media_product_type?: string;
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
    let igFollowers: number | null = null;
    if (igInfoRaw.status === 200) {
      results.ig_info = igInfoRaw.body;
      const fc = (igInfoRaw.body as { followers_count?: number }).followers_count;
      igFollowers = typeof fc === "number" ? fc : null;
    } else {
      results.ig_info_error = igInfoRaw.body;
    }

    // 3b. Get IG profile views (last 30 days)
    let profileViews = 0;
    const pvRaw = await graphGetRaw(
      `${GRAPH_API}/${igId}/insights?metric=profile_views&period=day&metric_type=total_value&since=${Math.floor(Date.now()/1000) - 86400*28}&until=${Math.floor(Date.now()/1000)}&access_token=${pt}`,
    );
    if (pvRaw.status === 200) {
      const pvData = pvRaw.body as { data?: Array<{ values?: Array<{ value: number }> }> };
      for (const v of pvData.data?.[0]?.values ?? []) {
        profileViews += v.value ?? 0;
      }
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
      `${GRAPH_API}/${igId}/media?fields=id,timestamp,caption,permalink,media_type,media_product_type,media_url,thumbnail_url,like_count,comments_count&limit=50&access_token=${pt}`;

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
    const MEDIA_INSIGHT_METRICS_DEFAULT = "reach,saved,shares,total_interactions";
    const MEDIA_INSIGHT_METRICS_REEL = "reach,saved,shares,total_interactions,views";

    const postRows: Array<Record<string, unknown>> = [];
    // Fotos por edad (1/3/7 días) de los posts PROPIOS → social_post_snapshots (migración 0115, fail-safe).
    const ownSnaps: SnapInputPost[] = [];
    let insightsOk = 0;
    let insightsFailed = 0;
    let reelCount = 0;

    for (const m of mediaData) {
      const isReel = m.media_product_type === "REELS" || m.media_type === "REEL" || m.media_type === "REELS";
      if (isReel) reelCount++;
      const metricsStr = isReel ? MEDIA_INSIGHT_METRICS_REEL : MEDIA_INSIGHT_METRICS_DEFAULT;

      let reach = 0;
      let saved = 0;
      let shares = 0;
      let totalInteractions = 0;
      let views = 0;
      let reachFollowers: number | null = null;
      let reachNonFollowers: number | null = null;

      const insRaw = await graphGetRaw(
        `${GRAPH_API}/${m.id}/insights?metric=${metricsStr}&access_token=${pt}`,
      );
      if (insRaw.status === 200) {
        const insData = insRaw.body as { data?: IgInsightMetric[] };
        for (const metric of insData.data ?? []) {
          const val = metric.values?.[0]?.value ?? 0;
          if (metric.name === "reach") reach = val;
          if (metric.name === "views") views = val;
          if (metric.name === "saved") saved = val;
          if (metric.name === "shares") shares = val;
          if (metric.name === "total_interactions") totalInteractions = val;
        }
        insightsOk++;
      } else {
        insightsFailed++;
        if (insightsFailed <= 3) {
          results[`insight_error_sample_${m.id}`] = insRaw.body;
        }
      }

      // Nota: el breakdown=follow_type NO está soportado a nivel media en v22
      // (error #100 "Incompatible breakdowns"). Lo dejamos null y resolvemos
      // el split FOLLOWER/NON_FOLLOWER a nivel account en la query de /redes.

      const rawThumb = m.thumbnail_url ?? m.media_url ?? null;
      const mirroredThumb = await mirrorMetaImage(rawThumb, `instagram/${m.id}.jpg`);

      if (m.permalink) ownSnaps.push({
        marca: "dreanargentina", red: "INSTAGRAM", url: m.permalink, ts: m.timestamp ?? null,
        likes: m.like_count ?? 0, comentarios: m.comments_count ?? 0, views: views || null,
        followers: igFollowers, alcance: reach || null,
      });

      postRows.push({
        platform: "instagram",
        post_id: m.id,
        cuenta_id: igId,
        fecha_post: m.timestamp ?? new Date().toISOString(),
        permalink: m.permalink ?? null,
        message: m.caption ?? null,
        media_type: m.media_product_type ?? m.media_type ?? "IMAGE",
        thumbnail_url: mirroredThumb,
        impressions: 0,
        reach,
        reach_followers: reachFollowers,
        reach_non_followers: reachNonFollowers,
        engagement: totalInteractions > 0 ? totalInteractions : (m.like_count ?? 0) + (m.comments_count ?? 0) + shares + saved,
        reactions: m.like_count ?? 0,
        video_views: views,
        clicks: saved,
      });
    }

    results.insights_ok = insightsOk;
    results.insights_failed = insightsFailed;
    results.reel_count = reelCount;

    // 5b. Stories — caducan en 24h. Necesita schedule frecuente para captarlas
    // antes que expiren. Insights con métricas propias de Stories.
    let storyCount = 0;
    let storyInsightsOk = 0;
    let storyInsightsFailed = 0;
    const storiesRaw = await graphGetRaw(
      `${GRAPH_API}/${igId}/stories?fields=id,timestamp,permalink,media_type,media_url,thumbnail_url&limit=50&access_token=${pt}`,
    );
    if (storiesRaw.status === 200) {
      const storiesData = (storiesRaw.body as { data?: IgMedia[] }).data ?? [];
      storyCount = storiesData.length;
      const storyRows: Array<StoryMetricRow & Record<string, unknown>> = [];
      // Métricas válidas para IG Stories en v22.0.
      const STORY_INSIGHT_METRICS = "reach,views,replies,total_interactions,profile_visits";
      for (const s of storiesData) {
        let reach = 0;
        let views = 0;
        let replies = 0;
        let totalInteractions = 0;
        let profileVisits = 0;
        const insRaw = await graphGetRaw(
          `${GRAPH_API}/${s.id}/insights?metric=${STORY_INSIGHT_METRICS}&access_token=${pt}`,
        );
        if (insRaw.status === 200) {
          const insData = insRaw.body as { data?: IgInsightMetric[] };
          for (const metric of insData.data ?? []) {
            const val = metric.values?.[0]?.value ?? 0;
            if (metric.name === "reach") reach = val;
            if (metric.name === "views") views = val;
            if (metric.name === "replies") replies = val;
            if (metric.name === "total_interactions") totalInteractions = val;
            if (metric.name === "profile_visits") profileVisits = val;
          }
          storyInsightsOk++;
        } else {
          storyInsightsFailed++;
          if (storyInsightsFailed <= 3) {
            results[`story_insight_error_sample_${s.id}`] = insRaw.body;
          }
        }
        // Navegación (toques adelante/atrás, salidas, deslizar) — llamada aparte, best-effort.
        let nav: StoryNav | null = null;
        const navRaw = await graphGetRaw(
          `${GRAPH_API}/${s.id}/insights?metric=navigation&breakdown=story_navigation_action_type&access_token=${pt}`,
        );
        if (navRaw.status === 200) nav = parseNavigation(navRaw.body);
        else if (!results.story_nav_error_sample) results.story_nav_error_sample = navRaw.body;
        const storyRawThumb = s.thumbnail_url ?? s.media_url ?? null;
        const storyMirrored = await mirrorMetaImage(storyRawThumb, `instagram/${s.id}.jpg`);
        storyRows.push({
          platform: "instagram",
          post_id: s.id,
          cuenta_id: igId,
          fecha_post: s.timestamp ?? new Date().toISOString(),
          permalink: s.permalink ?? null,
          message: null,
          media_type: "STORY",
          thumbnail_url: storyMirrored,
          impressions: 0,
          reach,
          reach_followers: null,            // breakdown=follow_type no aplica a Stories
          reach_non_followers: null,
          engagement: totalInteractions || replies,
          reactions: 0,
          video_views: views,
          clicks: replies + profileVisits,  // re-uso clicks: replies + visitas al perfil generadas
          // Detalle (sep-2026): respuestas / visitas por separado + navegación, en el jsonb `raw`.
          raw: { story: { replies, profile_visits: profileVisits, nav } },
        });
      }
      // Acumular por MÁXIMO contra lo ya guardado: el alcance de una Story solo crece hasta que caduca;
      // una lectura con menos (error, -1 de Meta) nunca pisa lo visto antes.
      if (storyRows.length) {
        const prevMap = new Map<string, StoryMetricRow>();
        try {
          const inList = `(${storyRows.map((r) => `"${r.post_id}"`).join(",")})`;
          const exRes = await fetch(
            `${env("NEXT_PUBLIC_SUPABASE_URL")}/rest/v1/meta_posts?platform=eq.instagram&post_id=in.${encodeURIComponent(inList)}&select=post_id,reach,video_views,engagement,clicks,raw`,
            { headers: { apikey: env("SUPABASE_SERVICE_ROLE_KEY"), Authorization: `Bearer ${env("SUPABASE_SERVICE_ROLE_KEY")}` } },
          );
          if (exRes.ok) for (const r of (await exRes.json()) as StoryMetricRow[]) prevMap.set(r.post_id, r);
        } catch { /* sin previo → se guarda la lectura actual */ }
        for (const r of storyRows) postRows.push(mergeStoryMax(prevMap.get(r.post_id), r) as unknown as Record<string, unknown>);
      }
    } else {
      results.stories_error = storiesRaw.body;
    }
    results.story_count = storyCount;
    results.story_insights_ok = storyInsightsOk;
    results.story_insights_failed = storyInsightsFailed;

    // Stories y posts van en upserts SEPARADOS: PostgREST toma las columnas del 1er objeto y las
    // Stories llevan `raw` (los posts no → no se pisa su raw con null).
    const storyUpserts = postRows.filter((r) => r.media_type === "STORY");
    const feedUpserts = postRows.filter((r) => r.media_type !== "STORY");
    results.posts = await supabaseUpsert("meta_posts", feedUpserts, "platform,post_id");
    results.stories_upsert = await supabaseUpsert("meta_posts", storyUpserts, "platform,post_id");
    results.own_snapshots = await recordPostSnapshots(snapshotRows(ownSnaps, new Date()), "graph");

    // 6. IG account insights (followers demographics with breakdown) → store in Supabase
    const demoBreakdowns: Array<{ breakdown: string; dimension: string }> = [
      { breakdown: "age", dimension: "age_gender" },
      { breakdown: "gender", dimension: "age_gender" },
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
            audience_type: "fan",
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
