// Cierre proyectado del mes (lib/web-forecast.ts) + chequeo indirecto de consent (lib/web-consent.ts)
// + armado del chequeo con la regla de Drean (Search + PMax, sin Demand Gen; lib/web-calidad-shared.ts)
// y tráfico desde IA mensual. Portado de BIP (scripts/web-ecommerce.test.ts). Fixtures SINTÉTICAS.
// Correr: cd apps/web && npx tsx scripts/web-forecast.test.ts
import { cierreDeMes, perfilSemanal, serieDesdeGa4, type DiaWeb } from "../src/lib/web-forecast";
import { chequeoConsent, sesionesPorMesGa4 } from "../src/lib/web-consent";
import { consentDesdeFilas, iaMensualDesdeFilas, tipoCampania } from "../src/lib/web-calidad-shared";
import { computeWebCalidadSignals } from "../src/lib/signals/web-calidad";

let fail = 0, okN = 0;
const ok = (c: unknown, m: string) => { if (c) okN++; else { fail++; console.error(`FAIL ${m}`); } };
const near = (a: number | null | undefined, b: number, tol: number, m: string) => ok(a != null && Math.abs(a - b) <= tol, `${m}: ${a} ≉ ${b} (±${tol})`);

function dias(desde: string, n: number, f: (fecha: string, i: number) => { tx: number; ingresos: number }): DiaWeb[] {
  const out: DiaWeb[] = [];
  const d = new Date(`${desde}T12:00:00Z`);
  for (let i = 0; i < n; i++) { const fecha = d.toISOString().slice(0, 10); out.push({ fecha, ...f(fecha, i) }); d.setUTCDate(d.getUTCDate() + 1); }
  return out;
}
const dow = (fecha: string) => new Date(`${fecha}T12:00:00Z`).getUTCDay();

(async () => {
  // ── Cierre de mes ──
  {
    // Constante 10 tx/día, $1.000 c/u: 56 días de historia + 15 días de septiembre (30 días).
    const s = dias("2026-07-07", 56 + 15, () => ({ tx: 10, ingresos: 10_000 }));
    const c = cierreDeMes(s, { metaTx: 300, metaIngresos: 250_000 })!;
    ok(c.mes === "2026-09" && c.diasConDato === 15 && c.diasRestantes === 15 && !c.preliminar, "cierre: días del mes y restantes");
    near(c.tx.real, 150, 1e-9, "cierre: real a la fecha");
    near(c.tx.cierre, 300, 1e-6, "cierre: serie constante → 30 días × 10");
    ok(c.tx.p10 != null && c.tx.p90 != null && Math.abs(c.tx.p90! - c.tx.p10!) < 1e-6, "cierre: sin error histórico → rango nulo");
    ok(c.tx.estado === "en_linea" && c.tx.pctMeta === 100, "cierre: meta = proyección → en línea");
    ok(c.ingresos.estado === "sobre", "cierre: meta de ingresos menor que la proyección → sobre");
    const c2 = cierreDeMes(s, { metaTx: 600 })!;
    ok(c2.tx.estado === "debajo" && c2.tx.necesarioDia === 30, "cierre: meta alta → debajo y necesita 30/día");
    ok(c2.ingresos.estado === "sin_meta", "cierre: sin meta de ingresos");
  }
  {
    // Perfil semanal: fines de semana el doble.
    const s = dias("2026-07-07", 56 + 10, (f) => ({ tx: dow(f) === 0 || dow(f) === 6 ? 20 : 10, ingresos: 0 }));
    const f = perfilSemanal(s.slice(0, 56).map((d) => ({ fecha: d.fecha, v: d.tx })));
    near(f[6] / f[1], 2, 1e-9, "perfil: sábado = 2× lunes");
    near(f.reduce((a, b) => a + b, 0) / 7, 1, 1e-9, "perfil: promedio 1");
    const c = cierreDeMes(s)!;
    // Real = 10 días de septiembre; resto con el mismo patrón → cierre exacto del mes.
    let esperado = 0; for (const d of dias("2026-09-01", 30, (fe) => ({ tx: dow(fe) === 0 || dow(fe) === 6 ? 20 : 10, ingresos: 0 }))) esperado += d.tx;
    near(c.tx.cierre, esperado, 1e-6, "cierre: respeta el día de la semana");
  }
  {
    // Ruido: el rango contiene el cierre y es determinístico.
    let x = 7; const rnd = () => { x = (x * 1103515245 + 12345) % 2147483648; return x / 2147483648; };
    const s = dias("2026-07-07", 56 + 12, () => ({ tx: Math.round(8 + rnd() * 6), ingresos: 1000 }));
    const a = cierreDeMes(s, { seed: "t" })!, b = cierreDeMes(s, { seed: "t" })!;
    ok(a.tx.p10! <= a.tx.cierre && a.tx.cierre <= a.tx.p90!, "cierre: p10 ≤ p50 ≤ p90");
    ok(a.tx.p10 === b.tx.p10 && a.tx.p90 === b.tx.p90, "cierre: misma semilla → mismo rango");
    ok(a.tx.p90! > a.tx.p10!, "cierre: con ruido hay rango");
  }
  {
    const pre = cierreDeMes(dias("2026-09-01", 3, () => ({ tx: 5, ingresos: 0 })))!;
    ok(pre.preliminar && pre.tx.p10 == null, "cierre: pocos días → preliminar sin rango");
    ok(cierreDeMes([]) == null, "cierre: sin datos → null");
    const g = serieDesdeGa4([{ dimensionValues: [{ value: "20260905" }], metricValues: [{ value: "3" }, { value: "4500.5" }, { value: "100" }] }]);
    ok(g[0].fecha === "2026-09-05" && g[0].tx === 3 && g[0].ingresos === 4500.5 && g[0].sesiones === 100, "serieDesdeGa4");
  }

  // ── Consent ──
  {
    ok(chequeoConsent({}, {}).estado === "sin_datos", "consent: sin clicks");
    ok(chequeoConsent({ "2026-08": 100 }, { "2026-08": 10 }).estado === "sin_datos", "consent: pocos clicks no evalúa");
    ok(chequeoConsent({ "2026-08": 1000 }, { "2026-08": 900 }).estado === "ok", "consent: 90% ok");
    ok(chequeoConsent({ "2026-08": 1000 }, { "2026-08": 600 }).estado === "perdida_media", "consent: 60% media");
    ok(chequeoConsent({ "2026-08": 1000 }, { "2026-08": 300 }).estado === "perdida_alta", "consent: 30% alta");
    const caida = chequeoConsent({ "2026-05": 1000, "2026-06": 1000, "2026-07": 1000, "2026-08": 1000 }, { "2026-05": 950, "2026-06": 900, "2026-07": 920, "2026-08": 550 });
    ok(caida.estado === "caida" && caida.ratioPrevio === 0.92, "consent: caída vs meses previos");
    const m = sesionesPorMesGa4([{ dimensionValues: [{ value: "202608" }], metricValues: [{ value: "123" }] }, { dimensionValues: [{ value: "x" }], metricValues: [{ value: "9" }] }]);
    ok(m["2026-08"] === 123 && Object.keys(m).length === 1, "consent: parse GA4");
  }

  // ── Drean: consent con Search + PMax (Demand Gen fuera) ──
  {
    const porNombre = new Map([["drean_search_marca", "Search"], ["inhouse_pmax_lavado", "Performance Max"], ["drean_lavado_demandgen", "Demand Gen"]]);
    ok(tipoCampania("Drean_Search_Marca", porNombre) === "search", "tipo: search por el mapa (case-insensitive)");
    ok(tipoCampania("omd_demandgen_middle_ardr_trafico_lavado_26", porNombre) === "demandgen", "tipo: demand gen por nombre");
    ok(tipoCampania("otra_pmax_x", new Map()) === "pmax", "tipo: pmax por nombre sin mapa");
    const ads = [
      { fecha: "2026-08-03", campaign_name: "Drean_Search_Marca", campaign_type: "Search", clicks: 600 },
      { fecha: "2026-08-04", campaign_name: "inhouse_pmax_lavado", campaign_type: "Performance Max", clicks: 400 },
      { fecha: "2026-08-04", campaign_name: "drean_lavado_demandgen", campaign_type: "Demand Gen", clicks: 5000 },
    ];
    const ses = [
      { fecha: "2026-08-03", utm_campaign: "drean_search_marca", sesiones: 500 },
      { fecha: "2026-08-04", utm_campaign: "inhouse_pmax_lavado", sesiones: 200 },
      { fecha: "2026-08-04", utm_campaign: "drean_lavado_demandgen", sesiones: 900 },
    ];
    const c = consentDesdeFilas(ads, ses);
    ok(c.clicks["2026-08"] === 1000 && c.sesiones["2026-08"] === 700 && c.sesionesTodas["2026-08"] === 1600, "consent Drean: DG fuera de clicks y sesiones");
    ok(chequeoConsent(c.clicks, c.sesiones).estado === "perdida_media", "consent Drean: 70% → pérdida media");
  }
  // ── Drean: tráfico desde IA mensual ──
  {
    const ia = iaMensualDesdeFilas(
      [{ fecha: "2026-08-02", utm_source: "chatgpt.com", sesiones: 40 }, { fecha: "2026-08-09", utm_source: "gemini.google.com", sesiones: 5 }, { fecha: "2026-08-09", utm_source: "google", sesiones: 999 }, { fecha: "2026-09-01", utm_source: "perplexity.ai", sesiones: 3 }],
      [{ fecha: "2026-08-02", utm_source: "chatgpt.com", purchases: 2, revenue: 1000 }, { fecha: "2026-08-02", utm_source: "(direct)", purchases: 9, revenue: 9 }],
      { "2026-08": 10_000 },
    );
    ok(ia.length === 2 && ia[0]!.mes === "2026-08" && ia[0]!.sesiones === 45 && ia[0]!.porAsistente.ChatGPT === 40 && ia[0]!.porAsistente.Gemini === 5, "IA mensual: agrega por asistente y descarta no-IA");
    ok(ia[0]!.transacciones === 2 && ia[0]!.ingresos === 1000 && ia[0]!.sesionesSitio === 10_000, "IA mensual: compras solo de fuentes IA");
  }
  // ── Drean: señales de cierre ──
  {
    const s = dias("2026-07-07", 56 + 15, () => ({ tx: 10, ingresos: 10_000 }));
    const metaTx = Array.from({ length: 12 }, () => null as number | null); metaTx[8] = 600;
    const sig = computeWebCalidadSignals({ snapshot: null, diario: s, metaTx, metaIngresos: [], now: new Date("2026-09-16T12:00:00Z") });
    ok(sig.some((x) => x.key === "web_cierre_tx_debajo" && x.prioridad === "alta"), "señal: cierre de transacciones debajo de la meta");
    ok(!sig.some((x) => x.key === "web_cierre_ingresos_debajo"), "señal: sin meta de ingresos no dispara");
  }

  console.log(`web-forecast: ${okN} OK, ${fail} FAIL`);
  if (fail) process.exit(1);
})();
