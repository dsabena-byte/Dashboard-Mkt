// Facebook orgánico vs pago — núcleo PURO (client-safe, sin imports de runtime). Portado del SaaS
// hermano (sep-2026).
//
// Qué da la API (developers.facebook.com bloqueado desde el sandbox → leído vía buscador: blog de
// Meta "Page Insights API updates" 15-ago-2025 + referencias de conectores; NO verificado contra la
// API real de Drean):
//  · `post_impressions_paid/organic` se reemplazan por **`post_media_view` con
//    `breakdown=is_from_ads`** (0 = orgánico, 1 = pago), período lifetime. Es la única separación
//    pago/orgánico que sobrevive: el alcance único (`post_total_media_view_unique`) NO se separa.
//  · El formato de la respuesta con breakdown no está documentado de forma estable → se parsean las 3
//    formas vistas (values[] con la clave del breakdown, total_value.breakdowns[].results[] con
//    dimension_values, y value como objeto {"0":x,"1":y}).
//  · Se usa la PROPORCIÓN pago/(pago+orgánico) del propio breakdown, nunca se mezcla con el total.
//
// En Drean (CLAUDE.md → "FB REACH = DATO NO CONFIABLE"): este dato es una señal ADICIONAL. Un post es
// pautado si la API dice ≥ PAID_SHARE_MIN de vistas pagas **o** si cae en `isPaidOutlier` (reach
// fuera de escala con engagement casi nulo). La heurística NUNCA se apaga: la API solo puede sumar
// posts pautados, no "destapar" uno que la heurística ya filtró.

export const PAID_SHARE_MIN = 0.5;
/** Solo se consulta el breakdown para posts de los últimos N días (el sync los refresca). */
export const PAID_SPLIT_DAYS = 120;

export interface ViewsSplit { organic: number; paid: number }

const n = (x: unknown): number => { const v = Number(x); return Number.isFinite(v) ? v : 0; };
const isPaidKey = (k: unknown) => ["1", "true", "paid"].includes(String(k).toLowerCase());
const isOrgKey = (k: unknown) => ["0", "false", "organic", "unpaid"].includes(String(k).toLowerCase());

/** Vistas orgánicas y pagas de /{post}/insights?metric=post_media_view&breakdown=is_from_ads. */
export function parseIsFromAds(json: any): ViewsSplit | null {
  const rows: any[] = Array.isArray(json?.data) ? json.data : [];
  let organic = 0, paid = 0, seen = false;
  const add = (key: unknown, value: unknown) => {
    if (isPaidKey(key)) { paid += n(value); seen = true; } else if (isOrgKey(key)) { organic += n(value); seen = true; }
  };
  for (const row of rows) {
    if (row?.name && !String(row.name).startsWith("post_media_view")) continue;
    // Si Meta devuelve lifetime y day, se toma lifetime.
    if (row?.period && row.period !== "lifetime" && rows.some((r) => r?.period === "lifetime")) continue;
    // Forma A: total_value.breakdowns[].results[{dimension_values:["1"], value}]
    for (const b of row?.total_value?.breakdowns ?? []) {
      const keys: string[] = (b?.dimension_keys ?? []).map(String);
      const idx = Math.max(0, keys.indexOf("is_from_ads"));
      for (const r of b?.results ?? []) add(r?.dimension_values?.[idx], r?.value);
    }
    for (const v of Array.isArray(row?.values) ? row.values : []) {
      // Forma B: values[{value: 298, is_from_ads: "0"}]
      if (v && v.is_from_ads !== undefined) { add(v.is_from_ads, v.value); continue; }
      // Forma C: values[{value: {"0": 298, "1": 600}}]
      if (v?.value && typeof v.value === "object") for (const [k, x] of Object.entries(v.value)) add(k, x);
    }
  }
  return seen ? { organic, paid } : null;
}

export const paidShare = (s: ViewsSplit | null | undefined): number | null => {
  if (!s) return null;
  const t = s.organic + s.paid;
  return t > 0 ? s.paid / t : null;
};

/** Heurística histórica de Drean (lib/meta-fb-queries.ts): reach > 20k con reacciones/reach < 1%. */
export const isPaidOutlierFb = (p: { reach?: number | null; reactions?: number | null }) =>
  (p.reach ?? 0) > 20000 && (p.reactions ?? 0) / (p.reach || 1) < 0.01;

/** Post pautado = API (≥50% de vistas desde anuncios) O heurística. Devuelve también la fuente. */
export function fbPaidDecision(p: { reach?: number | null; reactions?: number | null; views_split?: ViewsSplit | null }): { paid: boolean; source: "api" | "heuristica" | null } {
  const share = paidShare(p.views_split ?? null);
  if (share != null && share >= PAID_SHARE_MIN) return { paid: true, source: "api" };
  if (isPaidOutlierFb(p)) return { paid: true, source: "heuristica" };
  return { paid: false, source: null };
}

/** Totales de vistas orgánicas/pagas de los posts con dato de la API (null si ninguno lo tiene). */
export function viewsSplitTotals(posts: { views_split?: ViewsSplit | null }[]): { organic: number; paid: number; posts: number } | null {
  const w = posts.filter((p) => p.views_split && (p.views_split.organic + p.views_split.paid) > 0);
  if (!w.length) return null;
  return { organic: w.reduce((s, p) => s + (p.views_split?.organic ?? 0), 0), paid: w.reduce((s, p) => s + (p.views_split?.paid ?? 0), 0), posts: w.length };
}

/** Lee `raw.views_split` (jsonb de meta_posts) de forma defensiva. */
export function readViewsSplit(v: unknown): ViewsSplit | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const organic = Number(o.organic), paid = Number(o.paid);
  return Number.isFinite(organic) && Number.isFinite(paid) ? { organic, paid } : null;
}
