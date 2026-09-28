// Inteligencia estadística (portado de BIP sep-2026, adaptado a Drean): metas sugeridas (lib/stats/
// sugerir), Shapley (lib/stats/shapley + objetivos-pronostico), validación de pesos (lib/stats/
// validacion + lib/mapa-validacion) y marca vs activación (lib/marca-activacion, por rol de Drean).
// cd apps/web && npx tsx scripts/inteligencia.test.ts   (sin red ni Supabase)
import { sugerirMetas, sugerirTodas, redondearMeta } from "../src/lib/stats/sugerir";
import { shapley, contribucionBrecha, contribucionVariacion, rollupPonderado, SHAPLEY_EXACTO_MAX } from "../src/lib/stats/shapley";
import { correlacionRezagada, evidenciaVinculo, validarMapa, pValorR, icFisher, betaInc, transformar } from "../src/lib/stats/validacion";
import { clasificarRol, splitMarcaActivacion } from "../src/lib/marca-activacion";
import { mulberry32 } from "../src/lib/stats/prng";
import { validarMapaConDatos, serie24, porMesA24 } from "../src/lib/mapa-validacion";
import { contribucionesObjetivo, contribucionGlobal } from "../src/lib/objetivos-pronostico";

let fail = 0, okN = 0;
const ok = (c: unknown, m: string) => { if (c) okN++; else { fail++; console.error(`FAIL ${m}`); } };
const near = (a: number | null | undefined, b: number, tol: number, m: string) => ok(a != null && Math.abs(a - b) <= tol, `${m}: ${a} ≉ ${b} (±${tol})`);
const N = <T,>(n: number, f: (i: number) => T) => Array.from({ length: n }, (_, i) => f(i));
function normal(r: () => number) { const u = Math.max(1e-12, r()), v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

// ════════════════ Metas sugeridas ════════════════
{
  // Serie estacional conocida: año anterior con patrón, año actual = mismo patrón × 1,1 (8 meses cerrados).
  const r = mulberry32(3);
  const patron = [80, 70, 90, 100, 110, 100, 95, 105, 120, 130, 150, 200];
  const hist = patron.map((v) => v * 1000 * (1 + 0.03 * normal(r)));
  const real: (number | null)[] = patron.map((v, i) => (i < 8 ? v * 1100 * (1 + 0.03 * normal(r)) : null));
  const s = sugerirMetas({ realM: real, histM: hist, tipo: "sum", direccion: "up", ambicion: "conservadora" });
  ok(s.meses.join(",") === "8,9,10,11", `sugerir: solo meses por venir (${s.meses})`);
  ok(s.valores.slice(0, 8).every((v) => v == null), "sugerir: no toca meses cerrados");
  ok(/estacionalidad/.test(s.metodoTexto), `sugerir: método estacional (${s.metodoTexto})`);
  // Base ≈ patrón × tendencia 1,1 → sep ≈ 132.000, dic ≈ 220.000.
  near(s.base[8]! / 132000, 1, 0.1, "sugerir: base sep ≈ patrón × tendencia");
  near(s.base[11]! / 220000, 1, 0.1, "sugerir: base dic ≈ patrón × tendencia (estacionalidad)");
  ok(s.probabilidad != null && s.probabilidad > 0.25 && s.probabilidad < 0.8, `sugerir: conservadora ≈ coin flip (${s.probabilidad})`);
  const t = sugerirTodas({ realM: real, histM: hist, tipo: "sum", direccion: "up" });
  ok(t.agresiva.valores[11]! > t.realista.valores[11]! && t.realista.valores[11]! > t.conservadora.valores[11]!, "sugerir: más ambición → metas más altas");
  ok(t.agresiva.probabilidad! < t.realista.probabilidad! && t.realista.probabilidad! <= t.conservadora.probabilidad!, `sugerir: más ambición → menor probabilidad (${t.conservadora.probabilidad} ≥ ${t.realista.probabilidad} > ${t.agresiva.probabilidad})`);
  near(t.realista.valores[10]! / t.conservadora.valores[10]!, 1.1, 0.02, "sugerir: realista = +10%");
  // Dirección "down" (costo): la ambición BAJA la meta y la probabilidad sigue cayendo.
  const d = sugerirTodas({ realM: real, histM: hist, tipo: "sum", direccion: "down" });
  ok(d.agresiva.valores[9]! < d.conservadora.valores[9]!, "sugerir down: agresiva = más baja");
  ok(d.agresiva.probabilidad! < d.conservadora.probabilidad!, "sugerir down: agresiva menos probable");
  // Tasa en %: tope 100.
  const rate = sugerirMetas({ realM: [95, 96, 97, 98, 97, 98, 99, 98, null, null, null, null], tipo: "rate", direccion: "up", ambicion: "agresiva", unidad: "%" });
  ok(rate.valores.slice(8).every((v) => v != null && v <= 100), "sugerir %: tope 100");
  // Pocos datos: propone la base pero sin probabilidad, con motivo.
  const poco = sugerirMetas({ realM: [100, 110, 105, null, null, null, null, null, null, null, null, null], tipo: "sum", direccion: "up", ambicion: "realista" });
  ok(poco.valores[5] != null && poco.probabilidad == null && /insuficiente/.test(poco.motivo ?? ""), `sugerir: dato insuficiente → sin probabilidad (${poco.motivo})`);
  // Sin datos / año cerrado.
  ok(sugerirMetas({ realM: N(12, () => null), tipo: "sum", direccion: "up", ambicion: "realista" }).motivo != null, "sugerir: sin datos → motivo");
  ok(/cerrado/.test(sugerirMetas({ realM: N(12, (i) => 100 + i), tipo: "sum", direccion: "up", ambicion: "realista" }).motivo ?? ""), "sugerir: año cerrado → nada que sugerir");
  // Año que arranca (enero sin datos, año anterior completo): sugiere los 12 meses.
  const ene = sugerirMetas({ realM: N(12, () => null), histM: hist, tipo: "sum", direccion: "up", ambicion: "realista" });
  ok(ene.meses.length === 12, `sugerir: año nuevo → 12 meses (${ene.meses.length})`);
  ok(redondearMeta(123456, "sum") === 123000 && redondearMeta(12.345, "rate") === 12.3 && redondearMeta(87.66, "sum") === 87.7, "redondeo de planilla");
  // Determinismo.
  ok(sugerirMetas({ realM: real, histM: hist, tipo: "sum", direccion: "up", ambicion: "realista" }).probabilidad === t.realista.probabilidad, "sugerir: determinístico");
}

// ════════════════ Shapley ════════════════
{
  // Juego aditivo: Shapley = aporte individual.
  const phi = shapley(3, (m) => (m[0] ? 5 : 0) + (m[1] ? 3 : 0) + (m[2] ? -2 : 0));
  ok(phi.every((x, i) => Math.abs(x - [5, 3, -2][i]) < 1e-12), "shapley aditivo = aportes");
  // Interacción pura (v=1 solo si están los dos): se reparte 50/50.
  const inter = shapley(2, (m) => (m[0] && m[1] ? 1 : 0));
  ok(Math.abs(inter[0] - 0.5) < 1e-12 && Math.abs(inter[1] - 0.5) < 1e-12, "shapley interacción → mitades");
  // Juego del "guante" 3 jugadores (clásico): v=1 si hay L y al menos una R → φ = (2/3, 1/6, 1/6).
  const glove = shapley(3, (m) => (m[0] && (m[1] || m[2]) ? 1 : 0));
  near(glove[0], 2 / 3, 1e-12, "shapley guante L"); near(glove[1], 1 / 6, 1e-12, "shapley guante R1");
  // Eficiencia y Monte Carlo (n > exacto) ≈ exacto para juego aditivo con peso.
  const n = SHAPLEY_EXACTO_MAX + 2;
  const pesos = N(n, (i) => i + 1);
  const mc = shapley(n, (m) => pesos.reduce((s, w, i) => s + (m[i] ? w : 0), 0) ** 1, { muestras: 200, seed: 1 });
  ok(mc.every((x, i) => Math.abs(x - pesos[i]) < 1e-9), "shapley MC: aditivo exacto (antitético)");
  const nl = (m: boolean[]) => { const k = m.filter(Boolean).length; return k * k; };
  const mcNl = shapley(n, nl, { muestras: 400, seed: 2 });
  near(mcNl.reduce((s, x) => s + x, 0), n * n, 1e-6, "shapley MC: eficiencia Σφ = v(N) − v(∅)");
  ok(mcNl.every((x) => Math.abs(x - n) < 1e-6), "shapley MC: simétrico → iguales");

  // Brecha del objetivo: rollup lineal → φ_i = w_i/Σw · (c_i − 100).
  const kpis = [
    { nombre: "Alcance", grupo: "Plan de Medios", w: 50, cumpl: 80 },
    { nombre: "Tráfico web", grupo: "Web / Ecommerce", w: 30, cumpl: 100 },
    { nombre: "Engagement", grupo: "Redes Sociales", w: 20, cumpl: 60 },
    { nombre: "Sin dato", grupo: "Web / Ecommerce", w: 40, cumpl: null },
  ];
  const b = contribucionBrecha(kpis)!;
  near(b.hasta, rollupPonderado(kpis.map((k) => ({ w: k.w, c: k.cumpl }))) ?? 0, 1e-9, "brecha: hasta = rollup");
  near(b.hasta, 82, 1e-9, "brecha: rollup 0,5·80+0,3·100+0,2·60 = 82");
  near(b.total, -18, 1e-9, "brecha: total −18 pts");
  near(b.aportes.reduce((s, a) => s + a.puntos, 0), b.total, 1e-9, "brecha: Σ aportes = total (eficiencia)");
  near(b.aportes.find((a) => a.nombre === "Alcance")!.puntos, -10, 1e-9, "brecha: Alcance −10 pts");
  near(b.aportes.find((a) => a.nombre === "Engagement")!.puntos, -8, 1e-9, "brecha: Engagement −8 pts");
  ok(!b.aportes.some((a) => a.nombre === "Sin dato"), "brecha: KPI sin dato no juega");
  ok(b.aportes[0]!.nombre === "Alcance", "brecha: ordenado por mayor aporte negativo");
  near(b.grupos.find((g) => g.grupo === "Plan de Medios")!.puntos, -10, 1e-9, "brecha: grupo (categoría) = Σ KPIs");
  near(b.grupos.reduce((s, g) => s + g.puntos, 0), b.total, 1e-9, "brecha: Σ grupos = total");
  near(b.aportes.find((a) => a.nombre === "Alcance")!.pctDelTotal, 10 / 18 * 100, 1e-9, "brecha: % del total");
  ok(contribucionBrecha([{ nombre: "x", w: 10, cumpl: null }]) === null, "brecha: sin datos → null");
  // Sobrecumplimiento capado: un KPI al 150% no compensa (cap 100).
  const cap = contribucionBrecha([{ nombre: "a", w: 50, cumpl: 150 }, { nombre: "b", w: 50, cumpl: 50 }])!;
  near(cap.hasta, 75, 1e-9, "brecha: cap 100 en el rollup"); near(cap.aportes.find((a) => a.nombre === "a")!.puntos, 0, 1e-9, "brecha: sobrecumplido aporta 0");

  // Variación con cambio de COBERTURA (no lineal): Σ = hasta − desde exacto.
  const v = contribucionVariacion([
    { nombre: "A", w: 50, cumpl: 90, cumplAntes: 70 },
    { nombre: "B", w: 50, cumpl: 40, cumplAntes: null }, // aparece el dato
    { nombre: "C", w: 20, cumpl: 100, cumplAntes: 100 },
  ])!;
  near(v.desde, (50 * 70 + 20 * 100) / 70, 1e-9, "variación: desde = rollup sin B");
  near(v.hasta, (50 * 90 + 50 * 40 + 20 * 100) / 120, 1e-9, "variación: hasta = rollup con B");
  near(v.aportes.reduce((s, a) => s + a.puntos, 0), v.total, 1e-9, "variación: Σ aportes = total");
  ok(v.aportes.find((a) => a.nombre === "B")!.puntos < 0 && v.aportes.find((a) => a.nombre === "A")!.puntos > 0, "variación: A empuja arriba, B (entra bajo) abajo");
  near(v.aportes.find((a) => a.nombre === "C")!.puntos, 0, 1e-9, "variación: C sin cambio aporta 0 (jugador nulo)");
  // Caso lineal sin cambio de cobertura: aporte = w/Σw · Δc.
  const lin = contribucionVariacion([{ nombre: "A", w: 60, cumpl: 90, cumplAntes: 80 }, { nombre: "B", w: 40, cumpl: 50, cumplAntes: 70 }])!;
  near(lin.aportes.find((a) => a.nombre === "A")!.puntos, 6, 1e-9, "variación lineal: A +6");
  near(lin.aportes.find((a) => a.nombre === "B")!.puntos, -8, 1e-9, "variación lineal: B −8");
}

// ════════════════ Validación de pesos ════════════════
{
  near(betaInc(0.5, 2, 2), 0.5, 1e-10, "betaInc simétrica");
  near(pValorR(0, 20), 1, 1e-9, "p(r=0) = 1");
  near(pValorR(0.444, 20), 0.05, 0.003, "p(r=0,444; n=20) ≈ 0,05 (tabla)");
  near(pValorR(0.561, 12), 0.058, 0.004, "p(r=0,561; n=12) ≈ 0,058 (tabla crítica 0,576@0,05)");
  const ic = icFisher(0.5, 30);
  ok(ic[0] < 0.5 && ic[1] > 0.5 && ic[0] > 0.1 && ic[1] < 0.8, `IC Fisher razonable (${ic.map((x) => x.toFixed(2))})`);
  ok(transformar([100, 110, null, 121], "dlog")[1]! > 0.09 && transformar([100, 110, null, 121], "dlog")[2] === null, "transformar Δlog y nulls");

  // KPI que ADELANTA 2 meses al resultado (con ruido) → recupera lag 2, fuerte.
  const r = mulberry32(12);
  const n = 30;
  const kpi = N(n, (i) => 1000 * Math.exp(0.02 * i + 0.15 * normal(r)));
  const ventas = N(n, (i) => (i >= 2 ? kpi[i - 2] * 3 * Math.exp(0.03 * normal(r)) : 3000));
  const c = correlacionRezagada(kpi, ventas)!;
  ok(c.lag === 2, `lag recuperado = 2 (${c.lag})`);
  ok(c.r > 0.8 && c.pAjustado < 0.01, `r fuerte y significativo con Bonferroni (r=${c.r.toFixed(2)}, p=${c.pAjustado.toExponential(1)})`);
  ok(c.porLag.length === 4 && c.transformacion === "dlog", "4 rezagos probados, Δlog");
  ok(evidenciaVinculo(kpi, ventas, "up").nivel === "fuerte", "evidencia fuerte");
  // Dos TENDENCIAS independientes: en niveles correlacionan (espuria), en variaciones no.
  const a = N(30, (i) => 100 + 5 * i + 3 * normal(r)), b2 = N(30, (i) => 50 + 2 * i + 3 * normal(r));
  const nivel = correlacionRezagada(a, b2, { transformacion: "nivel", maxLag: 0 })!;
  const dif = correlacionRezagada(a, b2, { maxLag: 0 })!;
  ok(nivel.r > 0.9 && Math.abs(dif.r) < 0.5, `espuria por tendencia: niveles r=${nivel.r.toFixed(2)} vs variaciones r=${dif.r.toFixed(2)}`);
  ok(evidenciaVinculo(a, b2, "up", { maxLag: 0 }).nivel !== "fuerte", "tendencias independientes → no fuerte");
  // KPI de costo (down) que sube cuando bajan las ventas → esperado (no "contraria").
  const costo = ventas.map((v) => 1e7 / v);
  const ec = evidenciaVinculo(costo, ventas, "down");
  ok(ec.nivel === "fuerte" || ec.nivel === "moderada", `KPI de costo con r<0 → evidencia (${ec.nivel})`);
  ok(evidenciaVinculo(costo, ventas, "up").nivel === "contraria", "KPI 'up' con r<0 → contraria");
  // Pocos datos.
  ok(evidenciaVinculo(kpi.slice(0, 8), ventas.slice(0, 8), "up").nivel === "sin datos", "n<12 → sin datos");

  const val = validarMapa([
    { plan: "Mercado", kpi: "Share of Search", objetivoId: "o1", peso: 10, direccion: "up", serie: kpi },
    { plan: "Redes", kpi: "Engagement rate", objetivoId: "o1", peso: 40, direccion: "up", serie: N(n, () => 5 + normal(r)) },
    { plan: "Web", kpi: "Ingresos", objetivoId: "o2", peso: 50, direccion: "up", serie: ventas },
  ], { nombre: "Ingresos", serie: ventas, plan: "Web", kpi: "Ingresos" });
  const sos = val.vinculos.find((v) => v.kpi === "Share of Search")!;
  ok(sos.nivel === "fuerte" && /podría pesar más/.test(sos.sugerencia ?? ""), "validar: SoS fuerte con peso bajo → sugerir subir");
  ok(/2 meses de adelanto/.test(sos.lectura), `validar: lectura con el rezago (${sos.lectura})`);
  const er = val.vinculos.find((v) => v.kpi === "Engagement rate")!;
  ok(er.nivel === "sin evidencia" && /revisá/.test(er.sugerencia ?? ""), `validar: ER sin relación y peso alto → revisar (${er.nivel})`);
  ok(val.vinculos.find((v) => v.kpi === "Ingresos")!.nivel === "es el resultado", "validar: el propio resultado no se autovalida");
  ok(/no una prueba de causa/.test(val.advertencia) && !/\bcausa\b/.test(sos.lectura), "validar: advertencia de causalidad y lecturas sin 'causa'");
  ok(val.resumen.fuerte === 1 && val.resumen.sinEvidencia === 1, "validar: resumen");
}

// ════════════════ Marca vs activación (rol de comunicación de Drean) ════════════════
{
  ok(clasificarRol("Awareness").rol === "marca", "Awareness → marca");
  ok(clasificarRol("Conversión").rol === "activacion", "Conversión (ecommerce) → activación");
  ok(clasificarRol("Consideración").rol === "mixto", "Consideración → mixto");
  ok(clasificarRol("Build").rol === "marca", "Build → marca");
  ok(clasificarRol("Consideración", "TV Cable").rol === "marca" && clasificarRol(null, "OOH").rol === "marca", "offline → marca siempre");
  ok(clasificarRol("—").rol === "mixto", "sin rol → mixto");
  const s = splitMarcaActivacion([
    { nombre: "Awareness", inversion: 300 }, { nombre: "Conversión", inversion: 500 },
    { nombre: "Consideración", inversion: 200 }, { nombre: "—", inversion: 0 },
  ])!;
  near(s.total, 1000, 1e-9, "split: total (sin ítems en 0)");
  near(s.pctMarca, 40, 1e-9, "split: marca 30% + mitad de mixto 10% = 40%");
  near(s.pctMixto, 20, 1e-9, "split: mixto 20%");
  ok(s.lectura === "cargado a activación" && Math.round(s.desvioPts) === -20, `split: 40:60 vs 60:40 → cargado a activación (${s.desvioPts})`);
  ok(/40:60/.test(s.texto), "split: texto con la proporción");
  ok(splitMarcaActivacion([{ nombre: "Awareness", inversion: 600 }, { nombre: "Conversión", inversion: 400 }])!.lectura === "en línea con la referencia", "split 60:40 → en línea");
  ok(splitMarcaActivacion([{ nombre: "Awareness", inversion: 900 }, { nombre: "Conversión", inversion: 100 }])!.lectura === "cargado a marca", "split 90:10 → cargado a marca");
  ok(splitMarcaActivacion([]) === null, "split: sin inversión → null");
}

// ════════════════ Shapley sobre el rollup de Drean (objetivos-pronostico) ════════════════
{
  const serie = (vals: (number | null)[]) => [...vals, ...Array(12 - vals.length).fill(null)] as (number | null)[];
  const conex = [
    { kpi: "Alcance único", plan: "Pauta Mkt", peso: 50, cumplYtd: 80, serie: serie([90, 70]) },
    { kpi: "Tráfico web (usuarios)", plan: "Web / Ecommerce", peso: 30, cumplYtd: 100, serie: serie([100, 100]) },
    { kpi: "Engagement rate", plan: "Instagram", peso: 20, cumplYtd: 60, serie: serie([50, 60]) },
  ];
  const { contribucion, variacion } = contribucionesObjetivo("o1", conex, 1);
  near(contribucion!.total, -18, 1e-9, "objetivo: brecha YTD −18");
  near(contribucion!.aportes.reduce((a, x) => a + x.puntos, 0), -18, 1e-9, "objetivo: Σ aportes = brecha");
  near(variacion!.total, (50 * 70 + 30 * 100 + 20 * 60) / 100 - (50 * 90 + 30 * 100 + 20 * 50) / 100, 1e-9, "objetivo: variación feb vs ene");
  ok(contribucionesObjetivo("o1", conex, 0).variacion === null, "objetivo: sin mes anterior → sin variación");
  const g = contribucionGlobal([
    { nombre: "TOM", pesoEstrategico: 50, cumplYtd: 82, contribucion },
    { nombre: "SOM", pesoEstrategico: 50, cumplYtd: 100, contribucion: contribucionBrecha([{ nombre: "Clicks", grupo: "Pauta Mkt", w: 100, cumpl: 100 }]) },
  ])!;
  near(g.total, -9, 1e-9, "global: brecha = 0,5·82 + 0,5·100 − 100 = −9");
  near(g.porKpi.reduce((a, x) => a + x.puntos, 0), g.total, 1e-9, "global: Σ KPIs = brecha (linealidad)");
  near(g.porGrupo.find((x) => x.grupo === "Pauta Mkt")!.puntos, -5, 1e-9, "global: Pauta Mkt −5 (0,5 × −10)");
  ok(g.porKpi[0]!.nombre === "Alcance único", "global: ordenado por lo que más resta");
}

// ════════════════ Validación del Mapa con datos (mapa-validacion) ════════════════
{
  const r = mulberry32(5);
  const kpi24 = N(24, (i) => 1000 * Math.exp(0.01 * i + 0.2 * normal(r)));
  const ventas24 = N(24, (i) => (i >= 1 ? kpi24[i - 1] * 2 * Math.exp(0.03 * normal(r)) : 2000));
  const kh = [
    { plan: "Mercado", kpi: "Share of Search", unit: "%", direccion: "up" as const, realM: kpi24.slice(12), histM: kpi24.slice(0, 12) },
    { plan: "Redes Sociales", kpi: "Engagement rate", unit: "%", direccion: "up" as const, realM: N(12, () => 3 + normal(r) * 0.3), histM: N(12, () => 3 + normal(r) * 0.3) },
  ];
  const mapa = { objetivos: [{ id: "tom", nombre: "TOM" }], planes: [{ nombre: "Mercado", kpis: [{ nombre: "Share of Search", vinculos: { tom: 10 } }] }, { nombre: "Redes Sociales", kpis: [{ nombre: "Engagement rate", vinculos: { tom: 60 } }, { nombre: "KPI sin dato", vinculos: { tom: 5 } }] }] };
  const res = validarMapaConDatos(mapa, kh, [{ id: "ingresos", nombre: "Ingresos", serie24: ventas24 }, { id: "corto", nombre: "Corto", serie24: N(24, (i) => (i > 20 ? 1 : null)) }]);
  ok(res.length === 1 && res[0].id === "ingresos", "validación: descarta resultados con < 13 meses");
  const v = res[0].vinculos;
  ok(v.find((x) => x.kpi === "Share of Search")!.nivel === "fuerte" && v.find((x) => x.kpi === "Share of Search")!.corr!.lag === 1, "validación: SoS adelanta 1 mes → fuerte");
  ok(v.find((x) => x.kpi === "KPI sin dato")!.nivel === "sin datos", "validación: KPI sin serie → sin datos");
  ok(/revisá/.test(v.find((x) => x.kpi === "Engagement rate")!.sugerencia ?? ""), "validación: peso alto sin evidencia → revisar");
  const s24 = serie24({ realM: N(12, (i) => 200 + i), histM: N(12, (i) => 100 + i) });
  ok(s24.length === 24 && s24[0] === 100 && s24[11] === 111 && s24[12] === 200 && s24[23] === 211, "validación: montos $ nominales tal cual (sin ajuste por inflación), historia + año");
  const pm = porMesA24([{ mes: "2025-03", valor: 5 }, { mes: "2026-12", valor: 7 }, { mes: "2024-01", valor: 1 }], 2026);
  ok(pm[2] === 5 && pm[23] === 7 && pm.filter((x) => x != null).length === 2, "validación: share YYYY-MM → eje de 24 meses");
}

if (fail) { console.error(`inteligencia: ${okN} OK, ${fail} FAIL`); process.exit(1); }
console.log(`inteligencia: ${okN} OK, 0 FAIL`);
