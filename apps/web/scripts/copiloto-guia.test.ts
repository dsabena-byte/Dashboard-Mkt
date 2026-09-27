// "Guiame paso a paso" (lib/copiloto-guia.ts) + textos de prioridad. Correr: cd apps/web && npx tsx scripts/copiloto-guia.test.ts
import { promptGuia, textoPlano, tableroLabel, GUIA_MARCA, COPILOTO_ASK_EVENT } from "../src/lib/copiloto-guia";
import { explicarPrioridad, calcPrioridad, estimarEsfuerzo } from "../src/lib/recomendacion";

let pass = 0, fail = 0;
function ok(name: string, cond: boolean, extra?: unknown) {
  if (cond) pass++; else { fail++; console.error(`✗ ${name}${extra !== undefined ? `\n   ${JSON.stringify(extra)}` : ""}`); }
}

ok("evento", COPILOTO_ASK_EVENT === "copiloto:ask");
ok("texto plano sin HTML", textoPlano("Sano <b>~75–100%</b> &lt;50%  ok") === "Sano ~75–100% <50% ok", textoPlano("Sano <b>~75–100%</b> &lt;50%  ok"));
ok("label por slug", tableroLabel("seo-search") === "Optimización SEO" || (tableroLabel("seo-search") ?? "").startsWith("Optimización SEO"), tableroLabel("seo-search"));
ok("label por ruta con sub-ruta", tableroLabel("/performance/simulador") === "Plan de Medios", tableroLabel("/performance/simulador"));
ok("label ruta sin copiloto = null", tableroLabel("/guia") === null);

const p = promptGuia({
  tipo: "oportunidad", dash: "seo-search",
  titulo: "Cocinas: 38 búsquedas donde aparecés entre el 4° y el 20° lugar de Google",
  dato: '"cocina 4 hornallas" #7 (2.400/mes)', impacto: "+304 a +607 clicks/mes",
  queHacer: ["Mejorar la página que ya aparece", "Poner links internos"],
});
ok("arranca con la marca del modo guía", p.startsWith(GUIA_MARCA), p);
ok("nombra el tablero", p.includes("del tablero Optimización SEO"), p);
ok("incluye título, dato, impacto y qué hacer", p.includes("«Cocinas: 38") && p.includes("Dato: \"cocina 4 hornallas\"") && p.includes("Impacto estimado: +304") && p.includes("(1) Mejorar la página") && p.includes("(2) Poner links"), p);
ok("pide guía no técnica", /No soy técnico/.test(p) && /quién/.test(p) && /mensaje listo para copiar/.test(p));
const largo = promptGuia({ titulo: "x".repeat(5000) });
ok("tope de largo", largo.length <= 2500, largo.length);

const rec = { prioridad: calcPrioridad(5, "media", 1), impactoNivel: 5, confianza: { nivel: "media" as const, motivo: "" }, esfuerzo: estimarEsfuerzo("title", "seo-search") };
const t = explicarPrioridad(rec);
ok("prioridad en palabras primero", t.startsWith("Hacela primero"), t);
ok("fórmula al final", /Cálculo: impacto × confianza ÷ esfuerzo = 3,5\.$/.test(t), t);

console.log(`copiloto-guia: ${pass} OK, ${fail} FAIL`);
if (fail) process.exit(1);
