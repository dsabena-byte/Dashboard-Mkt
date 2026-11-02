// AACC (acuerdos comerciales con clientes) · Mkt Canal — núcleo PURO y client-safe (2-nov-2026, pedido del user).
// Flujo: acuerdo anual por cliente (monto fijo por mes o % de la facturación de ciertas categorías) →
//   · Provisión MENSUAL = foto antes de que cierre el mes (facturación parcial), se manda a Finanzas.
//   · Provisión REAL    = mes calendario cerrado (facturación definitiva); con ese monto se hacen Solped y OC.
//   · Falta liquidar    = provisión real − gastos del cliente con Nº de factura en Inversión.
// La facturación es solo FC (sin back order). Test: npx tsx scripts/aacc.test.ts

export const CATEGORIAS_AACC = ["Lavado", "Lavavajillas", "Refrigeración", "Cocción"] as const;
export type CategoriaAacc = (typeof CATEGORIAS_AACC)[number];
export const MESES_AACC = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

export interface Acuerdo {
  anio: number;
  cliente: string;              // nombre en el tablero (Naldo, Cetrogar, Oncity…)
  razon_social: string;         // como va en el mail a Finanzas
  cliente_sap: string | null;   // nombre en la facturación (vt_facturacion.cliente); solo hace falta para los de %
  proveedor: string | null;     // Nº o nombre de proveedor con el que se carga el gasto en Inversión (vacío = razón social)
  tipo: "fijo" | "pct";
  pct: number | null;           // 2 = 2%
  categorias: CategoriaAacc[];  // vacío = todas
  montos: number[];             // 12 meses, solo "fijo"
  orden: number;
}

/** Cuenta de Inversión de Marketing donde se cargan los AACC (concepto «ACCIONES COMPARTIDAS»). */
export const CUENTA_AACC = "6202010084";

export interface LineaInversion { mes: number; proveedor: string | null; nro_proveedor: string | null; nro_recepcion: string | null; factura: string | null; ars: number }
export interface Liquidacion { mes: string; cliente: string; monto: number; factura: string | null; proveedor: string | null }

const normProv = (s: string | null | undefined) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "");

/** Liquidado = gastos de la cuenta de AACC en Inversión (REAL) con Nº de factura (regla del user 2-nov). Cliente: por Nº o nombre de proveedor del
 *  acuerdo, o nombre igual a la razón social / cliente de facturación / cliente. Sin match → «(sin cliente)». */
export function liquidadoDeInversion(anio: number, lineas: LineaInversion[], acuerdos: Pick<Acuerdo, "cliente" | "razon_social" | "cliente_sap" | "proveedor">[]): Liquidacion[] {
  const claves = acuerdos.map((a) => ({ cliente: a.cliente, keys: [a.proveedor, a.razon_social, a.cliente_sap, a.cliente].map(normProv).filter(Boolean) }));
  const out: Liquidacion[] = [];
  for (const l of lineas) {
    if (!String(l.factura ?? "").trim() || !(l.mes >= 1 && l.mes <= 12)) continue;
    const k = [normProv(l.nro_proveedor), normProv(l.proveedor)].filter(Boolean);
    const c = claves.find((x) => x.keys.some((y) => k.includes(y)));
    out.push({ mes: `${anio}-${String(l.mes).padStart(2, "0")}`, cliente: c?.cliente ?? "(sin cliente)", monto: Number(l.ars) || 0, factura: l.factura, proveedor: l.proveedor ?? l.nro_proveedor });
  }
  return out;
}

/** Categoría de un SKU según el maestro (tr_skus: división + categoría). */
export function categoriaDeSku(division: string | null | undefined, categoria: string | null | undefined): CategoriaAacc | null {
  const c = (categoria ?? "").toUpperCase(), d = (division ?? "").toUpperCase();
  if (c.includes("LAVAVAJILLA")) return "Lavavajillas";
  if (d.includes("LAVADO") || /LAVADORA|SECADORA|LAVASECA/.test(c)) return "Lavado";
  if (d.includes("REFRIGER") || /REFRIGER|CONGELA|FRIGOBAR|CAVA/.test(c)) return "Refrigeración";
  if (d.includes("COCCI") || /ESTUFA|HORNO|MICROONDA|PARRILLA|CAMPANA|COCINA/.test(c)) return "Cocción";
  return null;
}

/** Facturación de un cliente: categoría → $ (null = sin categoría en el maestro). */
export type FactCliente = Partial<Record<CategoriaAacc | "sin_categoria", number>>;

export interface FilaProvision {
  cliente: string; razon_social: string; acuerdo: string; categorias: string;
  facturacion: number | null; aacc: number; aviso: string | null;
}

export const fmtPct = (p: number) => `${p.toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 2 })}%`;
export const textoCategorias = (a: Pick<Acuerdo, "categorias">) => (a.categorias.length ? a.categorias.join(" - ") : "Drean");

/** Provisión de un mes (0–11) para cada acuerdo. `fact` = facturación por cliente_sap (null = no hay $ en la base). */
export function calcularProvision(acuerdos: Acuerdo[], mes: number, fact: Record<string, FactCliente> | null): FilaProvision[] {
  const out: FilaProvision[] = [];
  for (const a of [...acuerdos].sort((x, y) => x.orden - y.orden || x.cliente.localeCompare(y.cliente, "es"))) {
    if (a.tipo === "fijo") {
      const m = Number(a.montos[mes] ?? 0);
      if (m > 0) out.push({ cliente: a.cliente, razon_social: a.razon_social, acuerdo: `$ ${Math.round(m).toLocaleString("es-AR")}`, categorias: textoCategorias(a), facturacion: null, aacc: m, aviso: null });
      continue;
    }
    const pct = Number(a.pct ?? 0);
    if (!(pct > 0)) continue;
    const f = fact && a.cliente_sap ? fact[a.cliente_sap] : undefined;
    let aviso: string | null = null;
    let base: number | null = null;
    if (!fact) aviso = "Falta la facturación en $ en la base";
    else if (!a.cliente_sap) aviso = "Falta el cliente de facturación en el acuerdo";
    else {
      const cats = a.categorias.length ? a.categorias : [...CATEGORIAS_AACC];
      base = cats.reduce((s, c) => s + (f?.[c] ?? 0), 0);
      if (!a.categorias.length) base += f?.sin_categoria ?? 0; // "todas" incluye lo que el maestro no categoriza
      else if ((f?.sin_categoria ?? 0) > 0) aviso = `$ ${Math.round(f!.sin_categoria!).toLocaleString("es-AR")} facturados en SKUs sin categoría (no entran)`;
    }
    out.push({ cliente: a.cliente, razon_social: a.razon_social, acuerdo: fmtPct(pct), categorias: textoCategorias(a), facturacion: base, aacc: base == null ? 0 : Math.round((base * pct) / 100), aviso });
  }
  return out;
}

export interface MesResumen {
  mes: number;                       // 0–11
  liquidado: number;                 // facturas recepcionadas
  provMensual: number | null;        // foto antes del cierre
  provReal: number | null;           // mes cerrado
  diferencia: number | null;         // real − mensual
  faltaLiquidar: number;             // real (o mensual si todavía no hay real) − liquidado
}

/** Grilla por mes como la planilla: Total liquidado · Provisión mensual · Provisión real · Diferencia · Falta liquidar. */
export function resumenMeses(sumas: { real: number[]; mensual: (number | null)[]; liquidado: number[]; tieneReal: boolean[] }): MesResumen[] {
  return Array.from({ length: 12 }, (_, i) => {
    const provReal = sumas.tieneReal[i] ? sumas.real[i]! : null;
    const provMensual = sumas.mensual[i] ?? null;
    const base = provReal ?? provMensual ?? 0;
    return {
      mes: i, liquidado: sumas.liquidado[i] ?? 0, provMensual, provReal,
      diferencia: provReal != null && provMensual != null ? provReal - provMensual : null,
      faltaLiquidar: Math.max(0, base - (sumas.liquidado[i] ?? 0)),
    };
  });
}

const $ = (n: number | null | undefined) => (n == null ? "" : `$ ${Math.round(n).toLocaleString("es-AR")}`);
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export interface Email { asunto: string; html: string; texto: string }

/** Mail para Finanzas, con el mismo contenido que el que arma el user a mano. `mes` 0–11. */
export function armarEmail(p: { anio: number; mes: number; filas: FilaProvision[]; resumen: MesResumen[]; firma?: string }): Email {
  const nombreMes = MESES_AACC[p.mes]!;
  const total = p.filas.reduce((s, f) => s + f.aacc, 0);
  const faltaAnt = p.resumen.slice(0, p.mes).reduce((s, r) => s + r.faltaLiquidar, 0);
  const rango = p.mes === 0 ? "" : p.mes === 1 ? "Enero" : `Enero-${MESES_AACC[p.mes - 1]}`;
  const asunto = `Provisión AACC ${nombreMes} ${p.anio}`;
  const th = 'style="background:#44546a;color:#fff;padding:6px 10px;border:1px solid #fff;font-size:12px;text-align:center"';
  const td = 'style="padding:5px 10px;border:1px solid #bfbfbf;font-size:12px"';
  const tdr = 'style="padding:5px 10px;border:1px solid #bfbfbf;font-size:12px;text-align:right;white-space:nowrap"';
  const meses = p.resumen.slice(0, p.mes + 1);
  const filaRes = (titulo: string, val: (r: MesResumen) => number | null) =>
    `<tr><td ${th} style="background:#44546a;color:#fff;padding:5px 10px;font-size:12px;font-weight:bold;text-align:left">${titulo}</td>${meses.map((r) => `<td ${tdr}>${val(r) == null ? "" : $(val(r))}</td>`).join("")}</tr>`;
  const resumenHtml = `<table style="border-collapse:collapse;font-family:Arial,sans-serif"><tr><th ${th}></th>${meses.map((r) => `<th ${th}>${MESES_AACC[r.mes]!.toUpperCase()}</th>`).join("")}</tr>${[
    filaRes("TOTAL LIQUIDADO", (r) => r.liquidado),
    filaRes("PROVISIÓN MENSUAL", (r) => r.provMensual),
    filaRes("PROVISIÓN REAL", (r) => r.provReal ?? (r.mes === p.mes ? total : null)),
    filaRes("DIFERENCIA REAL VS MENSUAL", (r) => r.diferencia),
    filaRes("FALTA LIQUIDAR", (r) => (r.mes === p.mes ? total : r.faltaLiquidar)),
  ].join("")}</table>`;
  const detalleHtml = `<table style="border-collapse:collapse;font-family:Arial,sans-serif"><tr>${["CLIENTE", "CATEGORÍAS", "ACUERDO", "MES", "FACTURACIÓN", "AACC"].map((h) => `<th ${th}>${h}</th>`).join("")}</tr>${p.filas
    .map((f) => `<tr><td ${td}>${esc(f.razon_social)}</td><td ${td} style="padding:5px 10px;border:1px solid #bfbfbf;font-size:12px;text-align:center">${esc(f.categorias)}</td><td ${tdr}>${esc(f.acuerdo)}</td><td ${td} style="padding:5px 10px;border:1px solid #bfbfbf;font-size:12px;text-align:center">${nombreMes.toUpperCase()}</td><td ${tdr}>${$(f.facturacion)}</td><td ${tdr}>${$(f.aacc)}</td></tr>`)
    .join("")}<tr><td colspan="4"></td><td ${th}>TOTAL</td><td ${tdr}><b>${$(total)}</b></td></tr></table>`;
  const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#000">
<p>Hola equipo, ¿cómo andan?</p>
<p>La provisión de ${nombreMes} de AACC es: <b>${$(total)}</b></p>
${rango ? `<p>Falta liquidar de ${rango}: <b>${$(faltaAnt)}</b></p>` : ""}
<p>Total provisión + falta liquidar: <b>${$(total + faltaAnt)}</b></p>
${resumenHtml}
<p style="margin-top:18px"><b><u>Detalle de provisión ${nombreMes}:</u></b></p>
${detalleHtml}
<p style="margin-top:18px">Muchas gracias, abzo.</p>${p.firma ? `\n<p>${esc(p.firma)}</p>` : ""}
</div>`;
  const texto = [
    "Hola equipo, ¿cómo andan?", "",
    `La provisión de ${nombreMes} de AACC es: ${$(total)}`,
    ...(rango ? [`Falta liquidar de ${rango}: ${$(faltaAnt)}`] : []),
    `Total provisión + falta liquidar: ${$(total + faltaAnt)}`, "",
    `Detalle de provisión ${nombreMes}:`,
    ...p.filas.map((f) => `- ${f.razon_social} · ${f.categorias} · ${f.acuerdo}${f.facturacion != null ? ` · facturación ${$(f.facturacion)}` : ""} → ${$(f.aacc)}`),
    `TOTAL ${$(total)}`, "", "Muchas gracias, abzo.",
  ].join("\n");
  return { asunto, html, texto };
}

/** Borrador .eml (X-Unsent: 1): Outlook lo abre como mail nuevo listo para revisar y enviar. */
export function armarEml(p: { para: string[]; cc: string[]; email: Email }): string {
  const enc = (s: string) => `=?UTF-8?B?${b64(s)}?=`;
  const lineas = (s: string) => b64(s).replace(/.{1,76}/g, "$&\r\n");
  return [
    "X-Unsent: 1",
    `To: ${p.para.join(", ")}`,
    ...(p.cc.length ? [`Cc: ${p.cc.join(", ")}`] : []),
    `Subject: ${enc(p.email.asunto)}`,
    "MIME-Version: 1.0",
    'Content-Type: text/html; charset="utf-8"',
    "Content-Transfer-Encoding: base64",
    "",
    lineas(`<html><body>${p.email.html}</body></html>`),
  ].join("\r\n");
}

function b64(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

/** Emails válidos de una lista separada por coma/;/espacios. */
export function parseEmails(s: string): string[] {
  return [...new Set(s.split(/[\s,;]+/).map((x) => x.trim().toLowerCase()).filter((x) => /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(x)))];
}
