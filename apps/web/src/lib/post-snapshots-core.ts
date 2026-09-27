// Historial de interacciones por EDAD del post (1, 3 y 7 días) — núcleo PURO y client-safe.
//
// Problema que resuelve (sesgo de maduración): los likes/comentarios de un post se leen en el
// momento del sync. Un post de ayer todavía no juntó sus interacciones y uno de hace 3 semanas sí;
// comparar posts de distinta edad sesga a favor de quien publica menos. Con una foto de cada post a
// una EDAD FIJA (p. ej. a los 7 días de publicado) todas las marcas se comparan en igualdad.
//
// Cómo se llena: cada sync (competencia IG por Business Discovery, diario; redes propias, cada 12 h)
// observa los posts recientes y, si la edad del post cae en la ventana de una edad objetivo, guarda la
// foto. La PRIMERA observación dentro de la ventana gana (insert sin pisar): con un sync diario cada
// post cae una vez en cada ventana. Tabla `social_post_snapshots` (migración 0115); sin ella no se
// guarda nada y todo sigue con el método anterior (mediana de posts con 7+ días).
// Portado del SaaS hermano (sep-2026). En Drean lo llenan: /api/cron/competencia-ig (Business Discovery
// + filas del scraper n8n/Apify fotografiadas con su `updated_at`) y el ig-sync (posts propios, con alcance).
// Sin imports de runtime: lo usan el cron, las señales y el tablero (cliente).

export type RedSnap = "INSTAGRAM" | "FACEBOOK" | "TIKTOK";
export const EDADES = [1, 3, 7] as const;
export type Edad = (typeof EDADES)[number];
/** Holgura de cada ventana (horas después de la edad objetivo). ≥ 24 h para que un sync diario la cubra. */
export const VENTANA_H: Record<Edad, number> = { 1: 24, 3: 48, 7: 72 };
/** Edad que usa la comparación competitiva (la misma que el corte de "post maduro"). */
export const EDAD_COMPARABLE: Edad = 7;
export const MIN_POSTS_EDAD = 3;

/** Foto de un post a una edad (lo que se guarda y lo que viaja al tablero, compacto). */
export interface AgeSnap {
  marca: string;
  red: RedSnap;
  post: string;          // clave estable del post (shortcode de IG o URL normalizada)
  edad: Edad;
  horas: number;         // edad real al observarlo (h)
  likes: number;
  comentarios: number;
  views: number | null;
  followers: number | null; // seguidores de la marca EN ESE MOMENTO (no los actuales)
  alcance?: number | null;  // solo posts propios (Graph)
}

/** Edades objetivo en cuya ventana cae un post con `ageHours` de vida. */
export function bucketsFor(ageHours: number): Edad[] {
  if (!Number.isFinite(ageHours) || ageHours < 0) return [];
  return EDADES.filter((e) => ageHours >= e * 24 && ageHours < e * 24 + VENTANA_H[e]);
}

/** Clave estable del post: shortcode de IG (/p/, /reel/, /tv/) o la URL sin protocolo, query ni barra final. */
export function postKey(url: string | null | undefined): string {
  const u = String(url ?? "").trim();
  const m = u.match(/instagram\.com\/(?:[^/]+\/)?(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/i);
  if (m) return `ig:${m[1]}`;
  return u.toLowerCase().replace(/^https?:\/\//, "").replace(/^(www\.|m\.|web\.)/, "").replace(/[?#].*$/, "").replace(/\/+$/, "");
}

/** Momento de publicación (ms). Con solo fecha (YYYY-MM-DD) se asume el mediodía de Argentina. */
export function publishedMs(ts: string | null | undefined, fecha: string | null | undefined): number | null {
  if (ts) { const t = Date.parse(ts); if (Number.isFinite(t)) return t; }
  if (fecha && /^\d{4}-\d{2}-\d{2}/.test(fecha)) { const t = Date.parse(`${fecha.slice(0, 10)}T12:00:00-03:00`); if (Number.isFinite(t)) return t; }
  return null;
}

export interface SnapInputPost {
  marca: string; red: RedSnap; url: string; ts?: string | null; fecha?: string | null;
  likes: number | null; comentarios: number | null; views?: number | null; followers?: number | null; alcance?: number | null;
}
/** Filas a guardar en esta observación: una por (post, edad) cuya ventana contiene la edad actual. */
export function snapshotRows(posts: SnapInputPost[], observedAt: Date): AgeSnap[] {
  const now = observedAt.getTime();
  const out: AgeSnap[] = [];
  for (const p of posts) {
    const t = publishedMs(p.ts, p.fecha);
    if (t == null) continue;
    const horas = (now - t) / 3_600_000;
    for (const edad of bucketsFor(horas)) {
      out.push({
        marca: p.marca, red: p.red, post: postKey(p.url), edad, horas: Math.round(horas * 10) / 10,
        likes: Math.max(0, Math.round(p.likes ?? 0)), comentarios: Math.max(0, Math.round(p.comentarios ?? 0)),
        views: p.views != null && p.views > 0 ? Math.round(p.views) : null,
        followers: p.followers != null && p.followers > 0 ? Math.round(p.followers) : null,
        ...(p.alcance != null ? { alcance: Math.round(p.alcance) } : {}),
      });
    }
  }
  return out;
}

const median = (a: number[]): number => {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y); const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

/** ER por seguidor (%) de una foto: (likes + comentarios) / seguidores del momento. null sin seguidores. */
export const snapEr = (s: AgeSnap): number | null => (s.followers && s.followers > 0 ? ((s.likes + s.comentarios) / s.followers) * 100 : null);

export interface ErEdad { marca: string; edad: Edad; value: number; n: number }
/** Mediana del ER a edad fija por marca (solo marcas con ≥ MIN_POSTS_EDAD posts con foto a esa edad). */
export function erAtAge(snaps: AgeSnap[], edad: Edad = EDAD_COMPARABLE, opts: { red?: RedSnap | "all"; minPosts?: number } = {}): Map<string, ErEdad> {
  const min = opts.minPosts ?? MIN_POSTS_EDAD;
  const by = new Map<string, Map<string, number>>(); // marca → post → er (un valor por post)
  for (const s of snaps) {
    if (s.edad !== edad) continue;
    if (opts.red && opts.red !== "all" && s.red !== opts.red) continue;
    const e = snapEr(s);
    if (e == null) continue;
    const m = by.get(s.marca) ?? new Map<string, number>();
    if (!m.has(`${s.red}|${s.post}`)) m.set(`${s.red}|${s.post}`, e);
    by.set(s.marca, m);
  }
  const out = new Map<string, ErEdad>();
  for (const [marca, m] of by) {
    const vals = [...m.values()];
    if (vals.length >= min) out.set(marca, { marca, edad, value: median(vals), n: vals.length });
  }
  return out;
}

/** Curva de maduración de una marca: mediana de interacciones a 1, 3 y 7 días (posts con las 3 fotos). */
export function maduracion(snaps: AgeSnap[], marca: string): { edad: Edad; interacciones: number; pctDe7: number | null }[] | null {
  const byPost = new Map<string, Partial<Record<Edad, number>>>();
  for (const s of snaps) {
    if (s.marca !== marca) continue;
    const k = `${s.red}|${s.post}`;
    const r = byPost.get(k) ?? {};
    if (r[s.edad] == null) r[s.edad] = s.likes + s.comentarios;
    byPost.set(k, r);
  }
  const full = [...byPost.values()].filter((r) => r[1] != null && r[3] != null && r[7] != null);
  if (full.length < MIN_POSTS_EDAD) return null;
  const med7 = median(full.map((r) => r[7]!));
  return EDADES.map((e) => { const v = median(full.map((r) => r[e]!)); return { edad: e, interacciones: v, pctDe7: med7 > 0 ? Math.round((v / med7) * 1000) / 10 : null }; });
}
