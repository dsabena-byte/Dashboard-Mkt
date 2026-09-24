// Test de Kantar por planilla (lib/kantar-sheet-core). Correr: cd apps/web && npx tsx scripts/kantar-sheet.test.ts
// Garantías: (1) sin planilla los números NO cambian; (2) la planilla pisa solo sus celdas;
// (3) nov-26 (proyección) y olas desconocidas no se aplican; (4) el consolidado usa las tablas pasadas.
import { KANTAR_COCCION, KANTAR_LAVADO, KANTAR_REFRI, computeDreanConsolidado } from "../src/lib/salud-marca-model";
import { buildKantarOverlay, mergeKantar, type KantarTables } from "../src/lib/kantar-sheet-core";
import { detectMapping } from "../src/lib/research-core";

let fails = 0, passes = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  if (JSON.stringify(got) === JSON.stringify(want)) passes++;
  else { fails++; console.error(`✗ ${name}\n   got:  ${JSON.stringify(got)}\n   want: ${JSON.stringify(want)}`); }
};

const BASE: KantarTables = { lav: KANTAR_LAVADO, ref: KANTAR_REFRI, coc: KANTAR_COCCION };
const EMPTY: KantarTables = { lav: {}, ref: {}, coc: {} };

// (1) merge con overlay vacío = constantes, y el consolidado no cambia
eq("merge vacío = constantes", mergeKantar(BASE, EMPTY), BASE);
const series = { lav: new Map(), ref: new Map(), coc: new Map() };
eq("consolidado con tablas = default", computeDreanConsolidado(series, true, mergeKantar(BASE, EMPTY)), computeDreanConsolidado(series));

// (2) planilla: pisa TOM Drean Lavado nov-25 y Poder Samsung Refri nov-24; nov-26 y jun-26 no se aplican
const columns = ["Ola", "Marca", "Categoría", "Top of mind", "Poder de marca"];
const rows: unknown[][] = [
  ["nov-25", "DREAN", "Lavado", 41.5, null],
  ["2024-11", "Samsung", "Heladeras", null, 5.1],
  ["nov-26", "Drean", "Lavado", 50, null],
  ["jun-26", "Drean", "Lavado", 49, null],
  ["nov-25", "Marca Nueva", "Cocina", 3, 2],
];
const mapping = detectMapping("salud", columns);
eq("mapping auto", [mapping.ola, mapping.marca, mapping.categoria, mapping.tom, mapping.poder], [0, 1, 2, 3, 4]);
const { overlay, report } = buildKantarOverlay(columns, rows, { datasetId: "x", mapping, catMap: {} }, BASE);
eq("celdas aplicadas", report.celdas, 4);
eq("olas aplicadas", report.olasAplicadas, ["nov-24", "nov-25"]);
eq("olas ignoradas", report.olasIgnoradas.sort(), ["jun-26", "nov-26"]);
eq("marca nueva informada", report.marcasNuevas, ["Marca Nueva (Cocción)"]);
const merged = mergeKantar(BASE, overlay);
eq("TOM Drean lav nov-25 pisado", merged.lav.Drean!["nov-25"]!.tom, 41.5);
eq("SOM Drean lav nov-25 intacto", merged.lav.Drean!["nov-25"]!.som, KANTAR_LAVADO.Drean!["nov-25"]!.som);
eq("Poder Samsung refri nov-24 pisado", merged.ref.Samsung!["nov-24"]!.poder, 5.1);
eq("Int Samsung refri nov-24 intacto", merged.ref.Samsung!["nov-24"]!.int, KANTAR_REFRI.Samsung!["nov-24"]!.int);
eq("nov-26 no se agrega", merged.lav.Drean!["nov-26"], undefined);
eq("constantes no mutadas", KANTAR_LAVADO.Drean!["nov-25"]!.tom, 40.1);
eq("otras olas intactas", merged.lav.Drean!["nov-24"], KANTAR_LAVADO.Drean!["nov-24"]);

// (4) el consolidado toma el valor de la planilla
const c = computeDreanConsolidado(series, true, merged).find((r) => r.w === "nov-25")!;
eq("consolidado usa TOM de la planilla", c.lav.tom.v, 41.5);

console.log(`\n${passes} OK · ${fails} fallas`);
if (fails) process.exit(1);
