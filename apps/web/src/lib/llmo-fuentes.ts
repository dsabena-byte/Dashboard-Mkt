// ============================================================================
// FUENTES de las respuestas de IA (gap G6 de docs/estado-del-arte/seo-geo.md §4.9 / roadmap #10).
// PURO, client-safe, sin imports. Costo 0: sale de las MISMAS llamadas del LLMO (las URLs citadas
// que devuelve la IA con búsqueda web — Responses API + tool web_search — en `annotations`/links) y
// de las referencias del AI Overview
// de la SERP que ya se paga.
//   · Citation share del dominio propio = citas a tu dominio ÷ citas totales (def. Bing/Peec).
//   · Fuentes por tipo: propio / competidor / retail / medio / UGC / referencia / otro.
//   · "Fuentes que te faltan" (gap sources, Peec): dominios citados en respuestas que nombran a
//     competidores y NO a tu marca, por frecuencia. Es lo más accionable: dónde tenés que estar.
// Test: scripts/seo-avanzado.test.ts
// ============================================================================

export type TipoFuente = "propio" | "competidor" | "retail" | "medio" | "ugc" | "referencia" | "otro";
export const TIPO_FUENTE_LABEL: Record<TipoFuente, string> = {
  propio: "Tu sitio", competidor: "Competidor", retail: "Retail / marketplace", medio: "Medio / reviews",
  ugc: "Comunidad / video / redes", referencia: "Referencia (Wikipedia…)", otro: "Otro",
};

/** Dominio limpio (sin protocolo, www ni path). */
export function dominioDe(u: string): string {
  return (u || "").toLowerCase().trim().replace(/^[a-z]+:\/\//, "").replace(/^www\./, "").replace(/[/?#:].*$/, "").replace(/\.$/, "");
}
const matchDom = (d: string, suf: string) => d === suf || d.endsWith(`.${suf}`);

const RETAIL = ["mercadolibre.com.ar", "mercadolibre.com", "mercadolibre.com.mx", "fravega.com", "garbarino.com", "musimundo.com", "cetrogar.com.ar", "naldo.com.ar", "oncity.com", "carrefour.com.ar", "jumbo.com.ar", "coto.com.ar", "megatone.net", "tiendamia.com", "amazon.com", "falabella.com", "easy.com.ar", "sodimac.com.ar", "walmart.com", "bestbuy.com"];
const UGC = ["reddit.com", "youtube.com", "youtu.be", "quora.com", "tiktok.com", "instagram.com", "facebook.com", "x.com", "twitter.com", "linkedin.com", "pinterest.com", "taringa.net", "foros.3dgames.com.ar", "forocoches.com", "medium.com"];
const REFERENCIA = ["wikipedia.org", "wikidata.org", "wikihow.com", "gob.ar", "gov", "argentina.gob.ar", "who.int"];
const MEDIO = ["clarin.com", "lanacion.com.ar", "infobae.com", "pagina12.com.ar", "perfil.com", "ambito.com", "cronista.com", "iprofesional.com", "tn.com.ar", "minutouno.com", "lavoz.com.ar", "losandes.com.ar", "xataka.com", "xataka.com.ar", "tomsguide.com", "cnet.com", "rtings.com", "consumerreports.org", "wired.com", "theverge.com", "techradar.com", "profeco.gob.mx", "ocu.org", "elpais.com", "bbc.com", "forbes.com"];
const MEDIO_RE = /(noticias|news|diario|revista|review|reviews|blog|magazine|mag|guia|comparativa|mejores|top10|ranking)/;

export interface DominiosMarca { propio?: string[]; competidores?: string[]; retailers?: string[] }

export function clasificarDominio(dom: string, m: DominiosMarca = {}): TipoFuente {
  const d = dominioDe(dom);
  if (!d) return "otro";
  if ((m.propio ?? []).some((x) => x && matchDom(d, dominioDe(x)))) return "propio";
  if ((m.competidores ?? []).some((x) => x && matchDom(d, dominioDe(x)))) return "competidor";
  if ((m.retailers ?? []).some((x) => x && matchDom(d, dominioDe(x))) || RETAIL.some((x) => matchDom(d, x))) return "retail";
  if (REFERENCIA.some((x) => matchDom(d, x)) || /\.gob\.[a-z]{2}$|\.gov(\.[a-z]{2})?$/.test(d)) return "referencia";
  if (UGC.some((x) => matchDom(d, x))) return "ugc";
  if (MEDIO.some((x) => matchDom(d, x)) || MEDIO_RE.test(d)) return "medio";
  return "otro";
}

/** Partes `output_text` de una respuesta de la Responses API (`output[]` → message → content[]). */
function outputTexts(resp: unknown): Array<{ text?: unknown; annotations?: unknown }> {
  const out = (resp as { output?: unknown })?.output;
  if (!Array.isArray(out)) return [];
  const parts: Array<{ text?: unknown; annotations?: unknown }> = [];
  for (const item of out) {
    const it = item as { type?: string; content?: unknown };
    if (it?.type !== "message" || !Array.isArray(it.content)) continue;
    for (const c of it.content) if ((c as { type?: string })?.type === "output_text") parts.push(c as { text?: unknown; annotations?: unknown });
  }
  return parts;
}

/**
 * Texto de la respuesta. Responses API (`output[].content[].text` de tipo output_text, o el atajo
 * `output_text` si viene) o, por compatibilidad, un message de chat completions (`content`).
 */
export function textoRespuesta(resp: unknown): string {
  const parts = outputTexts(resp);
  if (parts.length) return parts.map((p) => (typeof p.text === "string" ? p.text : "")).join("\n").trim();
  const r = (resp ?? {}) as { output_text?: unknown; content?: unknown };
  if (typeof r.output_text === "string") return r.output_text;
  return typeof r.content === "string" ? r.content : "";
}

/**
 * URLs citadas en una respuesta de IA con búsqueda web: `annotations` de tipo `url_citation`
 * (Responses API: `{type:"url_citation", url, title}` dentro de cada output_text; chat completions
 * viejo: `{type:"url_citation", url_citation:{url}}` en el message) + links markdown/sueltos del
 * texto como respaldo. Sin utm y deduplicadas (máx `cap`).
 */
export function extraerCitas(resp: unknown, cap = 10): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (raw: unknown) => {
    if (typeof raw !== "string") return;
    let u = raw.trim().replace(/[)\].,;]+$/, "");
    if (!/^https?:\/\//i.test(u)) return;
    try {
      const x = new URL(u);
      for (const k of [...x.searchParams.keys()]) if (/^utm_/i.test(k)) x.searchParams.delete(k);
      x.hash = "";
      u = x.toString();
    } catch { return; }
    const k = u.toLowerCase();
    if (seen.has(k) || out.length >= cap) return;
    seen.add(k); out.push(u.slice(0, 300));
  };
  const annots = (list: unknown) => {
    if (!Array.isArray(list)) return;
    for (const a of list) {
      const aa = a as { type?: string; url_citation?: { url?: unknown }; url?: unknown };
      if (aa?.type && aa.type !== "url_citation") continue;
      push(aa?.url_citation?.url ?? aa?.url);
    }
  };
  const texts = (t: unknown) => { if (typeof t === "string") for (const m of t.matchAll(/https?:\/\/[^\s)<>"\]]+/g)) push(m[0]); };
  const parts = outputTexts(resp);
  if (parts.length) {
    for (const p of parts) annots(p.annotations);
    for (const p of parts) texts(p.text);
    return out;
  }
  const msg = (resp ?? {}) as { annotations?: unknown; content?: unknown };
  annots(msg.annotations);
  texts(msg.content);
  return out;
}

/** Muestra mínima que necesita el análisis (la de lib/llmo-stats.ts la cumple). */
export interface MuestraConFuentes { categoria: string; marcas: string[]; fuentes?: string[] }
export interface FuenteAgg { dominio: string; tipo: TipoFuente; citas: number; respuestas: number; conTuMarca: number; soloCompetidores: number }
export interface FuentesIa {
  categoria: string;
  respuestas: number;                // respuestas de la ventana
  respuestasConFuentes: number;      // respuestas que trajeron al menos una URL
  citasTotales: number;
  citasPropias: number;
  citationSharePropio: number | null;  // % (null si no hay citas)
  porTipo: { tipo: TipoFuente; citas: number; pct: number }[];
  top: FuenteAgg[];
  /** Fuentes que te faltan: citadas en respuestas que nombran competidores y no a tu marca. */
  faltantes: FuenteAgg[];
}

export function analizarFuentesIa(
  muestras: MuestraConFuentes[] | null | undefined, categoria: string, ownBrand: string, dominios: DominiosMarca = {}, top = 12,
): FuentesIa {
  const ms = (muestras ?? []).filter((m) => m.categoria === categoria);
  const agg = new Map<string, FuenteAgg>();
  let citasTot = 0, citasProp = 0, conF = 0;
  const tipoCount = new Map<TipoFuente, number>();
  for (const m of ms) {
    const doms = [...new Set((m.fuentes ?? []).map(dominioDe).filter(Boolean))];
    if (!doms.length) continue;
    conF++;
    const conMarca = m.marcas.includes(ownBrand);
    const soloComp = !conMarca && m.marcas.length > 0;
    for (const d of doms) {
      const tipo = clasificarDominio(d, dominios);
      const a = agg.get(d) ?? { dominio: d, tipo, citas: 0, respuestas: 0, conTuMarca: 0, soloCompetidores: 0 };
      const n = (m.fuentes ?? []).filter((u) => dominioDe(u) === d).length;
      a.citas += n; a.respuestas++;
      if (conMarca) a.conTuMarca++;
      if (soloComp) a.soloCompetidores++;
      agg.set(d, a);
      citasTot += n;
      if (tipo === "propio") citasProp += n;
      tipoCount.set(tipo, (tipoCount.get(tipo) ?? 0) + n);
    }
  }
  const all = [...agg.values()].sort((a, b) => b.citas - a.citas || a.dominio.localeCompare(b.dominio));
  const faltantes = all.filter((a) => a.soloCompetidores > 0 && a.conTuMarca === 0 && a.tipo !== "propio" && a.tipo !== "competidor")
    .sort((a, b) => b.soloCompetidores - a.soloCompetidores || b.citas - a.citas).slice(0, top);
  return {
    categoria, respuestas: ms.length, respuestasConFuentes: conF, citasTotales: citasTot, citasPropias: citasProp,
    citationSharePropio: citasTot > 0 ? (citasProp / citasTot) * 100 : null,
    porTipo: [...tipoCount.entries()].map(([tipo, c]) => ({ tipo, citas: c, pct: citasTot ? (c / citasTot) * 100 : 0 })).sort((a, b) => b.citas - a.citas),
    top: all.slice(0, top), faltantes,
  };
}

/** AI Overview de Google: dominios citados por keyword (de la SERP) → mismo análisis de fuentes. */
export interface AioRefs { categoria: string; keyword: string; dominios: string[] }
export function analizarFuentesAio(refs: AioRefs[] | null | undefined, categoria: string, dominios: DominiosMarca = {}, top = 10): { keywordsConAio: number; teCita: number; top: FuenteAgg[] } {
  const rs = (refs ?? []).filter((r) => r.categoria === categoria);
  const agg = new Map<string, FuenteAgg>();
  let teCita = 0;
  for (const r of rs) {
    const doms = [...new Set(r.dominios.map(dominioDe).filter(Boolean))];
    if (doms.some((d) => clasificarDominio(d, dominios) === "propio")) teCita++;
    for (const d of doms) {
      const a = agg.get(d) ?? { dominio: d, tipo: clasificarDominio(d, dominios), citas: 0, respuestas: 0, conTuMarca: 0, soloCompetidores: 0 };
      a.citas++; a.respuestas++; agg.set(d, a);
    }
  }
  return { keywordsConAio: rs.length, teCita, top: [...agg.values()].sort((a, b) => b.citas - a.citas).slice(0, top) };
}
