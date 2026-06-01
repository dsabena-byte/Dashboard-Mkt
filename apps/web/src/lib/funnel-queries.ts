import "server-only";
import { getServerSupabase } from "./supabase-server";

export type FunnelCategoria = "Brand" | "Lavado" | "Refrigeración" | "Cocinas" | "Lavavajillas" | "Otros";
export type FunnelEtapa = "awareness" | "interes" | "consideracion";

export interface FunnelStageData {
  // Pauta: cada métrica suma a su etapa correspondiente, sin filtrar por objetivo.
  // Awareness    → impresiones
  // Interés      → alcance + video views
  // Consideración → clicks
  pauta_impresiones: number;
  pauta_alcance: number;
  pauta_video_views: number;
  pauta_clicks: number;
  // GA4
  ga4_sesiones: number;
  ga4_usuarios: number;
}

export interface FunnelData {
  awareness: FunnelStageData;
  interes: FunnelStageData;
  consideracion: FunnelStageData;
}

// Categorías que admite el selector del widget. "Total" = no filtra.
export const FUNNEL_CATEGORIAS: Array<"Total" | FunnelCategoria> = [
  "Total", "Brand", "Lavado", "Refrigeración", "Cocinas", "Lavavajillas",
];

// Mapeo Pauta.categoria → FunnelCategoria del Overview.
// Pauta usa "Cocción" + "Promoción" que no existen en GA4; los mapeamos así:
// - Cocción    → Cocinas (mismo concepto)
// - Promoción  → Brand   (multi-categoria, alineado con definición)
const PAUTA_TO_FUNNEL: Record<string, FunnelCategoria> = {
  Brand: "Brand",
  Lavado: "Lavado",
  "Refrigeración": "Refrigeración",
  "Refrigeracion": "Refrigeración",
  "Cocción": "Cocinas",
  Coccion: "Cocinas",
  Cocinas: "Cocinas",
  Lavavajillas: "Lavavajillas",
  "Promoción": "Brand",
  Promocion: "Brand",
};

function emptyStage(): FunnelStageData {
  return {
    pauta_impresiones: 0,
    pauta_alcance: 0,
    pauta_video_views: 0,
    pauta_clicks: 0,
    ga4_sesiones: 0,
    ga4_usuarios: 0,
  };
}

function emptyFunnel(): FunnelData {
  return { awareness: emptyStage(), interes: emptyStage(), consideracion: emptyStage() };
}

interface PautaRow {
  categoria: string;
  impresiones: number | null;
  alcance: number | null;
  views: number | null;
  clics: number | null;
}

interface Ga4Row {
  etapa: string;
  categoria: string;
  sesiones: number | null;
  usuarios: number | null;
}

/**
 * Devuelve los datos del funnel agrupados por (categoria → stage).
 * Incluye "Total" (suma de todas las categorías).
 */
export async function getFunnelData(range: { from: string; to: string }, mes: string): Promise<Record<string, FunnelData>> {
  const supabase = getServerSupabase();

  // GA4: vw_ga4_funnel filtrada por rango
  const ga4Promise = supabase
    .from("vw_ga4_funnel")
    .select("etapa, categoria, sesiones, usuarios")
    .gte("fecha", range.from)
    .lte("fecha", range.to)
    .returns<Ga4Row[]>();

  // Pauta: pauta_performance filtrada por mes (formato "Abril 2026")
  const pautaPromise = supabase
    .from("pauta_performance")
    .select("categoria, impresiones, alcance, views, clics")
    .eq("mes", mes)
    .returns<PautaRow[]>();

  const [ga4Res, pautaRes] = await Promise.all([ga4Promise, pautaPromise]);

  const out: Record<string, FunnelData> = { Total: emptyFunnel() };
  for (const c of FUNNEL_CATEGORIAS) if (c !== "Total") out[c] = emptyFunnel();

  // GA4 → suma por (categoria, etapa)
  for (const r of ga4Res.data ?? []) {
    const cat = (r.categoria as FunnelCategoria) ?? "Otros";
    const stage = r.etapa as FunnelEtapa;
    if (!["awareness", "interes", "consideracion"].includes(stage)) continue;
    const sesiones = r.sesiones ?? 0;
    const usuarios = r.usuarios ?? 0;
    if (out[cat]) {
      out[cat]![stage].ga4_sesiones += sesiones;
      out[cat]![stage].ga4_usuarios += usuarios;
    }
    out.Total![stage].ga4_sesiones += sesiones;
    out.Total![stage].ga4_usuarios += usuarios;
  }

  // Pauta → métricas se distribuyen por etapa:
  //   impresiones → awareness, alcance+views → interes, clics → consideracion
  for (const r of pautaRes.data ?? []) {
    const cat = PAUTA_TO_FUNNEL[r.categoria] ?? "Otros";
    const imp = r.impresiones ?? 0;
    const alc = r.alcance ?? 0;
    const vv = r.views ?? 0;
    const clk = r.clics ?? 0;

    if (out[cat]) {
      out[cat]!.awareness.pauta_impresiones += imp;
      out[cat]!.interes.pauta_alcance += alc;
      out[cat]!.interes.pauta_video_views += vv;
      out[cat]!.consideracion.pauta_clicks += clk;
    }
    out.Total!.awareness.pauta_impresiones += imp;
    out.Total!.interes.pauta_alcance += alc;
    out.Total!.interes.pauta_video_views += vv;
    out.Total!.consideracion.pauta_clicks += clk;
  }

  return out;
}
