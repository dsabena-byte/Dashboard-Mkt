import "server-only";
import { getServerSupabase } from "./supabase-server";

// ============================================================================
// Salud de Marca (Obj. 4) — construcción de marca (leading indicators).
// Mix de contenido orgánico de Drean por CATEGORÍA × PILAR (clasificación LLM
// en meta_posts), alineado a las categorías de pauta para poder sumar luego
// orgánico + pauta en la misma dimensión.
// ============================================================================

export const BRAND_CATEGORIAS = ["Brand", "Lavado", "Refrigeración", "Cocción", "Promoción"] as const;
export const BRAND_PILARES = [
  "Liderazgo marca/porfolio",
  "Calidad superior",
  "Respaldo Posventa",
  "Elegir bien",
  "Experiencia uso",
] as const;

export interface OrganicMixCell {
  posts: number;
  reach: number;
  engagement: number;
}

export interface OrganicPilarMix {
  // counts[categoria][pilar]
  cells: Record<string, Record<string, OrganicMixCell>>;
  totalByCat: Record<string, number>;   // posts por categoría
  totalByPilar: Record<string, number>; // posts por pilar
  total: number;
  desde: string; // YYYY-MM-01 del rango usado
}

interface Row {
  categoria: string | null;
  pilar_contenido: string | null;
  reach: number | null;
  engagement: number | null;
}

export async function getOrganicPilarMix(year = 2026): Promise<OrganicPilarMix | null> {
  const supabase = getServerSupabase();
  const desde = `${year}-01-01`;
  const res = await supabase
    .from("meta_posts")
    .select("categoria, pilar_contenido, reach, engagement")
    .not("pilar_contenido", "is", null)
    .gte("fecha_post", `${desde}T00:00:00Z`)
    .limit(5000);
  if (res.error) return null;
  const rows = (res.data ?? []) as Row[];
  if (rows.length === 0) return null;

  const cells: Record<string, Record<string, OrganicMixCell>> = {};
  const totalByCat: Record<string, number> = {};
  const totalByPilar: Record<string, number> = {};
  let total = 0;

  for (const c of BRAND_CATEGORIAS) {
    cells[c] = {};
    for (const p of BRAND_PILARES) cells[c]![p] = { posts: 0, reach: 0, engagement: 0 };
    totalByCat[c] = 0;
  }
  for (const p of BRAND_PILARES) totalByPilar[p] = 0;

  for (const r of rows) {
    const cat = r.categoria && cells[r.categoria] ? r.categoria : "Brand";
    const pil = r.pilar_contenido;
    if (!pil || !cells[cat]![pil]) continue;
    const cell = cells[cat]![pil]!;
    cell.posts += 1;
    cell.reach += r.reach ?? 0;
    cell.engagement += r.engagement ?? 0;
    totalByCat[cat] = (totalByCat[cat] ?? 0) + 1;
    totalByPilar[pil] = (totalByPilar[pil] ?? 0) + 1;
    total += 1;
  }

  return { cells, totalByCat, totalByPilar, total, desde };
}
