import assert from "node:assert/strict";
import { zona, limites, evaluarMedio, piezasVideo, gammaQ } from "../src/lib/pauta-escalar";

// Cuantiles de Gamma razonables (a=100: media 100, 90% ≈ 112,9).
assert.ok(Math.abs(gammaQ(100, 1.2816) - 112.9) < 0.5);
// Meta $50: costo 80 con poca plata = prueba; con mucha plata = cortar (el ejemplo del posteo).
assert.equal(zona(240, 3, 50), "probar");
assert.equal(zona(2000, 25, 50), "cortar");
// Costo 30 con mucha plata = escalar.
assert.equal(zona(30000, 1000, 50), "escalar");
// Las curvas se cierran hacia la meta al subir la inversión.
const a = limites(200, 50), b = limites(200000, 50);
assert.ok(a.cortar > b.cortar && b.cortar > 60 && a.escalar < b.escalar && b.escalar < 40);
// Con mucho volumen, 3% más caro que la meta NO es cortar (margen ±20%); 40% más caro sí.
assert.equal(zona(1e7, 1e7 / 51.5, 50), "probar");
assert.equal(zona(1e7, 1e7 / 70, 50), "cortar");
// Consistencia curva ↔ zona.
assert.equal(zona(5000, 5000 / (limites(5000, 50).cortar * 1.05), 50), "cortar");

const piezas = [
  { key: "a", medio: "Meta", nombre: "A", link: null, activa: true, inv: 100000, completos: 4000, impr: 1e6, alcance: 4e5 }, // $25: escalar
  { key: "b", medio: "Meta", nombre: "B", link: null, activa: true, inv: 100000, completos: 1000, impr: 1e6, alcance: 2e5 }, // $100: cortar
  { key: "c", medio: "Meta", nombre: "C", link: null, activa: true, inv: 500, completos: 10, impr: 5e3, alcance: 2e3 },     // poca plata: probar
];
const ev = evaluarMedio("Meta", piezas, 50)!;
assert.deepEqual(ev.piezas.map((p) => p.zona), ["escalar", "cortar", "probar"]);
assert.equal(ev.piezas[0]!.cuadrante, "eficiente");
assert.equal(ev.piezas[1]!.cuadrante, "caro");
// Sin meta: usa la mediana del medio (piezas con ≥30 completos).
assert.equal(evaluarMedio("Meta", piezas)!.meta, (25 + 100) / 2);

// Entrada: Meta por permalink sumando meses del año, DV360 en USD × TC, sin "Unknown", sin piezas sin video.
const pv = piezasVideo({
  anio: 2026, fxRates: { "2026-08-01": 1500 },
  metaPaid: [
    { ad_id: "1", instagram_permalink_url: "ig/x", mes: "Agosto 2026", plataforma: "meta", ad_name: "X", spend: 100, impresiones: 1000, alcance: 500, video_p100: 10 },
    { ad_id: "2", instagram_permalink_url: "ig/x", mes: "Septiembre 2026", plataforma: "meta", ad_name: "X", spend: 50, impresiones: 500, alcance: 300, video_p100: 5 },
    { ad_id: "3", mes: "Septiembre 2026", plataforma: "meta", ad_name: "Imagen", spend: 50, impresiones: 500, alcance: 300, video_p100: 0 },
    { ad_id: "4", mes: "Agosto 2025", plataforma: "meta", ad_name: "Viejo", spend: 50, impresiones: 500, alcance: 300, video_p100: 9 },
  ],
  dv360: [
    { mes: "2026-08-01", canal: "Programmatic", creative: "P1", impresiones: 1000, q100: 20, revenue_usd: 2 },
    { mes: "2026-08-01", canal: "YouTube", creative: "Unknown", impresiones: 1000, q100: 20, revenue_usd: 2 },
  ],
  tiktok: [{ ad_id: "t", mes: "2026-09", ad_name: "T", inv: 70, impr: 900, alcance: 400, p100: 7, link: null, activa: false }],
});
assert.deepEqual(Object.keys(pv).sort(), ["Meta", "Programmatic", "TikTok"]);
assert.equal(pv.Meta!.length, 1);
assert.equal(pv.Meta![0]!.inv, 150);
assert.equal(pv.Meta![0]!.completos, 15);
assert.equal(pv.Programmatic![0]!.inv, 3000);
assert.equal(pv.Programmatic![0]!.alcance, null);
console.log("pauta-escalar OK");
