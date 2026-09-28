// Test de moneda (lib/moneda.ts + lib/moneda-pauta.ts; portado de BIP sep-2026, pauta adaptada a Drean): parsers del dólar con
// FIXTURES SINTÉTICAS (mismo formato que las APIs; los números son inventados, no son datos reales),
// conversión $/USD (sin ajuste por inflación desde 28-sep-2026), fallback al último dólar disponible y metas.
// Correr: cd apps/web && npx tsx scripts/moneda.test.ts   (sin red ni Supabase)
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  parseMoneda, parseBcraCotizaciones, parseArgentinaDatos, promedioMensual, mergeIndices,
  buildIndices, resolverContexto, convertir, convertirSerie12, factorPeriodo, mesesEntre, avisoFaltantes, mesLabel, monedaLabel, normMes,
} from "../src/lib/moneda";
import { mesDeLabel, convertirFilas, convertir12, convertirPorMes, factorFila, type ConvCollector } from "../src/lib/moneda-pauta";

let pass = 0, fail = 0;
function ok(cond: unknown, msg: string) { if (cond) pass++; else { fail++; console.error("  ✗", msg); } }
const near = (a: number | null | undefined, b: number, eps = 1e-6) => a != null && Math.abs(a - b) <= eps * Math.max(1, Math.abs(b));
const fx = (f: string) => JSON.parse(readFileSync(join(__dirname, "fixtures", f), "utf8"));

// ── parseMoneda / helpers ──
ok(parseMoneda(undefined) === "corrientes", "default corrientes");
ok(parseMoneda("USD") === "usd" && parseMoneda(["constantes"]) === "corrientes" && parseMoneda("xx") === "corrientes", "parseMoneda (constantes ya no es opción del selector → \"$\")");
ok(normMes("2026-08-01") === "2026-08" && normMes("2026-13") === null && normMes("") === null, "normMes");
ok(mesLabel("2026-08") === "ago-2026", "mesLabel");
ok(mesesEntre("2025-11-15", "2026-02-03").join() === "2025-11,2025-12,2026-01,2026-02", "mesesEntre cruza año");

// ── Parsers ──
const bcra = parseBcraCotizaciones(fx("macro-bcra-usd.json"));
ok(bcra.length === 3 && bcra[2].valor === 1050, "BCRA: toma USD entre varias monedas, ignora vacíos/fecha mala");
ok(parseBcraCotizaciones({ status: 400, errorMessages: ["x"] }).length === 0, "BCRA: error → []");
const usdM = promedioMensual(bcra);
ok(usdM.length === 2 && near(usdM[0].valor, 1005) && usdM[0].dias === 2 && near(usdM[1].valor, 1050), "promedio mensual del dólar");
const mep = promedioMensual(parseArgentinaDatos(fx("macro-argentinadatos.json")));
ok(mep.length === 2 && near(mep[0].valor, 1110), "argentinadatos: venta, ignora nulls");
ok(parseArgentinaDatos({ error: 1 }).length === 0, "argentinadatos: no-array → []");
const rows = mergeIndices(usdM, mep);
ok(rows.length === 2 && rows.find((r) => r.mes === "2026-01")?.usd_mep === 1110 && near(rows.find((r) => r.mes === "2026-01")?.usd_oficial, 1005), "mergeIndices");
ok(mergeIndices([], [{ mes: "2026-06", valor: 5 }])[0]?.usd_oficial === null, "mergeIndices: mes solo con MEP → oficial null");

// ── Contexto y conversión ──
const idxRows = [
  { mes: "2026-01", usd_oficial: 1000 },
  { mes: "2026-02", usd_oficial: 1100 },
  { mes: "2026-03-01", usd_oficial: null },
  { mes: "2026-04", usd_oficial: 1300 },
];
const idx = buildIndices(idxRows);
ok(idx.ultimoUsd === "2026-04" && idx.meses.join() === "2026-01,2026-02,2026-04", "último mes con dólar");
const usd = resolverContexto("usd", idxRows).ctx;
const falt = convertir(usd, 1300, "2026-05");
ok(falt.faltante && falt.mesUsado === "2026-04" && near(falt.valor, 1), "usd: mes sin dólar usa el último disponible y avisa");
const antes = convertir(usd, 100, "2025-06");
ok(antes.faltante && antes.mesUsado === "2026-01", "mes anterior a la serie → primer disponible");
ok(near(convertir(usd, 2_200_000, "2026-02").valor, 2000), "usd: ÷ dólar del mes");
ok(convertir(usd, 1, "2026-03").faltante && near(convertir(usd, 1300, "2026-03").valor, 1300 / 1100), "usd: mar sin dólar usa feb");
const cor = resolverContexto("corrientes", idxRows).ctx;
ok(convertir(cor, 123, "2026-01").valor === 123 && !convertir(cor, 1, "2026-09").faltante, "corrientes = identidad");
const sinIdx = resolverContexto("usd", []);
ok(sinIdx.ctx.moneda === "corrientes" && !!sinIdx.aviso, "sin dólar → $ con aviso");
ok(resolverContexto("usd", [{ mes: "2026-01", usd_oficial: null }]).ctx.moneda === "corrientes", "dólar vacío → $");
ok(monedaLabel(usd).startsWith("USD") && monedaLabel(cor) === "$", "labels");

const s12 = convertirSerie12(usd, 2026, [1000, 2200, 1100, null, 2600, ...Array(7).fill(null)]);
ok(near(s12.valores[0], 1) && near(s12.valores[1], 2) && near(s12.valores[2], 1) && s12.valores[3] === null && near(s12.valores[4], 2) && s12.faltantes.join() === "2026-03,2026-05", "serie 12 meses + faltantes");
ok((avisoFaltantes(usd, s12.faltantes) ?? "").includes("mar-2026") && (avisoFaltantes(usd, s12.faltantes) ?? "").includes("dólar") && avisoFaltantes(cor, ["2026-04"]) === null, "aviso de faltantes");
ok(near(factorPeriodo(usd, ["2026-01", "2026-04"]), (1 / 1000 + 1 / 1300) / 2), "factor período simple");
ok(near(factorPeriodo(usd, ["2026-01", "2026-04"], [3, 1]), (3 / 1000 + 1 / 1300) / 4), "factor período ponderado");
ok(factorPeriodo(cor, ["2026-01"]) === 1, "factor corrientes = 1");

// ── Pauta de Drean (filas por mes "Junio 2026" / "2026-06-01", conversión server-side) ──
ok(mesDeLabel("Junio 2026") === "2026-06" && mesDeLabel("2026-06-01") === "2026-06" && mesDeLabel("Setiembre 2026") === "2026-09" && mesDeLabel("xx") === null, "mesDeLabel");
const filas = [
  { mes: "Enero 2026", medio: "OOH", inversion: 1000 as number | null, costo: 10 as number | null, impresiones: 50 },
  { mes: "Febrero 2026", medio: "TV", inversion: 1100 as number | null, costo: null as number | null, impresiones: 60 },
  { mes: "sin mes", medio: "X", inversion: 7 as number | null, costo: 1 as number | null, impresiones: 1 },
];
const colU: ConvCollector = { faltantes: new Set() };
const fu = convertirFilas(usd, filas, (r) => r.mes, ["inversion", "costo"], colU);
ok(near(fu[0]!.inversion, 1) && near(fu[0]!.costo, 0.01) && near(fu[1]!.inversion, 1) && fu[1]!.costo === null, "usd: cada fila con el dólar de su mes, null queda null");
ok(fu[0]!.impresiones === 50 && fu[2]!.inversion === 7, "volúmenes intactos; fila sin mes reconocible no se toca");
ok(filas[0]!.inversion === 1000, "no muta el original");
ok(convertirFilas(cor, filas, (r) => r.mes, ["inversion"]) === filas, "corrientes devuelve el mismo array");
// DV360: revenue_usd × factor y después × fx en el cliente = conmuta (mismo resultado que convertir el ARS).
const fxMes = 1050;
const dv = convertirFilas(usd, [{ mes: "2026-01-01", revenue_usd: 10 }], (r) => r.mes, ["revenue_usd"]);
ok(near(dv[0]!.revenue_usd * fxMes, convertir(usd, 10 * fxMes, "2026-01").valor), "DV360: factor sobre USD = factor sobre ARS");
const colF: ConvCollector = { faltantes: new Set() };
factorFila(usd, "Mayo 2026", colF);
ok([...colF.faltantes].join() === "2026-05", "mes sin dólar queda en faltantes (para el aviso)");
const e12 = convertir12(usd, 2026, [1000, 2200, ...Array(10).fill(null)]);
ok(near(e12[0], 1) && near(e12[1], 2) && e12[2] === null, "serie de 12 (ecommerce / metas)");
const pm = convertirPorMes(usd, { "Enero 2026": { digital: 1000, tvCable: 0, dooh: 100, ooh: 1 } });
ok(near(pm["Enero 2026"]!.digital, 1) && near(pm["Enero 2026"]!.dooh, 0.1), "planificación por mes");

console.log(`moneda: ${pass} OK, ${fail} fallas`);
if (fail) process.exit(1);
