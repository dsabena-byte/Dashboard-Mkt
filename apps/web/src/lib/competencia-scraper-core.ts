// Scraper de competencia en CÓDIGO (reemplaza el n8n "Social Scraper — Apify + GPT → Supabase" y
// "Competitor Web Traffic Sync (Apify SimilarWeb)") — núcleo PURO (sin I/O), testeado en
// scripts/competencia-scraper.test.ts. Mapa completo del n8n y del plan de corte: docs/n8n-migracion.md.
//
// Regla de paridad: las funciones tagInstagram / tagFacebook / mapToSocialRows son PORTS LITERALES de los
// nodos "Tag Instagram", "Tag Facebook" y "Parse + Map to Supabase" del export del repo
// (n8n-workflows/scraper-social-supabase.json) → mismas filas que escribía n8n. La normalización web es la
// que se VE en la data real de competitor_web (el export del repo usa otro actor/otros campos: ver doc).
// Lo único que NO copia a n8n es cómo se escribe: mergeSocialRow nunca pisa un valor con null/0 ni
// baja contadores (mismas reglas que lib/bd-paridad.ts), en vez del merge-duplicates ciego de n8n.

// ── Config (la de n8n, validada contra la data) ────────────────────────────────────────────────
/** Marcas (= social_posts.marca) en el orden del n8n. Deben coincidir con tenant.socialAccounts. */
export const SCRAPER_BRANDS = ["dreanargentina", "philco.arg", "gafaargentina", "whirlpoolarg", "electroluxar"] as const;
export const igProfileUrl = (handle: string) => `https://www.instagram.com/${handle}/`;
/**
 * Páginas de Facebook por marca. Son las URL canónicas que aparecen en los posts que cargó n8n
 * (social_posts.url = facebook.com/<Página>/posts/…, validado 28-sep-2026). El export del repo tenía
 * alias viejos (PhilcoArgentinaOk, Whirlpool.Argentina, ElectroluxArgentina) que redirigen a estas.
 */
export const FB_PAGES: Record<string, string> = {
  dreanargentina: "https://www.facebook.com/dreanargentina",
  "philco.arg": "https://www.facebook.com/PhilcoArgentina",
  gafaargentina: "https://www.facebook.com/GafaArgentina",
  whirlpoolarg: "https://www.facebook.com/WhirlpoolARG",
  electroluxar: "https://www.facebook.com/ElectroluxAR",
};
/** Sitios de SimilarWeb (competitor_web): los 7 que trae la data real (incluye Samsung, que no está en el export). */
export const WEB_COMPETIDORES: { competidor: string; dominio: string; es_propio: boolean }[] = [
  { competidor: "Drean", dominio: "drean.com.ar", es_propio: true },
  { competidor: "Electrolux", dominio: "tienda.electrolux.com.ar", es_propio: false },
  { competidor: "Gafa", dominio: "tienda.gafa.com.ar", es_propio: false },
  { competidor: "Philco", dominio: "philco.com.ar", es_propio: false },
  { competidor: "Philco (Newsan)", dominio: "tiendanewsan.com.ar", es_propio: false },
  { competidor: "Whirlpool", dominio: "whirlpool.com.ar", es_propio: false },
  { competidor: "Samsung", dominio: "shop.samsung.com", es_propio: false },
];
export const VALID_PILARS = ["Branding", "Producto", "Promo", "Influencer", "Educacional"] as const;

// ── Tag (normalización por red) ───────────────────────────────────────────────────────────────
export type Platform = "INSTAGRAM" | "FACEBOOK";
export interface TaggedPost {
  url: string;
  brandFromInput?: string;
  caption: string;
  hashtags: string[];
  timestamp: string | number;
  likesCount: number;
  commentsCount: number;
  type: string;
  ownerUsername: string;
  ownerFollowerCount: number;
  videoViewCount: number;
  isSponsored: boolean;
  commentTexts?: string[];
  image: string;
  platform: Platform;
  /** Solo código (no n8n): URL de la página pedida, para atribuir la marca si el nombre no matchea. */
  inputPage?: string;
}

/** Port literal del nodo "Tag Instagram" (apify/instagram-scraper). */
export function tagInstagram(items: any[]): TaggedPost[] {
  return (items ?? [])
    .filter((d) => d && (d.shortCode || d.url))
    .map((d) => {
      const url = d.url || (d.shortCode ? "https://www.instagram.com/p/" + d.shortCode + "/" : "");
      const brandFromInput = String(d.inputUrl || "")
        .replace(/https?:\/\/(www\.)?/, "")
        .replace(/^instagram\.com\//, "")
        .replace(/\/.*$/, "")
        .toLowerCase();
      const commentTexts: string[] = Array.isArray(d.latestComments)
        ? d.latestComments.map((c: any) => (typeof c === "string" ? c : c?.text)).filter(Boolean).slice(0, 30)
        : [];
      return {
        url,
        brandFromInput,
        caption: d.caption || "",
        hashtags: Array.isArray(d.hashtags) ? d.hashtags : [],
        timestamp: d.timestamp || "",
        likesCount: Number(d.likesCount) || 0,
        commentsCount: Number(d.commentsCount) || 0,
        type: d.type || "Image",
        ownerUsername: d.ownerUsername || "",
        ownerFollowerCount: 0,
        videoViewCount: Number(d.videoPlayCount ?? d.videoViewCount) || 0,
        isSponsored: !!d.isPinned,
        commentTexts,
        image: d.displayUrl || (Array.isArray(d.images) ? d.images[0] : "") || "",
        platform: "INSTAGRAM" as const,
      };
    });
}

/** Port literal del nodo "Tag Facebook" (+ `inputPage` para el fallback de marca, que n8n no tenía). */
export function tagFacebook(items: any[]): TaggedPost[] {
  return (items ?? []).filter(Boolean).map((d) => {
    const text = d.text || d.message || d.story || "";
    const hashtags = (String(text).match(/#[\w\u00C0-\u024F]+/g) || []).map((h) => h.slice(1));
    return {
      url: d.url || d.postUrl || d.link || "",
      caption: text,
      hashtags,
      timestamp: d.time || d.createdTime || d.date || "",
      likesCount: d.likes || d.likesCount || d.reactionsCount || 0,
      commentsCount: d.comments || d.commentsCount || 0,
      type: d.type || "photo",
      ownerUsername: d.pageName || d.pageAlias || d.username || "",
      videoViewCount: d.videoViewCount || d.views || 0,
      ownerFollowerCount: d.pageFans || d.fans || d.followers || d.pageFollowers || 0,
      isSponsored: !!d.isSponsored,
      image: d.thumbnailUrl || d.image || "",
      platform: "FACEBOOK" as const,
      inputPage: String(d.facebookUrl || d.inputUrl || d.pageUrl || ""),
    };
  });
}

// ── Análisis LLM (mismo prompt que el nodo "GPT Analysis") ────────────────────────────────────
export const N8N_SYSTEM_PROMPT = "Sos un experto en análisis de sentimiento. Devolvés JSON válido. NO inventás datos.";
/** Texto literal del nodo "GPT Analysis" (modelo gpt-4o, temperature 0, response_format json_object). */
export function n8nAnalysisPrompt(posts: TaggedPost[]): string {
  const payload = JSON.stringify(posts.map((p) => ({ url: p.url, caption: (p.caption || "").substring(0, 250), comments: (p.commentTexts || []).slice(0, 20) })));
  return 'Para cada post tenés:\n- caption: texto que escribió la marca\n- comments: ARRAY de strings con comentarios REALES de la audiencia\n\nDevolvé 3 cosas:\n\n=== 1. PILAR ===\nMirá el CAPTION y clasificalo en UNO de: "Branding", "Producto", "Promo", "Influencer", "Educacional". No combines.\n\n=== 2. SENTIMIENTO ===\nReglas (NO NEGOCIABLES):\n- IGNORÁ COMPLETAMENTE el caption para este punto.\n- Si comments es [] → sentimiento: null.\n- Si hay 1+ comments, clasificá CADA string en comments individualmente:\n  * NEGATIVO: quejas ("reclamo", "vengo reclamando"), denuncias ("estafa", "OJO CON", "defensa al consumidor"), problemas ("no anda", "rota", "se rompió"), enojo ("vergüenza", "pésimo"), pedidos de devolución, frustración por no recibir respuesta, sarcasmo crítico\n  * POSITIVO: elogios ("increíble", "hermoso", "divino"), recomendaciones espontáneas, emojis afectivos (🔥 ❤️ 😍 🥰 👏 💙), felicitaciones\n  * NEUTRO: preguntas neutras ("¿precio?", "¿dónde lo compro?"), "me interesa" aislado, info sin emoción\n- Contá cuántos hay de cada tipo. Devolvé porcentajes ENTEROS que sumen 100.\n- EJEMPLO REAL: comments=["Yo hice una compra hace 60 días, y vengo reclamando...", "OJO CON DREAN!! Estafan a sus compradores...", "Quiero info me interesa"] → 2 NEG + 1 NEU de 3 = {positivo:0, negativo:67, neutro:33}\n- EJEMPLO REAL: comments=["Años que tengo @dreanargentina 💙 en mi casa... siempre fiel!!!"] → 1 POS de 1 = {positivo:100, negativo:0, neutro:0}\n\n=== 3. INSIGHT ===\nUna oración (≤200 chars) en español describiendo la reacción del público. Si no hay comments → null.\n\nPOSTS:\n'
    + payload
    + '\n\nFormato de salida:\n{"analysis":[{"url":"...","pilar":"...","sentimiento":{"positivo":N,"negativo":N,"neutro":N}|null,"insight":"..."|null}]}';
}

export interface Analysis { url: string; pilar?: string; sentimiento?: { positivo?: unknown; negativo?: unknown; neutro?: unknown } | null; insight?: string | null }
/** Extrae el array `analysis` de la respuesta de chat.completions (misma lógica que el nodo Parse). */
export function parseAnalysisContent(content: string): Analysis[] {
  try {
    const parsed = JSON.parse(content) as { analysis?: unknown } | unknown[];
    const arr = Array.isArray(parsed) ? parsed : (parsed as { analysis?: unknown }).analysis;
    return Array.isArray(arr) ? (arr as Analysis[]).filter((a) => a && typeof a.url === "string") : [];
  } catch { return []; }
}

/** Pilar canónico (nodo Parse: "Producto/Branding" → el primero válido; si no, Branding). */
export function pickPilarN8n(raw: unknown): string {
  if (!raw) return "Branding";
  const s = String(raw);
  if ((VALID_PILARS as readonly string[]).includes(s)) return s;
  for (const p of s.split("/").map((x) => x.trim())) if ((VALID_PILARS as readonly string[]).includes(p)) return p;
  return "Branding";
}

const norm = (s: string) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
/** matchMarca del nodo Parse: ownerUsername normalizado vs marcas (igual o prefijo en cualquier sentido). */
export function matchMarcaN8n(owner: string, marcas: readonly string[]): string | null {
  const o = norm(owner);
  if (!o) return null;
  return marcas.find((m) => { const mn = norm(m); return mn && (o === mn || o.startsWith(mn) || mn.startsWith(o)); }) ?? null;
}
const fbPageKey = (u: string) => String(u || "").toLowerCase().replace(/^https?:\/\//, "").replace(/^(www\.|m\.|web\.)/, "").replace(/^facebook\.com\//, "").replace(/[/?#].*$/, "");
/** Solo código: marca por la Página pedida (inputPage) o por el segmento de la URL del post. */
export function marcaPorPaginaFb(p: Pick<TaggedPost, "inputPage" | "url">): string | null {
  for (const cand of [p.inputPage, p.url]) {
    const k = fbPageKey(cand ?? "");
    if (!k) continue;
    const hit = Object.entries(FB_PAGES).find(([, u]) => fbPageKey(u) === k);
    if (hit) return hit[0];
  }
  return null;
}

// ── Parse + Map to Supabase ───────────────────────────────────────────────────────────────────
export interface SocialRow {
  red_social: Platform;
  url: string;
  pilar: string;
  positivo: number | null;
  negativo: number | null;
  neutro: number | null;
  likes: number;
  comentarios: number;
  engagement: number | null;
  fecha: string;
  tipo: "PAUTA" | "ORGÁNICO";
  marca: string;
  views: number;
  content_type: "VIDEO" | "SIDECAR" | "IMAGE";
  thumbnail_url: string | null;
  copy: string | null;
  followers: number;
}
export interface MapStats { sinUrl: number; sinAnalisis: number; anteriores: number; sinMarca: number; marcaPorPagina: number }

/**
 * Port literal del nodo "Parse + Map to Supabase". `analysisByUrl` = análisis del LLM por url; un post
 * sin análisis se descarta (igual que n8n). Única diferencia opcional: `fbPageFallback` atribuye la
 * marca de un post de FB por la Página pedida cuando el nombre de la página no matchea (n8n lo perdía).
 */
export function mapToSocialRows(posts: TaggedPost[], analysisByUrl: Map<string, Analysis>, opts: { marcas: readonly string[]; fromDate: string; fbPageFallback?: boolean }): { rows: SocialRow[]; stats: MapStats } {
  const stats: MapStats = { sinUrl: 0, sinAnalisis: 0, anteriores: 0, sinMarca: 0, marcaPorPagina: 0 };
  const marcas = opts.marcas.map((b) => b.toLowerCase());
  const rows: SocialRow[] = [];
  for (const post of posts) {
    const url = post.url || "";
    if (!url) { stats.sinUrl++; continue; }
    const analysis = analysisByUrl.get(url);
    if (!analysis) { stats.sinAnalisis++; continue; }
    let fecha: string | null = null;
    try { fecha = post.timestamp ? new Date(post.timestamp).toISOString().slice(0, 10) : null; } catch { fecha = null; }
    if (!fecha || fecha < opts.fromDate) { stats.anteriores++; continue; }
    let marca: string | null = null;
    if (post.brandFromInput && marcas.includes(post.brandFromInput)) marca = post.brandFromInput;
    else marca = matchMarcaN8n(post.ownerUsername || "", marcas);
    if (!marca && opts.fbPageFallback && post.platform === "FACEBOOK") { marca = marcaPorPaginaFb(post); if (marca) stats.marcaPorPagina++; }
    if (!marca) { stats.sinMarca++; continue; }
    const likes = Number(post.likesCount) || 0;
    const comments = Number(post.commentsCount) || 0;
    const views = Number(post.videoViewCount) || 0;
    const followers = Number(post.ownerFollowerCount) || 0;
    const t = (post.type || "").toLowerCase();
    const contentType = t.includes("video") || t.includes("reel") ? "VIDEO" : t.includes("sidecar") || t.includes("album") ? "SIDECAR" : "IMAGE";
    const sent = analysis.sentimiento;
    const hasComments = Array.isArray(post.commentTexts) && post.commentTexts.length > 0;
    const hasSent = hasComments && !!sent && typeof sent === "object" && (sent.positivo != null || sent.negativo != null || sent.neutro != null);
    rows.push({
      red_social: post.platform,
      url,
      pilar: pickPilarN8n(analysis.pilar),
      positivo: hasSent ? Number(sent!.positivo) || 0 : null,
      negativo: hasSent ? Number(sent!.negativo) || 0 : null,
      neutro: hasSent ? Number(sent!.neutro) || 0 : null,
      likes,
      comentarios: comments,
      engagement: followers > 0 ? Number((((likes + comments) / followers) * 100).toFixed(3)) : null,
      fecha,
      tipo: post.isSponsored ? "PAUTA" : "ORGÁNICO",
      marca,
      views,
      content_type: contentType,
      thumbnail_url: post.image || null,
      copy: post.caption || null,
      followers,
    });
  }
  // Filter Valid Posts (url no vacía) ya está garantizado arriba. Dedup por url (el upsert de n8n
  // fallaba entero si un lote traía la misma url dos veces; acá gana la última).
  const byUrl = new Map(rows.map((r) => [r.url, r]));
  return { rows: [...byUrl.values()], stats };
}

// ── Escritura segura (merge sin pérdida) ──────────────────────────────────────────────────────
export interface ExistingRow {
  url: string; red_social?: string | null; marca?: string | null; fecha?: string | null; pilar?: string | null;
  positivo?: number | null; negativo?: number | null; neutro?: number | null;
  likes?: number | null; comentarios?: number | null; views?: number | null; engagement?: number | null;
  tipo?: string | null; content_type?: string | null; thumbnail_url?: string | null; copy?: string | null; followers?: number | null;
}
const MIRROR = "/storage/v1/object/public/";
const posNum = (n: unknown): number | null => (typeof n === "number" && Number.isFinite(n) && n >= 0 ? n : null);
const filled = (s: unknown): s is string => typeof s === "string" && s.trim() !== "";

/**
 * Fila final a escribir para un post que YA existe en social_posts. A diferencia del merge-duplicates
 * de n8n (que pisaba todo con lo del día), nunca pierde información:
 *  · contadores (likes, comentarios, views) solo suben (como bdMetricPatch);
 *  · followers del post = seguidores al momento del post: solo se completa si faltaba;
 *  · marca, red, fecha, pilar, tipo de contenido y copy: gana lo que ya estaba (la fecha de BD va en hora AR);
 *  · miniatura: se conserva la espejada en Storage; si no hay, la nueva;
 *  · sentimiento y tipo (ORGÁNICO/PAUTA): gana lo nuevo si viene (comentarios más maduros), si no, lo anterior;
 *  · engagement: recalculado con los valores finales si hay seguidores; si no, el anterior. Nunca null sobre valor.
 */
export function mergeSocialRow(existing: ExistingRow | null | undefined, inc: SocialRow): SocialRow {
  if (!existing) return inc;
  const up = (cur: number | null | undefined, nv: number, zeroIsEmpty = false): number => {
    const c = posNum(cur), n = posNum(nv);
    if (n == null || (zeroIsEmpty && n === 0)) return c ?? (typeof cur === "number" ? cur : nv);
    return c == null || n > c ? n : c;
  };
  const likes = up(existing.likes, inc.likes);
  const comentarios = up(existing.comentarios, inc.comentarios);
  const views = up(existing.views, inc.views, true);
  const fol = posNum(existing.followers) || posNum(inc.followers) || 0;
  const hasSent = inc.positivo != null || inc.negativo != null || inc.neutro != null;
  const thumb = existing.thumbnail_url && existing.thumbnail_url.includes(MIRROR) ? existing.thumbnail_url : (inc.thumbnail_url || existing.thumbnail_url || null);
  return {
    red_social: (filled(existing.red_social) ? existing.red_social : inc.red_social) as Platform,
    url: existing.url || inc.url,
    marca: filled(existing.marca) ? existing.marca : inc.marca,
    fecha: filled(existing.fecha) ? existing.fecha : inc.fecha,
    pilar: filled(existing.pilar) ? existing.pilar : inc.pilar,
    positivo: hasSent ? inc.positivo : existing.positivo ?? null,
    negativo: hasSent ? inc.negativo : existing.negativo ?? null,
    neutro: hasSent ? inc.neutro : existing.neutro ?? null,
    likes, comentarios, views,
    engagement: fol > 0 && likes >= 0 ? Number((((likes + comentarios) / fol) * 100).toFixed(3)) : (existing.engagement ?? inc.engagement ?? null),
    tipo: inc.tipo || ((existing.tipo as SocialRow["tipo"]) ?? "ORGÁNICO"),
    content_type: (filled(existing.content_type) ? existing.content_type : inc.content_type) as SocialRow["content_type"],
    thumbnail_url: thumb,
    copy: filled(existing.copy) ? existing.copy : inc.copy,
    followers: fol,
  };
}

// ── SimilarWeb (competitor_web) ───────────────────────────────────────────────────────────────
export interface WebRow {
  fecha: string; competidor: string; dominio: string;
  visitas_estimadas: number | null; visitantes_unicos: number | null;
  bounce_rate: number | null; pages_per_visit: number | null; avg_visit_duration: number | null;
  fuentes_trafico: unknown; paginas_top: unknown; paises_top: unknown; keywords_top: unknown;
  source: "apify_similarweb"; raw: unknown;
}
const toInt = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? Math.round(n) : null;
};
const toFloat = (v: unknown, dec: number): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Number(n.toFixed(dec)) : null;
};
export const cleanDomain = (s: unknown) => String(s ?? "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/[/?#].*$/, "");

/**
 * Normalización de radeance/similarweb-scraper a competitor_web, reconstruida de las filas reales que
 * escribió n8n (28-sep-2026): visitas=totalVisits, duración=timeOnSite, paginas_top=monthlyVisitsDateFormat,
 * paises_top=website_traffic_by_country; visitantes_unicos, fuentes_trafico y keywords_top quedan null
 * (n8n no los mapeaba aunque el actor trae topKeywords y las fuentes). Decimales = precisión de la columna.
 */
export function normalizeWeb(items: any[], fecha: string, competidores = WEB_COMPETIDORES): WebRow[] {
  const byDom = new Map(competidores.map((c) => [cleanDomain(c.dominio), c]));
  const out: WebRow[] = [];
  for (const r of items ?? []) {
    const dominio = cleanDomain(r?.domain ?? r?.name ?? r?.website ?? r?.url ?? r?.siteName);
    if (!dominio) continue;
    const meta = byDom.get(dominio);
    out.push({
      fecha, competidor: meta?.competidor ?? dominio, dominio,
      visitas_estimadas: toInt(r.totalVisits ?? r.monthlyVisitsTotal ?? null),
      visitantes_unicos: null,
      bounce_rate: toFloat(r.bounceRate, 4),
      pages_per_visit: toFloat(r.pagesPerVisit, 2),
      avg_visit_duration: toFloat(r.timeOnSite, 2),
      fuentes_trafico: null,
      paginas_top: r.monthlyVisitsDateFormat ?? null,
      paises_top: r.website_traffic_by_country ?? null,
      keywords_top: null,
      source: "apify_similarweb",
      raw: r,
    });
  }
  // unique (fecha, competidor, source): si el actor repite un dominio, gana la última.
  return [...new Map(out.map((w) => [w.competidor, w])).values()];
}
/** Una fila con dato real (no pisar una semana buena con una vacía). */
export const webHasData = (w: WebRow) => (w.visitas_estimadas ?? 0) > 0;

// ── Apify: cupo agotado ───────────────────────────────────────────────────────────────────────
/** 402 o 403 "usage/limit/credit" = la cuenta llegó a su tope mensual → cortar la corrida. */
export function isApifyQuotaText(status: number, text: string): boolean {
  if (status === 402) return true;
  return (status === 403 || status === 429) && /usage|limit|quota|credit|exceed|insufficient|payment/i.test(text || "");
}

// ── Cadencia del IG por Apify (comentarios) ───────────────────────────────────────────────────
/** `COMPETENCIA_IG_APIFY_DIAS` = días de la semana UTC (0=dom … 6=sáb, CSV) o "*" (todos). Default lunes. */
export function igApifyToca(env: string | undefined, now: Date): boolean {
  const v = (env ?? "1").trim();
  if (v === "*" || v === "") return true;
  return v.split(",").map((x) => Number(x.trim())).includes(now.getUTCDay());
}
