// Miniaturas de las piezas de DV360 (PURO, client-safe). Los NÚMEROS de DV360 siguen llegando por el reporte de
// OMD (Apps Script → dv360_creatives, solo trae el NOMBRE del creative). La imagen sale de la Display & Video 360
// API (solo lectura): el cron /api/cron/dv360-thumbs espeja cada creative al bucket `meta-thumbs` (dv360/<id>.jpg)
// y escribe un manifiesto `dv360/index.json` con {nombre → url}. Acá: normalización de nombres + matcheo.
// Test: cd apps/web && npx tsx scripts/dv360-thumbs.test.ts

export const DV360_ADVERTISER_ID = "8003891470"; // "Drean Argentina" (partner 7996192225 "Mabe Argentina")
export const DV360_THUMBS_PREFIX = "dv360";
export const DV360_MANIFEST_KEY = `${DV360_THUMBS_PREFIX}/index.json`;

export type Dv360ThumbType = "image" | "youtube";

export interface Dv360ThumbEntry {
  creativeId: string;
  name: string; // displayName tal cual DV360
  url: string; // URL pública del espejo en Supabase Storage
  w: number | null;
  h: number | null;
  type: Dv360ThumbType;
}

export interface Dv360ThumbManifest {
  generatedAt: string;
  advertiserId: string;
  items: Dv360ThumbEntry[];
}

export interface Dv360Thumb {
  url: string;
  w: number | null;
  h: number | null;
  type: Dv360ThumbType;
  via: "exacto" | "categoria+tamano";
}

/** Nombre comparable: minúsculas, sin acentos, × → x, sin el sufijo " - Banner", sin puntuación, espacios colapsados. */
export function normalizeCreativeName(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/×/g, "x")
    .replace(/\s*-\s*banner\s*$/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** "300x600" si el nombre trae un tamaño WxH (o null). */
export function sizeOf(s: string | null | undefined): string | null {
  const m = (s ?? "").match(/(\d{2,4})\s*[x×]\s*(\d{2,4})/i);
  return m ? `${parseInt(m[1]!, 10)}x${parseInt(m[2]!, 10)}` : null;
}

/** Categoría por palabra clave del nombre (lavado / refrigeracion / coccion) o null si no se puede decir. */
export function categoryOf(s: string | null | undefined): "lavado" | "refrigeracion" | "coccion" | null {
  const n = normalizeCreativeName(s);
  const hits = new Set<string>();
  if (/\b(lavado|lavarropas?|lavasecarropas|lavaseca)\b/.test(n)) hits.add("lavado");
  if (/\b(refri|refrigeracion|heladeras?|freezer)\b/.test(n)) hits.add("refrigeracion");
  if (/\b(coccion|cocinas?|air fryer|hornos?|anafe)\b/.test(n)) hits.add("coccion");
  if (hits.size !== 1) return null; // ambiguo o sin palabra clave → no arriesgar
  return [...hits][0] as "lavado" | "refrigeracion" | "coccion";
}

export interface Dv360ThumbIndex {
  byName: Map<string, Dv360ThumbEntry>;
  byCatSize: Map<string, Dv360ThumbEntry[]>;
}

export function buildThumbIndex(items: Dv360ThumbEntry[]): Dv360ThumbIndex {
  const byName = new Map<string, Dv360ThumbEntry>();
  const byCatSize = new Map<string, Dv360ThumbEntry[]>();
  for (const it of items) {
    const k = normalizeCreativeName(it.name);
    if (k && !byName.has(k)) byName.set(k, it);
    const cat = categoryOf(it.name);
    const size = sizeOf(it.name) ?? (it.w && it.h ? `${it.w}x${it.h}` : null);
    if (cat && size) {
      const key = `${cat}|${size}`;
      const arr = byCatSize.get(key) ?? [];
      // Mismo archivo con 2 creatives (misma url) cuenta como uno solo.
      if (!arr.some((a) => a.url === it.url)) arr.push(it);
      byCatSize.set(key, arr);
    }
  }
  return { byName, byCatSize };
}

/** 1) nombre normalizado exacto; 2) fallback conservador: misma categoría + mismo WxH y un ÚNICO candidato. */
export function matchThumb(name: string, idx: Dv360ThumbIndex): Dv360Thumb | null {
  const exact = idx.byName.get(normalizeCreativeName(name));
  if (exact) return { url: exact.url, w: exact.w, h: exact.h, type: exact.type, via: "exacto" };
  const cat = categoryOf(name);
  const size = sizeOf(name);
  if (!cat || !size) return null;
  const cands = idx.byCatSize.get(`${cat}|${size}`) ?? [];
  if (cands.length !== 1) return null;
  const c = cands[0]!;
  return { url: c.url, w: c.w, h: c.h, type: c.type, via: "categoria+tamano" };
}

/** Resuelve un set de nombres (los de dv360_creatives) → mapa nombre crudo → miniatura + los que no matchean. */
export function resolveThumbs(
  names: Iterable<string>,
  items: Dv360ThumbEntry[],
): { map: Record<string, Dv360Thumb>; unmatched: string[] } {
  const idx = buildThumbIndex(items);
  const map: Record<string, Dv360Thumb> = {};
  const unmatched: string[] = [];
  for (const n of new Set(names)) {
    if (!n || n === "Unknown") continue;
    const t = matchThumb(n, idx);
    if (t) map[n] = t;
    else unmatched.push(n);
  }
  return { map, unmatched: unmatched.sort() };
}

// ── Qué URL de imagen tiene cada creative de la API ──────────────────────────────────────────────
export interface Dv360ApiCreative {
  creativeId?: string;
  displayName?: string;
  creativeType?: string;
  hostingSource?: string;
  entityStatus?: string;
  dimensions?: { widthPixels?: number; heightPixels?: number };
  youtubeVideoId?: string;
  assets?: { asset?: { mediaId?: string; content?: string }; role?: string }[];
}

const IMG_EXT = /\.(jpe?g|png|gif|webp)(\?|$)/i;

/**
 * URLs candidatas (en orden) para bajar la miniatura de un creative. Imagen alojada en DV360/CM: el asset trae
 * `content = "/simgad/<n>"` (ruta de serving de Google) → tpc.googlesyndication.com y, de respaldo, s0.2mdn.net.
 * Video de YouTube: i.ytimg.com. Video alojado (mp4) o tags de terceros: sin miniatura.
 */
export function thumbCandidates(c: Dv360ApiCreative): { type: Dv360ThumbType; urls: string[] } | null {
  if (c.youtubeVideoId) {
    return { type: "youtube", urls: [`https://i.ytimg.com/vi/${c.youtubeVideoId}/hqdefault.jpg`] };
  }
  const assets = [...(c.assets ?? [])].sort((a, b) => rolePrio(a.role) - rolePrio(b.role));
  const urls: string[] = [];
  for (const a of assets) {
    const content = a.asset?.content?.trim();
    if (!content) continue;
    const simgad = content.match(/\/simgad\/(\d+)/);
    if (simgad) {
      urls.push(`https://tpc.googlesyndication.com/simgad/${simgad[1]}`, `https://s0.2mdn.net/simgad/${simgad[1]}`);
    } else if (/^https?:\/\//i.test(content) && IMG_EXT.test(content)) {
      urls.push(content);
    }
  }
  const uniq = [...new Set(urls)];
  return uniq.length ? { type: "image", urls: uniq } : null;
}

function rolePrio(role?: string): number {
  if (role === "ASSET_ROLE_MAIN") return 0;
  if (role === "ASSET_ROLE_BACKUP") return 1;
  return 2;
}
