// npx tsx scripts/plan-otros-kpis.test.ts
import assert from "node:assert/strict";
import { baseMismoMes, efectoMes, otrosDefault, proyectarOtros, sanearOtros, type HistOtros } from "../src/lib/plan-otros-kpis";

const n = (xs: (number | null)[]) => xs;
// Base: mismo mes donde hay dato; los que faltan al final se pronostican (no quedan null).
const b = baseMismoMes(n([10, 20, 30, 40, 50, 60, 70, 80, 90, null, null, null]));
assert.equal(b.base[0], 10); assert.equal(b.pronosticados, 3); assert.ok(b.base.every((v) => v != null && v > 0));

const cfg = otrosDefault();
// Sin campañas en enero, promo media en mayo.
assert.deepEqual(efectoMes(cfg, 0), { alc: 0, int: 0, seg: 0 });
assert.ok(Math.abs(efectoMes(cfg, 4).alc - 0.1) < 1e-9);
cfg.gantt.evento[8] = 3; // sorteo alto en septiembre: 1,5 × (+44%, +320%)
assert.ok(Math.abs(efectoMes(cfg, 8).int - 4.8) < 1e-9);

const h: HistOtros = {
  anioBase: 2026,
  series: {
    "Web / Ecommerce|Tráfico web (usuarios)": [100, 100, 100, 100, 100, 100, 100, 100, 100, null, null, null],
    "Web / Ecommerce|Tasa de conversión": [1, 1, 1, 1, 1, 1, 1, 1, 1, null, null, null],
    "Redes Sociales|Alcance orgánico": [0, 0, 0, 1000, 1000, 1000, 1000, 1000, 1000, null, null, null],
    "Redes Sociales|Interacciones": [0, 0, 0, 100, 100, 100, 100, 100, 100, null, null, null],
    "Mercado y competencia|Índice de posición SEO": [null, null, null, null, null, null, null, 15, 12, null, null, null],
  },
  seguidores: { ultimo: 160000, fecha: "2026-10-15", porMes: 1000 },
};
const p = proyectarOtros(cfg, h, 2027);
const web = p["Web / Ecommerce"]!.find((k) => k.kpi === "Tráfico web (usuarios)")!;
assert.equal(web.valores[0], 110); // +10% realista
assert.equal(p["Web / Ecommerce"]!.find((k) => k.kpi === "Tasa de conversión")!.valores[0], 1.1);
const alc = p["Redes Sociales"]!.find((k) => k.kpi === "Alcance orgánico")!;
assert.equal(alc.valores[0], 1000); assert.equal(alc.valores[4], 1100); assert.equal(alc.valores[8], 1660);
const er = p["Redes Sociales"]!.find((k) => k.kpi === "Engagement rate")!;
assert.equal(er.valores[0], 10); assert.equal(er.valores[8], Math.round((100 * 5.8 / 1660) * 100 * 100) / 100);
const seg = p["Redes Sociales"]!.find((k) => k.kpi === "Seguidores")!;
assert.equal(seg.valores[0], 163000); // 160k + oct–dic (2) ... + ene
const idx = p["Mercado y competencia"]!.find((k) => k.kpi === "Índice de posición SEO")!;
assert.equal(idx.direccion, "down"); assert.equal(idx.valores[0], 12); // último relevamiento, sin ambición
// ROAS = ingresos proyectados ÷ (inversión del plan + conversión ecommerce)
h.series["Web / Ecommerce|Total Ingresos"] = Array(12).fill(1000);
h.series["Web / Ecommerce|Inversión conversión"] = Array(12).fill(100);
const roas = proyectarOtros(cfg, h, 2027, Array(12).fill(1000))["Web / Ecommerce"]!.find((k) => k.kpi === "ROAS")!;
assert.equal(roas.valores[0], 1); // 1100 ÷ 1100
assert.equal(sanearOtros({ gantt: { promo: [9] }, amb: { web: 999 } }).gantt.promo[0], 3);
assert.equal(sanearOtros({ amb: { web: 999 } }).amb.web, 100);
// Categorías: una campaña de Lavado solo mueve Lavado; el total = suma de categorías.
const c2 = otrosDefault();
c2.gantt.promo = Array(12).fill(0); c2.gantt.lanzamiento[0] = 2; c2.ganttCat.lanzamiento[0] = "Lavado";
const h2: HistOtros = { ...h, shares: { "Redes Sociales|Alcance orgánico": { Lavado: 0.4, Refrigeración: 0.3, Cocción: 0.1, Brand: 0.2 } } };
const a2 = proyectarOtros(c2, h2, 2027)["Redes Sociales"]!.find((k) => k.kpi === "Alcance orgánico")!;
assert.equal(a2.porCat!.Lavado![0], 480); // 1000 × 0,4 × 1,2
assert.equal(a2.porCat!.Refrigeración![0], 300);
assert.equal(a2.valores[0], 1080);
assert.equal(a2.valores[1], 1000);
assert.equal(sanearOtros({ ganttCat: { promo: ["Lavado", "X"] } }).ganttCat.promo[1], null);
console.log("plan-otros-kpis OK");
