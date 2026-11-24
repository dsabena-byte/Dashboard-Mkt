import assert from "node:assert/strict";
import { normEdad, resumir, mejorMedio, rankingFormatos, cruzarMeta, formatoMeta, type FilaEdad } from "../src/lib/pauta-edad";

assert.equal(normEdad("25-34"), "25-34");
assert.equal(normEdad("AGE_25_34"), "25-34");          // TikTok
assert.equal(normEdad("AGE_55_100"), "55+");           // TikTok
assert.equal(normEdad("AGE_RANGE_65_UP"), "55+");      // Google Ads
assert.equal(normEdad("AGE_RANGE_UNDETERMINED"), "Sin dato");
assert.equal(normEdad("65+"), "55+");                  // Meta / DV360
assert.equal(normEdad("Unknown"), "Sin dato");

const f = (medio: string, edad: string, tipo: string, spend: number, clicks: number, mes = "2026-10"): FilaEdad =>
  ({ medio, mes, pieza_id: `${medio}${edad}${tipo}`, edad, formato: medio, estimado: false, tipo, impresiones: 1000, clicks, video_completos: 0, video_p50: 0, interacciones: 0, spend });
const filas = [
  f("Meta", "25-34", "video", 1000, 100),
  f("Meta", "25-34", "imagen", 500, 100),
  f("TikTok", "25-34", "video", 300, 60),
  f("Google Search", "35-44", "texto", 800, 40),
  f("Meta", "13-17", "video", 50, 5),           // menores: se ignoran
  f("Meta", "35-44", "imagen", 200, 50, "2026-09"),
];
const r = resumir(filas, { tipo: "todas" });
assert.deepEqual(r.edades, ["25-34", "35-44"]);
assert.deepEqual(r.medios, ["Meta", "TikTok", "Google Search"]);
assert.equal(r.total.spend, 2800);
assert.equal(r.celda("25-34", "Meta").clicks, 200);
// Mejor medio 25-34: TikTok $5/clic vs Meta $7,5.
assert.equal(mejorMedio(r, "25-34", "clicks")!.medio, "TikTok");
// Filtros: video y mes.
assert.equal(resumir(filas, { tipo: "video" }).celda("25-34", "Meta").spend, 1000);
assert.deepEqual(resumir(filas, { tipo: "todas", meses: ["2026-09"] }).edades, ["35-44"]);
// Meta: cruce edad × formato dentro de un anuncio (Reels 60% / Feed 40% de la inversión; 75% / 25% de los clics).
assert.equal(formatoMeta("instagram|instagram_reels"), "IG Reels");
const z = { tipo: null, impresiones: 0, clicks: 0, video_completos: 0, video_p50: 0, interacciones: 0, spend: 0 };
const cx = cruzarMeta(
  [{ ...z, edad: "25-34", spend: 600, clicks: 60, impresiones: 6000 }, { ...z, edad: "35-44", spend: 400, clicks: 20, impresiones: 4000 }],
  [{ ...z, ubicacion: "instagram|instagram_reels", spend: 600, clicks: 60, impresiones: 7000 }, { ...z, ubicacion: "instagram|feed", spend: 400, clicks: 20, impresiones: 3000 }],
);
const c = (e: string, fo: string) => cx.find((x) => x.edad === e && x.formato === fo)!;
assert.equal(c("25-34", "IG Reels").spend, 360);
assert.equal(c("25-34", "IG Reels").clicks, 45);
assert.equal(cx.reduce((a, x) => a + x.spend, 0), 1000); // se conserva el total
assert.ok(cx.every((x) => x.estimado));
// Una sola ubicación = exacto.
assert.ok(cruzarMeta([{ ...z, edad: "25-34", spend: 10 }], [{ ...z, ubicacion: "instagram|instagram_stories", spend: 10 }]).every((x) => !x.estimado && x.formato === "IG Stories"));
// Vista por formato vs por medio.
const fm: FilaEdad[] = cx.map((x) => ({ ...x, medio: "Meta", mes: "2026-10", pieza_id: "A", tipo: "video" }));
assert.deepEqual(resumir(fm, { tipo: "todas" }).medios.sort(), ["IG Feed", "IG Reels"]);
assert.deepEqual(resumir(fm, { tipo: "todas", por: "medio" }).medios, ["Meta"]);
assert.equal(resumir(fm, { tipo: "todas" }).pctEstimado, 1);
// Ranking de formatos por edad: más barato primero; fuera los de <5% de la inversión de la edad o <10 resultados.
const rk = rankingFormatos(r, "25-34", "clicks");
assert.deepEqual(rk.map((x) => x.formato), ["TikTok", "Meta"]);
assert.equal(rk[0]!.costo, 5);
const v50 = (fo: string, spend: number, p50: number): FilaEdad => ({ ...f("Meta", "18-24", "video", spend, 0), formato: fo, pieza_id: fo, video_p50: p50 });
const rv = resumir([v50("IG Reels", 1000, 500), v50("IG Stories", 1000, 200), v50("FB Feed", 20, 100), v50("IG Feed", 500, 5)], { tipo: "video" });
assert.deepEqual(rankingFormatos(rv, "18-24", "video_p50").map((x) => x.formato), ["IG Reels", "IG Stories"]); // FB Feed <5% inv., IG Feed <10 res.
console.log("pauta-edad OK");
