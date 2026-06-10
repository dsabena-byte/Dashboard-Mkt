import "server-only";
import { getServerSupabase } from "./supabase-server";

/**
 * Datos del dash de "BGT Mkt". Fuente unificada: tabla Supabase `bgt_marketing`,
 * sincronizada desde el data.json de SharePoint vía /api/cron/bgt-sync.
 * Como fallback (antes de que corra el primer sync), lee el data.json directo.
 *
 * Formato del data.json (cada fila es un array):
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

interface DbBgtRow {
  presupuesto: string;
  anio: number;
  mes: string;
  cuenta: string;
  concepto: string;
  ars: string | number | null;
  usd: string | number | null;
  updated_at: string | null;
}

export async function getBgtData(): Promise<BgtData> {
  // 1) Fuente unificada: tabla Supabase bgt_marketing.
  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from("bgt_marketing")
      .select("presupuesto, anio, mes, cuenta, concepto, ars, usd, updated_at")
      .order("anio", { ascending: false })
      .limit(20000)
      .returns<DbBgtRow[]>();
    if (!error && data && data.length > 0) {
      const rows: BgtRow[] = data.map((r) => ({
        presupuesto: r.presupuesto,
        cuenta: r.cuenta,
        anio: String(r.anio),
        mes: String(r.mes).toUpperCase(),
        concepto: r.concepto,
        ars: Number(r.ars) || 0,
        usd: Number(r.usd) || 0,
      }));
      const syncedAt = data.reduce<string | null>(
        (m, r) => (r.updated_at && (!m || r.updated_at > m) ? r.updated_at : m),
        null,
      );
      return { rows, syncedAt };
    }
  } catch {
    // cae al fallback
  }

  // 2) Fallback: data.json externo (antes del primer sync).
  return fetchBgtDataJson();
}

async function fetchBgtDataJson(): Promise<BgtData> {
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
