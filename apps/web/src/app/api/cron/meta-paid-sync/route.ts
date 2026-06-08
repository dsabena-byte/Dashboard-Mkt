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

// Parsea el nombre OMD-convention "Drean - {Categoria} - {Medio} - {TipoCompra} - {SKU} [extra]"
// Devuelve la clasificación inferida o nulls si no matchea el patrón.
function parseAdName(adName: string | null | undefined): {
  categoria: string | null;
  tipo_compra: string | null;
  rol: string | null;
} {
  if (!adName) return { categoria: null, tipo_compra: null, rol: null };
  // Separadores tolerantes (algunos ads tienen "Lavado- Meta" sin espacio).
  const parts = adName.split(/\s*-\s*/).map((p) => p.trim());
  // Esperado: ["Drean", "{Categoria}", "{Medio}", "{TipoCompra}", "{SKU}", ...]
  if (parts.length < 4) return { categoria: null, tipo_compra: null, rol: null };
  const rawCat = (parts[1] ?? "").toLowerCase();
  const rawTipo = (parts[3] ?? "").toUpperCase();
  const categoria = (() => {
    if (rawCat.startsWith("lavado")) return "Lavado";
    if (rawCat.startsWith("refriger") || rawCat.startsWith("heladera")) return "Refrigeración";
    if (rawCat.startsWith("cocci") || rawCat.startsWith("cocina")) return "Cocción";
    if (rawCat.startsWith("brand")) return "Brand";
    if (rawCat.startsWith("promo")) return "Promoción";
    if (rawCat.startsWith("ugc")) return "UGC";
    return null;
  })();
  const tipo_compra = /^(CPC|CPM|CPV)$/.test(rawTipo) ? rawTipo : null;
  const rol = tipo_compra === "CPC" ? "Consideración"
            : tipo_compra === "CPM" || tipo_compra === "CPV" ? "Awareness"
            : null;
  return { categoria, tipo_compra, rol };
}

// Agrega meta_paid_creatives del mes por (categoria, rol, tipo_compra) y
// upsertea a pauta_performance con medio='Meta'. Esto hace que el mes aparezca
// en el dropdown de /performance + alimenta los cards/charts agregados.
async function aggregateToPautaPerformance(mesLabel: string): Promise<string> {
  const url = env("NEXT_PUBLIC_SUPABASE_URL");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");

  const fetchUrl =
    `${url}/rest/v1/meta_paid_creatives?` +
    `select=categoria,rol,tipo_compra,impresiones,alcance,clicks,spend,views_total` +
    `&mes=eq.${encodeURIComponent(mesLabel)}` +
    `&categoria=not.is.null&rol=not.is.null&tipo_compra=not.is.null`;
  const fetched = await fetch(fetchUrl, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!fetched.ok) {
    return `aggregate fetch failed: ${fetched.status}`;
  }
  type AggRow = {
    categoria: string;
    rol: string;
    tipo_compra: string;
    impresiones: number | null;
    alcance: number | null;
    clicks: number | null;
    spend: number | string | null;
    views_total: number | null;
  };
  const raws = (await fetched.json()) as AggRow[];
  if (raws.length === 0) return "sin filas para agregar";

  // Group by (categoria, rol, tipo_compra)
  const acc = new Map<string, {
    categoria: string; rol: string; tipo_compra: string;
    impresiones: number; alcance: number; clicks: number; spend: number; views: number;
  }>();
  for (const r of raws) {
    const k = `${r.categoria}|${r.rol}|${r.tipo_compra}`;
    const cur = acc.get(k) ?? {
      categoria: r.categoria, rol: r.rol, tipo_compra: r.tipo_compra,
      impresiones: 0, alcance: 0, clicks: 0, spend: 0, views: 0,
    };
    cur.impresiones += Number(r.impresiones ?? 0);
    cur.alcance += Number(r.alcance ?? 0);
    cur.clicks += Number(r.clicks ?? 0);
    cur.spend += Number(r.spend ?? 0);
    cur.views += Number(r.views_total ?? 0);
    acc.set(k, cur);
  }

  // Construir filas para pauta_performance
  const rows = [...acc.values()].map((v) => {
    const costo =
      v.tipo_compra === "CPC" && v.clicks > 0 ? v.spend / v.clicks
      : v.tipo_compra === "CPM" && v.impresiones > 0 ? (v.spend / v.impresiones) * 1000
      : v.tipo_compra === "CPV" && v.views > 0 ? v.spend / v.views
      : null;
    const ctr = v.impresiones > 0 ? v.clicks / v.impresiones : null;
    return {
      mes: mesLabel,
      categoria: v.categoria,
      medio: "Meta",
      objetivo: v.rol,
      tipo_compra: v.tipo_compra,
      impresiones: v.impresiones || null,
      alcance: v.alcance || null,
      clics: v.clicks || null,
      views: v.views || null,
      inversion: Number(v.spend.toFixed(2)),
      costo: costo != null ? Number(costo.toFixed(4)) : null,
      ctr: ctr != null ? Number(ctr.toFixed(4)) : null,
    };
  });

  // Upsert a pauta_performance (unique key: mes, categoria, medio, objetivo, tipo_compra)
  const upUrl = `${url}/rest/v1/pauta_performance?on_conflict=mes,categoria,medio,objetivo,tipo_compra`;
  const upRes = await fetch(upUrl, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(rows),
  });
  if (!upRes.ok) {
    const txt = await upRes.text();
    return `aggregate upsert failed: ${upRes.status} ${txt.slice(0, 200)}`;
  }
  return `${rows.length} filas pauta_performance`;
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
    // La imagen en alta (full_picture) se lee desde el POST de la Página, no
    // desde la cuenta publicitaria. El token del system user administra la
    // Página Drean, así que para esa llamada usamos siempre ese (el token
    // override de usuario suele NO tener rol en la Página -> error #10).
    const pageToken = env("META_SYSTEM_USER_TOKEN");
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
          // La imagen de mayor resolución es la del post original (full_picture),
          // mejor que el thumbnail/preview del creative. La buscamos vía el
          // story id; si no se puede (dark post o sin permiso), usamos img.best.
          let bestImg = img.best;
          if (img.storyId) {
            const post = await graphGet<{ full_picture?: string }>(
              `${GRAPH_API}/${img.storyId}?fields=full_picture&access_token=${pageToken}`,
            ).catch(() => ({} as { full_picture?: string }));
            if (post.full_picture) bestImg = post.full_picture;
          }
          // Espejamos al bucket de Supabase (URL eterna). Key '-hd' para no
          // chocar con el espejado anterior de menor resolución (el helper
          // saltea la descarga si la key ya existe).
          const mirrored = await mirrorMetaImage(bestImg, `paid/${ad.id}-hd2.jpg`);
          // Link a la pieza = el post real detrás del ad. Para "dark posts"
          // (anuncios que no son post público) no hay link válido -> null.
          const permalink = img.storyId ? `https://www.facebook.com/${img.storyId}` : null;
          const classified = parseAdName(ad.name);
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
            categoria: classified.categoria,
            tipo_compra: classified.tipo_compra,
            rol: classified.rol,
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

    // Después del upsert per-ad, agregar por (categoria, rol, tipo_compra) y
    // volcar a pauta_performance. Hace aparecer el mes en /performance.
    const aggregateResult = await aggregateToPautaPerformance(mesLabel).catch(
      (e) => `aggregate error: ${e instanceof Error ? e.message : String(e)}`,
    );

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
      aggregate: aggregateResult,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { ok: false, phase, act_id, act_name, mes_param: mesParam, error: msg },
      { status: 500 },
    );
  }
}
