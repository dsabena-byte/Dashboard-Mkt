// Test del motor estadístico común (lib/stats, portado de BIP sep-2026) + pace-to-goal del Seguimiento
// (lib/objetivos-pronostico). Sin red ni Supabase.
// cd apps/web && npx tsx scripts/stats.test.ts
import { mulberry32, seedDe, crearUniformes } from "../src/lib/stats/prng";
import { ajustar, bandaEsperada, evaluarContraBanda } from "../src/lib/stats/forecast";
import { pronosticoMeta, cumplimiento, lecturaProbabilidad, N_SIMS } from "../src/lib/stats/meta";
import { propagarPonderado } from "../src/lib/stats/rollup";
import { descomponerSuma, descomponerProducto, descomponerConDriver, descomponerComponentesConDriver, descomponerTasa } from "../src/lib/stats/descomposicion";
import { pronosticarKpis, pronosticarObjetivos, porQueSeMovio, kpiKey, type KpiSerie } from "../src/lib/objetivos-pronostico";

let fail = 0, okN = 0;
const ok = (c: unknown, m: string) => { if (c) okN++; else { fail++; console.error(`FAIL ${m}`); } };
const near = (a: number | null | undefined, b: number, tol: number, m: string) => ok(a != null && Math.abs(a - b) <= tol, `${m}: ${a} ≉ ${b} (±${tol})`);
const N = <T,>(n: number, f: (i: number) => T) => Array.from({ length: n }, (_, i) => f(i));
const nul12 = () => N(12, () => null as number | null);

// ── PRNG ──
{
  const a = mulberry32(42), b = mulberry32(42);
  const xs = N(1000, () => a()), ys = N(1000, () => b());
  ok(xs.every((x, i) => x === ys[i]), "prng: misma semilla → misma secuencia");
  ok(xs.every((x) => x >= 0 && x < 1), "prng: rango [0,1)");
  const m = xs.reduce((s, x) => s + x, 0) / xs.length;
  near(m, 0.5, 0.05, "prng: media ≈ 0,5");
  ok(seedDe("abc") === seedDe("abc") && seedDe("abc") !== seedDe("abd"), "seedDe estable y distinta");
  const U = crearUniformes("x", 10, 3);
  ok(U.u.length === 30 && U.nSims === 10 && U.h === 3, "uniformes: tamaño");
}

// ── Ajuste: constante / ritmo / suavizado / estacional ──
{
  const c = ajustar([100, 100, 100, 100, 100, 100], 3)!;
  ok(c.metodo === "suavizado", "constante → suavizado");
  ok(c.puntos.length === 3 && c.puntos.every((p) => Math.abs(p - 100) < 1e-9), "constante → pronóstico 100");
  ok(c.residuos.every((r) => r === 0) && c.cvError === 0, "constante → residuos 0, CV 0");
  const r = ajustar([10, 20, null], 2)!;
  ok(r.metodo === "ritmo" && r.puntos[0] === 15 && r.residuos.length === 0, "2 datos → ritmo (promedio)");
  ok(ajustar([null, null], 2) === null, "sin datos → null");
  const t = ajustar([100, 110, 120, 130, 140, 150, 160, 170, 180, 190], 2)!;
  ok(t.metodo === "suavizado" && t.alpha === 0.9, "tendencia → α alto");
  // Estacional: año anterior con patrón, año en curso = patrón × 1,1 (ene-ago).
  const prev = N(12, (i) => 100 + 50 * Math.sin((i / 12) * 2 * Math.PI));
  const cur = N(12, (i) => (i < 8 ? prev[i] * 1.1 : null));
  const s = ajustar([...prev, ...cur], 4)!;
  ok(s.metodo === "estacional_tendencia", `estacional con tendencia (${s.metodo})`);
  near(s.tendencia!, 1.1, 1e-9, "tendencia interanual 1,1");
  near(s.puntos[0], prev[8] * 1.1, 1e-6, "sep = sep año anterior × 1,1");
  near(s.puntos[3], prev[11] * 1.1, 1e-6, "dic = dic año anterior × 1,1");
  ok(s.residuos.length >= 4 && s.residuosIdx.every((ix) => ix >= 12), "residuos estacionales en el año con base");
  // Sin tendencia medible (faltan 3 meses previos del año anterior) → estacional puro.
  const prev2 = prev.map((v, i) => (i >= 5 && i <= 7 ? null : v));
  const s2 = ajustar([...prev2, ...cur], 4)!;
  ok(s2.metodo === "estacional" || s2.metodo === "suavizado", "sin tendencia medible → estacional puro (o suavizado si faltan bases)");
  // Tendencia acotada a [0,5 ; 2].
  const cur3 = N(12, (i) => (i < 8 ? prev[i] * 5 : null));
  near(ajustar([...prev, ...cur3], 4)!.tendencia!, 2, 1e-9, "tendencia acotada en 2");
  // Horizonte > 12 → no estacional.
  ok(ajustar([...prev, ...N(12, () => null)], 13)!.metodo === "suavizado", "h>12 → suavizado");
}

// ── Banda esperada ──
{
  const hist = [100, 104, 98, 101, 103, 97, 100, 102];
  const b = bandaEsperada(hist)!;
  ok(b != null && b.lo < b.esperado && b.esperado < b.hi, "banda: lo < esperado < hi");
  ok(evaluarContraBanda(hist, 101)!.dentro === true, "101 dentro del rango normal");
  ok(evaluarContraBanda(hist, 150)!.dentro === false, "150 fuera del rango");
  ok(evaluarContraBanda(hist, 60)!.dentro === false, "60 fuera del rango");
  ok(bandaEsperada([100, 101, 99, 100, 102]) === null, "banda: <6 meses → null");
  ok(evaluarContraBanda([1, 2, 3], 2) === null, "evaluar: sin banda → null");
  const volatil = [10, 200, 15, 180, 20, 210, 12, 190];
  const bv = bandaEsperada(volatil)!;
  ok(bv.hi - bv.lo > 100, "serie volátil → banda ancha");
}

// ── Probabilidad de meta ──
const ruido = [1, -1, 0.5, -0.5, 0.8, -0.8, 0.2, -0.2, 0.6, -0.6, 0.3, -0.3];
const base8 = N(12, (i) => (i < 8 ? 100 + 5 * ruido[i] : null)); // ene-ago cerrados
{
  const P = (metaMes: number, extra: Partial<Parameters<typeof pronosticoMeta>[0]> = {}) =>
    pronosticoMeta({ realM: base8, metaM: N(12, () => metaMes), tipo: "sum", direccion: "up", seed: 7, ...extra }).resumen;
  const alta = P(130), media = P(100), baja = P(80);
  ok(baja.suficiente && baja.probabilidad! >= 0.95, `meta baja → prob alta (${baja.probabilidad})`);
  ok(alta.probabilidad! <= 0.05, `meta alta → prob baja (${alta.probabilidad})`);
  ok(media.probabilidad! > 0.1 && media.probabilidad! < 0.9, `meta ≈ ritmo → prob intermedia (${media.probabilidad})`);
  ok(P(95).probabilidad! >= P(100).probabilidad! && P(100).probabilidad! >= P(105).probabilidad!, "prob monótona en la meta");
  ok(JSON.stringify(P(100)) === JSON.stringify(P(100)), "determinístico con semilla");
  ok(media.cierre!.p10! <= media.cierre!.p50 && media.cierre!.p50 <= media.cierre!.p90!, "p10 ≤ p50 ≤ p90");
  near(media.cierre!.p50, 1200, 40, "cierre ≈ 12 × 100");
  ok(media.mensual.length === 4 && media.mensual[0].idx === 8, "4 meses proyectados (sep-dic)");
  ok(media.metaAnual === 1200, "meta anual = Σ metas");
  // Dirección down: la meta es un techo.
  const down = P(130, { direccion: "down" });
  ok(down.probabilidad! >= 0.95, `down: meta 130 como techo → probable (${down.probabilidad})`);
  ok(P(80, { direccion: "down" }).probabilidad! <= 0.05, "down: meta 80 como techo → improbable");
  // Tasa: promedio vs promedio de metas.
  const tasa = pronosticoMeta({ realM: base8, metaM: N(12, () => 90), tipo: "rate", direccion: "up", seed: 1 }).resumen;
  ok(tasa.metaAnual === 90 && tasa.probabilidad! >= 0.95, "tasa: meta 90 vs ritmo 100 → probable");
  near(tasa.cierre!.p50, 100, 3, "tasa: promedio proyectado ≈ 100");
}
{
  // Serie exacta sin ruido: necesario vs ritmo = (1320 − 800) / 400 − 1 = +30%.
  const exacta = N(12, (i) => (i < 8 ? 100 : null));
  const r = pronosticoMeta({ realM: exacta, metaM: N(12, () => 110), tipo: "sum", direccion: "up" }).resumen;
  near(r.necesarioVsRitmoPct!, 30, 1e-9, "necesario vs ritmo +30%");
  ok(r.probabilidad === 0 && r.cierre!.p50 === 1200, "sin ruido: cierre exacto y prob 0");
  near(r.cumplP50!, (1200 / 1320) * 100, 1e-9, "cumplimiento proyectado");
}
{
  // Dato insuficiente: < 6 meses.
  const corto = pronosticoMeta({ realM: N(12, (i) => (i < 4 ? 100 + i : null)), metaM: N(12, () => 100), tipo: "sum", direccion: "up" });
  ok(!corto.resumen.suficiente && corto.resumen.probabilidad == null && /dato insuficiente/.test(corto.resumen.motivo ?? ""), "n<6 → dato insuficiente");
  ok(corto.resumen.cierre != null && corto.resumen.cierre.p10 == null && corto.cumplSims == null, "n<6 → punto sin rango ni sims");
  // CV del error > 50%.
  const volatil = pronosticoMeta({ realM: N(12, (i) => (i < 9 ? (i % 2 ? 300 : 20) : null)), metaM: N(12, () => 150), tipo: "sum", direccion: "up" });
  ok(!volatil.resumen.suficiente && /variable/.test(volatil.resumen.motivo ?? ""), `CV>50% → dato insuficiente (${volatil.resumen.motivo})`);
  // Sin meta: cierre sí, probabilidad no.
  const sinMeta = pronosticoMeta({ realM: base8, metaM: nul12(), tipo: "sum", direccion: "up" }).resumen;
  ok(sinMeta.probabilidad == null && sinMeta.motivo === "sin meta cargada" && sinMeta.cierre != null, "sin meta → sin probabilidad");
  // Año completo → cerrado (0 ó 1).
  const full = N(12, () => 100);
  const cerr = pronosticoMeta({ realM: full, metaM: N(12, () => 90), tipo: "sum", direccion: "up" }).resumen;
  ok(cerr.cerrado && cerr.probabilidad === 1 && cerr.cierre!.p50 === 1200, "año cerrado → prob 1");
  // Metas solo ene-jun y dato hasta ago → el período con meta ya cerró.
  const parcial = pronosticoMeta({ realM: base8, metaM: N(12, (i) => (i < 6 ? 200 : null)), tipo: "sum", direccion: "up" }).resumen;
  ok(parcial.cerrado && parcial.probabilidad === 0, "metas de meses pasados → cerrado, prob 0");
  // Un mes pasado sin dato queda fuera de meta y real (no se inventa).
  const hueco = base8.map((v, i) => (i === 3 ? null : v));
  const rh = pronosticoMeta({ realM: hueco, metaM: N(12, () => 100), tipo: "sum", direccion: "up", seed: 3 }).resumen;
  ok(rh.metaAnual === 1100, "mes pasado sin dato fuera de la meta anual");
  // Con año anterior → estacional.
  const prev = N(12, (i) => 100 + 30 * Math.sin((i / 12) * 2 * Math.PI) + ruido[i] * 3);
  const cur = N(12, (i) => (i < 8 ? prev[i] * 1.05 + ruido[(i + 3) % 12] * 2 : null));
  const est = pronosticoMeta({ realM: cur, metaM: N(12, (i) => prev[i]), histM: prev, tipo: "sum", direccion: "up", seed: 2 }).resumen;
  ok(est.metodo === "estacional_tendencia" && est.suficiente, `con año anterior → estacional (${est.metodo})`);
  ok(est.probabilidad! >= 0.8, `crece 5% sobre una meta = año anterior → probable (${est.probabilidad})`);
  // cumplimiento().
  ok(cumplimiento(50, 100, "up") === 50 && cumplimiento(200, 100, "down") === 50 && cumplimiento(1, 0, "up") === null, "cumplimiento por dirección");
  ok(lecturaProbabilidad(0.8) === "probable" && lecturaProbabilidad(0.5) === "en riesgo" && lecturaProbabilidad(0.1) === "improbable", "lectura de probabilidad");
}

// ── Rollup ──
{
  const c = (v: number) => new Float64Array(100).fill(v);
  const r = propagarPonderado([{ w: 50, sims: c(100) }, { w: 50, sims: c(80) }])!;
  near(r.p50, 90, 1e-9, "rollup: promedio ponderado");
  ok(r.probabilidad === 0 && r.cobertura === 100, "rollup: 90 < 100 → prob 0");
  ok(propagarPonderado([{ w: 50, sims: c(100) }, { w: 50, sims: null }]) === null, "rollup: cobertura 50% → null");
  const r2 = propagarPonderado([{ w: 70, sims: c(100) }, { w: 30, sims: null }])!;
  ok(r2.probabilidad === 1 && Math.round(r2.cobertura) === 70, "rollup: renormaliza con cobertura 70%");
  ok(propagarPonderado([]) === null, "rollup vacío → null");
}
{
  // Uniformes compartidas: dos KPIs idénticos → P(objetivo) = P(KPI) (no el producto).
  const k = (kpi: string): KpiSerie => ({ plan: "P", kpi, tipo: "sum", direccion: "up", realM: base8, metaM: N(12, () => 100) });
  const kp = [k("A"), k("B")];
  const res = pronosticarKpis(kp);
  const pA = res.get(kpiKey(kp[0]))!.resumen.probabilidad!;
  const o = pronosticarObjetivos([{ id: "o1", pesoEstrategico: 100, aportes: [{ key: kpiKey(kp[0]), w: 50 }, { key: kpiKey(kp[1]), w: 50 }] }], res);
  const po = o.objetivos.get("o1")!;
  near(po.probabilidad!, pA, 1e-12, "correlación: P(obj) = P(KPI) con KPIs idénticos");
  ok(o.global.suficiente && Math.abs(o.global.probabilidad! - pA) < 1e-12, "Cumplimiento Global propaga");
  // Objetivo con un KPI sin dato suficiente de mucho peso → insuficiente.
  const corto: KpiSerie = { plan: "P", kpi: "C", tipo: "sum", direccion: "up", realM: N(12, (i) => (i < 3 ? 1 : null)), metaM: N(12, () => 1) };
  const res2 = pronosticarKpis([kp[0], corto]);
  const o2 = pronosticarObjetivos([{ id: "o", pesoEstrategico: 100, aportes: [{ key: kpiKey(kp[0]), w: 30 }, { key: kpiKey(corto), w: 70 }] }], res2);
  ok(!o2.objetivos.get("o")!.suficiente && /30%/.test(o2.objetivos.get("o")!.motivo ?? ""), "objetivo con 30% de peso confiable → insuficiente");
  ok(!o2.global.suficiente, "global insuficiente si el único objetivo lo es");
}

// ── Descomposición ("por qué se movió") ──
{
  const s = descomponerSuma([{ nombre: "Meta", antes: 100, despues: 80 }, { nombre: "YouTube", antes: 50, despues: 60 }, { nombre: "TikTok", antes: null, despues: 5 }]);
  near(s.total, -5, 1e-12, "suma: total");
  near(s.contribuciones.reduce((a, c) => a + c.delta, 0), s.total, 1e-12, "suma: contribuciones suman el total");
  ok(s.contribuciones[0].nombre === "Meta", "suma: ordenado por |Δ|");
  const p = descomponerProducto({ volumen: 1000, tasa: 2 }, { volumen: 800, tasa: 2.3 });
  near(p.efectoVolumen + p.efectoTasa, p.total, 1e-9, "producto: efectos suman el total (exacto)");
  near(p.ptsVolumen! + p.ptsTasa!, p.variacionPct!, 1e-9, "producto: pts suman la variación %");
  ok(p.efectoVolumen < 0 && p.efectoTasa > 0, "producto: signos");
  const d = descomponerConDriver(1840, 1600, 800, 1000)!;
  near(d.efectoVolumen + d.efectoTasa, -240, 1e-9, "driver: exacto");
  ok(descomponerConDriver(10, 20, 0, 5) === null, "driver con base 0 → null");
  const cd = descomponerComponentesConDriver([
    { nombre: "Meta", antes: { base: 100, valor: 1000 }, despues: { base: 80, valor: 900 } },
    { nombre: "Google", antes: { base: 50, valor: 300 }, despues: { base: 60, valor: 420 } },
    { nombre: "TikTok", antes: { base: 0, valor: 0 }, despues: { base: 10, valor: 50 } },
  ]);
  near(cd.efectoVolumen + cd.efectoTasa, cd.total, 1e-9, "componentes con driver: suman el total");
  near(cd.componentes.reduce((a, c) => a + c.delta, 0), cd.total, 1e-9, "componentes: Σ Δ = total");
  const t = descomponerTasa([
    { nombre: "Orgánico", numAntes: 30, denAntes: 1000, numDespues: 28, denDespues: 900 },
    { nombre: "Social", numAntes: 5, denAntes: 500, numDespues: 12, denDespues: 1200 },
    { nombre: "Email", numAntes: 0, denAntes: 0, numDespues: 4, denDespues: 100 },
  ], 100)!;
  near(t.efectoMix + t.efectoTasa, t.total, 1e-12, "tasa: mix + tasa = Δ (exacto)");
  near(t.segmentos.reduce((a, x) => a + x.total, 0), t.total, 1e-12, "tasa: segmentos suman Δ");
  near(t.tasaAntes, (35 / 1500) * 100, 1e-12, "tasa antes");
  ok(t.efectoMix < 0, "tasa: más tráfico de Social (convierte menos) → mix negativo");
  ok(descomponerTasa([{ nombre: "x", numAntes: 1, denAntes: 0, numDespues: 1, denDespues: 1 }]) === null, "tasa con denominador total 0 → null");
}
{
  const inv: KpiSerie = { plan: "Pauta Mkt", kpi: "Inversión", tipo: "sum", direccion: "up", realM: N(12, (i) => (i < 8 ? (i === 7 ? 800 : 1000) : null)), metaM: nul12() };
  const imp: KpiSerie = { plan: "Pauta Mkt", kpi: "Impresiones", tipo: "sum", direccion: "up", realM: N(12, (i) => (i < 8 ? (i === 7 ? 1840 : 2000) : null)), metaM: nul12() };
  const pq = porQueSeMovio(imp, [inv, imp])!;
  ok(pq.mesAntes === 6 && pq.mesDespues === 7, "porQue: jul → ago");
  near(pq.ptsVolumen + pq.ptsTasa, pq.variacionPct, 1e-9, "porQue: pts suman la variación");
  near(pq.variacionPct, -8, 1e-9, "porQue: −8%");
  ok(pq.ptsVolumen < 0 && pq.ptsTasa > 0, "porQue: menos inversión, mejor CPM");
  ok(porQueSeMovio(inv, [inv, imp]) === null, "porQue: KPI sin driver → null");
}


// ── Costo de CPU (render del Seguimiento): 20 KPIs × 2.000 simulaciones + rollup ──
{
  const kpis: KpiSerie[] = N(20, (j) => ({ plan: "P", kpi: `K${j}`, tipo: j % 3 ? "sum" : "rate", direccion: "up", realM: base8.map((v) => (v == null ? null : v * (1 + j / 10))), metaM: N(12, () => 100 * (1 + j / 10)), histM: j % 2 ? N(12, (i) => 90 + ruido[i] * 4) : null }));
  const run = () => {
    const t0 = performance.now();
    const res = pronosticarKpis(kpis);
    pronosticarObjetivos(N(5, (o) => ({ id: `o${o}`, pesoEstrategico: 20, aportes: kpis.slice(o * 4, o * 4 + 4).map((k) => ({ key: kpiKey(k), w: 25 })) })), res);
    return performance.now() - t0;
  };
  // En frío (primera vez, como un render en una función recién levantada) y el mejor de 3 (sin ruido de la máquina).
  const frio = run();
  const ms = Math.min(frio, run(), run());
  console.log(`  costo: 20 KPIs × ${N_SIMS} sims + rollup = ${frio.toFixed(1)} ms en frío, ${ms.toFixed(1)} ms en caliente`);
  ok(ms < 100, `CPU < 100 ms (${ms.toFixed(1)})`);
}

if (fail) { console.error(`stats: ${okN} OK, ${fail} FAIL`); process.exit(1); }
console.log(`stats: ${okN} OK, 0 FAIL`);
