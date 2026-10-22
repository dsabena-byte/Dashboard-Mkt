// npx tsx scripts/plan-canal.test.ts
import assert from "node:assert/strict";
import { EVENTOS_BASE, canalDefault, sanearCanal, totalMes } from "../src/lib/plan-canal";

assert.equal(canalDefault(["Frávega"]).eventos.length, EVENTOS_BASE.length);
const c = sanearCanal({ clientes: [{ nombre: " Oncity ", valores: [100, -5, "x"] }, { nombre: "", valores: [1] }], eventos: [{ nombre: "Red Acero", valores: [50] }] });
assert.equal(c.clientes.length, 1); // sin nombre se descarta
assert.equal(c.clientes[0]!.nombre, "Oncity");
assert.deepEqual(c.clientes[0]!.valores.slice(0, 3), [100, 0, 0]); // negativos y texto = 0
assert.equal(totalMes([...c.clientes, ...c.eventos])[0], 150);
assert.equal(sanearCanal(null).eventos[0]!.nombre, "Red Acero");
console.log("plan-canal OK");
