// AACC de Mkt Canal: npx tsx scripts/aacc.test.ts
import { procesarFacturacion } from "../src/lib/cb-ventas/core";
import { armarEmail, armarEml, calcularProvision, categoriaDeSku, parseEmails, resumenMeses, type Acuerdo } from "../src/lib/aacc-core";

let ok = 0, fail = 0;
const t = (n: string, c: boolean, x?: unknown) => { if (c) ok++; else { fail++; console.error("✗", n, x ?? ""); } };

// Categorías del maestro tr_skus
t("lavadoras", categoriaDeSku("LAVADO Y SECADO", "LAVADORAS") === "Lavado");
t("lavavajillas (división «más para el hogar»)", categoriaDeSku("MÁS PARA EL HOGAR", "LAVAVAJILLAS") === "Lavavajillas");
t("congeladores", categoriaDeSku("REFRIGERACIÓN", "CONGELADORES") === "Refrigeración");
t("estufas", categoriaDeSku("COCCIÓN", "ESTUFAS") === "Cocción");
t("sin dato", categoriaDeSku(null, null) === null);
t("Grupo de artículos del Excel", categoriaDeSku("Lavado", "Lavado") === "Lavado" && categoriaDeSku("Refrigeración", "Refrigeración") === "Refrigeración" && categoriaDeSku("Cocción", "Cocción") === "Cocción" && categoriaDeSku("Lavavajillas", "Lavavajillas") === "Lavavajillas");

// Octubre 2026 del mail del user: Cetrogar 1,5% de todo; Naldo 2% de Lavado + Lavavajillas; resto fijo.
const fijo = (cliente: string, oct: number): Acuerdo => ({ anio: 2026, cliente, razon_social: cliente.toUpperCase(), cliente_sap: null, tipo: "fijo", pct: null, categorias: [], montos: Array.from({ length: 12 }, (_, i) => (i === 9 ? oct : 0)), orden: 5 });
const acuerdos: Acuerdo[] = [
  { anio: 2026, cliente: "Cetrogar", razon_social: "CETROGAR SA", cliente_sap: "CETROGAR SA", tipo: "pct", pct: 1.5, categorias: [], montos: Array(12).fill(0), orden: 1 },
  { anio: 2026, cliente: "Naldo", razon_social: "NALDO LOMBARDI S A", cliente_sap: "NALDO LOMBARDI S A", tipo: "pct", pct: 2, categorias: ["Lavado", "Lavavajillas"], montos: Array(12).fill(0), orden: 2 },
  fijo("Rodo", 600000), fijo("Oncity", 20839783), fijo("Frávega", 30000000), fijo("Cencosud (Jumbo)", 4485600), fijo("Sin acuerdo en oct", 0),
];
const fact = {
  "CETROGAR SA": { Lavado: 1_000_000_000, Refrigeración: 900_000_000, Cocción: 82_767_920 },
  "NALDO LOMBARDI S A": { Lavado: 600_000_000, Lavavajillas: 49_646_143, Refrigeración: 300_000_000, sin_categoria: 10 },
};
const filas = calcularProvision(acuerdos, 9, fact);
const by = (c: string) => filas.find((f) => f.cliente === c)!;
t("Cetrogar = 1,5% de toda la facturación (mail: 29.741.519)", by("Cetrogar").aacc === 29741519, by("Cetrogar"));
t("Naldo = 2% de Lavado + Lavavajillas (mail: 12.992.923)", by("Naldo").aacc === 12992923, by("Naldo"));
t("Naldo no suma Refrigeración", by("Naldo").facturacion === 649_646_143);
t("Naldo avisa SKUs sin categoría", !!by("Naldo").aviso);
t("fijo sin monto en el mes no aparece", !filas.some((f) => f.cliente === "Sin acuerdo en oct"));
const total = filas.reduce((s, f) => s + f.aacc, 0);
t("total octubre = mail (98.659.825)", total === 98659825, total);
t("sin facturación en $ → aviso y 0", calcularProvision(acuerdos, 9, null).find((f) => f.cliente === "Naldo")!.aviso === "Falta la facturación en $ en la base");

// Grilla y mail: ago falta Jumbo (4.485.600), sep falta Frávega + Rodo (27.590.506) → falta ene–sep 32.076.106.
const real = [56215017, 84530664, 113125554, 124684794, 71146256, 60659412, 89514321, 54650501, 71736904, 0, 0, 0];
const liq = [...real.slice(0, 7), 50164901, 44146398, 0, 0, 0];
const res = resumenMeses({ real, mensual: [45300861, 60801496, 91996150, 113028817, 90498725, 42488614, 74491481, 54650501, 62352049, total, null, null], liquidado: liq, tieneReal: real.map((v) => v > 0) });
t("falta ago", res[7]!.faltaLiquidar === 4485600);
t("falta sep", res[8]!.faltaLiquidar === 27590506);
t("diferencia sep", res[8]!.diferencia === 9384855);
t("oct sin real: falta = mensual", res[9]!.provReal === null && res[9]!.faltaLiquidar === total);
const mail = armarEmail({ anio: 2026, mes: 9, filas, resumen: res });
t("asunto", mail.asunto === "Provisión AACC Octubre 2026");
t("provisión del mes en el texto", mail.texto.includes("La provisión de Octubre de AACC es: $ 98.659.825"), mail.texto);
t("falta liquidar ene–sep (mail: 32.076.106)", mail.texto.includes("Falta liquidar de Enero-Septiembre: $ 32.076.106"));
t("total provisión + falta (mail: 130.735.931)", mail.texto.includes("$ 130.735.931"));
t("html escapa", !armarEmail({ anio: 2026, mes: 9, filas: [{ ...filas[0]!, razon_social: "<b>x</b>" }], resumen: res }).html.includes("<b>x</b>"));
const eml = armarEml({ para: ["a@mabe.com.ar"], cc: ["b@mabe.com.ar"], email: mail });
t("eml borrador", eml.startsWith("X-Unsent: 1\r\nTo: a@mabe.com.ar\r\nCc: b@mabe.com.ar\r\nSubject: =?UTF-8?B?"));
const cuerpo = eml.split("\r\n\r\n")[1]!.replace(/\r\n/g, "");
t("eml decodifica", Buffer.from(cuerpo, "base64").toString("utf8").includes("Provisión de Octubre") || Buffer.from(cuerpo, "base64").toString("utf8").includes("provisión de Octubre"));
t("parseEmails", JSON.stringify(parseEmails("A@mabe.com.ar; b@mabe.com.ar, nada, a@mabe.com.ar")) === JSON.stringify(["a@mabe.com.ar", "b@mabe.com.ar"]));

const pf = procesarFacturacion([{ cliente: "A", categoria: "Lavado", fecha: 20261005, importe: 1000.5 }, { cliente: "A", sku: "X", fecha: 20261006, importe: "$ 1.234.567,89" }, { cliente: "", fecha: "2026-10-05", importe: 1 }]);
t("facturación: normaliza importe es-AR y fecha", pf.rows[1]?.importe === 1234567.89 && pf.rows[1]?.fecha === "2026-10-06" && pf.invalidos === 1 && pf.rows[0]?.categoria === "Lavado" && pf.rows[0]?.fecha === "2026-10-05", pf);
console.log(`aacc: ${ok} OK, ${fail} fallas`);
if (fail) process.exit(1);
