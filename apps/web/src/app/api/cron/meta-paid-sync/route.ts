import { NextResponse } from "next/server";
import { mirrorMetaImage } from "@/lib/meta-image-mirror";

// El mirroring (descarga de Meta + subida al bucket) + los insights de muchos
// ads pueden pasar de 60s en meses con más pauta (junio daba 504
// FUNCTION_INVOCATION_TIMEOUT). Subimos a 300s como meta-fb-sync / ig-sync.
export const maxDuration = 300;

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
  video_data?: { image_url?: string; message?: string; video_id?: string };
}
interface AssetFeedSpec {
  videos?: Array<{ video_id?: string; thumbnail_url?: string }>;
  images?: Array<{ hash?: string; url?: string }>;
}
interface AdCreative {
  id?: string;
  thumbnail_url?: string;
  image_url?: string;
  video_id?: string;
  body?: string;
  effective_object_story_id?: string;
  instagram_permalink_url?: string;
  object_story_spec?: CreativeStorySpec;
  asset_feed_spec?: AssetFeedSpec;
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
  // Métricas de video (arrays de {action_type, value}); se suman los values.
  video_play_actions?: Array<{ value?: string }>;
  video_p25_watched_actions?: Array<{ value?: string }>;
  video_p50_watched_actions?: Array<{ value?: string }>;
  video_p75_watched_actions?: Array<{ value?: string }>;
  video_p100_watched_actions?: Array<{ value?: string }>;
  video_thruplay_watched_actions?: Array<{ value?: string }>;
  // Interacciones del post (breakdown por action_type).
  actions?: Array<{ action_type?: string; value?: string }>;
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

function pickImage(c?: AdCreative): { best?: string; copy?: string; storyId?: string; videoId?: string } {
  if (!c) return {};
  const storyLink = c.object_story_spec?.link_data;
  const storyVid = c.object_story_spec?.video_data;
  // Creatives dinámicos / Advantage+ guardan sus assets en asset_feed_spec
  // (no en object_story_spec). De ahí salen el video_id y la imagen full.
  const afs = c.asset_feed_spec;
  const afsVideoId = afs?.videos?.find((v) => v.video_id)?.video_id;
  const afsImage = afs?.images?.find((i) => i.url)?.url;
  return {
    // Mejor imagen disponible: image_url full > imagen del asset_feed_spec >
    // cover de video > thumbnail (64×64 para video) > picture del link. Para
    // video, lo mejor es el thumbnail del video en alta (fetch /{video_id}/thumbnails).
    best: c.image_url ?? afsImage ?? storyVid?.image_url ?? c.thumbnail_url ?? storyLink?.picture,
    copy: c.body ?? storyLink?.message ?? storyVid?.message,
    storyId: c.effective_object_story_id,
    videoId: c.video_id ?? storyVid?.video_id ?? afsVideoId,
  };
}

function toNum(v: string | undefined): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// Extrae el valor de un action_type específico del array `actions` (interacciones).
function actionVal(arr: Array<{ action_type?: string; value?: string }> | undefined, type: string): number {
  const a = arr?.find((x) => x.action_type === type);
  return a ? Math.round(Number(a.value ?? 0) || 0) : 0;
}

// Suma los `value` de un array de acciones de Meta (video_pXX_watched_actions, etc.).
function sumActions(arr: Array<{ value?: string }> | undefined): number {
  if (!arr || arr.length === 0) return 0;
  return arr.reduce((s, a) => s + (Number(a.value ?? 0) || 0), 0);
}

// Parsea el nombre OMD-convention "Drean - {Categoria} - {Medio} - {TipoCompra} - {SKU} [extra]"
// Devuelve la clasificación inferida o nulls si no matchea el patrón.
function parseAdName(adName: string | null | undefined, objective?: string | null, campaignName?: string | null): {
  categoria: string | null;
  tipo_compra: string | null;
  rol: string | null;
} {
  if (!adName && !campaignName) return { categoria: null, tipo_compra: null, rol: null };
  adName = adName ?? "";
  // Separadores tolerantes (algunos ads tienen "Lavado- Meta" sin espacio).
  const parts = adName.split(/\s*-\s*/).map((p) => p.trim());
  // Esperado: ["Drean", "{Categoria}", "{Medio}", "{TipoCompra}", "{SKU}", ...]
  let categoria: string | null = null;
  let tipo_compra: string | null = null;
  if (parts.length >= 4) {
    const rawCat = (parts[1] ?? "").toLowerCase();
    const rawTipo = (parts[3] ?? "").toUpperCase();
    categoria =
      rawCat.startsWith("lavado") ? "Lavado"
      : rawCat.startsWith("refriger") || rawCat.startsWith("heladera") ? "Refrigeración"
      : rawCat.startsWith("cocci") || rawCat.startsWith("cocina") ? "Cocción"
      : rawCat.startsWith("brand") ? "Brand"
      : rawCat.startsWith("promo") ? "Promoción"
      : rawCat.startsWith("ugc") ? "UGC"
      : null;
    if (/^(CPC|CPM|CPV)$/.test(rawTipo)) tipo_compra = rawTipo;
  }
  // Fallback para nomenclatura alternativa (ej. UGC con underscores:
  // "META_Drean_UGC_IG_Video..._CPM_2026"): detecta UGC y el tipo de compra en
  // cualquier parte del nombre, no solo en el patrón de guiones.
  if (!categoria && /(^|[^a-z])ugc([^a-z]|$)/i.test(adName)) categoria = "UGC";
  // Brand: piezas institucionales sin categoría de producto — videos "MASTER" de
  // marca (ej. "Drean_Video_MASTER ... DREAN VIDEO AD TOKIO 15s") o que mencionan
  // "brand" en cualquier parte del nombre.
  if (!categoria && (/video[ _]?master/i.test(adName) || /(^|[^a-z])brand([^a-z]|$)/i.test(adName))) categoria = "Brand";
  // Fallback por nombre de CAMPAÑA (ej. "MABE_Drean_Reach_UGC_Julio_26"): si el ad
  // no encodea la categoría en su nombre, la derivamos de la campaña. UGC primero
  // (campañas de creadores). Los separadores son "_", que cuentan como no-letra.
  if (!categoria && campaignName) {
    const c = campaignName.toLowerCase();
    categoria =
      /(^|[^a-z])ugc([^a-z]|$)/.test(c) ? "UGC"
      : /lavado/.test(c) ? "Lavado"
      : /refriger|heladera/.test(c) ? "Refrigeración"
      : /cocci|cocina/.test(c) ? "Cocción"
      : /promo/.test(c) ? "Promoción"
      : (/(^|[^a-z])brand([^a-z]|$)/.test(c) || /video[ _]?master/.test(c)) ? "Brand"
      : null;
  }
  if (!tipo_compra) {
    const m = `${adName} ${campaignName ?? ""}`.toUpperCase().match(/(?:^|[^A-Z])(CPC|CPM|CPV)(?:[^A-Z]|$)/);
    if (m) tipo_compra = m[1] ?? null;
  }
  // Tipo de compra por convención de campaña (Reach → CPM, Tráfico → CPC).
  if (!tipo_compra && campaignName) {
    if (/reach/i.test(campaignName)) tipo_compra = "CPM";
    else if (/tr[aá]fico|traffic/i.test(campaignName)) tipo_compra = "CPC";
  }
  // Si el nombre no trae el tipo de compra (ej. los videos MASTER de marca), lo
  // derivamos del objetivo de la campaña: awareness/reach → CPM; tráfico/clicks → CPC.
  if (!tipo_compra && objective) {
    const o = objective.toUpperCase();
    if (/AWARENESS|REACH|VIDEO_VIEWS|THRUPLAY/.test(o)) tipo_compra = "CPM";
    else if (/TRAFFIC|LINK_CLICKS|CLICKS/.test(o)) tipo_compra = "CPC";
  }
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

// Resuelve la mejor imagen de un creative y la espeja al bucket (key -hd7).
// Para video prioriza el thumbnail del video en alta; el video_id puede venir
// inline, del post (attachments) o de asset_feed_spec. Devuelve la URL espejada
// + por qué vía se resolvió. Lo usa el modo "repair" (fetch por ad_id directo).
async function resolveBestImageUrl(
  creative: AdCreative | undefined,
  adId: string,
  pageToken: string,
): Promise<{ mirrored: string | null; via: "video_thumb" | "full_picture" | "fallback"; thumbW: number }> {
  const img = pickImage(creative);
  let bestImg = img.best;
  let gotHd = false;
  let videoId: string | null = img.videoId ?? null;
  let fullPic: string | undefined;
  let thumbW = 0;
  if (img.storyId) {
    const post = await graphGet<{
      full_picture?: string;
      attachments?: { data?: Array<{ type?: string; target?: { id?: string }; subattachments?: { data?: Array<{ type?: string; target?: { id?: string } }> } }> };
    }>(
      `${GRAPH_API}/${img.storyId}?fields=full_picture,attachments{type,target,subattachments}&access_token=${pageToken}`,
    ).catch(() => ({} as { full_picture?: string; attachments?: { data?: Array<{ type?: string; target?: { id?: string }; subattachments?: { data?: Array<{ type?: string; target?: { id?: string } }> } }> } }));
    fullPic = post.full_picture;
    if (!videoId) {
      const att = post.attachments?.data?.[0];
      if (att?.type?.includes("video")) {
        videoId = att.target?.id ?? att.subattachments?.data?.[0]?.target?.id ?? null;
      } else {
        const sub = att?.subattachments?.data?.find((s) => s.type?.includes("video"));
        if (sub) videoId = sub.target?.id ?? null;
      }
    }
  }
  if (videoId) {
    const vt = await graphGet<{ thumbnails?: { data?: Array<{ uri?: string; width?: number }> } }>(
      `${GRAPH_API}/${videoId}?fields=thumbnails{uri,width,height,is_preferred}&access_token=${pageToken}`,
    ).catch(() => ({} as { thumbnails?: { data?: Array<{ uri?: string; width?: number }> } }));
    const thumbs = vt.thumbnails?.data ?? [];
    const chosen = [...thumbs].sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0];
    if (chosen?.uri) {
      bestImg = chosen.uri;
      gotHd = true;
      thumbW = chosen.width ?? 0;
    }
  }
  let via: "video_thumb" | "full_picture" | "fallback" = "fallback";
  if (gotHd) via = "video_thumb";
  else if (fullPic) {
    bestImg = fullPic;
    via = "full_picture";
  }
  const mirrored = await mirrorMetaImage(bestImg, `paid/${adId}-hd7.jpg`);
  return { mirrored, via, thumbW };
}

// Modo repair: re-procesa por ad_id directo las piezas Meta cuya imagen quedó
// vieja (no -hd7) — típicamente ads ELIMINADOS que /ads ya no devuelve, o piezas
// que en la llamada masiva no encontraron el video (asset_feed_spec recortado por
// el límite de datos). Pidiendo el ad de a uno se trae el creative completo.
async function repairImages(batch: number): Promise<unknown> {
  const sb = env("NEXT_PUBLIC_SUPABASE_URL");
  const sbKey = env("SUPABASE_SERVICE_ROLE_KEY");
  const token = process.env.META_PAID_TOKEN_OVERRIDE || env("META_SYSTEM_USER_TOKEN");
  const pageToken = env("META_SYSTEM_USER_TOKEN");
  const staleRes = await fetch(
    `${sb}/rest/v1/meta_paid_creatives?select=ad_id,creative_id,image_url&plataforma=eq.meta`,
    { headers: { apikey: sbKey, Authorization: `Bearer ${sbKey}` } },
  );
  const allRows = (await staleRes.json()) as Array<{ ad_id: string; creative_id: string | null; image_url: string | null }>;
  // Mapa ad_id -> creative_id de las piezas con imagen vieja.
  const staleMap = new Map<string, string | null>();
  for (const r of allRows) {
    if (!r.image_url || !r.image_url.includes("-hd7.jpg")) {
      if (!staleMap.has(r.ad_id)) staleMap.set(r.ad_id, r.creative_id);
    }
  }
  const staleIds = [...staleMap.keys()];
  const toProcess = staleIds.slice(0, batch);
  // Campos del creative (sin el wrapper creative{}, para fetch directo por creative_id).
  const CREATIVE_FIELDS =
    "id,thumbnail_url.thumbnail_width(1080).thumbnail_height(1080),image_url,video_id,effective_object_story_id,object_story_spec{link_data{picture},video_data{image_url,video_id}},asset_feed_spec{videos{video_id,thumbnail_url},images{hash,url}}";
  const stats = { video_thumb: 0, full_picture: 0, fallback: 0 };
  const errors: string[] = [];
  let fixed = 0;
  let failed = 0;
  for (const adId of toProcess) {
    try {
      const creativeId = staleMap.get(adId);
      let creative: AdCreative | undefined;
      if (creativeId) {
        // El creative sobrevive al ad aunque el ad esté eliminado.
        creative = await graphGet<AdCreative>(
          `${GRAPH_API}/${creativeId}?fields=${encodeURIComponent(CREATIVE_FIELDS)}&access_token=${token}`,
        );
      } else {
        const adRes = await graphGet<{ creative?: AdCreative }>(
          `${GRAPH_API}/${adId}?fields=${encodeURIComponent(`creative{${CREATIVE_FIELDS}}`)}&access_token=${token}`,
        );
        creative = adRes.creative;
      }
      const { mirrored, via } = await resolveBestImageUrl(creative, adId, pageToken);
      stats[via]++;
      const patch = await fetch(
        `${sb}/rest/v1/meta_paid_creatives?ad_id=eq.${adId}&plataforma=eq.meta`,
        {
          method: "PATCH",
          headers: { apikey: sbKey, Authorization: `Bearer ${sbKey}`, "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify({ image_url: mirrored, thumbnail_url: mirrored }),
        },
      );
      if (patch.ok) fixed++;
      else failed++;
    } catch (e) {
      failed++;
      if (errors.length < 3) errors.push((e instanceof Error ? e.message : String(e)).slice(0, 220));
    }
  }
  return {
    ok: true,
    mode: "repair",
    stale_total: staleIds.length,
    procesados: toProcess.length,
    fixed,
    failed,
    restantes: staleIds.length - toProcess.length,
    repair_stats: stats,
    errors,
  };
}

export async function GET(req: Request) {
  // Gate: Vercel Cron envía Authorization: Bearer CRON_SECRET.
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);

  // ?repair=1 → re-mirror de piezas Meta con imagen vieja (ads eliminados, etc.)
  if (url.searchParams.get("repair")) {
    const batch = Math.min(Math.max(parseInt(url.searchParams.get("batch") ?? "20", 10) || 20, 1), 50);
    try {
      return NextResponse.json(await repairImages(batch));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return NextResponse.json({ ok: false, mode: "repair", error: msg }, { status: 500 });
    }
  }

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
      "creative{id,thumbnail_url.thumbnail_width(1080).thumbnail_height(1080),image_url,video_id,body,effective_object_story_id,instagram_permalink_url,object_story_spec{link_data{picture,message,link},video_data{image_url,message,video_id}},asset_feed_spec{videos{video_id},images{url}}}",
      `insights.time_range({'since':'${since}','until':'${until}'}){impressions,reach,frequency,clicks,spend,ctr,cpm,cpc,video_play_actions,video_p25_watched_actions,video_p50_watched_actions,video_p75_watched_actions,video_p100_watched_actions,video_thruplay_watched_actions,actions,date_start,date_stop}`,
    ].join(",");

    phase = "fetch_ads";
    // Por defecto /ads NO devuelve ads archivados/eliminados, así que las piezas
    // de campañas ya terminadas nunca se re-procesan (quedan con la imagen vieja).
    // Pedimos explícitamente todos los estados (menos DELETED) para re-mirrorearlas.
    const effectiveStatus = encodeURIComponent(
      JSON.stringify([
        "ACTIVE", "PAUSED", "ADSET_PAUSED", "CAMPAIGN_PAUSED", "ARCHIVED",
        "IN_PROCESS", "WITH_ISSUES", "PENDING_REVIEW", "DISAPPROVED",
        "PREAPPROVED", "PENDING_BILLING_INFO",
      ]),
    );
    // Reescribe (o agrega) el ?limit= de una URL de Graph.
    const setLimit = (u: string, n: number) =>
      /([?&])limit=\d+/.test(u) ? u.replace(/([?&])limit=\d+/, `$1limit=${n}`) : `${u}${u.includes("?") ? "&" : "?"}limit=${n}`;

    let curLimit = 8;
    let nextUrl: string | undefined =
      `${GRAPH_API}/${act_id}/ads?fields=${encodeURIComponent(fields)}&effective_status=${effectiveStatus}&limit=${curLimit}&access_token=${token}`;

    const allAds: MetaAd[] = [];
    let pages = 0;
    // Con más ads por mes (ej. junio) Meta puede tirar 500 "Please reduce the
    // amount of data you're asking for" por el peso de los campos (creative +
    // insights). Reintentamos la MISMA página bajando el limit (8→4→2→1); las
    // siguientes heredan el limit reducido para no volver a chocar.
    while (nextUrl && pages < 200) {
      let page: AdsResp | null = null;
      let attempts = 0;
      for (;;) {
        try {
          page = await graphGet<AdsResp>(nextUrl);
          break;
        } catch (e) {
          const msg = String(e instanceof Error ? e.message : e);
          attempts++;
          const tooMuch = /reduce the amount of data/i.test(msg);
          // Errores transitorios de Meta (code 2 / "temporarily unavailable" /
          // "unexpected error" / subcode 1504044): esperar y reintentar.
          const transient = /temporarily unavailable|unexpected error|error inesperado|"code":\s*2|1504044|is_transient":\s*true/i.test(msg);
          if ((tooMuch || transient) && attempts <= 6) {
            if (curLimit > 1) { curLimit = Math.max(1, Math.floor(curLimit / 2)); nextUrl = setLimit(nextUrl!, curLimit); }
            await new Promise((r) => setTimeout(r, 1500 * attempts)); // backoff creciente
            continue;
          }
          throw e;
        }
      }
      allAds.push(...(page.data ?? []));
      nextUrl = page.paging?.next ? setLimit(page.paging.next, curLimit) : undefined;
      pages++;
    }

    phase = "upsert";
    // Diagnóstico de origen de imagen: cuántas piezas resolvieron por cada vía y
    // el ancho máximo de thumbnail de video visto (para saber si Meta da alta o
    // baja resolución). Se devuelve en la respuesta.
    const imgStats = { video_thumb: 0, full_picture: 0, fallback: 0, max_thumb_w: 0 };
    // Muestra de las piezas que caen en fallback (sin video_id ni story) para
    // diagnosticar qué fuente de imagen tienen y poder rematarlas.
    const fallbackSample: Array<Record<string, unknown>> = [];
    const rows = (
      await Promise.all(
        allAds.map(async (ad) => {
          const ins = ad.insights?.data?.[0];
          if (!ins) return null; // sin impresiones en el período -> se ignora
          // Métricas de video (suma de los `value` de cada array de acciones).
          const videoPlays = sumActions(ins.video_play_actions);
          const videoP25 = sumActions(ins.video_p25_watched_actions);
          const videoP50 = sumActions(ins.video_p50_watched_actions);
          const videoP75 = sumActions(ins.video_p75_watched_actions);
          const videoP100 = sumActions(ins.video_p100_watched_actions);
          const img = pickImage(ad.creative);
          // Resolución de imagen, de mayor a menor calidad. Para VIDEO lo nítido es
          // el thumbnail del video (/{video_id}/thumbnails). El video_id puede venir
          // inline (object_story_spec) o —caso típico cuando el creative se arma
          // desde un post de la Página— hay que sacarlo del POST (attachments).
          // full_picture es solo un preview chico → último recurso. Todo con el
          // token de la Página (system user): videos y posts son de la Página Drean.
          let bestImg = img.best;
          let gotHd = false;
          let videoId: string | null = img.videoId ?? null;
          let fullPic: string | undefined;
          if (img.storyId) {
            const post = await graphGet<{
              full_picture?: string;
              attachments?: {
                data?: Array<{
                  type?: string;
                  target?: { id?: string };
                  subattachments?: { data?: Array<{ type?: string; target?: { id?: string } }> };
                }>;
              };
            }>(
              `${GRAPH_API}/${img.storyId}?fields=full_picture,attachments{type,target,subattachments}&access_token=${pageToken}`,
            ).catch(() => ({} as { full_picture?: string; attachments?: { data?: Array<{ type?: string; target?: { id?: string }; subattachments?: { data?: Array<{ type?: string; target?: { id?: string } }> } }> } }));
            fullPic = post.full_picture;
            if (!videoId) {
              const att = post.attachments?.data?.[0];
              if (att?.type?.includes("video")) {
                videoId = att.target?.id ?? att.subattachments?.data?.[0]?.target?.id ?? null;
              } else {
                const sub = att?.subattachments?.data?.find((s) => s.type?.includes("video"));
                if (sub) videoId = sub.target?.id ?? null;
              }
            }
          }
          // Para videos CPC el object_story_spec viene incompleto en la llamada
          // masiva. Un fetch directo del creative suele traer el video_id.
          if (!videoId && ad.creative?.id) {
            const c = await graphGet<{ video_id?: string; object_story_spec?: { video_data?: { video_id?: string } }; asset_feed_spec?: { videos?: Array<{ video_id?: string }> } }>(
              `${GRAPH_API}/${ad.creative.id}?fields=video_id,object_story_spec{video_data{video_id}},asset_feed_spec{videos{video_id}}&access_token=${token}`,
            ).catch(() => ({} as { video_id?: string; object_story_spec?: { video_data?: { video_id?: string } }; asset_feed_spec?: { videos?: Array<{ video_id?: string }> } }));
            videoId = c.video_id ?? c.object_story_spec?.video_data?.video_id ?? c.asset_feed_spec?.videos?.find((v) => v.video_id)?.video_id ?? null;
          }
          if (videoId) {
            const vt = await graphGet<{
              thumbnails?: { data?: Array<{ uri?: string; width?: number; is_preferred?: boolean }> };
            }>(
              `${GRAPH_API}/${videoId}?fields=thumbnails{uri,width,height,is_preferred}&access_token=${pageToken}`,
            ).catch(() => ({} as { thumbnails?: { data?: Array<{ uri?: string; width?: number; is_preferred?: boolean }> } }));
            const thumbs = vt.thumbnails?.data ?? [];
            // El de mayor ancho = máxima resolución.
            const chosen = [...thumbs].sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0];
            if (chosen?.uri) {
              bestImg = chosen.uri;
              gotHd = true;
              imgStats.video_thumb++;
              if ((chosen.width ?? 0) > imgStats.max_thumb_w) imgStats.max_thumb_w = chosen.width ?? 0;
            }
          }
          if (!gotHd) {
            if (fullPic) {
              bestImg = fullPic;
              imgStats.full_picture++;
            } else {
              imgStats.fallback++;
              if (fallbackSample.length < 12) {
                fallbackSample.push({
                  ad_id: ad.id,
                  ad_name: ad.name,
                  creative_id: ad.creative?.id ?? null,
                  has_image_url: !!ad.creative?.image_url,
                  has_thumbnail: !!ad.creative?.thumbnail_url,
                  has_story: !!img.storyId,
                  afs_videos: ad.creative?.asset_feed_spec?.videos?.length ?? 0,
                  afs_images: ad.creative?.asset_feed_spec?.images?.length ?? 0,
                  src: (bestImg ?? "").slice(0, 70),
                });
              }
            }
          }
          // Espejamos al bucket de Supabase (URL eterna). Bumpear el sufijo de la
          // key ('-hd5' -> '-hd6' …) cada vez que mejora la resolución de origen:
          // el helper saltea la descarga si la key ya existe.
          // '-hd7' = video_id también desde asset_feed_spec (creatives dinámicos).
          const mirrored = await mirrorMetaImage(bestImg, `paid/${ad.id}-hd7.jpg`);
          // Link a la pieza: si es de Instagram, el permalink de IG es el que
          // resuelve; si no, el post de Facebook detrás del ad (story_id). Para
          // "dark posts" sin post público no hay link válido -> null.
          const igPermalink = ad.creative?.instagram_permalink_url ?? null;
          const permalink = igPermalink ?? (img.storyId ? `https://www.facebook.com/${img.storyId}` : null);
          const classified = parseAdName(ad.name, ad.campaign?.objective ?? null, ad.campaign?.name ?? null);
          return {
            ad_id: ad.id,
            creative_id: ad.creative?.id ?? null,
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
            instagram_permalink_url: igPermalink,
            impresiones: Math.round(toNum(ins.impressions) ?? 0),
            alcance: Math.round(toNum(ins.reach) ?? 0),
            frecuencia: toNum(ins.frequency),
            clicks: Math.round(toNum(ins.clicks) ?? 0),
            spend: toNum(ins.spend) ?? 0,
            ctr: toNum(ins.ctr),
            cpm: toNum(ins.cpm),
            cpc: toNum(ins.cpc),
            // Video: cuartiles de visibilidad + reproducciones + ThruPlay.
            video_plays: videoPlays || null,
            video_p25: videoP25 || null,
            video_p50: videoP50 || null,
            video_p75: videoP75 || null,
            video_p100: videoP100 || null,
            video_thruplay: sumActions(ins.video_thruplay_watched_actions) || null,
            // views_total/completed/vtr derivados del video (antes venían de Looker).
            views_total: videoPlays || null,
            views_completed: videoP100 || null,
            vtr: videoPlays > 0 ? Number(((videoP100 / videoPlays) * 100).toFixed(4)) : null,
            // Interacciones del post (engagement) desde insights.actions.
            reactions: actionVal(ins.actions, "post_reaction"),
            comments: actionVal(ins.actions, "comment"),
            shares: actionVal(ins.actions, "post"),
            saves: actionVal(ins.actions, "onsite_conversion.post_save"),
            post_engagement: actionVal(ins.actions, "post_engagement"),
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
      img_stats: imgStats,
      fallback_sample: fallbackSample,
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
