// Datos de un widget como matriz (1ª fila = encabezados) para exportar a Excel.
import type { Result } from "./query";
import type { Widget } from "./types";

export function resultToAoa(r: Result, w: Widget): unknown[][] {
  if (r.kpi) {
    const k = r.kpi;
    const out: unknown[][] = [["Indicador", "Período", "Valor", "Anterior", "Variación %", "Meta", "Cumplimiento %"], [w.title || r.measures[0]?.label, k.periodLabel, k.value, k.prev, k.deltaPct, k.target, k.cumpl]];
    if (k.spark.length) { out.push([]); out.push(["Período", r.measures[0]?.label ?? "Valor"]); for (const s of k.spark) out.push([s.label, s.value]); }
    return out;
  }
  if (r.detail) return [r.detail.header.map((h) => h.label), ...r.detail.rows];
  if (r.pivot) {
    const p = r.pivot;
    const ms = r.measures;
    const head = [...p.rowDims.map((d) => d.label)];
    for (const c of p.colKeys) for (const m of ms) head.push(ms.length > 1 ? `${c.label} · ${m.label}` : c.label);
    for (const m of ms) head.push(ms.length > 1 ? `Total · ${m.label}` : "Total");
    const rows: unknown[][] = [head];
    for (const row of p.rows) {
      const lead = p.rowDims.map((_, j) => (j < row.labels.length ? row.labels[j] : row.leaf ? "" : j === row.labels.length ? "Subtotal" : ""));
      rows.push([...lead, ...row.cells.flatMap((c) => c)]);
    }
    rows.push([...p.rowDims.map((_, j) => (j === 0 ? "Total general" : "")), ...p.grand.flatMap((c) => c)]);
    return rows;
  }
  const head = [...r.dims.map((d) => d.label), ...r.measures.map((m) => m.label)];
  if (r.hasTarget) head.push(r.targetLabel ?? "Meta");
  const rows: unknown[][] = [head];
  for (const row of r.rows) rows.push([...row.labels, ...row.values, ...(r.hasTarget ? [row.target ?? null] : [])]);
  return rows;
}
