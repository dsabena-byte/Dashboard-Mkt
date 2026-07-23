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

const GADS_API = "https://googleads.googleapis.com/v18";

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
  campaign?: { id?: string; name?: string; advertisingChannelType?: string };
  adGroup?: { id?: string; name?: string };
  adGroupAd?: { ad?: { id?: string; name?: string } };
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

async function fetchCustomer(token: string, cust: { id: string; label: string }, start: string, end: string): Promise<GadsRow[]> {
  const query = `
    SELECT
      segments.date,
      campaign.id, campaign.name, campaign.advertising_channel_type,
      ad_group.id, ad_group.name,
      ad_group_ad.ad.id, ad_group_ad.ad.name,
      metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.interactions,
      metrics.video_views, metrics.video_view_rate,
      metrics.video_quartile_p25_rate, metrics.video_quartile_p50_rate,
      metrics.video_quartile_p75_rate, metrics.video_quartile_p100_rate
    FROM ad_group_ad
    WHERE segments.date BETWEEN '${start}' AND '${end}'`;

  const res = await fetch(`${GADS_API}/customers/${cust.id}/googleAds:searchStream`, {
    method: "POST",
    headers: gadsHeaders(token),
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(`searchStream ${cust.label} ${res.status}: ${(await res.text()).slice(0, 500)}`);

  // searchStream devuelve un array de batches { results: [...] }
  const batches = (await res.json()) as Array<{ results?: SearchResult[] }>;
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

    const token = await getAccessToken();
    out.auth = "OK";

    const customers = onlyCustomer ? OMD_CUSTOMERS.filter((c) => c.id === onlyCustomer) : OMD_CUSTOMERS;
    const all: GadsRow[] = [];
    const perAccount: Record<string, number> = {};
    for (const cust of customers) {
      try {
        const rows = await fetchCustomer(token, cust, start, end);
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
