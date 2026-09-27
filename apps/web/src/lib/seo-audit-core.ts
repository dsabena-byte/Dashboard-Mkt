// ============================================================================
// AUDITORÍA TÉCNICA SEO/GEO + CORE WEB VITALS (gap G5 de docs/estado-del-arte/seo-geo.md §4.8 y
// roadmap #4/#7/#8). PURO y client-safe (sin fetch): parseo de robots.txt, sitemap y HTML,
// chequeos con severidad Error / Warning / Notice (formato Semrush/Sitebulb: qué es, por qué
// importa, cómo arreglarlo, recurso oficial), evaluación de Core Web Vitals con los umbrales
// oficiales al p75 (LCP ≤ 2,5 s · INP ≤ 200 ms · CLS ≤ 0,1) y adaptador a la TARJETA DE
// Portado de BIP (sep-2026) para drean.com.ar. IndexNow / Bing Webmaster NO se portaron (requieren
// publicar un archivo con la key en drean.com.ar: lo decide el equipo del sitio).
// El fetch (robots, sitemap, HTML, PSI/CrUX) vive en lib/seo-audit.ts (server).
// Test: scripts/seo-avanzado.test.ts
// ============================================================================
// Drean: sin tarjeta de recomendación (no existe lib/recomendacion) → tipos de esfuerzo/confianza locales.
export type NivelEsfuerzo = 1 | 2 | 3;
export type NivelConfianza = "alta" | "media" | "baja";
export const ESFUERZO_LABEL: Record<NivelEsfuerzo, string> = { 1: "Bajo", 2: "Medio", 3: "Alto" };

export type Severidad = "error" | "warning" | "notice";
export const SEVERIDAD_LABEL: Record<Severidad, string> = { error: "Error", warning: "Advertencia", notice: "Aviso" };
export type CategoriaCheck = "indexacion" | "ia" | "contenido" | "estructura" | "rendimiento" | "internacional" | "datos";

// ── robots.txt ───────────────────────────────────────────────────────────────
export interface RobotsRule { allow: boolean; path: string }
export interface RobotsGroup { agents: string[]; rules: RobotsRule[] }
export interface RobotsParsed { groups: RobotsGroup[]; sitemaps: string[] }

export function parseRobots(txt: string | null | undefined): RobotsParsed {
  const groups: RobotsGroup[] = [];
  const sitemaps: string[] = [];
  let cur: RobotsGroup | null = null;
  let lastWasAgent = false;
  for (const raw of (txt ?? "").split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    if (!line) continue;
    const m = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(line);
    if (!m) continue;
    const k = m[1]!.toLowerCase(), v = m[2]!.trim();
    if (k === "user-agent") {
      if (!cur || !lastWasAgent) { cur = { agents: [], rules: [] }; groups.push(cur); }
      cur.agents.push(v.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (k === "sitemap") { if (v) sitemaps.push(v); continue; }
    if (!cur) continue;
    if (k === "allow" || k === "disallow") cur.rules.push({ allow: k === "allow", path: v });
  }
  return { groups, sitemaps };
}

/** ¿El patrón de robots (con * y $) matchea el path? Devuelve el largo del patrón o -1. */
export function robotsMatch(pattern: string, path: string): number {
  if (pattern === "") return -1;
  const anchored = pattern.endsWith("$");
  const body = anchored ? pattern.slice(0, -1) : pattern;
  const re = new RegExp("^" + body.split("*").map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*") + (anchored ? "$" : ""));
  return re.test(path) ? pattern.length : -1;
}

/**
 * Semántica de Google (RFC 9309): se usa el grupo del user-agent más específico que coincide
 * (si no, `*`; los grupos repetidos se unen); dentro del grupo gana la regla más larga y, en
 * empate, Allow. Sin grupo aplicable = permitido.
 */
export function robotsAllows(r: RobotsParsed, userAgent: string, path = "/"): boolean {
  const ua = userAgent.toLowerCase();
  // Token de producto: exacto o prefijo ("googlebot" aplica a "googlebot-news" si no tiene grupo propio).
  const match = (a: string) => a !== "*" && (ua === a || ua.startsWith(a));
  let best = "";
  for (const g of r.groups) for (const a of g.agents) if (match(a) && a.length > best.length) best = a;
  const rules = r.groups.filter((g) => best ? g.agents.includes(best) : g.agents.includes("*")).flatMap((g) => g.rules);
  let winLen = -1, allow = true;
  for (const rule of rules) {
    const len = robotsMatch(rule.path, path);
    if (len < 0) continue;
    if (len > winLen || (len === winLen && rule.allow)) { winLen = len; allow = rule.allow; }
  }
  return winLen < 0 ? true : allow;
}

export type TipoBot = "busqueda" | "ia_busqueda" | "entrenamiento";
export const BOTS: { ua: string; label: string; tipo: TipoBot; doc: string }[] = [
  { ua: "Googlebot", label: "Google (búsqueda y Resumen IA)", tipo: "busqueda", doc: "https://developers.google.com/search/docs/crawling-indexing/robots/intro" },
  { ua: "Bingbot", label: "Bing / Copilot", tipo: "busqueda", doc: "https://www.bing.com/webmasters/help/which-crawlers-does-bing-use-8c184ec0" },
  { ua: "OAI-SearchBot", label: "ChatGPT (búsqueda)", tipo: "ia_busqueda", doc: "https://developers.openai.com/api/docs/bots" },
  { ua: "Claude-SearchBot", label: "Claude (búsqueda)", tipo: "ia_busqueda", doc: "https://support.claude.com/en/articles/8896518" },
  { ua: "PerplexityBot", label: "Perplexity", tipo: "ia_busqueda", doc: "https://docs.perplexity.ai/guides/bots" },
  { ua: "GPTBot", label: "OpenAI (entrenamiento)", tipo: "entrenamiento", doc: "https://developers.openai.com/api/docs/bots" },
  { ua: "ClaudeBot", label: "Anthropic (entrenamiento)", tipo: "entrenamiento", doc: "https://support.claude.com/en/articles/8896518" },
  { ua: "Google-Extended", label: "Google Gemini (entrenamiento)", tipo: "entrenamiento", doc: "https://developers.google.com/search/docs/crawling-indexing/google-common-crawlers" },
  { ua: "CCBot", label: "Common Crawl (entrenamiento)", tipo: "entrenamiento", doc: "https://commoncrawl.org/ccbot" },
];
export interface BotAcceso { ua: string; label: string; tipo: TipoBot; permitido: boolean }
export function accesoBots(robots: RobotsParsed | null): BotAcceso[] {
  return BOTS.map((b) => ({ ua: b.ua, label: b.label, tipo: b.tipo, permitido: robots ? robotsAllows(robots, b.ua, "/") : true }));
}

// ── sitemap ──────────────────────────────────────────────────────────────────
export interface SitemapUrl { loc: string; lastmod: string | null }
export function parseSitemap(xml: string | null | undefined): { tipo: "urlset" | "index" | "invalido"; urls: SitemapUrl[] } {
  const x = xml ?? "";
  const isIndex = /<sitemapindex[\s>]/i.test(x), isSet = /<urlset[\s>]/i.test(x);
  if (!isIndex && !isSet) return { tipo: "invalido", urls: [] };
  const tag = isIndex ? "sitemap" : "url";
  const urls: SitemapUrl[] = [];
  for (const m of x.matchAll(new RegExp(`<${tag}[\\s>]([\\s\\S]*?)</${tag}>`, "gi"))) {
    const loc = /<loc>\s*(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?\s*<\/loc>/i.exec(m[1]!)?.[1]?.trim();
    if (!loc) continue;
    const lm = /<lastmod>\s*([^<]+?)\s*<\/lastmod>/i.exec(m[1]!)?.[1] ?? null;
    urls.push({ loc: decodeEntities(loc), lastmod: lm });
  }
  return { tipo: isIndex ? "index" : "urlset", urls };
}

// ── HTML ─────────────────────────────────────────────────────────────────────
function decodeEntities(s: string): string {
  return s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}
export function parseAttrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  const inner = tag.replace(/^<\s*[a-zA-Z0-9-]+/, "").replace(/\/?>$/, "");
  for (const m of inner.matchAll(/([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*(?:=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g)) {
    out[m[1]!.toLowerCase()] = decodeEntities(m[3] ?? m[4] ?? m[5] ?? "");
  }
  return out;
}
const textOf = (s: string) => decodeEntities(s.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

export interface PageFacts {
  url: string; finalUrl: string; status: number; redirected: boolean;
  xRobots: string | null; contentType: string | null;
  title: string | null; metaDescription: string | null; h1: string[];
  canonical: string | null; robotsMeta: string | null; lang: string | null; viewport: boolean;
  hreflang: { lang: string; href: string }[];
  schemaTypes: string[]; schemaErrores: number;
  textChars: number; bytes: number;
  /** Impresiones/clics de Search Console de la página (si vino de SC) → pondera el impacto. */
  clicks?: number; impresiones?: number;
}

export function parseHtml(html: string, meta: { url: string; finalUrl?: string; status?: number; xRobots?: string | null; contentType?: string | null; bytes?: number }): PageFacts {
  const h = html ?? "";
  const head = /<head[\s>][\s\S]*?<\/head>/i.exec(h)?.[0] ?? h.slice(0, 200_000);
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(head)?.[1];
  const metas = [...head.matchAll(/<meta\b[^>]*>/gi)].map((m) => parseAttrs(m[0]));
  const metaNamed = (n: string) => metas.find((a) => (a.name ?? "").toLowerCase() === n)?.content ?? null;
  const links = [...h.matchAll(/<link\b[^>]*>/gi)].map((m) => parseAttrs(m[0]));
  const rel = (a: Record<string, string>) => (a.rel ?? "").toLowerCase().split(/\s+/);
  const canonical = links.find((a) => rel(a).includes("canonical"))?.href ?? null;
  const hreflang = links.filter((a) => rel(a).includes("alternate") && a.hreflang).map((a) => ({ lang: a.hreflang!.toLowerCase(), href: a.href ?? "" }));
  const h1 = [...h.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) => textOf(m[1]!)).filter((x) => x !== undefined);
  const lang = /<html\b[^>]*>/i.exec(h)?.[0];
  const types = new Set<string>();
  let schemaErrores = 0;
  for (const m of h.matchAll(/<script\b[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const walk = (x: unknown, d: number) => {
        if (!x || typeof x !== "object" || d > 6) return;
        if (Array.isArray(x)) { for (const y of x) walk(y, d + 1); return; }
        const o = x as Record<string, unknown>;
        const t = o["@type"];
        if (typeof t === "string") types.add(t); else if (Array.isArray(t)) for (const y of t) if (typeof y === "string") types.add(y);
        if (Array.isArray(o["@graph"])) walk(o["@graph"], d + 1);
      };
      walk(JSON.parse(m[1]!.trim()), 0);
    } catch { schemaErrores++; }
  }
  // Microdata también cuenta como schema.
  for (const m of h.matchAll(/itemtype\s*=\s*["']https?:\/\/schema\.org\/([A-Za-z]+)["']/gi)) types.add(m[1]!);
  const body = (/<body[\s>][\s\S]*$/i.exec(h)?.[0] ?? h).replace(/<(script|style|noscript|svg|template)\b[\s\S]*?<\/\1>/gi, " ");
  return {
    url: meta.url, finalUrl: meta.finalUrl ?? meta.url, status: meta.status ?? 200, redirected: !!meta.finalUrl && normU(meta.finalUrl) !== normU(meta.url),
    xRobots: meta.xRobots ?? null, contentType: meta.contentType ?? null,
    title: title != null ? textOf(title) : null,
    metaDescription: metaNamed("description"),
    h1, canonical, robotsMeta: [metaNamed("robots"), metaNamed("googlebot")].filter(Boolean).join(", ") || null,
    lang: lang ? parseAttrs(lang).lang ?? null : null,
    viewport: metas.some((a) => (a.name ?? "").toLowerCase() === "viewport"),
    hreflang, schemaTypes: [...types].slice(0, 20), schemaErrores,
    textChars: textOf(body).length, bytes: meta.bytes ?? h.length,
  };
}
const normU = (u: string) => u.replace(/#.*$/, "").replace(/\/+$/, "").toLowerCase();

// ── Catálogo de chequeos ─────────────────────────────────────────────────────
export interface CheckDef { sev: Severidad; cat: CategoriaCheck; titulo: string; porQue: string; como: string[]; recurso: { titulo: string; href: string }; esfuerzo: NivelEsfuerzo; confianza: NivelConfianza }
const G = (path: string) => `https://developers.google.com/search/docs/${path}`;
export const CHECKS: Record<string, CheckDef> = {
  http_error: { sev: "error", cat: "indexacion", titulo: "Páginas importantes que responden con error", porQue: "Una página que devuelve 4xx/5xx sale del índice y pierde el tráfico que traía.", como: ["Revisá por qué la URL devuelve error (borrada, movida, caída del servidor)", "Si se movió, redirigí con 301 a la URL nueva", "Si se borró a propósito, actualizá los enlaces internos y el sitemap"], recurso: { titulo: "Códigos HTTP y Google", href: G("crawling-indexing/http-network-errors") }, esfuerzo: 2, confianza: "alta" },
  noindex: { sev: "error", cat: "indexacion", titulo: "Páginas con tráfico marcadas como noindex", porQue: "noindex (meta robots o X-Robots-Tag) le pide a Google que la saque del índice: deja de aparecer en búsquedas y en el Resumen IA.", como: ["Confirmá si el noindex es intencional", "Si no lo es, quitalo del meta robots / header X-Robots-Tag (suele venir de una plantilla o plugin)", "Pedí la reindexación en Search Console → Inspección de URL"], recurso: { titulo: "Bloquear la indexación con noindex", href: G("crawling-indexing/block-indexing") }, esfuerzo: 1, confianza: "alta" },
  nosnippet: { sev: "error", cat: "ia", titulo: "Páginas que no permiten fragmentos (nosnippet / max-snippet:0)", porQue: "Google exige que la página sea elegible para mostrar fragmento para citarla en el Resumen IA y AI Mode; nosnippet te deja afuera.", como: ["Quitá nosnippet o max-snippet:0 del meta robots (salvo contenido que legalmente no puede mostrarse)", "Si hay una parte que no querés mostrar, usá data-nosnippet solo en ese bloque"], recurso: { titulo: "Funciones de IA y tu sitio", href: G("appearance/ai-features") }, esfuerzo: 1, confianza: "alta" },
  robots_bloquea_todo: { sev: "error", cat: "indexacion", titulo: "robots.txt bloquea a Google", porQue: "Si Googlebot no puede rastrear el sitio, no puede actualizar ni posicionar tus páginas.", como: ["Revisá el robots.txt: 'Disallow: /' para User-agent: * o Googlebot bloquea todo", "Dejá solo los bloqueos de áreas privadas (carrito, admin, búsqueda interna)"], recurso: { titulo: "Introducción a robots.txt", href: G("crawling-indexing/robots/intro") }, esfuerzo: 1, confianza: "alta" },
  bot_ia_bloqueado: { sev: "error", cat: "ia", titulo: "robots.txt bloquea a buscadores de IA", porQue: "Si bloqueás OAI-SearchBot, Claude-SearchBot o PerplexityBot, esos asistentes no pueden citarte ni linkearte en sus respuestas.", como: ["Agregá en robots.txt un bloque 'User-agent: <bot>' con 'Allow: /' para OAI-SearchBot, Claude-SearchBot y PerplexityBot", "La decisión sobre los bots de ENTRENAMIENTO (GPTBot, ClaudeBot, Google-Extended) es aparte y no afecta la búsqueda"], recurso: { titulo: "Bots de OpenAI", href: "https://developers.openai.com/api/docs/bots" }, esfuerzo: 1, confianza: "alta" },
  bot_entrenamiento_bloqueado: { sev: "notice", cat: "ia", titulo: "Bloqueás bots de entrenamiento de IA", porQue: "Es una decisión válida (no afecta aparecer en búsquedas ni en ChatGPT/Claude/Perplexity search). Te lo mostramos para que sea consciente.", como: ["Si querés que los modelos aprendan de tu contenido (marca, specs), permitilos; si no, dejalo como está"], recurso: { titulo: "Google-Extended y otros crawlers", href: G("crawling-indexing/google-common-crawlers") }, esfuerzo: 1, confianza: "media" },
  robots_ausente: { sev: "notice", cat: "indexacion", titulo: "El sitio no tiene robots.txt", porQue: "No es obligatorio, pero es donde declarás el sitemap y los bots permitidos.", como: ["Publicá /robots.txt con 'User-agent: *', 'Allow: /' y la línea 'Sitemap: https://tusitio/sitemap.xml'"], recurso: { titulo: "Crear un robots.txt", href: G("crawling-indexing/robots/create-robots-txt") }, esfuerzo: 1, confianza: "media" },
  sitemap_ausente: { sev: "warning", cat: "indexacion", titulo: "No encontramos el sitemap", porQue: "El sitemap ayuda a Google y Bing a descubrir páginas nuevas y cambios (y alimenta IndexNow).", como: ["Generá /sitemap.xml (la mayoría de los CMS lo hacen solos)", "Declaralo en robots.txt y envialo en Search Console → Sitemaps"], recurso: { titulo: "Crear y enviar un sitemap", href: G("crawling-indexing/sitemaps/build-sitemap") }, esfuerzo: 1, confianza: "alta" },
  sitemap_invalido: { sev: "warning", cat: "indexacion", titulo: "El sitemap no es un XML válido", porQue: "Un sitemap que no se puede leer se ignora.", como: ["Validá el archivo (debe empezar con <urlset> o <sitemapindex>)", "Revisá que el servidor lo sirva como XML y sin HTML de error"], recurso: { titulo: "Formato del sitemap", href: G("crawling-indexing/sitemaps/build-sitemap") }, esfuerzo: 1, confianza: "alta" },
  title_falta: { sev: "error", cat: "contenido", titulo: "Páginas sin título (title)", porQue: "El título es lo primero que ve la gente en Google y uno de los elementos que más pesa en el clic.", como: ["Escribí un title único por página, con la búsqueda principal al inicio y la marca al final", "Largo recomendado: 30-60 caracteres"], recurso: { titulo: "Títulos en los resultados", href: G("appearance/title-link") }, esfuerzo: 1, confianza: "alta" },
  title_largo: { sev: "notice", cat: "contenido", titulo: "Títulos demasiado largos (>65 caracteres)", porQue: "Google los corta y puede reescribirlos; lo importante queda oculto.", como: ["Acortá a ~60 caracteres dejando la búsqueda principal adelante"], recurso: { titulo: "Títulos en los resultados", href: G("appearance/title-link") }, esfuerzo: 1, confianza: "media" },
  title_corto: { sev: "notice", cat: "contenido", titulo: "Títulos demasiado cortos (<15 caracteres)", porQue: "Un título mínimo no describe la página ni aprovecha las búsquedas que puede captar.", como: ["Sumá el producto/categoría y un diferencial (ej. 'Lavarropas inverter 8 kg | Marca')"], recurso: { titulo: "Títulos en los resultados", href: G("appearance/title-link") }, esfuerzo: 1, confianza: "media" },
  title_duplicado: { sev: "warning", cat: "contenido", titulo: "Títulos duplicados entre páginas", porQue: "Dos páginas con el mismo título compiten entre sí y confunden a Google sobre cuál mostrar.", como: ["Hacé cada título único y específico de su página", "Si son la misma página con variantes, unificá con canonical"], recurso: { titulo: "Títulos en los resultados", href: G("appearance/title-link") }, esfuerzo: 1, confianza: "alta" },
  description_falta: { sev: "warning", cat: "contenido", titulo: "Páginas sin meta description", porQue: "Sin descripción, Google arma el fragmento con texto de la página que puede no invitar al clic.", como: ["Escribí 120-160 caracteres con el beneficio y una llamada a la acción (envío, cuotas, garantía)"], recurso: { titulo: "Fragmentos y meta description", href: G("appearance/snippet") }, esfuerzo: 1, confianza: "media" },
  description_larga: { sev: "notice", cat: "contenido", titulo: "Meta descriptions de más de 160 caracteres", porQue: "Se cortan en el resultado.", como: ["Resumí a ~155 caracteres con lo más importante adelante"], recurso: { titulo: "Fragmentos y meta description", href: G("appearance/snippet") }, esfuerzo: 1, confianza: "baja" },
  description_duplicada: { sev: "notice", cat: "contenido", titulo: "Meta descriptions duplicadas", porQue: "Descripciones repetidas no diferencian a cada página en el resultado.", como: ["Escribí una descripción propia para cada página importante"], recurso: { titulo: "Fragmentos y meta description", href: G("appearance/snippet") }, esfuerzo: 1, confianza: "media" },
  h1_falta: { sev: "warning", cat: "estructura", titulo: "Páginas sin encabezado H1", porQue: "El H1 le dice a la gente (y a los buscadores y asistentes de IA) de qué trata la página.", como: ["Agregá un H1 visible con el tema principal de la página (uno solo)"], recurso: { titulo: "Guía de inicio de SEO", href: G("fundamentals/seo-starter-guide") }, esfuerzo: 1, confianza: "media" },
  h1_multiple: { sev: "notice", cat: "estructura", titulo: "Páginas con varios H1", porQue: "No es un error para Google, pero diluye la jerarquía del contenido.", como: ["Dejá un H1 y pasá los demás a H2"], recurso: { titulo: "Guía de inicio de SEO", href: G("fundamentals/seo-starter-guide") }, esfuerzo: 1, confianza: "baja" },
  canonical_falta: { sev: "notice", cat: "indexacion", titulo: "Páginas sin canonical", porQue: "Sin canonical, las variantes de URL (parámetros, mayúsculas, www) pueden competir entre sí.", como: ["Agregá <link rel=\"canonical\" href=\"URL-propia\"> en cada página"], recurso: { titulo: "Consolidar URLs duplicadas", href: G("crawling-indexing/consolidate-duplicate-urls") }, esfuerzo: 1, confianza: "media" },
  canonical_otra: { sev: "warning", cat: "indexacion", titulo: "Páginas con tráfico que apuntan su canonical a otra URL", porQue: "Le estás diciendo a Google que la versión 'buena' es otra: esta página puede dejar de mostrarse.", como: ["Si la página debe posicionar por sí misma, hacé que el canonical apunte a sí misma", "Si es un duplicado real, está bien: verificá que la canonical sea la que querés posicionar"], recurso: { titulo: "Consolidar URLs duplicadas", href: G("crawling-indexing/consolidate-duplicate-urls") }, esfuerzo: 1, confianza: "alta" },
  redireccion: { sev: "notice", cat: "estructura", titulo: "Páginas top que redirigen", porQue: "Search Console reporta tráfico en una URL que ahora redirige: los enlaces internos y el sitemap deberían apuntar al destino final.", como: ["Actualizá enlaces internos y sitemap a la URL final", "Evitá cadenas de redirecciones"], recurso: { titulo: "Redirecciones y Google", href: G("crawling-indexing/301-redirects") }, esfuerzo: 1, confianza: "media" },
  sin_viewport: { sev: "warning", cat: "rendimiento", titulo: "Páginas sin meta viewport (no adaptadas a mobile)", porQue: "Google indexa la versión mobile; sin viewport la página se ve mal en el celular.", como: ["Agregá <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">"], recurso: { titulo: "Indexación mobile-first", href: G("crawling-indexing/mobile/mobile-sites-mobile-first-indexing") }, esfuerzo: 1, confianza: "alta" },
  sin_lang: { sev: "notice", cat: "internacional", titulo: "Páginas sin idioma declarado (<html lang>)", porQue: "Ayuda a buscadores, lectores de pantalla y asistentes de IA a entender el idioma y país.", como: ["Agregá lang=\"es-AR\" (o el que corresponda) en la etiqueta <html>"], recurso: { titulo: "Sitios multilingües", href: G("specialty/international/managing-multi-regional-sites") }, esfuerzo: 1, confianza: "baja" },
  hreflang_invalido: { sev: "warning", cat: "internacional", titulo: "hreflang con códigos inválidos o sin autorreferencia", porQue: "Un hreflang mal armado se ignora y el país equivocado puede recibir la versión equivocada.", como: ["Usá códigos ISO (es, es-AR, en-US) y x-default", "Cada página debe listarse a sí misma entre sus alternates"], recurso: { titulo: "Versiones localizadas (hreflang)", href: G("specialty/international/localized-versions") }, esfuerzo: 2, confianza: "alta" },
  schema_falta: { sev: "notice", cat: "datos", titulo: "Páginas sin datos estructurados (schema.org)", porQue: "Los datos estructurados habilitan resultados enriquecidos (precio, stock, reseñas) y Merchant listings. No hay schema especial 'para IA'.", como: ["Sumá JSON-LD Organization en la home y Product/Offer (precio, moneda, disponibilidad) en las fichas", "Validalo con la Prueba de resultados enriquecidos"], recurso: { titulo: "Datos estructurados", href: G("appearance/structured-data/intro-structured-data") }, esfuerzo: 2, confianza: "media" },
  schema_invalido: { sev: "warning", cat: "datos", titulo: "JSON-LD que no se puede leer", porQue: "Un bloque de datos estructurados con error de sintaxis se descarta completo.", como: ["Corregí el JSON (comas, comillas) y validalo con la Prueba de resultados enriquecidos"], recurso: { titulo: "Prueba de resultados enriquecidos", href: "https://search.google.com/test/rich-results" }, esfuerzo: 1, confianza: "alta" },
  contenido_js: { sev: "warning", cat: "ia", titulo: "Páginas con muy poco texto en el HTML (se arma con JavaScript)", porQue: "Los bots de IA (y a veces Google) leen el HTML sin ejecutar JavaScript: si el contenido clave no está en el HTML, no lo ven ni lo citan.", como: ["Serví el contenido principal renderizado del lado del servidor (SSR/SSG)", "Asegurate de que título, descripción, specs y precio estén en el HTML inicial"], recurso: { titulo: "JavaScript y SEO", href: G("crawling-indexing/javascript/javascript-seo-basics") }, esfuerzo: 3, confianza: "media" },
  cwv_lcp_malo: { sev: "error", cat: "rendimiento", titulo: "Carga lenta: LCP > 4 s (usuarios reales, p75)", porQue: "El elemento principal tarda más de 4 s en aparecer para 1 de cada 4 visitas: más rebote y menos conversión (CWV es una señal de ranking chica; el costo mayor es de negocio).", como: ["Optimizá la imagen principal (WebP/AVIF, tamaño justo, fetchpriority=high, sin lazy-load arriba)", "Reducí el tiempo de respuesta del servidor (caché/CDN)", "Eliminá CSS/JS que bloquean el render"], recurso: { titulo: "Optimizar LCP", href: "https://web.dev/articles/optimize-lcp" }, esfuerzo: 3, confianza: "alta" },
  cwv_lcp_mejorable: { sev: "warning", cat: "rendimiento", titulo: "LCP mejorable (2,5-4 s)", porQue: "El umbral 'bueno' es 2,5 s al p75.", como: ["Priorizá la imagen/fuente principal y bajá su peso", "Revisá el TTFB del servidor"], recurso: { titulo: "Optimizar LCP", href: "https://web.dev/articles/optimize-lcp" }, esfuerzo: 2, confianza: "alta" },
  cwv_inp_malo: { sev: "error", cat: "rendimiento", titulo: "La página responde lento a los clics: INP > 500 ms", porQue: "La interfaz se traba al tocar botones o filtros (típico por scripts de terceros pesados).", como: ["Auditá los scripts de terceros (chat, tags, píxeles) y diferí los no críticos", "Partí tareas largas de JavaScript"], recurso: { titulo: "Optimizar INP", href: "https://web.dev/articles/optimize-inp" }, esfuerzo: 3, confianza: "alta" },
  cwv_inp_mejorable: { sev: "warning", cat: "rendimiento", titulo: "INP mejorable (200-500 ms)", porQue: "El umbral 'bueno' es 200 ms al p75.", como: ["Diferí scripts no críticos y reducí trabajo en los handlers de clic"], recurso: { titulo: "Optimizar INP", href: "https://web.dev/articles/optimize-inp" }, esfuerzo: 2, confianza: "alta" },
  cwv_cls_malo: { sev: "error", cat: "rendimiento", titulo: "La página 'salta' al cargar: CLS > 0,25", porQue: "Los elementos se mueven mientras la gente lee o toca: clics equivocados y frustración.", como: ["Reservá el espacio de imágenes, banners y embeds (width/height o aspect-ratio)", "No insertes contenido arriba del que ya se ve"], recurso: { titulo: "Optimizar CLS", href: "https://web.dev/articles/optimize-cls" }, esfuerzo: 2, confianza: "alta" },
  cwv_cls_mejorable: { sev: "warning", cat: "rendimiento", titulo: "CLS mejorable (0,1-0,25)", porQue: "El umbral 'bueno' es 0,1 al p75.", como: ["Reservá espacio para imágenes y anuncios; usá font-display: optional/swap con fuentes precargadas"], recurso: { titulo: "Optimizar CLS", href: "https://web.dev/articles/optimize-cls" }, esfuerzo: 2, confianza: "alta" },
  lab_lento: { sev: "notice", cat: "rendimiento", titulo: "Puntaje de rendimiento de laboratorio bajo (< 50)", porQue: "Sin datos de usuarios reales suficientes, el test de laboratorio (Lighthouse mobile) indica margen de mejora.", como: ["Abrí el informe de PageSpeed Insights de la URL y seguí las oportunidades de mayor ahorro"], recurso: { titulo: "PageSpeed Insights", href: "https://pagespeed.web.dev/" }, esfuerzo: 2, confianza: "media" },
};

// ── CWV ──────────────────────────────────────────────────────────────────────
export const CWV_UMBRAL = { lcp: [2500, 4000], inp: [200, 500], cls: [0.1, 0.25] } as const;
export type EstadoCwv = "bueno" | "mejorable" | "malo";
export interface CwvDato {
  url: string; fuente: "url" | "origen" | "lab" | null;
  lcpMs: number | null; inpMs: number | null; cls: number | null;
  perfScore: number | null; lcpLabMs: number | null;
}
export function estadoMetrica(m: "lcp" | "inp" | "cls", v: number | null): EstadoCwv | null {
  if (v == null || !Number.isFinite(v)) return null;
  const [b, p] = CWV_UMBRAL[m];
  return v <= b ? "bueno" : v <= p ? "mejorable" : "malo";
}
/** La página pasa CWV si pasan los TRES (con dato); null si falta alguno. */
export function pasaCwv(c: CwvDato): boolean | null {
  const e = [estadoMetrica("lcp", c.lcpMs), estadoMetrica("inp", c.inpMs), estadoMetrica("cls", c.cls)];
  if (e.some((x) => x == null)) return e.some((x) => x && x !== "bueno") ? false : null;
  return e.every((x) => x === "bueno");
}

/** Respuesta de PageSpeed Insights v5 → dato de campo (URL u origen) + laboratorio. */
export function parsePsi(url: string, j: unknown): CwvDato {
  const o = (j ?? {}) as Record<string, any>;
  const le = o.loadingExperience?.metrics ? o.loadingExperience : o.originLoadingExperience?.metrics ? o.originLoadingExperience : null;
  const origen = !!le && (le === o.originLoadingExperience || le.origin_fallback === true);
  const p = (k: string) => { const v = le?.metrics?.[k]?.percentile; return typeof v === "number" ? v : null; };
  const clsRaw = p("CUMULATIVE_LAYOUT_SHIFT_SCORE");
  const score = o.lighthouseResult?.categories?.performance?.score;
  const lcpLab = o.lighthouseResult?.audits?.["largest-contentful-paint"]?.numericValue;
  const hasField = p("LARGEST_CONTENTFUL_PAINT_MS") != null || p("INTERACTION_TO_NEXT_PAINT") != null;
  return {
    url, fuente: hasField ? (origen ? "origen" : "url") : typeof score === "number" ? "lab" : null,
    lcpMs: p("LARGEST_CONTENTFUL_PAINT_MS"), inpMs: p("INTERACTION_TO_NEXT_PAINT"),
    cls: clsRaw != null ? clsRaw / 100 : null,          // PSI da CLS × 100
    perfScore: typeof score === "number" ? Math.round(score * 100) : null,
    lcpLabMs: typeof lcpLab === "number" ? Math.round(lcpLab) : null,
  };
}
/** Respuesta de CrUX API (records:queryRecord) → dato de campo p75. */
export function parseCrux(url: string, j: unknown, origen: boolean): CwvDato {
  const m = ((j ?? {}) as { record?: { metrics?: Record<string, { percentiles?: { p75?: number | string } }> } }).record?.metrics ?? {};
  const v = (k: string) => { const x = m[k]?.percentiles?.p75; const n = typeof x === "string" ? Number(x) : x; return typeof n === "number" && Number.isFinite(n) ? n : null; };
  const lcp = v("largest_contentful_paint"), inp = v("interaction_to_next_paint"), cls = v("cumulative_layout_shift");
  return { url, fuente: lcp != null || inp != null || cls != null ? (origen ? "origen" : "url") : null, lcpMs: lcp, inpMs: inp, cls, perfScore: null, lcpLabMs: null };
}

// ── Motor de chequeos ────────────────────────────────────────────────────────
export interface Hallazgo { check: string; url: string | null; detalle: string }

const LANG_RE = /^(x-default|[a-z]{2,3}(-[a-z]{4})?(-([a-z]{2}|\d{3}))?)$/i;
export function chequearPagina(f: PageFacts): Hallazgo[] {
  const H: Hallazgo[] = [];
  const add = (check: string, detalle: string) => H.push({ check, url: f.url, detalle });
  if (f.status >= 400) { add("http_error", `Responde ${f.status}.`); return H; }
  const robots = `${f.robotsMeta ?? ""}, ${f.xRobots ?? ""}`.toLowerCase();
  if (/\bnoindex\b|\bnone\b/.test(robots)) add("noindex", `robots: ${robots.replace(/^,\s*|,\s*$/g, "")}`);
  if (/\bnosnippet\b|max-snippet\s*:\s*0\b/.test(robots)) add("nosnippet", `robots: ${robots.replace(/^,\s*|,\s*$/g, "")}`);
  if (f.redirected) add("redireccion", `Redirige a ${f.finalUrl}`);
  if (!f.title) add("title_falta", "Sin <title>.");
  else if (f.title.length > 65) add("title_largo", `${f.title.length} caracteres: “${f.title.slice(0, 80)}”`);
  else if (f.title.length < 15) add("title_corto", `${f.title.length} caracteres: “${f.title}”`);
  if (!f.metaDescription?.trim()) add("description_falta", "Sin meta description.");
  else if (f.metaDescription.length > 160) add("description_larga", `${f.metaDescription.length} caracteres.`);
  if (!f.h1.length) add("h1_falta", "Sin <h1>.");
  else if (f.h1.length > 1) add("h1_multiple", `${f.h1.length} H1.`);
  if (!f.canonical) add("canonical_falta", "Sin link rel=canonical.");
  else {
    let can = f.canonical;
    try { can = new URL(f.canonical, f.finalUrl).toString(); } catch { /* relativo raro */ }
    if (normU(can) !== normU(f.finalUrl)) add("canonical_otra", `canonical → ${can}`);
  }
  if (!f.viewport) add("sin_viewport", "Sin meta viewport.");
  if (!f.lang) add("sin_lang", "Sin atributo lang en <html>.");
  if (f.hreflang.length) {
    const malos = f.hreflang.filter((x) => !LANG_RE.test(x.lang)).map((x) => x.lang);
    const self = f.hreflang.some((x) => { try { return normU(new URL(x.href, f.finalUrl).toString()) === normU(f.finalUrl); } catch { return false; } });
    if (malos.length || !self) add("hreflang_invalido", [malos.length ? `códigos inválidos: ${malos.join(", ")}` : "", !self ? "no se incluye a sí misma" : ""].filter(Boolean).join(" · "));
  }
  if (f.schemaErrores) add("schema_invalido", `${f.schemaErrores} bloque(s) JSON-LD con error.`);
  if (!f.schemaTypes.length) add("schema_falta", "Sin JSON-LD ni microdata.");
  if (f.textChars < 400 && (f.contentType ?? "text/html").includes("html")) add("contenido_js", `Solo ${f.textChars} caracteres de texto en el HTML inicial.`);
  return H;
}

export function chequearCwv(c: CwvDato): Hallazgo[] {
  const H: Hallazgo[] = [];
  const who = c.fuente === "origen" ? " (dato del sitio completo: la URL no tiene tráfico suficiente en Chrome)" : "";
  const e = (m: "lcp" | "inp" | "cls", v: number | null, fmt: (x: number) => string) => {
    const s = estadoMetrica(m, v);
    if (s && s !== "bueno") H.push({ check: `cwv_${m}_${s}`, url: c.url, detalle: `${m.toUpperCase()} p75 = ${fmt(v!)}${who}` });
  };
  if (c.fuente === "url" || c.fuente === "origen") {
    e("lcp", c.lcpMs, (x) => `${(x / 1000).toFixed(1).replace(".", ",")} s`);
    e("inp", c.inpMs, (x) => `${Math.round(x)} ms`);
    e("cls", c.cls, (x) => x.toFixed(2).replace(".", ","));
  } else if (c.perfScore != null && c.perfScore < 50) H.push({ check: "lab_lento", url: c.url, detalle: `Lighthouse mobile ${c.perfScore}/100${c.lcpLabMs ? ` · LCP de laboratorio ${(c.lcpLabMs / 1000).toFixed(1).replace(".", ",")} s` : ""}` });
  return H;
}

export interface SitioInput {
  robots: { status: number; txt: string | null } | null;   // null = no se pudo pedir
  sitemap: { url: string; status: number; tipo: "urlset" | "index" | "invalido"; urls: number } | null;
  pages: PageFacts[];
}
export function chequearSitio(s: SitioInput): Hallazgo[] {
  const H: Hallazgo[] = [];
  const add = (check: string, detalle: string, url: string | null = null) => H.push({ check, url, detalle });
  if (s.robots && s.robots.status === 404) add("robots_ausente", "/robots.txt devuelve 404.");
  if (s.robots?.txt) {
    const r = parseRobots(s.robots.txt);
    if (!robotsAllows(r, "Googlebot", "/")) add("robots_bloquea_todo", "Googlebot no puede rastrear la home según robots.txt.");
    const acc = accesoBots(r);
    const iaBloq = acc.filter((b) => b.tipo === "ia_busqueda" && !b.permitido);
    if (iaBloq.length) add("bot_ia_bloqueado", `Bloqueados: ${iaBloq.map((b) => b.ua).join(", ")}.`);
    const trBloq = acc.filter((b) => b.tipo === "entrenamiento" && !b.permitido);
    if (trBloq.length) add("bot_entrenamiento_bloqueado", `Bloqueados: ${trBloq.map((b) => b.ua).join(", ")}.`);
  }
  if (!s.sitemap || s.sitemap.status >= 400) add("sitemap_ausente", s.sitemap ? `${s.sitemap.url} devuelve ${s.sitemap.status}.` : "Ni robots.txt lo declara ni existe /sitemap.xml.");
  else if (s.sitemap.tipo === "invalido") add("sitemap_invalido", `${s.sitemap.url} no es un sitemap XML.`);
  // Duplicados entre las páginas auditadas.
  const dup = (key: (p: PageFacts) => string | null, check: string) => {
    const by = new Map<string, string[]>();
    for (const p of s.pages) { if (p.status >= 400) continue; const k = key(p)?.trim().toLowerCase(); if (!k) continue; const a = by.get(k) ?? []; a.push(p.url); by.set(k, a); }
    for (const [k, urls] of by) if (urls.length > 1) for (const u of urls) add(check, `“${k.slice(0, 70)}” se repite en ${urls.length} páginas.`, u);
  };
  dup((p) => p.title, "title_duplicado");
  dup((p) => p.metaDescription, "description_duplicada");
  return H;
}

// ── Agregado por chequeo ─────────────────────────────────────────────────────
export interface AuditIssue {
  check: string; severidad: Severidad; categoria: CategoriaCheck;
  titulo: string; porQue: string; como: string[]; recurso: { titulo: string; href: string };
  urls: { url: string | null; detalle: string }[];
  paginasAfectadas: number; pctPaginas: number;
  clicksAfectados: number;            // clics de SC (90 días) de las páginas afectadas
  esfuerzo: NivelEsfuerzo; confianza: NivelConfianza;
}
const SEV_ORD: Record<Severidad, number> = { error: 0, warning: 1, notice: 2 };

export function agruparHallazgos(h: Hallazgo[], pages: PageFacts[]): AuditIssue[] {
  const total = Math.max(1, pages.length);
  const clicksDe = new Map(pages.map((p) => [p.url, p.clicks ?? 0]));
  const by = new Map<string, Hallazgo[]>();
  for (const x of h) { if (!CHECKS[x.check]) continue; const a = by.get(x.check) ?? []; a.push(x); by.set(x.check, a); }
  const out: AuditIssue[] = [];
  for (const [check, xs] of by) {
    const d = CHECKS[check];
    const urls = [...new Set(xs.map((x) => x.url).filter((u): u is string => !!u))];
    out.push({
      check, severidad: d!.sev, categoria: d!.cat, titulo: d!.titulo, porQue: d!.porQue, como: d!.como, recurso: d!.recurso,
      urls: xs.slice(0, 25).map((x) => ({ url: x.url, detalle: x.detalle })),
      paginasAfectadas: urls.length, pctPaginas: (urls.length / total) * 100,
      clicksAfectados: urls.reduce((s, u) => s + (clicksDe.get(u) ?? 0), 0),
      esfuerzo: d!.esfuerzo, confianza: d!.confianza,
    });
  }
  return out.sort((a, b) => SEV_ORD[a.severidad] - SEV_ORD[b.severidad] || b.clicksAfectados - a.clicksAfectados || b.paginasAfectadas - a.paginasAfectadas);
}

/** Salud del sitio (0-100): % de páginas auditadas sin errores, penalizado por errores de sitio. */
export function saludSitio(issues: AuditIssue[], paginas: number): number | null {
  if (!paginas) return null;
  const conError = new Set(issues.filter((i) => i.severidad === "error").flatMap((i) => i.urls.map((u) => u.url).filter(Boolean)));
  const errSitio = issues.filter((i) => i.severidad === "error" && i.urls.every((u) => !u.url)).length;
  return Math.max(0, Math.round(((paginas - conError.size) / paginas) * 100 - errSitio * 10));
}

export const shortUrl = (u: string) => { try { const x = new URL(u); const p = x.pathname + x.search; return p.length > 60 ? `${p.slice(0, 59)}…` : p || "/"; } catch { return u.slice(0, 60); } };

// ── Topes (Drean: fijos, override por env) ───────────────────────────────────
export const AUDIT_CAPS_DEFAULT = { paginas: 20, psi: 8 };
export function auditCaps(env: Record<string, string | undefined> = {}): { paginas: number; psi: number } {
  const n = (v: string | undefined, d: number, max: number) => { const x = Math.round(Number(v)); return v != null && v !== "" && Number.isFinite(x) && x > 0 ? Math.min(max, x) : d; };
  return { paginas: n(env.SEO_AUDIT_PAGINAS, AUDIT_CAPS_DEFAULT.paginas, 50), psi: n(env.SEO_AUDIT_PSI, AUDIT_CAPS_DEFAULT.psi, 20) };
}

/** Páginas a auditar: home + top por clics de SC (o landings de GA4), mismo host, sin duplicados. */
export function elegirPaginas(site: string, candidatas: { url: string; clicks?: number; impresiones?: number }[], cap: number): { url: string; clicks: number; impresiones: number }[] {
  let origin: URL;
  try { origin = new URL(/^https?:\/\//i.test(site) ? site : `https://${site}`); } catch { return []; }
  const host = origin.hostname.replace(/^www\./, "");
  const out: { url: string; clicks: number; impresiones: number }[] = [];
  const seen = new Set<string>();
  const push = (u: string, c = 0, i = 0) => {
    let x: URL;
    try { x = new URL(u, `https://${origin.hostname}`); } catch { return; }
    if (x.hostname.replace(/^www\./, "") !== host) return;
    x.protocol = "https:"; x.hash = "";
    const k = normU(x.toString());
    if (seen.has(k) || out.length >= cap) return;
    seen.add(k); out.push({ url: x.toString(), clicks: c, impresiones: i });
  };
  push(`https://${origin.hostname}/`);
  for (const c of [...candidatas].sort((a, b) => (b.clicks ?? 0) - (a.clicks ?? 0))) push(c.url, c.clicks ?? 0, c.impresiones ?? 0);
  return out;
}
