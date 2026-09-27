// "Confianza en el dato" por tablero (lib/data-health.ts, portado de BIP sep-2026). Misma regla de
// frescura que /monitoreo. cd apps/web && npx tsx scripts/data-health.test.ts
import { DASH_FUENTES, buildSaludDash, fmtEdad } from "../src/lib/data-health";
import { PROCS } from "../src/lib/monitoreo-config";

let pass = 0, fail = 0;
const ok = (c: unknown, m: string) => { if (c) pass++; else { fail++; console.error(`✗ ${m}`); } };

const now = Date.UTC(2026, 8, 27, 12);
const hAgo = (h: number) => new Date(now - h * 3_600_000).toISOString();
const perf = DASH_FUENTES.performance!;
ok(perf.map((f) => f.label).join() === "Meta Ads,DV360,Google Ads,OMD (carga mensual)", "performance: Meta, DV360, Google Ads, OMD");

const bien = buildSaludDash(perf, [hAgo(3), hAgo(9), hAgo(20), hAgo(24 * 5)], now);
ok(bien.peor === "ok" && bien.resumen === "Datos al día", "todo dentro de 1,5× la cadencia → al día");
const atr = buildSaludDash(perf, [hAgo(3), hAgo(50), hAgo(20), hAgo(24 * 5)], now);
ok(atr.peor === "atrasado" && /DV360 está atrasado/.test(atr.resumen), `DV360 a 50 h (cadencia 24) → atrasado (${atr.resumen})`);
const crit = buildSaludDash(perf, [hAgo(100), hAgo(80), hAgo(20), null], now);
ok(crit.peor === "critico" && /Meta Ads, DV360 están desactualizados/.test(crit.resumen), `crítico gana y lista las fuentes (${crit.resumen})`);
ok(crit.items[3]!.estado === "sindato", "sin fecha → sindato (no crítico)");
ok(fmtEdad(0.5) === "hace <1 h" && fmtEdad(30) === "hace 30 h" && fmtEdad(24 * 5) === "hace 5 d" && fmtEdad(null) === "sin fecha", "fmtEdad");
ok(buildSaludDash([], [], now).resumen === "", "sin fuentes → vacío");

// Coherencia con /monitoreo: las fuentes compartidas usan la misma tabla y cadencia que PROCS.
const byTabla = new Map(PROCS.filter((p) => !p.filter).map((p) => [`${p.tabla}|${p.col ?? "updated_at"}`, p.cadenciaH]));
for (const [dash, fs] of Object.entries(DASH_FUENTES)) {
  for (const f of fs) {
    ok(!/web_traffic/.test(f.tabla), `${dash}: no usa web_traffic (lectura lenta)`);
    const c = byTabla.get(`${f.tabla}|${f.col}`);
    if (c != null && !f.filter) ok(c === f.cadenciaH, `${dash} · ${f.label}: misma cadencia que /monitoreo (${c} h)`);
  }
}

console.log(`data-health: ${pass} OK, ${fail} fallas`);
if (fail) process.exit(1);
