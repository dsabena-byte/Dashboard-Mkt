// Test del Simulador de presupuesto (lib/simulador.ts) con datos SINTÉTICOS.
// Correr: cd apps/web && npx tsx scripts/simulador.test.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  fitLogLog, fitCurve, predict, buildSimModel, simulate, optimize, defaultBounds, rescaleTo, forecastDemand,
  simMonthsFromPauta, SIM_OFFLINE_RE, type SimMesInput,
} from "../src/lib/simulador";
import { buildPautaMediosMensual } from "../src/lib/pauta-medios-model";
import { OFFLINE_RE } from "../src/lib/signals/adapters";

let fails = 0;
const ok = (cond: boolean, msg: string) => { if (!cond) { fails++; console.error("  ✗", msg); } else console.log("  ✓", msg); };
const near = (a: number, b: number, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));

console.log("1 · regresión log-log");
{
  const pts = [1e6, 2e6, 4e6, 8e6, 16e6].map((x) => ({ x, y: 2 * Math.pow(x, 0.7) }));
  const f = fitLogLog(pts)!;
  ok(near(f.b, 0.7) && near(f.a, 2) && near(f.r2, 1), `recupera a=2, b=0.7 (a=${f.a.toFixed(4)}, b=${f.b.toFixed(4)})`);
  const c = fitCurve(pts)!;
  ok(c.method === "meses" && c.confianza === "media", "5 meses con R²=1 → método meses, confianza media (n<6)");
  const c2 = fitCurve(pts.slice(0, 2))!;
  ok(c2.method === "promedio" && c2.b === 0.8 && c2.confianza === "baja", "2 meses → promedio con b=0,8 (aproximada)");
}

// Meses sintéticos: Meta (curva b=0.7), YouTube (b=0.9), OOH offline con contactos, TV sin contactos.
const months: SimMesInput[] = [];
const spendsMeta = [10e6, 14e6, 20e6, 25e6, 30e6, 22e6, 18e6];
const spendsYt = [8e6, 9e6, 12e6, 15e6, 11e6, 10e6, 13e6];
spendsMeta.forEach((s, i) => {
  const yt = spendsYt[i]!;
  months.push({
    mes: `2026-${String(i + 1).padStart(2, "0")}`,
    medios: {
      Meta: { inv: s, impr: 50 * Math.pow(s, 0.7), alc: 20 * Math.pow(s, 0.7), clic: 0.01 * Math.pow(s, 0.7) },
      YouTube: { inv: yt, impr: 3 * Math.pow(yt, 0.9), alc: 1.5 * Math.pow(yt, 0.9), clic: 0.0005 * Math.pow(yt, 0.9) },
      OOH: { inv: 10e6, impr: i >= 5 ? 7.5e6 : 0, alc: 1e6, clic: 0 },
      "TV Cable": { inv: i >= 4 ? 60e6 : 0, impr: 0, alc: 0, clic: 0 },
      "Google Search": { inv: i < 2 ? 500e3 : 0, impr: 400e3, alc: 0, clic: 9e3 },
    },
  });
});

console.log("2 · modelo desde meses por medio");
const model = buildSimModel(months);
{
  const byName = Object.fromEntries(model.channels.map((c) => [c.canal, c]));
  ok(model.meses === 3 && model.mesesLabel.join(",") === "2026-05,2026-06,2026-07", "hoy = últimos 3 meses con inversión");
  ok(!!byName.Meta && near(byName.Meta.currentSpend, (30e6 + 22e6 + 18e6) / 3), "inversión actual de Meta = promedio de los 3 meses");
  ok(byName.Meta!.curves.impresiones!.method === "meses" && near(byName.Meta!.curves.impresiones!.b, 0.7, 1e-4), "Meta: curva por regresión con b≈0,7");
  ok(byName.OOH!.offline && !!byName.OOH!.curves.impresiones && !byName.OOH!.curves.alcance && !byName.OOH!.curves.clicks, "OOH offline: solo contactos (sin alcance ni clicks)");
  ok(byName["TV Cable"]!.offline && Object.keys(byName["TV Cable"]!.curves).length === 0, "TV sin contactos cargados: entra con inversión pero sin curva");
  ok(!byName["Google Search"], "Google Search sin inversión reciente → no se simula");
  ok(model.nota.some((n) => n.includes("Google Search")), "nota explica los medios sin inversión reciente");
  ok(model.channels[model.channels.length - 1]!.offline, "offline al final del listado");
}

console.log("3 · simulación calibrada (sin cambios = hoy)");
{
  const base = Object.fromEntries(model.channels.map((c) => [c.canal, c.currentSpend]));
  const r = simulate(model, base);
  for (const k of ["impresiones", "alcance", "clicks"] as const) ok(near(r.total.values[k], r.total.base[k]), `${k}: simulado = hoy`);
  const meta = model.channels.find((c) => c.canal === "Meta")!;
  ok(near(predict(meta.curves.impresiones!, meta.currentSpend), meta.current.impresiones), "curva calibrada pasa por (inversión actual, resultado actual)");
  // Alcance = suma por medio (semántica Drean)
  const sumAlc = model.channels.reduce((s, c) => s + (c.curves.alcance ? c.current.alcance : 0), 0);
  ok(near(r.total.base.alcance, sumAlc), "alcance total = suma del alcance de cada medio");
}

console.log("4 · optimización");
{
  const base = Object.fromEntries(model.channels.map((c) => [c.canal, c.currentSpend]));
  const total = Object.values(base).reduce((a, b) => a + b, 0);
  const bounds = defaultBounds(model);
  for (const metric of ["impresiones", "alcance", "clicks"] as const) {
    const o = optimize(model, total, metric, bounds);
    const sum = Object.values(o).reduce((a, b) => a + b, 0);
    const within = model.channels.every((c) => o[c.canal]! >= bounds[c.canal]!.min - 1 && o[c.canal]! <= bounds[c.canal]!.max + 1);
    const before = simulate(model, base).total.values[metric], after = simulate(model, o).total.values[metric];
    ok(near(sum, total, 1e-6) && within, `${metric}: reparte el total (${(sum / 1e6).toFixed(1)}M) dentro de los topes`);
    ok(after >= before - 1e-6, `${metric}: optimizado ≥ hoy (${(((after - before) / before) * 100).toFixed(1)}%)`);
    const k = optimize(model, total, metric, bounds, 400, base);
    const ksum = Object.values(k).reduce((a, b) => a + b, 0);
    ok(near(k["TV Cable"]!, base["TV Cable"]!) && near(ksum, total, 1e-6) && simulate(model, k).total.values[metric] >= before - 1e-6,
      `${metric}: con keep, TV (sin la métrica) queda fija y el resto se optimiza (${(((simulate(model, k).total.values[metric] - before) / before) * 100).toFixed(1)}%)`);
  }
}

console.log("5 · rescale / demanda / criterio offline");
{
  const r = rescaleTo({ A: 10, B: 30, C: 60 }, 200, "A");
  ok(near(r.A!, 10) && near(r.A! + r.B! + r.C!, 200) && near(r.B! / r.C!, 0.5), "rescaleTo mantiene el medio movido y reparte el resto proporcional");
  const serie = Array.from({ length: 15 }, (_, i) => { const d = new Date(Date.UTC(2025, 6 + i, 1)); return { mes: d.toISOString().slice(0, 7), v: 1000 + (d.getUTCMonth() === 11 ? 500 : 0) + i * 10 }; });
  const f = forecastDemand(serie, 3);
  ok(f.puntos.length === 3 && f.metodo.includes("estacionalidad"), `demanda 15 meses → ${f.metodo}`);
  const g = forecastDemand(serie.slice(0, 5), 3);
  ok(g.metodo === "promedio de los últimos 3 meses" && g.puntos.length === 3, "demanda 5 meses → promedio últimos 3");
  ok(SIM_OFFLINE_RE.source === OFFLINE_RE.source, "criterio offline = el de las señales (lib/signals/adapters)");
}

console.log("6 · end-to-end con el modelo de Pauta (Meta = API, OMD de Meta ignorado)");
{
  const pauta = [
    { mes: "Julio 2026", medio: "Meta", impresiones: 1_000, alcance: 500, clics: 10, inversion: 1_000_000 },
    { mes: "Julio 2026", medio: "OOH", impresiones: 0, alcance: 0, clics: 0, inversion: 35_500_000 },
    { mes: "Julio 2026", medio: "TikTok", impresiones: 2_000_000, alcance: 800_000, clics: 1_000, inversion: 8_000_000 },
  ];
  const metaPaid = [{ mes: "Julio 2026", plataforma: "meta", impresiones: 60_000_000, alcance: 30_000_000, clicks: 300_000, spend: 22_000_000, video_p25: 0, video_p50: 0, video_p75: 0 }];
  const dv360 = [{ mes: "2026-07-01", canal: "YouTube", impresiones: 10_000_000, clicks: 20_000, revenue_usd: 10_000, starts: 0, q50: 0 }];
  const cur = buildPautaMediosMensual({ pauta, metaPaid, dv360, dv360Reach: [], googleAdsOmd: [], fxRates: { "2026-07-01": 1_300 }, anio: 2026, currentMonth: 9 });
  const sm = simMonthsFromPauta(cur);
  const jul = sm.find((m) => m.mes === "2026-07")!;
  ok(near(jul.medios.Meta!.inv, 22_000_000), "Meta sale de la API ($22M), no de la fila OMD ($1M)");
  ok(near(jul.medios.YouTube!.inv, 13_000_000), "DV360 YouTube USD→ARS con el fx del mes");
  ok(!!jul.medios.OOH && !!jul.medios.TikTok, "medios sin API (OOH, TikTok) desde OMD");
  const mdl = buildSimModel(sm);
  ok(mdl.channels.length === 4 && mdl.channels.find((c) => c.canal === "OOH")!.offline, "modelo: 4 medios, OOH offline");
}

if (fails) { console.error(`\n${fails} test(s) fallaron`); process.exit(1); }
console.log("\nOK — todos los tests pasaron");
