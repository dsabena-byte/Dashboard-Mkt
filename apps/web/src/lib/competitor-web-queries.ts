import "server-only";
import { getServerSupabase } from "./supabase-server";

export interface CompetitorWebRow {
  competidor: string;
  dominio: string;
  fecha: string;
  visitas_estimadas: number | null;
  visitantes_unicos: number | null;
  bounce_rate: number | null;
  pages_per_visit: number | null;
  avg_visit_duration: number | null;
  fuentes_trafico: unknown;
  paginas_top: unknown;
  paises_top: unknown;
  keywords_top: unknown;
}

/**
 * Devuelve la fila MÁS RECIENTE por competidor — para mostrar el estado
 * actual del benchmark de tráfico web. SimilarWeb data es estimación
 * mensual, no diaria, así que tomar la última fila tiene sentido.
 */
export async function getCompetitorWebSnapshot(): Promise<CompetitorWebRow[]> {
  const supabase = getServerSupabase();

  const { data, error } = await supabase
    .from("competitor_web")
    .select(
      "competidor, dominio, fecha, visitas_estimadas, visitantes_unicos, bounce_rate, pages_per_visit, avg_visit_duration, fuentes_trafico, paginas_top, paises_top, keywords_top",
    )
    .order("fecha", { ascending: false })
    .returns<CompetitorWebRow[]>();

  if (error) throw new Error(`competitor_web: ${error.message}`);

  // Quedarse con la última fila por competidor
  const byCompetidor = new Map<string, CompetitorWebRow>();
  for (const row of data ?? []) {
    if (!byCompetidor.has(row.competidor)) {
      byCompetidor.set(row.competidor, row);
    }
  }
  return [...byCompetidor.values()].sort(
    (a, b) => (b.visitas_estimadas ?? 0) - (a.visitas_estimadas ?? 0),
  );
}
