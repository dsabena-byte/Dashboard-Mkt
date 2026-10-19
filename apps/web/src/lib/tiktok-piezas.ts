// Piezas de TikTok Ads (puro, client-safe). Portado de bip-platform/lib/tiktok-piezas.ts.
// El cron tiktok-sync arma un manifiesto (bucket público `meta-thumbs`, sin migración) con las métricas por
// anuncio × mes y la portada espejada; /performance lo lee y lo muestra con PiezaGrid.

export const TIKTOK_MANIFEST_KEY = "tiktok/index.json";

export interface TTAd {
  ad_id?: string | number;
  video_id?: string | null;
  image_ids?: string[] | null;
  tiktok_item_id?: string | null; // Spark Ad: el post orgánico que se pauta
  operation_status?: string | null; // ENABLE | DISABLE
}

export interface PiezaTT { thumbnail: string | null; permalink: string | null; active: boolean | null; sparkItem: string | null }

/** Portada de cada anuncio: video del anuncio → 1ª imagen → (Spark Ad) post orgánico vía oEmbed (lo resuelve el server). */
export function piezaDe(ad: TTAd, videoCover: Map<string, string>, imageUrl: Map<string, string>): PiezaTT {
  const vid = ad.video_id ? videoCover.get(String(ad.video_id)) ?? null : null;
  const img = (ad.image_ids ?? []).map((i) => imageUrl.get(String(i))).find(Boolean) ?? null;
  const item = ad.tiktok_item_id ? String(ad.tiktok_item_id) : null;
  const st = ad.operation_status?.toUpperCase();
  return {
    thumbnail: vid ?? img,
    // Solo el post de un Spark Ad tiene URL pública estable; el preview_url de la biblioteca vence.
    permalink: item ? `https://www.tiktok.com/video/${item}` : null,
    active: st === "ENABLE" ? true : st === "DISABLE" ? false : null,
    sparkItem: !vid && !img ? item : null,
  };
}

export function chunks<T>(xs: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n));
  return out;
}

/** Una pieza en un mes (mes = "YYYY-MM"). Montos en ARS (moneda de la cuenta). */
export interface TikTokPiezaMes {
  ad_id: string;
  mes: string;
  ad_name: string;
  campaign: string;
  categoria: string;
  objetivo: string;
  inv: number;
  impr: number;
  clicks: number;
  alcance: number;
  views: number;
  p100: number;
  likes: number;
  comments: number;
  shares: number;
  img: string | null;
  link: string | null;
  activa: boolean | null;
}

/** Suma por anuncio los meses que pasan el filtro (meses = "YYYY-MM"; vacío = todos) y arma las tarjetas de PiezaGrid. */
export function tiktokCards(
  items: TikTokPiezaMes[],
  f: { meses?: Set<string>; cats?: string[]; roles?: string[] } = {},
) {
  const acc = new Map<string, TikTokPiezaMes>();
  for (const p of items) {
    if (f.meses?.size && !f.meses.has(p.mes)) continue;
    if (f.cats?.length && !f.cats.includes(p.categoria)) continue;
    if (f.roles?.length && !f.roles.includes(p.objetivo)) continue;
    const a = acc.get(p.ad_id);
    acc.set(p.ad_id, a ? { ...a, inv: a.inv + p.inv, impr: a.impr + p.impr, clicks: a.clicks + p.clicks, alcance: a.alcance + p.alcance,
      views: a.views + p.views, p100: a.p100 + p.p100, likes: a.likes + p.likes, comments: a.comments + p.comments, shares: a.shares + p.shares } : { ...p });
  }
  return [...acc.values()].sort((a, b) => b.inv - a.inv).map((p) => ({
    id: `tiktok-${p.ad_id}`, titulo: p.ad_name, categoria: p.categoria, badges: [p.objetivo], img: p.img, link: p.link,
    inv: p.inv, impr: p.impr, alcance: p.alcance || null, frecuencia: p.alcance ? p.impr / p.alcance : null, clicks: p.clicks,
    ctr: p.impr ? (p.clicks / p.impr) * 100 : null, cpm: p.impr ? (p.inv / p.impr) * 1000 : null,
    viewsCompl: p.p100 || null, vtr: p.views ? (p.p100 / p.views) * 100 : null, activa: p.activa,
    engagement: { reactions: p.likes, comments: p.comments, shares: p.shares },
  }));
}

export interface TikTokManifest { at: string; advertiser: string[]; items: TikTokPiezaMes[] }
