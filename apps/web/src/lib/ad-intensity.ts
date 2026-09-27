// ============================================================================
// Pauta de la competencia — lecturas de PERFORMANCE estimada (puro, client-safe, testeado).
// Meta no publica inversión/alcance de anuncios comerciales en Argentina, así que se estima con lo
// observable: (1) índice de INTENSIDAD por marca (avisos activos, creatividades distintas, versiones por
// creatividad, días al aire, plataformas y ritmo de lanzamientos), (2) avisos SOSTENIDOS (los que llevan
// más días activos = los que les rinden) y (3) CRUCE con los posteos orgánicos: si el anuncio es un
// posteo potenciado, se muestran sus me gusta / comentarios / visualizaciones reales.
// Mismo archivo en BIP (lib/ad-intensity.ts) y Drean (src/lib/ad-intensity.ts): mantener iguales.
// ============================================================================

export interface IntensityAd {
  id: string; body: string; title?: string; startDate: string | null; firstSeen: string; active: boolean; platforms: string[]; format: string;
  // Meta agrupa las versiones de un creativo ("N anuncios usan este creativo"). Cuando viene, manda
  // sobre el agrupado por texto (Jaccard), que queda como fallback.
  collationId?: string | null; collationCount?: number | null;
}

// Avisos máximos por marca y corrida del scraper (lib/ad-library.ts). Una marca que llega a este
// número está TOPEADA: la muestra no es todo lo que pauta.
export const AD_LIBRARY_CAP = 40;
export interface IntensityBrand { marca: string; own: boolean; ads: IntensityAd[] }

export interface BrandIntensity {
  marca: string; own: boolean;
  indice: number;            // 0-100 relativo al set (100 = la marca que más pauta)
  activos: number;
  creatividades: number;     // mensajes distintos (agrupando versiones del mismo texto)
  versionesPorCreatividad: number;
  diasPromedio: number;      // días al aire promedio de los activos
  sostenidos: number;        // activos con 30+ días al aire
  lanzamientos30: number;    // arrancaron en los últimos 30 días
  plataformasPromedio: number;
  muestra: number;           // avisos activos efectivamente leídos
  topeado: boolean;          // la muestra llegó al tope por marca → `activos` es estimado/mínimo
  estimadoPorCollation: boolean; // `activos` incluye versiones fuera de la muestra (collation_count de Meta)
}
export interface SustainedAd { marca: string; id: string; dias: number; versiones: number }
export interface OrganicPost { copy: string | null; likes: number; comentarios: number; views: number; fecha: string; url: string | null; red: string }
export interface AdEngagement { likes: number; comentarios: number; views: number; url: string | null; red: string; fecha: string; score: number }

const DAY = 86_400_000;
const STOP = new Set(["para", "con", "que", "los", "las", "del", "una", "uno", "por", "mas", "tus", "sus", "como", "esta", "este", "todo", "cada", "hoy", "ahora", "vos", "nos", "les", "sin", "pero"]);

export function tokens(s: string | null | undefined): Set<string> {
  const t = (s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").match(/[a-z0-9]+/g) ?? [];
  return new Set(t.filter((w) => w.length > 2 && !STOP.has(w)));
}
/** Parecido de dos textos: Jaccard, o contención (el texto corto casi entero dentro del largo). */
export function textSimilarity(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const w of a) if (b.has(w)) inter++;
  const jac = inter / (a.size + b.size - inter);
  const min = Math.min(a.size, b.size);
  const cont = min >= 5 ? inter / min : 0;
  return Math.max(jac, cont >= 0.8 ? cont * 0.9 : 0);
}

const start = (a: IntensityAd) => a.startDate ?? a.firstSeen;
const daysOn = (a: IntensityAd, now: number) => Math.max(0, Math.floor((now - new Date(start(a)).getTime()) / DAY));

/** Agrupa versiones del mismo mensaje: por `collationId` de Meta si viene; si no, por texto (Jaccard). */
export function groupCreatives(ads: IntensityAd[]): IntensityAd[][] {
  const groups: { key: string | null; toks: Set<string>; ads: IntensityAd[] }[] = [];
  const byKey = new Map<string, (typeof groups)[number]>();
  for (const a of ads) {
    const t = tokens(`${a.title ?? ""} ${a.body}`);
    const key = a.collationId ? String(a.collationId) : null;
    let g = key ? byKey.get(key) : undefined;
    // Sin collation: se busca por texto entre los grupos (con o sin collation).
    if (!g && !key && t.size) g = groups.find((x) => textSimilarity(x.toks, t) >= 0.7);
    if (g) { g.ads.push(a); if (!g.toks.size) g.toks = t; continue; }
    const ng = { key, toks: t, ads: [a] };
    groups.push(ng);
    if (key) byKey.set(key, ng);
  }
  return groups.map((g) => g.ads);
}

/** Versiones de un grupo: el mayor entre las que vinieron en la muestra y el collation_count de Meta. */
export function groupVersions(g: IntensityAd[]): number {
  const cc = Math.max(0, ...g.map((a) => a.collationCount ?? 0));
  return Math.max(g.length, cc);
}

export function brandIntensity(brands: IntensityBrand[], now = Date.now(), cap = AD_LIBRARY_CAP): BrandIntensity[] {
  const raw = brands.map((b) => {
    const act = b.ads.filter((a) => a.active);
    const groups = groupCreatives(act);
    // Peso de cada aviso leído = versiones del grupo / avisos del grupo en la muestra (≥ 1). Sin
    // collation_count es 1 (= contar avisos). Con collation, un creativo que Meta dice que corre en
    // 12 versiones pesa 12 aunque hayan venido 2: así una marca TOPEADA no queda subestimada.
    const w = new Map<IntensityAd, number>();
    for (const g of groups) { const k = groupVersions(g) / g.length; for (const a of g) w.set(a, k); }
    const W1 = (a: IntensityAd) => w.get(a) ?? 1;
    const activos = act.reduce((x, a) => x + W1(a), 0);
    const dias = act.map((a) => daysOn(a, now));
    return {
      marca: b.marca, own: b.own,
      activos,
      creatividades: groups.length,
      versionesPorCreatividad: groups.length ? activos / groups.length : 0,
      diasPromedio: dias.length ? dias.reduce((x, y) => x + y, 0) / dias.length : 0,
      sostenidos: act.reduce((x, a, i) => x + (dias[i]! >= 30 ? W1(a) : 0), 0),
      lanzamientos30: act.reduce((x, a) => x + (now - new Date(start(a)).getTime() <= 30 * DAY ? W1(a) : 0), 0),
      plataformasPromedio: act.length ? act.reduce((x, a) => x + a.platforms.length, 0) / act.length : 0,
      muestra: act.length,
      topeado: b.ads.length >= cap,
      estimadoPorCollation: activos > act.length,
    };
  });
  // Índice = mezcla ponderada de cada dimensión normalizada contra el máximo del set.
  type Dim = "activos" | "creatividades" | "lanzamientos30" | "sostenidos" | "plataformasPromedio";
  const mx = (k: Dim) => Math.max(1e-9, ...raw.map((r) => Number(r[k]) || 0));
  const W: [Dim, number][] = [["activos", 0.35], ["creatividades", 0.2], ["lanzamientos30", 0.2], ["sostenidos", 0.15], ["plataformasPromedio", 0.1]];
  const m = Object.fromEntries(W.map(([k]) => [k, mx(k)])) as Record<Dim, number>;
  // Una marca topeada tiene sus conteos truncados en `cap`: con collation_count se estiman las
  // versiones que quedaron fuera (arriba); sin collation son un PISO (la UI lo muestra con "≥").
  return raw.map((r) => ({
    ...r,
    indice: r.activos ? Math.round(100 * W.reduce((acc, [k, wt]) => acc + wt * ((Number(r[k]) || 0) / m[k]), 0)) : 0,
    activos: Math.round(r.activos),
    sostenidos: Math.round(r.sostenidos),
    lanzamientos30: Math.round(r.lanzamientos30),
    versionesPorCreatividad: Math.round(r.versionesPorCreatividad * 10) / 10,
    diasPromedio: Math.round(r.diasPromedio),
    plataformasPromedio: Math.round(r.plataformasPromedio * 10) / 10,
  })).sort((a, b) => b.indice - a.indice);
}

/** Avisos que más sostienen (más días activos), con cuántas versiones del mismo mensaje corren. */
export function sustainedAds(brands: IntensityBrand[], limit = 12, now = Date.now()): SustainedAd[] {
  const out: SustainedAd[] = [];
  for (const b of brands) {
    for (const g of groupCreatives(b.ads.filter((a) => a.active))) {
      const lead = [...g].sort((x, y) => daysOn(y, now) - daysOn(x, now))[0]!;
      out.push({ marca: b.marca, id: lead.id, dias: daysOn(lead, now), versiones: groupVersions(g) });
    }
  }
  return out.sort((a, b) => b.dias - a.dias || b.versiones - a.versiones).slice(0, limit);
}

/** Cruce anuncio ↔ posteo orgánico de la misma marca (por texto). Devuelve id de anuncio → métricas. */
export function matchAdsToPosts(ads: IntensityAd[], posts: OrganicPost[], threshold = 0.5): Record<string, AdEngagement> {
  const pt = posts.filter((p) => p.copy).map((p) => ({ p, t: tokens(p.copy) }));
  const out: Record<string, AdEngagement> = {};
  for (const a of ads) {
    const at = tokens(`${a.title ?? ""} ${a.body}`);
    if (at.size < 4) continue;
    let best: { s: number; p: OrganicPost } | null = null;
    for (const x of pt) { const s = textSimilarity(at, x.t); if (s >= threshold && (!best || s > best.s)) best = { s, p: x.p }; }
    if (best) out[a.id] = { likes: best.p.likes, comentarios: best.p.comentarios, views: best.p.views, url: best.p.url, red: best.p.red, fecha: best.p.fecha, score: Math.round(best.s * 100) / 100 };
  }
  return out;
}
