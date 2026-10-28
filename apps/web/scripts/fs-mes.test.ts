import assert from "node:assert/strict";
import { mesKeySemana } from "../src/lib/fs-mes";

// La semana 1 de 2026 empieza el lunes 29-dic-2025 → diciembre del año ANTERIOR (antes el subtítulo decía "Diciembre 2026").
assert.equal(mesKeySemana("2026-W01", 1), "2025-12");
assert.equal(mesKeySemana("2026-W02", 2), "2026-01");
assert.equal(mesKeySemana("2026-W43", 43), "2026-10");
assert.equal(mesKeySemana("2027-W01", 1), "2027-01"); // 2027: la semana 1 empieza el 4-ene
console.log("fs-mes OK");
