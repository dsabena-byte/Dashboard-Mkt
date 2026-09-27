// Test del MMM-lite (lib/stats/mmm.ts): recupera parámetros conocidos de series sintéticas,
// bandas bootstrap, dato insuficiente, escenarios y optimizador.
// npx tsx scripts/mmm.test.ts
import { ajustarMmm, adstock, hill, simularMmm, optimizarMmm, resolver, type MmmInput, type MmmOk } from "../src/lib/stats/mmm";
import { mulberry32 } from "../src/lib/stats/prng";

let fail = 0, okN = 0;
const ok = (c: unknown, m: string) => { if (c) okN++; else { fail++; console.error(`FAIL ${m}`); } };
const near = (a: number | null | undefined, b: number, tol: number, m: string) => ok(a != null && Math.abs(a - b) <= tol, `${m}: ${a} ≉ ${b} (±${tol})`);

// Normal estándar (Box-Muller) con PRNG determinístico.
function normal(r: () => number) { const u = Math.max(1e-12, r()), v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

interface Verdad { nombre: string; decay: number; K: number; s: number; beta: number; offline?: boolean }
/** Serie sintética: y = base + Σ β·hill(adstock(x/x̄)) + ruido, con la MISMA forma del modelo. */
function sintetica(n: number, verdad: Verdad[], opts: { base?: number; ruido?: number; seed?: number; granularidad?: "mensual" | "semanal"; tendencia?: number } = {}) {
  const r = mulberry32(opts.seed ?? 7);
  const base = opts.base ?? 1000, ruido = opts.ruido ?? 0.02;
  const inv = verdad.map((_, m) => Array.from({ length: n }, () => {
    const on = r() > 0.2; // 20% de períodos apagados
    return on ? (400 + 1200 * r()) * (m + 1) : 0;
  }));
  const contrib = verdad.map((v, m) => {
    const mu = inv[m].reduce((s, x) => s + x, 0) / n;
    const a = adstock(inv[m].map((x) => x / mu), v.decay);
    return a.map((x) => v.beta * hill(x, v.K, v.s));
  });
  const kpi = Array.from({ length: n }, (_, t) => {
    const tr = opts.tendencia ? opts.tendencia * (n > 1 ? (2 * t) / (n - 1) - 1 : 0) : 0;
    const clean = base + tr + contrib.reduce((s, c) => s + c[t], 0);
    return clean * (1 + ruido * normal(r));
  });
  const input: MmmInput = { periodos: kpi.map((_, t) => `p${t + 1}`), kpi, kpiNombre: "Ventas", granularidad: opts.granularidad ?? "semanal", medios: verdad.map((v, m) => ({ nombre: v.nombre, inversion: inv[m], offline: v.offline })) };
  const contribTot = contrib.map((c) => c.reduce((s, x) => s + x, 0));
  return { input, contribTot, kpiTot: kpi.reduce((s, x) => s + x, 0), inv };
}

// ── Transformaciones ──
{
  const a = adstock([10, 10, 10, 10], 0.5, 10);
  ok(a.every((v) => Math.abs(v - 10) < 1e-9), "adstock normalizado: inversión constante → mismo nivel");
  const b = adstock([10, 0, 0, 0], 0.5, 0);
  near(b[0], 5, 1e-9, "adstock: primer período (1−λ)·x"); near(b[1], 2.5, 1e-9, "adstock: arrastre λ");
  near(b.reduce((s, v) => s + v, 0) + b[3], 10, 1e-9, "adstock: conserva el total (con la cola)");
  near(hill(1, 1, 1), 0.5, 1e-12, "hill: a=K → 0,5");
  ok(hill(0, 1, 2) === 0 && hill(100, 1, 1) > 0.98, "hill: 0 y saturación");
  ok(hill(0.5, 1, 2) < hill(0.5, 1, 1), "hill: s=2 es S (más lento al inicio)");
  const x = resolver([[4, 1], [1, 3]], [1, 2]);
  near(x?.[0], 1 / 11, 1e-9, "resolver 2×2 (x)"); near(x?.[1], 7 / 11, 1e-9, "resolver 2×2 (y)");
  ok(resolver([[1, 1], [1, 1]], [1, 2]) === null, "resolver: singular → null");
}

// ── Recuperación de parámetros: 104 semanas, 3 medios, ruido 2% ──
{
  const verdad: Verdad[] = [
    { nombre: "TV", decay: 0.6, K: 1.0, s: 1, beta: 300, offline: true },
    { nombre: "Meta", decay: 0.2, K: 0.7, s: 1, beta: 200 },
    { nombre: "Google", decay: 0.1, K: 1.4, s: 1, beta: 250 },
  ];
  const { input, contribTot, kpiTot } = sintetica(104, verdad, { seed: 11 });
  const t0 = Date.now();
  const res = ajustarMmm(input, { bootstrap: 80, seed: "t1" });
  const ms = Date.now() - t0;
  ok(res.ok, "semanal 104: ajusta");
  if (res.ok) {
    ok(res.ajuste.r2 > 0.8, `semanal: R² alto (${res.ajuste.r2.toFixed(3)})`);
    for (const [m, v] of verdad.entries()) {
      const r = res.medios.find((x) => x.nombre === v.nombre)!;
      const rel = Math.abs(r.contribucion.p50 - contribTot[m]) / contribTot[m];
      ok(rel < 0.3, `semanal ${v.nombre}: contribución recuperada (err ${(rel * 100).toFixed(0)}%, est ${r.contribucion.p50.toFixed(0)} vs ${contribTot[m].toFixed(0)})`);
      near(r.decay, v.decay, 0.25, `semanal ${v.nombre}: decay`);
      ok(r.contribucion.p10 <= contribTot[m] * 1.15 && r.contribucion.p90 >= contribTot[m] * 0.85, `semanal ${v.nombre}: la verdad cae cerca de la banda p10–p90 [${r.contribucion.p10.toFixed(0)}, ${r.contribucion.p90.toFixed(0)}] ∋ ${contribTot[m].toFixed(0)}`);
      ok(r.evidencia === "con evidencia", `semanal ${v.nombre}: con evidencia (${r.evidencia}, p=${r.probAporte.toFixed(2)})`);
      ok(r.contribucion.p10 <= r.contribucion.p50 && r.contribucion.p50 <= r.contribucion.p90, `semanal ${v.nombre}: bandas ordenadas`);
      ok(r.mroi.p50 >= 0 && r.roi.p50 > 0, `semanal ${v.nombre}: ROI y mROI ≥ 0`);
      ok(r.curva.length === 25 && r.curva[0].p50 === 0 && r.curva.every((p, i) => i === 0 || p.p50 >= r.curva[i - 1].p50 - 1e-9), `semanal ${v.nombre}: curva de respuesta creciente desde 0`);
    }
    const sumPct = res.medios.reduce((s, r) => s + (r.contribucion.p50), 0);
    const truePct = contribTot.reduce((s, c) => s + c, 0);
    ok(Math.abs(sumPct - truePct) / truePct < 0.2, `semanal: contribución total de medios ±20% (${(sumPct / kpiTot * 100).toFixed(1)}% vs ${(truePct / kpiTot * 100).toFixed(1)}%)`);
    ok(res.confianza !== "baja" || res.obsPorParametro < 4, `semanal: confianza coherente (${res.confianza}, ${res.obsPorParametro.toFixed(1)} obs/param)`);
    ok(res.ajuste.backtest != null && res.ajuste.backtest.h === 8, "semanal: backtest de 8 semanas");
    ok(res.ajuste.backtest!.mape != null && res.ajuste.backtest!.mape! < 10, `semanal: backtest MAPE bajo (${res.ajuste.backtest!.mape?.toFixed(1)}%)`);
    ok(res.draws.length >= 70, `semanal: réplicas bootstrap (${res.draws.length})`);
    ok(ms < 4000, `semanal: CPU razonable (${ms} ms)`);
    // Determinismo.
    const res2 = ajustarMmm(input, { bootstrap: 80, seed: "t1" }) as MmmOk;
    ok(res2.medios.every((r, i) => r.contribucion.p10 === res.medios[i].contribucion.p10), "semanal: misma semilla → mismas bandas");
    // Escenarios.
    const hoy = Object.fromEntries(res.medios.map((r) => [r.nombre, r.inversionHoy]));
    const e0 = simularMmm(res, hoy);
    near(e0.delta.p50, 0, 1e-6, "escenario = hoy → delta 0");
    const mas = simularMmm(res, { ...hoy, Meta: hoy.Meta * 1.5 });
    ok(mas.delta.p50 > 0 && mas.delta.p10 <= mas.delta.p50 && mas.delta.p90 >= mas.delta.p50, "escenario +50% Meta → sube el KPI (banda ordenada)");
    const cero = simularMmm(res, { TV: 0, Meta: 0, Google: 0 });
    ok(cero.delta.p50 < 0 && cero.porMedio.every((p) => Math.abs(p.contribucion.p50) < 1e-9), "escenario sin pauta → solo base");
    // Optimizador: mismo total, no empeora (curvas MAP).
    const total = Object.values(hoy).reduce((s, v) => s + v, 0);
    const opt = optimizarMmm(res, total);
    near(Object.values(opt).reduce((s, v) => s + v, 0), total, total * 1e-6, "optimizador: respeta el total");
    ok(simularMmm(res, opt).kpi.p50 >= simularMmm(res, hoy).kpi.p50 - 1e-6, "optimizador: no empeora el KPI (MAP)");
    ok(res.medios.every((r) => opt[r.nombre] >= r.inversionHoy * 0.5 - 1e-6 && opt[r.nombre] <= r.inversionHoy * 2 + 1e-6), "optimizador: topes 50–200%");
  }
}

// ── Medio SIN efecto: el modelo no le inventa contribución ──
{
  const verdad: Verdad[] = [
    { nombre: "Meta", decay: 0.3, K: 1, s: 1, beta: 300 },
    { nombre: "Display", decay: 0.3, K: 1, s: 1, beta: 0 },
  ];
  const { input, kpiTot } = sintetica(104, verdad, { seed: 5 });
  const res = ajustarMmm(input, { bootstrap: 80, seed: "t2" });
  ok(res.ok, "medio nulo: ajusta");
  if (res.ok) {
    const d = res.medios.find((r) => r.nombre === "Display")!;
    ok(d.contribucion.p50 / kpiTot < 0.02, `medio nulo: contribución ≈ 0 (${(d.contribucion.p50 / kpiTot * 100).toFixed(2)}%)`);
    ok(d.evidencia !== "con evidencia", `medio nulo: no se marca "con evidencia" (${d.evidencia})`);
    ok(res.medios.find((r) => r.nombre === "Meta")!.evidencia === "con evidencia", "medio real: con evidencia");
  }
}

// ── Mensual 24 meses: ajusta, confianza baja, bandas MÁS anchas que semanal ──
{
  const verdad: Verdad[] = [
    { nombre: "Meta", decay: 0.1, K: 1, s: 1, beta: 300 },
    { nombre: "Google", decay: 0.1, K: 1, s: 1, beta: 200 },
  ];
  const men = sintetica(24, verdad, { seed: 3, granularidad: "mensual", ruido: 0.04 });
  const sem = sintetica(104, verdad, { seed: 3, granularidad: "semanal", ruido: 0.04 });
  const rm = ajustarMmm(men.input, { bootstrap: 100, seed: "m" });
  const rs = ajustarMmm(sem.input, { bootstrap: 100, seed: "m" });
  ok(rm.ok && rs.ok, "mensual 24 y semanal 104: ajustan");
  if (rm.ok && rs.ok) {
    ok(rm.confianza === "baja", `mensual: confianza baja (${rm.confianza}, ${rm.obsPorParametro.toFixed(1)} obs/param)`);
    ok(rm.avisos.some((a) => /mensual/i.test(a)), "mensual: aviso de pocos puntos");
    const ancho = (r: MmmOk) => r.medios.reduce((s, m) => s + (m.contribucionPct.p90 - m.contribucionPct.p10), 0);
    ok(ancho(rm) > ancho(rs), `mensual: bandas más anchas que semanal (${ancho(rm).toFixed(1)} vs ${ancho(rs).toFixed(1)} pp)`);
    const m = rm.medios.find((x) => x.nombre === "Meta")!;
    const tm = men.contribTot[0];
    ok(m.contribucion.p10 <= tm * 1.25 && m.contribucion.p90 >= tm * 0.75, `mensual Meta: la verdad cerca de la banda [${m.contribucion.p10.toFixed(0)}, ${m.contribucion.p90.toFixed(0)}] ∋ ${tm.toFixed(0)}`);
  }
}

// ── Dato insuficiente y exclusiones ──
{
  const v: Verdad[] = [{ nombre: "Meta", decay: 0.2, K: 1, s: 1, beta: 200 }];
  const corto = sintetica(8, v, { granularidad: "mensual" });
  const r = ajustarMmm(corto.input);
  ok(!r.ok && /insuficiente/.test(r.motivo), "8 meses → dato insuficiente");
  const semCorto = sintetica(20, v, { granularidad: "semanal" });
  ok(!ajustarMmm(semCorto.input).ok, "20 semanas → dato insuficiente");
  // Muchos medios para pocos meses → insuficiente por parámetros.
  const muchos = sintetica(12, [0, 1, 2, 3].map((i) => ({ nombre: `M${i}`, decay: 0.2, K: 1, s: 1, beta: 100 })), { granularidad: "mensual" });
  const rm = ajustarMmm(muchos.input);
  ok(!rm.ok && /parámetro/.test(rm.motivo), `12 meses × 4 medios → insuficiente por parámetros (${!rm.ok ? rm.motivo : ""})`);
  // Medio con inversión constante → excluido con motivo.
  const base = sintetica(30, v, { granularidad: "mensual", seed: 9 });
  base.input.medios.push({ nombre: "Radio", inversion: Array(30).fill(1000) });
  base.input.medios.push({ nombre: "Prensa", inversion: [500, 0, 0, 0, ...Array(26).fill(0)] });
  const re = ajustarMmm(base.input, { bootstrap: 20 });
  ok(re.ok, "con medios no estimables: igual ajusta con el resto");
  ok(re.excluidos.some((e) => e.nombre === "Radio" && /constante/.test(e.motivo)), "Radio constante → excluido");
  ok(re.excluidos.some((e) => e.nombre === "Prensa" && /período/.test(e.motivo)), "Prensa con 1 período → excluido");
  const nada = ajustarMmm({ ...base.input, medios: [{ nombre: "Radio", inversion: Array(30).fill(1000) }] });
  ok(!nada.ok && /ningún medio/.test(nada.motivo), "sin medios estimables → insuficiente");
  ok(!ajustarMmm({ ...base.input, kpi: Array(30).fill(0) }).ok, "KPI en cero → insuficiente");
}

// ── Colinealidad: medios que se mueven juntos bajan la confianza ──
{
  const v: Verdad[] = [{ nombre: "A", decay: 0.2, K: 1, s: 1, beta: 200 }, { nombre: "B", decay: 0.2, K: 1, s: 1, beta: 200 }];
  const s = sintetica(104, v, { seed: 4 });
  s.input.medios[1].inversion = s.input.medios[0].inversion.map((x) => x * 1.1);
  const r = ajustarMmm(s.input, { bootstrap: 30 });
  ok(r.ok && r.motivosConfianza.some((m) => /juntos/.test(m)), "colinealidad detectada en los motivos de confianza");
  ok(r.ok && r.confianza !== "alta", "colinealidad → confianza no alta");
}

// ── Curva en S (s=2) recuperada en forma ──
{
  const v: Verdad[] = [{ nombre: "Video", decay: 0.2, K: 1.4, s: 2, beta: 400 }];
  const s = sintetica(156, v, { seed: 21, ruido: 0.01 });
  const r = ajustarMmm(s.input, { bootstrap: 30 });
  ok(r.ok && r.medios[0].s === 2, `curva en S: s=2 recuperado (${r.ok ? r.medios[0].s : "-"})`);
  if (r.ok) near(r.medios[0].contribucion.p50 / s.contribTot[0], 1, 0.2, "curva en S: contribución");
}

// ── Cobertura de las bandas en varias semillas (la verdad dentro de p10–p90 en la mayoría) ──
{
  const verdad: Verdad[] = [
    { nombre: "TV", decay: 0.5, K: 1.0, s: 1, beta: 300, offline: true },
    { nombre: "Meta", decay: 0.2, K: 0.7, s: 1, beta: 200 },
  ];
  let dentro = 0, total = 0, errRel = 0;
  const t0 = Date.now();
  for (const seed of [101, 202, 303, 404, 505, 606]) {
    const s = sintetica(104, verdad, { seed, ruido: 0.03 });
    const r = ajustarMmm(s.input, { bootstrap: 60, seed });
    if (!r.ok) continue;
    r.medios.forEach((m) => {
      const t = s.contribTot[verdad.findIndex((v) => v.nombre === m.nombre)];
      total++; if (t >= m.contribucion.p10 * 0.95 && t <= m.contribucion.p90 * 1.05) dentro++;
      errRel += Math.abs(m.contribucion.p50 - t) / t;
    });
  }
  ok(total === 12, "cobertura: 6 semillas × 2 medios ajustadas");
  ok(dentro / total >= 0.7, `cobertura: la verdad cae en la banda en ${dentro}/${total}`);
  ok(errRel / total < 0.25, `cobertura: error relativo medio de la contribución ${(errRel / total * 100).toFixed(0)}%`);
  console.log(`  cobertura ${dentro}/${total}, error medio ${(errRel / total * 100).toFixed(0)}%, ${Date.now() - t0} ms`);
}

// ── Costo con la forma real de la pauta (24 meses × 4 medios): liviano para correr en el navegador ──
{
  const v: Verdad[] = ["Meta", "Google", "TV", "Radio"].map((nombre, i) => ({ nombre, decay: 0.1, K: 1, s: 1, beta: 100 + 50 * i, offline: i >= 2 }));
  const s = sintetica(36, v, { seed: 8, granularidad: "mensual" });
  const t0 = Date.now();
  const r = ajustarMmm(s.input, { bootstrap: 120 });
  const ms = Date.now() - t0;
  ok(r.ok, "36 meses × 4 medios: ajusta");
  ok(ms < 1500, `36 meses × 4 medios × 120 réplicas: ${ms} ms`);
  if (r.ok) ok(r.medios.every((m) => m.s === 1), "mensual: solo curva cóncava (s=1)");
}

if (fail) { console.error(`mmm: ${okN} OK, ${fail} FAIL`); process.exit(1); }
console.log(`mmm: ${okN} OK, 0 FAIL`);
