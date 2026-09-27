// Competencia en redes — agregaciones PURAS y client-safe (portadas del SaaS hermano, sep-2026):
//  1. ER COMPARABLE (corrige el sesgo de maduración): los likes/comentarios se leen en el momento del
//     scrape; un post de ayer todavía no juntó sus interacciones y uno de hace 3 semanas sí. Regla:
//     ER por seguidor = (likes + comentarios) / seguidores, MEDIANA de los posts con ≥ 7 días. Si la
//     marca tiene ≥ 3 posts fotografiados a los 7 días (social_post_snapshots) usa ESE ER ("edad fija",
//     seguidores de ese momento). Sin base madura → mediana de todos, rotulado "preliminar".
//  2. PAUTA PROBABLE de la competencia: no hay dato cierto de pauta ajena (salvo `tipo = PAUTA` del
//     scraper). Modelo RELATIVO a la marca y red: views ≥ 3× su mediana con ≤ 1/3 de su interacción por
//     view (≥ 5× / ≤ 1/5 = alta). Mínimo 8 posts con views. Es probabilidad, nunca un hecho.
import { erAtAge, EDAD_COMPARABLE, type AgeSnap, type RedSnap } from "@/lib/post-snapshots-core";

export interface CompPost {
  red_social: string; url: string; marca: string; fecha: string | null;
  likes: number | null; comentarios: number | null; views: number | null;
  engagement: number | null; tipo?: string | null; interacciones?: number | null;
}

export const median = (a: number[]): number => {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y); const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};
const interOf = (p: CompPost) => p.interacciones ?? (Math.max(0, p.likes ?? 0) + Math.max(0, p.comentarios ?? 0));

export const ER_MIN_AGE_DAYS = 7;
export const ER_MIN_POSTS = 3;
export const ER_METODO_TXT = `Mediana del engagement por seguidor ((likes + comentarios) ÷ seguidores) de los posts con ${ER_MIN_AGE_DAYS}+ días de publicados`;
export const ER_METODO_EDAD_TXT = `Mediana del engagement por seguidor a los ${EDAD_COMPARABLE} días de publicado (seguidores de ese momento), del historial de fotos por edad`;

const isoDay = (f: string | null | undefined) => (f && /^\d{4}-\d{2}-\d{2}/.test(f) ? f.slice(0, 10) : null);
/** Fecha de referencia del dato: el post más reciente del set (proxy conservador del día del scrape). */
export function erRefDate(posts: CompPost[]): string | null {
  let max: string | null = null;
  for (const p of posts) { const d = isoDay(p.fecha); if (d && (!max || d > max)) max = d; }
  return max;
}
/** Último día (inclusive) de publicación que cuenta como "maduro" para una fecha de referencia. */
export function erCutoff(ref: string | null): string | null {
  if (!ref) return null;
  return new Date(Date.parse(`${ref}T00:00:00Z`) - ER_MIN_AGE_DAYS * 864e5).toISOString().slice(0, 10);
}
export const isMature = (p: CompPost, cutoff: string | null) => { const d = isoDay(p.fecha); return !!(d && cutoff && d <= cutoff); };

export type ErMetodo = "edad_fija" | "maduro" | "preliminar";
export interface ErComparable { value: number; n: number; metodo: ErMetodo; disponible: boolean }

export function comparableEr(posts: CompPost[], ref: string | null = erRefDate(posts)): ErComparable {
  const cutoff = erCutoff(ref);
  const withEr = posts.filter((p) => p.engagement != null);
  const mature = withEr.filter((p) => isMature(p, cutoff));
  if (mature.length >= ER_MIN_POSTS) return { value: median(mature.map((p) => p.engagement as number)), n: mature.length, metodo: "maduro", disponible: true };
  return { value: median(withEr.map((p) => p.engagement as number)), n: withEr.length, metodo: "preliminar", disponible: withEr.length > 0 };
}

/**
 * ER comparable por marca. Con `snaps` (fotos por edad) la marca con ≥ 3 posts a los 7 días usa ese ER
 * (misma edad para todas). Si no, mediana de posts maduros; si tampoco, preliminar.
 */
export function erComparablePorMarca(posts: CompPost[], snaps?: AgeSnap[] | null, red: string = "all", ref: string | null = erRefDate(posts)): Map<string, ErComparable> {
  const edad = snaps?.length ? erAtAge(snaps, EDAD_COMPARABLE, { red: red === "all" ? "all" : (red as RedSnap) }) : null;
  const out = new Map<string, ErComparable>();
  for (const m of new Set(posts.map((p) => p.marca))) {
    const fx = edad?.get(m);
    out.set(m, fx ? { value: fx.value, n: fx.n, metodo: "edad_fija", disponible: true } : comparableEr(posts.filter((p) => p.marca === m), ref));
  }
  return out;
}

/** Tendencia mensual (mediana) solo con posts maduros: el mes en curso no se subestima. */
export function trendMaduro(posts: CompPost[], ref: string | null = erRefDate(posts)): { mes: string; values: Record<string, number | null> }[] {
  const cutoff = erCutoff(ref);
  const byMonth = new Map<string, Map<string, number[]>>();
  for (const p of posts) {
    if (!p.fecha || p.engagement == null || !isMature(p, cutoff)) continue;
    const mes = p.fecha.slice(0, 7);
    const m = byMonth.get(mes) ?? new Map<string, number[]>();
    m.set(p.marca, [...(m.get(p.marca) ?? []), p.engagement]);
    byMonth.set(mes, m);
  }
  return [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([mes, bm]) => {
    const values: Record<string, number | null> = {};
    for (const [marca, e] of bm) values[marca] = median(e);
    return { mes, values };
  });
}

// ── Pauta probable ───────────────────────────────────────────────────────────
export const PAUTA_MIN_BASE = 8;
export type PautaProb = { nivel: "alta" | "media"; motivo: string };
export function probablePauta(posts: CompPost[]): Map<string, PautaProb> {
  const out = new Map<string, PautaProb>();
  const groups = new Map<string, CompPost[]>();
  for (const p of posts) {
    if (p.tipo === "PAUTA") { out.set(p.url, { nivel: "alta", motivo: "El scraper lo marca como patrocinado" }); continue; }
    if ((p.views ?? 0) <= 0) continue;
    const k = `${p.marca}|${p.red_social}`;
    groups.set(k, [...(groups.get(k) ?? []), p]);
  }
  for (const ps of groups.values()) {
    if (ps.length < PAUTA_MIN_BASE) continue;
    const ratio = (p: CompPost) => interOf(p) / Math.max(1, p.views ?? 0);
    const vMed = median(ps.map((p) => p.views ?? 0));
    const rMed = median(ps.map(ratio));
    if (vMed <= 0 || rMed <= 0) continue;
    for (const p of ps) {
      const v = (p.views ?? 0) / vMed, r = ratio(p) / rMed;
      if (v >= 3 && r <= 1 / 3) out.set(p.url, {
        nivel: v >= 5 && r <= 1 / 5 ? "alta" : "media",
        motivo: `${v.toFixed(1)}× las views medianas de la marca con ${Math.round(r * 100)}% de su tasa de interacción por view`,
      });
    }
  }
  return out;
}
export interface PautaMarca { marca: string; probables: number; alta: number; posts: number; share: number }
/** Resumen por marca: posts, probables pautados y share. Solo marcas con ≥ 1 probable. */
export function pautaPorMarca(posts: CompPost[], prob: Map<string, PautaProb> = probablePauta(posts)): PautaMarca[] {
  return [...new Set(posts.map((p) => p.marca))].map((m) => {
    const bp = posts.filter((p) => p.marca === m);
    const hits = bp.filter((p) => prob.has(p.url));
    return { marca: m, probables: hits.length, alta: hits.filter((p) => prob.get(p.url)!.nivel === "alta").length, posts: bp.length, share: bp.length ? Math.round((hits.length / bp.length) * 1000) / 10 : 0 };
  }).filter((x) => x.probables > 0).sort((a, b) => b.probables - a.probables);
}
