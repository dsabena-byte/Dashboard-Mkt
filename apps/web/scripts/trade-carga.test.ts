// Test de "Cargar datos" de Trade (parseo, detección por contenido, validación, qué falta) y de
// las Sugerencias. Fixtures SINTÉTICAS (sin datos reales). Correr: cd apps/web && npx tsx scripts/trade-carga.test.ts
import assert from "node:assert/strict";
import {
  decodificar, parseCsv, detectarTipo, infoDesdeNombre, parseCb, parseFs, parseU3, parseTiendas, validarFila, faltantes,
  resumir, normClave, splitTienda, esMarcaBasura, parseExh,
} from "../src/lib/trade-carga-core";
import { calcularSugerenciasSku, claveSku, equivalencias, familiaCocina, segmento, tipoProducto } from "../src/lib/cb-sugerencias-sku";
import { calcularSugerencias } from "../src/lib/trade-sugerencias-core";

let n = 0;
const ok = (c: unknown, m: string) => { assert.ok(c, m); n++; };
const eq = <T,>(a: T, b: T, m: string) => { assert.deepEqual(a, b, m); n++; };

// ── CB semanal (formato del relevamiento: ";" Windows-1252, subtotales "Total") ──
const CB = [
  "DIVISION;CATEGORIA;SKU MABE;CLIENTE/CADENA;TIENDA HMPDV;targetCB;realCB;%cumpCB;targetInf;realInf;%cumpInf",
  "COCCIÓN;Total;;;;3;2;67%;2;1;50%",
  "COCCIÓN;COCINAS;SKU1;CADENA UNO;1 - Cadena Uno Centro;1;1;100%;1;1;100%",
  "COCCIÓN;COCINAS;SKU2;CADENA UNO;1 - Cadena Uno Centro;1;0;0%;0;0;",
  "LAVADO Y SECADO;LAVADORAS;SKU3;CADENA DOS;7 - Cadena Dos Norte;1;2;200%;1;0;0%",
  "LAVADO Y SECADO;LAVADORAS;Total;;;1;1;;1;0;",
  "LAVADO Y SECADO;LAVADORAS;SKU9;CADENA DOS;Total;1;1;;1;0;",
].join("\r\n");
// Windows-1252: "Ó" = 0xD3 → con UTF-8 sale el carácter de reemplazo → decodificar cae a 1252.
const bytes = Uint8Array.from([...CB].map((ch) => (ch === "Ó" ? 0xd3 : ch.charCodeAt(0))));
const txtCb = decodificar(bytes);
ok(txtCb.includes("COCCIÓN"), "decodifica Windows-1252");
const gCb = parseCsv(txtCb);
eq(detectarTipo(gCb).tipo, "cb", "detecta CB por contenido");
const cb = parseCb(gCb);
eq(cb.filas.length, 3, "CB: descarta subtotales (Total en categoría/SKU/tienda)");
eq(cb.filas.map((f) => f.tipo_sku), ["Infaltable", "Estratégico", "Infaltable"], "CB: tipo_sku = Infaltable si targetCB == targetInf");
eq(cb.filas[2]!.real_cb, 1, "CB: real recortado al target");
ok(cb.avisos.length === 1, "CB: avisa los recortes");
eq(cb.filas[0]!.numero_tienda, "1", "CB: número de tienda");
eq(cb.filas[0]!.categoria, "COCINAS", "CB: guarda la categoría");
for (const f of cb.filas) eq(validarFila("cb", f), null, "CB: fila válida para el server");

// ── Floor Share formato NUEVO (";", marca repetida, fila de pares, pie "Applied filters") ──
const FS_NUEVO = [
  "Subcategoría Participación Anaquel;Drean;Drean;Marca B;Marca B;Total;Total",
  "Tienda;Participación Anaquel;%Part;Participación Anaquel;%Part;Participación Anaquel;%Part",
  "1 - Cadena Uno Centro;3;0,6;2;0,4;5;1",
  "7 - Cadena Dos Norte;0;0;4;1;4;1",
  "Total;3;0,33;6;0,67;9;1",
  '"Applied filters:\nCategoría is Lavado";;;;;;',
].join("\n");
const gFs = parseCsv(FS_NUEVO);
eq(detectarTipo(gFs).tipo, "fs", "detecta FS nuevo");
const fs = parseFs(gFs);
eq(fs.filas.length, 3, "FS: sin unidades 0, sin Total ni pie");
eq(fs.filas[0], { numero_tienda: "1", nombre_tienda: "Cadena Uno Centro", marca: "Drean", unidades: 3, pct_raw: 0.6 }, "FS: fila");
for (const f of fs.filas) eq(validarFila("fs", f), null, "FS: fila válida");

// ── Floor Share formato VIEJO ("," UTF-8, columna Formato, marca solo en la col par) ──
const FS_VIEJO = [
  ",,Drean,,Marca B,",
  "Formato,Tienda,Participación Anaquel,%Part,Participación Anaquel,%Part",
  'RAZON SOCIAL SA,"12 - Tienda Doce",2,"0,5",2,"0,5"',
].join("\n");
const fv = parseFs(parseCsv(FS_VIEJO));
eq(detectarTipo(parseCsv(FS_VIEJO)).tipo, "fs", "detecta FS viejo");
eq(fv.filas.map((f) => `${f.numero_tienda}|${f.marca}|${f.unidades}`), ["12|Drean|2", "12|Marca B|2"], "FS viejo: columna Tienda después de Formato");

// ── Un CB subido como Floor Share (caso 42-Coccion) → se rechaza ──
const comoFs = parseFs(gCb);
ok(comoFs.errores.length > 0 && /no es un Floor Share/.test(comoFs.errores[0]!), "CB como FS: error claro");
ok(esMarcaBasura("targetCB") && esMarcaBasura("%cumpInf") && !esMarcaBasura("Drean"), "marcas basura");
eq(validarFila("fs", { numero_tienda: "1", nombre_tienda: "x", marca: "realCB", unidades: 3, pct_raw: null }) !== null, true, "server rechaza marca basura");

// ── Nombres de archivo ──
eq(infoDesdeNombre("42.csv"), { semana: 42, categoria: null, anio: null, mes: null }, "nombre CB");
eq(infoDesdeNombre("33- Coccion.csv").categoria, "coccion", "nombre FS con espacio");
eq(infoDesdeNombre("21-LAVADO.csv"), { semana: 21, categoria: "lavado", anio: null, mes: null }, "nombre FS mayúsculas");
eq(infoDesdeNombre("2026-03_REFRIGERACION.csv"), { semana: null, categoria: "refrigeracion", anio: 2026, mes: 3 }, "nombre FS mensual");

// ── U3 ──
const U3 = [
  "ID;TIPO DE ESPACIO;CANAL;CADENA;FORMATO;NO. DE TIENDA;TIENDA;SUPERVISOR;PROMOTOR;DIVISIÓN;CATEGORÍA;MARCA;SKU;CÓDIGO DE BARRAS;DESCRIPCIÓN DE PRODUCTO;EXISTENCIA EN EXHIBICIÓN;ESTADO;FECHA DE CAPTURA",
  "10;Piso;Tradicional;Cadena Tres;RAZON TRES SA;30;Tienda Treinta;Sup A;Prom B;COCCIÓN;COCINAS;DREAN;SKU1;779000000001;Cocina x;2;Córdoba;5/10/2026",
  "10;Piso;Tradicional;Cadena Tres;RAZON TRES SA;30;Tienda Treinta;Sup A;Prom B;COCCIÓN;COCINAS;DREAN;SKU1;779000000001;Cocina x;3;Córdoba;5/10/2026",
  "11;Piso;Tradicional;Cadena Tres;RAZON TRES SA;30;Tienda Treinta;Sup A;Prom B;LAVADO;LAVARROPAS;DREAN;SKUH;779000000002;Lava y;0;Córdoba;6/10/26",
].join("\n");
const gU3 = parseCsv(U3);
eq(detectarTipo(gU3).tipo, "u3", "detecta U3");
const u3 = parseU3(gU3);
eq(u3.filas.length, 2, "U3: dedup por ID (queda la última)");
eq([u3.filas[0]!.existencia, u3.filas[0]!.ean, u3.filas[0]!.promotor, u3.filas[0]!.formato, u3.filas[0]!.fecha_captura],
  [3, "779000000001", "Prom B", "RAZON TRES SA", "2026-10-05"], "U3: guarda EAN, promotor, razón social y fecha ISO");
eq(u3.filas[1]!.fecha_captura, "2026-10-06", "U3: año de 2 dígitos");
for (const f of u3.filas) eq(validarFila("u3", f), null, "U3: fila válida");

// ── Tienda-promotor-supervisor ──
const TI = ["Cadena,Nombre PDV,Nombre de la tienda,Segmetación,Provincia,Localidad,Promotor,Supervisor",
  "Cadena Uno,Cadena Uno Centro,1 - Cadena Uno Centro,Grandes cuentas,Buenos Aires,CABA,Prom A,Sup A",
  "Cadena Uno,Cadena Uno Centro,1 - Cadena Uno Centro,Grandes cuentas,Buenos Aires,CABA,Prom A,Sup A"].join("\n");
const gTi = parseCsv(TI);
eq(detectarTipo(gTi).tipo, "tiendas", "detecta Tiendas");
const ti = parseTiendas(gTi);
eq(ti.filas.length, 1, "Tiendas: dedup cadena+número");
eq([ti.filas[0]!.numero, ti.filas[0]!.nombre, ti.filas[0]!.segmentacion], ["1", "Cadena Uno Centro", "Grandes cuentas"], "Tiendas: campos");
eq(validarFila("tiendas", ti.filas[0]), null, "Tiendas: válida");
eq(detectarTipo([["a", "b"], ["1", "2"]]).tipo, null, "archivo desconocido");

// ── Normalización / validación ──
eq(normClave("  Chango  Más "), normClave("CHANGO MAS"), "clave de cadena sin acentos ni mayúsculas");
eq(splitTienda("Total"), null, "Total no es tienda");
ok(validarFila("cb", { ...cb.filas[0]!, real_cb: 2 }) !== null, "server rechaza real > target");
ok(validarFila("cb", { ...cb.filas[0]!, tipo_sku: "x" }) !== null, "server rechaza tipo_sku inválido");
ok(validarFila("u3", { id: "x" }) !== null, "server rechaza ID inválido");

// ── Vista previa contra maestros ──
const r = resumir("cb", cb.filas, { cadenas: { "CADENA UNO": "CADENA UNO" }, tiendas: ["CADENA UNO|1"], numeros: ["1"], skus: ["SKU1"] });
eq([r.filas, r.tiendas, r.skus, r.cadenas], [3, 2, 3, 2], "resumen CB");
eq(r.nuevasCadenas, ["CADENA DOS"], "cadena desconocida");
eq(r.nuevasTiendas, ["7 - Cadena Dos Norte"], "tienda desconocida");
eq(r.nuevosSkus, ["SKU2", "SKU3"], "SKUs desconocidos");

// ── Qué falta cargar ──
const f = faltantes([
  { anio: 2026, semana: 36, tipo: "cb", categoria: null, filas: 10 },
  ...["lavado", "refrigeracion", "coccion"].map((c) => ({ anio: 2026, semana: 36, tipo: "fs" as const, categoria: c, filas: 5 })),
  ...["lavado", "refrigeracion", "coccion"].map((c) => ({ anio: 2026, semana: 37, tipo: "fs" as const, categoria: c, filas: 5 })),
  { anio: 2026, semana: 38, tipo: "cb", categoria: null, filas: 10 },
  { anio: 2026, semana: 38, tipo: "fs", categoria: "lavado", filas: 5 },
]);
eq(f, [
  { anio: 2026, semana: 38, falta: ["Floor Share Refrigeración", "Floor Share Cocción"] },
  { anio: 2026, semana: 37, falta: ["Cuadro Básico"] },
], "qué falta: CB 37 y FS de la 38");

// ── Sugerencias (port de las vistas del proyecto CB) ──
const sug = calcularSugerencias(
  [{ semana: 41, tienda: "1 - A", target_cb: 2, real_cb: 1, target_inf: 1, real_inf: 1 }],
  [
    { numero_tienda: "30", tienda: "Tienda Treinta", cadena: "Cadena Tres", sku: "SKUH", existencia: 2 },
    { numero_tienda: "1", tienda: "A", cadena: "C1", sku: "M1", existencia: 1 },
  ],
  [
    { cliente: "RAZON TRES SA", categoria: "LAVADO", cuadro_basico: "INFALTABLE", modelo: "M1", sku: "M1" },
    { cliente: "RAZON TRES SA", categoria: "LAVADO", cuadro_basico: "INFALTABLE", modelo: "M1", sku: "SKUH" },
    { cliente: "RAZON TRES SA", categoria: "COCCION", cuadro_basico: "ESTRATEGICO", modelo: "M2", sku: "M2" },
  ],
  new Map([[normClave("Cadena Tres"), "Razon Tres SA"]]),
);
eq(sug.baseline.cb_pct_avg, 50, "sugerencias: baseline últimas 3 semanas");
eq(sug.suggestions.map((s) => [s.numero_tienda, s.cb_target, s.cb_ok, s.cb_pct, s.infalt_pct, s.estrat_pct]), [["30", 2, 1, 50, 100, 0]],
  "sugerencias: solo tiendas NO medidas; presente por homólogo");
eq(sug.details.find((d) => d.modelo === "M1")?.found_sku, "SKUH", "sugerencias: SKU encontrado = homólogo");

// ── Exhibición de SKUs por tienda (ReportExhibitions) + Sugerencias de SKUs ──
const gExh = [
  ["ID", "CÓDIGO EXHIBICIÓN", "TIPO DE ESPACIO", "ESTATUS DE COLOCACIÓN PDV", "CADENA", "FORMATO", "NO. DE TIENDA", "TIENDA", "DIVISIÓN", "CATEGORÍA", "SUBCATEGORÍA", "MARCA", "SKU", "DESCRIPCIÓN DE PRODUCTO", "EXISTENCIA EN EXHIBICIÓN", "FECHA DE CAPTURA"],
  ["1", "EXN-1", "Exhibición normal sin mueble", "Se mantiene", "Cadena Uno", "Cadena Uno SA", "1", "1 - Cadena Uno Centro", "COCCIÓN", "ESTUFAS", "56 cm - Piso - Gas - Gris", "Drean", "SKUA", "Cocina A", "1", "9/10/2026"],
];
eq(detectarTipo(gExh).tipo, "exh", "detecta exhibición antes que U3 (también tiene ID/NO. DE TIENDA/SKU/EXISTENCIA)");
eq(infoDesdeNombre("Exhibicion_Semana_Fiscal_43_Dani.xlsx").semana, 43, "semana fiscal desde el nombre");
const pe = parseExh(gExh);
eq([pe.filas.length, pe.filas[0]!.numero_tienda, pe.filas[0]!.fecha_captura, pe.filas[0]!.estatus_pdv], [1, "1", "2026-10-09", "Se mantiene"], "parseExh");
eq(validarFila("exh", pe.filas[0]), null, "fila de exhibición válida");
eq(segmento("56 cm - Piso - Gas - Gris"), "56 cm - Piso - Gas", "segmento sin color");
eq(tipoProducto("Automática Carga Frontal - 10.5 Kg - Europeo"), "Automática Carga Frontal - Europeo", "tipo sin capacidad");
eq(tipoProducto("277 - 2 puertas - Cíclico"), "2 puertas - Cíclico", "tipo heladera sin litros");
const ex = (semana: number, tienda: string, sku: string, sub = "56 cm - Piso - Gas -", est = "Se mantiene") =>
  ({ semana, tienda, sku, division: "COCCIÓN", categoria: "ESTUFAS", subcategoria: sub, descripcion: sku, estatus_pdv: est });
const exhRows = [
  // NUEVO: tiendas 1 y 2 (en la 3 retirado); TOP: en las 3, pero en la 1 solo 1 de 4 semanas (no cuenta)
  ...[40, 41, 42, 43].flatMap((w) => [ex(w, "1 - Uno", "CB1"), ex(w, "1 - Uno", "NUEVO"), ex(w, "2 - Dos", "NUEVO"), ex(w, "3 - Tres", "NUEVO", undefined, "Retirada"), ex(w, "3 - Tres", "CB1"),
    ex(w, "2 - Dos", "TOP"), ex(w, "3 - Tres", "TOP"), ex(w, "4 - Cuatro", "TOP")]),
  ex(40, "1 - Uno", "TOP"),
];
const cbRows = ["1 - UNO", "2 - DOS", "3 - TRES"].map((t, i) => ({ semana: 43, tienda: t, cliente: "C", sku: "CB1", target_cb: 1, real_cb: i === 1 ? 0 : 1 }));
const [g] = calcularSugerenciasSku(exhRows, cbRows, () => "C");
eq([g!.tiendas, g!.target, g!.real, Math.round(g!.pct)], [3, 3, 2, 67], "grupo: % CB actual");
// NUEVO (2/3 tiendas) no sube el 67%; TOP tampoco (2/3: en la 1 solo 1 semana de 4; la tienda 4 no tiene CB) → nada.
eq(g!.sugerencias.map((s) => s.sku), [], "solo se sugiere lo que sube el %: exhibido en más tiendas que el % actual");
const cbRows2 = cbRows.map((r) => ({ ...r, real_cb: r.tienda === "1 - UNO" ? 1 : 0 })); // 33%
const [g2] = calcularSugerenciasSku(exhRows, cbRows2, () => "C");
eq(g2!.sugerencias.map((s) => [s.sku, s.tiendasExh, Math.round(s.pct), Math.round(s.acumPct)]),
  [["NUEVO", 2, 50, 50], ["TOP", 2, 50, 56]], "sumar al CB: % con cada SKU y acumulado (1+2+2)/(3+3+3)");
// Homólogo según CB Ventas: NUEVO equivale a CB1 → no se sugiere (TOP sí).
const eqv = equivalencias([{ modelo: "cb1", homologos: ["00NUEVO", "OTRO"] }]);
const [g3] = calcularSugerenciasSku(exhRows, cbRows2, () => "C", { equivalentes: eqv });
eq([g3!.sugerencias.map((s) => s.sku), g3!.homologosExcluidos], [["TOP"], [{ sku: "NUEVO", de: "CB1" }]], "homólogo del CB (catálogo de Ventas) no se sugiere");
const [g4] = calcularSugerenciasSku(exhRows, cbRows2, () => "C", { descartados: () => new Set(["NUEVO"]) });
eq([g4!.sugerencias.map((s) => s.sku), g4!.descartados, g4!.cb.map((c) => [c.sku, c.cumple, c.total])], [["TOP"], ["NUEVO"], [["CB1", 1, 3]]], "sacado por el usuario: no se sugiere; CB actual por SKU");
eq(claveSku("NEXT 6·09 ECO"), claveSku("next 6.09  eco"), "clave de SKU: · = . y mayúsculas");
eq(familiaCocina("CD5507AI"), "CD5603", "CD5505/5507 = familia 03");
eq(["CD5502AB", "CD5602AN0", "CD5503AI", "CD5617AI0", "CD6009EI", "CD7609EI", "LFDR0914ISG0"].map(familiaCocina),
  ["CD5602", "CD5602", "CD5603", "CD5614", "sola:CD6009EI", "sola:CD7609EI", null], "familias de cocinas (55→56, 02/03/14-17, 60≠76)");
eq(equivalencias([{ modelo: "CD6009EI", homologos: ["CD7609EI"] }]).size, 0, "cocinas: el catálogo de Ventas no manda (60 ≠ 76)");

console.log(`trade-carga: ${n} checks OK`);
