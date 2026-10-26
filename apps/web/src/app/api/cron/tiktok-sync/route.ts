import { NextResponse } from "next/server";
import { mirrorImageStrict, uploadBucketJson } from "@/lib/meta-image-mirror";
import { TIKTOK_MANIFEST_KEY, chunks, piezaDe, type TikTokManifest, type TikTokPiezaMes, type TTAd } from "@/lib/tiktok-piezas";

// Ingesta directa desde la TikTok Marketing API (reporting integrado, nivel AD)
// para la cuenta de TikTok Ads de Drean. Trae el embudo de video (cuartiles) e
// interacciones que hoy se cargan a mano. Escribe en `tiktok_creatives`.
//
// Token: TIKTOK_ACCESS_TOKEN, o la conexión "tiktok-ads" de la app de BIP en Nango (BIP_NANGO_HOST +
// BIP_NANGO_SECRET_KEY + TIKTOK_NANGO_CONNECTION_ID): así sobrevive a una reconexión desde BIP.
// Preferido: BIP_PARTNER_URL + PARTNER_TIKTOK_SECRET (endpoint de BIP que entrega solo este token).
// Además del detalle por anuncio (`tiktok_creatives`, opcional: si la tabla no existe se saltea), escribe
// el MES por categoría × objetivo en `pauta_performance` (medio "TikTok"), que es lo que leen /performance,
// el Seguimiento, el chat y las señales: la API reemplaza la carga manual de OMD en los meses con inversión.
//
// Gate de validación:
//   ?dry=1        → NO escribe; devuelve filas parseadas + totales + la carga mensual que haría.
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

// La API rechaza rangos de más de 30 días con stat_time_day: se parte en tramos.
async function fetchAdvertiser(advId: string, token: string, start: string, end: string): Promise<TikTokRow[]> {
  const rows: TikTokRow[] = [];
  for (let d = new Date(`${start}T00:00:00Z`); d.toISOString().slice(0, 10) <= end; d.setUTCDate(d.getUTCDate() + 30)) {
    const hasta = new Date(d);
    hasta.setUTCDate(hasta.getUTCDate() + 29);
    const h = hasta.toISOString().slice(0, 10);
    rows.push(...(await fetchTramo(advId, token, d.toISOString().slice(0, 10), h < end ? h : end)));
  }
  return rows;
}

async function fetchTramo(advId: string, token: string, start: string, end: string): Promise<TikTokRow[]> {
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
    if (!res.ok) {
      const txt = await res.text();
      if (txt.includes("PGRST205")) return "tabla tiktok_creatives inexistente (correr migración 0074): detalle por anuncio salteado";
      return `error ${res.status} (chunk ${total}): ${txt.slice(0, 400)}`;
    }
    total += chunk.length;
  }
  return `${total} filas OK`;
}

// ---- Token -------------------------------------------------------------------------------------------
async function getToken(): Promise<string> {
  if (process.env.TIKTOK_ACCESS_TOKEN) return process.env.TIKTOK_ACCESS_TOKEN;
  // Preferido (X-01): BIP entrega SOLO este token con un secreto propio; Drean no necesita la clave maestra de Nango.
  if (process.env.BIP_PARTNER_URL && process.env.PARTNER_TIKTOK_SECRET) {
    const r = await fetch(`${process.env.BIP_PARTNER_URL.replace(/\/$/, "")}/api/partner/tiktok-token`, {
      headers: { Authorization: `Bearer ${process.env.PARTNER_TIKTOK_SECRET}` },
      cache: "no-store",
    });
    if (!r.ok) throw new Error(`BIP partner ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const t = ((await r.json()) as { access_token?: string }).access_token;
    if (!t) throw new Error("BIP partner no devolvió access_token");
    return t;
  }
  const res = await fetch(`${env("BIP_NANGO_HOST")}/connection/${env("TIKTOK_NANGO_CONNECTION_ID")}?provider_config_key=tiktok-ads`, {
    headers: { Authorization: `Bearer ${env("BIP_NANGO_SECRET_KEY")}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Nango (BIP) ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const token = ((await res.json()) as { credentials?: { access_token?: string } }).credentials?.access_token;
  if (!token) throw new Error("Nango (BIP) no devolvió access_token para tiktok-ads");
  return token;
}

// ---- Carga mensual en pauta_performance ------------------------------------------------------------------
const MES_LABEL = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

// Categoría por nombre de campaña (mismas categorías que la carga OMD; Marcelino/Mickey/CasaFoa/sin categoría = Brand).
function categoriaTikTok(campaign: string): string {
  const c = campaign.toLowerCase();
  if (c.includes("lavado")) return "Lavado";
  if (c.includes("refrigeraci") || c.includes("heladera")) return "Refrigeración";
  if (c.includes("cocci") || c.includes("cocina")) return "Cocción";
  if (c.includes("ugc")) return "UGC";
  if (c.includes("promoci")) return "Promoción";
  return "Brand";
}
// Objetivo de TikTok → objetivo de la carga OMD (Alcance = Awareness; video, tráfico y resto = Consideración).
const objetivoTikTok = (objective: string) => (objective === "REACH" ? "Awareness" : "Consideración");

interface PautaRow { mes: string; medio: string; categoria: string; objetivo: string; tipo_compra: string;
  inversion: number; impresiones: number; alcance: number; frecuencia: number | null; clics: number; views: number }

async function fetchMes(advId: string, token: string, anio: number, mes: number, hastaIso: string): Promise<PautaRow[]> {
  const ini = `${anio}-${String(mes + 1).padStart(2, "0")}-01`;
  const finMes = new Date(Date.UTC(anio, mes + 1, 0)).toISOString().slice(0, 10);
  const fin = finMes < hastaIso ? finMes : hastaIso;
  if (fin < ini) return [];
  const params = new URLSearchParams({
    advertiser_id: advId, report_type: "BASIC", data_level: "AUCTION_CAMPAIGN",
    dimensions: JSON.stringify(["campaign_id"]),
    metrics: JSON.stringify(["campaign_name", "objective_type", "spend", "impressions", "reach", "clicks", "video_play_actions"]),
    start_date: ini, end_date: fin, page_size: "1000",
  });
  const res = await fetch(`${TT_API}/report/integrated/get/?${params}`, { headers: { "Access-Token": token } });
  const json = (await res.json()) as TTResponse;
  if (json.code !== 0) throw new Error(`TikTok mes ${ini}: code=${json.code} ${json.message ?? ""}`);
  const acc = new Map<string, PautaRow>();
  for (const it of json.data?.list ?? []) {
    const m = it.metrics ?? {};
    if (!(n(m.spend) > 0)) continue;
    const categoria = categoriaTikTok(String(m.campaign_name ?? ""));
    const objetivo = objetivoTikTok(String(m.objective_type ?? ""));
    const k = `${categoria}|${objetivo}`;
    const r = acc.get(k) ?? { mes: `${MES_LABEL[mes]} ${anio}`, medio: "TikTok", categoria, objetivo, tipo_compra: "CPM",
      inversion: 0, impresiones: 0, alcance: 0, frecuencia: null, clics: 0, views: 0 };
    r.inversion += n(m.spend); r.impresiones += n(m.impressions); r.alcance += n(m.reach); r.clics += n(m.clicks); r.views += n(m.video_play_actions);
    acc.set(k, r);
  }
  // Alcance = suma por campaña (sin deduplicar), igual que la carga OMD.
  return [...acc.values()].map((r) => ({ ...r, inversion: Math.round(r.inversion * 100) / 100, frecuencia: r.alcance ? Math.round((r.impresiones / r.alcance) * 100) / 100 : null }));
}

async function rest(path: string, init: RequestInit = {}) {
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  return fetch(`${env("NEXT_PUBLIC_SUPABASE_URL")}/rest/v1/${path}`, { ...init,
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=minimal", ...(init.headers ?? {}) } });
}

// Reemplaza las filas de TikTok del mes solo si la API tiene inversión ese mes (si no, deja la carga manual).
// Upsert por la clave única (mes, categoria, medio, objetivo, tipo_compra) y después se borran las filas viejas
// que la API ya no trae: si falla el upsert, la carga anterior queda intacta.
async function reemplazarMes(mes: string, filas: PautaRow[]): Promise<string> {
  const prev = await rest(`pauta_performance?medio=eq.TikTok&mes=eq.${encodeURIComponent(mes)}&select=id,categoria,objetivo,tipo_compra`, { headers: { Prefer: "" } });
  const viejas = (await prev.json()) as { id: number; categoria: string; objetivo: string; tipo_compra: string }[];
  const up = await rest("pauta_performance?on_conflict=mes,categoria,medio,objetivo,tipo_compra", {
    method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(filas) });
  if (!up.ok) return `error al guardar ${mes}: ${(await up.text()).slice(0, 200)}`;
  const claves = new Set(filas.map((f) => `${f.categoria}|${f.objetivo}|${f.tipo_compra}`));
  const sobran = viejas.filter((v) => !claves.has(`${v.categoria}|${v.objetivo}|${v.tipo_compra}`)).map((v) => v.id);
  if (sobran.length) {
    const del = await rest(`pauta_performance?id=in.(${sobran.join(",")})`, { method: "DELETE" });
    if (!del.ok) return `guardado, pero no se borraron ${sobran.length} filas viejas de ${mes}: ${(await del.text()).slice(0, 200)}`;
  }
  return `${filas.length} filas (actualizó/insertó; borró ${sobran.length} viejas)`;
}

// ---- Piezas (anuncio × mes) con portada → manifiesto en el bucket ------------------------------------
async function ttGet<T>(token: string, path: string, params: Record<string, string>): Promise<{ list: T[]; totalPage: number }> {
  const res = await fetch(`${TT_API}${path}?${new URLSearchParams(params)}`, { headers: { "Access-Token": token } });
  const json = (await res.json()) as { code?: number; message?: string; data?: { list?: T[]; page_info?: { total_page?: number } } };
  if (json.code !== 0) throw new Error(`TikTok ${path}: code=${json.code} ${json.message ?? ""}`);
  return { list: json.data?.list ?? [], totalPage: json.data?.page_info?.total_page ?? 1 };
}

async function piezasDelMes(advId: string, token: string, anio: number, mes: number, hastaIso: string): Promise<Omit<TikTokPiezaMes, "img" | "link" | "activa">[]> {
  const ini = `${anio}-${String(mes + 1).padStart(2, "0")}-01`;
  const finMes = new Date(Date.UTC(anio, mes + 1, 0)).toISOString().slice(0, 10);
  const fin = finMes < hastaIso ? finMes : hastaIso;
  if (fin < ini) return [];
  const out: Omit<TikTokPiezaMes, "img" | "link" | "activa">[] = [];
  for (let page = 1, total = 1; page <= total; page++) {
    const r = await ttGet<TTItem>(token, "/report/integrated/get/", {
      advertiser_id: advId, report_type: "BASIC", data_level: "AUCTION_AD", dimensions: JSON.stringify(["ad_id"]),
      metrics: JSON.stringify(["ad_name", "campaign_name", "objective_type", "spend", "impressions", "clicks", "reach", "video_play_actions", "video_views_p100", "likes", "comments", "shares"]),
      start_date: ini, end_date: fin, page: String(page), page_size: "1000",
    });
    total = r.totalPage;
    for (const it of r.list) {
      const m = it.metrics ?? {};
      if (!(n(m.spend) > 0) || !it.dimensions?.ad_id) continue;
      out.push({ ad_id: it.dimensions.ad_id, mes: ini.slice(0, 7), ad_name: String(m.ad_name ?? ""), campaign: String(m.campaign_name ?? ""),
        categoria: categoriaTikTok(String(m.campaign_name ?? "")), objetivo: objetivoTikTok(String(m.objective_type ?? "")),
        inv: Math.round(n(m.spend) * 100) / 100, impr: n(m.impressions), clicks: n(m.clicks), alcance: n(m.reach), views: n(m.video_play_actions),
        p100: n(m.video_views_p100), likes: n(m.likes), comments: n(m.comments), shares: n(m.shares) });
    }
  }
  return out;
}

// Portada por anuncio (Read ads + video/image library; Spark Ads → oEmbed del post). Espejada al bucket (las URLs de TikTok vencen).
async function portadas(advId: string, token: string, adIds: string[], dry: boolean): Promise<Map<string, { img: string | null; link: string | null; activa: boolean | null }>> {
  const ads: TTAd[] = [];
  for (const ids of chunks(adIds, 100)) {
    const r = await ttGet<TTAd>(token, "/ad/get/", { advertiser_id: advId, page_size: "100",
      filtering: JSON.stringify({ ad_ids: ids }), fields: JSON.stringify(["ad_id", "video_id", "image_ids", "tiktok_item_id", "operation_status"]) });
    ads.push(...r.list);
  }
  const videoCover = new Map<string, string>(), imageUrl = new Map<string, string>();
  for (const ids of chunks([...new Set(ads.map((a) => a.video_id).filter(Boolean) as string[])], 60)) {
    const r = await ttGet<{ video_id?: string; video_cover_url?: string }>(token, "/file/video/ad/info/", { advertiser_id: advId, video_ids: JSON.stringify(ids) }).catch(() => null);
    for (const v of r?.list ?? []) if (v.video_id && v.video_cover_url) videoCover.set(v.video_id, v.video_cover_url);
  }
  for (const ids of chunks([...new Set(ads.flatMap((a) => a.image_ids ?? []))], 100)) {
    const r = await ttGet<{ image_id?: string; image_url?: string }>(token, "/file/image/ad/info/", { advertiser_id: advId, image_ids: JSON.stringify(ids) }).catch(() => null);
    for (const v of r?.list ?? []) if (v.image_id && v.image_url) imageUrl.set(v.image_id, v.image_url);
  }
  const out = new Map<string, { img: string | null; link: string | null; activa: boolean | null }>();
  for (const lote of chunks(ads, 6)) {
    await Promise.all(lote.map(async (ad) => {
      const p = piezaDe(ad, videoCover, imageUrl);
      let src = p.thumbnail;
      if (!src && p.sparkItem) {
        try {
          const res = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(`https://www.tiktok.com/video/${p.sparkItem}`)}`, { signal: AbortSignal.timeout(8000), cache: "no-store" });
          src = res.ok ? (((await res.json()) as { thumbnail_url?: string }).thumbnail_url ?? null) : null;
        } catch { /* sin portada */ }
      }
      let img: string | null = null;
      if (src) {
        const m = await mirrorImageStrict(src, `tiktok/${ad.ad_id}.jpg`, { dry });
        img = m.ok ? m.url : null;
      }
      out.set(String(ad.ad_id), { img, link: p.permalink, activa: p.active });
    }));
  }
  return out;
}

async function syncPiezas(advs: string[], token: string, meses: [number, number][], end: string, dry: boolean): Promise<Record<string, unknown>> {
  const nuevas: TikTokPiezaMes[] = [];
  let conImg = 0;
  for (const adv of advs) {
    const filas = (await Promise.all(meses.map(([a, m]) => piezasDelMes(adv, token, a, m, end)))).flat();
    const tapas = await portadas(adv, token, [...new Set(filas.map((f) => f.ad_id))], dry);
    for (const f of filas) {
      const t = tapas.get(f.ad_id) ?? { img: null, link: null, activa: null };
      if (t.img) conImg++;
      nuevas.push({ ...f, ...t });
    }
  }
  const mesesTocados = new Set(nuevas.map((p) => p.mes));
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "");
  let previas: TikTokPiezaMes[] = [];
  try {
    const r = await fetch(`${base}/storage/v1/object/public/meta-thumbs/${TIKTOK_MANIFEST_KEY}`, { cache: "no-store" });
    if (r.ok) previas = ((await r.json()) as TikTokManifest).items ?? [];
  } catch { /* primer manifiesto */ }
  // Se reemplazan solo los meses que trajo esta corrida; el resto del historial queda.
  const manifest: TikTokManifest = { at: new Date().toISOString(), advertiser: advs, items: [...previas.filter((p) => !mesesTocados.has(p.mes)), ...nuevas] };
  const res: Record<string, unknown> = { piezas_mes: nuevas.length, con_portada: conImg, meses: [...mesesTocados].sort() };
  if (dry) res.muestra = nuevas.slice(0, 5);
  else res.manifiesto = nuevas.length > 0 ? await uploadBucketJson(TIKTOK_MANIFEST_KEY, manifest) : { ok: false, error: "0 piezas: no se pisa el manifiesto" };
  return res;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
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

    const token = await getToken();
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

    // Meses calendario tocados por la ventana (el último puede ser parcial: hasta ayer).
    const meses: [number, number][] = [];
    for (let d = new Date(`${start.slice(0, 7)}-01T00:00:00Z`); d.toISOString().slice(0, 10) <= end; d.setUTCMonth(d.getUTCMonth() + 1)) meses.push([d.getUTCFullYear(), d.getUTCMonth()]);
    const mensual: Record<string, unknown> = {};
    for (const [anio, mes] of meses) {
      const label = `${MES_LABEL[mes]} ${anio}`;
      try {
        const filas = (await Promise.all(advs.map((a) => fetchMes(a, token, anio, mes, end)))).flat();
        const inv = filas.reduce((a, r) => a + r.inversion, 0);
        if (!(inv > 0)) { mensual[label] = "sin inversión en la API: se mantiene la carga manual"; continue; }
        mensual[label] = dry ? { inversion: Math.round(inv * 100) / 100, filas } : await reemplazarMes(label, filas);
      } catch (e) {
        mensual[label] = `error: ${e instanceof Error ? e.message : String(e)}`;
      }
    }
    out.pauta_performance = mensual;
    try {
      out.piezas = await syncPiezas(advs, token, meses, end, dry);
    } catch (e) {
      out.piezas = `sin piezas: ${e instanceof Error ? e.message : String(e)}`;
    }

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
