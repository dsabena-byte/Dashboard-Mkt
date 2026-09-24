import "server-only";
// ============================================================================
// Pauta de la competencia (portado de BIP, sep-2026) — Biblioteca de anuncios de Meta vía Apify.
// Por cada marca (Drean como referencia + competidores de lib/tenant + competitive-config) busca los
// anuncios ACTIVOS en Argentina y se queda con los de páginas cuyo nombre coincide con la marca (la
// búsqueda por palabra trae también a terceros que la mencionan).
// Snapshot en competitor_ads_snapshot (migración 0108, single-tenant): UNA FILA POR MARCA → el cron
// hace fan-out por marca (?marca=) y cada request escribe solo la suya. `firstSeen` se conserva entre
// corridas (así sabemos qué es nuevo aunque el actor no traiga fecha de inicio).
// Miniaturas: las de fbcdn caducan → se espejan al bucket con el helper de Meta (mirrorMetaImage).
// Fail-safe: sin APIFY_API_TOKEN / sin migración / actor caído → estado vacío explicado; una marca
// que falla conserva sus anuncios de la corrida anterior (marcada "sin actualizar").
// Env: APIFY_API_TOKEN, APIFY_ACTOR_AD_LIBRARY (default "apify~facebook-ads-scraper").
// ============================================================================
import { apifyEnabled, runActor } from "@/lib/apify";
import { mirrorMetaImage } from "@/lib/meta-image-mirror";
import { matchAdsToPosts, type AdEngagement, type OrganicPost } from "@/lib/ad-intensity";
import { getTenant } from "@/lib/tenant/current";
import { adLibraryBrands, adSearchUrl, matchesBrand, norm, parseAdItem, type AdBrand, type AdLibraryData, type BrandAds, type CompetitorAd } from "@/lib/ad-library-shared";

export const AD_LIBRARY_ACTOR = process.env.APIFY_ACTOR_AD_LIBRARY || "apify~facebook-ads-scraper";
const PER_BRAND = 40;        // anuncios máximos por marca y corrida
const RUN_TIMEOUT = 200;     // seg por corrida de Apify (el cron tiene 300 s por marca)
const MIRROR_PER_BRAND = 12; // miniaturas rehosteadas por marca

export type AdLibraryStatus =
  | { status: "no_config"; motivo: string }
  | { status: "empty"; motivo: string }
  | { status: "ok"; data: AdLibraryData };

export function adLibraryEnabled(): boolean { return apifyEnabled(); }

function cfg() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? { url: url.replace(/\/+$/, ""), key } : null;
}
async function rest(path: string, init?: RequestInit): Promise<Response | null> {
  const c = cfg();
  if (!c) return null;
  try {
    return await fetch(`${c.url}/rest/v1/${path}`, { ...init, headers: { apikey: c.key, Authorization: `Bearer ${c.key}`, "Content-Type": "application/json", ...(init?.headers ?? {}) }, cache: "no-store" });
  } catch { return null; }
}

interface SnapRow { marca: string; own: boolean; ads: CompetitorAd[] | null; fetched_at: string | null; error: string | null; stale: boolean | null; updated_at: string | null }

/** Snapshot guardado (null = tabla sin migrar o error). */
export async function getAdLibrarySnapshot(): Promise<AdLibraryData | null> {
  const res = await rest("competitor_ads_snapshot?select=marca,own,ads,fetched_at,error,stale,updated_at");
  if (!res?.ok) return null;
  const rows = (await res.json().catch(() => [])) as SnapRow[];
  const order = new Map(adLibraryBrands().map((b, i) => [norm(b.marca), i]));
  const brands: BrandAds[] = rows
    .map((r) => ({ marca: r.marca, own: Boolean(r.own), ads: Array.isArray(r.ads) ? r.ads : [], fetchedAt: r.fetched_at, error: r.error, stale: Boolean(r.stale) }))
    .sort((a, b) => (order.get(norm(a.marca)) ?? 99) - (order.get(norm(b.marca)) ?? 99));
  const updatedAt = rows.map((r) => r.updated_at ?? "").sort().pop() || null;
  return { brands, updatedAt };
}

/** Estado para la página (explica por qué está vacío). */
export async function getAdLibrary(): Promise<AdLibraryStatus> {
  const snap = await getAdLibrarySnapshot();
  if (snap && snap.brands.some((b) => b.ads.length > 0 || b.fetchedAt)) return { status: "ok", data: snap };
  if (!snap) return { status: "empty", motivo: "Falta crear la tabla del snapshot (migración 0108_alertas.sql en el SQL Editor de Supabase)." };
  if (!adLibraryEnabled()) return { status: "no_config", motivo: "Falta configurar APIFY_API_TOKEN en Vercel para consultar la Biblioteca de anuncios de Meta." };
  const err = snap.brands.find((b) => b.error)?.error;
  if (err) return { status: "empty", motivo: motivoError(err) };
  return { status: "empty", motivo: "Todavía no corrió la primera búsqueda. Se actualiza una vez por semana (lunes) con el workflow “Ad Library (pauta de la competencia)”." };
}

/** Error de la última corrida → explicación para el usuario. */
function motivoError(err: string): string {
  if (/usage hard limit|limit exceeded/i.test(err))
    return "La última búsqueda no pudo correr: la cuenta de Apify (el servicio que consulta la Biblioteca de anuncios de Meta) llegó a su límite mensual de uso. Subí el límite o el plan en la consola de Apify (Billing → límites de uso) o esperá al reinicio del ciclo mensual; después se actualiza sola el lunes (o corré a mano el workflow “Ad Library (pauta de la competencia)”).";
  if (/\b401\b|token/i.test(err)) return "La última búsqueda falló por el token de Apify (APIFY_API_TOKEN inválido o vencido). Revisalo en Vercel.";
  return `La última búsqueda falló (${err.replace(/\s+/g, " ").slice(0, 160)}). Se reintenta el próximo lunes.`;
}

/** Cruce anuncio ↔ posteo orgánico (IG/FB, últimos 180 días) de cada marca con cuenta social
 *  monitoreada → me gusta / comentarios / visualizaciones reales de los avisos que son posteos potenciados. */
export async function getAdEngagement(data: AdLibraryData): Promise<Record<string, AdEngagement>> {
  const handles = new Map(getTenant().socialAccounts.map((a) => [norm(a.label), a.handle]));
  const since = new Date(Date.now() - 180 * 86_400_000).toISOString().slice(0, 10);
  const out: Record<string, AdEngagement> = {};
  await Promise.all(data.brands.map(async (b) => {
    const h = handles.get(norm(b.marca));
    if (!h || !b.ads.length) return;
    const res = await rest(`social_posts?select=copy,likes,comentarios,views,fecha,url,red_social&marca=eq.${encodeURIComponent(h)}&fecha=gte.${since}&copy=not.is.null&limit=2000`);
    if (!res?.ok) return;
    const rows = (await res.json().catch(() => [])) as { copy: string | null; likes: number | null; comentarios: number | null; views: number | null; fecha: string; url: string | null; red_social: string }[];
    const posts: OrganicPost[] = rows.map((r) => ({ copy: r.copy, likes: Number(r.likes) || 0, comentarios: Number(r.comentarios) || 0, views: Number(r.views) || 0, fecha: r.fecha, url: r.url, red: r.red_social }));
    Object.assign(out, matchAdsToPosts(b.ads, posts));
  }));
  return out;
}

async function fetchBrand(b: AdBrand, nowIso: string): Promise<CompetitorAd[]> {
  const url = adSearchUrl(b.q);
  const items = await runActor(AD_LIBRARY_ACTOR, {
    startUrls: [{ url }],
    urls: [{ url }], // algunas versiones del actor usan `urls`
    resultsLimit: PER_BRAND * 2,
    count: PER_BRAND * 2,
    activeStatus: "active",
    isDetailsPerAd: false,
  }, RUN_TIMEOUT);
  const seen = new Set<string>();
  const out: CompetitorAd[] = [];
  for (const it of items) {
    const ad = parseAdItem(it, nowIso);
    if (!ad || seen.has(ad.id) || !matchesBrand(ad.pageName, b.marca, b.ctx)) continue;
    seen.add(ad.id);
    out.push(ad);
    if (out.length >= PER_BRAND) break;
  }
  return out;
}

/** Sincroniza UNA marca (busca, conserva firstSeen, espeja miniaturas, guarda su fila). */
export async function syncAdLibraryBrand(marca: string): Promise<{ marca: string; ads: number; ok: boolean; error?: string }> {
  if (!adLibraryEnabled()) throw new Error("APIFY_API_TOKEN no configurado");
  const b = adLibraryBrands().find((x) => norm(x.marca) === norm(marca));
  if (!b) throw new Error(`Marca desconocida: ${marca}`);
  const nowIso = new Date().toISOString();
  const prev = await getAdLibrarySnapshot();
  const old = prev?.brands.find((x) => norm(x.marca) === norm(b.marca));
  let row: SnapRow;
  try {
    const ads = await fetchBrand(b, nowIso);
    const oldAds = new Map((old?.ads ?? []).map((a) => [a.id, a]));
    let mirrored = 0;
    const slug = norm(b.marca).replace(/ /g, "-");
    for (const a of ads) {
      const o = oldAds.get(a.id);
      if (o) { a.firstSeen = o.firstSeen; if (o.thumb && !/fbcdn|facebook\.com/.test(o.thumb)) a.thumb = o.thumb; }
      if (a.thumb && /fbcdn|facebook\.com/.test(a.thumb) && mirrored < MIRROR_PER_BRAND) {
        mirrored++;
        a.thumb = (await mirrorMetaImage(a.thumb, `adlib/${slug}/${a.id}.jpg`).catch(() => null)) ?? a.thumb;
      }
    }
    row = { marca: b.marca, own: b.own, ads, fetched_at: nowIso, error: null, stale: false, updated_at: nowIso };
  } catch (e) {
    row = { marca: b.marca, own: b.own, ads: old?.ads ?? [], fetched_at: old?.fetchedAt ?? null, error: (e as Error).message.slice(0, 300), stale: true, updated_at: nowIso };
  }
  const res = await rest("competitor_ads_snapshot?on_conflict=marca", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(row) });
  if (!res?.ok) throw new Error(`No se pudo guardar (¿corrió la migración 0108?): ${res ? `${res.status} ${(await res.text().catch(() => "")).slice(0, 200)}` : "sin Supabase"}`);
  return { marca: b.marca, ads: row.ads?.length ?? 0, ok: !row.error, ...(row.error ? { error: row.error } : {}) };
}
