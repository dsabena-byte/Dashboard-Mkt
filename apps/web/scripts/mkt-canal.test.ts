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
