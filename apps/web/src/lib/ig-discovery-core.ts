// Competencia de Instagram por Business Discovery (Graph API OFICIAL) — núcleo PURO, client-safe.
// Portado del SaaS hermano (sep-2026) y adaptado a Drean (posts → forma de `social_posts`).
//
// Endpoint (doc de Meta, IG User > business_discovery; Instagram API with Facebook Login):
//   GET /{ig-user-id-propio}?fields=business_discovery.username(<handle>){followers_count,media_count,
//       media.limit(N)[.after(<cursor>)]{id,caption,like_count,comments_count,media_type,
//       media_product_type,permalink,timestamp,thumbnail_url,media_url,view_count}}
// - Solo cuentas Business o Creator (no personales ni con restricción de edad).
// - No trae insights de terceros (sin alcance, guardados ni shares). `like_count` puede faltar si la
//   cuenta ocultó los likes. `view_count` es de Reels.
// - Rate limit: Platform Rate Limits. Meta devuelve el uso en los headers `X-App-Usage` /
//   `X-Business-Use-Case-Usage` (% consumido) → se corta antes del tope (BD_USAGE_STOP_PCT).
// Paginación: SOLO cursores, dentro del edge anidado: media.after(<cursor>).

/** Post de competencia leído por Business Discovery (mismas columnas que `social_posts`). */
export interface BdPost {
  red_social: "INSTAGRAM";
  url: string;
  marca: string;
  fecha: string | null;   // YYYY-MM-DD en hora AR
  ts: string | null;      // timestamp ISO de publicación
  likes: number | null;   // null = la cuenta oculta los likes
  comentarios: number;
  views: number;
  content_type: string | null;
  thumbnail_url: string | null;
  copy: string;
}

export const BD_MEDIA_FIELDS = "id,caption,like_count,comments_count,media_type,media_product_type,permalink,timestamp,thumbnail_url,media_url,view_count";
/** Sin view_count (algunas versiones/cuentas lo rechazan y tiran la llamada entera). */
export const BD_MEDIA_FIELDS_LITE = "id,caption,like_count,comments_count,media_type,media_product_type,permalink,timestamp,thumbnail_url,media_url";
/** Por encima de este % de uso (cualquier header) no se hacen más llamadas en la corrida. */
export const BD_USAGE_STOP_PCT = 75;
/** Posts por página del edge media. */
export const BD_PAGE = 50;

export const normHandle = (h: string) => String(h ?? "").trim().replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/[/?#].*$/, "").toLowerCase();
/** Un username de IG válido (el campo va dentro de la URL de Graph: nada fuera de [a-z0-9._]). */
export const validHandle = (h: string) => /^[a-z0-9._]{1,30}$/.test(h);

export function bdFieldsParam(handle: string, opts: { limit?: number; after?: string | null; lite?: boolean } = {}): string {
  const lim = Math.max(1, Math.min(BD_PAGE, Math.round(opts.limit ?? 25)));
  const after = opts.after ? `.after(${opts.after})` : "";
  return `business_discovery.username(${normHandle(handle)}){username,followers_count,media_count,media.limit(${lim})${after}{${opts.lite ? BD_MEDIA_FIELDS_LITE : BD_MEDIA_FIELDS}}}`;
}

/** % máximo de uso informado por Meta en los headers de rate limit (0 si no vienen o no se pueden leer). */
export function usagePct(appUsage: string | null | undefined, bucUsage: string | null | undefined): number {
  let max = 0;
  const take = (o: unknown) => {
    if (!o || typeof o !== "object") return;
    for (const k of ["call_count", "total_cputime", "total_time", "acc_id_util_pct"]) {
      const v = Number((o as Record<string, unknown>)[k]);
      if (Number.isFinite(v) && v > max) max = v;
    }
  };
  try { if (appUsage) take(JSON.parse(appUsage)); } catch { /* header ilegible */ }
  try {
    if (bucUsage) {
      const j = JSON.parse(bucUsage) as Record<string, unknown>;
      for (const v of Object.values(j ?? {})) (Array.isArray(v) ? v : [v]).forEach(take);
    }
  } catch { /* header ilegible */ }
  return max;
}

export type BdErrorKind = "no_business" | "rate" | "permiso" | "campo" | "otro";
/** Clasifica un error de Graph de Business Discovery (código/subcódigo/mensaje). */
export function classifyBdError(code: number | undefined, subcode: number | undefined, message: string): BdErrorKind {
  const m = String(message ?? "").toLowerCase();
  if ([4, 17, 32, 613, 80002].includes(code ?? -1) || /rate limit|too many calls|request limit/.test(m)) return "rate";
  if (subcode === 2207013 || /cannot be found|not.*business|does not exist|invalid user id|age.?gated/.test(m)) return "no_business";
  if (code === 10 || code === 200 || code === 190 || /permission|not authorized|access token/.test(m)) return "permiso";
  if (code === 100 && /field|view_count|nonexisting/.test(m)) return "campo";
  return "otro";
}

/** Tipo de contenido con el vocabulario de `social_posts` (IMAGE | VIDEO | SIDECAR | REEL). */
export function contentType(mediaType: unknown, product: unknown): string | null {
  const p = String(product ?? "").toUpperCase();
  if (p === "REELS") return "REEL";
  const t = String(mediaType ?? "").toUpperCase();
  if (t === "CAROUSEL_ALBUM") return "SIDECAR";
  if (t === "VIDEO") return "VIDEO";
  if (t === "IMAGE") return "IMAGE";
  return t || null;
}
const isMp4 = (u: unknown) => typeof u === "string" && /\.mp4(\?|$)/i.test(u);

export interface BdParsed {
  ok: boolean;
  username: string;
  followers: number | null;
  mediaCount: number | null;
  posts: BdPost[];
  after: string | null;     // cursor de la página siguiente (null = no hay más)
  reachedFrom: boolean;     // la página ya llegó a posts anteriores a `fromDate`
  likesOcultos: number;     // posts sin like_count (la cuenta ocultó los likes)
}

/** Convierte la respuesta de Graph a posts de competencia. Fechas < fromDate se descartan. */
export function parseBd(json: any, marca: string, fromDate: string | null): BdParsed {
  const bd = json?.business_discovery;
  if (!bd || typeof bd !== "object") return { ok: false, username: "", followers: null, mediaCount: null, posts: [], after: null, reachedFrom: false, likesOcultos: 0 };
  const media: unknown[] = Array.isArray(bd.media?.data) ? bd.media.data : [];
  const posts: BdPost[] = [];
  let reachedFrom = false;
  let likesOcultos = 0;
  for (const raw of media) {
    const m = raw as any;
    const ts = typeof m?.timestamp === "string" ? m.timestamp : null;
    const t = ts ? Date.parse(ts) : NaN;
    // Fecha en hora AR (UTC-3 fijo) para que el mes coincida con el resto del tablero.
    const fecha = Number.isFinite(t) ? new Date(t - 3 * 3600_000).toISOString().slice(0, 10) : null;
    if (fromDate && fecha && fecha < fromDate) { reachedFrom = true; continue; }
    const url = typeof m?.permalink === "string" ? m.permalink : null;
    if (!url) continue;
    const hasLikes = typeof m.like_count === "number";
    if (!hasLikes) likesOcultos++;
    const thumb = [m.thumbnail_url, m.media_url].find((u: unknown) => typeof u === "string" && u && !isMp4(u)) ?? null;
    posts.push({
      red_social: "INSTAGRAM", url, marca, fecha, ts,
      likes: hasLikes ? m.like_count : null,
      comentarios: typeof m.comments_count === "number" ? m.comments_count : 0,
      views: typeof m.view_count === "number" ? m.view_count : 0,
      content_type: contentType(m.media_type, m.media_product_type),
      thumbnail_url: typeof thumb === "string" ? thumb : null,
      copy: String(m.caption ?? "").slice(0, 500),
    });
  }
  const next = bd.media?.paging?.next ? (bd.media?.paging?.cursors?.after ?? null) : null;
  return {
    ok: true, username: String(bd.username ?? ""), followers: typeof bd.followers_count === "number" ? bd.followers_count : null,
    mediaCount: typeof bd.media_count === "number" ? bd.media_count : null,
    posts, after: next, reachedFrom, likesOcultos,
  };
}

/**
 * URL canónica de un post de IG con el formato que guarda el scraper en `social_posts.url`
 * (`https://www.instagram.com/p/<shortcode>/`, también para Reels — validado con data real sep-2026):
 * así el upsert por `url` no duplica el post cuando Graph devuelve `/reel/<code>/`.
 */
export function canonIgUrl(url: string): string {
  const m = String(url ?? "").match(/instagram\.com\/(?:[^/]+\/)?(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/i);
  return m ? `https://www.instagram.com/p/${m[1]}/` : String(url ?? "");
}
/** Vocabulario de `social_posts.content_type` (el scraper guarda los Reels como VIDEO). */
export const socialContentType = (ct: string | null) => (ct === "REEL" ? "VIDEO" : ct);

/**
 * Presupuesto de llamadas de una corrida: páginas máximas por marca según el modo.
 * daily = refresco liviano (1 página de 25: alimenta las fotos por edad y el ER del día);
 * full  = backfill (hasta 2 páginas de 50 = 100 posts).
 */
export function bdPlan(mode: "daily" | "full"): { limit: number; maxPages: number } {
  return mode === "daily" ? { limit: 25, maxPages: 1 } : { limit: BD_PAGE, maxPages: 2 };
}
