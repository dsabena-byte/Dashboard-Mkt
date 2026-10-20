import assert from "node:assert/strict";
import { num, sanearFilas, mergeConAnterior } from "../src/lib/mkt-canal-core";
assert.equal(num("1.234.567"), 1234567);
assert.equal(num("$ 12.500,50"), 12500.5);
assert.equal(num("1,234,567"), 1234567);
assert.equal(num("3,5"), 3.5);
assert.equal(num(""), null);
assert.equal(num("-5"), null);
const r = sanearFilas([
  { cliente: "Oncity", accion: "Hot Sale", mes: "2026-05", plataforma: "Instagram", impresiones: "10.000", clics: 120, inversion: null },
  { cliente: "Oncity", accion: "", mes: "2026-05", plataforma: "Meta" },
  { cliente: "Oncity", accion: "X", mes: "2026-13", plataforma: "Meta" },
  { cliente: "Oncity", accion: "X", mes: "2026-06", plataforma: "Radio" },
]);
assert.equal(r.filas.length, 1);
assert.equal(r.errores.length, 3);
assert.equal(r.filas[0]!.plataforma, "Meta");
assert.equal(r.filas[0]!.periodo, "Mayo 2026");
assert.equal(r.filas[0]!.impresiones, 10000);
const m = mergeConAnterior(r.filas[0]!, { inversion: 500, evidencia_url: "https://x" });
assert.equal(m.inversion, 500);
assert.equal(m.evidencia_url, "https://x");
assert.equal(m.impresiones, 10000);
const dup = sanearFilas([{ cliente: "A", accion: "B", mes: "2026-05", plataforma: "Meta" }, { cliente: "A", accion: "B", mes: "2026-05", plataforma: "facebook" }]);
assert.equal(dup.filas.length, 1);
assert.equal(dup.errores.length, 1);
console.log("mkt-canal OK");
const p = sanearFilas([{ cliente: "Oncity", accion: "", mes: "", plataforma: "GOOGLE", impresiones: 73989, conversiones: 28.1, ingresos: 14244001.45 }], true);
assert.equal(p.filas.length, 1);
assert.equal(p.filas[0]!.conversiones, 28.1);
assert.equal(p.filas[0]!.ingresos, 14244001.45);
assert.equal(p.errores.length, 1);
assert.equal(sanearFilas(p.filas).filas.length, 0); // el guardado exige completar
console.log("mkt-canal parcial OK");
const y = sanearFilas([{ cliente: "Oncity", accion: "Drean", mes: "2023-08", plataforma: "Meta" }], false, new Date("2026-10-20"));
assert.equal(y.filas.length, 0);
assert.match(y.errores[0]!, /2023 parece mal leído/);
console.log("mkt-canal año OK");
assert.equal(sanearFilas([{ cliente: "Oncity", accion: "Drean", mes: "2026-08", plataforma: "Catálogo Digital On City" }]).filas[0]!.plataforma, "Catálogo");
console.log("mkt-canal catálogo OK");
