// ============================================================================
// KPIs de MERCADO Y COMPETENCIA (puro, client-safe: sin server-only). Portado de BIP
// (lib/mercado-kpis.ts) y adaptado a las tablas de Drean. Una sola definición para el
// Mapa/Seguimiento (lib/objetivos-kpis → getSeguimientoKpis), el bloque de metas de
// /seo-search y la sección de Share of engagement de /redes.
//
//  · Share of Search     = volumen de búsqueda de Drean ÷ volumen del set competitivo
//                          (vw_share_of_search, mensual). Total = Σ vol Drean ÷ Σ vol set de
//                          las 3 categorías (promedio PONDERADO por volumen, = BIP).
//                          Por categoría: lavarropas→Lavado, heladeras→Refrigeración, cocinas→Cocción.
//  · Share of engagement = interacciones (likes + comentarios) de @dreanargentina ÷ las de
//                          todo el set competitivo (social_posts, IG+FB), en la VENTANA COMÚN
//                          que todas las marcas tienen completa (shareOfEngagement de
//                          lib/signals/model, misma función que la señal cruce_soe_*). Total-only.
//  · Visibilidad en IA   = share de menciones de Drean en respuestas de IA (seo_llmo), por
//                          categoría. Se ignoran corridas sin prompts (sep-2026 vino todo en 0).
//                          Total = Σ categoría × peso de negocio (CATEGORIA_PESOS 62/35/3,
//                          renormalizado a las categorías con dato) — mismo "General" que Floor Share.
//  · Índice de posición  = posición promedio en Google ponderada por volumen de las keywords
//    SEO                   del universo (seo_index_history, 100 = no rankea). MENOR ES MEJOR
//                          (dirección "down"). Total = Σ categoría × peso de negocio (idem IA).
// IA e índice son FOTOS: se registran en el mes del relevamiento (incluso el mes en curso).
// SoS y SoE son mensuales: solo meses CERRADOS (el mes en curso es parcial), como el resto
// del Seguimiento.
// ============================================================================
import { shareOfEngagement, type CompetitorPost, type ShareEngagement, type Red } from "@/lib/signals/model";
import { CATEGORIA_PESOS } from "@/lib/categorias";
import type { Direccion } from "@/lib/metas";

export const MERCADO_PLAN = "Mercado y competencia";

export type MercadoUnidad = "%" | "pts";
export interface MercadoKpiSpec {
  key: string; // clave EXACTA del KPI (Mapa + kpi_meta_valores)
  label: string;
  medida: string;
  unidad: MercadoUnidad;
  direccion: Direccion;
}

export const MERCADO_KPIS: MercadoKpiSpec[] = [
  { key: "Share of Search", label: "Share of Search", medida: "Búsquedas de Drean ÷ búsquedas del set competitivo", unidad: "%", direccion: "up" },
  { key: "Share of engagement", label: "Share of engagement", medida: "Interacciones de Drean ÷ las del set (IG+FB)", unidad: "%", direccion: "up" },
  { key: "Visibilidad en IA", label: "Visibilidad en IA", medida: "Menciones de Drean en respuestas de IA ÷ total", unidad: "%", direccion: "up" },
  { key: "Índice de posición SEO", label: "Índice de posición SEO", medida: "Posición media en Google ponderada por volumen (menor es mejor)", unidad: "pts", direccion: "down" },
];
export const MERCADO_KPI_KEYS = MERCADO_KPIS.map((k) => k.key);

// Categoría de la data SEO → categoría core del negocio.
export const SEO_CAT_TO_CORE: Record<string, string> = { lavarropas: "Lavado", heladeras: "Refrigeración", cocinas: "Cocción" };
const CORE = ["Lavado", "Refrigeración", "Cocción"] as const;

// ── Formas de entrada (filas crudas de Drean, mínimas) ──
export interface SosRowLite { categoria: string; marca: string; mes: string; vol: number | null }
export interface LlmoRowLite { categoria: string; marca: string; mes: string; prompts: number | null; share_pct: number | null }
export interface IdxRowLite { categoria: string; marca: string; mes: string; indice: number | null }
export interface SocialRowLite { marca: string; red_social: string; fecha: string | null; likes: number | null; comentarios: number | null; url?: string | null }

export interface MercadoInputs {
  ownBrand: string; // label de la marca propia en la data SEO/IA ("Drean")
  ownSocialKey: string; // handle propio en social_posts ("dreanargentina")
  socialLabels: Record<string, string>; // handle → label
  sos: SosRowLite[];
  llmo: LlmoRowLite[];
  idx: IdxRowLite[];
  social: SocialRowLite[];
}

export interface MercadoSerie {
  key: string;
  realM: (number | null)[]; // 12 (índice 0 = enero)
  realCatM?: Record<string, (number | null)[]>; // Lavado/Refrigeración/Cocción
  // Numerador/denominador mensual (solo KPIs de volumen: SoS, SoE) → YTD = Σnum ÷ Σden.
  // Sin esto (fotos: IA, índice) el YTD es el promedio de los relevamientos.
  numM?: (number | null)[];
  denM?: (number | null)[];
  fuente: string;
  nota?: string | null; // aviso de calidad de dato (ej. corrida de IA vacía)
}

export interface MercadoResult {
  series: Record<string, MercadoSerie>;
  soe: ShareEngagement | null; // detalle del share of engagement (para la UI de /redes)
  iaCorridaVacia: string | null; // "YYYY-MM" de la última corrida de IA sin prompts (se ignoró), si la hay
}

const f12 = () => Array.from({ length: 12 }, () => null as number | null);
const ym = (s: string | null | undefined) => String(s ?? "").slice(0, 7);
const n0 = (v: unknown) => (v == null ? 0 : Number(v) || 0);
const idxOf = (mes: string, anio: number): number => {
  const [y, m] = ym(mes).split("-").map(Number);
  return y === anio && m != null && m >= 1 && m <= 12 ? m - 1 : -1;
};

/** Σ categoría × peso de negocio, RENORMALIZADO a las categorías con dato (no sesga si falta una). */
export function ponderadoNegocio(porCat: Record<string, number | null | undefined>): number | null {
  let s = 0, w = 0;
  for (const c of CORE) {
    const v = porCat[c];
    const p = CATEGORIA_PESOS[c] ?? 0;
    if (v != null && Number.isFinite(v) && p > 0) { s += v * p; w += p; }
  }
  return w > 0 ? s / w : null;
}

/** Posts de social_posts → forma CompetitorPost (lo mínimo que usa shareOfEngagement). */
export function toCompetitorPosts(rows: SocialRowLite[], labels: Record<string, string>): CompetitorPost[] {
  return rows.map((p) => ({
    red_social: p.red_social as Red, url: p.url ?? "", marca: labels[p.marca] ?? p.marca, fecha: p.fecha ? p.fecha.slice(0, 10) : null,
    pilar: null, positivo: null, negativo: null, neutro: null, resumen_sentimiento: null,
    likes: p.likes, comentarios: p.comentarios, views: null, engagement: null, interacciones: n0(p.likes) + n0(p.comentarios),
    tipo: null, content_type: null, followers: null, thumbnail_url: null, copy: null,
  }));
}

/**
 * Series reales [12] del año de los 4 KPIs de mercado (+ desglose por categoría cuando la
 * fuente lo tiene). `currentMonth` 1-12 (13 = año cerrado): SoS/SoE solo meses < currentMonth.
 */
export function buildMercadoSeries(anio: number, currentMonth: number, inp: MercadoInputs): MercadoResult {
  const closed = (i: number) => i + 1 < currentMonth;
  const own = (m: string) => m.trim().toLowerCase() === inp.ownBrand.trim().toLowerCase();

  // ── Share of Search (volumen) ──
  const sosTot = Array.from({ length: 12 }, () => ({ own: 0, tot: 0 }));
  const sosCat: Record<string, { own: number; tot: number }[]> = {};
  for (const r of inp.sos) {
    const i = idxOf(r.mes, anio);
    const core = SEO_CAT_TO_CORE[r.categoria];
    if (i < 0 || !closed(i)) continue;
    const v = n0(r.vol);
    sosTot[i]!.tot += v;
    if (own(r.marca)) sosTot[i]!.own += v;
    if (core) {
      const arr = (sosCat[core] ??= Array.from({ length: 12 }, () => ({ own: 0, tot: 0 })));
      arr[i]!.tot += v;
      if (own(r.marca)) arr[i]!.own += v;
    }
  }
  const pct = (e: { own: number; tot: number }) => (e.tot > 0 ? (e.own / e.tot) * 100 : null);
  const sosRealM = sosTot.map(pct);
  const sosCatM: Record<string, (number | null)[]> = {};
  for (const c of CORE) sosCatM[c] = (sosCat[c] ?? []).length ? sosCat[c]!.map(pct) : f12();

  // ── Share of engagement (ventana común, mensual) ──
  const posts = toCompetitorPosts(inp.social, inp.socialLabels);
  const ownSocialLabel = inp.socialLabels[inp.ownSocialKey] ?? inp.ownSocialKey;
  const soe = shareOfEngagement(posts, ownSocialLabel);
  const soeRealM = f12(), soeNum = f12(), soeDen = f12();
  for (const m of soe?.mensual ?? []) {
    const i = idxOf(m.mes, anio);
    if (i >= 0 && closed(i)) { soeRealM[i] = m.share; soeNum[i] = m.propio; soeDen[i] = m.total; }
  }

  // ── Visibilidad en IA (fotos por categoría; se ignoran corridas sin prompts) ──
  const iaCat: Record<string, (number | null)[]> = { Lavado: f12(), Refrigeración: f12(), Cocción: f12() };
  const mesesConPrompts = new Set(inp.llmo.filter((l) => n0(l.prompts) > 0).map((l) => ym(l.mes)));
  const mesesLlmo = [...new Set(inp.llmo.map((l) => ym(l.mes)))].sort();
  const ultimoLlmo = mesesLlmo[mesesLlmo.length - 1] ?? null;
  const iaCorridaVacia = ultimoLlmo && !mesesConPrompts.has(ultimoLlmo) ? ultimoLlmo : null;
  for (const l of inp.llmo) {
    if (!own(l.marca) || n0(l.prompts) <= 0) continue;
    const i = idxOf(l.mes, anio); const core = SEO_CAT_TO_CORE[l.categoria];
    if (i < 0 || !core) continue;
    iaCat[core]![i] = n0(l.share_pct);
  }
  const iaRealM = Array.from({ length: 12 }, (_, i) => ponderadoNegocio({ Lavado: iaCat.Lavado![i], Refrigeración: iaCat.Refrigeración![i], Cocción: iaCat.Cocción![i] }));

  // ── Índice de posición SEO (fotos mensuales por categoría) ──
  const ixCat: Record<string, (number | null)[]> = { Lavado: f12(), Refrigeración: f12(), Cocción: f12() };
  for (const r of inp.idx) {
    if (!own(r.marca) || r.indice == null) continue;
    const i = idxOf(r.mes, anio); const core = SEO_CAT_TO_CORE[r.categoria];
    if (i < 0 || !core) continue;
    ixCat[core]![i] = Number(r.indice);
  }
  const ixRealM = Array.from({ length: 12 }, (_, i) => ponderadoNegocio({ Lavado: ixCat.Lavado![i], Refrigeración: ixCat.Refrigeración![i], Cocción: ixCat.Cocción![i] }));

  const series: Record<string, MercadoSerie> = {
    "Share of Search": { key: "Share of Search", realM: sosRealM, realCatM: sosCatM,
      numM: sosTot.map((e) => (e.tot > 0 ? e.own : null)), denM: sosTot.map((e) => (e.tot > 0 ? e.tot : null)),
      fuente: "DataForSEO · vw_share_of_search (volumen mensual, 3 categorías)" },
    "Share of engagement": {
      key: "Share of engagement", realM: soeRealM, numM: soeNum, denM: soeDen, fuente: "social_posts (IG+FB, likes + comentarios, set competitivo)",
      nota: soe ? `Ventana común ${soe.desde} → ${soe.hasta}` : "Sin ventana común suficiente (≥14 días con posts de todas las marcas).",
    },
    "Visibilidad en IA": {
      key: "Visibilidad en IA", realM: iaRealM, realCatM: iaCat, fuente: "seo_llmo (share of model por categoría)",
      nota: iaCorridaVacia ? `La corrida de ${iaCorridaVacia} vino vacía (0 prompts): se usa el último relevamiento válido.` : null,
    },
    "Índice de posición SEO": { key: "Índice de posición SEO", realM: ixRealM, realCatM: ixCat, fuente: "seo_index_history (snapshot mensual del SERP)" },
  };
  return { series, soe, iaCorridaVacia };
}

/** Último índice (0-11) con dato de una serie, o -1. */
export function lastIdx(s: (number | null)[]): number {
  for (let i = 11; i >= 0; i--) if (s[i] != null) return i;
  return -1;
}

/** Real YTD hasta `upto` (incl.): Σnum÷Σden si la serie trae volúmenes; si no, promedio de los meses con dato. */
export function realYtd(s: MercadoSerie, upto: number): number | null {
  if (upto < 0) return null;
  if (s.numM && s.denM) {
    let n = 0, d = 0;
    for (let i = 0; i <= upto; i++) if (s.numM[i] != null && s.denM[i] != null) { n += s.numM[i]!; d += s.denM[i]!; }
    return d > 0 ? (n / d) * 100 : null;
  }
  const xs = s.realM.slice(0, upto + 1).filter((v): v is number => v != null);
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}
/** Meta YTD de un KPI tasa = promedio de las metas cargadas hasta `upto` (incl.). */
export function metaYtd(valores: (number | null)[], upto: number): number | null {
  if (upto < 0) return null;
  const xs = valores.slice(0, upto + 1).filter((v): v is number => v != null);
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}
