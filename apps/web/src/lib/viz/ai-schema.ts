// Resumen compacto del esquema de un dataset para la IA (nombres, tipos, ejemplos) y una
// muestra de filas. Lo arma el cliente y lo manda a /api/tableros/ai (sin mandar la planilla entera).
import type { Prepared } from "./schema";
import { distinctValues, fieldRange, rowVal } from "./schema";
import { isoDate } from "./parse";

export interface AiField { id: string; label: string; type: string; role: string; format: string; ejemplos?: string[]; rango?: [string, string]; distintos?: number }
export interface AiDataset { id: string; name: string; rows: number; fields: AiField[]; sample: Record<string, unknown>[] }

export function aiSchema(P: Prepared, datasetId: string, sampleRows = 8): AiDataset {
  const fields: AiField[] = P.fields.filter((f) => !f.hidden && !f.error).slice(0, 60).map((f) => {
    const o: AiField = { id: f.id, label: f.label, type: f.type, role: f.role, format: f.format };
    if (f.type === "text" || f.type === "boolean") { const d = distinctValues(P, f.id, 8); o.ejemplos = d.map((x) => x.key); o.distintos = distinctValues(P, f.id, 100000).length; }
    else { const r = fieldRange(P, f.id); if (r) o.rango = f.type === "date" ? [isoDate(r[0]), isoDate(r[1])] : [String(r[0]), String(r[1])]; }
    return o;
  });
  const step = Math.max(1, Math.floor(P.n / sampleRows));
  const sample: Record<string, unknown>[] = [];
  for (let i = 0; i < P.n && sample.length < sampleRows; i += step) {
    const row: Record<string, unknown> = {};
    for (const f of fields.slice(0, 25)) { const v = rowVal(P, f.id, i); row[f.label] = v instanceof Date ? isoDate(v.getTime()) : v; }
    sample.push(row);
  }
  return { id: datasetId, name: P.ds.name, rows: P.n, fields, sample };
}
