// Tests de los diferenciales de Redes (portados del SaaS hermano, sep-2026, adaptados a Drean):
// Business Discovery (parseo, URL canónica, rate limit, errores), fotos por edad (1/3/7 días) y ER a
// edad fija, FB orgánico vs pago (is_from_ads + heurística isPaidOutlier SIEMPRE activa), pauta probable
// de la competencia, temas (clustering + prompt), Stories (navegación, máximo, resumen), formatos y
// horarios propios, y señales nuevas.   cd apps/web && npx tsx scripts/redes-diferenciales.test.ts
import { parseBd, usagePct, classifyBdError, bdFieldsParam, normHandle, validHandle, bdPlan, canonIgUrl, socialContentType } from "../src/lib/ig-discovery-core";
import { bucketsFor, postKey, snapshotRows, erAtAge, maduracion, publishedMs, type AgeSnap } from "../src/lib/post-snapshots-core";
import { parseIsFromAds, paidShare, fbPaidDecision, viewsSplitTotals, readViewsSplit } from "../src/lib/fb-paid";
import { erComparablePorMarca, comparableEr, trendMaduro, probablePauta, pautaPorMarca, type CompPost } from "../src/lib/redes-competencia";
import { normTema, clusterTemas, temasPorMarca, temaGaps, temasExistentes, temasPrompt, parseTemas } from "../src/lib/redes-temas";
import { parseNavigation, mergeStoryMax, summarizeStories, storyFromRow, type StoryLite } from "../src/lib/ig-stories";
import { contPostFromRow, formatBenchmarks, bestTimes, formatoDe, slotDe, type ContPost } from "../src/lib/redes-contenido";
import { computeRedesSignals } from "../src/lib/signals/redes";
import type { CompetitorPost } from "../src/lib/signals/model";
let f = 0, p = 0; const ok = (n: string, c: boolean, i?: unknown) => { if (c) p++; else { f++; console.error("✗", n, i ?? ""); } };

// ── Business Discovery ──────────────────────────────────────────────────────
const fields = bdFieldsParam("@Marca.X", { limit: 80, after: "QVFI" });
ok("fields: handle normalizado + limit capado a 50 + cursor", fields.includes("username(marca.x)") && fields.includes("media.limit(50).after(QVFI)") && fields.includes("view_count"), fields);
ok("fields lite sin view_count", !bdFieldsParam("x", { lite: true }).includes("view_count"));
ok("normHandle desde URL", normHandle("https://www.instagram.com/Drean_Arg/?hl=es") === "drean_arg");
ok("validHandle rechaza inyección", !validHandle("a){x}") && validHandle("philco.arg"));
ok("plan diario 1×25 / full 2×50", bdPlan("daily").limit === 25 && bdPlan("daily").maxPages === 1 && bdPlan("full").maxPages === 2);
const bdJson = {
  business_discovery: {
    username: "rival", followers_count: 20000, media_count: 900,
    media: {
      data: [
        { id: "1", caption: "Receta de torta", like_count: 200, comments_count: 10, media_type: "VIDEO", media_product_type: "REELS", permalink: "https://www.instagram.com/reel/AAA111/", timestamp: "2026-09-20T15:00:00+0000", thumbnail_url: "https://x/t.jpg", view_count: 5000 },
        { id: "2", caption: "Sorteo", comments_count: 50, media_type: "CAROUSEL_ALBUM", media_product_type: "FEED", permalink: "https://www.instagram.com/p/BBB222/", timestamp: "2026-09-18T12:00:00+0000", media_url: "https://x/m.mp4" },
        { id: "3", caption: "viejo", like_count: 5, comments_count: 0, media_type: "IMAGE", media_product_type: "FEED", permalink: "https://www.instagram.com/p/CCC/", timestamp: "2025-12-31T12:00:00+0000" },
      ],
      paging: { cursors: { after: "NEXT" }, next: "https://graph..." },
    },
  },
};
const bd = parseBd(bdJson, "philco.arg", "2026-01-01");
ok("bd ok + seguidores", bd.ok && bd.followers === 20000 && bd.mediaCount === 900);
ok("bd: descarta posts < fromDate y avisa reachedFrom", bd.posts.length === 2 && bd.reachedFrom);
ok("bd: reel → REEL con views y ts", bd.posts[0]!.content_type === "REEL" && bd.posts[0]!.views === 5000 && bd.posts[0]!.ts === "2026-09-20T15:00:00+0000" && bd.posts[0]!.marca === "philco.arg");
ok("bd: likes ocultos → likes null (no 0)", bd.posts[1]!.likes === null && bd.likesOcultos === 1);
ok("bd: carrusel → SIDECAR, miniatura nunca mp4", bd.posts[1]!.content_type === "SIDECAR" && bd.posts[1]!.thumbnail_url === null);
ok("bd: cursor siguiente", bd.after === "NEXT");
ok("bd: respuesta sin business_discovery → ok:false", !parseBd({ id: "1" }, "X", null).ok);
ok("canonIgUrl: /reel/ → /p/ (formato del scraper)", canonIgUrl("https://www.instagram.com/reel/AAA111/") === "https://www.instagram.com/p/AAA111/" && canonIgUrl("https://www.instagram.com/p/BBB/?img=1") === "https://www.instagram.com/p/BBB/");
ok("socialContentType: REEL → VIDEO (vocabulario de social_posts)", socialContentType("REEL") === "VIDEO" && socialContentType("SIDECAR") === "SIDECAR");
ok("usage: toma el máximo de app y BUC", usagePct('{"call_count":12,"total_cputime":3,"total_time":40}', '{"123":[{"type":"instagram","call_count":81,"total_time":5}]}') === 81);
ok("usage: headers ilegibles → 0", usagePct("{no json", null) === 0);
ok("error: rate", classifyBdError(4, undefined, "Application request limit reached") === "rate" && classifyBdError(undefined, undefined, "User request limit reached") === "rate");
ok("error: no business", classifyBdError(110, 2207013, "Cannot find User") === "no_business");
ok("error: permiso", classifyBdError(10, undefined, "Application does not have permission") === "permiso");
ok("error: campo", classifyBdError(100, undefined, "Tried accessing nonexisting field (view_count)") === "campo");

// ── Fotos por edad ─────────────────────────────────────────────────────────
ok("buckets: 30 h → 1 día", JSON.stringify(bucketsFor(30)) === "[1]");
ok("buckets: 50 h → ninguna", bucketsFor(50).length === 0);
ok("buckets: 100 h → 3 días", JSON.stringify(bucketsFor(100)) === "[3]");
ok("buckets: 200 h → 7 días; 250 h → ninguna", JSON.stringify(bucketsFor(200)) === "[7]" && bucketsFor(250).length === 0);
ok("buckets: negativos/NaN → []", bucketsFor(-1).length === 0 && bucketsFor(NaN).length === 0);
ok("postKey: /reel/ y /p/ del mismo shortcode", postKey("https://www.instagram.com/reel/AAA111/") === postKey("https://instagram.com/p/AAA111") && postKey("https://www.instagram.com/marca/p/AAA111/?img=1") === "ig:AAA111");
ok("postKey: URL de FB normalizada", postKey("https://m.facebook.com/page/posts/123?x=1") === "facebook.com/page/posts/123");
ok("publishedMs: fecha sola → mediodía AR", publishedMs(null, "2026-09-01") === Date.parse("2026-09-01T15:00:00Z"));
const obs = new Date("2026-09-27T12:00:00Z");
const rows = snapshotRows([
  { marca: "A", red: "INSTAGRAM", url: "https://www.instagram.com/p/X1/", ts: "2026-09-26T06:00:00Z", likes: 10, comentarios: 1, followers: 1000 }, // 30 h → 1
  { marca: "A", red: "INSTAGRAM", url: "https://www.instagram.com/p/X2/", ts: "2026-09-19T12:00:00Z", likes: 50, comentarios: 5, followers: 1000, views: 0 }, // 192 h → 7
  { marca: "A", red: "INSTAGRAM", url: "https://www.instagram.com/p/X3/", ts: "2026-09-01T12:00:00Z", likes: 50, comentarios: 5, followers: 1000 }, // viejo → nada
], obs);
ok("snapshotRows: una fila por post en ventana", rows.length === 2 && rows[0]!.edad === 1 && rows[1]!.edad === 7 && rows[1]!.post === "ig:X2", rows);
ok("snapshotRows: views 0 → null, seguidores del momento", rows[1]!.views === null && rows[1]!.followers === 1000);
// Fila del scraper fotografiada con su updated_at: scrape al día siguiente → foto a 1 día.
const scr = snapshotRows([{ marca: "gafaargentina", red: "INSTAGRAM", url: "https://www.instagram.com/p/Z9/", fecha: "2026-09-25", likes: 40, comentarios: 2, followers: 166000 }], new Date("2026-09-26T19:00:00Z"));
ok("snapshotRows: fila del scraper (fecha sola + updated_at) → 1 día", scr.length === 1 && scr[0]!.edad === 1, scr);

const snap = (marca: string, post: string, edad: 1 | 3 | 7, likes: number, fol: number | null = 10_000, red: AgeSnap["red"] = "INSTAGRAM"): AgeSnap => ({ marca, red, post, edad, horas: edad * 24 + 3, likes, comentarios: 0, views: null, followers: fol });
const S: AgeSnap[] = [
  snap("A", "a1", 7, 100), snap("A", "a2", 7, 120), snap("A", "a3", 7, 80), snap("A", "a1", 7, 999), // duplicado: gana el primero
  snap("B", "b1", 7, 300), snap("B", "b2", 7, 300),
  snap("C", "c1", 7, 50, null), snap("C", "c2", 7, 50, null), snap("C", "c3", 7, 50, null),
  snap("A", "a1", 1, 40), snap("A", "a2", 1, 60), snap("A", "a3", 1, 30), snap("A", "a1", 3, 80), snap("A", "a2", 3, 100), snap("A", "a3", 3, 60),
];
const e7 = erAtAge(S);
ok("erAtAge: A mediana 1% con 3 posts (dup ignorado)", e7.get("A")?.n === 3 && Math.abs((e7.get("A")?.value ?? 0) - 1) < 1e-9, e7.get("A"));
ok("erAtAge: B con 2 posts no alcanza el mínimo", !e7.has("B"));
ok("erAtAge: sin seguidores no cuenta", !e7.has("C"));
ok("erAtAge: filtro de red", erAtAge(S, 7, { red: "FACEBOOK" }).size === 0);
const mad = maduracion(S, "A");
ok("maduración: 1d 40 / 3d 80 / 7d 100 (40% y 80% del día 7)", !!mad && mad[0]!.interacciones === 40 && mad[1]!.pctDe7 === 80 && mad[2]!.pctDe7 === 100, mad);
ok("maduración: sin las 3 fotos → null", maduracion(S, "B") === null);

// ER comparable por marca (edad fija > maduro > preliminar).
const REF = "2026-09-20";
const day = (back: number) => new Date(Date.parse(`${REF}T00:00:00Z`) - back * 864e5).toISOString().slice(0, 10);
const cp = (marca: string, back: number, likes: number, extra: Partial<CompetitorPost> = {}): CompetitorPost => ({
  red_social: "INSTAGRAM", url: `https://www.instagram.com/p/${marca}${back}${likes}/`, marca, fecha: day(back), pilar: null, positivo: null, negativo: null, neutro: null, resumen_sentimiento: null,
  likes, comentarios: 0, views: 0, interacciones: likes, engagement: (likes / 10_000) * 100, tipo: "ORGÁNICO", content_type: "IMAGE", followers: 10_000, thumbnail_url: null, copy: null, ...extra,
});
const posts = [cp("A", 0, 5), cp("A", 1, 5), cp("A", 2, 5), cp("B", 10, 100), cp("B", 12, 100), cp("B", 14, 100)];
const withSnaps = erComparablePorMarca(posts, S, "all", REF);
ok("erComparable: A → edad_fija 1%", withSnaps.get("A")?.metodo === "edad_fija" && Math.abs(withSnaps.get("A")!.value - 1) < 1e-9, withSnaps.get("A"));
ok("erComparable: B sin fotos suficientes → maduro 1%", withSnaps.get("B")?.metodo === "maduro" && Math.abs(withSnaps.get("B")!.value - 1) < 1e-9, withSnaps.get("B"));
ok("erComparable sin fotos: A preliminar", erComparablePorMarca(posts, null, "all", REF).get("A")?.metodo === "preliminar");
// Un viral no mueve la mediana (el promedio sí): caso real Gafa sep-2026 (prom 4,9% vs mediana 0,03%).
const viral = [cp("G", 10, 30), cp("G", 11, 30), cp("G", 12, 30), cp("G", 13, 30), cp("G", 14, 90000)];
ok("comparableEr: mediana robusta a un sorteo viral", Math.abs(comparableEr(viral, REF).value - 0.3) < 1e-9 && comparableEr(viral, REF).metodo === "maduro");
const tr = trendMaduro([...posts, cp("B", 1, 999)], REF);
ok("trendMaduro: excluye posts < 7 días", tr.every((t) => t.values.A === undefined) && Math.abs((tr.find((t) => t.values.B != null)?.values.B ?? 0) - 1) < 1e-9, tr);

// ── FB orgánico vs pago ────────────────────────────────────────────────────
const formaA = { data: [{ name: "post_media_view", period: "lifetime", total_value: { value: 900, breakdowns: [{ dimension_keys: ["is_from_ads"], results: [{ dimension_values: ["0"], value: 300 }, { dimension_values: ["1"], value: 600 }] }] } }] };
const formaB = { data: [{ name: "post_media_view", period: "lifetime", values: [{ value: 298, is_from_ads: "0" }, { value: 600, is_from_ads: "1" }] }] };
const formaC = { data: [{ name: "post_media_view", period: "lifetime", values: [{ value: { "0": 50, "1": 0 } }] }] };
ok("is_from_ads forma A (total_value.breakdowns)", JSON.stringify(parseIsFromAds(formaA)) === '{"organic":300,"paid":600}');
ok("is_from_ads forma B (values con clave)", JSON.stringify(parseIsFromAds(formaB)) === '{"organic":298,"paid":600}');
ok("is_from_ads forma C (objeto)", JSON.stringify(parseIsFromAds(formaC)) === '{"organic":50,"paid":0}');
ok("is_from_ads: sin breakdown → null", parseIsFromAds({ data: [{ name: "post_media_view", values: [{ value: 900 }] }] }) === null && parseIsFromAds({}) === null);
ok("is_from_ads: lifetime manda sobre day", JSON.stringify(parseIsFromAds({ data: [
  { name: "post_media_view", period: "day", values: [{ value: 1, is_from_ads: "1" }] },
  { name: "post_media_view", period: "lifetime", values: [{ value: 10, is_from_ads: "0" }] },
] })) === '{"organic":10,"paid":0}');
ok("paidShare", paidShare({ organic: 300, paid: 600 }) === 600 / 900 && paidShare({ organic: 0, paid: 0 }) === null);
// Regla Drean: API O heurística (la heurística nunca se apaga).
ok("fbPaid: API ≥50% pago → pautado (api)", JSON.stringify(fbPaidDecision({ reach: 3000, reactions: 90, views_split: { organic: 1000, paid: 40_000 } })) === '{"paid":true,"source":"api"}');
ok("fbPaid: caso real 11-ago-2026 sin API → heurística", fbPaidDecision({ reach: 188_724, reactions: 23 }).paid && fbPaidDecision({ reach: 188_724, reactions: 23 }).source === "heuristica");
ok("fbPaid: API dice orgánico pero es outlier → SIGUE fuera (no se destapa)", fbPaidDecision({ reach: 60_000, reactions: 5, views_split: { organic: 58_000, paid: 2_000 } }).paid === true);
ok("fbPaid: post normal → orgánico", fbPaidDecision({ reach: 2500, reactions: 30, views_split: { organic: 900, paid: 100 } }).paid === false);
ok("viewsSplitTotals", JSON.stringify(viewsSplitTotals([{ views_split: { organic: 1000, paid: 40_000 } }, { views_split: { organic: 58_000, paid: 2_000 } }, {}])) === '{"organic":59000,"paid":42000,"posts":2}' && viewsSplitTotals([{}]) === null);
ok("readViewsSplit: defensivo", readViewsSplit({ organic: "5", paid: 3 })?.organic === 5 && readViewsSplit(null) === null && readViewsSplit({ organic: "x" }) === null);

// ── Pauta probable de la competencia ───────────────────────────────────────
const vid = (marca: string, i: number, views: number, likes: number, extra: Partial<CompetitorPost> = {}) => cp(marca, 20 + i, likes, { url: `u-${marca}-${i}`, views, content_type: "VIDEO", ...extra });
const R = [...Array.from({ length: 9 }, (_, i) => vid("R", i, 1000 + i * 10, 50)), vid("R", 20, 8000, 20), vid("R", 21, 4000, 40)];
const pp = probablePauta([...R, vid("S", 1, 100, 10, { tipo: "PAUTA" })]);
ok("pauta: outlier fuerte → alta", pp.get("u-R-20")?.nivel === "alta", pp.get("u-R-20"));
ok("pauta: outlier moderado → media", pp.get("u-R-21")?.nivel === "media", pp.get("u-R-21"));
ok("pauta: normales no se marcan", !pp.has("u-R-0") && !pp.has("u-R-8"));
ok("pauta: tipo PAUTA del scraper → alta aunque no haya base", pp.get("u-S-1")?.nivel === "alta");
ok("pauta: < 8 posts con views → sin estimación", probablePauta(R.slice(0, 5).concat(vid("R", 30, 90000, 1))).size === 0);
const pm = pautaPorMarca(R);
ok("pautaPorMarca", pm.length === 1 && pm[0]!.probables === 2 && pm[0]!.alta === 1 && pm[0]!.posts === 11, pm);
ok("pauta: likes -1 (ocultos) no restan interacciones", probablePauta([...R.slice(0, 9), vid("R", 40, 8000, -1)] as CompPost[]).get("u-R-40")?.nivel === "alta");

// ── Temas ───────────────────────────────────────────────────────────────────
ok("normTema: minúsculas, sin acentos ni signos, genéricos → null", normTema("  Lavado de Ropa! ") === "lavado de ropa" && normTema("Recetás") === "recetas" && normTema("Otro") === null && normTema("") === null);
const cl = clusterTemas(["recetas", "recetas", "recetas faciles", "lavado de ropa", "lavado ropa", "sorteo"]);
ok("cluster: 'lavado ropa' ≈ 'lavado de ropa'", cl.get("lavado ropa") === cl.get("lavado de ropa"), [...cl]);
ok("cluster: sorteo aparte", cl.get("sorteo") === "sorteo");
const T = (marca: string, i: number, tema: string, eng: number) => cp(marca, 10 + i, 1, { url: `t-${marca}-${i}`, tema, engagement: eng });
const tp = [
  T("Own", 1, "producto", 0.5), T("Own", 2, "producto", 0.5), T("Own", 3, "producto", 0.4), T("Own", 4, "sorteo", 0.6), T("Own", 5, "sorteo", 0.6),
  T("R1", 1, "recetas", 2), T("R1", 2, "recetas", 2.2), T("R2", 1, "recetas", 1.8), T("R2", 2, "Recetas", 2.1),
  T("R1", 3, "producto", 0.5), T("R2", 3, "producto", 0.4), T("R1", 4, "producto", 0.6), T("R2", 4, "sorteo", 0.5),
];
const tg = temaGaps(tp, "Own");
ok("temaGaps: 'recetas' rinde y Own no lo usa", tg.length === 1 && tg[0]!.tema === "recetas" && tg[0]!.marcas.length === 2, tg);
ok("temaGaps: < 5 posts propios con tema → []", temaGaps(tp.filter((x) => x.marca !== "Own" || x.url.endsWith("1")), "Own").length === 0);
const tpm = temasPorMarca(tp);
ok("temasPorMarca: top de Own = producto 60%", tpm.find((x) => x.marca === "Own")!.temas[0]!.tema === "producto" && tpm.find((x) => x.marca === "Own")!.temas[0]!.share === 60, tpm);
ok("temasExistentes: más frecuentes primero", temasExistentes(tp, 2)[0] === "producto");
const pr = temasPrompt([{ i: 1, marca: "gafaargentina", copy: "Receta\nde torta" }], ["recetas"]);
ok("prompt: pide JSON, lista existentes y numera", pr.includes('"temas"') && pr.includes("recetas") && pr.includes("1. [gafaargentina] Receta de torta"));
const pt = parseTemas('{"temas":[{"i":1,"tema":"Recetas!"},{"i":2,"tema":"otro"},{"i":"x","tema":"a"}]}');
ok("parseTemas: normaliza y descarta genéricos/índices inválidos", pt.get(1) === "recetas" && !pt.has(2) && pt.size === 1);
ok("parseTemas: basura → vacío", parseTemas("no json").size === 0);

// ── Stories ─────────────────────────────────────────────────────────────────
const nav = parseNavigation({ data: [{ name: "navigation", total_value: { value: 50, breakdowns: [{ dimension_keys: ["story_navigation_action_type"], results: [{ dimension_values: ["tap_forward"], value: 30 }, { dimension_values: ["tap_exit"], value: 12 }, { dimension_values: ["tap_back"], value: -1 }] }] } }] });
ok("parseNavigation: -1 (<5) → 0", nav?.tapsForward === 30 && nav?.exits === 12 && nav?.tapsBack === 0, nav);
ok("parseNavigation: sin navigation → null", parseNavigation({ data: [] }) === null);
const prev = { post_id: "1", reach: 500, video_views: 600, engagement: 5, clicks: 3, raw: { story: { replies: 2, nav: { exits: 10 } } } };
const next = { post_id: "1", reach: 0, video_views: 0, engagement: 0, clicks: 0, raw: { story: { replies: 0, nav: { exits: 4, tapsForward: 9 } } } };
const mg = mergeStoryMax(prev, next);
ok("mergeStoryMax: nunca pisa con menos (lectura fallida)", mg.reach === 500 && mg.video_views === 600 && mg.raw?.story?.replies === 2 && mg.raw?.story?.nav?.exits === 10 && mg.raw?.story?.nav?.tapsForward === 9, mg);
ok("mergeStoryMax: sin previo → lectura actual", mergeStoryMax(null, next) === next);
const lites: StoryLite[] = [
  storyFromRow({ post_id: "a", fecha_post: "2026-09-01T15:00:00Z", reach: 100, video_views: 120, raw: { story: { replies: 1, nav: { exits: 12 } } } }),
  storyFromRow({ post_id: "b", fecha_post: "2026-09-02T15:00:00Z", reach: 200, video_views: 240, raw: { story: { replies: 3, nav: { exits: 28 } } } }),
  storyFromRow({ post_id: "c", fecha_post: "2026-08-02T15:00:00Z", reach: 400, video_views: 480, raw: null }),
];
const sum = summarizeStories(lites)!;
ok("summarizeStories: total, mediana y 2 meses", sum.total === 3 && sum.alcanceMediana === 200 && sum.porMes.length === 2 && sum.porMes[0]!.mes === "Ago 26", sum);
ok("summarizeStories: tasas solo con dato (salida 40/360, respuesta 4/300)", sum.tasaSalida === Math.round((40 / 360) * 1000) / 10 && sum.tasaRespuesta === Math.round((4 / 300) * 1000) / 10 && sum.porMes[0]!.tasaSalida === null && sum.conNavegacion === 2, sum);
ok("summarizeStories: vacío → null", summarizeStories([]) === null);

// ── Formatos y horarios propios ─────────────────────────────────────────────
ok("formatoDe: IG FEED/REELS/STORY y FB photo/video/album", formatoDe("IG", "REELS") === "Reels" && formatoDe("IG", "FEED") === "Feed (imagen/carrusel)" && formatoDe("IG", "STORY") === "Stories" && formatoDe("FB", "photo") === "Imagen" && formatoDe("FB", "video") === "Video" && formatoDe("FB", "album") === "Carrusel");
ok("contPostFromRow: Stories afuera", contPostFromRow({ platform: "instagram", post_id: "s", fecha_post: "2026-09-01T12:00:00Z", media_type: "STORY", reach: 1, engagement: 1, reactions: 0, clicks: 0, video_views: 0 }) === null);
ok("contPostFromRow: FB interacciones = reacciones + com/comp + clicks", contPostFromRow({ platform: "facebook", post_id: "f", fecha_post: "2026-09-01T12:00:00Z", media_type: "photo", reach: 100, engagement: 2, reactions: 5, clicks: 3, video_views: 0 })?.eng === 10);
ok("slotDe: 2026-09-01 15:00Z = martes 12–18 h AR", JSON.stringify(slotDe(Date.parse("2026-09-01T15:00:00Z"))) === '{"dia":1,"franja":2}');
const NOW = new Date("2026-09-27T12:00:00Z");
const cpost = (red: "IG" | "FB", daysBack: number, formato: string, reach: number, eng: number, hourUtc = 15): ContPost => ({ red, id: `${red}${daysBack}${formato}${reach}`, ts: Date.parse(new Date(NOW.getTime() - daysBack * 864e5).toISOString().slice(0, 10) + `T${String(hourUtc).padStart(2, "0")}:00:00Z`), formato, reach, eng, saves: 0, views: 0 });
const own: ContPost[] = [
  ...Array.from({ length: 12 }, (_, i) => cpost("IG", 10 + i, "Reels", 2000, 60)),
  ...Array.from({ length: 12 }, (_, i) => cpost("IG", 10 + i, "Feed (imagen/carrusel)", 1000, 20)),
  cpost("IG", 2, "Reels", 999, 999), // inmaduro (<7 días) → afuera
  cpost("FB", 30, "Video", 5000, 500), // FB con <60 días → afuera
  ...Array.from({ length: 3 }, (_, i) => cpost("FB", 70 + i, "Video", 3000, 30)),
];
const fb = formatBenchmarks(own, NOW);
const reels = fb.find((x) => x.red === "IG" && x.formato === "Reels")!;
ok("formatos: IG Reels 12 maduros de 13, ER 3%", reels.nMaduros === 12 && reels.n === 13 && Math.abs(reels.erMed - 3) < 1e-9, reels);
ok("formatos: FB solo posts con 60+ días", fb.find((x) => x.red === "FB")?.nMaduros === 3 && fb.find((x) => x.red === "FB")?.muestraChica === true, fb);
const bt = bestTimes(own, NOW);
ok("horarios: base suficiente (27 maduros) y controlado por formato (todos índice 100)", bt.suficiente && bt.n === 27 && bt.cells.filter((c) => c.n > 0).every((c) => Math.abs((c.indice ?? 0) - 100) < 1e-9), bt.n);

// ── Señales nuevas ──────────────────────────────────────────────────────────
const compPosts = [...R, ...tp, ...Array.from({ length: 6 }, (_, i) => cp("Own", 30 + i, 50, { url: `own-${i}` }))];
const sig = computeRedesSignals({ competitor: { posts: compPosts, followers: [], ownBrand: "Own", snaps: S }, refDate: new Date("2026-09-27T12:00:00Z") });
ok("señal: competencia probablemente pauta", sig.some((s) => s.key === "redes_comp_pauta_probable" && s.titulo.includes("R")), sig.map((s) => s.key));
ok("señal: tema que rinde y no usás", sig.some((s) => s.key === "redes_comp_tema_gap" && s.titulo.includes("recetas")), sig.map((s) => s.key));
const fbTot = (o: number, pd: number) => ({ ok: true, name: "Drean", followers: 1, totals: { reach: 1, engagement: 1, postCount: 6, paidCount: 2, viewsOrganic: o, viewsPaid: pd, viewsSplitPosts: 6, paidByApi: 2, paidByHeuristic: 1 }, monthly: [], topPosts: [] });
const fbSig = computeRedesSignals({ fb: fbTot(4000, 6000), refDate: NOW });
ok("señal: FB 60% de vistas pagas", fbSig.some((s) => s.key === "redes_fb_paid_share" && s.titulo.includes("60")), fbSig.map((s) => s.titulo));
ok("señal FB: 10% pago → sin señal", !computeRedesSignals({ fb: fbTot(9000, 1000), refDate: NOW }).some((s) => s.key === "redes_fb_paid_share"));
// ER gap con base madura: Own 0,05% vs líder 1% → alerta con método informado.
const erPosts = [...Array.from({ length: 4 }, (_, i) => cp("Own", 10 + i, 5, { url: `o${i}` })), ...Array.from({ length: 4 }, (_, i) => cp("L", 10 + i, 100, { url: `l${i}` })), ...Array.from({ length: 4 }, (_, i) => cp("M", 10 + i, 50, { url: `m${i}` })), cp("M", 0, 50, { url: "m-hoy" })]; // post de hoy = fecha de referencia del dato
const gap = computeRedesSignals({ competitor: { posts: erPosts, followers: [], ownBrand: "Own" }, refDate: NOW }).find((s) => s.key === "redes_comp_er_gap");
ok("señal: ER gap con mediana madura + método", !!gap && gap.titulo.includes("L") && String(gap.datos.metodo).includes("7+"), gap);
const prelim = computeRedesSignals({ competitor: { posts: [cp("Own", 0, 5), cp("Own", 1, 5), cp("Own", 2, 5), ...erPosts.filter((x) => x.marca !== "Own")], followers: [], ownBrand: "Own" }, refDate: NOW });
ok("señal: sin base madura propia → sin señal de ER", !prelim.some((s) => s.key === "redes_comp_er_gap" || s.key === "redes_comp_er_leader"));

console.log(`redes-diferenciales: ${p} OK, ${f} fallas`);
if (f) process.exit(1);
