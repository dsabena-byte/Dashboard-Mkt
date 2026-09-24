// ============================================================================
// Modelo de ENTRADA del motor de señales (portado de BIP, puro y client-safe).
// Las reglas de lib/signals/{pauta,redes,web,seo,overview,cruces}.ts son las de BIP casi
// literales; consumen estas formas. Drean NO tiene estos snapshots: los adaptadores de
// lib/signals/adapters.ts construyen estas formas desde las queries/tablas de Drean.
// Solo imports relativos (compilable suelto para scripts/signals-drean.test.ts).
// Contiene: tipos de plan de medios (pauta-model), redes (IG/FB + competencia social),
// web (reportes estilo GA4 + competencia web), SEO (share of search, SERP, IA, regiones),
// KPIs de mercado, Search Console (vacío en Drean) y el Seguimiento de objetivos.
// ============================================================================

// ─────────────────────────── PLAN DE MEDIOS ───────────────────────────
export interface PautaMonth {
  mes: string;
  mesIdx: number;
  inv: number;   // inversión TOTAL del mes (digital + offline)
  alc: number;   // alcance (suma por medio — Drean no tiene reach de-duplicado cross-media)
  impr: number;  // impresiones DIGITALES
  clic: number;
  v50: number;
  vbase: number;
  imprReach?: number; // impresiones de los medios que reportan alcance → Frecuencia = imprReach/alc
  invOff?: number;
  contOff?: number;
  grpOff?: number;
  imprOffKpi?: number;
  invBy?: Record<string, number>;
  /** Drean: inversión digital de los medios CON impresiones informadas (base del CPM mensual). OMD a veces carga la inversión de un mes antes que la performance. */
  invConImpr?: number;
}
export interface PautaTotals {
  spend: number; impressions: number; reach: number; clicks: number;
  plays: number; p25: number; p50: number; p75: number; p100: number; thruplay: number;
  vbase?: number;
  cpm: number; cpc: number; ctr: number; frequency: number; vtr50: number; vtr100: number; cpcv: number;
  spendOffline?: number; contactosOffline?: number; grpsOffline?: number;
}
export type Medio = string;
export interface CampaignRow {
  id: string; name: string; objective: string | null;
  medio?: Medio;
  currency?: string | null;
  spend: number; impressions: number; reach: number; clicks: number;
  cpm: number; cpc: number; ctr: number; frequency: number;
  vtr50: number; vtr100: number; cpmEf: number; vbase: number; p25: number; p50: number; p75: number; p100: number; plays: number;
  offline?: boolean;
  soporte?: string | null; campana?: string | null; categoria?: string | null; region?: string | null;
  contactos?: number; grps?: number; spots?: number; duracion?: number | null;
  alcanceOff?: number; alcancePct?: number; frecOff?: number | null; cpmContactos?: number | null; cpp?: number | null;
}
export interface CreativeRow {
  id: string; name: string; thumbnail: string | null; permalink: string | null; adUrl: string | null;
  objective: string | null; active: boolean;
  spend: number; impressions: number; clicks: number; reach: number; frequency: number;
  cpm: number; cpc: number; ctr: number; videoViews: number; vtr50: number; vtr100: number;
  reactions: number; comments: number; shares: number; saves: number;
}
export interface ObjectiveRow { objective: string; spend: number; impressions: number; clicks: number; reach: number; p100: number; cpm: number; ctr: number; vtr100: number; cpmEf: number }
export interface OfflineMedioRow {
  medio: string;
  spend: number; contactos: number; grps: number; spots: number;
  alcance: number; alcancePct: number;
  frecuencia: number | null;
  cpmContactos: number | null; cpp: number | null;
  shareOffline: number;
  filas: number; soportes: number;
}
export interface OfflineSummary {
  datasetId: string; datasetName: string; currency: string | null;
  filas: number; descartadas: number; motivos: string[]; meses: string[]; mesesFuturos: number;
  contactosComparables: boolean;
  byMedio: OfflineMedioRow[];
  totals: { spend: number; contactos: number; grps: number; spots: number };
  updatedAt?: string | null;
}
export interface PautaFull {
  ok: boolean; error?: string; warnings?: string[];
  currency: string | null;
  monthly: PautaMonth[];
  yearReach?: number | null;
  rangeLabel: string;
  totals: PautaTotals;
  byCampaign: CampaignRow[];
  byObjective: ObjectiveRow[];
  topCreatives: CreativeRow[];
  medios?: Medio[];
  currencies?: Partial<Record<string, string | null>>;
  mixedCurrency?: boolean;
  offline?: OfflineSummary;
}
export const EMPTY_TOTALS: PautaTotals = { spend: 0, impressions: 0, reach: 0, clicks: 0, plays: 0, p25: 0, p50: 0, p75: 0, p100: 0, thruplay: 0, vbase: 0, cpm: 0, cpc: 0, ctr: 0, frequency: 0, vtr50: 0, vtr100: 0, cpcv: 0 };
export const derive = (t: { spend: number; impressions: number; clicks: number; reach: number; p50: number; p100: number; vbase: number }) => ({
  cpm: t.impressions > 0 ? (t.spend / t.impressions) * 1000 : 0,
  cpc: t.clicks > 0 ? t.spend / t.clicks : 0,
  ctr: t.impressions > 0 ? (t.clicks / t.impressions) * 100 : 0,
  frequency: t.reach > 0 ? t.impressions / t.reach : 0,
  vtr50: t.vbase > 0 ? (t.p50 / t.vbase) * 100 : 0,
  vtr100: t.vbase > 0 ? (t.p100 / t.vbase) * 100 : 0,
  cpcv: t.p100 > 0 ? t.spend / t.p100 : 0,
});
export function byObjectiveOf(camps: CampaignRow[]): ObjectiveRow[] {
  const m = new Map<string, { spend: number; impressions: number; clicks: number; reach: number; p100: number; vbase: number }>();
  for (const c of camps) {
    if (c.offline) continue;
    const k = c.objective ?? "—";
    const cur = m.get(k) ?? { spend: 0, impressions: 0, clicks: 0, reach: 0, p100: 0, vbase: 0 };
    cur.spend += c.spend; cur.impressions += c.impressions; cur.clicks += c.clicks; cur.reach += c.reach; cur.p100 += c.p100; cur.vbase += c.vbase;
    m.set(k, cur);
  }
  return [...m.entries()].map(([objective, v]) => ({ objective, spend: v.spend, impressions: v.impressions, clicks: v.clicks, reach: v.reach, p100: v.p100, cpm: v.impressions > 0 ? (v.spend / v.impressions) * 1000 : 0, ctr: v.impressions > 0 ? (v.clicks / v.impressions) * 100 : 0, vtr100: v.vbase > 0 ? (v.p100 / v.vbase) * 100 : 0, cpmEf: v.p100 > 0 ? (v.spend / v.p100) * 1000 : 0 })).sort((a, b) => b.spend - a.spend);
}

// ─────────────────────────── REDES (orgánico) ───────────────────────────
export interface SocialPostLite {
  id: string; permalink: string | null; caption: string | null; media_type: string | null; thumbnail: string | null;
  timestamp: string; reach: number; engagement: number; likes?: number; comments?: number; saves?: number;
  insightsFailed?: boolean; paid?: boolean;
}
export interface MonthlyDatum { mes: string; anio?: number; mesIdx: number; alcance: number | null; engagement: number | null; likes?: number | null; comentarios?: number | null; guardados?: number | null }
export interface DemoRow { label: string; value: number; pct: number }
export interface IgOrganicSummary {
  ok: boolean; error?: string; username: string; followers: number;
  totals: { reach: number; engagement: number; postCount: number; likes?: number; comments?: number; saves?: number; videoViews?: number };
  monthly: MonthlyDatum[];
  topPosts: SocialPostLite[];
  demoAge: DemoRow[]; demoGender: DemoRow[]; demoCity: DemoRow[];
  rangeLabel?: string;
}
export interface FbPost { id: string; permalink: string | null; message: string | null; media_type: string | null; thumbnail: string | null; timestamp: string; reach: number; engagement: number; reactions?: number; clicks?: number; paid?: boolean; insightsFailed?: boolean }
export interface FbMonthlyDatum { mes: string; anio?: number; mesIdx: number; alcance: number | null; engagement: number | null; clicks?: number | null }
export interface FbOrganicSummary {
  ok: boolean; error?: string; name: string; followers: number;
  totals: { reach: number; engagement: number; postCount: number; paidCount?: number; clicks?: number };
  monthly: FbMonthlyDatum[];
  topPosts: FbPost[];
  rangeLabel?: string;
}

// Competencia social (misma forma que social_posts de Drean).
export type Red = "INSTAGRAM" | "FACEBOOK" | "TIKTOK";
export interface CompetitorPost {
  red_social: Red; url: string; marca: string; fecha: string | null;
  pilar: string | null;
  positivo: number | null; negativo: number | null; neutro: number | null; resumen_sentimiento: string | null;
  likes: number | null; comentarios: number | null; views: number | null;
  engagement: number | null;
  interacciones?: number | null;
  tipo: "ORGÁNICO" | "PAUTA" | null;
  content_type: string | null;
  followers: number | null;
  thumbnail_url: string | null; copy: string | null;
}
const avgA = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const engOf = (ps: CompetitorPost[]) => ps.map((p) => p.engagement).filter((e): e is number => e !== null && e !== undefined);
const interOf = (p: CompetitorPost) => p.interacciones ?? ((p.likes ?? 0) + (p.comentarios ?? 0));
const hasSent = (p: CompetitorPost) => p.positivo !== null && p.positivo !== undefined && !((p.positivo || 0) === 0 && (p.negativo || 0) === 0 && (p.neutro || 0) === 0);
export interface BrandStat { marca: string; posts: number; posts_per_week: number; engagement_promedio: number; engagement_disponible: boolean; interacciones_promedio: number; positivo: number; negativo: number; neutro: number; total_likes: number; total_comentarios: number; total_views: number; followers: number }
export function getLatestFollowers(fol: { marca: string; red_social: Red; followers: number }[], marca: string, red: string): number {
  if (red === "all") { const reds = [...new Set(fol.filter((s) => s.marca === marca).map((s) => s.red_social))]; return reds.reduce((s, r) => s + getLatestFollowers(fol, marca, r), 0); }
  const m = fol.filter((s) => s.marca === marca && s.red_social === red); return m.length ? m[0]!.followers : 0;
}
export function computeBrandStats(posts: CompetitorPost[], fol: { marca: string; red_social: Red; followers: number }[], redFilter = "all"): BrandStat[] {
  const dates = posts.map((p) => p.fecha).filter((d): d is string => !!d).sort();
  let weeks = 1;
  if (dates.length) { const a = new Date(`${dates[0]!.slice(0, 10)}T00:00:00Z`).getTime(), b = new Date(`${dates[dates.length - 1]!.slice(0, 10)}T00:00:00Z`).getTime(); weeks = Math.max(1, (b - a) / (7 * 864e5) + 1 / 7); }
  const marcas = [...new Set(posts.map((p) => p.marca))];
  return marcas.map((m) => {
    const bp = posts.filter((p) => p.marca === m);
    const ws = bp.filter(hasSent);
    const eg = engOf(bp);
    return { marca: m, posts: bp.length, posts_per_week: bp.length / weeks, engagement_promedio: avgA(eg), engagement_disponible: eg.length > 0, interacciones_promedio: avgA(bp.map(interOf)), positivo: avgA(ws.map((p) => p.positivo as number)), negativo: avgA(ws.map((p) => p.negativo as number)), neutro: avgA(ws.map((p) => p.neutro as number)), total_likes: bp.reduce((a, p) => a + (p.likes ?? 0), 0), total_comentarios: bp.reduce((a, p) => a + (p.comentarios ?? 0), 0), total_views: bp.reduce((a, p) => a + (p.views ?? 0), 0), followers: getLatestFollowers(fol, m, redFilter) };
  }).sort((a, b) => b.engagement_promedio - a.engagement_promedio);
}
const PILAR_PRIORITY = ["Producto", "Branding", "Promo", "Influencer", "Educacional"];
const PILAR_DISPLAY: Record<string, string> = { Promo: "Promoción", Educacional: "Educativo" };
export function normalizePilar(pilar: string | null): string | null {
  if (!pilar) return null;
  const parts = pilar.split("/").map((p) => p.trim()).filter(Boolean);
  if (!parts.length) return null;
  if (parts.length === 1) return PILAR_DISPLAY[parts[0]!] ?? parts[0]!;
  for (const pri of PILAR_PRIORITY) if (parts.some((p) => p.toLowerCase() === pri.toLowerCase())) return PILAR_DISPLAY[pri] ?? pri;
  return PILAR_DISPLAY[parts[0]!] ?? parts[0]!;
}
export interface PilarStat { pilar: string; engagement_promedio: number; interacciones_promedio: number; posts: number }
export function computePilarStats(posts: CompetitorPost[]): PilarStat[] {
  const norm = posts.map((p) => ({ ...p, pilar: normalizePilar(p.pilar) }));
  const pilars = [...new Set(norm.map((p) => p.pilar).filter(Boolean) as string[])];
  return pilars.map((pi) => { const pp = norm.filter((p) => p.pilar === pi); return { pilar: pi, engagement_promedio: avgA(engOf(pp)), interacciones_promedio: avgA(pp.map(interOf)), posts: pp.length }; }).sort((a, b) => b.engagement_promedio - a.engagement_promedio || b.interacciones_promedio - a.interacciones_promedio);
}

// ─────────────────────────── WEB ───────────────────────────
// Reportes con la forma de la GA4 Data API (BIP). En Drean se ARMAN desde las vistas mensuales
// precalculadas (adapters.webReportsFromDrean) — no se llama a GA4 ni a web_landing_daily.
export interface Ga4Row { dimensionValues: { value: string }[]; metricValues: { value: string }[] }
export interface Ga4Report { rows?: Ga4Row[] }
export interface WebReports {
  cur: Ga4Report; prev: Ga4Report; monthly: Ga4Report; daily: Ga4Report;
  chan: Ga4Report; chanDaily: Ga4Report; landing: Ga4Report; landingDaily: Ga4Report;
  items: Ga4Report; dev: Ga4Report; region: Ga4Report; pages: Ga4Report;
}
export const EMPTY_REPORT: Ga4Report = { rows: [] };
export type WebMonthlyKey = "trafico" | "avg_session" | "conversion" | "transacciones" | "ingresos" | "aov";
export function webMonthlyArr(rows: Ga4Row[] | undefined, year: number): { arr: Record<WebMonthlyKey, (number | null)[]>; hasEcom: boolean } {
  const n = (s?: string) => Number(s || 0);
  const m = new Map<number, { users: number; sessions: number; avgSession: number; tx: number; revenue: number; ke: number }>();
  for (const r of rows ?? []) {
    const ym = r.dimensionValues[0]?.value ?? "";
    if (ym.slice(0, 4) !== String(year)) continue;
    const v = r.metricValues;
    m.set(Number(ym.slice(4, 6)), { users: n(v[0]?.value), sessions: n(v[1]?.value), avgSession: n(v[3]?.value), tx: n(v[4]?.value), revenue: n(v[5]?.value), ke: n(v[6]?.value) });
  }
  const hasEcom = [...m.values()].some((v) => v.tx > 0 || v.revenue > 0);
  const arr: Record<WebMonthlyKey, (number | null)[]> = { trafico: [], avg_session: [], conversion: [], transacciones: [], ingresos: [], aov: [] };
  for (let i = 1; i <= 12; i++) {
    const v = m.get(i);
    arr.trafico.push(v ? v.users : null);
    arr.avg_session.push(v ? v.avgSession : null);
    arr.conversion.push(v ? (v.sessions > 0 ? ((hasEcom ? v.tx : v.ke) / v.sessions) * 100 : null) : null);
    arr.transacciones.push(v && hasEcom ? v.tx : null);
    arr.ingresos.push(v && hasEcom ? v.revenue : null);
    arr.aov.push(v && hasEcom ? (v.tx > 0 ? v.revenue / v.tx : null) : null);
  }
  return { arr, hasEcom };
}
export function seccionDePath(path: string): string {
  const segs = (path || "").toLowerCase().split(/[?#]/)[0]!.split("/").filter(Boolean);
  const s = /^[a-z]{2}([-_][a-z]{2})?$/.test(segs[0] ?? "") ? segs[1] : segs[0];
  if (!s) return "Home";
  let t = s;
  try { t = decodeURIComponent(s); } catch { /* path raro */ }
  t = t.replace(/[-_]+/g, " ").trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : "Home";
}
export const esPaginaProducto = (path: string): boolean => /\/(p|product|products|producto|productos|item|dp)\/[^/]+|-p-\d+|\/p\/?$/i.test(path || "");

export interface CompetitorDomain {
  dominio: string; marca: string; own: boolean;
  visitas: number; visitantes_unicos: number;
  bounce_rate: number; pages_per_visit: number; avg_visit_duration: number;
  delta_mom: number | null;
  fuentes: Record<string, number> | null;
  keywords_top: string[] | null;
  monthly: { mes: string; visitas: number }[];
  stale?: boolean;
}
export interface CompetitorWebData { domains: CompetitorDomain[]; updatedAt: string }

// ─────────────────────────── SEO ───────────────────────────
export interface ShareRow { categoria: string; marca: string; own: boolean; mes: string; vol: number; share_pct: number }
export interface DemandaRow { categoria: string; mes: string; search_volume: number }
export interface TrendRow { categoria: string; marca: string; fecha: string; interes: number }
export interface SerpRow { categoria: string; marca: string; tipo?: string; own: boolean; keyword: string; posicion: number | null; search_volume: number; url?: string | null; dominio?: string }
export interface RegionRow { categoria: string; marca: string; provincia: string; interes: number }
export interface LlmoRow { categoria: string; marca: string; own: boolean; menciones: number; prompts: number; share_pct: number; rank_prom: number | null; modelo?: string }
export interface SeoData {
  categorias: string[];
  generic: { categoria: string; keyword: string; volume: number }[];
  share: ShareRow[]; demanda: DemandaRow[]; trends: TrendRow[]; serp: SerpRow[]; regions: RegionRow[]; llmo: LlmoRow[];
  categoria: string; generic_keyword: string; generic_volume: number;
  brands: { marca: string; own: boolean; keyword: string; volume: number; share: number }[];
  monthly: { mes: string; total: number }[];
  updatedAt: string;
}

// Núcleo de buckets de keywords (competencia-core de BIP): faltante = no rankea · débil = 4-20 · fuerte = top-3.
export const DEBIL_MIN = 4;
export const DEBIL_MAX = 20;
export interface SerpLike { keyword: string; marca: string; own: boolean; posicion: number | null; search_volume: number }
export interface KeywordBucketsCore {
  universo: Map<string, number>;
  faltantes: { keyword: string; vol: number; lider: string; posLider: number | null }[];
  debiles: { keyword: string; vol: number; pos: number; lider: string | null }[];
  fuertes: { keyword: string; vol: number; pos: number }[];
  volTotal: number;
}
export function keywordBucketsCore(rows: SerpLike[], ownMarca?: string): KeywordBucketsCore {
  const universo = new Map<string, number>();
  const own = new Map<string, number | null>();
  const best = new Map<string, { marca: string; pos: number }>();
  const isOwn = (r: SerpLike) => (ownMarca ? r.marca === ownMarca : r.own);
  for (const r of rows) {
    if (!r.keyword || r.keyword.trim().length <= 2) continue;
    if (!universo.has(r.keyword)) universo.set(r.keyword, r.search_volume ?? 0);
    if (isOwn(r)) {
      const prev = own.get(r.keyword) ?? null;
      if (r.posicion != null && (prev == null || r.posicion < prev)) own.set(r.keyword, r.posicion);
      else if (!own.has(r.keyword)) own.set(r.keyword, null);
    } else if (r.posicion != null) {
      const b = best.get(r.keyword);
      if (!b || r.posicion < b.pos) best.set(r.keyword, { marca: r.marca, pos: r.posicion });
    }
  }
  const out: KeywordBucketsCore = { universo, faltantes: [], debiles: [], fuertes: [], volTotal: [...universo.values()].reduce((a, b) => a + b, 0) };
  for (const [kw, vol] of universo) {
    const p = own.get(kw) ?? null;
    if (p == null) out.faltantes.push({ keyword: kw, vol, lider: best.get(kw)?.marca ?? "—", posLider: best.get(kw)?.pos ?? null });
    else if (p < DEBIL_MIN) out.fuertes.push({ keyword: kw, vol, pos: p });
    else if (p <= DEBIL_MAX) out.debiles.push({ keyword: kw, vol, pos: p, lider: best.get(kw)?.marca ?? null });
  }
  const byVol = <T extends { vol: number }>(a: T, b: T) => b.vol - a.vol;
  out.faltantes.sort(byVol); out.debiles.sort(byVol); out.fuertes.sort(byVol);
  return out;
}

// ─────────────────────────── KPIs DE MERCADO (mercado-kpis de BIP) ───────────────────────────
const ABSENT = 100;
const ym = (s: string) => String(s ?? "").slice(0, 7);
export function sosMonthly(seo: Pick<SeoData, "share"> | null | undefined): { mes: string; share: number; volPropio: number; volTotal: number }[] {
  const m = new Map<string, { own: number; tot: number }>();
  for (const r of seo?.share ?? []) {
    const k = ym(r.mes);
    if (!k) continue;
    const e = m.get(k) ?? { own: 0, tot: 0 };
    e.tot += r.vol ?? 0;
    if (r.own) e.own += r.vol ?? 0;
    m.set(k, e);
  }
  return [...m.entries()].filter(([, e]) => e.tot > 0).sort(([a], [b]) => a.localeCompare(b))
    .map(([mes, e]) => ({ mes, share: (e.own / e.tot) * 100, volPropio: e.own, volTotal: e.tot }));
}
export function demandaMonthly(seo: Pick<SeoData, "demanda"> | null | undefined): { mes: string; busquedas: number }[] {
  const m = new Map<string, number>();
  for (const d of seo?.demanda ?? []) { const k = ym(d.mes); if (k) m.set(k, (m.get(k) ?? 0) + (d.search_volume ?? 0)); }
  return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([mes, busquedas]) => ({ mes, busquedas }));
}
export function seoPositionIndex(seo: Pick<SeoData, "serp"> | null | undefined): { propio: number | null; porMarca: { marca: string; propia: boolean; indice: number }[] } {
  const rows = (seo?.serp ?? []).filter((r) => r.keyword && r.keyword.trim().length > 2);
  if (!rows.length) return { propio: null, porMarca: [] };
  const cats = [...new Set(rows.map((r) => r.categoria))];
  const acc = new Map<string, { own: boolean; num: number; den: number }>();
  for (const cat of cats) {
    const cr = rows.filter((r) => r.categoria === cat);
    const universo = new Map<string, number>();
    for (const r of cr) if (!universo.has(r.keyword)) universo.set(r.keyword, r.search_volume ?? 0);
    const volTot = [...universo.values()].reduce((s, v) => s + v, 0);
    if (!volTot) continue;
    const pos = new Map<string, number>();
    const marcas = new Map<string, boolean>();
    for (const r of cr) { marcas.set(r.marca, r.own); if (r.posicion != null) { const k = `${r.marca}|${r.keyword}`; const p = pos.get(k); if (p == null || r.posicion < p) pos.set(k, r.posicion); } }
    for (const [marca, own] of marcas) {
      let s = 0;
      for (const [kw, v] of universo) s += v * (pos.get(`${marca}|${kw}`) ?? ABSENT);
      const e = acc.get(marca) ?? { own, num: 0, den: 0 };
      e.num += s; e.den += volTot; acc.set(marca, e);
    }
  }
  const porMarca = [...acc.entries()].filter(([, e]) => e.den > 0).map(([marca, e]) => ({ marca, propia: e.own, indice: e.num / e.den })).sort((a, b) => a.indice - b.indice);
  return { propio: porMarca.find((m) => m.propia)?.indice ?? null, porMarca };
}
export function llmoPropio(seo: Pick<SeoData, "llmo"> | null | undefined): number | null {
  const own = (seo?.llmo ?? []).filter((l) => l.own && (l.prompts ?? 0) > 0);
  if (!own.length) return null;
  return own.reduce((s, l) => s + (l.share_pct ?? 0), 0) / own.length;
}
export interface ShareEngagement {
  desde: string; hasta: string; dias: number; propia: string; sharePropio: number; total: number;
  porMarca: { marca: string; propia: boolean; interacciones: number; posts: number; share: number; porPost: number }[];
  mensual: { mes: string; share: number; propio: number; total: number }[];
  redes: string[];
}
const inter = (p: CompetitorPost) => (p.likes ?? 0) + (p.comentarios ?? 0);
/** Share of engagement en la ventana común de todas las marcas (null si no hay posts propios o la ventana < 14 días). */
export function shareOfEngagement(posts: CompetitorPost[] | null | undefined, ownBrand: string | null | undefined): ShareEngagement | null {
  const ps = (posts ?? []).filter((p) => p.fecha && /^\d{4}-\d{2}-\d{2}/.test(p.fecha));
  if (!ownBrand || !ps.some((p) => p.marca === ownBrand)) return null;
  const redes = [...new Set(ps.filter((p) => p.marca === ownBrand).map((p) => p.red_social))];
  const inWin: CompetitorPost[] = [];
  let gDesde = "", gHasta = "";
  const usadas: string[] = [];
  for (const red of redes) {
    const rp = ps.filter((p) => p.red_social === red);
    const byBrand = new Map<string, string[]>();
    for (const p of rp) byBrand.set(p.marca, [...(byBrand.get(p.marca) ?? []), p.fecha!.slice(0, 10)]);
    const activos = [...byBrand.entries()].filter(([, f]) => f.length >= 3);
    if (!activos.some(([m]) => m === ownBrand) || activos.length < 2) continue;
    const desde = activos.map(([, f]) => [...f].sort()[0]!).sort().pop()!;
    const hasta = rp.map((p) => p.fecha!.slice(0, 10)).sort().pop()!;
    const dias = (Date.parse(hasta) - Date.parse(desde)) / 864e5;
    if (dias < 14) continue;
    const marcasOk = new Set(activos.map(([m]) => m));
    inWin.push(...rp.filter((p) => marcasOk.has(p.marca) && p.fecha!.slice(0, 10) >= desde));
    usadas.push(red);
    if (!gDesde || desde < gDesde) gDesde = desde;
    if (!gHasta || hasta > gHasta) gHasta = hasta;
  }
  const total = inWin.reduce((s, p) => s + inter(p), 0);
  if (!inWin.length || total <= 0) return null;
  const bm = new Map<string, { i: number; n: number }>();
  for (const p of inWin) { const e = bm.get(p.marca) ?? { i: 0, n: 0 }; e.i += inter(p); e.n++; bm.set(p.marca, e); }
  const porMarca = [...bm.entries()].map(([marca, e]) => ({ marca, propia: marca === ownBrand, interacciones: e.i, posts: e.n, share: (e.i / total) * 100, porPost: e.n ? e.i / e.n : 0 })).sort((a, b) => b.share - a.share);
  const mm = new Map<string, { own: number; tot: number }>();
  for (const p of inWin) { const k = p.fecha!.slice(0, 7); const e = mm.get(k) ?? { own: 0, tot: 0 }; e.tot += inter(p); if (p.marca === ownBrand) e.own += inter(p); mm.set(k, e); }
  const mensual = [...mm.entries()].filter(([, e]) => e.tot > 0).sort(([a], [b]) => a.localeCompare(b)).map(([mes, e]) => ({ mes, share: (e.own / e.tot) * 100, propio: e.own, total: e.tot }));
  return { desde: gDesde, hasta: gHasta, dias: Math.round((Date.parse(gHasta) - Date.parse(gDesde)) / 864e5), propia: ownBrand, sharePropio: porMarca.find((b) => b.propia)?.share ?? 0, total, porMarca, mensual, redes: usadas };
}

// ─────────────────────────── SEARCH CONSOLE (Drean no lo tiene: siempre null) ───────────────────────────
export interface ScRow { key: string; clicks: number; impressions: number; ctr: number; position: number }
export interface ScQueryPage { query: string; page: string; clicks: number; impressions: number; ctr: number; position: number }
export interface ScMonth { mes: string; clicks: number; impressions: number; ctr: number; position: number; dias: number }
export interface SearchConsoleData { v: 1; ok: boolean; code?: string; monthly?: ScMonth[]; queries?: ScRow[]; pages?: ScRow[]; queryPage?: ScQueryPage[]; updatedAt: string }
export function ctrEsperado(pos: number): number {
  const t = [0, 28, 15, 10, 7, 5, 4, 3, 2.5, 2, 1.8];
  if (!Number.isFinite(pos) || pos <= 1) return t[1]!;
  if (pos <= 10) { const lo = Math.floor(pos), hi = Math.ceil(pos); return t[lo]! + (t[hi]! - t[lo]!) * (pos - lo); }
  return pos <= 20 ? 1 : 0.3;
}
const medianA = (xs: number[]) => { const a = [...xs].sort((x, y) => x - y); if (!a.length) return 0; const m = Math.floor(a.length / 2); return a.length % 2 ? a[m]! : (a[m - 1]! + a[m]!) / 2; };
export interface ScCtrOpp extends ScRow { ctrEsperado: number; clicksExtra: number; pagina: string | null }
export interface ScQuickWin extends ScRow { clicksExtra: number; pagina: string | null }
export interface ScAnalysis {
  totales: { clicks: number; impressions: number; ctr: number; position: number } | null;
  ultimoMes: ScMonth | null;
  ctrBajo: ScCtrOpp[]; quickWins: ScQuickWin[];
  marca: { clicksMarca: number; clicksGenerico: number; shareGenerico: number } | null;
}
function paginaDe(d: SearchConsoleData, query: string): string | null {
  const q = query.trim().toLowerCase();
  const rows = (d.queryPage ?? []).filter((r) => r.query.trim().toLowerCase() === q).sort((a, b) => b.impressions - a.impressions);
  return rows[0]?.page ?? null;
}
export function analyzeSearchConsole(d: SearchConsoleData | null | undefined, ownBrand?: string | null): ScAnalysis {
  const empty: ScAnalysis = { totales: null, ultimoMes: null, ctrBajo: [], quickWins: [], marca: null };
  if (!d?.ok) return empty;
  const qs = d.queries ?? [];
  const cerrados = (d.monthly ?? []).filter((m) => m.dias >= 20);
  const ultimoMes = cerrados[cerrados.length - 1] ?? null;
  const tc = qs.reduce((s, r) => s + r.clicks, 0), ti = qs.reduce((s, r) => s + r.impressions, 0);
  const totales = ti > 0 ? { clicks: tc, impressions: ti, ctr: (tc / ti) * 100, position: qs.reduce((s, r) => s + r.position * r.impressions, 0) / ti } : null;
  const minImpr = Math.max(50, medianA(qs.map((r) => r.impressions)));
  const ctrBajo = qs.filter((r) => r.position <= 5 && r.impressions >= minImpr && r.ctr < ctrEsperado(r.position) * 0.6)
    .map((r) => ({ ...r, ctrEsperado: ctrEsperado(r.position), clicksExtra: Math.round(r.impressions * (ctrEsperado(r.position) - r.ctr) / 100), pagina: paginaDe(d, r.key) }))
    .sort((a, b) => b.clicksExtra - a.clicksExtra).slice(0, 10);
  const quickWins = qs.filter((r) => r.position >= 8 && r.position <= 20 && r.impressions >= minImpr)
    .map((r) => ({ ...r, clicksExtra: Math.max(0, Math.round(r.impressions * (ctrEsperado(3) - r.ctr) / 100)), pagina: paginaDe(d, r.key) }))
    .sort((a, b) => b.clicksExtra - a.clicksExtra).slice(0, 10);
  let marca: ScAnalysis["marca"] = null;
  const b = (ownBrand ?? "").trim().toLowerCase();
  if (b.length >= 3 && tc > 0) {
    const cm = qs.filter((r) => r.key.toLowerCase().includes(b)).reduce((s, r) => s + r.clicks, 0);
    marca = { clicksMarca: cm, clicksGenerico: tc - cm, shareGenerico: ((tc - cm) / tc) * 100 };
  }
  return { totales, ultimoMes, ctrBajo, quickWins, marca };
}

// Correlación de Pearson (chat/calc de BIP).
export function pearson(xs: number[], ys: number[]): number | null {
  const n = xs.length;
  if (n < 3) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { const dx = xs[i]! - mx, dy = ys[i]! - my; sxy += dx * dy; sxx += dx * dx; syy += dy * dy; }
  return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : null;
}

// ─────────────────────────── SEGUIMIENTO DE OBJETIVOS ───────────────────────────
// Forma que consume la regla de overview (BIP). En Drean se arma con getSeguimientoObjetivos
// + getSeguimientoKpis (memoizado por request con React cache()).
export interface KpiSegLite {
  plan: string; kpi: string; medida?: string; unit?: string; tipo: "sum" | "rate";
  realM: (number | null)[]; metaM: (number | null)[];
  direccion: "up" | "down";
}
export interface ObjAporteLite { kpi: string; peso: number; cumpl: number | null }
export interface ObjetivoLite { id: string; nombre: string; pesoEstrategico: number; cumplMes: number | null; cumplYtd: number | null; cobertura: number; aportes: ObjAporteLite[] }
export interface SeguimientoObjetivos {
  disponible: boolean;
  refMes: string;
  objetivos: ObjetivoLite[];
  saludMarca: { cumplMes: number | null; cumplYtd: number | null; cumplSerie?: (number | null)[] };
  kpis: KpiSegLite[];
}
export function cumplimientoPct(actual: number, meta: number, dir: "up" | "down"): number | null {
  if (!meta) return null;
  return dir === "up" ? (actual / meta) * 100 : (meta / actual) * 100;
}
