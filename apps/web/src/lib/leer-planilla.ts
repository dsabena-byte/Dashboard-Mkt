// Lee un archivo subido como grilla de texto: CSV (UTF-8 o Windows-1252) o Excel (.xlsx/.xlsm/.xls, primera hoja).
// Client-safe; xlsx se importa recién cuando hace falta.
import { decodificar, parseCsv } from "./trade-carga-core";

export const ACCEPT_PLANILLAS = ".csv,.xlsx,.xlsm,.xls,text/csv";
export const esExcel = (nombre: string) => /\.(xlsx|xlsm|xls)$/i.test(nombre);

const celda = (c: unknown): string => {
  if (c instanceof Date) return `${String(c.getDate()).padStart(2, "0")}/${String(c.getMonth() + 1).padStart(2, "0")}/${c.getFullYear()}`;
  return String(c ?? "").trim();
};

export async function leerGrilla(f: File): Promise<string[][]> {
  const buf = await f.arrayBuffer();
  if (!esExcel(f.name)) return parseCsv(decodificar(new Uint8Array(buf)));
  const XLSX = await import("xlsx");
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0] ?? ""];
  if (!ws) return [];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: "", blankrows: false });
  return rows.map((r) => r.map(celda));
}

/** Para formularios que esperan texto CSV con ";" (p. ej. importar usuarios). */
export async function leerComoCsv(f: File): Promise<string> {
  if (!esExcel(f.name)) return f.text();
  return (await leerGrilla(f)).map((r) => r.join(";")).join("\n");
}
