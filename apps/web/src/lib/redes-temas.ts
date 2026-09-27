// Temas de contenido de la competencia (clustering barato) — núcleo PURO y client-safe. Portado del
// SaaS hermano (sep-2026).
//
// Cómo se obtienen: /api/cron/competencia-ig (parte temas) le pide a gpt-4o-mini un "tema" corto
// (1-3 palabras) por post, en lotes de 60. Para que los temas se agrupen entre corridas, el prompt
// recibe la lista de temas ya usados y se le pide reusarlos (clustering guiado); acá además se unifican
// variantes por solapamiento de palabras (Jaccard ≥ 0,5). Métrica: ER por seguidor (el mismo del
// benchmark) y cantidad de posts por tema y marca.

export interface TemaPost { marca: string; tema?: string | null; engagement: number | null }

const STOP = new Set(["de", "la", "el", "y", "en", "para", "con", "los", "las", "del", "al", "tu", "su", "un", "una", "a", "o", "e", "por"]);
const GENERIC = new Set(["otro", "otros", "varios", "general", "n/a", "na", "sin tema", "ninguno"]);

export function normTema(t: string | null | undefined): string | null {
  const s = String(t ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9ñ ]+/g, " ").replace(/\s+/g, " ").trim();
  if (!s || GENERIC.has(s)) return null;
  return s.split(" ").slice(0, 4).join(" ");
}
const tokens = (t: string) => new Set(t.split(" ").filter((w) => w && !STOP.has(w)).map((w) => (w.length > 4 && w.endsWith("s") ? w.slice(0, -1) : w)));
function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let i = 0; for (const x of a) if (b.has(x)) i++;
  return i / (a.size + b.size - i);
}

/** Tema normalizado → tema canónico (el más frecuente de su grupo de variantes). */
export function clusterTemas(temas: (string | null | undefined)[]): Map<string, string> {
  const freq = new Map<string, number>();
  for (const t of temas) { const n = normTema(t); if (n) freq.set(n, (freq.get(n) ?? 0) + 1); }
  const order = [...freq.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([k]) => k);
  const canon: { label: string; tok: Set<string> }[] = [];
  const out = new Map<string, string>();
  for (const t of order) {
    const tk = tokens(t);
    const hit = canon.find((c) => jaccard(c.tok, tk) >= 0.5);
    if (hit) out.set(t, hit.label); else { canon.push({ label: t, tok: tk }); out.set(t, t); }
  }
  return out;
}

/** Hasta `max` temas ya usados (los más frecuentes) para pedirle al modelo que los reuse. */
export function temasExistentes(posts: { tema?: string | null }[], max = 25): string[] {
  const map = clusterTemas(posts.map((p) => p.tema));
  const freq = new Map<string, number>();
  for (const p of posts) { const n = normTema(p.tema); const c = n ? map.get(n) : null; if (c) freq.set(c, (freq.get(c) ?? 0) + 1); }
  return [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, max).map(([k]) => k);
}

const median = (a: number[]): number => {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y); const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

export interface TemaStat { tema: string; posts: number; share: number; er_mediana: number | null }
/** Top temas por marca: share de sus posts y mediana de ER por seguidor. */
export function temasPorMarca(posts: TemaPost[], top = 3): { marca: string; temas: TemaStat[] }[] {
  const map = clusterTemas(posts.map((p) => p.tema));
  const marcas = [...new Set(posts.map((p) => p.marca))];
  return marcas.map((marca) => {
    const bp = posts.filter((p) => p.marca === marca);
    const by = new Map<string, TemaPost[]>();
    for (const p of bp) { const n = normTema(p.tema); const c = n ? map.get(n) : null; if (c) by.set(c, [...(by.get(c) ?? []), p]); }
    const withTema = [...by.values()].reduce((s, x) => s + x.length, 0);
    const temas = [...by.entries()].map(([tema, ps]) => {
      const ers = ps.map((p) => p.engagement).filter((e): e is number => e != null);
      return { tema, posts: ps.length, share: withTema ? Math.round((ps.length / withTema) * 1000) / 10 : 0, er_mediana: ers.length >= 2 ? median(ers) : null };
    }).sort((a, b) => b.posts - a.posts || (b.er_mediana ?? 0) - (a.er_mediana ?? 0)).slice(0, top);
    return { marca, temas };
  }).filter((x) => x.temas.length);
}

export interface TemaGap { tema: string; er_mediana: number; posts: number; marcas: string[]; vsMediana: number }
/**
 * Temas que rinden en la competencia y la marca propia no usa: ≥ 4 posts de ≥ 2 marcas rivales, mediana
 * de ER ≥ 1,2× la mediana de todos los posts rivales, y < 5% de los posts propios (con ≥ 5 posts propios).
 */
export function temaGaps(posts: TemaPost[], ownBrand: string): TemaGap[] {
  const map = clusterTemas(posts.map((p) => p.tema));
  const canonOf = (p: TemaPost) => { const n = normTema(p.tema); return n ? map.get(n) ?? null : null; };
  const own = posts.filter((p) => p.marca === ownBrand);
  const ownTema = own.filter((p) => canonOf(p));
  if (ownTema.length < 5) return [];
  const rivals = posts.filter((p) => p.marca !== ownBrand && p.engagement != null);
  const base = median(rivals.map((p) => p.engagement as number));
  if (base <= 0) return [];
  const by = new Map<string, TemaPost[]>();
  for (const p of rivals) { const c = canonOf(p); if (c) by.set(c, [...(by.get(c) ?? []), p]); }
  const out: TemaGap[] = [];
  for (const [tema, ps] of by) {
    const marcas = [...new Set(ps.map((p) => p.marca))];
    if (ps.length < 4 || marcas.length < 2) continue;
    const er = median(ps.map((p) => p.engagement as number));
    const ownShare = ownTema.filter((p) => canonOf(p) === tema).length / ownTema.length;
    if (er >= base * 1.2 && ownShare < 0.05) out.push({ tema, er_mediana: er, posts: ps.length, marcas, vsMediana: Math.round((er / base) * 100) / 100 });
  }
  return out.sort((a, b) => b.er_mediana - a.er_mediana);
}

// ── Prompt del clasificador (lo usa el cron; puro para testearlo) ──────────────────────────────
export const TEMAS_LOTE = 60;
export function temasPrompt(items: { i: number; marca: string; copy: string }[], existentes: string[]): string {
  return `Sos analista de redes sociales de electrodomésticos en Argentina. Para cada post de Instagram/Facebook de marcas del rubro, asigná un TEMA corto (1 a 3 palabras, en español, minúsculas) que describa de qué habla el contenido (ej.: "lavado de ropa", "recetas", "día del padre", "sorteo", "lanzamiento heladera", "tips de limpieza"). No uses el nombre de la marca como tema ni "otro".
${existentes.length ? `Temas ya usados (REUSALOS si corresponde, escritos igual): ${existentes.join(", ")}.` : ""}
Posts:
${items.map((x) => `${x.i}. [${x.marca}] ${x.copy.replace(/\s+/g, " ").slice(0, 280) || "(sin texto)"}`).join("\n")}

Devolvé SOLO un JSON: {"temas":[{"i":<número>,"tema":"<tema>"}]} con una entrada por post.`;
}
/** Parsea la respuesta del modelo → índice → tema normalizado (descarta vacíos/genéricos). */
export function parseTemas(text: string): Map<number, string> {
  const out = new Map<number, string>();
  try {
    const j = JSON.parse(text) as { temas?: { i?: unknown; tema?: unknown }[] };
    for (const t of j.temas ?? []) {
      const i = Number(t.i); const tema = normTema(typeof t.tema === "string" ? t.tema : null);
      if (Number.isInteger(i) && tema) out.set(i, tema);
    }
  } catch { /* respuesta inválida → sin temas */ }
  return out;
}
