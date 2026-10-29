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

// Tienda del maestro sin asignación: ubica el punto, pero no aporta promotor.
const enr2 = crearEnriquecedorFs([
  { numero: "19", nombre: "On City Jofre", cadena: "ON CITY", promotor: "P1", supervisor: "S1", geo: "108|-31.48|-64.14|Córdoba" },
  { numero: "19", nombre: "19 - Frávega Lanús", cadena: "FRAVEGA SA", promotor: "", supervisor: "", geo: "700|-34.70|-58.39|Buenos Aires", soloUbicacion: true },
  { numero: "7", nombre: "Tienda Suelta", cadena: "X", promotor: "", supervisor: "", geo: "701|-30|-60|Santa Fe", soloUbicacion: true },
]);
assert.equal(enr2("19", "Frávega Lanús")?.geo, "700|-34.70|-58.39|Buenos Aires");
assert.equal(enr2("19", "Frávega Lanús")?.promotor, "P1");
assert.equal(enr2("7", "Tienda Suelta")?.geo, "701|-30|-60|Santa Fe");
assert.notEqual(enr2("7", "Tienda Suelta")?.promotor, "", "sin asignación sigue como «no mapeada», no «sin promotor»");
console.log("fs-enrich soloUbicacion OK");
