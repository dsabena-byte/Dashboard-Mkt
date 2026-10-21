// Plan de Medios anual: reproduce el Excel BGT 2027 aprobado + impactos. npx tsx scripts/plan-medios-anual.test.ts
import { calcInversion, calcPlan, inflAcum, planDefault, sanearPlan, referencias } from "../src/lib/plan-medios-anual";
import type { PautaMesMedios } from "../src/lib/pauta-medios-model";

let fails = 0;
const ok = (c: boolean, msg: string) => { if (!c) { fails++; console.error("✗", msg); } else console.log("✓", msg); };
const near = (a: number, b: number, tol = 1) => Math.abs(a - b) <= tol;

const infl: Record<string, number> = {};
[2.0, 1.8, 1.7, 1.8, 1.5, 1.6, 1.8, 2.0, 1.9, 1.9, 2.1, 2.3].forEach((v, i) => { infl[`2027-${String(i + 1).padStart(2, "0")}`] = v; });
const cfg = planDefault(2027);
const inv = calcInversion(cfg, infl);

// Números del Excel aprobado (hoja "BGT 2027 medios").
ok(near(inv.montos.OOH![3]!, 29568339.36), "OOH abril = 28 M × inflación ene–mar");
ok(near(inv.montos.OOH![9]!, 32844041.786), "OOH octubre ajustado 3 veces");
ok(near(inv.montos.TV![3]!, 62325000) && near(inv.montos.Radio![9]!, 20775000) && near(inv.montos.DOOH![4]!, 11080000), "olas TV/Radio/DOOH");
ok(near(inv.montos.Meta![0]!, 6285714.286) && near(inv.montos.Meta![8]!, 80902596.783), "Meta = remanente × 20/70");
ok(near(inv.montos["Google Demand Gen"]![0]!, 2200000), "Demand Gen enero");
ok(inv.total.every((t, i) => near(t, cfg.bgt[i]!)), "total por mes = BGT");
const sumObj = Object.values(inv.objetivos).reduce((s, a) => s + a.reduce((x, y) => x + y, 0), 0);
ok(near(sumObj, 2.77e9, 10), "objetivos suman el BGT");
ok(near(inv.categorias.Lavado![0]!, 34600000) && near(inv.categorias.Brand![3]!, 116599504.701, 5), "categorías (OOH ene→Lavado, TV/Radio→Brand)");
ok(near(inv.medioCat.TV!.Brand!, 415500000) && near(inv.medioCat.OOH!.Lavado!, 84000000), "medio × categoría");
ok(near(inv.medioCat["Mercado Ads"]!.Lavado! + inv.medioCat["Mercado Ads"]!.Brand!, 64068901 + 39382050, 50), "Mercado Ads por categoría");
ok(near(inv.objetivos["Conversión"]![0]!, (inv.montos["Mercado Ads"]![0]! * 0.2) + inv.montos["Geo Mobile"]![0]!), "Mercado Ads aporta 20% a Conversión");
ok(inv.avisos.length === 0, `sin avisos (${inv.avisos.join(" | ")})`);
ok(calcInversion(cfg, {}).avisos.some((a) => a.includes("Falta la inflación")), "avisa inflación faltante");
ok(near(inflAcum(infl, "2026-12", "2027-03").f, 1.02 * 1.018 * 1.017, 1e-9), "inflAcum");

// Saneado: basura → valores válidos, nunca tira.
const s = sanearPlan({ bgt: ["x", -5, 1e20], medios: [{ medio: "Meta", reparto: "zz", rol: [200], cat: ["Lavado", "Nope"] }, { medio: "" }] }, 2027);
ok(s.bgt[0] === 0 && s.bgt[1] === 0 && s.medios.length === 1 && s.medios[0]!.reparto === "curva" && s.medios[0]!.rol[0] === 100 && s.medios[0]!.cat[1] === null, "sanearPlan");
ok(JSON.stringify(sanearPlan(JSON.parse(JSON.stringify(cfg)), 2027)) === JSON.stringify(cfg), "sanearPlan conserva un plan válido");

// Impactos: referencias sintéticas.
const mes = (iso: string, medios: PautaMesMedios["medios"]): PautaMesMedios => ({ mesIdx: 0, mesLabel: "", iso, tot: { inv: 0, alc: 0, impr: 0, clic: 0, v50: 0, vbase: 0 }, medios });
const e = (inv: number, impr: number, alc = impr / 2, clic = impr / 100, vbase = impr / 2, v50 = impr / 10) => ({ inv, impr, alc, clic, vbase, v50, fuente: "api" as const });
const meses = [
  mes("2026-07-01", { Meta: e(10e6, 30e6), OOH: e(35e6, 7.5e6), TV: e(20e6, 0) }),
  mes("2026-08-01", { Meta: e(20e6, 50e6), OOH: e(35e6, 7.5e6) }),
  mes("2026-09-01", { Meta: e(30e6, 70e6), OOH: e(10e6, 7.5e6) }),
  mes("2026-10-01", { Meta: e(40e6, 90e6) }),
];
const refs = referencias(meses, cfg.medios);
ok(refs.Meta!.meses.join() === "2026-09,2026-10" && near(refs.Meta!.inv, 35e6), "Meta toma los 2 meses recientes");
ok(refs.OOH!.fijo && refs.TV === null, "OOH = contactos fijos; TV sin medición");
ok(refs["Otros (test & learn)"]!.fuente.includes("promedio"), "Otros = promedio digital");
const p = calcPlan(cfg, meses, infl);
const metaSep = p.impactos.porMedio.Meta![8]!;
ok(metaSep.impr > 0 && near(metaSep.v50 / metaSep.vbase, 0.2, 1e-9), "Meta: impactos y VTR de la referencia");
ok(p.impactos.porMedio.OOH![0]!.impr === 7.5e6, "OOH fijo todos los meses");
ok(p.impactos.porMedio.TV === null && p.impactos.avisos.some((a) => a.startsWith("TV")), "TV sin medición avisada");
// más inflación → menos impactos con la misma plata
const p2 = calcPlan(cfg, meses, Object.fromEntries(Object.entries(infl).map(([k, v]) => [k, v * 3])));
ok(p2.impactos.porMedio.Meta![11]!.impr < p.impactos.porMedio.Meta![11]!.impr, "la inflación encarece los impactos");
ok(p.metas["Inversión"][0] === 50e6 && (p.metas["VTR (≥50%)"][0] ?? 0) > 0 && (p.metas["Frecuencia"][0] ?? 0) > 0, "metas mensuales");

if (fails) { console.error(`${fails} fallas`); process.exit(1); }
console.log("OK");
