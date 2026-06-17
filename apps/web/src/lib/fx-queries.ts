import "server-only";
import { getServerSupabase } from "./supabase-server";

// Cotización USD→ARS por mes (YYYY-MM-01 → pesos por dólar). BCRA promedio mensual.
export async function getFxRates(): Promise<Record<string, number>> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("fx_rates")
    .select("mes, usd_ars")
    .returns<{ mes: string; usd_ars: string | number }[]>();
  if (error) throw new Error(`fx_rates: ${error.message}`);
  const out: Record<string, number> = {};
  for (const r of data ?? []) {
    out[r.mes] = typeof r.usd_ars === "number" ? r.usd_ars : Number(r.usd_ars);
  }
  return out;
}
