// ============================================================================
// Pauta de la competencia — lecturas de PERFORMANCE estimada (puro, client-safe, testeado).
// Meta no publica inversión/alcance de anuncios comerciales en Argentina, así que se estima con lo
// observable: (1) índice de INTENSIDAD por marca (avisos activos, creatividades distintas, versiones por
// creatividad, días al aire, plataformas y ritmo de lanzamientos), (2) avisos SOSTENIDOS (los que llevan
// más días activos = los que les rinden) y (3) CRUCE con los posteos orgánicos: si el anuncio es un
// posteo potenciado, se muestran sus me gusta / comentarios / visualizaciones reales.
// Mismo archivo en Drean (src/lib/ad-intensity.ts) y BIP (lib/ad-intensity.ts): mantener iguales.
// ============================================================================

export interface IntensityAd { id: string; body: string; title?: string; startDate: string | null; firstSeen: string; active: boolean; platforms: string[]; format: string }
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

/** Agrupa versiones del mismo mensaje (mismo texto con variaciones menores). */
export function groupCreatives(ads: IntensityAd[]): IntensityAd[][] {
  const groups: { toks: Set<string>; ads: IntensityAd[] }[] = [];
  for (const a of ads) {
    const t = tokens(`${a.title ?? ""} ${a.body}`);
    const g = t.size ? groups.find((x) => textSimilarity(x.toks, t) >= 0.7) : undefined;
    if (g) g.ads.push(a); else groups.push({ toks: t, ads: [a] });
  }
  return groups.map((g) => g.ads);
}

export function brandIntensity(brands: IntensityBrand[], now = Date.now()): BrandIntensity[] {
  const raw = brands.map((b) => {
    const act = b.ads.filter((a) => a.active);
    const groups = groupCreatives(act);
    const dias = act.map((a) => daysOn(a, now));
    return {
      marca: b.marca, own: b.own,
      activos: act.length,
      creatividades: groups.length,
      versionesPorCreatividad: groups.length ? act.length / groups.length : 0,
      diasPromedio: dias.length ? dias.reduce((x, y) => x + y, 0) / dias.length : 0,
      sostenidos: dias.filter((d) => d >= 30).length,
      lanzamientos30: act.filter((a) => now - new Date(start(a)).getTime() <= 30 * DAY).length,
      plataformasPromedio: act.length ? act.reduce((x, a) => x + a.platforms.length, 0) / act.length : 0,
    };
  });
  // Índice = mezcla ponderada de cada dimensión normalizada contra el máximo del set.
  const mx = (k: keyof (typeof raw)[number]) => Math.max(1e-9, ...raw.map((r) => Number(r[k]) || 0));
  const W: [keyof (typeof raw)[number], number][] = [["activos", 0.35], ["creatividades", 0.2], ["lanzamientos30", 0.2], ["sostenidos", 0.15], ["plataformasPromedio", 0.1]];
  const m = Object.fromEntries(W.map(([k]) => [k, mx(k)])) as Record<string, number>;
  return raw.map((r) => ({
    ...r,
    indice: r.activos ? Math.round(100 * W.reduce((acc, [k, w]) => acc + w * ((Number(r[k]) || 0) / m[k as string]!), 0)) : 0,
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
      out.push({ marca: b.marca, id: lead.id, dias: daysOn(lead, now), versiones: g.length });
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
