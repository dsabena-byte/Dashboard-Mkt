// Test de lib/ad-intensity (intensidad de pauta + cruce anuncio↔posteo). npx tsx scripts/ad-intensity.test.ts
import { brandIntensity, sustainedAds, matchAdsToPosts, groupCreatives, tokens, textSimilarity, type IntensityAd } from "../src/lib/ad-intensity";
let f = 0, p = 0; const ok = (n: string, c: boolean, i?: unknown) => { if (c) p++; else { f++; console.error("✗", n, i ?? ""); } };
const NOW = Date.parse("2026-09-24T12:00:00Z"); const d = (x: number) => new Date(NOW - x * 86_400_000).toISOString();
const ad = (id: string, body: string, days: number, plat = ["facebook", "instagram"]): IntensityAd => ({ id, body, startDate: d(days), firstSeen: d(0), active: true, platforms: plat, format: "Imagen" });

ok("tokens sin tildes ni stopwords", [...tokens("Más frescura para tu cocina")].join(",") === "frescura,cocina");
ok("similitud idéntica", textSimilarity(tokens("lavarropas inverter nuevo modelo eficiente"), tokens("lavarropas inverter nuevo modelo eficiente")) === 1);
ok("contención (post corto dentro del aviso)", textSimilarity(tokens("una nueva era está llegando drean prepara algo grande esta semana"), tokens("una nueva era llegando drean prepara algo grande")) >= 0.5);
ok("textos distintos", textSimilarity(tokens("heladera no frost gran capacidad"), tokens("cocina cuatro hornallas acero")) === 0);

const A = [ad("1", "Lavarropas inverter con 12 programas ahorro energia", 40), ad("2", "Lavarropas inverter con 12 programas y ahorro de energia", 35), ad("3", "Heladera no frost gran capacidad familia", 5)];
ok("agrupa versiones", groupCreatives(A).length === 2);
const bi = brandIntensity([{ marca: "X", own: false, ads: A }, { marca: "Y", own: false, ads: [ad("9", "Cocina acero inoxidable hornallas", 3, ["facebook"])] }, { marca: "Z", own: false, ads: [] }], NOW);
ok("X lidera con 100", bi[0]!.marca === "X" && bi[0]!.indice === 100, bi);
ok("Z sin avisos = 0", bi.find((b) => b.marca === "Z")!.indice === 0);
ok("sostenidos X = 2", bi[0]!.sostenidos === 2 && bi[0]!.creatividades === 2 && bi[0]!.lanzamientos30 === 1);
const s = sustainedAds([{ marca: "X", own: false, ads: A }], 5, NOW);
ok("sostenido top = 40 días con 2 versiones", s[0]!.dias === 40 && s[0]!.versiones === 2 && s[0]!.id === "1");

const posts = [{ copy: "Heladera no frost de gran capacidad para toda la familia 🥶", likes: 120, comentarios: 8, views: 0, fecha: "2026-09-19", url: "u1", red: "INSTAGRAM" }, { copy: "Sorteo aniversario", likes: 900, comentarios: 400, views: 0, fecha: "2026-09-01", url: "u2", red: "INSTAGRAM" }];
const m = matchAdsToPosts(A, posts);
ok("cruza heladera con su posteo", m["3"]?.likes === 120 && !m["1"], m);
console.log(`ad-intensity: ${p} OK, ${f} FAIL`); if (f) process.exit(1);
