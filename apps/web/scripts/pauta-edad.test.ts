import assert from "node:assert/strict";
import { cruzarEdadFormato, resumir, mejorFormato, formatoDe, type FilaBreakdown } from "../src/lib/pauta-edad";

assert.equal(formatoDe("instagram|instagram_reels"), "IG Reels");
assert.equal(formatoDe("facebook|algo_nuevo"), "FB Otros");

const filas: FilaBreakdown[] = [
  // Anuncio A (video): 2 edades, 2 ubicaciones (60/40 de la inversión, 75/25 de los clics).
  { mes: "2026-10", ad_id: "A", dim: "edad", valor: "25-34", spend: 600, link_clicks: 60, impresiones: 6000 },
  { mes: "2026-10", ad_id: "A", dim: "edad", valor: "35-44", spend: 400, link_clicks: 20, impresiones: 4000 },
  { mes: "2026-10", ad_id: "A", dim: "ubicacion", valor: "instagram|instagram_reels", spend: 600, link_clicks: 60, impresiones: 7000 },
  { mes: "2026-10", ad_id: "A", dim: "ubicacion", valor: "instagram|feed", spend: 400, link_clicks: 20, impresiones: 3000 },
  // Anuncio B (imagen): una sola ubicación → exacto.
  { mes: "2026-10", ad_id: "B", dim: "edad", valor: "25-34", spend: 100, link_clicks: 50, impresiones: 2000 },
  { mes: "2026-10", ad_id: "B", dim: "ubicacion", valor: "instagram|instagram_stories", spend: 100, link_clicks: 50, impresiones: 2000 },
];
const celdas = cruzarEdadFormato(filas, (id) => id === "A");
const r = resumir(celdas, { tipo: "todas" });
// Totales exactos por edad y formato.
assert.equal(r.porEdad.get("25-34")!.spend, 700);
assert.equal(r.porFormato.get("IG Reels")!.link_clicks, 80 * 0.75);
assert.equal(r.total.spend, 1100);
// Cruce estimado: 25-34 en Reels = 600 × 0,6 de inversión y 60 × 0,75 de clics.
assert.equal(r.celda("25-34", "IG Reels").spend, 360);
assert.equal(r.celda("25-34", "IG Reels").link_clicks, 45);
assert.ok(Math.abs(r.pctExacto - 100 / 1100) < 1e-9);
// Filtro por tipo de pieza.
assert.deepEqual(resumir(celdas, { tipo: "imagen" }).formatos, ["IG Stories"]);
// Mejor formato 25-34: Stories ($2/clic) vs Reels ($8) vs Feed ($240/15 = $16).
assert.equal(mejorFormato(r, "25-34", "link_clicks")!.formato, "IG Stories");
console.log("pauta-edad OK");
