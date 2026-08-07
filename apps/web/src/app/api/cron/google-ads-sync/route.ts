import { NextResponse } from "next/server";

// Ingesta directa desde la Google Ads API (no GA4) a nivel anuncio para las
// cuentas de OMD. Trae el embudo de video (cuartiles + VTR) e interacciones que
// GA4 no expone. Escribe en `google_ads_creatives`.
//
// Gate de validación:
//   ?dry=1   → NO escribe; devuelve las filas parseadas para revisarlas contra
//              la data real antes de confiar en el conector.
//   ?days=N  → ventana hacia atrás (default 30, para backfill hasta 365).
//   ?customer=ID → limitar a una sola cuenta.
//
// Trigger: .github/workflows/google-ads-sync.yml (Authorization: Bearer CRON_SECRET).

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const GADS_API = "https://googleads.googleapis.com/v22";

// Cuentas de Google Ads gestionadas por OMD (mismas que el allowlist de GA4,
// sin el ecommerce inhouse de "Drean Argentina").
const OMD_CUSTOMERS: Array<{ id: string; label: string }> = [
  { id: "2703756419", label: "Refrigeración" },
  { id: "1597165780", label: "Lavado" },
  { id: "5791135678", label: "Cocción" },
  { id: "1257010507", label: "Search" },
];

function env(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Env var ${key} no configurada`);
  return v;
}

async function getAccessToken(): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env("GOOGLE_CLIENT_ID"),
      client_secret: env("GOOGLE_CLIENT_SECRET"),
      refresh_token: env("GOOGLE_REFRESH_TOKEN"),
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Google OAuth refresh failed ${res.status}: ${await res.text()}`);
  return ((await res.json()) as { access_token: string }).access_token;
}

function gadsHeaders(token: string): Record<string, string> {
  const h: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "developer-token": env("GOOGLE_ADS_DEVELOPER_TOKEN"),
    "Content-Type": "application/json",
  };
  const login = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID;
  if (login) h["login-customer-id"] = login.replace(/\D/g, "");
  return h;
}

interface GadsRow {
  fecha: string;
  customer_id: string;
  account_label: string;
  campaign_id: string;
  campaign_name: string | null;
  campaign_type: string | null;
  ad_group_id: string | null;
  ad_group_name: string | null;
  ad_id: string;
  ad_name: string | null;
  ad_status: string | null;
  campaign_status: string | null;
  thumbnail_url: string | null;
  impressions: number;
  clicks: number;
  cost: number;
  interactions: number;
  video_views: number;
  video_view_rate: number;
  vtr_p25: number;
  vtr_p50: number;
  vtr_p75: number;
  vtr_p100: number;
}

type SearchResult = {
  segments?: { date?: string };
  campaign?: { id?: string; name?: string; advertisingChannelType?: string; status?: string };
  adGroup?: { id?: string; name?: string };
  adGroupAd?: { ad?: { id?: string; name?: string }; status?: string };
  metrics?: {
    impressions?: string;
    clicks?: string;
    costMicros?: string;
    interactions?: string;
    videoViews?: string;
    videoViewRate?: number;
    videoQuartileP25Rate?: number;
    videoQuartileP50Rate?: number;
    videoQuartileP75Rate?: number;
    videoQuartileP100Rate?: number;
  };
};

function n(v: string | number | undefined | null): number {
  if (v == null) return 0;
  return typeof v === "number" ? v : Number(v) || 0;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// getToken(force): token cacheado; con force pide uno nuevo. El endpoint de token
// a veces devuelve tokens transitoriamente inválidos cuando se lo llama muy
// seguido → ante un 401 refrescamos y reintentamos con backoff.
type GetToken = (force: boolean) => Promise<string>;

async function fetchCustomer(getToken: GetToken, cust: { id: string; label: string }, start: string, end: string): Promise<GadsRow[]> {
  const query = `
    SELECT
      segments.date,
      campaign.id, campaign.name, campaign.advertising_channel_type, campaign.status,
      ad_group.id, ad_group.name,
      ad_group_ad.ad.id, ad_group_ad.ad.name, ad_group_ad.status,
      metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.interactions,
      metrics.video_quartile_p25_rate, metrics.video_quartile_p50_rate,
      metrics.video_quartile_p75_rate, metrics.video_quartile_p100_rate
    FROM ad_group_ad
    WHERE segments.date BETWEEN '${start}' AND '${end}'`;

  let batches: Array<{ results?: SearchResult[] }> | null = null;
  let lastBody = "";
  for (let attempt = 0; attempt < 3 && batches === null; attempt++) {
    const token = await getToken(attempt > 0); // reintentos fuerzan token fresco
    const res = await fetch(`${GADS_API}/customers/${cust.id}/googleAds:searchStream`, {
      method: "POST",
      headers: gadsHeaders(token),
      body: JSON.stringify({ query }),
    });
    if (res.ok) {
      batches = (await res.json()) as Array<{ results?: SearchResult[] }>;
      break;
    }
    lastBody = (await res.text()).slice(0, 400);
    if (res.status === 401 && attempt < 2) { await sleep(2000 * (attempt + 1)); continue; }
    throw new Error(`searchStream ${cust.label} ${res.status}: ${lastBody}`);
  }
  if (batches === null) throw new Error(`searchStream ${cust.label} 401 tras reintentos: ${lastBody}`);

  // searchStream devuelve un array de batches { results: [...] }
  const rows: GadsRow[] = [];
  for (const batch of batches) {
    for (const r of batch.results ?? []) {
      const adId = r.adGroupAd?.ad?.id;
      const fecha = r.segments?.date;
      if (!adId || !fecha) continue;
      rows.push({
        fecha,
        customer_id: cust.id,
        account_label: cust.label,
        campaign_id: r.campaign?.id ?? "",
        campaign_name: r.campaign?.name ?? null,
        campaign_type: r.campaign?.advertisingChannelType ?? null,
        ad_group_id: r.adGroup?.id ?? null,
        ad_group_name: r.adGroup?.name ?? null,
        ad_id: adId,
        ad_name: r.adGroupAd?.ad?.name ?? null,
        ad_status: r.adGroupAd?.status ?? null,
        campaign_status: r.campaign?.status ?? null,
        thumbnail_url: null, // se completa en el enriquecimiento (fetchThumbnails)
        impressions: n(r.metrics?.impressions),
        clicks: n(r.metrics?.clicks),
        cost: Math.round(n(r.metrics?.costMicros) / 1e6 * 100) / 100,
        interactions: n(r.metrics?.interactions),
        video_views: n(r.metrics?.videoViews),
        video_view_rate: n(r.metrics?.videoViewRate),
        vtr_p25: n(r.metrics?.videoQuartileP25Rate),
        vtr_p50: n(r.metrics?.videoQuartileP50Rate),
        vtr_p75: n(r.metrics?.videoQuartileP75Rate),
        vtr_p100: n(r.metrics?.videoQuartileP100Rate),
      });
    }
  }
  return rows;
}

// Enriquecimiento de thumbnails: la query de métricas no trae la imagen del
// creativo. Acá, por cuenta, resolvemos ad_id → miniatura vía
// ad_group_ad_asset_view (imagen del asset; si no hay, el thumbnail del video de
// YouTube). Best-effort: si falla, las filas quedan sin thumbnail (no rompe).
async function fetchThumbnails(getToken: GetToken, custId: string): Promise<Map<string, string>> {
  const query = `
    SELECT
      ad_group_ad.ad.id,
      asset.type,
      asset.image_asset.full_size.url,
      asset.youtube_video_asset.youtube_video_id,
      ad_group_ad_asset_view.field_type
    FROM ad_group_ad_asset_view`;
  const img = new Map<string, string>();   // ad_id → URL de imagen del creativo
  const yt = new Map<string, string>();    // ad_id → thumbnail de YouTube (ads de video)
  try {
    const token = await getToken(false);
    const res = await fetch(`${GADS_API}/customers/${custId}/googleAds:searchStream`, {
      method: "POST",
      headers: gadsHeaders(token),
      body: JSON.stringify({ query }),
    });
    if (!res.ok) return img;
    const batches = (await res.json()) as Array<{ results?: Array<{
      adGroupAd?: { ad?: { id?: string } };
      asset?: { imageAsset?: { fullSize?: { url?: string } }; youtubeVideoAsset?: { youtubeVideoId?: string } };
    }> }>;
    for (const b of batches) {
      for (const r of b.results ?? []) {
        const adId = r.adGroupAd?.ad?.id;
        if (!adId) continue;
        const url = r.asset?.imageAsset?.fullSize?.url;
        const vid = r.asset?.youtubeVideoAsset?.youtubeVideoId;
        if (url && !img.has(adId)) img.set(adId, url);
        if (vid && !yt.has(adId)) yt.set(adId, `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`);
      }
    }
    // El VIDEO de YouTube GANA sobre la imagen: si el ad tiene un video, mostramos
    // su thumbnail y el click va al video (no al logo/imagen companion).
    const out = new Map(img);
    for (const [adId, url] of yt) out.set(adId, url);
    return out;
  } catch { /* best-effort: sin thumbnails */ }
  return img;
}

async function upsert(rows: GadsRow[]): Promise<string> {
  if (rows.length === 0) return "sin data";
  const url = env("NEXT_PUBLIC_SUPABASE_URL");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  let total = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const res = await fetch(`${url}/rest/v1/google_ads_creatives?on_conflict=fecha,ad_id`, {
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
    const onlyCustomer = url.searchParams.get("customer")?.replace(/\D/g, "");

    const to = new Date();
    to.setUTCDate(to.getUTCDate() - 1);
    const from = new Date(to);
    from.setUTCDate(from.getUTCDate() - (days - 1));
    const start = from.toISOString().slice(0, 10);
    const end = to.toISOString().slice(0, 10);
    out.range = `${start} → ${end}`;
    out.mode = dry ? "dry-run (no escribe)" : "ingest";

    let cachedToken: string | null = null;
    const getToken: GetToken = async (force) => {
      if (force || !cachedToken) cachedToken = await getAccessToken();
      return cachedToken;
    };
    await getToken(false); // valida credenciales de entrada
    out.auth = "OK";

    const customers = onlyCustomer ? OMD_CUSTOMERS.filter((c) => c.id === onlyCustomer) : OMD_CUSTOMERS;
    const all: GadsRow[] = [];
    const perAccount: Record<string, number> = {};
    for (const cust of customers) {
      try {
        const rows = await fetchCustomer(getToken, cust, start, end);
        if (rows.length > 0) {
          const thumbs = await fetchThumbnails(getToken, cust.id);
          for (const row of rows) { const t = thumbs.get(row.ad_id); if (t) row.thumbnail_url = t; }
        }
        perAccount[cust.label] = rows.length;
        all.push(...rows);
      } catch (e) {
        perAccount[cust.label] = -1;
        out[`error_${cust.label}`] = e instanceof Error ? e.message : String(e);
      }
    }
    out.filas_por_cuenta = perAccount;
    out.total_filas = all.length;

    if (dry) {
      // Muestra + agregados para validar contra la realidad sin escribir.
      out.muestra = all.slice(0, 15);
      out.totales = all.reduce(
        (a, r) => ({
          cost: a.cost + r.cost,
          impressions: a.impressions + r.impressions,
          clicks: a.clicks + r.clicks,
          video_views: a.video_views + r.video_views,
        }),
        { cost: 0, impressions: 0, clicks: 0, video_views: 0 },
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
