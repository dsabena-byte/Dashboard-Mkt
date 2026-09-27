// Test del pacing del mes en curso (lib/pauta-pacing) + reglas de señales pacing/fatiga, con datos
// SINTÉTICOS. Correr: cd apps/web && npx tsx scripts/pauta-pacing.test.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { computePacing, bgtVigentePorMes, partesAR, diasDelMes } from "../src/lib/pauta-pacing";
import { fatigaPiezas } from "../src/lib/pauta-fatiga";
import { pacingSignals, fatigaSignals } from "../src/lib/signals/pauta";

let f = 0, p = 0;
const ok = (n: string, c: boolean, i?: unknown) => { if (c) p++; else { f++; console.error("✗", n, i ?? ""); } };
const near = (a: number | null | undefined, b: number, tol: number) => a != null && Math.abs(a - b) <= tol;

// ── Fecha del dato: 21-sep-2026 00:00 AR = 03:00 UTC → 20 días completos transcurridos ──
const asOf = new Date("2026-09-21T03:00:00Z");
ok("partesAR", partesAR(asOf).dia === 21 && partesAR(asOf).mes === 8 && near(partesAR(asOf).hora, 0, 1e-9));
ok("días del mes", diasDelMes(2026, 8) === 30 && diasDelMes(2026, 1) === 28);

const meta = (mes: string, spend: number, impr = 1_000_000) => ({ mes, plataforma: "meta", impresiones: impr, alcance: impr / 2, clicks: 1000, spend, video_p25: 0, video_p50: 0, video_p75: 0 });
const omd = (mes: string, medio: string, inversion: number, impresiones = 100_000) => ({ mes, medio, impresiones, alcance: 0, clics: 0, inversion });
const base = {
  pauta: [
    // meses cerrados: OMD sin API (TikTok, OOH) + una fila OMD de Meta que debe IGNORARSE (regla API)
    omd("Junio 2026", "TikTok", 30e6), omd("Julio 2026", "TikTok", 60e6), omd("Agosto 2026", "TikTok", 90e6),
    omd("Junio 2026", "OOH", 10e6), omd("Julio 2026", "OOH", 10e6), omd("Agosto 2026", "OOH", 10e6),
    omd("Agosto 2026", "Meta", 999e6),
    // mes en curso: OOH ya cargado (se toma como está), TikTok todavía no; fila OMD de Meta ignorada
    omd("Septiembre 2026", "OOH", 10e6), omd("Septiembre 2026", "Meta", 777e6),
  ],
  metaPaid: [meta("Junio 2026", 40e6), meta("Julio 2026", 40e6), meta("Agosto 2026", 40e6), meta("Septiembre 2026", 20e6)],
  dv360: [], dv360Reach: [],
  googleAdsOmd: [{ mes: "Septiembre 2026", canal: "Google PMax", impresiones: 5000, clicks: 10, costo: 50e6 }], // PMax fuera
  fxRates: {}, anio: 2026, asOf,
};
const plan: (number | null)[] = Array.from({ length: 12 }, () => null); plan[8] = 150e6;
const pc = computePacing({ ...base, plan, extra: [{ medio: "Ecommerce", valores: Array.from({ length: 12 }, (_, i) => (i === 8 ? 4e6 : i >= 5 && i <= 7 ? 6e6 : null)) }] } as any)!;
ok("pacing existe", !!pc);
ok("días transcurridos = 20 de 30", near(pc.diasTranscurridos, 20, 1e-6) && pc.diasMes === 30, pc.diasTranscurridos);
ok("gastado = Meta API 20M + ecom 4M + OOH 10M (sin OMD Meta ni PMax)", near(pc.gastado, 34e6, 1), pc.gastado);
ok("API proyecta lineal: (20+4)/(20/30) = 36M; OOH como está → piso 46M", near(pc.rango.piso, 46e6, 1), pc.rango.piso);
ok("TikTok pendiente: central +60M (prom. 3m), techo +90M (máx)", near(pc.rango.central, 106e6, 1) && near(pc.rango.techo, 136e6, 1), pc.rango);
ok("pendientes = TikTok", pc.pendientes.length === 1 && pc.pendientes[0] === "TikTok", pc.pendientes);
ok("plan a la fecha = OOH 10M + (150-10)·2/3", near(pc.planALaFecha, 10e6 + 140e6 * (2 / 3), 1), pc.planALaFecha);
ok("sub: techo 136M < 150M·0,9=135M? no → en línea", pc.estado === "en_linea", pc.estado);
const pc2 = computePacing({ ...base, plan: plan.map((v, i) => (i === 8 ? 200e6 : v)) } as any)!;
ok("con plan 200M el techo (sin ecom 130M) queda abajo → sub", pc2.estado === "sub", pc2.rango);
const pc3 = computePacing({ ...base, plan: plan.map((v, i) => (i === 8 ? 30e6 : v)) } as any)!;
ok("con plan 30M hasta el piso supera → sobre", pc3.estado === "sobre", pc3.rango);
const pc4 = computePacing({ ...base, plan: null } as any)!;
ok("sin meta: base histórica (promedio 3 meses)", pc4.base === "historico" && near(pc4.referencia, (80e6 + 110e6 + 140e6) / 3, 1), pc4.referencia);
ok("mes del dato ≠ mes de hoy → null", computePacing({ ...base, plan, now: new Date("2026-10-02T12:00:00Z") } as any) === null);
const pre = computePacing({ ...base, plan, asOf: new Date("2026-09-03T15:00:00Z") } as any)!;
ok("menos de 5 días = preliminar", pre.preliminar === true);

// Señales de pacing
ok("señal sub (plan 200M)", pacingSignals(pc2).some((s) => s.key === "pauta_pacing_plan_under" && s.tipo === "alerta"));
ok("señal sobre (plan 30M)", pacingSignals(pc3).some((s) => s.key === "pauta_pacing_plan_over"));
ok("en línea / preliminar / sin plan → sin señal", !pacingSignals(pc).length && !pacingSignals(pre).length && !pacingSignals(pc4).length);

// BGT vigente por cuatrimestre (T3 cae a 4+8 si 8+4 no está cargado)
const bgt = bgtVigentePorMes([
  { presupuesto: "BGT 2026", mes: "ENERO", ars: 1 }, { presupuesto: "BGT 2026", mes: "SEPTIEMBRE", ars: 3 },
  { presupuesto: "4+8 2026", mes: "MAYO", ars: 5 }, { presupuesto: "4+8 2026", mes: "SEPTIEMBRE", ars: 4 }, { presupuesto: "4+8 2026", mes: "ENERO", ars: 99 },
], 2026);
ok("BGT: T1 usa BGT, T2 4+8, T3 cae a 4+8", bgt.valores[0] === 1 && bgt.valores[4] === 5 && bgt.valores[8] === 4 && bgt.versiones[8] === "4+8 2026", bgt);

// ── Fatiga (serie mensual) ──
const ad = (mes: string, perma: string, impr: number, reach: number, clicks: number, extra: any = {}) => ({ ad_id: `${perma}-${mes}`, mes, plataforma: "meta", instagram_permalink_url: perma, ad_name: perma, impresiones: impr, alcance: reach, clicks, spend: 1, video_p50: 0, ...extra });
const fr = fatigaPiezas({
  mesEnCurso: "2026-09",
  metaPaid: [
    // A: CTR 1% → 0,5% con frecuencia 2 → 3 → FATIGA
    ad("Julio 2026", "A", 100_000, 50_000, 1000), ad("Agosto 2026", "A", 100_000, 50_000, 1000), ad("Septiembre 2026", "A", 90_000, 30_000, 450),
    // B: CTR cae 50% pero la frecuencia BAJA → no es fatiga
    ad("Agosto 2026", "B", 100_000, 40_000, 1000), ad("Septiembre 2026", "B", 100_000, 80_000, 500),
    // C: un solo mes → sin serie
    ad("Septiembre 2026", "C", 50_000, 20_000, 500),
    // D: frecuencia 6 sin caída → frecuencia alta
    ad("Agosto 2026", "D", 120_000, 40_000, 1200), ad("Septiembre 2026", "D", 120_000, 20_000, 1250),
    // E: ya no está al aire en el último mes → no se evalúa
    ad("Julio 2026", "E", 100_000, 50_000, 1000), ad("Agosto 2026", "E", 100_000, 20_000, 100),
    // A también con otro ad_id el mismo mes (se suma por permalink)
    ad("Agosto 2026", "A", 0, 0, 0),
  ],
  dv360: [
    // DV360 display: CTR 0,3% → 0,15% y la frecuencia de la LÍNEA sube 3 → 4 → FATIGA
    { mes: "2026-08-01", canal: "Programmatic", categoria: "Lavado", creative: "L-320x480", impresiones: 50_000, clicks: 150, starts: 0, q50: 0 },
    { mes: "2026-09-01", canal: "Programmatic", categoria: "Lavado", creative: "L-320x480", impresiones: 50_000, clicks: 75, starts: 0, q50: 0 },
  ],
  dv360Reach: [
    { mes: "2026-08-01", canal: "Programmatic", categoria: "Lavado", impresiones: 300_000, reach: 100_000 },
    { mes: "2026-09-01", canal: "Programmatic", categoria: "Lavado", impresiones: 400_000, reach: 100_000 },
  ],
});
const by = (k: string) => fr.piezas.find((x) => x.key === k);
ok("A fatiga (CTR −50%, frecuencia 2→3)", by("meta_A")?.estado === "fatiga" && near(by("meta_A")?.caidaPct, -50, 0.01), by("meta_A"));
ok("B sin fatiga (frecuencia baja)", by("meta_B")?.estado === "ok" && /no es desgaste/.test(by("meta_B")?.motivo ?? ""), by("meta_B"));
ok("C sin serie", !by("meta_C") && fr.sinSerie === 1);
ok("D frecuencia alta", by("meta_D")?.estado === "frecuencia_alta", by("meta_D"));
ok("E no evaluada (no está al aire)", !by("meta_E"));
ok("DV360 fatiga con frecuencia de la línea", by("dv_Programmatic|L-320x480")?.estado === "fatiga" && by("dv_Programmatic|L-320x480")?.frecFuente === "línea");
ok("mes en curso marcado parcial", by("meta_A")?.parcial === true);
ok("orden: fatiga primero", fr.piezas[0]?.estado === "fatiga");
const fs = fatigaSignals(fr);
ok("señales de fatiga (2) + frecuencia alta (1)", fs.filter((s) => s.key.startsWith("pauta_creative_fatigue_")).length === 2 && fs.some((s) => s.key === "pauta_frecuencia_mensual_alta"), fs.map((s) => s.key));

console.log(`pauta-pacing/fatiga: ${p} OK, ${f} FAIL`);
if (f) process.exit(1);
