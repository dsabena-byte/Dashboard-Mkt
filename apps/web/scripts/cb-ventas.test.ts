// CB Ventas: `cd apps/web && npx tsx scripts/cb-ventas.test.ts`
// 1) lectura de los CSV y armado del cuadro básico (mismo algoritmo que cuadros-basicos/lib/cb-drive.ts),
// 2) cálculo (ventana por tipología, BO acumulado, homólogos, FOB), 3) ingesta, 4) alcance por vendedor/gerencia,
// 5) si está el repo viejo al lado (/home/user/cuadros-basicos o CB_VIEJA=<ruta>): mismos resultados que SUS funciones
//    sobre SUS datos (data/*.json) con varios filtros.
import { existsSync } from "node:fs";
import path from "node:path";
import {
  aplicarAlcance, expandirCatalogo, paresCB, parseCatalogo, parseClasificacion, procesarPayload,
} from "../src/lib/cb-ventas/core";
import { calcularPorcentajes, evolucionMensualCB, filtrarCompras, mapasClasificacion } from "../src/lib/cb-ventas/metrics";
import type { ClasificacionCliente, CuadroBasicoItem, VentaRow, VentasFile } from "../src/lib/cb-ventas/types";

let fallas = 0;
const check = (ok: boolean, msg: string) => { if (!ok) { fallas++; console.error("✗", msg); } };
const eq = (a: unknown, b: unknown, msg: string) => check(JSON.stringify(a) === JSON.stringify(b), `${msg}\n  obtuve ${JSON.stringify(a)}\n  esperaba ${JSON.stringify(b)}`);

// ---------- 1. CSV (datos inventados) ----------
const CLASIF = "﻿ID;CLIENTE;PESO FACTURACION;TIPOLOGIA;VENDEDOR;GERENCIA\r\n" +
  '1;CLIENTE A S A;"10,5%";GRANDES CUENTAS TOP 10;VEND UNO;Cuentas Clave\r\n' +
  "2;CLIENTE B SRL;2%;Small Retailers;VEND DOS;Interior\r\n" +
  "3;CLIENTE C;1%;SMALL RETAILERS;VEND UNO;Interior\r\n" +
  "4;SIN TIPO;1%;OTRA COSA;VEND DOS;Interior\r\n";
const clasif = parseClasificacion(CLASIF);
eq(clasif.map((c) => [c.cliente, c.tipologia, c.vendedor, c.gerente]), [
  ["CLIENTE A S A", "TOP 10", "VEND UNO", "Cuentas Clave"], ["CLIENTE B SRL", "SMALL RETAILERS", "VEND DOS", "Interior"], ["CLIENTE C", "SMALL RETAILERS", "VEND UNO", "Interior"],
], "clasificación: tipologías normalizadas y fila sin tipología válida descartada");
check(Math.abs(clasif[0]!.pesoFacturacion - 0.105) < 1e-9, "peso con coma decimal entre comillas");

const CB = "TIPOLOGIA,CLIENTE,CUADRO BASICO,CATEGORIA,MODELO,HOMOLOGO 1,HOMOLOGO 2,HOMOLOGO 3,\r\n" +
  "GRANDES CUENTAS TOP 10,CLIENTE A S A,INFALTABLE,LAVADO,M1,H1,M1,H1,EXTRA\r\n" +
  "SMALL RETAILERS,,ESTRATEGICO,COCCION,M2,,,,\r\n" +
  "SMALL RETAILERS,,INFALTABLE,HELADERAS,M9,,,,\r\n" +
  "SMALL RETAILERS,,INFALTABLE,REFRIGERACION,,,,,\r\n";
const cat = parseCatalogo(CB);
eq(cat.map((r) => [r.cliente, r.modelo, r.homologos]), [["CLIENTE A S A", "M1", ["H1"]], [null, "M2", []]],
  "catálogo: homólogos sin repetir ni el propio modelo; columna sin nombre ignorada; categoría inválida y modelo vacío fuera");
const cb = expandirCatalogo(cat, clasif);
eq(cb.map((i) => `${i.cliente}|${i.sku}|${i.tipo}`), ["CLIENTE A S A|M1|INFALTABLE", "CLIENTE B SRL|M2|ESTRATEGICO", "CLIENTE C|M2|ESTRATEGICO"],
  "renglón sin cliente se expande a los clientes de la tipología (en el orden de la clasificación)");

// ---------- 2. Cálculo ----------
const v = (cliente: string, sku: string, tipo: "FC" | "BO", mes: number, unidades = 1, canal?: "FOB"): VentaRow =>
  ({ documentoVentas: "d", cliente, sku, tipo, unidades, fecha: `2026-${String(mes).padStart(2, "0")}-01`, mes, vendedor: "x", ...(canal ? { canal } : {}) });
const ventas: VentaRow[] = [
  v("CLIENTE A S A", "H1", "FC", 8, 2, "FOB"), // homólogo, dentro de la ventana de 2 meses cerrados (oct → ago, sep)
  v("CLIENTE B SRL", "M2", "FC", 7),           // Small Retailers: 3 meses cerrados (jul, ago, sep) → cuenta
  v("CLIENTE C", "M2", "FC", 6),               // fuera de la ventana de 3 meses → no cuenta
];
const ctx = { hayFiltroMes: false, mesEnCurso: 10 };
const p = calcularPorcentajes(cb, ventas, ctx);
eq([p.cumplidosCB, p.totalCB, p.pctCB, p.pctInf, p.pctEst], [2, 3, 67, 100, 50], "ventana por tipología + homólogo");
const conBo = calcularPorcentajes(cb, [...ventas, v("CLIENTE C", "M2", "BO", 1)], ctx);
eq(conBo.cumplidosCB, 3, "BO acumulado cuenta aunque sea de un mes viejo");
eq(calcularPorcentajes(cb, filtrarCompras(ventas, { meses: [6] }), { hayFiltroMes: true, mesEnCurso: 10 }).cumplidosCB, 1, "con filtro de mes manda el filtro");
const evo = evolucionMensualCB(cb, ventas, { generatedAt: "2026-10-15T12:00:00Z" });
eq(evo.map((x) => x.cumplidosCB), [0, 0, 0, 0, 0, 1, 2, 2, 1, 0], "evolución: ventana móvil M y M-1");

// ---------- 3. Ingesta ----------
const ing = procesarPayload({
  generatedAt: "2026-10-20T10:00:00Z",
  fc: [
    { documentoVentas: 10, cliente: "Cliente A S.A.", sku: "H1", unidades: "3", fecha: 2026009, vendedor: "x", canal: "FOB" },
    { documentoVentas: 11, cliente: "OTRO", sku: "M1", unidades: 1, fecha: "2026-09-01", vendedor: "x" },
    { documentoVentas: 12, cliente: "CLIENTE C", sku: "M2", unidades: 1, fecha: "basura", vendedor: "x" },
  ],
  bo: [{ documentoVentas: 13, cliente: "cliente b srl", sku: "M2", unidades: 5, fecha: "15/10/2026", vendedor: "x" }],
}, cb);
eq(ing.rows.map((r) => [r.cliente, r.tipo, r.mes, r.fecha, r.canal ?? null]), [
  ["CLIENTE A S A", "FC", 9, "2026-09-01", "FOB"], ["CLIENTE B SRL", "BO", 10, "2026-10-15", null],
], "ingesta: cliente canónico, fechas YYYYNNN y d/m/a, FOB, fuera de CB descartada");
eq([ing.skippedNoCB, ing.errors.length], [1, 1], "ingesta: 1 fuera del CB y 1 fecha inválida");
check(paresCB(cb).includes("CLIENTEASA|H1"), "pares incluyen homólogos con cliente normalizado");

// ---------- 4. Alcance ----------
const datos = { cuadroBasico: cb, clasificacion: clasif, ventas: { generatedAt: "2026-10-20", source: "sharepoint" as const, rows: ventas } };
const soloUno = aplicarAlcance(datos, { vendedor: "VEND UNO", gerencia: null });
eq([...new Set(soloUno.cuadroBasico.map((i) => i.cliente))], ["CLIENTE A S A", "CLIENTE C"], "vendedor ve solo sus clientes");
check(soloUno.ventas.rows.every((r) => r.cliente !== "CLIENTE B SRL"), "las ventas de otros clientes no salen del server");
eq(aplicarAlcance(datos, { vendedor: null, gerencia: "Interior" }).clasificacion.map((c) => c.cliente), ["CLIENTE B SRL", "CLIENTE C"], "gerencia ve su gerencia");
check(aplicarAlcance(datos, { vendedor: null, gerencia: null }) === datos, "sin alcance = todo");

// ---------- 5. Contra la app vieja (si está el repo al lado) ----------
async function contraVieja(dir: string) {
  const old = await import(path.join(dir, "lib/sellin-metrics.ts"));
  const oldCb = (await import(path.join(dir, "data/cuadro-basico.json"))).default as CuadroBasicoItem[];
  const oldCl = (await import(path.join(dir, "data/clasificacion-clientes.json"))).default as ClasificacionCliente[];
  const oldV = (await import(path.join(dir, "data/ventas.json"))).default as VentasFile;
  const { vendedorPorCliente } = mapasClasificacion(oldCl);
  const vendedores = [null, ...new Set(oldCl.map((c) => c.vendedor))].slice(0, 6);
  let casos = 0;
  for (const vendedor of vendedores) {
    for (const meses of [[], [3], [2, 3, 4]]) {
      const opts = { meses, vendedor, vendedorPorCliente };
      const nuevo = filtrarCompras(oldV.rows, opts);
      const viejo = old.filtrarCompras(oldV.rows, opts);
      const c = { hayFiltroMes: meses.length > 0, mesEnCurso: new Date(oldV.generatedAt).getMonth() + 1 };
      const items = oldCb.filter((i) => !vendedor || vendedorPorCliente.get(i.cliente) === vendedor);
      eq(calcularPorcentajes(items, nuevo, c), old.calcularPorcentajes(items, viejo, c), `igual a la app vieja (vendedor ${vendedor}, meses ${meses})`);
      casos++;
    }
    eq(evolucionMensualCB(oldCb, oldV.rows, { generatedAt: oldV.generatedAt, vendedor, vendedorPorCliente }),
      old.evolucionMensualCB(oldCb, oldV.rows, { generatedAt: oldV.generatedAt, vendedor, vendedorPorCliente }), `evolución igual a la app vieja (${vendedor})`);
  }
  console.log(`  contra la app vieja: ${casos} casos de % + ${vendedores.length} evoluciones sobre ${oldCb.length} ítems y ${oldV.rows.length} ventas`);
}

(async () => {
  const dir = process.env.CB_VIEJA ?? "/home/user/cuadros-basicos";
  if (existsSync(path.join(dir, "lib/sellin-metrics.ts"))) await contraVieja(dir);
  else console.log("  (sin el repo viejo al lado: se saltea la comparación directa)");
  if (fallas) { console.error(`${fallas} fallas`); process.exit(1); }
  console.log("cb-ventas OK");
})();
