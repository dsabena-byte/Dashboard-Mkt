// Test de las partes PURAS de WhatsApp (lib/whatsapp-shared): normalización de números AR y armado de
// mensajes. Correr: cd apps/web && npx tsx scripts/whatsapp.test.ts
import { normalizeWhatsAppNumber as norm, cleanPhones, formatPhone, formatAlertsWhatsApp, buildAlertsWhatsApp, formatReporteWhatsApp, formatTestWhatsApp, waPlain, WA_MAX_CHARS, type ReporteWaData } from "../src/lib/whatsapp-shared";
import type { AlertItem } from "../src/lib/alerts-shared";

let fails = 0;
const ok = (cond: boolean, msg: string) => { if (!cond) { fails++; console.error("  ✗", msg); } else console.log("  ✓", msg); };

console.log("1 · números");
const AMBA = "5491112345678";
for (const s of ["11 1234-5678", "1112345678", "011 15 1234-5678", "(011) 15-1234-5678", "+54 11 1234 5678", "+54 9 11 1234-5678", "5491112345678", "541112345678", "0054 9 11 1234 5678"]) {
  ok(norm(s) === AMBA, `"${s}" → ${norm(s)}`);
}
ok(norm("351 15 555-1234") === "5493515551234", "Córdoba con 15 → 5493515551234");
ok(norm("0351 555-1234") === "5493515551234", "Córdoba con 0 → 5493515551234");
ok(norm("2944 15 12-3456") === "5492944123456", "Bariloche (4 dígitos) con 15");
ok(norm("+598 99 123 456") === "59899123456", "otro país con + se respeta");
ok(norm("1234-5678") === null && norm("") === null && norm("hola") === null && norm("+54 11 123") === null, "inválidos → null");
ok(cleanPhones("11 1234-5678, +54 9 11 1234 5678; nope\n351 555 1234").join() === `${AMBA},5493515551234`, "cleanPhones: normaliza, dedup, descarta inválidos");
ok(cleanPhones(Array.from({ length: 30 }, (_, i) => `11 1234-${String(1000 + i)}`)).length === 20, "tope 20 números");
ok(formatPhone(AMBA) === "+54 9 11 1234-5678" && formatPhone("5493515551234") === "+54 9 351 555-1234", "formatPhone para mostrar");
ok(norm(formatPhone(AMBA)) === AMBA && norm(formatPhone("5493515551234")) === "5493515551234", "ida y vuelta formatPhone → norm");

console.log("2 · mensajes");
const ctx = { marca: "Drean", appUrl: "https://dashboard-mkt-seven.vercel.app/" };
const it = (i: number, p: AlertItem["prioridad"] = "alta", accion: string | null = "Pedile a la agencia que revise la frecuencia."): AlertItem => ({
  key: `k${i}`, fuente: "senal", dash: "performance", tipo: "alerta", prioridad: p,
  titulo: `El costo por mil impresiones (CPM) de Meta subió ${10 + i}% *urgente*`,
  descripcion: "Pagaste más por cada mil personas alcanzadas que el mes anterior. ".repeat(6), accion, href: "/performance",
});
const items = Array.from({ length: 9 }, (_, i) => it(i, i < 3 ? "alta" : "media"));
const sem = formatAlertsWhatsApp(items, "semanal", ctx);
ok(sem.length <= WA_MAX_CHARS, `semanal ≤ ${WA_MAX_CHARS} (${sem.length})`);
ok(sem.startsWith("*Drean · Resumen semanal de alertas*"), "título en negrita");
const n = (sem.match(/^\*\d+\. /gm) ?? []).length;
ok(n >= 3 && n <= 5, `entre 3 y 5 alertas (${n})`);
ok(sem.includes(`Acá van ${n} de ${items.length}`), "la intro dice cuántas se muestran de verdad");
ok(buildAlertsWhatsApp(items, "semanal", ctx).shown.length === n, "shown = las que entraron (dedupe)");
ok((sem.match(/Qué hacer: /g) ?? []).length === n, "cada alerta con su 'Qué hacer'");
ok(sem.includes("https://dashboard-mkt-seven.vercel.app/alerts") && !sem.includes(".app//"), "link al dashboard sin doble barra");
ok(!/<[a-z]/i.test(sem) && !sem.includes("*urgente*"), "sin HTML y sin asteriscos del contenido");
const sinAccion = formatAlertsWhatsApp([it(1, "alta", null)], "diaria", ctx);
ok(sinAccion.includes("Qué hacer: Abrí el tablero"), "sin acción → 'qué hacer' por defecto");
ok(sinAccion.includes("Alertas del día") && sinAccion.includes("(1 de prioridad alta)"), "diaria: título e intro");
ok(formatAlertsWhatsApp([], "prueba", ctx).includes("No hay alertas"), "vacío = mensaje claro");
const huge = formatAlertsWhatsApp(items.map((x) => ({ ...x, titulo: x.titulo.repeat(10) })), "semanal", ctx);
ok(huge.length <= WA_MAX_CHARS, `títulos enormes igual entra (${huge.length})`);

const rep: ReporteWaData = {
  mesLbl: "agosto 2026", saludMarca: { mes: 92.4, ytd: 95.1 },
  objetivos: [{ nombre: "TOM", mes: 101, ytd: 98 }, { nombre: "SOM", mes: 88, ytd: 90 }, { nombre: "Intención", mes: null, ytd: null }],
  kpisBrecha: [{ kpi: "VTR (≥50%)", plan: "Pauta Mkt", c: 71 }, { kpi: "Frecuencia", plan: "Pauta Mkt", c: 85 }, { kpi: "Alcance", plan: "Redes", c: 120 }],
  shareOfSearch: 23.84, alertas: items,
};
const r = formatReporteWhatsApp(rep, ctx);
ok(r.length <= WA_MAX_CHARS, `reporte ≤ ${WA_MAX_CHARS} (${r.length})`);
ok(r.includes("*Salud de Marca:* 92% de cumplimiento (cerca)") && r.includes("• TOM: 101% (año 98%)") && r.includes("• Intención: sin dato"), "scorecard de objetivos");
ok(r.includes("VTR (≥50%) (Pauta Mkt): 71% de la meta") && !r.includes("Alcance (Redes)"), "KPIs con brecha (sin los que cumplen)");
ok(r.includes("23,8%") && r.includes("/overview") && r.includes("*Lo que hay que mirar*"), "SoS, link y alertas");
const r0 = formatReporteWhatsApp({ ...rep, saludMarca: null, objetivos: [], kpisBrecha: [], shareOfSearch: null, alertas: [] }, ctx);
ok(r0.includes("Todavía no hay objetivos") && r0.includes("todos en meta o sin dato"), "reporte vacío legible");
ok(formatTestWhatsApp(ctx).includes("Prueba de WhatsApp"), "mensaje de prueba");
ok(waPlain(" a *b*  _c_ ~d~ `e` ") === "a b c d e", "waPlain limpia formato");

if (fails) { console.error(`\n${fails} FALLAS`); process.exit(1); }
console.log("\nOK");
