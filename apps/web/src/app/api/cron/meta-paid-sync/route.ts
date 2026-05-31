import { NextResponse } from "next/server";

// Sincroniza piezas pautadas (ads) de Meta + sus insights del mes elegido a
// la tabla meta_paid_creatives. Por defecto: mes actual.
// Override: ?mes=YYYY-MM (ej. ?mes=2026-04) y opcional ?act_id=act_123 para
// forzar una cuenta. Si no se pasa, autodescubre la cuenta cuyo nombre matchee
// /drean/i (case-insensitive) entre las cuentas accesibles por el token.

const GRAPH_API = "https://graph.facebook.com/v22.0";

const MES_NAME_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function env(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Env var ${key} no configurada`);
  return v;
}

function mesRange(yyyymm: string): { since: string; until: string; mesLabel: string } {
  const [yStr, mStr] = yyyymm.split("-");
  const y = parseInt(yStr!, 10);
  const m = parseInt(mStr!, 10);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const last = new Date(Date.UTC(y, m, 0)); // último día del mes
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return {
    since: fmt(first),
    until: fmt(last),
    mesLabel: `${MES_NAME_ES[m - 1]} ${y}`,
  };
}

async function graphGet<T = unknown>(url: string): Promise<T> {
  const res = await fetch(url);
  const body = await res.json();
  if (!res.ok) {
    throw new Error(`Graph ${res.status}: ${JSON.stringify(body).slice(0, 400)}`);
  }
  return body as T;
}

interface AdAccount { id: string; name: string; account_id: string; }
interface AdAccountsResp { data: AdAccount[]; }

async function discoverActId(token: string): Promise<{ act_id: string; name: string }> {
  const url = `${GRAPH_API}/me/adaccounts?fields=id,name,account_id&limit=100&access_token=${token}`;
  const r = await graphGet<AdAccountsResp>(url);
  const drean = r.data.find((a) => /drean/i.test(a.name));
  if (!drean) {
    const names = r.data.map((a) => a.name).join(", ");
    throw new Error(`No encontré cuenta con 'drean' en el nombre. Disponibles: ${names || "(ninguna)"}`);
  }
  return { act_id: drean.id, name: drean.name };
}

interface CreativeStorySpec {
  link_data?: { picture?: string; message?: string; link?: string };
  video_data?: { image_url?: string; message?: string };
}
interface AdCreative {
  id?: string;
  thumbnail_url?: string;
  image_url?: string;
  body?: string;
  object_story_spec?: CreativeStorySpec;
}
interface AdInsight {
  impressions?: string;
  reach?: string;
  frequency?: string;
  clicks?: string;
  spend?: string;
  ctr?: string;
  cpm?: string;
  cpc?: string;
  date_start?: string;
  date_stop?: string;
}
interface MetaAd {
  id: string;
  name?: string;
  campaign_id?: string;
  adset_id?: string;
  campaign?: { name?: string; objective?: string };
  adset?: { name?: string };
  creative?: AdCreative;
  insights?: { data?: AdInsight[] };
}
interface AdsResp { data: MetaAd[]; paging?: { next?: string }; }

function pickImage(c?: AdCreative): { thumb?: string; image?: string; copy?: string } {
  if (!c) return {};
  const storyLink = c.object_story_spec?.link_data;
  const storyVid = c.object_story_spec?.video_data;
  return {
    thumb: c.thumbnail_url,
    image: c.image_url ?? storyLink?.picture ?? storyVid?.image_url,
    copy: c.body ?? storyLink?.message ?? storyVid?.message,
  };
}

function toNum(v: string | undefined): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

async function supabaseUpsert(rows: unknown[]): Promise<string> {
  if (rows.length === 0) return "sin filas";
  const url = env("NEXT_PUBLIC_SUPABASE_URL");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  const res = await fetch(
    `${url}/rest/v1/meta_paid_creatives?on_conflict=ad_id,mes`,
    {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(rows),
    },
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Supabase ${res.status}: ${body.slice(0, 400)}`);
  }
  return `${rows.length} filas upserteadas`;
}

export async function GET(req: Request) {
  // Gate: Vercel Cron envía Authorization: Bearer CRON_SECRET.
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const today = new Date();
  const mesParam = url.searchParams.get("mes") ?? `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, "0")}`;
  const actOverride = url.searchParams.get("act_id");

  const token = env("META_SYSTEM_USER_TOKEN");
  const { since, until, mesLabel } = mesRange(mesParam);

  let act_id = actOverride;
  let act_name = actOverride ?? "(override)";
  if (!act_id) {
    const found = await discoverActId(token);
    act_id = found.act_id;
    act_name = found.name;
  }

  const fields = [
    "id",
    "name",
    "campaign_id",
    "adset_id",
    "campaign{name,objective}",
    "adset{name}",
    "creative{thumbnail_url,image_url,body,object_story_spec{link_data{picture,message,link},video_data{image_url,message}}}",
    `insights.time_range({'since':'${since}','until':'${until}'}){impressions,reach,frequency,clicks,spend,ctr,cpm,cpc,date_start,date_stop}`,
  ].join(",");

  let nextUrl: string | undefined =
    `${GRAPH_API}/${act_id}/ads?fields=${encodeURIComponent(fields)}&limit=50&access_token=${token}`;

  const allAds: MetaAd[] = [];
  let pages = 0;
  while (nextUrl && pages < 20) {
    const page: AdsResp = await graphGet<AdsResp>(nextUrl);
    allAds.push(...(page.data ?? []));
    nextUrl = page.paging?.next;
    pages++;
  }

  const rows = allAds
    .map((ad) => {
      const ins = ad.insights?.data?.[0];
      if (!ins) return null; // sin impresiones en el período -> se ignora
      const img = pickImage(ad.creative);
      return {
        ad_id: ad.id,
        mes: mesLabel,
        fecha_desde: ins.date_start ?? since,
        fecha_hasta: ins.date_stop ?? until,
        act_id,
        campaign_id: ad.campaign_id ?? null,
        campaign_name: ad.campaign?.name ?? null,
        adset_id: ad.adset_id ?? null,
        adset_name: ad.adset?.name ?? null,
        ad_name: ad.name ?? null,
        objective: ad.campaign?.objective ?? null,
        plataforma: "meta",
        thumbnail_url: img.thumb ?? null,
        image_url: img.image ?? null,
        body: img.copy ?? null,
        permalink_url: `https://www.facebook.com/${ad.id}`,
        impresiones: Math.round(toNum(ins.impressions) ?? 0),
        alcance: Math.round(toNum(ins.reach) ?? 0),
        frecuencia: toNum(ins.frequency),
        clicks: Math.round(toNum(ins.clicks) ?? 0),
        spend: toNum(ins.spend) ?? 0,
        ctr: toNum(ins.ctr),
        cpm: toNum(ins.cpm),
        cpc: toNum(ins.cpc),
        raw: ad as unknown,
        fetched_at: new Date().toISOString(),
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  const upsertResult = await supabaseUpsert(rows);

  return NextResponse.json({
    ok: true,
    act_id,
    act_name,
    mes: mesLabel,
    rango: { since, until },
    pages_fetched: pages,
    ads_total: allAds.length,
    ads_con_insights: rows.length,
    upsert: upsertResult,
  });
}
