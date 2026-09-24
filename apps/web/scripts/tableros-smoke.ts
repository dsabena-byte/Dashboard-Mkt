// Smoke (solo lectura) de Mis tableros contra la DB real + parseo de Excel.
// Correr: cd apps/web && npx tsx scripts/tableros-smoke.ts   (stubea "server-only", que Next trae interno)
// Con la migración 0109 SIN correr, listDashboards debe tirar TablerosMissingError y getKantarData
// debe caer a las constantes (mismos números). No escribe nada.
import * as XLSX from "xlsx";
import Module from "node:module";

// "server-only" no está como dependencia (Next lo resuelve interno) → stub vacío para el script.
const M = Module as unknown as { _resolveFilename: (req: string, ...a: unknown[]) => string };
const orig = M._resolveFilename;
M._resolveFilename = (req: string, ...a: unknown[]) => (req === "server-only" ? require.resolve("./empty-module.cjs") : orig(req, ...a));

async function main() {
  const { listDashboards, parseSpreadsheet, TablerosMissingError } = await import("../src/lib/tableros-server");
  const { getKantarData, KANTAR_CONST } = await import("../src/lib/kantar-sheet");
  let fails = 0;
  const ok = (name: string, cond: boolean, extra = "") => { if (!cond) fails++; console.log(`${cond ? "✓" : "✗"} ${name}${extra ? ` — ${extra}` : ""}`); };

  try { const d = await listDashboards(); ok("listDashboards (tablas existen)", Array.isArray(d), `${d.length} tableros`); }
  catch (e) { ok("sin migración → TablerosMissingError", e instanceof TablerosMissingError, (e as Error).message.slice(0, 90)); }

  const k = await getKantarData();
  ok("Kantar sin config → constantes", k.source === "constantes" && k.tables === KANTAR_CONST, k.warning ?? "");

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Mes", "Canal", "Ventas"], ["2026-01", "Online", 1200.5], ["2026-02", "Retail", 900]]), "Hoja1");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  const p = await parseSpreadsheet(buf);
  ok("parseSpreadsheet xlsx", JSON.stringify(p.columns) === JSON.stringify(["Mes", "Canal", "Ventas"]) && p.rows.length === 2 && p.rows[0]![2] === 1200.5);
  const csv = await parseSpreadsheet(Buffer.from("Mes;Monto\n2026-01;1.234,5\n", "utf8"));
  ok("parseSpreadsheet csv", csv.rows.length === 1, JSON.stringify(csv.columns));

  console.log(fails ? `\n${fails} fallas` : "\nOK");
  if (fails) process.exit(1);
}
void main();
