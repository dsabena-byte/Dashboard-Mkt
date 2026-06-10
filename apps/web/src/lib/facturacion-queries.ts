import "server-only";
import { getServerSupabase } from "./supabase-server";

export interface FacturacionRow {
  mes: string; // 'YYYY-MM-01'
  facturacion: number;
  moneda: string;
}

/** Facturación mensual real de la empresa (tabla facturacion_mensual). */
export async function getFacturacionMensual(): Promise<FacturacionRow[]> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("facturacion_mensual")
    .select("mes, facturacion, moneda")
    .order("mes", { ascending: true })
    .returns<FacturacionRow[]>();
  if (error) throw new Error(`facturacion_mensual: ${error.message}`);
  return data ?? [];
}

/** Suma la facturación de un set de meses 'YYYY-MM-01'. Devuelve null si no hay ninguno. */
export function sumFacturacion(rows: FacturacionRow[], meses: string[]): number | null {
  const set = new Set(meses);
  const hits = rows.filter((r) => set.has(r.mes));
  if (hits.length === 0) return null;
  return hits.reduce((s, r) => s + (r.facturacion ?? 0), 0);
}
