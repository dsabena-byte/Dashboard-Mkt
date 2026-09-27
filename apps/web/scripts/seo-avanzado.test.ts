// SEO/GEO avanzado (gaps G4-G7 de docs/estado-del-arte/seo-geo.md): Search Console a fondo
// (lib/sc-deep.ts), fuentes de IA (lib/llmo-fuentes.ts), evolución de keywords (lib/seo-kw-evolucion.ts),
// auditoría técnica + CWV (lib/seo-audit-core.ts) y señales (lib/signals/seo-avanzado.ts). Portado de BIP
// (sin IndexNow/Bing ni tarjeta de recomendación, que Drean no tiene) + ESoS/LLMO/propiedad SC de Drean.
// Correr: cd apps/web && npx tsx scripts/seo-avanzado.test.ts (sin red).
import { prefiltroCanibal, detectarCanibalizacion, detectarDecaimiento, analizarDispositivos, analyzeScDeep, normUrl } from "../src/lib/sc-deep";
import { dominioDe, clasificarDominio, extraerCitas, textoRespuesta, analizarFuentesIa, analizarFuentesAio } from "../src/lib/llmo-fuentes";
import { evolucionKeywords, type KwRankRow } from "../src/lib/seo-kw-evolucion";
import {
  parseRobots, robotsAllows, robotsMatch, accesoBots, parseSitemap, parseHtml, chequearPagina, chequearSitio, chequearCwv, agruparHallazgos,
  saludSitio, estadoMetrica, pasaCwv, parsePsi, parseCrux, auditCaps, elegirPaginas, CHECKS, type PageFacts,
} from "../src/lib/seo-audit-core";
import { computeSeoAvanzadoSignals } from "../src/lib/signals/seo-avanzado";
import type { ScQueryPage, ScRow } from "../src/lib/signals/model";
import { computeEsos } from "../src/lib/marca-indices";

let pass = 0, fail = 0;
const ok = (c: unknown, m: string) => { if (c) pass++; else { fail++; console.error("  ✗", m); } };
const qp = (query: string, page: string, impressions: number, clicks: number, position: number): ScQueryPage => ({ query, page, impressions, clicks, ctr: impressions ? (clicks / impressions) * 100 : 0, position });
const row = (key: string, clicks: number, impressions: number, position: number): ScRow => ({ key, clicks, impressions, ctr: impressions ? (clicks / impressions) * 100 : 0, position });

// ── 1. Canibalización ──
{
  const rows = [
    qp("lavarropas inverter", "https://x.com/lavarropas/", 600, 3, 6), qp("lavarropas inverter", "https://x.com/blog/inverter", 400, 1, 9),
    qp("heladera no frost", "https://x.com/heladeras", 950, 40, 4), qp("heladera no frost", "https://x.com/heladeras#top", 50, 1, 4), // mismo URL normalizado
    qp("cocina 4 hornallas", "https://x.com/cocinas", 900, 30, 5), qp("cocina 4 hornallas", "https://x.com/c2", 100, 1, 12),       // 2ª = 10% < 15%
    qp("marca x lavarropas", "https://x.com/", 800, 20, 4), qp("marca x lavarropas", "https://x.com/lavarropas", 400, 3, 6),    // de marca → excluida
    qp("secarropas", "https://x.com/s1", 60, 1, 8), qp("secarropas", "https://x.com/s2", 50, 1, 9),                                 // < 200 impr
    qp("freezer", "https://x.com/f1", 500, 100, 1.2), qp("freezer", "https://x.com/f2", 300, 20, 1.8),                              // pos media < 3
  ];
  ok(normUrl("https://x.com/a/#h") === "https://x.com/a", "normUrl saca fragmento y barra final");
  const pre = prefiltroCanibal(rows);
  ok(pre.every((r) => r.query !== "heladera no frost"), "prefiltro: URLs iguales normalizadas no cuentan como 2");
  ok(pre.some((r) => r.query === "lavarropas inverter"), "prefiltro conserva búsquedas con 2 URLs");
  const c = detectarCanibalizacion(rows, { ownBrand: "Marca X" });
  ok(c.length === 1 && c[0].query === "lavarropas inverter", `solo 'lavarropas inverter' (${c.map((x) => x.query).join(",")})`);
  ok(Math.round(c[0].segundaShare) === 40 && c[0].urls.length === 2, "share de la 2ª = 40%");
  ok(c[0].principal === "https://x.com/lavarropas/", "principal = mejor posición");
  ok(c[0].severidad === "alta" && c[0].clicksGanables > 0, "severidad alta (2ª ≥30%) y ganancia > 0");
  ok(Math.abs(c[0].posicionMedia - (600 * 6 + 400 * 9) / 1000) < 1e-9, "posición media ponderada por impresiones");
  ok(detectarCanibalizacion(rows, {}).some((x) => x.query === "marca x lavarropas"), "sin marca propia no se excluye");
}

// ── 2. Contenido que decae ──
{
  const prev = [row("https://x.com/a", 200, 5000, 4), row("https://x.com/b", 150, 4000, 5), row("https://x.com/c", 100, 3000, 6), row("https://x.com/d", 300, 800, 3), row("https://x.com/e", 120, 3000, 5), row("https://x.com/f", 100, 2000, 7)];
  const cur = [row("https://x.com/a", 100, 4800, 7), row("https://x.com/b", 100, 4000, 5), row("https://x.com/c", 50, 1500, 6), row("https://x.com/d", 10, 300, 9), row("https://x.com/e", 70, 2900, 5.2)];
  const yoy = [row("https://x.com/a", 190, 5000, 4), row("https://x.com/b", 110, 4000, 5), row("https://x.com/c", 90, 2800, 6), row("https://x.com/e", 130, 3000, 5)];
  const d = detectarDecaimiento(cur, prev, yoy);
  const by = new Map(d.map((x) => [x.page, x]));
  ok(by.get("https://x.com/a")?.causa === "ranking", "a: perdió posiciones (4 → 7)");
  ok(!by.has("https://x.com/b"), "b: −33% en 90d pero −9% interanual → estacional, no decae");
  ok(by.get("https://x.com/c")?.causa === "demanda", "c: misma posición, menos impresiones → demanda");
  ok(!by.has("https://x.com/d"), "d: < 1.000 impresiones previas → no se evalúa");
  ok(by.get("https://x.com/e")?.causa === "serp", "e: misma posición e impresiones, CTR cae → cambio de SERP");
  ok(by.get("https://x.com/f")?.clicks === 0 && by.get("https://x.com/f")?.sinInteranual === true, "f: desapareció (lista no truncada) → 0 clics, sin interanual");
  ok(!detectarDecaimiento(cur, prev, yoy, { truncado: 5 }).some((x) => x.page === "https://x.com/f"), "lista truncada: ausente ≠ 0 clics");
  ok(d[0].clicksPerdidos >= d[d.length - 1].clicksPerdidos, "orden por clics perdidos");
}

// ── 3. Dispositivos ──
{
  const a = analizarDispositivos([{ device: "MOBILE", clicks: 300, impressions: 20000, ctr: 1.5, position: 9 }, { device: "DESKTOP", clicks: 400, impressions: 10000, ctr: 4, position: 5 }], null);
  ok(a.filas[0].device === "MOBILE" && a.hallazgo?.tipo === "pos_mobile", "mobile rankea 4 posiciones peor → hallazgo");
  const b = analizarDispositivos([{ device: "MOBILE", clicks: 300, impressions: 20000, ctr: 1.5, position: 5 }, { device: "DESKTOP", clicks: 400, impressions: 10000, ctr: 4, position: 5 }], null);
  ok(b.hallazgo?.tipo === "ctr_mobile", "misma posición, CTR mobile muy bajo → hallazgo de CTR");
  ok(analizarDispositivos([], null).filas.length === 0, "sin datos → vacío");
  const deep = analyzeScDeep({ ok: true, queryPage: [] }, {});
  ok(deep.disponible === false, "snapshot viejo (sin campos nuevos) → disponible=false");
}

// ── 4. Fuentes de IA ──
{
  ok(dominioDe("https://www.Clarin.com/tecnologia/x?utm=1") === "clarin.com", "dominioDe normaliza");
  const dm = { propio: ["marca.com.ar"], competidores: ["rival.com"], retailers: ["tienda.com"] };
  ok(clasificarDominio("articulo.mercadolibre.com.ar", dm) === "retail", "ML = retail");
  ok(clasificarDominio("www.marca.com.ar", dm) === "propio" && clasificarDominio("rival.com", dm) === "competidor", "propio / competidor");
  ok(clasificarDominio("reddit.com", dm) === "ugc" && clasificarDominio("es.wikipedia.org", dm) === "referencia" && clasificarDominio("infobae.com", dm) === "medio", "UGC / referencia / medio");
  ok(clasificarDominio("argentina.gob.ar", dm) === "referencia", "gob = referencia");
  const cit = extraerCitas({ content: "Ver https://clarin.com/nota). Y [x](https://infobae.com/a?utm_source=chatgpt.com)", annotations: [{ type: "url_citation", url_citation: { url: "https://rtings.com/r?utm_source=chatgpt.com" } }, { type: "url_citation", url_citation: { url: "https://rtings.com/r" } }] });
  ok(cit.length === 3 && cit[0] === "https://rtings.com/r" && cit.every((u) => !/utm_/.test(u)), `extraerCitas dedup + sin utm (${cit.join(" ")})`);
  // Responses API (web_search): output[] con web_search_call + message → content[] output_text con annotations url_citation.
  const resp = {
    id: "resp_1", object: "response", status: "completed", model: "gpt-4.1-mini",
    output: [
      { type: "web_search_call", id: "ws_1", status: "completed", action: { type: "search", query: "mejor lavarropas argentina" } },
      { type: "message", id: "msg_1", role: "assistant", status: "completed", content: [
        { type: "output_text", text: "Drean y Whirlpool lideran ([infobae.com](https://infobae.com/x?utm_source=openai)). Ver también https://fravega.com/l.", annotations: [
          { type: "url_citation", start_index: 28, end_index: 80, url: "https://infobae.com/x?utm_source=openai", title: "Infobae" },
          { type: "url_citation", start_index: 90, end_index: 120, url: "https://www.drean.com.ar/lavarropas", title: "Drean" },
          { type: "file_citation", file_id: "f1", url: "https://ignorar.com/no" },
        ] },
      ] },
    ],
  };
  const rc = extraerCitas(resp);
  ok(rc.length === 3 && rc[0] === "https://infobae.com/x" && rc[1] === "https://www.drean.com.ar/lavarropas" && rc[2] === "https://fravega.com/l", `extraerCitas Responses (${rc.join(" ")})`);
  ok(textoRespuesta(resp).startsWith("Drean y Whirlpool lideran"), "textoRespuesta Responses");
  ok(textoRespuesta({ content: "hola" }) === "hola" && textoRespuesta({ output_text: "x" }) === "x" && textoRespuesta(null) === "", "textoRespuesta compat chat / output_text / null");
  ok(extraerCitas({ output: [{ type: "web_search_call" }] }).length === 0, "Responses sin message → sin citas");
  const ms = [
    { categoria: "lav", marcas: ["Rival"], fuentes: ["https://clarin.com/a", "https://rival.com/x"] },
    { categoria: "lav", marcas: ["Rival", "Otra"], fuentes: ["https://clarin.com/b", "https://reddit.com/r"] },
    { categoria: "lav", marcas: ["Marca", "Rival"], fuentes: ["https://marca.com.ar/p", "https://reddit.com/q"] },
    { categoria: "lav", marcas: ["Marca"], fuentes: [] },
    { categoria: "otra", marcas: ["Rival"], fuentes: ["https://clarin.com/c"] },
  ];
  const f = analizarFuentesIa(ms, "lav", "Marca", dm);
  ok(f.respuestas === 4 && f.respuestasConFuentes === 3, "respuestas y con fuentes (solo la categoría)");
  ok(f.citasTotales === 6 && f.citasPropias === 1 && Math.abs((f.citationSharePropio ?? 0) - 100 / 6) < 1e-9, "citation share propio = 1/6");
  ok(f.faltantes.length === 1 && f.faltantes[0].dominio === "clarin.com" && f.faltantes[0].soloCompetidores === 2, "gap source = clarin (reddit también te cita; rival.com es competidor)");
  const a = analizarFuentesAio([{ categoria: "lav", keyword: "k1", dominios: ["marca.com.ar", "clarin.com"] }, { categoria: "lav", keyword: "k2", dominios: ["clarin.com"] }], "lav", dm);
  ok(a.keywordsConAio === 2 && a.teCita === 1 && a.top[0].dominio === "clarin.com", "AIO: te cita en 1 de 2; clarin el más citado");
}

// ── 5. Evolución de keywords ──
{
  const R = (fecha: string, keyword: string, posicion: number | null, volumen = 1000): KwRankRow => ({ fecha, categoria: "lav", keyword, dominio: "marca.com.ar", marca: "Marca", posicion, url: null, volumen });
  const rows = [
    R("2026-08-03", "a", 15), R("2026-08-10", "a", 12), R("2026-08-17", "a", 8),       // entró al top-10
    R("2026-08-03", "b", 5), R("2026-08-10", "b", 9), R("2026-08-17", "b", 14),        // salió del top-10
    R("2026-08-03", "c", 20), R("2026-08-10", "c", 19), R("2026-08-17", "c", 19),      // estable
    R("2026-08-03", "d", 25), R("2026-08-17", "d", 16),                               // ganó 9
    R("2026-08-10", "e", 7), R("2026-08-17", "e", 6),                                 // nueva
    R("2026-08-03", "f", 3), R("2026-08-10", "f", 4),                                 // salió del universo → se ignora
    R("2026-08-03", "g", 12), R("2026-08-17", "g", null),                             // perdida
  ];
  const e = evolucionKeywords(rows);
  const by = new Map(e.keywords.map((k) => [k.keyword, k]));
  ok(e.semanas === 3 && e.desde === "2026-08-03" && e.hasta === "2026-08-17", "ventana");
  ok(by.get("a")?.estado === "entro_top10" && by.get("b")?.estado === "salio_top10", "entradas / salidas del top-10");
  ok(by.get("c")?.estado === "estable" && by.get("d")?.estado === "gano" && by.get("e")?.estado === "nueva", "estable / ganó / nueva");
  ok(!by.has("f"), "keyword fuera del universo actual se ignora");
  ok(by.get("g")?.estado === "perdida" && by.get("g")!.delta < 0, "perdida (dejó de rankear)");
  ok(e.entraronTop10 === 1 && e.salieronTop10 === 1, "conteo top-10");
  ok(e.ganadoras.some((k) => k.keyword === "a") && e.perdedoras.some((k) => k.keyword === "b"), "ganadoras / perdedoras");
  ok(e.visibilidad.length === 3 && e.visibilidad[0].top10 === 2 && e.visibilidad[2].top10 === 2, "visibilidad top-10 por semana");
  ok(by.get("a")!.serie.length === 3, "serie alineada a todas las fechas");
  ok(evolucionKeywords([R("2026-08-03", "a", 5)]).keywords.length === 0, "una sola foto → sin evolución");
}

// ── 6. robots.txt ──
{
  const txt = `# comentario
User-agent: *
Disallow: /admin
Allow: /admin/public

User-agent: GPTBot
User-agent: CCBot
Disallow: /

User-agent: OAI-SearchBot
Disallow: /

User-agent: PerplexityBot
Allow: /
Disallow: /checkout$

Sitemap: https://marca.com.ar/sitemap_index.xml`;
  const r = parseRobots(txt);
  ok(r.groups.length === 4 && r.sitemaps[0] === "https://marca.com.ar/sitemap_index.xml", "grupos y sitemap");
  ok(robotsAllows(r, "Googlebot", "/") && !robotsAllows(r, "Googlebot", "/admin/x") && robotsAllows(r, "Googlebot", "/admin/public/y"), "regla más larga gana (Allow más específico)");
  ok(!robotsAllows(r, "GPTBot", "/") && !robotsAllows(r, "CCBot", "/"), "grupo con varios user-agents");
  ok(!robotsAllows(r, "OAI-SearchBot", "/"), "OAI-SearchBot bloqueado");
  ok(robotsAllows(r, "PerplexityBot", "/admin") && !robotsAllows(r, "PerplexityBot", "/checkout") && robotsAllows(r, "PerplexityBot", "/checkout/x"), "grupo específico reemplaza a * y $ ancla");
  ok(robotsMatch("/*.pdf$", "/docs/a.pdf") > 0 && robotsMatch("/*.pdf$", "/docs/a.pdf?x") < 0, "comodín y $");
  ok(robotsAllows(parseRobots("User-agent: *\nDisallow:"), "Googlebot", "/"), "Disallow vacío = permitido");
  ok(robotsAllows(parseRobots("User-agent: googlebot\nDisallow: /"), "Googlebot-News", "/") === false, "googlebot-news cae al grupo googlebot");
  const acc = accesoBots(r);
  ok(acc.find((b) => b.ua === "OAI-SearchBot")?.permitido === false && acc.find((b) => b.ua === "Claude-SearchBot")?.permitido === true, "acceso por bot");
  ok(accesoBots(null).every((b) => b.permitido), "sin robots → todo permitido");
}

// ── 7. Sitemap + HTML + chequeos ──
{
  const sm = parseSitemap(`<?xml version="1.0"?><urlset xmlns="x"><url><loc>https://marca.com.ar/a</loc><lastmod>2026-09-20</lastmod></url><url><loc><![CDATA[https://marca.com.ar/b?x=1&amp;y=2]]></loc></url></urlset>`);
  ok(sm.tipo === "urlset" && sm.urls.length === 2 && sm.urls[1].loc === "https://marca.com.ar/b?x=1&y=2" && sm.urls[0].lastmod === "2026-09-20", "sitemap urlset con CDATA y entidades");
  ok(parseSitemap("<sitemapindex><sitemap><loc>https://m/s1.xml</loc></sitemap></sitemapindex>").tipo === "index", "sitemap índice");
  ok(parseSitemap("<html>404</html>").tipo === "invalido", "sitemap inválido");
  const html = `<!doctype html><html lang="es-AR"><head><title>Lavarropas Inverter 8 kg | Marca</title>
<meta name="description" content="Lavarropas con motor inverter, 8 kg, envío a todo el país y cuotas sin interés.">
<meta name="viewport" content="width=device-width"><meta name="robots" content="index, max-snippet:0">
<link rel="canonical" href="https://marca.com.ar/lavarropas-inverter"><link rel="alternate" hreflang="es-AR" href="https://marca.com.ar/lavarropas-inverter"><link rel="alternate" hreflang="espanol" href="https://marca.com.uy/x">
<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"Product","name":"L"},{"@type":"BreadcrumbList"}]}</script>
<script type="application/ld+json">{roto</script></head><body><h1>Lavarropas &amp; más</h1><h1>Otro</h1><p>${"texto ".repeat(120)}</p><script>var x="${"y".repeat(5000)}"</script></body></html>`;
  const f = parseHtml(html, { url: "https://marca.com.ar/lavarropas-inverter", status: 200 });
  ok(f.title === "Lavarropas Inverter 8 kg | Marca" && f.lang === "es-AR" && f.viewport, "title / lang / viewport");
  ok(f.h1.length === 2 && f.h1[0] === "Lavarropas & más", "h1 con entidades");
  ok(f.schemaTypes.includes("Product") && f.schemaTypes.includes("BreadcrumbList") && f.schemaErrores === 1, "JSON-LD @graph + bloque roto");
  ok(f.textChars > 500 && f.textChars < 1000, `texto visible sin scripts (${f.textChars})`);
  const H = chequearPagina(f).map((h) => h.check);
  ok(H.includes("nosnippet") && !H.includes("noindex"), "max-snippet:0 → nosnippet (Error GEO)");
  ok(H.includes("h1_multiple") && H.includes("schema_invalido") && H.includes("hreflang_invalido"), "h1 múltiple, JSON-LD roto, hreflang inválido");
  ok(!H.includes("canonical_otra") && !H.includes("canonical_falta") && !H.includes("title_falta"), "canonical propio y título OK");
  const js = parseHtml(`<html><head><title>x</title><link rel="canonical" href="/otra"></head><body><div id="root"></div><script src="app.js"></script></body></html>`, { url: "https://marca.com.ar/p", xRobots: "noindex" });
  const HJ = chequearPagina(js).map((h) => h.check);
  ok(HJ.includes("contenido_js") && HJ.includes("noindex") && HJ.includes("canonical_otra") && HJ.includes("title_corto") && HJ.includes("description_falta") && HJ.includes("h1_falta") && HJ.includes("sin_viewport") && HJ.includes("sin_lang") && HJ.includes("schema_falta"), `SPA vacía: ${HJ.join(",")}`);
  ok(chequearPagina({ ...js, status: 404 }).map((h) => h.check).join() === "http_error", "4xx → solo http_error");
  const S = chequearSitio({ robots: { status: 200, txt: "User-agent: *\nDisallow: /\nUser-agent: OAI-SearchBot\nDisallow: /" }, sitemap: null, pages: [f, { ...f, url: "https://marca.com.ar/otra" }] }).map((h) => h.check);
  ok(S.includes("robots_bloquea_todo") && S.includes("bot_ia_bloqueado") && S.includes("sitemap_ausente") && S.includes("title_duplicado"), `sitio: ${S.join(",")}`);
  ok(chequearSitio({ robots: { status: 404, txt: null }, sitemap: { url: "u", status: 200, tipo: "invalido", urls: 0 }, pages: [] }).map((h) => h.check).join() === "robots_ausente,sitemap_invalido", "robots ausente + sitemap inválido");
  for (const [k, c] of Object.entries(CHECKS)) ok(c.como.length > 0 && c.recurso.href.startsWith("https://") && c.porQue.length > 10, `catálogo completo: ${k}`);
}

// ── 8. CWV ──
{
  ok(estadoMetrica("lcp", 2500) === "bueno" && estadoMetrica("lcp", 2501) === "mejorable" && estadoMetrica("lcp", 4100) === "malo", "umbrales LCP");
  ok(estadoMetrica("inp", 200) === "bueno" && estadoMetrica("cls", 0.26) === "malo" && estadoMetrica("cls", null) === null, "umbrales INP / CLS");
  const psi = parsePsi("https://m/a", { loadingExperience: { id: "https://m/a", metrics: { LARGEST_CONTENTFUL_PAINT_MS: { percentile: 4200 }, INTERACTION_TO_NEXT_PAINT: { percentile: 150 }, CUMULATIVE_LAYOUT_SHIFT_SCORE: { percentile: 12 } } }, lighthouseResult: { categories: { performance: { score: 0.41 } }, audits: { "largest-contentful-paint": { numericValue: 5100.4 } } } });
  ok(psi.fuente === "url" && psi.lcpMs === 4200 && psi.cls === 0.12 && psi.perfScore === 41 && psi.lcpLabMs === 5100, "parsePsi (CLS ×100)");
  ok(pasaCwv(psi) === false, "no pasa (LCP malo)");
  const origen = parsePsi("https://m/b", { loadingExperience: { origin_fallback: true, metrics: { LARGEST_CONTENTFUL_PAINT_MS: { percentile: 2000 }, INTERACTION_TO_NEXT_PAINT: { percentile: 100 }, CUMULATIVE_LAYOUT_SHIFT_SCORE: { percentile: 5 } } } });
  ok(origen.fuente === "origen" && pasaCwv(origen) === true, "origin_fallback → origen; pasa");
  const lab = parsePsi("https://m/c", { lighthouseResult: { categories: { performance: { score: 0.3 } } } });
  ok(lab.fuente === "lab" && chequearCwv(lab).map((h) => h.check).join() === "lab_lento", "solo laboratorio → aviso lab_lento");
  const cw = chequearCwv(psi).map((h) => h.check);
  ok(cw.includes("cwv_lcp_malo") && cw.includes("cwv_cls_mejorable") && !cw.some((c) => c.startsWith("cwv_inp")), `chequeos CWV: ${cw.join(",")}`);
  const cr = parseCrux("https://m", { record: { metrics: { largest_contentful_paint: { percentiles: { p75: 1800 } }, cumulative_layout_shift: { percentiles: { p75: "0.02" } } } } }, true);
  ok(cr.fuente === "origen" && cr.cls === 0.02 && cr.inpMs === null && pasaCwv(cr) === null, "parseCrux (p75 string) sin INP → pasa desconocido");
}

// ── 9. Agregado y salud ──
{
  const P = (url: string, clicks: number): PageFacts => ({ ...parseHtml("<html><head><title>Página de prueba con título</title></head><body></body></html>", { url }), clicks });
  const pages = [P("https://m/", 500), P("https://m/a", 100), P("https://m/b", 0)];
  const h = [{ check: "noindex", url: "https://m/a", detalle: "robots: noindex" }, { check: "h1_falta", url: "https://m/", detalle: "" }, { check: "h1_falta", url: "https://m/b", detalle: "" }, { check: "bot_ia_bloqueado", url: null, detalle: "OAI" }, { check: "inexistente", url: null, detalle: "" }];
  const issues = agruparHallazgos(h, pages);
  ok(issues.length === 3 && issues[0].severidad === "error", "agrupa por chequeo, ignora desconocidos, errores primero");
  const noidx = issues.find((i) => i.check === "noindex")!;
  ok(noidx.paginasAfectadas === 1 && noidx.clicksAfectados === 100 && Math.round(noidx.pctPaginas) === 33, "páginas y clics afectados");
  ok(saludSitio(issues, 3) === Math.round((2 / 3) * 100) - 10, "salud = % sin error − 10 por error de sitio");
}

// ── 10. Topes y páginas ──
{
  ok(auditCaps().paginas === 20 && auditCaps().psi === 8, "topes default de Drean (20 páginas, 8 PSI)");
  ok(auditCaps({ SEO_AUDIT_PAGINAS: "80", SEO_AUDIT_PSI: "x" }).paginas === 50 && auditCaps({ SEO_AUDIT_PSI: "x" }).psi === 8, "override por env con tope");
  const sel = elegirPaginas("www.marca.com.ar", [{ url: "https://marca.com.ar/a", clicks: 5 }, { url: "https://www.marca.com.ar/b", clicks: 50 }, { url: "https://otro.com/x", clicks: 900 }, { url: "/c", clicks: 1 }, { url: "https://www.marca.com.ar/b#x", clicks: 1 }], 4);
  ok(sel.length === 4 && sel[0].url === "https://www.marca.com.ar/" && sel[1].url === "https://www.marca.com.ar/b" && !sel.some((s) => s.url.includes("otro.com")), `elegirPaginas: home + top por clics, mismo host (${sel.map((s) => s.url).join(" ")})`);
}

// ── 11. Señales ──
{
  const deep = analyzeScDeep({
    ok: true, queryPageMulti: [qp("lavarropas inverter", "https://x.com/a", 3000, 60, 6), qp("lavarropas inverter", "https://x.com/b", 2000, 20, 9)],
    pages: [row("https://x.com/p", 100, 4800, 8)], pagesPrev: [row("https://x.com/p", 400, 5000, 4)], pagesYoY: [row("https://x.com/p", 380, 5000, 4)],
    devices: [{ device: "MOBILE", clicks: 300, impressions: 20000, ctr: 1.5, position: 9 }, { device: "DESKTOP", clicks: 400, impressions: 10000, ctr: 4, position: 5 }],
  });
  const fuentes = [analizarFuentesIa(Array.from({ length: 12 }, (_, i) => ({ categoria: "lav", marcas: i % 3 === 0 ? ["Marca"] : ["Rival"], fuentes: i % 3 === 0 ? ["https://marca.com/a"] : ["https://clarin.com/a", "https://tomsguide.com/b"] })), "lav", "Marca", { propio: ["marca.com"] })];
  const s = computeSeoAvanzadoSignals({
    scDeep: deep, fuentes,
    audit: { issues: agruparHallazgos([{ check: "bot_ia_bloqueado", url: null, detalle: "OAI" }, { check: "title_largo", url: "https://x.com/", detalle: "" }], []), paginas: 5 },
  });
  const keys = s.map((x) => x.key);
  ok(keys.includes("seo_sc_canibalizacion") && keys.includes("seo_sc_decay") && keys.includes("seo_sc_device_pos_mobile"), `SC: ${keys.join(",")}`);
  ok(keys.includes("seo_audit_bot_ia_bloqueado") && !keys.includes("seo_audit_title_largo"), "auditoría: errores/advertencias sí, avisos no");
  ok(keys.includes("seo_ia_fuentes_gap_lav"), "fuentes de IA");
  ok(s.every((x) => x.dash === "seo-search" && x.acciones.length > 0), "todas accionables en seo-search");
  const dec = s.find((x) => x.key === "seo_sc_decay")!;
  ok(dec.impacto?.unidad === "clicks/mes" && dec.impacto.valor === 100, "impacto del decay = perdidos/3 por mes");
  ok(s[0].prioridad === "alta", "orden por prioridad");
  ok(computeSeoAvanzadoSignals({}).length === 0, "sin datos → sin señales");
  // Fuentes con pocas respuestas → no dispara.
  ok(computeSeoAvanzadoSignals({ fuentes: [{ ...fuentes[0], respuestasConFuentes: 5 }] }).length === 0, "fuentes con n<10 no disparan");
}


// ── 12. Drean: ESoS, LLMO insuficiente, propiedad de SC chica ──
{
  const meses = Array.from({ length: 8 }, (_, i) => `2026-0${i + 1}`);
  const esos = computeEsos(meses.map((mes) => ({ mes, valor: 10 })), meses.map((mes) => ({ mes, valor: 18 })));
  const s = computeSeoAvanzadoSignals({ esos: [{ categoria: "heladeras", label: "Refrigeración", res: esos }], llmoN: [{ categoria: "lavarropas", label: "Lavado", n: 5 }], scSite: "https://www.x.com/", scImpresionesMes: 835 });
  const keys = s.map((x) => x.key);
  ok(esos.lectura === "baja" && keys.includes("seo_esos_negativo_heladeras"), `ESoS −8 pp sostenido → señal negativa (${keys.join(",")})`);
  ok(s.find((x) => x.key === "seo_esos_negativo_heladeras")?.prioridad === "alta", "ESoS ≤ −5 pp = prioridad alta");
  ok(keys.includes("seo_llmo_muestra_insuficiente") && keys.includes("seo_sc_propiedad_chica"), "LLMO n<30 y propiedad de SC chica");
  ok(!computeSeoAvanzadoSignals({ llmoN: [{ categoria: "x", label: "X", n: 48 }], scSite: "s", scImpresionesMes: 50000 }).length, "n suficiente y SC grande → sin señales");
}

console.log(`seo-avanzado: ${pass} OK, ${fail} fallas`);
if (fail) process.exit(1);
