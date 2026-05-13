import "server-only";
import { getServerSupabase } from "./supabase-server";
import type { DateRange } from "./dates";

export const OWN_BRAND = "dreanargentina";

export interface SocialTotals {
  posts: number;
  engagement_promedio: number | null;
  sentiment_positivo_promedio: number | null;
  followers: number;
}

export interface BrandBenchmarkRow {
  cuenta: string;
  es_competidor: boolean;
  posts: number;
  likes: number;
  comentarios: number;
  views: number;
  engagement_promedio: number | null;
  sentiment_positivo_promedio: number | null;
  sentiment_negativo_promedio: number | null;
  sentiment_neutro_promedio: number | null;
  followers: number;
}

export interface PilarBreakdownRow {
  pilar: string;
  cuenta: string;
  posts: number;
  likes_promedio: number;
  sentiment_positivo_promedio: number | null;
}

export interface EngagementTrendRow {
  fecha: string;
  cuenta: string;
  engagement: number | null;
}

export async function getSocialTotals(range: DateRange): Promise<SocialTotals> {
  const supabase = getServerSupabase();

  const { data, error } = await supabase
    .from("social_metrics")
    .select("posts, engagement_rate, sentiment_promedio_positivo, seguidores, cuenta")
    .eq("cuenta", OWN_BRAND)
    .gte("fecha", range.from)
    .lte("fecha", range.to)
    .returns<
      {
        posts: number;
        engagement_rate: number | null;
        sentiment_promedio_positivo: number | null;
        seguidores: number;
        cuenta: string;
      }[]
    >();

  if (error) throw new Error(`social_metrics totals: ${error.message}`);

  const rows = data ?? [];
  const postsTotal = rows.reduce((s, r) => s + r.posts, 0);

  const engagementVals = rows
    .map((r) => r.engagement_rate)
    .filter((v): v is number => v !== null);
  const sentimentVals = rows
    .map((r) => r.sentiment_promedio_positivo)
    .filter((v): v is number => v !== null);

  return {
    posts: postsTotal,
    engagement_promedio:
      engagementVals.length > 0
        ? engagementVals.reduce((s, v) => s + v, 0) / engagementVals.length
        : null,
    sentiment_positivo_promedio:
      sentimentVals.length > 0
        ? sentimentVals.reduce((s, v) => s + v, 0) / sentimentVals.length
        : null,
    followers: rows.reduce((max, r) => Math.max(max, r.seguidores), 0),
  };
}

export async function getBrandBenchmark(range: DateRange): Promise<BrandBenchmarkRow[]> {
  const supabase = getServerSupabase();

  const { data, error } = await supabase
    .from("vw_social_daily")
    .select("*")
    .gte("fecha", range.from)
    .lte("fecha", range.to)
    .returns<
      {
        fecha: string;
        plataforma: string;
        cuenta: string;
        posts: number;
        posts_organicos: number;
        posts_pauta: number;
        likes: number;
        comentarios: number;
        shares: number;
        vistas: number;
        sentiment_promedio_positivo: number | null;
        sentiment_promedio_negativo: number | null;
        sentiment_promedio_neutro: number | null;
      }[]
    >();

  if (error) throw new Error(`vw_social_daily: ${error.message}`);

  interface Accumulator {
    cuenta: string;
    es_competidor: boolean;
    posts: number;
    likes: number;
    comentarios: number;
    views: number;
    followers: number;
    sentPosSum: number;
    sentNegSum: number;
    sentNeuSum: number;
    sentCount: number;
  }

  const byBrand = new Map<string, Accumulator>();
  for (const r of data ?? []) {
    const existing: Accumulator = byBrand.get(r.cuenta) ?? {
      cuenta: r.cuenta,
      es_competidor: r.cuenta !== OWN_BRAND,
      posts: 0,
      likes: 0,
      comentarios: 0,
      views: 0,
      followers: 0,
      sentPosSum: 0,
      sentNegSum: 0,
      sentNeuSum: 0,
      sentCount: 0,
    };

    existing.posts += r.posts;
    existing.likes += r.likes;
    existing.comentarios += r.comentarios;
    existing.views += r.vistas;
    if (r.sentiment_promedio_positivo !== null) {
      existing.sentPosSum += r.sentiment_promedio_positivo;
      existing.sentNegSum += r.sentiment_promedio_negativo ?? 0;
      existing.sentNeuSum += r.sentiment_promedio_neutro ?? 0;
      existing.sentCount += 1;
    }
    byBrand.set(r.cuenta, existing);
  }

  const rows: BrandBenchmarkRow[] = [...byBrand.values()].map((b) => ({
    cuenta: b.cuenta,
    es_competidor: b.es_competidor,
    posts: b.posts,
    likes: b.likes,
    comentarios: b.comentarios,
    views: b.views,
    followers: b.followers,
    engagement_promedio: b.posts > 0 ? (b.likes + b.comentarios) / b.posts : null,
    sentiment_positivo_promedio:
      b.sentCount > 0 ? b.sentPosSum / b.sentCount : null,
    sentiment_negativo_promedio:
      b.sentCount > 0 ? b.sentNegSum / b.sentCount : null,
    sentiment_neutro_promedio:
      b.sentCount > 0 ? b.sentNeuSum / b.sentCount : null,
  }));

  // Followers max desde social_metrics
  const { data: metrics } = await supabase
    .from("social_metrics")
    .select("cuenta, seguidores")
    .gte("fecha", range.from)
    .lte("fecha", range.to)
    .returns<{ cuenta: string; seguidores: number }[]>();
  for (const m of metrics ?? []) {
    const row = rows.find((r) => r.cuenta === m.cuenta);
    if (row) row.followers = Math.max(row.followers, m.seguidores);
  }

  return rows.sort((a, b) => b.posts - a.posts);
}

export async function getPilarBreakdown(): Promise<PilarBreakdownRow[]> {
  const supabase = getServerSupabase();

  const { data, error } = await supabase
    .from("vw_social_pilar_breakdown")
    .select("*")
    .returns<
      {
        mes: string;
        cuenta: string;
        pilar: string;
        posts: number;
        likes: number;
        comentarios: number;
        sentiment_promedio_positivo: number | null;
      }[]
    >();

  if (error) throw new Error(`vw_social_pilar_breakdown: ${error.message}`);

  const byPilarBrand = new Map<string, PilarBreakdownRow>();
  for (const r of data ?? []) {
    const key = `${r.pilar}|${r.cuenta}`;
    const existing = byPilarBrand.get(key) ?? {
      pilar: r.pilar,
      cuenta: r.cuenta,
      posts: 0,
      likes_promedio: 0,
      sentiment_positivo_promedio: r.sentiment_promedio_positivo,
    };
    existing.posts += r.posts;
    existing.likes_promedio =
      existing.posts > 0
        ? (existing.likes_promedio * (existing.posts - r.posts) + r.likes) /
          existing.posts
        : 0;
    byPilarBrand.set(key, existing);
  }

  return [...byPilarBrand.values()].sort((a, b) => b.posts - a.posts);
}

export async function getEngagementTrend(range: DateRange): Promise<EngagementTrendRow[]> {
  const supabase = getServerSupabase();

  const { data, error } = await supabase
    .from("vw_social_daily")
    .select("fecha, cuenta, posts, likes, comentarios")
    .gte("fecha", range.from)
    .lte("fecha", range.to)
    .order("fecha", { ascending: true })
    .returns<
      { fecha: string; cuenta: string; posts: number; likes: number; comentarios: number }[]
    >();

  if (error) throw new Error(`engagement trend: ${error.message}`);

  return (data ?? []).map((r) => ({
    fecha: r.fecha,
    cuenta: r.cuenta,
    engagement: r.posts > 0 ? (r.likes + r.comentarios) / r.posts : null,
  }));
}
