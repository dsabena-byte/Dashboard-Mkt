// Presupuesto cargado desde el tablero (migración 0125). Puro. Correr: cd apps/web && npx tsx scripts/presupuesto.test.ts
import {
  agregarParaTablero, armarCatalogo, etapaDe, normalizarCuentas, camposCambiados, claveDuplicado, parseFecha, parseMes, parseMonto, parsePlanilla,
  parsePresupuesto, parseTcPlantilla, plantillaPresupuesto, tipoDeVersion, totalesPorVersion, validarLinea, type LineaIn, type Version,
} from "../src/lib/presupuesto-core";

let fails = 0, passes = 0;
function ok(name: string, cond: boolean, extra?: unknown) {
  if (cond) passes++; else { fails++; console.error(`✗ ${name}${extra !== undefined ? `\n   ${JSON.stringify(extra)}` : ""}`); }
}
function eq(name: string, got: unknown, want: unknown) { ok(name, JSON.stringify(got) === JSON.stringify(want), { got, want }); }

// ── versiones ──
eq("BGT 2026", tipoDeVersion("BGT 2026"), { tipo: "BGT", anio: 2026 });
eq("4+8 con espacios", tipoDeVersion(" 4+8  2025 "), { tipo: "4+8", anio: 2025 });
eq("crisis = OTRO", tipoDeVersion("BGT 2024 CRISIS"), { tipo: "OTRO", anio: 2024 });
eq("sin año", tipoDeVersion("BGT"), null);

// ── meses, montos, fechas ──
eq("mes nombre", parseMes("Septiembre"), 9);
eq("mes setiembre", parseMes("SETIEMBRE"), 9);
eq("mes número", parseMes(3), 3);
eq("mes texto número", parseMes("12"), 12);
eq("mes inválido", parseMes("13"), null);
eq("monto es-AR", parseMonto("$ 1.810.000"), 1810000);
eq("monto con decimales", parseMonto("23.217.600,00"), 23217600);
eq("monto número", parseMonto(5693152), 5693152);
eq("monto negativo", parseMonto("-5.000"), -5000);
eq("monto entre paréntesis", parseMonto("(1.000)"), -1000);
eq("monto vacío", parseMonto("  "), null);
eq("monto texto", parseMonto("abc"), null);
eq("fecha dd/mm/aaaa", parseFecha("14/10/2026"), "2026-10-14");
eq("fecha serial Excel", parseFecha(46309), "2026-10-14");
eq("fecha ISO", parseFecha("2026-10-14"), "2026-10-14");
eq("fecha inexistente", parseFecha("31/02/2026"), null);
eq("nro doc no es fecha", parseFecha(5100010974), null);

// ── planilla con títulos (forma real de "Planilla carga BGT - Facturas") ──
const head = ["", "PRESUPUESTO", "CECO", "CUENTA", "NOMBRE CTA", "AÑO", "MES", "CONCEPTO", "NRO PROVEEDOR", "PROVEEDOR", "DETALLE", "SOLPED", "OC", "NRO RECEPCIÓN", "FECHA CONTABILIZ", "FACTURA", "$", "USD", "PROVISIÓN"];
const aoa: unknown[][] = [
  head,
  ["k", "REAL 2026", "W014402001 ", 6202010072, "PUBLICIDAD EXHIBICIONES", 2026, "FEBRERO", "ACTIVACIONES WOW", 6006980, "RETAIL EXPRESS SA", "Adicionales", 4014693004, 9501302505, 5003647341, null, "00001-00000725", 1810000, 1286, null],
  ["k", "REAL 2026", "W014402001", 6202010034, "PUBLICIDAD.PRODUCCION Y AGENCIAS", 2026, "ENERO", "REGISTRO MARCAS", 4010322, "EGUIA JAVIER ANDRES", "Proforma 1067", null, null, null, 5100010974, "0002-00016443", 342200, 237, "NO"],
  ["k", "REAL 2025", "W014402001", 6202010034, "PUBLICIDAD.PRODUCCION Y AGENCIAS", 2025, "MAYO", "AGENCIAS VARIAS", null, null, "Fee", null, null, null, "se anulo linea con NC", null, -5000, null, null],
  ["k", "REAL 2024", "W014402001", 6202010072, "PUBLICIDAD EXHIBICIONES", 2024, "SEPTIEMBRE", "ACTIVACIONES WOW", null, " ", null, null, null, null, new Date(Date.UTC(2024, 9, 24)), null, 1000, null, null],
  ["k", "BGT 2026", "W014402001", 6202010069, "PUBLICIDAD TV", 2026, "MARZO", "PAUTA ATL", null, null, null, null, null, null, null, null, null, null, null], // sin monto → omitida
  [null, null, null, null, null, null, null, null, null, null, "LOGISTICA - Envio Integrados", null, null, null, null, null, 503128, "=…", null], // sin presupuesto → error
  ["k", "BGT 2026", "", "", "", 2025, "MARZO", "PAUTA ATL", null, null, null, null, null, null, null, null, 10, null, null], // año ≠ versión → error
];
const r = parsePlanilla(aoa);
eq("renglones leídos", r.lineas.length, 4);
eq("omitidas", r.omitidas, 1);
eq("errores", r.errores.map((e) => e.fila), [7, 8]);
const l0 = r.lineas[0]!;
eq("campos del gasto", [l0.version, l0.mes, l0.ceco, l0.cuenta, l0.nombre_cta, l0.nro_proveedor, l0.solped, l0.oc, l0.nro_recepcion, l0.factura, l0.ars], ["REAL 2026", 2, "W014402001", "6202010072", "PUBLICIDAD EXHIBICIONES", "6006980", "4014693004", "9501302505", "5003647341", "00001-00000725", 1810000]);
eq("USD de la planilla se ignora (no hay campo usd)", "usd" in l0, false);
eq("nro de documento va aparte", [r.lineas[1]!.nro_doc_contable, r.lineas[1]!.fecha_contabilizacion, r.lineas[1]!.provision], ["5100010974", null, "NO"]);
eq("nota de la columna fecha → detalle", [r.lineas[2]!.detalle, r.lineas[2]!.nro_doc_contable, r.lineas[2]!.ars], ["Fee · Nota: se anulo linea con NC", null, -5000]);
eq("fecha real de contabilización", r.lineas[3]!.fecha_contabilizacion, "2024-10-24");
eq("proveedor en blanco = null", r.lineas[3]!.proveedor, null);
eq("totales por versión", totalesPorVersion(r.lineas), { "REAL 2026": 2152200, "REAL 2025": -5000, "REAL 2024": 1000 });

// ── pegado sin títulos (orden de la planilla, con y sin la columna clave) ──
const fila = ["REAL 2026", "W014402001", "6202010069", "PUBLICIDAD TV", "2026", "ABRIL", "PAUTA ATL", "4012426", "OMD", "OMD - MEDIOS ABRIL", "4014855632", "9501321430", "5003746920", "", "0011-00003289", "$ 23.217.600,00", "16.685", ""];
eq("pegado sin títulos", parsePlanilla([fila]).lineas.map((l) => [l.version, l.mes, l.proveedor, l.ars]), [["REAL 2026", 4, "OMD", 23217600]]);
eq("pegado con columna clave", parsePlanilla([["clave", ...fila]]).lineas.map((l) => [l.mes, l.ars]), [[4, 23217600]]);
eq("versión por defecto si PRESUPUESTO vacío", parsePlanilla([head.slice(1), ["", "W", "6202010069", "PUBLICIDAD TV", "", "ABRIL", "PAUTA ATL", "", "", "", "", "", "", "", "", "100"]], { versionPorDefecto: "REAL 2026" }).lineas[0]?.version, "REAL 2026");

// ── plantilla de tipos de cambio ──
const tc = parseTcPlantilla([["MES", "BGT 2026", "REAL 2026", "4+8 2026"], ["ENERO", 1444.5, "1.450,25", ""], ["FEBRERO", 1408, null, "abc"], ["", null]]);
eq("tcs leídos", tc.tcs, [{ version: "BGT 2026", mes: 1, tc: 1444.5 }, { version: "REAL 2026", mes: 1, tc: 1450.25 }, { version: "BGT 2026", mes: 2, tc: 1408 }]);
eq("tc inválido reportado", tc.errores.length, 1);
ok("sin fila MES", parseTcPlantilla([["x"]]).errores.length === 1);

// ── validación, duplicados, cambios ──
const versiones: Version[] = [{ nombre: "REAL 2026", tipo: "REAL", anio: 2026, cerrada: false }, { nombre: "BGT 2025", tipo: "BGT", anio: 2025, cerrada: true }];
const base: Partial<LineaIn> = { version: "REAL 2026", mes: 3, cuenta: "6202010069", nombre_cta: "PUBLICIDAD TV", concepto: "PAUTA ATL", ars: 100 };
eq("renglón válido", validarLinea(base, versiones), null);
ok("versión cerrada", /cerrada/.test(validarLinea({ ...base, version: "BGT 2025" }, versiones) ?? ""));
ok("sin monto", validarLinea({ ...base, ars: 0 }, versiones) != null);
ok("sin concepto", validarLinea({ ...base, concepto: "" }, versiones) != null);
ok("versión inexistente", validarLinea({ ...base, version: "REAL 2030" }, versiones) != null);
const d1 = claveDuplicado({ version: "REAL 2026", factura: "0001-00000725 ", nro_proveedor: "6006980", proveedor: null, ars: 1810000 });
eq("duplicado normaliza factura", d1, claveDuplicado({ version: "REAL 2026", factura: "0001-00000725", nro_proveedor: "6006980", proveedor: "x", ars: 1810000 }));
eq("sin factura no hay chequeo", claveDuplicado({ version: "REAL 2026", factura: null, nro_proveedor: "1", proveedor: null, ars: 1 }), null);
eq("camposCambiados", camposCambiados({ ars: 100, detalle: "a", oc: null }, { ars: 120, detalle: "a", oc: null }), { ars: { antes: 100, despues: 120 } });

// ── agregado para el tablero: USD = $ ÷ TC del mes de la versión ──
const ag = agregarParaTablero(
  [
    { version: "REAL 2026", mes: 1, nombre_cta: "PUBLICIDAD TV", concepto: "PAUTA ATL", ars: 1000 },
    { version: "REAL 2026", mes: 1, nombre_cta: "PUBLICIDAD TV", concepto: "PAUTA ATL", ars: 500 },
    { version: "REAL 2026", mes: 2, nombre_cta: "PUBLICIDAD TV", concepto: "PAUTA ATL", ars: 300 },
  ],
  [{ nombre: "REAL 2026", anio: 2026 }],
  [{ version: "REAL 2026", mes: 1, tc: 1500 }],
);
eq("suma por mes y USD con TC", ag.rows.map((x) => [x.mes, x.ars, x.usd, x.anio]), [["ENERO", 1500, 1, "2026"], ["FEBRERO", 300, 0, "2026"]]);
eq("meses sin TC", ag.faltaTc, [{ version: "REAL 2026", mes: 2 }]);

// ── catálogo ──
const menu: unknown[][] = [[], [null, "AÑO", "MONEDA", "MES", "MES AÑO", "TC USD", "PRESUPUESTO", "CECO", "CECO", "CONCEPTO", "CUENTA", "NOMBRE CTA", "PROVEEDOR", "NRO PROVEEDOR", "PROVISIÓN"],
  [null, 2023, "USD", "ENERO", "2024 ENERO", 818, "8+4 2023", "W014402001 ", "DREAN MKT", "PRODUCCIÓN CONTENIDOS", 6202010034, "PUBLICIDAD.PRODUCCION Y AGENCIAS", "BONVA SA", 4009883, "SI"]];
const cat = armarCatalogo(menu, r.lineas);
eq("cuenta del menú", cat.find((c) => c.tipo === "cuenta" && c.clave === "6202010034")?.nombre, "PUBLICIDAD.PRODUCCION Y AGENCIAS");
eq("proveedor del menú", cat.find((c) => c.tipo === "proveedor" && c.clave === "4009883")?.nombre, "BONVA SA");
eq("ceco con nombre", cat.find((c) => c.tipo === "ceco" && c.clave === "W014402001")?.nombre, "DREAN MKT");
eq("proveedor de los renglones", cat.find((c) => c.tipo === "proveedor" && c.clave === "6006980")?.nombre, "RETAIL EXPRESS SA");

eq("nombre de cuenta unificado por código", normalizarCuentas([{ cuenta: "6202010034", nombre_cta: "PUBLICIDAD. PRODUCCION Y AGENCIA" }], cat)[0]!.nombre_cta, "PUBLICIDAD.PRODUCCION Y AGENCIAS");
eq("código por nombre", normalizarCuentas([{ cuenta: "", nombre_cta: "publicidad exhibiciones" }], cat)[0]!.cuenta, "6202010072");

// ── circuito del gasto ──
const e0 = { solped: null, oc: null, nro_recepcion: null, factura: null, fecha_contabilizacion: null, nro_doc_contable: null };
eq("sin datos", etapaDe(e0), "sin_datos");
eq("solo solped", etapaDe({ ...e0, solped: "4014693004" }), "solped");
eq("con OC", etapaDe({ ...e0, solped: "1", oc: "9501302505" }), "oc");
eq("facturado", etapaDe({ ...e0, oc: "1", factura: "0001-1" }), "factura");
eq("recepción cuenta como facturado", etapaDe({ ...e0, oc: "1", nro_recepcion: "5003647341" }), "factura");
eq("contabilizado", etapaDe({ ...e0, factura: "x", fecha_contabilizacion: "2026-10-14" }), "contabilizado");

// ── conceptos por cuenta ──
const vl: Version[] = [{ nombre: "REAL 2026", tipo: "REAL", anio: 2026, cerrada: false }];
eq("concepto válido para la cuenta", validarLinea({ version: "REAL 2026", mes: 1, cuenta: "6202010069", concepto: "PAUTA ATL", ars: 1 }, vl), null);
ok("concepto de otra cuenta", /no corresponde/.test(validarLinea({ version: "REAL 2026", mes: 1, cuenta: "6202010069", concepto: "AGENCIAS VARIAS", ars: 1 }, vl) ?? ""));
ok("cuenta 6202010033 no habilitada", /no está habilitada/.test(validarLinea({ version: "REAL 2026", mes: 1, cuenta: "6202010033", concepto: "PAUTA DIGITAL", ars: 1 }, vl) ?? ""));

// ── presupuesto entero por planilla ──
const pl = plantillaPresupuesto();
eq("plantilla: títulos", pl[0]!.slice(0, 4), ["CECO", "CUENTA", "CONCEPTO", "ENERO"]);
eq("plantilla: una fila por cuenta × concepto", pl.length - 1, 14);
const rellena = pl.map((r, i) => (i === 0 ? r : r.map((c, j) => (j === 3 && String(r[2]) === "PAUTA ATL" ? "1.000.000" : j === 14 && String(r[2]) === "PAUTA ATL" ? 500 : c))));
const pp = parsePresupuesto([["Presupuesto 2027"], ...rellena, ["", "TOTAL", "", 1000500]], "BGT 2027");
eq("plantilla completada → renglones", pp.lineas.map((l) => [l.version, l.mes, l.cuenta, l.concepto, l.ars]), [["BGT 2027", 1, "6202010069", "PAUTA ATL", 1000000], ["BGT 2027", 12, "6202010069", "PAUTA ATL", 500]]);
eq("plantilla completada sin errores", pp.errores, []);
const pe = parsePresupuesto([["CECO", "CUENTA", "CONCEPTO", ...["ENE", "FEB", "MAR", "ABR", "MAY", "JUN"]], ["", "PUBLICIDAD TV", "pauta atl", 10], ["", "6202010069", "AGENCIAS VARIAS", 5], ["", "6202010033", "X", 5], ["", "6202010069", "PAUTA ATL", "abc"]], "4+8 2026");
eq("cuenta por nombre y concepto sin mayúsculas", pe.lineas.map((l) => [l.cuenta, l.concepto, l.ceco]), [["6202010069", "PAUTA ATL", "W014402001"]]);
eq("errores: concepto ajeno, cuenta no habilitada, monto inválido", pe.errores.map((e) => e.fila), [3, 4, 5]);
const ida = plantillaPresupuesto(pp.lineas);
eq("plantilla con lo cargado vuelve igual", parsePresupuesto(ida, "BGT 2027").lineas.map((l) => [l.mes, l.ars]), [[1, 1000000], [12, 500]]);
const larga = parsePresupuesto([["PRESUPUESTO", "CECO", "CUENTA", "MES", "CONCEPTO", "$"], ["BGT 2027", "W014402001", "6202010069", "Enero", "PAUTA ATL", 7], ["REAL 2026", "W014402001", "6202010069", "Enero", "PAUTA ATL", 9]], "BGT 2027");
eq("formato Seguimiento: solo la versión elegida", [larga.lineas.map((l) => l.ars), larga.otrasVersiones], [[7], 1]);

console.log(`presupuesto: ${passes} OK, ${fails} fallas`);
if (fails) process.exit(1);
