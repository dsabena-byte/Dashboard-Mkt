import "server-only";
import type { ChatTool } from "./types";
import { topN } from "./util";
import { getDataset, listDatasets } from "@/lib/tableros-server";

// ============================================================================
// Planillas de "Mis tableros" (tabla tableros_datasets) para el copiloto — portado de BIP
// (list_archivos / query_archivo). Filas como OBJETOS {columna: valor} (nunca arrays
// posicionales), filtro simple y agregación opcional (suma por columna, agrupado).
// Si falta la migración 0109, las tools devuelven {disponible:false}.
// ============================================================================

// Números AR ("1.234,56") o planos ("1234.56"); varios puntos sin coma = miles.
function num(v: unknown): number {
  if (typeof v === "number") return v;
  let s = String(v ?? "").replace(/[^0-9.,\-]/g, "");
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if ((s.match(/\./g) ?? []).length > 1) s = s.replace(/\./g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

export const archivosTools: ChatTool[] = [
  {
    name: "list_tableros_datasets",
    description: "Lista las planillas propias cargadas en 'Mis tableros' (Excel/CSV/Google Sheets que subió el equipo): id, nombre, columnas y cantidad de filas. Usala antes de query_dataset para saber qué datos propios hay (presupuestos, ventas, relevamientos, Kantar, etc.).",
    parameters: { type: "object", properties: {}, additionalProperties: false },
    run: async () => {
      const rows = await listDatasets(true);
      if (!rows.length) return { disponible: false, motivo: "No hay planillas cargadas en Mis tableros (se suben desde /tableros)." };
      return { planillas: rows.slice(0, 40).map((d) => ({ id: d.id, nombre: d.name, columnas: (d.columns ?? []).slice(0, 40), filas: d.row_count })) };
    },
  },
  {
    name: "query_dataset",
    description: "Consulta una planilla de Mis tableros (id de list_tableros_datasets). Devuelve filas como objetos {columna: valor}. Opcional: columnas a traer, filtro (columna contiene texto) y agregación: agrupar_por + sumar (columnas numéricas) → totales por grupo. Máx. 200 filas.",
    parameters: {
      type: "object",
      properties: {
        dataset_id: { type: "string" },
        columnas: { type: "array", items: { type: "string" } },
        filtro_columna: { type: "string" },
        filtro_contiene: { type: "string" },
        agrupar_por: { type: "string", description: "columna para agrupar (opcional)" },
        sumar: { type: "array", items: { type: "string" }, description: "columnas numéricas a sumar por grupo" },
        limite: { type: "integer", minimum: 1, maximum: 200 },
      },
      required: ["dataset_id"],
      additionalProperties: false,
    },
    run: async (args) => {
      const ds = await getDataset(String(args.dataset_id ?? ""));
      if (!ds) return { disponible: false, motivo: "Planilla no encontrada (usá list_tableros_datasets)." };
      const cols = ds.columns;
      const ci = (c: unknown) => cols.findIndex((x) => x.toLowerCase() === String(c ?? "").toLowerCase());
      let rows = ds.rows;
      const fc = ci(args.filtro_columna);
      if (fc >= 0 && args.filtro_contiene) { const q = String(args.filtro_contiene).toLowerCase(); rows = rows.filter((r) => String(r[fc] ?? "").toLowerCase().includes(q)); }
      const g = ci(args.agrupar_por);
      const sumCols = (Array.isArray(args.sumar) ? args.sumar : []).map(ci).filter((i) => i >= 0);
      if (g >= 0 && sumCols.length) {
        const m = new Map<string, number[]>();
        for (const r of rows) { const k = String(r[g] ?? "(vacío)"); const acc = m.get(k) ?? sumCols.map(() => 0); sumCols.forEach((c, j) => (acc[j]! += num(r[c]))); m.set(k, acc); }
        return { nombre: ds.name, filas_filtradas: rows.length, agrupado_por: cols[g], grupos: [...m.entries()].slice(0, 200).map(([k, v]) => ({ [cols[g]!]: k, ...Object.fromEntries(sumCols.map((c, j) => [cols[c], Math.round(v[j]! * 100) / 100])) })) };
      }
      const pick = (Array.isArray(args.columnas) ? args.columnas : []).map(ci).filter((i) => i >= 0);
      const use = pick.length ? pick : cols.map((_, i) => i);
      const lim = topN(args.limite, 200, 200);
      return { nombre: ds.name, columnas: use.map((i) => cols[i]), total_filas: rows.length, filas: rows.slice(0, lim).map((r) => Object.fromEntries(use.map((i) => [cols[i], r[i] ?? null]))), ...(rows.length > lim ? { nota: `Mostrando ${lim} de ${rows.length} filas: usá filtro o agrupar_por+sumar para totales.` } : {}) };
    },
  },
];
