// Test de lib/pauta-diaria (inversión diaria por medio + detección de gasto anómalo). npx tsx scripts/pauta-diaria.test.ts
import { gastoDiarioSignals } from "../src/lib/signals/pauta-diaria";
import { detectarPicos, referenciaMensual, evaluarMedio, concentracionMensual, evaluarPautaDiaria, serieGrafico, addDias, diasDelMes, mesMas, type SerieMedio } from "../src/lib/pauta-diaria";
let f = 0, p = 0; const ok = (n: string, c: boolean, i?: unknown) => { if (c) p++; else { f++; console.error("✗", n, i ?? ""); } };

// Helpers
const rango = (desde: string, hasta: string, v: (fecha: string, i: number) => number) => {
  const o: Record<string, number> = {}; let i = 0;
  for (let d = desde; d <= hasta; d = addDias(d, 1)) o[d] = v(d, i++);
  return o;
};

ok("addDias cruza mes", addDias("2026-08-31", 1) === "2026-09-01");
ok("diasDelMes feb", diasDelMes("2026-02") === 28 && diasDelMes("2026-09") === 30);
ok("mesMas", mesMas("2026-01", -1) === "2025-12");

// 1. Picos: serie plana de 100k con un día de 1M.
const plano = rango("2026-08-01", "2026-08-31", () => 100_000);
plano["2026-08-20"] = 1_000_000;
const pk = detectarPicos("Meta", plano);
ok("detecta un pico 10×", pk.length === 1 && pk[0]!.fecha === "2026-08-20" && Math.round(pk[0]!.veces) === 10, pk);
ok("sin pico si está bajo el mínimo en $", detectarPicos("X", { ...rango("2026-08-01", "2026-08-20", () => 10_000), "2026-08-21": 100_000 }).length === 0);
// Reinicio tras pausa: pocos días con gasto en la ventana → no es pico.
const reinicio = { ...rango("2026-06-20", "2026-06-24", () => 140_000), ...rango("2026-07-08", "2026-07-20", () => 700_000) };
ok("reinicio tras pausa no cuenta (≥5 días con gasto en la ventana)", !detectarPicos("DG", reinicio).some((x) => x.fecha === "2026-07-08"), detectarPicos("DG", reinicio));
ok("3× exacto no alcanza (tiene que superarlo)", detectarPicos("X", { ...rango("2026-08-01", "2026-08-14", () => 100_000), "2026-08-15": 300_000 }).length === 0);

// 2. Referencia: promedio últimos 3 meses cerrados con gasto.
const r = referenciaMensual({ "2026-05": 0, "2026-06": 3e6, "2026-07": 6e6, "2026-08": 9e6, "2026-09": 50e6 }, "2026-09");
ok("referencia = 3 cerrados", r.valor === 6e6 && r.meses.join() === "2026-06,2026-07,2026-08", r);
const rp = referenciaMensual({ "2026-06": 1e6, "2026-07": 2e6, "2026-08": 4e6 }, "2026-09", { "2026-06": 50e6, "2026-07": 100e6, "2026-08": 200e6, "2026-09": 400e6 });
ok("referencia ajustada al plan (cada mes a la escala de sep)", rp.valor === 8e6 && rp.ajustadaPlan, rp);
ok("sin plan del mes → sin ajuste", referenciaMensual({ "2026-06": 1e6, "2026-07": 2e6 }, "2026-09", { "2026-06": 5e6 }).ajustadaPlan === false);
ok("sin cerrados → null", referenciaMensual({ "2026-09": 1 }, "2026-09").valor === null);

// 3. Caso real: se gasta el mes en 3 días (ref 30M/mes, 3 días de 7M = 21M = 70%).
const meses = { "2026-06": 30e6, "2026-07": 30e6, "2026-08": 30e6 };
const burn: SerieMedio = { medio: "Meta", fuente: "diaria", dias: { ...rango("2026-08-01", "2026-08-31", () => 1e6), ...rango("2026-09-01", "2026-09-03", () => 7e6) }, meses };
const e1 = evaluarMedio(burn, "2026-09-04");
ok("burn 3 días → urgente", e1.estado === "urgente", e1);
ok("burn: día 3, acum 21M, 70%", e1.diaDelMes === 3 && e1.acumMes === 21e6 && Math.round(e1.pctRef!) === 70, e1);
ok("burn: texto en lenguaje simple", e1.motivos[0]!.includes("En solo 3 días") && e1.motivos[0]!.includes("70%"), e1.motivos);
ok("burn: picos recientes detectados", e1.picosRecientes.length >= 1, e1.picosRecientes);

// Ritmo normal → ok.
const normal: SerieMedio = { medio: "Google Search", fuente: "diaria", dias: rango("2026-08-01", "2026-09-15", () => 1e6), meses };
const e2 = evaluarMedio(normal, "2026-09-16");
ok("ritmo normal → ok", e2.estado === "ok" && e2.motivos.length === 0, e2);
ok("ritmo ≈ 1", Math.abs((e2.ritmo ?? 0) - 1) < 0.01, e2.ritmo);
ok("prom14 = 1M", Math.round(e2.prom14!) === 1e6);

// 1,3× lo esperable al día 15 → revisar; 1,7× al día 15 → revisar; 2× → urgente.
const rapido: SerieMedio = { medio: "Demand Gen", fuente: "diaria", dias: { ...rango("2026-08-01", "2026-08-31", () => 1e6), ...rango("2026-09-01", "2026-09-15", () => 1.3e6) }, meses };
ok("1,3× → revisar", evaluarMedio(rapido, "2026-09-16").estado === "revisar", evaluarMedio(rapido, "2026-09-16"));
// 2× al día 15 → urgente.
const muyRapido: SerieMedio = { ...rapido, dias: { ...rango("2026-08-01", "2026-08-31", () => 1e6), ...rango("2026-09-01", "2026-09-15", () => 2e6) } };
ok("2× al día 15 → revisar (mes más caro, no ráfaga)", evaluarMedio(muyRapido, "2026-09-16").estado === "revisar", evaluarMedio(muyRapido, "2026-09-16"));
const temprano: SerieMedio = { ...rapido, dias: { ...rango("2026-08-01", "2026-08-31", () => 1e6), ...rango("2026-09-01", "2026-09-08", () => 2e6) } };
ok("2× al día 8 → urgente", evaluarMedio(temprano, "2026-09-09").estado === "urgente");
// Ráfaga a mitad de mes: normal hasta el 14, después 4 días de 5M (20M = 67% de un mes normal de 30M).
const rafaga: SerieMedio = { medio: "Meta", fuente: "diaria", meses, dias: { ...rango("2026-08-01", "2026-09-14", () => 1e6), ...rango("2026-09-15", "2026-09-18", () => 5e6) } };
const er = evaluarMedio(rafaga, "2026-09-19");
ok("ráfaga mitad de mes → urgente", er.estado === "urgente" && er.rafaga?.inicioMes === false && Math.round(er.rafaga.pct) === 70, er);
ok("ráfaga: texto 'En los últimos 5 días'", er.motivos[0]!.startsWith("En los últimos 5 días gastó $21,0M"), er.motivos);
ok("referencia = mediana (un mes cortado no la hunde)", referenciaMensual({ "2026-06": 0.3e6, "2026-07": 2.3e6, "2026-08": 1.9e6 }, "2026-09").valor === 1.9e6);
const medio17: SerieMedio = { ...rapido, dias: { ...rango("2026-08-01", "2026-08-31", () => 1e6), ...rango("2026-09-01", "2026-09-15", () => 1.7e6) } };
ok("1,7× al día 15 → revisar", evaluarMedio(medio17, "2026-09-16").estado === "revisar");

// Pico viejo de un medio que dejó de pautar: no es alerta hoy.
const viejo: SerieMedio = { medio: "X", fuente: "diaria", dias: { ...rango("2026-06-01", "2026-06-17", () => 100_000), "2026-06-18": 2e6 }, meses: { "2026-05": 3e6, "2026-06": 3e6 } };
ok("pico viejo no es reciente", evaluarMedio(viejo, "2026-09-20").picosRecientes.length === 0 && evaluarMedio(viejo, "2026-09-20").estado === "ok");

// Serie vacía → sin_dato.
ok("sin dato", evaluarMedio({ medio: "X", fuente: "diaria", dias: {}, meses: {} }, "2026-09-10").estado === "sin_dato");

// Fuente mensual (Meta sin tabla diaria): 52M a día 27 vs ref 30M → 1,93× → urgente.
const mens: SerieMedio = { medio: "Meta", fuente: "mensual", dias: {}, meses: { ...meses, "2026-09": 52e6 }, asOf: "2026-09-27" };
const e3 = evaluarMedio(mens, "2026-09-28");
ok("mensual usa acum del mes y asOf", e3.acumMes === 52e6 && e3.diaDelMes === 27, e3);
ok("mensual 1,9× al día 27 → revisar (mes caro, no desbocado)", e3.estado === "revisar", e3);
const e3b = evaluarMedio({ ...mens, meses: { ...meses, "2026-09": 20e6 }, asOf: "2026-09-08" }, "2026-09-09");
ok("mensual 2,5× al día 8 → urgente", e3b.estado === "urgente", e3b);

// 4. Concentración por campaña (caso real ago-2026: 41,6M de 62,7M en campañas de 3 días).
const conc = concentracionMensual("Meta", [
  { mes: "2026-08", campania: "Views_Lavado_Diario", gasto: 13.17e6, dias: 3 },
  { mes: "2026-08", campania: "Views_Heladera_Diario", gasto: 11.91e6, dias: 3 },
  { mes: "2026-08", campania: "Views_Cocina_Diario", gasto: 9.37e6, dias: 3 },
  { mes: "2026-08", campania: "Views_Brand_Diario", gasto: 7.14e6, dias: 3 },
  { mes: "2026-08", campania: "Views_Lavado", gasto: 5.8e6, dias: 24 },
  { mes: "2026-07", campania: "Reach_UGC", gasto: 5.9e6, dias: 24 },
  { mes: "2026-05", campania: "Sin dato de días", gasto: 20e6, dias: null },
], { "2026-08": 62.72e6, "2026-07": 22.8e6, "2026-05": 50e6 });
ok("concentración: solo ago", conc.length === 1 && conc[0]!.mes === "2026-08", conc);
ok("concentración: 66% → urgente", conc[0]!.estado === "urgente" && Math.round(conc[0]!.pct) === 66 && conc[0]!.diasMax === 3, conc[0]);
ok("concentración: texto", conc[0]!.motivo.includes("4 campañas") && conc[0]!.motivo.includes("66%"), conc[0]!.motivo);

// Todo junto + serie del gráfico.
const res = evaluarPautaDiaria({ series: [burn, normal, mens], campanias: [], hoy: "2026-09-04" });
ok("evaluarPautaDiaria: 3 medios", res.medios.length === 3 && res.picos.length >= 1);
const g = serieGrafico([burn, normal, mens], "2026-09-01", "2026-09-03");
ok("serieGrafico: 3 filas, solo medios diarios", g.length === 3 && g[0]!["Meta"] === 7e6 && !("Meta " in g[0]!) && Object.keys(g[0]!).length === 3, g[0]);

// Señal gasto_diario_anomalo: urgente → alta; concentración del último mes cerrado → media.
const sg = gastoDiarioSignals(evaluarPautaDiaria({ series: [burn, normal], campanias: [{ medio: "Meta", filas: [
  { mes: "2026-08", campania: "Diario", gasto: 20e6, dias: 3 }] }], hoy: "2026-09-04" }));
const sMeta = sg.find((s) => s.key === "gasto_diario_anomalo_meta_2026-09");
ok("señal Meta urgente = alta", sMeta?.prioridad === "alta" && sMeta.tipo === "alerta" && sMeta.dash === "performance", sg.map((s) => s.key));
ok("señal: título en lenguaje simple", !!sMeta?.titulo.includes("en 3 días ya se gastó el 70%"), sMeta?.titulo);
ok("sin señal para el medio normal", !sg.some((s) => s.key.includes("google_search")));
const sConc = sg.find((s) => s.key === "gasto_diario_anomalo_concentrado_meta_2026-08");
ok("concentración mes cerrado → media", sConc?.prioridad === "media", sg.map((s) => [s.key, s.prioridad]));
ok("sin resultado → sin señales", gastoDiarioSignals(null).length === 0);

console.log(`pauta-diaria: ${p} OK, ${f} fallas`);
if (f) process.exit(1);
