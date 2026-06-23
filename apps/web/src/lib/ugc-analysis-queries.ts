import "server-only";
import { getServerSupabase } from "./supabase-server";

export interface UgcAnalysisBlock {
  resumen?: string;
  credibilidad?: { nivel?: string; detalle?: string };
  intencion_compra?: { nivel?: string; detalle?: string };
  percepcion_marca?: { nivel?: string; detalle?: string };
  mejoras?: string[];
}

export interface UgcPieceAnalysis {
  permalink: string;
  ad_name: string | null;
  image_url: string | null;
  comments: Array<{ text: string; author: string | null; likes: number }>;
  analysis: UgcAnalysisBlock | null;
}

export async function getUgcAnalysis(): Promise<UgcPieceAnalysis[]> {
  const supabase = getServerSupabase();
  const [piecesRes, commentsRes, analysisRes] = await Promise.all([
    supabase
      .from("meta_paid_creatives")
      .select("ad_name, instagram_permalink_url, image_url, spend")
      .eq("categoria", "UGC")
      .not("instagram_permalink_url", "is", null)
      .order("spend", { ascending: false })
      .returns<Array<{ ad_name: string | null; instagram_permalink_url: string | null; image_url: string | null; spend: number | null }>>(),
    supabase
      .from("ugc_comments")
      .select("permalink, comment_text, author, like_count")
      .order("like_count", { ascending: false })
      .returns<Array<{ permalink: string; comment_text: string; author: string | null; like_count: number | null }>>(),
    supabase
      .from("ugc_piece_analysis")
      .select("permalink, analysis")
      .returns<Array<{ permalink: string; analysis: UgcAnalysisBlock | null }>>(),
  ]);

  if (piecesRes.error) throw new Error(`UGC pieces: ${piecesRes.error.message}`);

  const commentsByLink = new Map<string, UgcPieceAnalysis["comments"]>();
  for (const c of commentsRes.data ?? []) {
    const arr = commentsByLink.get(c.permalink) ?? [];
    arr.push({ text: c.comment_text, author: c.author, likes: c.like_count ?? 0 });
    commentsByLink.set(c.permalink, arr);
  }
  const analysisByLink = new Map<string, UgcAnalysisBlock | null>();
  for (const a of analysisRes.data ?? []) analysisByLink.set(a.permalink, a.analysis);

  // Una entrada por permalink (pieza), la de mayor inversión.
  const seen = new Set<string>();
  const out: UgcPieceAnalysis[] = [];
  const pieces = (piecesRes.data ?? []) as Array<{ ad_name: string | null; instagram_permalink_url: string | null; image_url: string | null; spend: number | null }>;
  for (const p of pieces) {
    const link = p.instagram_permalink_url;
    if (!link || seen.has(link)) continue;
    seen.add(link);
    out.push({
      permalink: link,
      ad_name: p.ad_name,
      image_url: p.image_url,
      comments: commentsByLink.get(link) ?? [],
      analysis: analysisByLink.get(link) ?? null,
    });
  }
  return out;
}
