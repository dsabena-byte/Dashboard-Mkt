// Test del match por marca (lib/ad-library-shared, portado de BIP lib/ad-library-match) (palabra completa + Página de FB) y del uso de collation_count / tope
// en lib/ad-intensity. npx tsx scripts/ad-library-match.test.ts
import { matchesBrand, adBelongsToBrand, fbPageHandle } from "../src/lib/ad-library-shared";
import { brandIntensity, groupCreatives, groupVersions, sustainedAds, AD_LIBRARY_CAP, type IntensityAd } from "../src/lib/ad-intensity";
let f = 0, p = 0; const ok = (n: string, c: boolean, i?: unknown) => { if (c) p++; else { f++; console.error("✗", n, i ?? ""); } };

// Matching por palabra completa (antes: substring → "LG" matcheaba "Algo Lindo").
ok("LG por palabra", matchesBrand("LG Electronics Argentina", "LG") && !matchesBrand("Algo Lindo", "LG") && !matchesBrand("Blog de cocina", "LG"));
ok("página corta no matchea marca larga", !matchesBrand("Samsung", "Samsung Electronics"));
ok("acentos y mayúsculas", matchesBrand("CÓNFORT Hogar", "confort"));
ok("marca escrita junta/separada", matchesBrand("Whirlpool", "Whirl pool") && matchesBrand("Mercado Libre Argentina", "Mercado Libre"));
ok("contexto para marcas ambiguas", matchesBrand("Cocinas Florencia", "Florencia", ["cocinas"]) && !matchesBrand("Florencia Gómez", "Florencia", ["cocinas"]));
ok("retailer que menciona la marca no entra", !matchesBrand("Frávega", "Drean") && !matchesBrand("Tienda Mia", "Whirlpool"));

// Por Página de FB.
ok("handle desde URL", fbPageHandle("https://www.facebook.com/LGArgentina/") === "lgargentina" && fbPageHandle("@drean") === "drean" && fbPageHandle("https://m.facebook.com/profile.php?id=123") === "123");
ok("match por URL de la página aunque el nombre no coincida", adBelongsToBrand({ pageName: "LG Life's Good", pageUrl: "https://facebook.com/lgargentina" }, { marca: "LG Argentina", facebook: "https://www.facebook.com/LGArgentina" }));
ok("match por page id", adBelongsToBrand({ pageName: "Otra", pageId: "123" }, { marca: "Drean", facebook: "https://www.facebook.com/123" }));
ok("URL distinta cae al nombre", adBelongsToBrand({ pageName: "Drean Service", pageUrl: "https://facebook.com/dreanservice" }, { marca: "Drean", facebook: "drean" }) && !adBelongsToBrand({ pageName: "Frávega", pageUrl: "https://facebook.com/fravega" }, { marca: "Drean", facebook: "drean" }));

// collation_count: agrupa por collationId y cuenta versiones fuera de la muestra.
const NOW = Date.parse("2026-09-24T12:00:00Z"); const d = (x: number) => new Date(NOW - x * 86_400_000).toISOString();
const ad = (id: string, body: string, days: number, extra: Partial<IntensityAd> = {}): IntensityAd => ({ id, body, startDate: d(days), firstSeen: d(0), active: true, platforms: ["facebook", "instagram"], format: "Imagen", ...extra });
const col = [ad("1", "texto uno distinto", 40, { collationId: "c1", collationCount: 12 }), ad("2", "otro texto completamente diferente", 40, { collationId: "c1", collationCount: 12 }), ad("3", "heladera no frost", 5, { collationId: "c2", collationCount: 1 })];
const g = groupCreatives(col);
ok("agrupa por collationId aunque el texto difiera", g.length === 2 && g[0]!.length === 2);
ok("versiones = collation_count", groupVersions(g[0]!) === 12 && groupVersions(g[1]!) === 1);
const noCol = [ad("a", "lavarropas inverter doce programas ahorro energia", 40), ad("b", "lavarropas inverter doce programas ahorro de energia", 35)];
ok("sin collation: fallback Jaccard", groupCreatives(noCol).length === 1 && groupVersions(groupCreatives(noCol)[0]!) === 2);

const bi = brandIntensity([{ marca: "Col", own: false, ads: col }, { marca: "Sin", own: false, ads: noCol }], NOW);
const bc = bi.find((b) => b.marca === "Col")!;
ok("activos estimados con collation (12 + 1)", bc.activos === 13 && bc.muestra === 3 && bc.estimadoPorCollation, bc);
ok("sostenidos ponderados (el creativo de 40 días pesa 12)", bc.sostenidos === 12 && bc.lanzamientos30 === 1, bc);
ok("sustainedAds usa collation", sustainedAds([{ marca: "Col", own: false, ads: col }], 5, NOW)[0]!.versiones === 12);

// Tope por marca.
const many = Array.from({ length: AD_LIBRARY_CAP }, (_, i) => ad(`m${i}`, `mensaje numero ${i} unico ${"x".repeat(i % 5)} palabra${i}`, i));
const bt = brandIntensity([{ marca: "Grande", own: false, ads: many }, { marca: "Chica", own: false, ads: noCol }], NOW);
ok("marca topeada rotulada", bt.find((b) => b.marca === "Grande")!.topeado && !bt.find((b) => b.marca === "Chica")!.topeado);
ok("sin collation no se estima", !bt.find((b) => b.marca === "Grande")!.estimadoPorCollation && bt.find((b) => b.marca === "Grande")!.activos === AD_LIBRARY_CAP);

console.log(`ad-library-match: ${p} OK, ${f} FAIL`); if (f) process.exit(1);
