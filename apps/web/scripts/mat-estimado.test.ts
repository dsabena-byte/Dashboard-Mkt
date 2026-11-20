import assert from "node:assert/strict";
import { estimarMat, type MesSeg } from "../src/lib/mat-estimado";
const fila = (high: number | null): MesSeg => ({ vs: { High: high, Mid: null, Low: null }, us: { High: null, Mid: null, Low: null }, ip: { High: null, Mid: null, Low: null }, usTotal: null, vsTotal: null });
const mat = new Map([["2026-10-01", fila(15)]]);
const mensual = new Map([["2026-07-01", fila(18)], ["2026-08-01", fila(20)], ["2026-09-01", fila(22)], ["2025-11-01", fila(8)]]);
// nov-26 = 15 + (prom(oct? no hay, sep, ago) − nov-25) / 12 → últimos 3 = oct(null), sep 22, ago 20 → 21 → 15 + 13/12
const out = estimarMat(mat, mensual, "2026-11-01");
assert.equal(out.get("2026-11-01")!.vs.High, Math.round((15 + (21 - 8) / 12) * 100) / 100);
// un dato real no se pisa
const conReal = new Map([...mat, ["2026-11-01", fila(9)]]);
assert.equal(estimarMat(conReal, mensual, "2026-11-01").get("2026-11-01")!.vs.High, 9);
// sin dato del mes que sale no se inventa
assert.equal(estimarMat(mat, new Map([["2026-08-01", fila(20)], ["2026-09-01", fila(22)]]), "2026-11-01").get("2026-11-01"), undefined);
// sin mensuales: sigue la tendencia del MAT (Philco Mid Lavado: 3,68 → 3,0 → 2,32)
const matPh = new Map([["2026-09-01", fila(3.68)], ["2026-10-01", fila(3.0)]]);
assert.equal(estimarMat(matPh, new Map(), "2026-11-01").get("2026-11-01")!.vs.High, 2.32);
// nunca negativo
const matBaja = new Map([["2026-09-01", fila(2)], ["2026-10-01", fila(0.5)]]);
assert.equal(estimarMat(matBaja, new Map(), "2026-11-01").get("2026-11-01")!.vs.High, 0);
console.log("mat-estimado OK");
