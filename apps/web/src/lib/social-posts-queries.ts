import "server-only";
import { getServerSupabase } from "./supabase-server";

export interface SocialPost {
  id: string;
  red_social: string;          // INSTAGRAM | FACEBOOK | TIKTOK
  url: string;
  pilar: string | null;
  positivo: number | null;
  negativo: number | null;
  neutro: number | null;
  likes: number | null;
  comentarios: number | null;
  engagement: number | null;
  fecha: string | null;
  tipo: string | null;
  marca: string;
  views: number | null;
  content_type: string | null;
  followers: number | null;
}

export interface SocialFilters {
  marca?: string;        // 'all' o el handle de la marca
  red?: string;          // 'all' o INSTAGRAM/FACEBOOK/TIKTOK
  periodo?: string;      // 'all' | '3m' | '1m'
}

export const OWN_BRAND = "dreanargentina";

export const BRAND_LABELS: Record<string, string> = {
  dreanargentina: "Drean",
  "philco.arg": "Philco",
  gafaargentina: "Gafa",
  whirlpoolarg: "Whirlpool",
  electroluxar: "Electrolux",
};

export const BRAND_COLORS: Record<string, string> = {
  dreanargentina: "#dc2626",      // rojo (color institucional)
  "philco.arg": "#f97316",        // naranja
  gafaargentina: "#0ea5e9",       // celeste
  whirlpoolarg: "#7c3aed",        // violeta
  electroluxar: "#64748b",        // gris azulado
};

export const NET_LABELS: Record<string, string> = {
  INSTAGRAM: "Instagram",
  FACEBOOK: "Facebook",
  TIKTOK: "TikTok",
};

export const NET_COLORS: Record<string, string> = {
  INSTAGRAM: "#c084fc",
  FACEBOOK: "#60a5fa",
  TIKTOK: "#2dd4bf",
};

function periodoToFromDate(periodo: string | undefined): string | null {
  const now = new Date();
  if (periodo === "1m") {
    const d = new Date(now);
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  }
  if (periodo === "3m") {
    const d = new Date(now);
    d.setMonth(d.getMonth() - 3);
    return d.toISOString().slice(0, 10);
  }
  return null;
}

// Cutoff fijo: el dashboard solo muestra posts del 2026 en adelante.
const SOCIAL_CUTOFF = "2026-01-01";

export async function getSocialPosts(filters: SocialFilters): Promise<SocialPost[]> {
  const supabase = getServerSupabase();
  let query = supabase
    .from("social_posts")
    .select("*")
    .gte("fecha", SOCIAL_CUTOFF)
    .order("fecha", { ascending: false })
    .range(0, 9999);

  if (filters.marca && filters.marca !== "all") {
    query = query.eq("marca", filters.marca);
  }
  if (filters.red && filters.red !== "all") {
    query = query.eq("red_social", filters.red);
  }
  const fromDate = periodoToFromDate(filters.periodo);
  // Si periodoToFromDate da una fecha más reciente que el cutoff, la aplicamos.
  // Si daría una fecha anterior, el cutoff manda igual.
  if (fromDate && fromDate > SOCIAL_CUTOFF) query = query.gte("fecha", fromDate);

  const { data, error } = await query.returns<SocialPost[]>();
  if (error) {
    if (
      /relation .* does not exist/i.test(error.message) ||
      /could not find the table/i.test(error.message) ||
      /schema cache/i.test(error.message)
    ) {
      return [];
    }
    throw new Error(`social_posts: ${error.message}`);
  }
  return data ?? [];
}

export interface FollowerSnapshot {
  marca: string;
  red_social: string;
  fecha: string;
  followers: number;
}

export async function getSocialFollowers(): Promise<FollowerSnapshot[]> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("social_followers")
    .select("marca, red_social, fecha, followers")
    .order("fecha", { ascending: true })
    .range(0, 9999)
    .returns<FollowerSnapshot[]>();
  if (error) {
    if (
      /relation .* does not exist/i.test(error.message) ||
      /could not find the table/i.test(error.message) ||
      /schema cache/i.test(error.message)
    ) {
      return [];
    }
    throw new Error(`social_followers: ${error.message}`);
  }
  return data ?? [];
}

// Para un (marca, red, fecha) devuelve el snapshot más reciente con fecha <= la fecha del post.
function findFollowersAt(
  snapshots: FollowerSnapshot[],
  marca: string,
  red: string,
  fecha: string | null,
): number | null {
  if (!fecha) return null;
  let best: FollowerSnapshot | null = null;
  for (const s of snapshots) {
    if (s.marca !== marca || s.red_social !== red) continue;
    if (s.fecha > fecha) continue;
    if (!best || s.fecha > best.fecha) best = s;
  }
  return best?.followers ?? null;
}

// Recalcula engagement de cada post usando social_followers (si hay snapshot disponible).
// Fallback: engagement original del scrape (que puede ser null si no había followers).
export function enrichEngagement(posts: SocialPost[], snapshots: FollowerSnapshot[]): SocialPost[] {
  if (snapshots.length === 0) return posts;
  return posts.map((p) => {
    const f = findFollowersAt(snapshots, p.marca, p.red_social, p.fecha);
    if (!f || f <= 0) return p;
    const eng = (((p.likes ?? 0) + (p.comentarios ?? 0)) / f) * 100;
    return { ...p, engagement: Number(eng.toFixed(3)), followers: f };
  });
}

export async function getAllMarcas(): Promise<string[]> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("social_posts")
    .select("marca")
    .gte("fecha", SOCIAL_CUTOFF)
    .order("marca", { ascending: true })
    .range(0, 9999)
    .returns<{ marca: string }[]>();
  if (error) {
    if (
      /relation .* does not exist/i.test(error.message) ||
      /could not find the table/i.test(error.message) ||
      /schema cache/i.test(error.message)
    ) {
      return [];
    }
    throw new Error(`social_posts marcas: ${error.message}`);
  }
  return [...new Set((data ?? []).map((r) => r.marca).filter(Boolean))];
}

// =============================================================================
// Agregaciones derivadas
// =============================================================================

function avg(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

export interface SocialKpis {
  posts: number;
  engagement_promedio: number;
  total_likes: number;
  total_views: number;
  sentimiento_positivo: number;
  sentimiento_negativo: number;
  sentimiento_neutro: number;
  max_engagement: number;
  redes: string[];
}

export function computeKpis(posts: SocialPost[]): SocialKpis {
  const engs = posts.map((p) => p.engagement ?? 0);
  const likes = posts.filter((p) => (p.likes ?? 0) > 0).reduce((a, p) => a + (p.likes ?? 0), 0);
  const views = posts.reduce((a, p) => a + (p.views ?? 0), 0);
  // Sentimiento: solo promediar posts con sentimiento real
  // (excluyendo nulls y posts donde pos=neg=neu=0 que son data sucia del scraper).
  const withSent = posts.filter((p) => {
    if (p.positivo === null || p.positivo === undefined) return false;
    if ((p.positivo || 0) === 0 && (p.negativo || 0) === 0 && (p.neutro || 0) === 0) return false;
    return true;
  });
  const pos = avg(withSent.map((p) => p.positivo as number));
  const neg = avg(withSent.map((p) => p.negativo as number));
  const neu = avg(withSent.map((p) => p.neutro as number));
  return {
    posts: posts.length,
    engagement_promedio: avg(engs),
    total_likes: likes,
    total_views: views,
    sentimiento_positivo: pos,
    sentimiento_negativo: neg,
    sentimiento_neutro: neu,
    max_engagement: posts.length > 0 ? Math.max(...engs) : 0,
    redes: [...new Set(posts.map((p) => p.red_social))],
  };
}

export interface BrandStat {
  marca: string;
  posts: number;
  posts_per_week: number;
  engagement_promedio: number;
  positivo: number;
  negativo: number;
  neutro: number;
  total_likes: number;
  total_comentarios: number;
  total_views: number;
  views_promedio: number;
}

export function computeBrandStats(posts: SocialPost[]): BrandStat[] {
  // Calculamos un span global de semanas para que TODAS las marcas usen el mismo divisor.
  const allDates = posts.map((p) => p.fecha).filter((d): d is string => !!d).sort();
  let globalWeeks = 1;
  if (allDates.length > 0) {
    const minD = new Date(`${allDates[0]}T00:00:00Z`).getTime();
    const maxD = new Date(`${allDates[allDates.length - 1]}T00:00:00Z`).getTime();
    globalWeeks = Math.max(1, (maxD - minD) / (7 * 86_400_000) + 1 / 7);
  }
  const marcas = [...new Set(posts.map((p) => p.marca))];
  return marcas
    .map((m) => {
      const bp = posts.filter((p) => p.marca === m);
      const vidPosts = bp.filter((p) => (p.views ?? 0) > 0);
      // Sentimiento: solo posts con sentimiento real (excluye nulls y 0/0/0)
      const withSent = bp.filter((p) => {
        if (p.positivo === null || p.positivo === undefined) return false;
        if ((p.positivo || 0) === 0 && (p.negativo || 0) === 0 && (p.neutro || 0) === 0) return false;
        return true;
      });
      return {
        marca: m,
        posts: bp.length,
        posts_per_week: bp.length / globalWeeks,
        engagement_promedio: avg(bp.map((p) => p.engagement ?? 0)),
        positivo: avg(withSent.map((p) => p.positivo as number)),
        negativo: avg(withSent.map((p) => p.negativo as number)),
        neutro: avg(withSent.map((p) => p.neutro as number)),
        total_likes: bp.reduce((a, p) => a + (p.likes ?? 0), 0),
        total_comentarios: bp.reduce((a, p) => a + (p.comentarios ?? 0), 0),
        total_views: bp.reduce((a, p) => a + (p.views ?? 0), 0),
        views_promedio: vidPosts.length > 0 ? avg(vidPosts.map((p) => p.views ?? 0)) : 0,
      };
    })
    .sort((a, b) => b.engagement_promedio - a.engagement_promedio);
}

export interface NetStat {
  red: string;
  posts: number;
  engagement_promedio: number;
  total_views: number;
}

export function computeNetStats(posts: SocialPost[]): NetStat[] {
  const nets = ["INSTAGRAM", "FACEBOOK", "TIKTOK"];
  return nets.map((n) => {
    const np = posts.filter((p) => p.red_social === n);
    return {
      red: n,
      posts: np.length,
      engagement_promedio: avg(np.map((p) => p.engagement ?? 0)),
      total_views: np.reduce((a, p) => a + (p.views ?? 0), 0),
    };
  });
}

export interface TrendPoint {
  mes: string;                                  // YYYY-MM
  values: Record<string, number | null>;        // por marca
}

export function computeTrend(posts: SocialPost[]): TrendPoint[] {
  const byMonth = new Map<string, Map<string, number[]>>();
  for (const p of posts) {
    if (!p.fecha) continue;
    const mes = p.fecha.slice(0, 7);
    if (!byMonth.has(mes)) byMonth.set(mes, new Map());
    const m = byMonth.get(mes)!;
    if (!m.has(p.marca)) m.set(p.marca, []);
    m.get(p.marca)!.push(p.engagement ?? 0);
  }
  return [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mes, brandMap]) => {
      const values: Record<string, number | null> = {};
      for (const [marca, engs] of brandMap) {
        values[marca] = avg(engs);
      }
      return { mes, values };
    });
}

// Volumen semanal de posteos por marca.
function weekStartIso(fecha: string): string {
  const d = new Date(`${fecha}T00:00:00Z`);
  const day = d.getUTCDay();
  const offset = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

export function computeWeeklyPostCount(posts: SocialPost[]): TrendPoint[] {
  const marcas = [...new Set(posts.map((p) => p.marca))];
  const byWeek = new Map<string, Map<string, number>>();
  for (const p of posts) {
    if (!p.fecha) continue;
    const semana = weekStartIso(p.fecha);
    if (!byWeek.has(semana)) byWeek.set(semana, new Map());
    const m = byWeek.get(semana)!;
    m.set(p.marca, (m.get(p.marca) ?? 0) + 1);
  }
  return [...byWeek.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([semana, brandMap]) => {
      const values: Record<string, number | null> = {};
      // Para "count", semana sin posts de una marca = 0 (no null) para que se vea la línea
      for (const m of marcas) values[m] = brandMap.get(m) ?? 0;
      // Formato de label: DD/MM
      const [, mm, dd] = semana.split("-");
      return { mes: `${dd}/${mm}`, values };
    });
}

export interface PilarStat {
  pilar: string;
  engagement_promedio: number;
  posts: number;
}

// Normaliza el nombre del pilar:
//   - "Producto" solo  → "Producto"
//   - "Branding/Producto" o "Producto/Branding" → "Producto" (gana por prioridad)
//   - "Producto/Promo" → "Producto"
//   - "Branding/Promo" → "Branding"
// Si un post tiene pilar combinado, lo asignamos a UN único pilar canónico
// según orden de prioridad. No se hace double-counting.
const PILAR_PRIORITY = ["Producto", "Branding", "Promo", "Influencer", "Educacional"];

// Renombres a label final (después de aplicar prioridad).
// Los 5 pilares canónicos: Branding, Producto, Influencer, Promoción, Educativo.
const PILAR_DISPLAY: Record<string, string> = {
  Promo: "Promoción",
  Educacional: "Educativo",
};

function applyDisplayName(pilar: string): string {
  return PILAR_DISPLAY[pilar] ?? pilar;
}

function normalizePilar(pilar: string | null): string | null {
  if (!pilar) return null;
  const parts = pilar
    .split("/")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0] ? applyDisplayName(parts[0]) : null;
  // Multi-part: el de mayor prioridad gana
  for (const pri of PILAR_PRIORITY) {
    if (parts.some((p) => p.toLowerCase() === pri.toLowerCase())) return applyDisplayName(pri);
  }
  return parts[0] ? applyDisplayName(parts[0]) : null;
}

export function computePilarStats(posts: SocialPost[]): PilarStat[] {
  const normalized = posts.map((p) => ({ ...p, pilar: normalizePilar(p.pilar) }));
  const pilars = [...new Set(normalized.map((p) => p.pilar).filter(Boolean) as string[])];
  return pilars
    .map((pi) => {
      const pp = normalized.filter((p) => p.pilar === pi);
      return {
        pilar: pi,
        engagement_promedio: avg(pp.map((p) => p.engagement ?? 0)),
        posts: pp.length,
      };
    })
    .sort((a, b) => b.engagement_promedio - a.engagement_promedio);
}

export interface ContentMixCell {
  red: string;
  content_type: string;
  count: number;
}

export function computeContentMix(posts: SocialPost[]): ContentMixCell[] {
  const map = new Map<string, number>();
  for (const p of posts) {
    if (!p.content_type) continue;
    const key = `${p.red_social}|${p.content_type}`;
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map.entries()].map(([key, count]) => {
    const [red, content_type] = key.split("|");
    return { red: red ?? "", content_type: content_type ?? "", count };
  });
}

export interface SentimentRow {
  key: string;                // marca o pilar
  positivo: number;
  negativo: number;
  neutro: number;
}

export function computeSentimentByBrand(posts: SocialPost[]): SentimentRow[] {
  const marcas = [...new Set(posts.map((p) => p.marca))];
  return marcas.map((m) => {
    // Solo promediar % de posts con sentimiento real (excluye nulls y data sucia 0/0/0)
    const bp = posts.filter((p) => {
      if (p.marca !== m) return false;
      if (p.positivo === null || p.positivo === undefined) return false;
      if ((p.positivo || 0) === 0 && (p.negativo || 0) === 0 && (p.neutro || 0) === 0) return false;
      return true;
    });
    return {
      key: m,
      positivo: avg(bp.map((p) => p.positivo as number)),
      negativo: avg(bp.map((p) => p.negativo as number)),
      neutro: avg(bp.map((p) => p.neutro as number)),
    };
  });
}

export interface ContentTypeSlice {
  content_type: string;
  count: number;
}

export function computeContentTypeSlices(posts: SocialPost[]): ContentTypeSlice[] {
  const map = new Map<string, number>();
  for (const p of posts) {
    if (!p.content_type) continue;
    map.set(p.content_type, (map.get(p.content_type) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([content_type, count]) => ({ content_type, count }))
    .sort((a, b) => b.count - a.count);
}

export function topSuccessfulPosts(posts: SocialPost[], limit = 15): SocialPost[] {
  return posts
    .filter((p) => (p.engagement ?? 0) > 0.3 || (p.positivo ?? 0) > 80)
    .sort((a, b) => (b.engagement ?? 0) - (a.engagement ?? 0))
    .slice(0, limit);
}

export function topCriticalPosts(posts: SocialPost[], limit = 15): SocialPost[] {
  return posts
    .filter((p) => (p.negativo ?? 0) > 10)
    .sort((a, b) => (b.negativo ?? 0) - (a.negativo ?? 0))
    .slice(0, limit);
}
