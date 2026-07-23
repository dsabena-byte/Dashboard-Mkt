import { NextResponse } from "next/server";

// Ingesta directa desde la TikTok Marketing API (reporting integrado, nivel AD)
// para la cuenta de TikTok Ads de Drean. Trae el embudo de video (cuartiles) e
// interacciones que hoy se cargan a mano. Escribe en `tiktok_creatives`.
//
// Gate de validación:
//   ?dry=1        → NO escribe; devuelve filas parseadas + totales para revisar.
//   ?days=N       → ventana hacia atrás (default 30, backfill hasta 365).
//   ?advertiser=ID → limitar a un advertiser puntual.
//
// Trigger: .github/workflows/tiktok-sync.yml (Authorization: Bearer CRON_SECRET).

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const TT_API = "https://business-api.tiktok.com/open_api/v1.3";

function env(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Env var ${key} no configurada`);
  return v;
}

function advertiserIds(): string[] {
  return env("TIKTOK_ADVERTISER_ID")
    .split(",")
    .map((s) => s.replace(/\D/g, ""))
    .filter(Boolean);
}

interface TikTokRow {
  fecha: string;
  advertiser_id: string;
  campaign_id: string | null;
  campaign_name: string | null;
  adgroup_id: string | null;
  adgroup_name: string | null;
  ad_id: string;
  ad_name: string | null;
  impressions: number;
  clicks: number;
  spend: number;
  reach: number;
  frequency: number;
  video_views: number;
  video_watched_2s: number;
  video_watched_6s: number;
  video_p25: number;
  video_p50: number;
  video_p75: number;
  video_p100: number;
  likes: number;
  comments: number;
  shares: number;
  follows: number;
  profile_visits: number;
}

const METRICS = [
  "campaign_id", "campaign_name", "adgroup_id", "adgroup_name", "ad_name",
  "spend", "impressions", "clicks", "reach", "frequency",
  "video_play_actions", "video_watched_2s", "video_watched_6s",
  "video_views_p25", "video_views_p50", "video_views_p75", "video_views_p100",
  "likes", "comments", "shares", "follows", "profile_visits",
];

function n(v: unknown): number {
  if (v == null) return 0;
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? x : 0;
}

type TTItem = { dimensions?: Record<string, string>; metrics?: Record<string, string> };
type TTResponse = {
  code?: number;
  message?: string;
  data?: { list?: TTItem[]; page_info?: { total_page?: number; page?: number } };
};

async function fetchAdvertiser(advId: string, token: string, start: string, end: string): Promise<TikTokRow[]> {
  const rows: TikTokRow[] = [];
  let page = 1;
  let totalPages = 1;
  do {
    const params = new URLSearchParams({
      advertiser_id: advId,
      report_type: "BASIC",
      data_level: "AUCTION_AD",
      dimensions: JSON.stringify(["ad_id", "stat_time_day"]),
      metrics: JSON.stringify(METRICS),
      start_date: start,
      end_date: end,
      page: String(page),
      page_size: "1000",
    });
    const res = await fetch(`${TT_API}/report/integrated/get/?${params.toString()}`, {
      method: "GET",
      headers: { "Access-Token": token, "Content-Type": "application/json" },
    });
    const json = (await res.json()) as TTResponse;
    if (json.code !== 0) {
      throw new Error(`TikTok report adv ${advId}: code=${json.code} ${json.message ?? ""}`);
    }
    const list = json.data?.list ?? [];
    for (const it of list) {
      const d = it.dimensions ?? {};
      const m = it.metrics ?? {};
      const adId = d.ad_id;
      const day = d.stat_time_day;
      if (!adId || !day) continue;
      rows.push({
        fecha: day.slice(0, 10),
        advertiser_id: advId,
        campaign_id: m.campaign_id ?? null,
        campaign_name: m.campaign_name ?? null,
        adgroup_id: m.adgroup_id ?? null,
        adgroup_name: m.adgroup_name ?? null,
        ad_id: adId,
        ad_name: m.ad_name ?? null,
        impressions: n(m.impressions),
        clicks: n(m.clicks),
        spend: Math.round(n(m.spend) * 100) / 100,
        reach: n(m.reach),
        frequency: n(m.frequency),
        video_views: n(m.video_play_actions),
        video_watched_2s: n(m.video_watched_2s),
        video_watched_6s: n(m.video_watched_6s),
        video_p25: n(m.video_views_p25),
        video_p50: n(m.video_views_p50),
        video_p75: n(m.video_views_p75),
        video_p100: n(m.video_views_p100),
        likes: n(m.likes),
        comments: n(m.comments),
        shares: n(m.shares),
        follows: n(m.follows),
        profile_visits: n(m.profile_visits),
      });
    }
    totalPages = json.data?.page_info?.total_page ?? 1;
    page += 1;
  } while (page <= totalPages);
  return rows;
}

async function upsert(rows: TikTokRow[]): Promise<string> {
  if (rows.length === 0) return "sin data";
  const url = env("NEXT_PUBLIC_SUPABASE_URL");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  let total = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const res = await fetch(`${url}/rest/v1/tiktok_creatives?on_conflict=fecha,ad_id`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(chunk.map((r) => ({ ...r, updated_at: new Date().toISOString() }))),
    });
    if (!res.ok) return `error ${res.status} (chunk ${total}): ${(await res.text()).slice(0, 400)}`;
    total += chunk.length;
  }
  return `${total} filas OK`;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const out: Record<string, unknown> = {};
  try {
    const url = new URL(request.url);
    const dry = url.searchParams.get("dry") === "1";
    const days = Math.min(Math.max(Number(url.searchParams.get("days") ?? 30), 1), 365);
    const onlyAdv = url.searchParams.get("advertiser")?.replace(/\D/g, "");

    const to = new Date();
    to.setUTCDate(to.getUTCDate() - 1);
    const from = new Date(to);
    from.setUTCDate(from.getUTCDate() - (days - 1));
    const start = from.toISOString().slice(0, 10);
    const end = to.toISOString().slice(0, 10);
    out.range = `${start} → ${end}`;
    out.mode = dry ? "dry-run (no escribe)" : "ingest";

    const token = env("TIKTOK_ACCESS_TOKEN");
    const advs = onlyAdv ? [onlyAdv] : advertiserIds();
    out.advertisers = advs;

    const all: TikTokRow[] = [];
    const perAdv: Record<string, number> = {};
    for (const adv of advs) {
      try {
        const rows = await fetchAdvertiser(adv, token, start, end);
        perAdv[adv] = rows.length;
        all.push(...rows);
      } catch (e) {
        perAdv[adv] = -1;
        out[`error_${adv}`] = e instanceof Error ? e.message : String(e);
      }
    }
    out.filas_por_advertiser = perAdv;
    out.total_filas = all.length;

    if (dry) {
      out.muestra = all.slice(0, 15);
      out.totales = all.reduce(
        (a, r) => ({
          spend: a.spend + r.spend,
          impressions: a.impressions + r.impressions,
          clicks: a.clicks + r.clicks,
          video_views: a.video_views + r.video_views,
          video_p100: a.video_p100 + r.video_p100,
        }),
        { spend: 0, impressions: 0, clicks: 0, video_views: 0, video_p100: 0 },
      );
    } else {
      out.upsert = await upsert(all);
    }
    return NextResponse.json(out);
  } catch (e) {
    out.error = e instanceof Error ? e.message : String(e);
    return NextResponse.json(out, { status: 500 });
  }
}
