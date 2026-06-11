import "server-only";
import { getServerSupabase } from "./supabase-server";

// Serie mensual de mercado por marca (Drean + competencia), categoría y
// segmento. Fuente: tabla mercado_share (carga manual desde GFK).

export interface MercadoRow {
  mes: string; // YYYY-MM-01
  categoria: string;
  segmento: string; // High | Mid | Low
  marca: string;
  unit_share: number | null;  // %
  value_share: number | null; // %
  index_price: number | null; // base 100
  agregacion?: string; // MAT | mensual
}

// agregacion: 'MAT' (acum. móvil 12m) o 'mensual' (valor del mes). Se filtra para
// que las dos series no se mezclen. Default 'MAT' (lo cargado hasta ahora).
export async function getMercadoRows(agregacion: "MAT" | "mensual" = "MAT"): Promise<MercadoRow[]> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("mercado_share")
    .select("mes, categoria, segmento, marca, unit_share, value_share, index_price, agregacion")
    .eq("agregacion", agregacion)
    .order("mes", { ascending: true })
    .limit(20000)
    .returns<MercadoRow[]>();
  if (error || !data) return [];
  return data;
}

const MES_SHORT = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
export function mesLabel(mes: string): string {
  const [y, m] = mes.split("-");
  const idx = parseInt(m ?? "1", 10) - 1;
  return `${MES_SHORT[idx] ?? m} ${String(y).slice(2)}`;
}
