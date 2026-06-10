import "server-only";

/**
 * Datos del dash de "BGT Mkt". NO viven en Supabase: se sincronizan desde
 * SharePoint a un data.json en GitHub (mismo origen que usa el iframe de
 * /funnel). El Overview lo lee server-side para el Objetivo 1.
 *
 * Formato de cada fila (array):
 *   [ presupuesto, cuenta, anio, mes(UPPER), concepto, ars, usd ]
 */
const DEFAULT_BGT_URL =
  "https://raw.githubusercontent.com/dsabena-byte/Dashboard-BGT/main/data.json";

export interface BgtRow {
  presupuesto: string; // versión: "BGT 2026" | "4+8 2026" | "8+4 2026" | "REAL 2026" | ...
  cuenta: string;
  anio: string;
  mes: string; // "ENERO" … "DICIEMBRE"
  concepto: string;
  ars: number;
  usd: number;
}

export interface BgtData {
  rows: BgtRow[];
  syncedAt: string | null;
}

export const MESES_UP = [
  "ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO",
  "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE",
];

export async function getBgtData(): Promise<BgtData> {
  const url = process.env.BGT_DATA_JSON_URL || DEFAULT_BGT_URL;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`BGT data.json: ${res.status}`);
  const json = (await res.json()) as
    | unknown[]
    | { rows?: unknown[]; syncedAt?: string };
  const raw = Array.isArray(json) ? json : json.rows ?? [];
  const rows: BgtRow[] = (raw as unknown[][]).map((r) => ({
    presupuesto: String(r[0] ?? ""),
    cuenta: String(r[1] ?? ""),
    anio: String(r[2] ?? ""),
    mes: String(r[3] ?? "").toUpperCase(),
    concepto: String(r[4] ?? ""),
    ars: Number(r[5]) || 0,
    usd: Number(r[6]) || 0,
  }));
  const syncedAt = Array.isArray(json) ? null : json.syncedAt ?? null;
  return { rows, syncedAt };
}

/** Suma una versión de presupuesto para un set de meses (UPPER), en USD o ARS. */
export function sumVersion(
  rows: BgtRow[],
  version: string,
  meses: string[],
  field: "usd" | "ars" = "usd",
): number {
  const set = new Set(meses);
  return rows
    .filter((r) => r.presupuesto === version && set.has(r.mes))
    .reduce((s, r) => s + r[field], 0);
}

/** ¿Existe alguna fila para esa versión? (para detectar versiones aún no cargadas) */
export function hasVersion(rows: BgtRow[], version: string): boolean {
  return rows.some((r) => r.presupuesto === version);
}
