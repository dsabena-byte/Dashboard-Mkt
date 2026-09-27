// Stories de Instagram — núcleo PURO (client-safe). Portado del SaaS hermano (sep-2026) y adaptado a
// Drean, que YA captura las Stories vigentes cada 6 h en `meta_posts` (media_type STORY, ig-sync).
//
// Lo nuevo:
//  · `navigation` con breakdown story_navigation_action_type (tap_forward / tap_back / tap_exit /
//    swipe_forward) + replies/shares/visitas al perfil por separado → se guardan en `meta_posts.raw`
//    (jsonb, sin migración) como `{ story: { replies, shares, profile_visits, nav } }`.
//  · Acumulación por MÁXIMO: el alcance de una Story solo crece hasta que caduca (24 h). Una lectura
//    posterior con menos (error, -1 de Meta para valores < 5) nunca pisa lo ya visto → `mergeStoryMax`.
//  · Resumen mensual (mediana de alcance, tasa de salida y de respuesta) para la tarjeta bajo IG.
// Una Story capturada a las pocas horas queda con el alcance de ese momento → los números son un piso.

export interface StoryNav { tapsForward?: number; tapsBack?: number; exits?: number; swipeForward?: number }
export interface StoryExtra { replies?: number; shares?: number; profile_visits?: number; nav?: StoryNav | null }

const pos = (x: unknown) => { const v = Number(x); return Number.isFinite(v) && v > 0 ? v : 0; };

/** Navegación de una Story desde la respuesta de insights con breakdown story_navigation_action_type. */
export function parseNavigation(json: any): StoryNav | null {
  const data: unknown[] = Array.isArray(json?.data) ? json.data : [];
  const row = data.find((r: any) => r?.name === "navigation") as any;
  const res = row?.total_value?.breakdowns?.[0]?.results;
  if (!Array.isArray(res)) return null;
  const out: StoryNav = {};
  for (const r of res) {
    const k = String(r?.dimension_values?.[0] ?? "").toLowerCase();
    if (k === "tap_forward") out.tapsForward = pos(r.value);
    else if (k === "tap_back") out.tapsBack = pos(r.value);
    else if (k === "tap_exit") out.exits = pos(r.value);
    else if (k === "swipe_forward") out.swipeForward = pos(r.value);
  }
  return out;
}

export interface StoryMetricRow {
  post_id: string;
  reach: number;
  video_views: number;
  engagement: number;
  clicks: number;
  raw?: { story?: StoryExtra } | null;
}
const mx = (a?: number, b?: number) => (a == null && b == null ? undefined : Math.max(a ?? 0, b ?? 0));
/** Une la lectura nueva con la guardada quedándose con el MÁXIMO de cada métrica (nunca pisa con menos). */
export function mergeStoryMax<T extends StoryMetricRow>(prev: StoryMetricRow | null | undefined, next: T): T {
  if (!prev) return next;
  const a = prev.raw?.story ?? {}, b = next.raw?.story ?? {};
  const nav = a.nav || b.nav ? {
    tapsForward: mx(a.nav?.tapsForward, b.nav?.tapsForward), tapsBack: mx(a.nav?.tapsBack, b.nav?.tapsBack),
    exits: mx(a.nav?.exits, b.nav?.exits), swipeForward: mx(a.nav?.swipeForward, b.nav?.swipeForward),
  } : null;
  return {
    ...next,
    reach: Math.max(prev.reach ?? 0, next.reach ?? 0),
    video_views: Math.max(prev.video_views ?? 0, next.video_views ?? 0),
    engagement: Math.max(prev.engagement ?? 0, next.engagement ?? 0),
    clicks: Math.max(prev.clicks ?? 0, next.clicks ?? 0),
    raw: { ...(prev.raw ?? {}), ...(next.raw ?? {}), story: { replies: mx(a.replies, b.replies), shares: mx(a.shares, b.shares), profile_visits: mx(a.profile_visits, b.profile_visits), nav } },
  };
}

const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const k = Math.floor(s.length / 2);
  return s.length % 2 ? s[k]! : (s[k - 1]! + s[k]!) / 2;
};
const MES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export interface StoryLite { id: string; timestamp: string; reach: number; views: number; replies: number | null; exits: number | null }
/** Fila de meta_posts (STORY) → Story liviana. Respuestas: `raw.story.replies` si está (desde sep-2026). */
export function storyFromRow(r: { post_id: string; fecha_post: string; reach: number | null; video_views: number | null; raw?: { story?: StoryExtra } | null }): StoryLite {
  const s = r.raw?.story;
  return { id: r.post_id, timestamp: r.fecha_post, reach: r.reach ?? 0, views: r.video_views ?? 0, replies: s?.replies ?? null, exits: s?.nav?.exits ?? null };
}

export interface StoriesMes { mes: string; key: string; stories: number; alcanceMediana: number; alcanceTotal: number; tasaSalida: number | null; tasaRespuesta: number | null }
export interface StoriesResumen { total: number; alcanceMediana: number; tasaSalida: number | null; tasaRespuesta: number | null; porMes: StoriesMes[]; desde: string | null; conNavegacion: number }

/** Resumen por mes (hora AR). Tasa de salida = salidas ÷ vistas; tasa de respuesta = respuestas ÷ alcance. */
export function summarizeStories(stories: StoryLite[]): StoriesResumen | null {
  if (!stories.length) return null;
  const by = new Map<string, StoryLite[]>();
  for (const s of stories) {
    const d = new Date(Date.parse(s.timestamp) - 3 * 3600_000);
    if (Number.isNaN(d.getTime())) continue;
    const k = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    by.set(k, [...(by.get(k) ?? []), s]);
  }
  const rate = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 1000) / 10 : null);
  const tasas = (xs: StoryLite[]) => {
    const nav = xs.filter((s) => s.exits != null);
    const rep = xs.filter((s) => s.replies != null);
    return {
      tasaSalida: nav.length ? rate(nav.reduce((a, s) => a + (s.exits ?? 0), 0), nav.reduce((a, s) => a + s.views, 0)) : null,
      tasaRespuesta: rep.length ? rate(rep.reduce((a, s) => a + (s.replies ?? 0), 0), rep.reduce((a, s) => a + s.reach, 0)) : null,
    };
  };
  const porMes: StoriesMes[] = [...by.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, xs]) => ({
    mes: `${MES[Number(k.slice(5, 7)) - 1]} ${k.slice(2, 4)}`, key: k, stories: xs.length,
    alcanceMediana: median(xs.map((s) => s.reach)), alcanceTotal: xs.reduce((a, s) => a + s.reach, 0), ...tasas(xs),
  }));
  return {
    total: stories.length, alcanceMediana: median(stories.map((s) => s.reach)), ...tasas(stories), porMes,
    desde: [...stories].sort((a, b) => a.timestamp.localeCompare(b.timestamp))[0]?.timestamp.slice(0, 10) ?? null,
    conNavegacion: stories.filter((s) => s.exits != null).length,
  };
}
