// ============================================================================
// SEO / GEO avanzado de Drean — armado PURO (client-safe, imports relativos → testeable) de lo que
// muestra /seo-search y usan las señales. Portado/adaptado de BIP (sep-2026):
//   · ESoS por categoría: SoS de Drean (vw_share_of_search, MA6) − share de mercado GfK (mercado_share,
//     segmento Total, año móvil MAT, unidades). lib/marca-indices.ts
//   · Salud digital de marca: índice compuesto 0-100 (SoS, share of engagement, visibilidad en IA,
//     índice de posición SEO invertido) vs el set. lib/marca-indices.ts
//   · Visibilidad en IA con intervalo de Wilson (lib/llmo-stats.ts) sobre seo_llmo.
//   · Evolución por keyword (lib/seo-kw-evolucion.ts) sobre las fotos de seo_rankings.
// ============================================================================
import { computeEsos, type EsosResult, type ObsDigital, type MesValor } from "./marca-indices";
import { llmoStats, type LlmoStats } from "./llmo-stats";
import type { KwRankRow } from "./seo-kw-evolucion";

export const CAT_SEO_A_GFK: Record<string, string> = { lavarropas: "Lavado", heladeras: "Refrigeración", cocinas: "Cocción" };
export const CAT_LABEL: Record<string, string> = { lavarropas: "Lavado", heladeras: "Refrigeración", cocinas: "Cocción" };

const ym = (s: string) => String(s ?? "").slice(0, 7);
const norm = (s: string) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

export interface ShareLite { categoria: string; marca: string; mes: string; share_pct: number; vol?: number }
export interface GfkLite { mes: string; categoria: string; segmento: string; marca: string; unit_share: number | null; value_share?: number | null; agregacion?: string | null }
export interface LlmoLite { categoria: string; marca: string; mes: string; menciones: number; prompts: number; share_pct: number }
export interface IdxLite { categoria: string; marca: string; mes: string; indice: number }
export interface SocialLite { marca: string; fecha: string | null; likes: number | null; comentarios: number | null }

/** ESoS de Drean por categoría (meses CERRADOS: el SoS del mes en curso es parcial; GfK trae meses futuros → fuera). */
export function esosPorCategoria(share: ShareLite[], gfk: GfkLite[], ownBrand: string, hoyYm: string): { categoria: string; label: string; res: EsosResult }[] {
  const own = norm(ownBrand);
  const out: { categoria: string; label: string; res: EsosResult }[] = [];
  for (const [cat, gcat] of Object.entries(CAT_SEO_A_GFK)) {
    const sos: MesValor[] = share.filter((r) => r.categoria === cat && norm(r.marca) === own && ym(r.mes) < hoyYm).map((r) => ({ mes: ym(r.mes), valor: Number(r.share_pct) || 0 }));
    const somRows = gfk.filter((r) => r.categoria === gcat && r.segmento === "Total" && norm(r.marca) === own && ym(r.mes) < hoyYm && r.unit_share != null);
    const mat = somRows.filter((r) => (r.agregacion ?? "").toUpperCase() === "MAT");
    const base = mat.length >= 3 ? mat : somRows.filter((r) => (r.agregacion ?? "mensual") === "mensual");
    const som: MesValor[] = base.map((r) => ({ mes: ym(r.mes), valor: Number(r.unit_share) }));
    if (!sos.length || !som.length) continue;
    out.push({ categoria: cat, label: CAT_LABEL[cat] ?? cat, res: computeEsos(sos, som) });
  }
  return out;
}

/** Observaciones del índice de salud digital (una por marca/componente/mes; varias categorías se promedian). */
export function obsDigital(inp: { share: ShareLite[]; llmo: LlmoLite[]; idx: IdxLite[]; social: SocialLite[]; socialLabels: Record<string, string>; hoyYm: string }): ObsDigital[] {
  const obs: ObsDigital[] = [];
  for (const r of inp.share) if (ym(r.mes) < inp.hoyYm) obs.push({ mes: ym(r.mes), marca: r.marca, componente: "sos", valor: Number(r.share_pct) || 0 });
  for (const r of inp.llmo) if ((Number(r.prompts) || 0) > 0 && ym(r.mes) <= inp.hoyYm) obs.push({ mes: ym(r.mes), marca: r.marca, componente: "ia", valor: Number(r.share_pct) || 0 });
  for (const r of inp.idx) if (ym(r.mes) <= inp.hoyYm && Number.isFinite(Number(r.indice))) obs.push({ mes: ym(r.mes), marca: r.marca, componente: "serp", valor: Number(r.indice) });
  // Share of engagement mensual: (likes + comentarios) de cada marca ÷ total del set ese mes.
  const byMes = new Map<string, Map<string, number>>();
  for (const p of inp.social) {
    if (!p.fecha) continue;
    const mes = ym(p.fecha);
    if (mes >= inp.hoyYm) continue;
    const marca = inp.socialLabels[p.marca] ?? p.marca;
    const m = byMes.get(mes) ?? new Map<string, number>();
    m.set(marca, (m.get(marca) ?? 0) + (Number(p.likes) || 0) + (Number(p.comentarios) || 0));
    byMes.set(mes, m);
  }
  for (const [mes, m] of byMes) {
    const tot = [...m.values()].reduce((a, b) => a + b, 0);
    if (tot <= 0 || m.size < 3) continue;
    for (const [marca, v] of m) obs.push({ mes, marca, componente: "soe", valor: (v / tot) * 100 });
  }
  return obs;
}

export interface LlmoCat { categoria: string; label: string; mes: string; marcas: { marca: string; own: boolean; s: LlmoStats }[] }
/** Última corrida CON respuestas por categoría (las corridas en 0 — sep-2026 — se ignoran) + IC de Wilson. */
export function llmoConIc(rows: LlmoLite[], ownBrand: string): LlmoCat[] {
  const own = norm(ownBrand);
  const out: LlmoCat[] = [];
  for (const cat of Object.keys(CAT_LABEL)) {
    const rs = rows.filter((r) => r.categoria === cat && (Number(r.prompts) || 0) > 0);
    const mes = rs.map((r) => ym(r.mes)).sort().pop();
    if (!mes) continue;
    const delMes = rs.filter((r) => ym(r.mes) === mes);
    const totMenc = delMes.reduce((s, r) => s + (Number(r.menciones) || 0), 0);
    out.push({
      categoria: cat, label: CAT_LABEL[cat] ?? cat, mes,
      marcas: delMes.map((r) => ({ marca: r.marca, own: norm(r.marca) === own, s: llmoStats({ marca: r.marca, own: norm(r.marca) === own, menciones: Number(r.menciones) || 0, prompts: Number(r.prompts) || 0, share_pct: Number(r.share_pct) || 0, menciones_total: totMenc }) }))
        .sort((a, b) => b.s.tasa - a.s.tasa || b.s.sov - a.s.sov),
    });
  }
  return out;
}

/** Filas de seo_rankings del dominio propio + nulls sintéticos: en cada foto, la keyword del universo
 *  en la que Drean no aparece en el top-100 cuenta como "no rankea" (así se detectan las perdidas). */
export function kwRowsConUniverso(rows: { fecha: string; categoria: string | null; keyword: string; posicion: number | null; url: string | null; search_volume: number | null }[], universo: { keyword: string; categoria: string; volume: number }[], dominio: string, marca: string): KwRankRow[] {
  const fechas = [...new Set(rows.map((r) => r.fecha.slice(0, 10)))].sort();
  const have = new Set(rows.map((r) => `${r.fecha.slice(0, 10)}|${r.keyword}`));
  const out: KwRankRow[] = rows.map((r) => ({ fecha: r.fecha.slice(0, 10), categoria: r.categoria ?? "", keyword: r.keyword, dominio, marca, posicion: r.posicion, url: r.url, volumen: r.search_volume }));
  for (const f of fechas) for (const u of universo) if (!have.has(`${f}|${u.keyword}`)) out.push({ fecha: f, categoria: u.categoria, keyword: u.keyword, dominio, marca, posicion: null, url: null, volumen: u.volume });
  return out;
}
