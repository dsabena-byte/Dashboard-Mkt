// npx tsx scripts/fs-enrich.test.ts — la ubicación de una tienda exige coincidencia de nombre, no solo de número.
import assert from "node:assert/strict";
import { crearEnriquecedorFs } from "../src/lib/fs-enrich";

const enr = crearEnriquecedorFs([
  { numero: "19", nombre: "On City Jofre", cadena: "ON CITY", promotor: "P1", supervisor: "S1", zona: "Cordoba", geo: "108|-31.48|-64.14|Córdoba" },
]);
const mismo = enr("19", "On City Jofre");
assert.equal(mismo?.geo, "108|-31.48|-64.14|Córdoba");
const otro = enr("19", "Frávega Lanús");
assert.equal(otro?.geo, undefined, "otra cadena con el mismo número no hereda la ubicación");
assert.notEqual(otro?.zona, "Cordoba");
assert.equal(otro?.promotor, "P1", "el promotor sigue la regla de la app vieja (por número)");
console.log("fs-enrich OK");
