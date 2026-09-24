// ============================================================================
// Pauta de la competencia — parte PURA y client-safe (tipos, parseo del actor, marcas, resúmenes).
// La parte server (Apify + snapshot en Supabase) está en lib/ad-library.ts. Portado de BIP (sep-2026).
// ============================================================================
import { getTenant } from "./tenant/current";
import { MARCAS } from "./competitive-config";

export interface CompetitorAd {
  id: string;
  pageName: string;
  startDate: string | null; // ISO (inicio de circulación según Meta)
  endDate: string | null;
  active: boolean;
  platforms: string[];      // facebook / instagram / messenger / audience_network
  format: string;           // Imagen / Video / Carrusel / Dinámico / Otro
  body: string;
  title: string;
  cta: string;
  link: string | null;
  thumb: string | null;
  firstSeen: string;        // ISO: primera vez que el dashboard lo vio
  url: string;              // link a la Biblioteca de anuncios
}
export interface BrandAds { marca: string; own: boolean; ads: CompetitorAd[]; fetchedAt: string | null; error?: string | null; stale?: boolean }
export interface AdLibraryData { brands: BrandAds[]; updatedAt: string | null }

/** Marca a monitorear: `q` = búsqueda por palabra en la Biblioteca; `ctx` = si el nombre de la marca es
 *  ambiguo (ej. "Florencia" es también un nombre propio) exige además una de estas palabras en la página. */
export interface AdBrand { marca: string; own: boolean; q: string; ctx?: string[] }

const CTX_ELECTRO = ["cocina", "cocinas", "electrodomesticos", "electro", "hogar", "argentina", "oficial", "ar"];
// Marcas con nombre ambiguo → búsqueda con contexto + filtro estricto por nombre de página.
const AMBIGUAS: Record<string, { q: string; ctx: string[] }> = {
  florencia: { q: "cocinas Florencia", ctx: CTX_ELECTRO },
  orbis: { q: "Orbis cocinas", ctx: CTX_ELECTRO },
};
export const MAX_COMPETIDORES = 10;

/** Marca propia + competidores: primero las cuentas sociales del tenant (el set competitivo de Redes),
 *  después el resto del set de competitive-config (sin emergentes), hasta MAX_COMPETIDORES. */
export function adLibraryBrands(): AdBrand[] {
  const t = getTenant();
  const own = t.ownBrand.label;
  const seen = new Set<string>([norm(own)]);
  const comps: string[] = [];
  for (const a of t.socialAccounts) { const k = norm(a.label); if (!seen.has(k)) { seen.add(k); comps.push(a.label); } }
  for (const m of MARCAS) { const k = norm(m.nombre); if (!m.emergente && !seen.has(k)) { seen.add(k); comps.push(m.nombre); } }
  const mk = (marca: string, isOwn: boolean): AdBrand => {
    const a = AMBIGUAS[norm(marca)];
    return a ? { marca, own: isOwn, q: a.q, ctx: a.ctx } : { marca, own: isOwn, q: marca };
  };
  return [mk(own, true), ...comps.slice(0, MAX_COMPETIDORES).map((m) => mk(m, false))];
}

export const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const str = (v: unknown) => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "");

function toIso(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return new Date(v < 1e12 ? v * 1000 : v).toISOString();
  const s = String(v);
  if (/^\d+$/.test(s)) { const n = Number(s); return new Date(n < 1e12 ? n * 1000 : n).toISOString(); }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function formatOf(raw: string, hasVideo: boolean, cards: number): string {
  const f = raw.toUpperCase();
  if (f.includes("VIDEO") || hasVideo) return "Video";
  if (f.includes("CAROUSEL") || cards > 1) return "Carrusel";
  if (f.includes("DCO") || f.includes("DPA") || f.includes("DYNAMIC")) return "Dinámico";
  if (f.includes("IMAGE") || f) return "Imagen";
  return "Otro";
}

/** Normaliza un item crudo del actor (tolerante a variantes de nombres de campo). */
export function parseAdItem(it: any, nowIso: string): CompetitorAd | null {
  const id = str(it?.adArchiveID ?? it?.adArchiveId ?? it?.ad_archive_id ?? it?.id);
  if (!id) return null;
  const snap = it?.snapshot ?? {};
  const cards = Array.isArray(snap.cards) ? snap.cards : [];
  const images = Array.isArray(snap.images) ? snap.images : [];
  const videos = Array.isArray(snap.videos) ? snap.videos : [];
  const card0 = cards[0] ?? {};
  const thumb = str(videos[0]?.videoPreviewImageUrl ?? videos[0]?.video_preview_image_url ?? images[0]?.resizedImageUrl ?? images[0]?.originalImageUrl ?? card0?.resizedImageUrl ?? card0?.originalImageUrl ?? card0?.videoPreviewImageUrl ?? it?.thumbnail) || null;
  const bodyRaw = snap.body?.text ?? snap.body?.markup?.__html ?? (typeof snap.body === "string" ? snap.body : "") ?? card0?.body ?? it?.adText ?? "";
  const body = String(bodyRaw || card0?.body || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const platforms = (Array.isArray(it?.publisherPlatform) ? it.publisherPlatform : Array.isArray(it?.publisher_platform) ? it.publisher_platform : Array.isArray(it?.platforms) ? it.platforms : [])
    .map((p: unknown) => String(p).toLowerCase());
  const active = it?.isActive ?? it?.is_active ?? (it?.endDate ? false : true);
  return {
    id,
    pageName: str(it?.pageName ?? it?.page_name ?? snap.pageName ?? snap.page_name),
    startDate: toIso(it?.startDate ?? it?.start_date ?? it?.startDateFormatted),
    endDate: toIso(it?.endDate ?? it?.end_date ?? it?.endDateFormatted),
    active: Boolean(active),
    platforms,
    format: formatOf(str(snap.displayFormat ?? snap.display_format ?? it?.displayFormat), videos.length > 0, cards.length),
    body: body.slice(0, 600),
    title: str(snap.title ?? card0?.title).slice(0, 200),
    cta: str(snap.ctaText ?? snap.cta_text ?? card0?.ctaText),
    link: str(snap.linkUrl ?? snap.link_url ?? card0?.linkUrl) || null,
    thumb,
    firstSeen: nowIso,
    url: `https://www.facebook.com/ads/library/?id=${encodeURIComponent(id)}`,
  };
}

/**
 * ¿El anuncio es de la marca? Por PALABRAS completas del nombre de la página (no substring: "lg"
 * no debe matchear "algo"). Con `ctx` (marca ambigua) exige además una palabra de contexto.
 */
export function matchesBrand(pageName: string, marca: string, ctx?: string[]): boolean {
  const p = norm(pageName), m = norm(marca);
  if (!p || !m) return false;
  const pt = p.split(" "), mt = m.split(" ");
  const hasAll = mt.every((t) => pt.includes(t)) || p.replace(/ /g, "") === m.replace(/ /g, "");
  if (!hasAll) return false;
  if (!ctx?.length) return true;
  return pt.some((t) => !mt.includes(t) && ctx.includes(t));
}

export function adSearchUrl(q: string): string {
  return `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=AR&is_targeted_country=false&media_type=all&q=${encodeURIComponent(q)}&search_type=keyword_unordered`;
}

// ── Lecturas derivadas (puras) ─────────────────────────────────────────────
export const adStart = (a: CompetitorAd) => a.startDate ?? a.firstSeen;
export function isNewSince(a: CompetitorAd, days: number, now = Date.now()): boolean {
  const t = new Date(adStart(a)).getTime();
  return Number.isFinite(t) && now - t <= days * 86_400_000;
}

export interface BrandSummary {
  marca: string; own: boolean; activos: number; nuevos7: number; nuevos30: number;
  formatos: [string, number][]; plataformas: [string, number][]; masViejo: string | null;
  error: string | null; stale: boolean; fetchedAt: string | null;
}
/** Resumen por marca: activos, nuevos 7/30 días, mix de formatos y plataformas. */
export function brandSummary(b: BrandAds, now = Date.now()): BrandSummary {
  const active = b.ads.filter((a) => a.active);
  const fmt = new Map<string, number>(), plat = new Map<string, number>();
  for (const a of active) {
    fmt.set(a.format, (fmt.get(a.format) ?? 0) + 1);
    for (const p of a.platforms) plat.set(p, (plat.get(p) ?? 0) + 1);
  }
  return {
    marca: b.marca, own: b.own,
    activos: active.length,
    nuevos7: b.ads.filter((a) => isNewSince(a, 7, now)).length,
    nuevos30: b.ads.filter((a) => isNewSince(a, 30, now)).length,
    formatos: [...fmt.entries()].sort((x, y) => y[1] - x[1]),
    plataformas: [...plat.entries()].sort((x, y) => y[1] - x[1]),
    masViejo: active.map(adStart).sort()[0] ?? null,
    error: b.error ?? null, stale: Boolean(b.stale), fetchedAt: b.fetchedAt,
  };
}
