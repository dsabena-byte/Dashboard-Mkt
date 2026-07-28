import "server-only";
import { getServerSupabase } from "./supabase-server";

// Piezas UGC generadas en el calendario (canal='ugc'), con los tags del
// generador. Alimentan el panel de "Testeo de creativos" en /influencia:
//   - el link `ad_id` conecta la pieza con el anuncio de Meta que la pautea,
//   - los tags (perfil, escenario, formato, pilar, género) permiten los
//     "aprendizajes por dimensión" (qué combinación rinde mejor).

export interface UgcTestEntry {
  id: string;
  fecha: string | null;
  idea: string | null;       // tema del guion
  perfil: string | null;     // usuario | tecnico | personal
  escenario: string | null;  // se guarda en `categoria` (preset o texto libre)
  formato: string | null;
  pilar: string | null;
  genero: string | null;     // se guarda en `subtipo`
  atributos: string[];       // se guardan en `notas` (coma-separado)
  video_url: string | null;
  ad_id: string | null;      // link a meta_paid_creatives.ad_id
}

interface DbRow {
  id: string;
  fecha: string | null;
  idea: string | null;
  perfil: string | null;
  categoria: string | null;
  formato: string | null;
  pilar: string | null;
  subtipo: string | null;
  notas: string | null;
  video_url: string | null;
  ad_id: string | null;
}

export async function getUgcTestEntries(): Promise<UgcTestEntry[]> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("contenido_calendario")
    .select("id, fecha, idea, perfil, categoria, formato, pilar, subtipo, notas, video_url, ad_id")
    .eq("canal", "ugc")
    .order("fecha", { ascending: false })
    .returns<DbRow[]>();
  if (error) throw new Error(`UGC test entries: ${error.message}`);
  return (data ?? []).map((r) => ({
    id: r.id,
    fecha: r.fecha,
    idea: r.idea,
    perfil: r.perfil,
    escenario: r.categoria,
    formato: r.formato,
    pilar: r.pilar,
    genero: r.subtipo,
    atributos: (r.notas ?? "").split(",").map((s) => s.trim()).filter(Boolean),
    video_url: r.video_url,
    ad_id: r.ad_id,
  }));
}
