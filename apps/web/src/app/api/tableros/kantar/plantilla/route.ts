import * as XLSX from "xlsx";
import { KANTAR_LAVADO } from "@/lib/salud-marca-model";

// Plantilla Excel de "Kantar por planilla": una fila por ola × marca × categoría. Trae como
// ejemplo las olas nov-24 / nov-25 de Lavado que ya están en el tablero (mismos números).
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const headers = ["Ola", "Marca", "Categoría", "Top of mind", "Share of mind", "Intención de compra", "Poder de marca", "Significancia", "Diferenciación", "Saliencia"];
  const rows: (string | number | null)[][] = [];
  for (const w of ["nov-24", "nov-25"]) for (const b of ["Drean", "Samsung"]) {
    const k = KANTAR_LAVADO[b]?.[w];
    if (k) rows.push([w, b, "Lavado", k.tom, k.som, k.int, k.poder, k.sig, k.dif, k.sal]);
  }
  const instr = [
    ["Kantar por planilla — instrucciones"],
    ["Una fila por ola, marca y categoría (Lavado / Refrigeración / Cocción). Las filas de ejemplo son los valores actuales del tablero."],
    ["Ola: nov-23, jun-24, nov-24, jun-25 o nov-25 (también sirve una fecha: 2025-11 o 01/11/2025). nov-26 es la proyección del modelo y no se pisa."],
    ["Indicadores en % (40 o 40% o 0,40). Poder de marca en %; Significancia/Diferenciación/Saliencia como índice base 100."],
    ["Solo se pisan las celdas que traen dato; lo que no esté en la planilla sigue con el valor fijo del tablero."],
    ["Se sube en Mis tableros → Planillas y se conecta en “Kantar por planilla”."],
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([headers, ...rows]), "Kantar");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(instr), "Instrucciones");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="drean-kantar-plantilla.xlsx"',
    },
  });
}
