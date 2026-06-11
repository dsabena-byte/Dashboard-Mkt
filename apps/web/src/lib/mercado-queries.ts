import "server-only";
import { getServerSupabase } from "./supabase-server";

// Serie mensual de mercado (share value e índice de precio por segmento),
// por categoría. Fuente: tabla mercado_categoria (carga manual).

export interface MercadoPoint {
  mes: string; // YYYY-MM-01
  categoria: string;
  svHigh: number | null;
  svMid: number | null;
  svLow: number | null;
  idxHigh: number | null;
  idxMid: number | null;
  idxLow: number | null;
}

interface DbRow {
  mes: string;
  categoria: string;
  share_value_high: number | null;
  share_value_mid: number | null;
  share_value_low: number | null;
  index_price_high: number | null;
  index_price_mid: number | null;
  index_price_low: number | null;
}

export async function getMercadoSeries(): Promise<MercadoPoint[]> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("mercado_categoria")
    .select("mes, categoria, share_value_high, share_value_mid, share_value_low, index_price_high, index_price_mid, index_price_low")
    .order("mes", { ascending: true })
    .limit(3000)
    .returns<DbRow[]>();
  if (error || !data) return [];
  return data.map((r) => ({
    mes: r.mes,
    categoria: r.categoria,
    svHigh: r.share_value_high,
    svMid: r.share_value_mid,
    svLow: r.share_value_low,
    idxHigh: r.index_price_high,
    idxMid: r.index_price_mid,
    idxLow: r.index_price_low,
  }));
}

const MES_SHORT = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
export function mesLabel(mes: string): string {
  const [y, m] = mes.split("-");
  const idx = parseInt(m ?? "1", 10) - 1;
  return `${MES_SHORT[idx] ?? m} ${String(y).slice(2)}`;
}
