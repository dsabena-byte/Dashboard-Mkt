// Scraper de competencia en código = mismas filas que n8n (+ merge sin pérdida).
// Correr: cd apps/web && npx tsx scripts/competencia-scraper.test.ts
import {
  tagInstagram, tagFacebook, mapToSocialRows, mergeSocialRow, normalizeWeb, webHasData, n8nAnalysisPrompt, parseAnalysisContent,
  pickPilarN8n, matchMarcaN8n, marcaPorPaginaFb, isApifyQuotaText, igApifyToca, SCRAPER_BRANDS, type Analysis,
} from "../src/lib/competencia-scraper-core";
import { getTenant } from "../src/lib/tenant/current";

let p = 0, f = 0;
function ok(name: string, cond: boolean, extra?: unknown) { if (cond) p++; else { f++; console.error("FALLA:", name, extra ?? ""); } }
const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

// ── config = tenant ──
ok("marcas del scraper = socialAccounts del tenant", eq([...SCRAPER_BRANDS], getTenant().socialAccounts.map((a) => a.key)));

// ── Tag Instagram (apify/instagram-scraper) ──
const igRaw = [
  { inputUrl: "https://www.instagram.com/whirlpoolarg/", shortCode: "Ddly8UGFfsp", url: "https://www.instagram.com/p/Ddly8UGFfsp/", caption: "Operativo Limpieza", hashtags: ["x"], timestamp: "2026-09-22T15:00:00.000Z", likesCount: 23, commentsCount: 7, type: "Sidecar", ownerUsername: "whirlpoolarg", displayUrl: "https://cdn/x.jpg", latestComments: [{ text: "hermoso" }, { text: "no anda" }], isPinned: false },
  { inputUrl: "https://www.instagram.com/philco.arg/", shortCode: "ABC", caption: "", timestamp: "2026-09-01T02:00:00.000Z", likesCount: "11", commentsCount: 0, type: "Video", videoPlayCount: 897, videoViewCount: 500, ownerUsername: "collab.creator", isPinned: true, images: ["https://cdn/i.jpg"] },
  { inputUrl: "x", caption: "sin url" },
];
const ig = tagInstagram(igRaw);
ok("IG: descarta sin shortCode/url", ig.length === 2);
ok("IG: url por shortCode", ig[1]!.url === "https://www.instagram.com/p/ABC/");
ok("IG: marca por inputUrl (collabs)", ig[1]!.brandFromInput === "philco.arg");
ok("IG: videoPlayCount antes que videoViewCount", ig[1]!.videoViewCount === 897);
ok("IG: pin = PAUTA", ig[1]!.isSponsored === true);
ok("IG: comentarios como texto", eq(ig[0]!.commentTexts, ["hermoso", "no anda"]));
ok("IG: imagen displayUrl / images[0]", ig[0]!.image === "https://cdn/x.jpg" && ig[1]!.image === "https://cdn/i.jpg");
ok("IG: followers 0 como n8n", ig[0]!.ownerFollowerCount === 0);

// ── Tag Facebook (facebook-posts-scraper) ──
const fb = tagFacebook([
  { url: "https://www.facebook.com/ElectroluxAR/posts/pfbid0nV", text: "Nueva heladera #frio #Electrolux", time: "2026-09-24T21:30:00.000Z", likes: 4, comments: 1, pageName: "Electrolux", facebookUrl: "https://www.facebook.com/ElectroluxAR" },
  { url: "https://www.facebook.com/reel/1609133210929045/", text: "", time: "2026-08-04T12:00:00.000Z", likes: 2, comments: 0, videoViewCount: 415, type: "Video", pageName: "Página rara", facebookUrl: "https://www.facebook.com/dreanargentina" },
]);
ok("FB: hashtags del texto", eq(fb[0]!.hashtags, ["frio", "Electrolux"]));
ok("FB: tipo default photo", fb[0]!.type === "photo");
ok("FB: inputPage", fb[1]!.inputPage === "https://www.facebook.com/dreanargentina");

// ── Parse + Map ──
const an = new Map<string, Analysis>([
  [ig[0]!.url, { url: ig[0]!.url, pilar: "Producto", sentimiento: { positivo: 50, negativo: 50, neutro: 0 } }],
  [ig[1]!.url, { url: ig[1]!.url, pilar: "Producto/Branding", sentimiento: { positivo: 100, negativo: 0, neutro: 0 } }],
  [fb[0]!.url, { url: fb[0]!.url, pilar: "Promo", sentimiento: null }],
  [fb[1]!.url, { url: fb[1]!.url, pilar: "Otra cosa", sentimiento: null }],
]);
const { rows, stats } = mapToSocialRows([...ig, ...fb], an, { marcas: SCRAPER_BRANDS, fromDate: "2026-01-01" });
const r0 = rows.find((r) => r.url === ig[0]!.url)!;
ok("map IG: fila completa como n8n", eq(r0, {
  red_social: "INSTAGRAM", url: "https://www.instagram.com/p/Ddly8UGFfsp/", pilar: "Producto", positivo: 50, negativo: 50, neutro: 0,
  likes: 23, comentarios: 7, engagement: null, fecha: "2026-09-22", tipo: "ORGÁNICO", marca: "whirlpoolarg", views: 0,
  content_type: "SIDECAR", thumbnail_url: "https://cdn/x.jpg", copy: "Operativo Limpieza", followers: 0,
}), r0);
const r1 = rows.find((r) => r.url === ig[1]!.url)!;
ok("map IG: sin comentarios → sentimiento null aunque el LLM lo invente", r1.positivo === null && r1.negativo === null);
ok("map IG: pilar combinado → primero válido", r1.pilar === "Producto");
ok("map IG: VIDEO, PAUTA, copy vacío → null", r1.content_type === "VIDEO" && r1.tipo === "PAUTA" && r1.copy === null && r1.likes === 11);
ok("map IG: fecha UTC (toISOString)", r1.fecha === "2026-09-01");
const f0 = rows.find((r) => r.url === fb[0]!.url)!;
ok("map FB: marca por nombre de página (prefijo)", f0.marca === "electroluxar" && f0.content_type === "IMAGE" && f0.positivo === null);
ok("map FB: sin fallback, página que no matchea se descarta (como n8n)", !rows.some((r) => r.url === fb[1]!.url) && stats.sinMarca === 1);
const conFb = mapToSocialRows(fb, an, { marcas: SCRAPER_BRANDS, fromDate: "2026-01-01", fbPageFallback: true });
const f1 = conFb.rows.find((r) => r.url === fb[1]!.url)!;
ok("map FB: fallback por Página pedida", f1?.marca === "dreanargentina" && conFb.stats.marcaPorPagina === 1, conFb);
ok("map FB: pilar inválido → Branding; video", f1?.pilar === "Branding" && f1?.content_type === "VIDEO" && f1?.views === 415);
const sinAn = mapToSocialRows(ig, new Map(), { marcas: SCRAPER_BRANDS, fromDate: "2026-01-01" });
ok("map: sin análisis se descarta (como n8n)", sinAn.rows.length === 0 && sinAn.stats.sinAnalisis === 2);
const viejo = mapToSocialRows(ig, an, { marcas: SCRAPER_BRANDS, fromDate: "2026-09-10" });
ok("map: anteriores a fromDate afuera", viejo.rows.length === 1 && viejo.stats.anteriores === 1);
ok("map: engagement con followers", mapToSocialRows([{ ...ig[0]!, ownerFollowerCount: 1000 }], an, { marcas: SCRAPER_BRANDS, fromDate: "2026-01-01" }).rows[0]!.engagement === 3);

// ── helpers ──
ok("pickPilar", pickPilarN8n("Promo") === "Promo" && pickPilarN8n("x/Influencer") === "Influencer" && pickPilarN8n(undefined) === "Branding");
ok("matchMarca", matchMarcaN8n("Whirlpool Argentina", SCRAPER_BRANDS) === "whirlpoolarg" && matchMarcaN8n("Philco Argentina", SCRAPER_BRANDS) === "philco.arg" && matchMarcaN8n("Samsung", SCRAPER_BRANDS) === null);
ok("marcaPorPaginaFb por url del post", marcaPorPaginaFb({ url: "https://www.facebook.com/GafaArgentina/posts/pfbid1" }) === "gafaargentina");
const pr = n8nAnalysisPrompt(ig);
ok("prompt n8n: formato y comentarios", pr.includes('"analysis"') && pr.includes('"comments":["hermoso","no anda"]') && pr.includes("NO NEGOCIABLES"));
ok("parse analysis", parseAnalysisContent('{"analysis":[{"url":"u","pilar":"Promo"},{"x":1}]}').length === 1 && parseAnalysisContent("nope").length === 0);

// ── merge sin pérdida ──
const ex = { url: "https://www.instagram.com/p/Ddly8UGFfsp/", red_social: "INSTAGRAM", marca: "whirlpoolarg", fecha: "2026-09-21", pilar: "Branding", positivo: 80, negativo: 20, neutro: 0, likes: 30, comentarios: 7, views: 100, engagement: null, tipo: "ORGÁNICO", content_type: "SIDECAR", thumbnail_url: "https://x.supabase.co/storage/v1/object/public/meta-thumbs/competencia/a.jpg", copy: "texto", followers: 154547 };
const m = mergeSocialRow(ex, r0);
ok("merge: contadores no bajan", m.likes === 30 && m.comentarios === 7 && m.views === 100);
ok("merge: followers del post se conservan y engagement se recalcula", m.followers === 154547 && m.engagement === Number(((37 / 154547) * 100).toFixed(3)));
ok("merge: fecha/pilar/miniatura espejada existentes ganan", m.fecha === "2026-09-21" && m.pilar === "Branding" && m.thumbnail_url === ex.thumbnail_url);
ok("merge: sentimiento nuevo gana si viene", m.positivo === 50 && m.negativo === 50);
const m2 = mergeSocialRow(ex, { ...r0, positivo: null, negativo: null, neutro: null, likes: 99 });
ok("merge: sin sentimiento nuevo conserva el anterior; likes suben", m2.positivo === 80 && m2.likes === 99);
ok("merge: nunca null sobre valor", Object.entries(mergeSocialRow(ex, { ...r0, copy: null, thumbnail_url: null })).every(([k, v]) => v != null || k === "engagement"));
ok("merge: likes ocultos (-1) se completan", mergeSocialRow({ ...ex, likes: -1 }, r0).likes === 23);
ok("merge: fila nueva = la de n8n", mergeSocialRow(undefined, r0) === r0);
ok("merge: miniatura CDN vieja se reemplaza por la nueva", mergeSocialRow({ ...ex, thumbnail_url: "https://cdn/old.jpg" }, r0).thumbnail_url === "https://cdn/x.jpg");

// ── SimilarWeb (forma real de radeance, 27-sep-2026) ──
const webRaw = [{ url: "https://tienda.gafa.com.ar", domain: "tienda.gafa.com.ar", totalVisits: 78292, bounceRate: 0.4020432313377087, pagesPerVisit: 3.0330069425665305, timeOnSite: 148.8069141896713, monthlyVisitsDateFormat: { "2026-06-01": 83351, "2026-07-01": 77731, "2026-08-01": 78292 }, website_traffic_by_country: [{ share: 0.95, country: "AR" }], topKeywords: [{ keyword: "gafa" }], searchTraffic: 0.62 },
  { domain: "shop.samsung.com", totalVisits: 0 }, { domain: "otro.com", totalVisits: 5 }];
const w = normalizeWeb(webRaw, "2026-09-27");
ok("web: fila como la de n8n", eq({ ...w[0], raw: undefined }, {
  fecha: "2026-09-27", competidor: "Gafa", dominio: "tienda.gafa.com.ar", visitas_estimadas: 78292, visitantes_unicos: null, bounce_rate: 0.402,
  pages_per_visit: 3.03, avg_visit_duration: 148.81, fuentes_trafico: null, paginas_top: { "2026-06-01": 83351, "2026-07-01": 77731, "2026-08-01": 78292 },
  paises_top: [{ share: 0.95, country: "AR" }], keywords_top: null, source: "apify_similarweb", raw: undefined,
}), w[0]);
ok("web: Samsung mapeado, sin dato no se escribe", w[1]!.competidor === "Samsung" && !webHasData(w[1]!));
ok("web: dominio desconocido → competidor = dominio (como n8n)", w[2]!.competidor === "otro.com");

// ── Apify sin cupo + cadencia ──
ok("cupo: 402", isApifyQuotaText(402, ""));
ok("cupo: 403 monthly usage hard limit", isApifyQuotaText(403, '{"error":{"type":"platform-feature-disabled","message":"Monthly usage hard limit exceeded"}}'));
ok("cupo: 403 de otra cosa no", !isApifyQuotaText(403, "actor is private"));
ok("cupo: 500 no", !isApifyQuotaText(500, "limit"));
const lunes = new Date("2026-09-28T07:05:00Z"), martes = new Date("2026-09-29T07:05:00Z");
ok("cadencia IG default lunes", igApifyToca(undefined, lunes) && !igApifyToca(undefined, martes));
ok("cadencia IG '*' diaria y CSV", igApifyToca("*", martes) && igApifyToca("2,5", martes));

console.log(`competencia-scraper: ${p} OK, ${f} fallas`);
if (f) process.exit(1);
