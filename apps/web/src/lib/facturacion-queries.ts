import "server-only";
import { getServerSupabase } from "./supabase-server";

export interface FacturacionRow {
  mes: string; // 'YYYY-MM-01'
  facturacion: number;
  moneda: string;
}

/**
 * Facturación real conocida (USD) como fallback en código, para que el
 * indicador Inv/Fact calcule aunque la migration 0049 todavía no se haya
 * aplicado en Supabase. Cuando la tabla tiene el mes, ese valor manda.
 */
const FACTURACION_FALLBACK: Record<string, number> = {
  "2026-01-01": 17603000,
  "2026-02-01": 15500000,
  "2026-03-01": 19299000,
  "2026-04-01": 23423000,
  "2026-05-01": 19767000,
};

/** Facturación mensual real de la empresa (tabla facturacion_mensual + fallback). */
export async function getFacturacionMensual(): Promise<FacturacionRow[]> {
  const byMes = new Map<string, FacturacionRow>();
  // Base: fallback en código.
  for (const [mes, facturacion] of Object.entries(FACTURACION_FALLBACK)) {
    byMes.set(mes, { mes, facturacion, moneda: "USD" });
  }
  // Supabase pisa el fallback si la tabla existe y tiene datos.
  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from("facturacion_mensual")
      .select("mes, facturacion, moneda")
      .order("mes", { ascending: true })
      .returns<FacturacionRow[]>();
    if (!error) {
      for (const r of data ?? []) byMes.set(r.mes, r);
    }
  } catch {
    // Sin conexión / tabla inexistente: nos quedamos con el fallback.
  }
  return [...byMes.values()].sort((a, b) => a.mes.localeCompare(b.mes));
}

/**
 * Suma la facturación de un set de meses 'YYYY-MM-01'. Requiere que TODOS los
 * meses tengan dato (si falta alguno devuelve null) para no mezclar inversión
 * de N meses con facturación de menos meses.
 */
export function sumFacturacion(rows: FacturacionRow[], meses: string[]): number | null {
  const map = new Map(rows.map((r) => [r.mes, r.facturacion ?? 0]));
  let total = 0;
  for (const m of meses) {
    if (!map.has(m)) return null;
    total += map.get(m)!;
  }
  return total;
}
