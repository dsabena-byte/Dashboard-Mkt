import { NextResponse } from "next/server";
import { mirrorMetaImage } from "@/lib/meta-image-mirror";

// El mirroring (descarga de Meta + subida al bucket) de varias piezas puede
// tardar unos segundos; ampliamos el límite de ejecución de la función.
export const maxDuration = 60;

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

// Junta todas las ad accounts visibles para el token: las directas
// (/me/adaccounts) + las owned/client de cada business. Las cuentas compartidas
// como partner (caso OMD → nuestro BM) suelen aparecer SOLO como client_ad_accounts
// del business y NO en /me/adaccounts, por eso hay que mirar ambos lados.
async function listAllAdAccounts(token: string): Promise<AdAccount[]> {
  const fields = "fields=id,name,account_id&limit=200";
  const direct = await graphGet<AdAccountsResp>(
    `${GRAPH_API}/me/adaccounts?${fields}&access_token=${token}`,
  ).catch(() => ({ data: [] as AdAccount[] }));

  const biz = await graphGet<{ data: Array<{ id: string }> }>(
    `${GRAPH_API}/me/businesses?fields=id&limit=50&access_token=${token}`,
  ).catch(() => ({ data: [] as Array<{ id: string }> }));

  const all: AdAccount[] = [...(direct.data ?? [])];
  for (const b of biz.data ?? []) {
    for (const edge of ["owned_ad_accounts", "client_ad_accounts"]) {
      const r = await graphGet<AdAccountsResp>(
        `${GRAPH_API}/${b.id}/${edge}?${fields}&access_token=${token}`,
      ).catch(() => ({ data: [] as AdAccount[] }));
      all.push(...(r.data ?? []));
    }
  }

  const seen = new Set<string>();
  const unique: AdAccount[] = [];
  for (const a of all) {
    if (!seen.has(a.id)) {
      seen.add(a.id);
      unique.push(a);
    }
  }
  return unique;
}

async function discoverActId(token: string): Promise<{ act_id: string; name: string }> {
  const accounts = await listAllAdAccounts(token);
  // La cuenta de Drean vive dentro de "Mabe Argentina", así que por defecto
  // matcheamos drean|mabe. Configurable vía META_AD_ACCOUNT_NAME_RE.
  const re = new RegExp(process.env.META_AD_ACCOUNT_NAME_RE ?? "drean|mabe", "i");
  const match = accounts.find((a) => re.test(a.name));
  if (!match) {
    const names = accounts.map((a) => a.name).join(", ");
    throw new Error(`No encontré cuenta que matchee /${re.source}/i. Disponibles: ${names || "(ninguna)"}`);
  }
  return { act_id: match.id, name: match.name };
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
  effective_object_story_id?: string;
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

function pickImage(c?: AdCreative): { best?: string; copy?: string; storyId?: string } {
  if (!c) return {};
  const storyLink = c.object_story_spec?.link_data;
  const storyVid = c.object_story_spec?.video_data;
  return {
    // Mejor imagen disponible: image_url full > cover de video > thumbnail
    // (que pedimos en 720px) > picture del link.
    best: c.image_url ?? storyVid?.image_url ?? c.thumbnail_url ?? storyLink?.picture,
    copy: c.body ?? storyLink?.message ?? storyVid?.message,
    storyId: c.effective_object_story_id,
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
  const debug = url.searchParams.get("debug");

  // ===== Modo debug: muestra qué ve el token sin intentar sincronizar =====
  if (debug) {
    try {
      // Permite pasar otro token por query (?token=...) solo en debug.
      // OJO: queda en logs/historial. Es para diagnóstico puntual nada más.
      const overrideToken = url.searchParams.get("token");
      const token = overrideToken ?? env("META_SYSTEM_USER_TOKEN");
      const tokenLabel = overrideToken ? "query-override" : "env(META_SYSTEM_USER_TOKEN)";
      const [me, businesses, accountsDirectas, permissions] = await Promise.all([
        graphGet<{ id: string; name?: string }>(
          `${GRAPH_API}/me?fields=id,name&access_token=${token}`,
        ).catch((e) => ({ error: String(e) })),
        graphGet<{ data: Array<{ id: string; name: string }> }>(
          `${GRAPH_API}/me/businesses?fields=id,name&limit=50&access_token=${token}`,
        ).catch((e) => ({ error: String(e) })),
        graphGet<{ data: Array<{ id: string; name?: string; account_id?: string }> }>(
          `${GRAPH_API}/me/adaccounts?fields=id,name,account_id&limit=100&access_token=${token}`,
        ).catch((e) => ({ error: String(e) })),
        graphGet<{ data: Array<{ permission: string; status: string }> }>(
          `${GRAPH_API}/me/permissions?access_token=${token}`,
        ).catch((e) => ({ error: String(e) })),
      ]);

      // Por cada business, listar las ad accounts owned + client.
      const bizList = "data" in businesses ? businesses.data : [];
      const adAccountsPorBiz = await Promise.all(
        bizList.map(async (b) => {
          const [owned, client] = await Promise.all([
            graphGet<{ data: Array<{ id: string; name?: string }> }>(
              `${GRAPH_API}/${b.id}/owned_ad_accounts?fields=id,name,account_status&limit=100&access_token=${token}`,
            ).catch((e) => ({ error: String(e) })),
            graphGet<{ data: Array<{ id: string; name?: string }> }>(
              `${GRAPH_API}/${b.id}/client_ad_accounts?fields=id,name,account_status&limit=100&access_token=${token}`,
            ).catch((e) => ({ error: String(e) })),
          ]);
          return { business: b, owned, client };
        }),
      );

      return NextResponse.json({
        ok: true,
        debug: true,
        token_source: tokenLabel,
        me,
        permissions,
        businesses,
        accountsDirectas,
        adAccountsPorBiz,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return NextResponse.json({ ok: false, debug: true, error: msg }, { status: 500 });
    }
  }

  // Precedencia de la cuenta: ?act_id= (query) > META_AD_ACCOUNT_ID (env) >
  // autodescubrimiento por nombre. El env var es la forma estable de fijar la
  // cuenta (ej. act_1428795852368328 = Mabe Argentina) sin depender del nombre.
  const envActRaw = process.env.META_AD_ACCOUNT_ID;
  const envActId = envActRaw
    ? envActRaw.startsWith("act_") ? envActRaw : `act_${envActRaw}`
    : null;
  let act_id: string | null = actOverride ?? envActId;
  let act_name = actOverride ? "(query act_id)" : envActId ? "(env META_AD_ACCOUNT_ID)" : "(pendiente)";
  let phase = "init";

  try {
    // META_PAID_TOKEN_OVERRIDE permite backfills puntuales con un token de
    // usuario (ej. token personal con acceso a la cuenta) sin tocar el token
    // del system user que usa el resto de la automatización. Si no está, usa
    // el del system user como siempre.
    const token = process.env.META_PAID_TOKEN_OVERRIDE || env("META_SYSTEM_USER_TOKEN");
    const { since, until, mesLabel } = mesRange(mesParam);

    if (!act_id) {
      phase = "discover_act";
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
      "creative{thumbnail_url.thumbnail_width(720).thumbnail_height(720),image_url,body,effective_object_story_id,object_story_spec{link_data{picture,message,link},video_data{image_url,message}}}",
      `insights.time_range({'since':'${since}','until':'${until}'}){impressions,reach,frequency,clicks,spend,ctr,cpm,cpc,date_start,date_stop}`,
    ].join(",");

    phase = "fetch_ads";
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

    phase = "upsert";
    const rows = (
      await Promise.all(
        allAds.map(async (ad) => {
          const ins = ad.insights?.data?.[0];
          if (!ins) return null; // sin impresiones en el período -> se ignora
          const img = pickImage(ad.creative);
          // Espejamos la imagen al bucket de Supabase (URL eterna). Si falla,
          // mirrorMetaImage devuelve la URL original de Meta.
          const mirrored = await mirrorMetaImage(img.best, `paid/${ad.id}.jpg`);
          // Link a la pieza = el post real detrás del ad. Para "dark posts"
          // (anuncios que no son post público) no hay link válido -> null.
          const permalink = img.storyId ? `https://www.facebook.com/${img.storyId}` : null;
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
            thumbnail_url: mirrored,
            image_url: mirrored,
            body: img.copy ?? null,
            permalink_url: permalink,
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
        }),
      )
    ).filter((r): r is NonNullable<typeof r> => r !== null);

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
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { ok: false, phase, act_id, act_name, mes_param: mesParam, error: msg },
      { status: 500 },
    );
  }
}
