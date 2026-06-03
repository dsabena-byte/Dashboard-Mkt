import "server-only";
import { getServerSupabase } from "./supabase-server";

export interface InsightRow {
  id: string;
  fecha_generado: string;
  categoria: string;
  signal_key: string;
  prioridad: "alta" | "media" | "baja";
  tipo: "alerta" | "oportunidad" | "info";
  titulo: string;
  descripcion: string;
  acciones: string[] | null;
  datos: Record<string, unknown> | null;
  estado: "nuevo" | "visto" | "cerrado";
  updated_at: string;
}

export async function getInsightsByCategoria(categoria: string, limit = 10): Promise<InsightRow[]> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("insights_log")
    .select("*")
    .eq("categoria", categoria)
    .neq("estado", "cerrado")
    .order("fecha_generado", { ascending: false })
    .limit(limit)
    .returns<InsightRow[]>();
  if (error) {
    console.error(`[insights-queries] ${categoria}:`, error.message);
    return [];
  }
  return data ?? [];
}
