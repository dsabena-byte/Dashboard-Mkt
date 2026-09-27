// Test de los índices de marca (ESoS, significancia entre olas, Salud digital de marca).
// Correr: npx tsx scripts/marca-indices.test.ts
import { computeEsos, bestLag, movingAverage, monthRange, moePct, diffSignificance, saludDigital, lecturaIndice, pearson, type ObsDigital } from "../src/lib/marca-indices";

let fails = 0, passes = 0;
const ok = (name: string, cond: boolean, extra?: unknown) => { if (cond) passes++; else { fails++; console.error(`✗ ${name}`, extra === undefined ? "" : JSON.stringify(extra)); } };
const near = (name: string, got: number | null | undefined, want: number, tol = 1e-6) => ok(`${name} (got ${got}, want ${want})`, got != null && Math.abs(got - want) <= tol);
const mesN = (i: number) => { const y = 2024 + Math.floor(i / 12), m = (i % 12) + 1; return `${y}-${String(m).padStart(2, "0")}`; };

// ── utilidades ──
ok("monthRange cruza año", monthRange("2025-11", "2026-02").join(",") === "2025-11,2025-12,2026-01,2026-02");
near("pearson perfecto", pearson([1, 2, 3, 4], [2, 4, 6, 8]), 1);
ok("pearson sin varianza = null", pearson([1, 1, 1], [1, 2, 3]) === null);
const ma = movingAverage([{ mes: "2026-01", valor: 10 }, { mes: "2026-02", valor: 20 }, { mes: "2026-03", valor: 30 }], 6);
near("MA6 con 3 meses (mín ceil(6/2))", ma.get("2026-03"), 20);
ok("MA6 no sale con 1-2 meses", !ma.has("2026-01") && !ma.has("2026-02"));

// ── ESoS ──
// SoS 30% estable y share 25% → ESoS +5 sostenido → "sube".
const sos = Array.from({ length: 12 }, (_, i) => ({ mes: mesN(i), valor: 30 }));
const som = Array.from({ length: 12 }, (_, i) => ({ mes: mesN(i), valor: 25 }));
const e1 = computeEsos(sos, som);
near("ESoS último = 5", e1.ultimo?.esos, 5);
near("ratio = 1,2", e1.ultimo?.ratio, 1.2);
ok("lectura sube", e1.lectura === "sube", e1);
ok("racha ≥ 3", e1.racha >= 3, e1.racha);
ok("sin lag con 12 meses (necesita 18)", e1.lag === null && e1.mesesAlineados === 12, e1);
const e2 = computeEsos(sos.map((s) => ({ ...s, valor: 20 })), som);
ok("ESoS negativo sostenido → baja", e2.lectura === "baja" && e2.ultimo!.esos! < 0, e2.ultimo);
const e3 = computeEsos(sos.map((s) => ({ ...s, valor: 25.2 })), som);
ok("ESoS chico → neutral", e3.lectura === "neutral", e3.ultimo);
// Racha corta: 2 meses arriba tras meses abajo → neutral
const sosCorto = Array.from({ length: 12 }, (_, i) => ({ mes: mesN(i), valor: i >= 10 ? 60 : 10 }));
const eC = computeEsos(sosCorto, som, { ma: 1 });
ok("racha de 2 → neutral", eC.racha === 2 && eC.lectura === "neutral", { racha: eC.racha, l: eC.lectura });

// Rezago: el share copia las VARIACIONES del SoS con 3 meses de retraso.
const n = 36;
const noise = Array.from({ length: n }, (_, i) => Math.sin(i * 1.7) * 2 + Math.cos(i * 0.9) * 1.5 + (i % 5) * 0.4);
const sosL = noise.map((v, i) => ({ mes: mesN(i), valor: 30 + v }));
const somL = noise.map((_, i) => ({ mes: mesN(i), valor: 25 + (i >= 3 ? noise[i - 3] * 0.5 : 0) }));
const lag = bestLag(sosL, somL);
ok("lag estimado = 3", lag.lag?.lag === 3, lag);
ok("r alto en el lag", (lag.lag?.r ?? 0) > 0.9, lag);
ok("alineados 36", lag.alineados === 36);
const lagNo = bestLag(sosL.slice(0, 15), somL.slice(0, 15));
ok("con 15 meses no estima", lagNo.lag === null && lagNo.alineados === 15);

// ── Significancia ──
near("MoE 50% n=400 ≈ 4,9 pp", moePct(50, 400), 4.9, 0.01);
ok("MoE sin n = null", moePct(50, 0) === null);
const d1 = diffSignificance(40, 600, 44, 600)!;
near("MoE Δ 40→44 n=600", d1.moe, 1.96 * Math.sqrt(0.4 * 0.6 / 600 + 0.44 * 0.56 / 600) * 100, 1e-9);
ok("40→44 con n=600 NO es significativo", !d1.sig, d1);
const d2 = diffSignificance(40, 2000, 44, 2000)!;
ok("40→44 con n=2000 SÍ es significativo", d2.sig, d2);
ok("sin base → null", diffSignificance(40, null, 44, 600) === null);

// ── Salud digital de marca ──
const marcas = ["Tu marca", "A", "B", "C"];
const vals: Record<string, [number, number, number, number]> = { // sos, soe, ia, serp
  "Tu marca": [40, 30, 35, 10], A: [30, 30, 25, 20], B: [20, 25, 25, 30], C: [10, 15, 15, 40],
};
const obs: ObsDigital[] = [];
for (const mes of ["2026-06", "2026-07"]) for (const mk of marcas) {
  const [a, b, c, d] = vals[mk];
  obs.push({ mes, marca: mk, componente: "sos", valor: a }, { mes, marca: mk, componente: "soe", valor: b }, { mes, marca: mk, componente: "ia", valor: c }, { mes, marca: mk, componente: "serp", valor: d });
}
const sdg = saludDigital(obs, "tu MARCA");
ok("2 meses", sdg.meses.length === 2);
ok("tu marca 1ª", sdg.rank === 1, sdg.ultimo?.marcas.map((x) => [x.marca, x.indice]));
ok("índice propio > 50", (sdg.own?.indice ?? 0) > 50);
ok("C < 50 (peor en todo)", (sdg.ultimo!.marcas.find((x) => x.marca === "C")!.indice) < 50);
// Promedio de índices = 50 cuando todas las marcas tienen todos los componentes (z suman 0).
near("media del set = 50", sdg.ultimo!.marcas.reduce((s, x) => s + x.indice, 0) / 4, 50, 0.02);
ok("serp invertido: z propio de serp > 0", (sdg.own?.z.serp ?? 0) > 0, sdg.own?.z);
ok("4 componentes", sdg.ultimo!.componentes.length === 4);
ok("serie propia 2 puntos", sdg.serie.length === 2);
ok("lectura", lecturaIndice(sdg.own).length > 0);
// Mes con un solo componente → no hay índice (mín 2).
const soloUno = saludDigital(obs.filter((o) => o.componente === "sos"), "Tu marca");
ok("1 componente → sin índice", soloUno.meses.length === 0 && soloUno.own === null);
// Mes en curso con menos componentes no pisa al mes completo.
const conCurso = saludDigital([...obs, ...marcas.flatMap((mk) => [{ mes: "2026-08", marca: mk, componente: "ia" as const, valor: vals[mk][2] }, { mes: "2026-08", marca: mk, componente: "serp" as const, valor: vals[mk][3] }])], "Tu marca");
ok("ref = mes con más componentes", conCurso.ultimo?.mes === "2026-07", conCurso.ultimo?.mes);
ok("serie incluye el mes en curso", conCurso.serie.length === 3);
// Menos de 3 marcas → nada
ok("2 marcas → sin índice", saludDigital(obs.filter((o) => o.marca === "A" || o.marca === "Tu marca"), "Tu marca").meses.length === 0);
// Acotado 0-100
const ext: ObsDigital[] = [];
for (let i = 0; i < 30; i++) for (const c of ["sos", "soe"] as const) ext.push({ mes: "2026-01", marca: `M${i}`, componente: c, valor: i === 0 ? 1e6 : 1 });
const sx = saludDigital(ext, "M0");
ok("acotado a 100", sx.own != null && sx.own.indice <= 100 && sx.own.indice > 90, sx.own);

console.log(`${passes} ok · ${fails} fallas`);
if (fails) process.exit(1);
