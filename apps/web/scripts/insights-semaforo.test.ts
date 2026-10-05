// Semáforo de los ítems del Diagnóstico IA. Correr: npx tsx scripts/insights-semaforo.test.ts
import assert from "node:assert/strict";
import { brechasDeItem, semaforoDeItem } from "../src/lib/insights/semaforo-item";

const it = (titulo: string, evidencia: string, estado?: "bueno" | "regular" | "malo") => ({ titulo, evidencia, ...(estado ? { estado } : {}) });
// Textos reales del Diagnóstico de Plan de Medios (5-oct-2026).
const alc = brechasDeItem(it("Alcance único y su tendencia", "Sep real 52.167.286 vs meta 28.000.000 (+86% vs meta). YTD real 290.383.017 vs meta 282.000.000 (+3%)."));
assert.deepEqual(alc.map((b) => [b.label, b.pct, b.semaforo]), [["Mes", 86, "verde"], ["YTD", 3, "verde"]]);
const frec = brechasDeItem(it("Frecuencia y su tendencia", "Sep real 2.25 x vs meta 3 x (-25% vs meta). YTD real 2.37 vs meta 2.58 (-8%)."));
assert.deepEqual(frec.map((b) => b.semaforo), ["rojo", "amarillo"]);
assert.equal(semaforoDeItem(it("Tasa de conversión", "Sep real 0.06 % vs meta 0.15 % (-60% vs meta). YTD real 0.13 vs meta 0.12 (+7%).")), "rojo");
assert.equal(semaforoDeItem(it("Clicks", "Sep real 1.028.260 vs meta 1.000.000 (+3% vs meta). YTD real 5.663.252 vs meta 5.650.000 (+0%).")), "verde");
// Menos es mejor: CPM 20% arriba de la meta = mal; 5% arriba = atención.
assert.equal(semaforoDeItem(it("CPM", "Sep real $1.200 vs meta $1.000 (+20% vs meta).")), "rojo");
assert.equal(semaforoDeItem(it("CPM", "Sep real $1.050 vs meta $1.000 (+5% vs meta).")), "amarillo");
assert.equal(semaforoDeItem(it("CPM", "Sep real $900 vs meta $1.000 (-10% vs meta).")), "verde");
// Sin brecha en el texto → lo que dijo la IA; sin nada → sin meta.
assert.equal(semaforoDeItem(it("Usuarios", "Crecieron 12% en el mes (+12%).", "regular")), "amarillo");
assert.equal(semaforoDeItem(it("Usuarios", "Crecieron 12% en el mes.")), "sin-meta");
console.log("insights-semaforo OK");
