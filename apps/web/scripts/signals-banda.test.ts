// Test del rango esperado en el motor de señales (lib/signals/banda, portado de BIP sep-2026) + señal
// de pace-to-goal del overview. cd apps/web && npx tsx scripts/signals-banda.test.ts
import { rangoEsperado, dentroDeLoNormal, datosRango } from "../src/lib/signals/banda";
import { computePautaSignals } from "../src/lib/signals/pauta";
import { computeRedesSignals } from "../src/lib/signals/redes";
import { computeOverviewSignals } from "../src/lib/signals/overview";
import { pronosticoMeta } from "../src/lib/stats/meta";
import type { PautaFull, SeguimientoObjetivos } from "../src/lib/signals/model";

let fail = 0, okN = 0;
const ok = (c: unknown, m: string) => { if (c) okN++; else { fail++; console.error(`FAIL ${m}`); } };
const MES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

// ── Helper ──
{
  const ev = rangoEsperado([100, 104, 98, 101, 103, 97, 100], 150);
  ok(ev && !ev.dentro && !dentroDeLoNormal(ev), "150 fuera de lo normal → no se silencia");
  ok(dentroDeLoNormal(rangoEsperado([100, 104, 98, 101, 103, 97, 100], 101)), "101 dentro → se silencia");
  ok(!dentroDeLoNormal(rangoEsperado([100, 101, 102], 300)), "sin banda (n<6) → decide el umbral de la regla");
  ok(datosRango(null) === undefined && datosRango(ev)!.min < datosRango(ev)!.max, "datosRango");
}

// ── Pauta: inflación de CPM ──
const pauta = (cpms: number[]): PautaFull => ({
  ok: true, currency: "ARS", rangeLabel: "", totals: {} as PautaFull["totals"], byObjective: [], topCreatives: [],
  byCampaign: [{ name: "Camp", objective: "OUTCOME_AWARENESS", spend: 1000, impressions: 100000, reach: 50000, clicks: 100, plays: 0, p25: 0, p50: 0, p75: 0, p100: 0, thruplay: 0, vbase: 0, frequency: 2 } as unknown as PautaFull["byCampaign"][number]],
  monthly: cpms.map((c, i) => ({ mes: MES[i], mesIdx: i, inv: c * 100, alc: 1000, impr: 100000 / 1000 * 1000, clic: 10, v50: 0, vbase: 0 })),
});
const now = new Date(Date.UTC(2026, 8, 15));
{
  const estable = computePautaSignals(pauta([5, 5.1, 4.9, 5, 5.05, 4.95, 5, 7]), { now });
  const s = estable.find((x) => x.key === "pauta_cpm_inflation");
  ok(s, "CPM estable que salta +40% → alerta");
  ok(s && (s.datos as { rangoEsperado?: unknown }).rangoEsperado && /rango esperado/.test(s.descripcion), "la alerta trae el rango esperado");
  const volatil = computePautaSignals(pauta([4, 8, 4, 8, 4, 8, 4, 9]), { now });
  ok(!volatil.some((x) => x.key === "pauta_cpm_inflation"), "CPM volátil: +35% dentro del rango normal → sin alerta");
  const corto = computePautaSignals(pauta([5, 5, 5, 7]), { now });
  ok(corto.some((x) => x.key === "pauta_cpm_inflation"), "4 meses (sin banda) → umbral fijo como antes");
}

// ── Redes: caída de alcance mensual IG ──
const redes = (alc: number[]) => computeRedesSignals({
  refDate: now,
  ig: { ok: true, monthly: alc.map((a, i) => ({ mes: MES[i], anio: 2026, mesIdx: i, alcance: a, engagement: a * 0.05, likes: 0, comentarios: 0, guardados: 0 })), topPosts: [] } as unknown as Parameters<typeof computeRedesSignals>[0]["ig"],
});
{
  ok(redes([1000, 1020, 990, 1010, 1000, 995, 1005, 700]).some((x) => x.key === "redes_ig_monthly_reach_drop"), "alcance estable que cae 30% → alerta");
  ok(!redes([500, 1500, 400, 1600, 450, 1550, 1500, 700]).some((x) => x.key === "redes_ig_monthly_reach_drop"), "alcance volátil: caída dentro de lo normal → sin alerta");
}

// ── Overview: pace-to-goal ──
{
  const realM = Array.from({ length: 12 }, (_, i) => (i < 8 ? 100 + (i % 2 ? 3 : -3) : null));
  const metaM = Array(12).fill(150);
  const seg = {
    disponible: true, refMes: "Ago", objetivos: [], saludMarca: { cumplMes: null, cumplYtd: null, cumplSerie: Array(12).fill(null) },
    kpis: [{ plan: "Pauta Mkt", kpi: "Clicks", medida: "", unit: "", tipo: "sum", realM, metaM, direccion: "up", umbralVerde: 100, umbralAmarillo: 90 }],
  } as unknown as SeguimientoObjetivos;
  const sig = computeOverviewSignals(seg);
  const off = sig.find((s) => s.key.startsWith("overview_kpi_off_pace"));
  ok(off && off.prioridad === "alta" && /probabilidad/.test(off.titulo), "meta +50% sobre el ritmo → off-pace alta");
  ok(off && /\+\d+% sobre el ritmo/.test(off.descripcion), "off-pace dice cuánto falta");
  const seg2 = { ...seg, kpis: [{ ...seg.kpis[0]!, metaM: Array(12).fill(90) }] } as SeguimientoObjetivos;
  ok(pronosticoMeta({ realM, metaM: Array(12).fill(90), tipo: "sum", direccion: "up" }).resumen.probabilidad! > 0.7, "control: meta 90 es probable");
  ok(!computeOverviewSignals(seg2).some((s) => s.key.startsWith("overview_kpi_off_pace")), "meta alcanzable → sin off-pace");
}

if (fail) { console.error(`signals-banda: ${okN} OK, ${fail} FAIL`); process.exit(1); }
console.log(`signals-banda: ${okN} OK, 0 FAIL`);
