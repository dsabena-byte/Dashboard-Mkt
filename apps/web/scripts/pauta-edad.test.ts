import assert from "node:assert/strict";
import { normEdad, resumir, mejorMedio, type FilaEdad } from "../src/lib/pauta-edad";

assert.equal(normEdad("25-34"), "25-34");
assert.equal(normEdad("AGE_25_34"), "25-34");          // TikTok
assert.equal(normEdad("AGE_55_100"), "55+");           // TikTok
assert.equal(normEdad("AGE_RANGE_65_UP"), "55+");      // Google Ads
assert.equal(normEdad("AGE_RANGE_UNDETERMINED"), "Sin dato");
assert.equal(normEdad("65+"), "55+");                  // Meta / DV360
assert.equal(normEdad("Unknown"), "Sin dato");

const f = (medio: string, edad: string, tipo: string, spend: number, clicks: number, mes = "2026-10"): FilaEdad =>
  ({ medio, mes, pieza_id: `${medio}${edad}${tipo}`, edad, tipo, impresiones: 1000, clicks, video_completos: 0, interacciones: 0, spend });
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
console.log("pauta-edad OK");
