// ============================================================================
// ADAPTADORES Drean → modelo de señales de BIP (puros, sin server-only, testeables con
// scripts/signals-drean.test.ts). Reciben filas YA leídas por lib/signals/sources.ts
// (fuentes baratas/precalculadas) y arman las formas que consumen las reglas portadas.
//
// PAUTA (buildPautaFull):
//  · Serie mensual = buildPautaMediosMensual (MISMO gap-fill que /performance y el Seguimiento:
//    OMD solo para medios sin API; Meta siempre por la API; DV360 USD→ARS con fx del mes; solo
//    meses cerrados). Performance Max se excluye (Pauta Mkt no mezcla ecommerce).
//  · Digital = Meta, TikTok, YouTube, Programmatic, Google Search/Demand Gen, Mercado Ads, Geo…
//    Offline = TV / OOH / DOOH / radio / vía pública / gráfica (sus impresiones van a `contOff`).
//  · Campañas: Meta por campaign_name (incluye UGC), DV360 por canal×categoría×rol, Google por
//    canal×categoría, OMD sin API por medio×categoría×objetivo; mismo criterio de gap-fill por mes.
// ============================================================================
import { buildPautaMediosMensual, DV360_MEDIO, PAUTA_MES_FULL, type PautaOmdLite, type GoogleAdsLite, type Dv360ReachLite } from "../pauta-medios-model";
import { esMedioApi } from "../pauta-medios";
import type { MetaPaidCreativeRow } from "../meta-paid-queries";
import type { Dv360CreativeRow } from "../dv360-data";
import type {
  PautaFull, PautaMonth, CampaignRow, CreativeRow, OfflineSummary, OfflineMedioRow,
  IgOrganicSummary, FbOrganicSummary, SocialPostLite, FbPost, CompetitorPost, Red,
  WebReports, Ga4Row, CompetitorWebData, CompetitorDomain,
  SeoData, ShareRow, SerpRow, LlmoRow, RegionRow, DemandaRow, TrendRow,
  SeguimientoObjetivos, KpiSegLite,
} from "./model";
import { EMPTY_TOTALS, derive, byObjectiveOf, EMPTY_REPORT } from "./model";
import type { SentimentLite } from "./redes";

const MES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const n0 = (v: number | null | undefined) => (typeof v === "number" && Number.isFinite(v) ? v : Number(v ?? 0) || 0);

// ─────────────────────────── PAUTA ───────────────────────────
export const OFFLINE_RE = /\b(tv|television|televisi[oó]n|ooh|dooh|radio|cine|v[ií]a p[úu]blica|gr[aá]fica|revista|diario|prensa|out of home)\b/i;
export const isOfflineMedio = (medio: string) => OFFLINE_RE.test(medio);
const isPmax = (canal: string) => /pmax|performance ?max/i.test(canal);

export interface PautaAdapterInput {
  pauta: (PautaOmdLite & { categoria?: string | null; objetivo?: string | null })[];
  metaPaid: MetaPaidCreativeRow[];
  dv360: Dv360CreativeRow[];
  dv360Reach: Dv360ReachLite[];
  googleAdsOmd: (GoogleAdsLite & { categoria?: string | null })[];
  fxRates: Record<string, number>;
  anio: number;
  now: Date;
}

interface Acc { spend: number; impressions: number; reach: number; clicks: number; plays: number; p25: number; p50: number; p75: number; p100: number; thruplay: number; vbase: number }
const emptyAcc = (): Acc => ({ spend: 0, impressions: 0, reach: 0, clicks: 0, plays: 0, p25: 0, p50: 0, p75: 0, p100: 0, thruplay: 0, vbase: 0 });
function toCampaign(id: string, name: string, objective: string | null, medio: string, a: Acc, extra: Partial<CampaignRow> = {}): CampaignRow {
  const d = derive(a);
  return {
    id, name, objective, medio, currency: "ARS",
    spend: a.spend, impressions: a.impressions, reach: a.reach, clicks: a.clicks,
    cpm: d.cpm, cpc: d.cpc, ctr: d.ctr, frequency: d.frequency, vtr50: d.vtr50, vtr100: d.vtr100,
    cpmEf: a.p100 > 0 ? (a.spend / a.p100) * 1000 : 0, vbase: a.vbase, p25: a.p25, p50: a.p50, p75: a.p75, p100: a.p100, plays: a.plays,
    ...extra,
  };
}
const slug = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 60);
const rolObjective = (rol: string | null | undefined) => {
  const r = (rol ?? "").toLowerCase();
  if (/aware|alcance|brand|video|view/.test(r)) return "AWARENESS";
  if (/conv|venta|sales/.test(r)) return "CONVERSION";
  return rol ? rol.toUpperCase() : "CONSIDERATION";
};

export function buildPautaFull(inp: PautaAdapterInput): PautaFull {
  const { anio, now } = inp;
  const currentMonth = now.getUTCFullYear() > anio ? 13 : now.getUTCFullYear() < anio ? 1 : now.getUTCMonth() + 1;
  const gads = inp.googleAdsOmd.filter((r) => !isPmax(r.canal));
  const meses = buildPautaMediosMensual({ pauta: inp.pauta, metaPaid: inp.metaPaid, dv360: inp.dv360, dv360Reach: inp.dv360Reach, googleAdsOmd: gads, fxRates: inp.fxRates, anio, currentMonth });

  // ── Serie mensual (digital vs offline) ──
  const monthly: PautaMonth[] = [];
  for (const m of meses) {
    if (!m) continue;
    let inv = 0, invOff = 0, impr = 0, contOff = 0, alc = 0, clic = 0, imprReach = 0, invConImpr = 0;
    const invBy: Record<string, number> = {};
    for (const [medio, e] of Object.entries(m.medios)) {
      inv += e.inv; invBy[medio] = (invBy[medio] ?? 0) + e.inv;
      if (isOfflineMedio(medio)) { invOff += e.inv; contOff += e.impr; continue; }
      impr += e.impr; clic += e.clic; alc += e.alc;
      if (e.impr > 0) invConImpr += e.inv;
      if (e.alc > 0) imprReach += e.impr;
    }
    monthly.push({ mes: `${MES[m.mesIdx]} ${String(anio).slice(2)}`, mesIdx: m.mesIdx, inv, alc, impr, clic, v50: m.tot.v50, vbase: m.tot.vbase, imprReach, invOff, contOff, invBy, invConImpr });
  }

  // ── Medios OMD presentes (con impresiones) por mes → la API de ese medio no suma (gap-fill) ──
  const fxVals = Object.values(inp.fxRates);
  const fxFallback = fxVals.length ? fxVals[fxVals.length - 1]! : 1;
  const omdPresent = new Map<string, Set<string>>(); // mesLabel → medios
  for (const r of inp.pauta) {
    if (esMedioApi(r.medio) || !(n0(r.impresiones) > 0)) continue;
    const s = omdPresent.get(r.mes) ?? new Set<string>(); s.add(r.medio); omdPresent.set(r.mes, s);
  }
  const mesIdxOfLabel = (label: string) => { const [full, y] = label.split(" "); return Number(y) === anio ? PAUTA_MES_FULL.indexOf(full ?? "") : -1; };
  const labelOfIso = (iso: string) => { const y = Number(iso.slice(0, 4)), mi = Number(iso.slice(5, 7)) - 1; return y === anio && mi >= 0 ? `${PAUTA_MES_FULL[mi]} ${anio}` : ""; };
  const closedLabel = (label: string) => { const i = mesIdxOfLabel(label); return i >= 0 && i + 1 < currentMonth; };
  const inYear = (label: string) => mesIdxOfLabel(label) >= 0;

  const camps = new Map<string, { name: string; objective: string | null; medio: string; a: Acc; extra?: Partial<CampaignRow> }>();
  const addC = (id: string, name: string, objective: string | null, medio: string, f: (a: Acc) => void, extra?: Partial<CampaignRow>) => {
    const c = camps.get(id) ?? { name, objective, medio, a: emptyAcc(), extra };
    f(c.a); camps.set(id, c);
  };

  // Meta / TikTok por la API (incluye UGC).
  const creatives = new Map<string, { row: MetaPaidCreativeRow; a: Acc; reactions: number; comments: number; shares: number; saves: number; active: boolean }>();
  for (const r of inp.metaPaid) {
    if (!inYear(r.mes)) continue;
    const medio = r.plataforma === "meta" ? "Meta" : r.plataforma === "tiktok" ? "TikTok" : null;
    if (!medio || omdPresent.get(r.mes)?.has(medio)) continue;
    const isVid = n0(r.video_p25) + n0(r.video_p50) + n0(r.video_p75) > 0;
    const fill = (a: Acc) => {
      a.spend += n0(r.spend); a.impressions += n0(r.impresiones); a.reach += n0(r.alcance); a.clicks += n0(r.clicks);
      a.plays += n0(r.video_plays); a.p25 += n0(r.video_p25); a.p50 += n0(r.video_p50); a.p75 += n0(r.video_p75); a.p100 += n0(r.video_p100); a.thruplay += n0(r.video_thruplay);
      if (isVid) a.vbase += n0(r.impresiones);
    };
    const cname = r.campaign_name || r.adset_name || "(sin campaña)";
    // Campañas de views/ThruPlay con objetivo ENGAGEMENT (ej. "MABE_Drean_Views_…"): son video, no tráfico.
    const obj = /ENGAGEMENT/i.test(r.objective ?? "") && /views?|thruplay|video/i.test(cname) ? "VIDEO_VIEWS" : r.objective;
    addC(`${medio === "Meta" ? "meta" : slug(medio)}_${slug(cname)}`, cname, obj, medio, fill, { categoria: r.categoria });
    if (medio === "Meta") {
      const k = r.ad_id;
      const c = creatives.get(k) ?? { row: r, a: emptyAcc(), reactions: 0, comments: 0, shares: 0, saves: 0, active: false };
      fill(c.a); c.reactions += n0(r.reactions); c.comments += n0(r.comments); c.shares += n0(r.shares); c.saves += n0(r.saves);
      c.active = c.active || r.activa === true;
      creatives.set(k, c);
    }
  }
  // DV360 (YouTube / Programmatic / Marketplace→Mercado Ads).
  for (const r of inp.dv360) {
    const label = labelOfIso(r.mes);
    if (!label) continue;
    const medio = DV360_MEDIO[r.canal] ?? r.canal;
    if (omdPresent.get(label)?.has(medio)) continue;
    const fx = inp.fxRates[r.mes] ?? fxFallback;
    const name = `DV360 ${r.canal} · ${r.categoria || "—"} · ${r.rol || "—"}`;
    // YouTube (DV360) es VIDEO: su "Consideración" son views, no tráfico → rol Awareness en las reglas.
    addC(`dv_${slug(name)}`, name, r.canal === "YouTube" ? `VIDEO_${(r.rol ?? "").toUpperCase()}` : rolObjective(r.rol), medio, (a) => {
      a.spend += n0(r.revenue_usd) * fx; a.impressions += n0(r.impresiones); a.clicks += n0(r.clicks);
      a.plays += n0(r.starts); a.p25 += n0(r.q25); a.p50 += n0(r.q50); a.p75 += n0(r.q75); a.p100 += n0(r.q100);
      if (n0(r.starts) > 0) a.vbase += n0(r.impresiones);
    }, { categoria: r.categoria });
  }
  // Google Ads (Search / Demand Gen; PMax excluido). medio "Google" (regla Meta vs Google de BIP).
  for (const r of gads) {
    if (!inYear(r.mes) || omdPresent.get(r.mes)?.has(r.canal)) continue;
    const name = `${r.canal} · ${r.categoria ?? "—"}`;
    const objective = /search/i.test(r.canal) ? "SEARCH" : /demand/i.test(r.canal) ? "DEMAND_GEN" : r.canal.toUpperCase();
    addC(`g_${slug(name)}`, name, objective, "Google", (a) => { a.spend += n0(r.costo); a.impressions += n0(r.impresiones); a.clicks += n0(r.clicks); }, { categoria: r.categoria ?? null });
  }
  // OMD (medios sin API): digitales como campañas, offline como filas offline. Solo meses cerrados
  // (las filas de meses futuros son PLAN, no ejecución).
  const offRows = new Map<string, { medio: string; categoria: string; spend: number; contactos: number; meses: Set<string> }>();
  for (const r of inp.pauta) {
    if (esMedioApi(r.medio) || !closedLabel(r.mes)) continue;
    const spend = n0(r.inversion);
    if (isOfflineMedio(r.medio)) {
      const k = `${r.medio}|${r.categoria ?? "—"}`;
      const e = offRows.get(k) ?? { medio: r.medio, categoria: r.categoria ?? "—", spend: 0, contactos: 0, meses: new Set<string>() };
      e.spend += spend; e.contactos += n0(r.impresiones); e.meses.add(r.mes); offRows.set(k, e);
      continue;
    }
    const name = `${r.medio} · ${r.categoria ?? "—"} · ${r.objetivo ?? "—"}`;
    addC(`omd_${slug(name)}`, name, rolObjective(r.objetivo), r.medio, (a) => {
      a.spend += spend; a.impressions += n0(r.impresiones); a.reach += n0(r.alcance); a.clicks += n0(r.clics);
    }, { categoria: r.categoria ?? null });
  }

  // Filas OMD digitales con inversión y SIN impresiones = performance todavía no cargada (no es una campaña
  // "mal configurada"): quedan fuera de las reglas por campaña y se reportan como aviso de datos.
  const warnings: string[] = [];
  const byCampaign: CampaignRow[] = [];
  for (const [id, c] of camps) {
    if (id.startsWith("omd_") && c.a.impressions <= 0 && c.a.spend > 0) { warnings.push(`${c.name}: $${Math.round(c.a.spend).toLocaleString("es-AR")} sin impresiones cargadas (OMD)`); continue; }
    if (c.a.spend > 0 || c.a.impressions > 0) byCampaign.push(toCampaign(id, c.name, c.objective, c.medio, c.a, c.extra));
  }
  // Filas offline.
  const offTotal = [...offRows.values()].reduce((s, e) => s + e.spend, 0);
  for (const e of offRows.values()) {
    byCampaign.push({
      ...toCampaign(`off_${slug(`${e.medio}_${e.categoria}`)}`, `${e.medio} · ${e.categoria}`, "AWARENESS", e.medio, emptyAcc()),
      spend: e.spend, offline: true, categoria: e.categoria, soporte: e.medio, contactos: e.contactos,
      cpmContactos: e.contactos > 0 ? (e.spend / e.contactos) * 1000 : null,
    });
  }
  byCampaign.sort((a, b) => b.spend - a.spend);

  // Totales DIGITALES (alcance/frecuencia: solo Meta, como en BIP).
  const dig = byCampaign.filter((c) => !c.offline);
  const t = dig.reduce((a, c) => { a.spend += c.spend; a.impressions += c.impressions; a.clicks += c.clicks; a.plays += c.plays; a.p25 += c.p25; a.p50 += c.p50; a.p75 += c.p75; a.p100 += c.p100; a.vbase += c.vbase; if (c.medio === "Meta") a.reach += c.reach; return a; }, emptyAcc());
  const metaImpr = dig.filter((c) => c.medio === "Meta").reduce((s, c) => s + c.impressions, 0);
  const d = derive(t);
  const totals = { ...EMPTY_TOTALS, ...t, ...d, frequency: t.reach > 0 ? metaImpr / t.reach : 0, spend: t.spend + offTotal, spendOffline: offTotal, contactosOffline: [...offRows.values()].reduce((s, e) => s + e.contactos, 0) };

  // Offline summary.
  let offline: OfflineSummary | undefined;
  if (offRows.size) {
    const byMedio = new Map<string, OfflineMedioRow>();
    for (const e of offRows.values()) {
      const m = byMedio.get(e.medio) ?? { medio: e.medio, spend: 0, contactos: 0, grps: 0, spots: 0, alcance: 0, alcancePct: 0, frecuencia: null, cpmContactos: null, cpp: null, shareOffline: 0, filas: 0, soportes: 0 };
      m.spend += e.spend; m.contactos += e.contactos; m.filas++; m.soportes++;
      byMedio.set(e.medio, m);
    }
    const rows = [...byMedio.values()].map((m) => ({ ...m, cpmContactos: m.contactos > 0 ? (m.spend / m.contactos) * 1000 : null, shareOffline: offTotal ? (m.spend / offTotal) * 100 : 0 })).sort((a, b) => b.spend - a.spend);
    const mesesSet = new Set<string>();
    for (const e of offRows.values()) for (const ml of e.meses) { const i = mesIdxOfLabel(ml); if (i >= 0) mesesSet.add(`${anio}-${String(i + 1).padStart(2, "0")}`); }
    offline = { datasetId: "pauta_performance", datasetName: "Plan de medios OMD (offline)", currency: "ARS", filas: offRows.size, descartadas: 0, motivos: [], meses: [...mesesSet].sort(), mesesFuturos: 0, contactosComparables: false, byMedio: rows, totals: { spend: offTotal, contactos: totals.contactosOffline ?? 0, grps: 0, spots: 0 } };
  }

  // Top creativos (Meta, incluye UGC) por inversión.
  const topCreatives: CreativeRow[] = [...creatives.values()].map(({ row, a, reactions, comments, shares, saves, active }) => {
    const dd = derive(a);
    return {
      id: row.ad_id, name: row.ad_name || row.campaign_name || row.ad_id, thumbnail: row.thumbnail_url || row.image_url || null,
      permalink: row.instagram_permalink_url || row.permalink_url || null, adUrl: null, objective: row.objective, active,
      spend: a.spend, impressions: a.impressions, clicks: a.clicks, reach: a.reach, frequency: a.reach > 0 ? a.impressions / a.reach : 0,
      cpm: dd.cpm, cpc: dd.cpc, ctr: dd.ctr, videoViews: a.plays, vtr50: dd.vtr50, vtr100: dd.vtr100, reactions, comments, shares, saves,
    };
  }).sort((a, b) => b.spend - a.spend).slice(0, 30);

  const medios = [...new Set([...byCampaign.map((c) => c.medio ?? "Meta")])];
  const last = monthly[monthly.length - 1];
  return {
    ok: monthly.length > 0 || byCampaign.length > 0,
    currency: "ARS",
    monthly,
    rangeLabel: `${anio} (meses cerrados${last ? ` hasta ${last.mes}` : ""})`,
    totals, byCampaign, byObjective: byObjectiveOf(byCampaign), topCreatives,
    medios, mixedCurrency: false, offline,
    ...(warnings.length ? { warnings } : {}),
  };
}

// ─────────────────────────── REDES ───────────────────────────
export interface MetaPostRowLite { post_id: string; fecha_post: string; permalink: string | null; message: string | null; media_type: string | null; thumbnail_url: string | null; reach: number | null; engagement: number | null; reactions?: number | null; clicks?: number | null }
export interface DreanMonthly { mes: string; alcance: number | null; engagement: number | null; guardados?: number | null; comentarios?: number | null; clicks?: number | null }
export interface SocialPostRowLite { red_social: string; url: string; marca: string; fecha: string | null; pilar: string | null; positivo: number | null; negativo: number | null; neutro: number | null; resumen_sentimiento: string | null; likes: number | null; comentarios: number | null; views: number | null; engagement: number | null; tipo: string | null; content_type: string | null; followers: number | null; thumbnail_url: string | null; copy: string | null }
export interface FollowerRowLite { marca: string; red_social: string; fecha: string; followers: number }

export interface RedesAdapterInput {
  year: number;
  refDate: Date;
  igPosts: MetaPostRowLite[];           // posts IG (ventana ~120 días) de meta_posts
  igMonthly: DreanMonthly[];            // getIgOrganicSummary(año).monthlyData (12, índice = mes)
  fbPosts: MetaPostRowLite[];           // getFbOrganicSummary(año).topPosts (YA sin pagos: isPaidOutlier)
  fbMonthly: DreanMonthly[];            // getFbOrganicSummary(año).monthlyData (con las cotas de reach)
  fbFans?: number | null;
  social: SocialPostRowLite[];          // social_posts (competencia + propia)
  followers: FollowerRowLite[];         // social_followers
  ownKey: string;                       // "dreanargentina"
  labels: Record<string, string>;       // handle → marca visible
  igDemo?: { age: { category: string; value: number; pct: number }[]; gender: { category: string; value: number; pct: number }[]; province: { category: string; value: number; pct: number }[] };
}
export interface RedesAdapted { ig: IgOrganicSummary | null; fb: FbOrganicSummary | null; sentiment: SentimentLite[]; competitor: { posts: CompetitorPost[]; followers: { marca: string; red_social: Red; followers: number }[]; ownBrand: string } | null; refDate: Date }

const monthlyOf = (xs: DreanMonthly[], year: number) => xs.map((m, i) => ({ mes: m.mes, anio: year, mesIdx: i, alcance: m.alcance, engagement: m.engagement, guardados: m.guardados ?? null, comentarios: m.comentarios ?? null, clicks: m.clicks ?? null }));

export function buildRedesInput(inp: RedesAdapterInput): RedesAdapted {
  // IG: las Stories no entran a las reglas por pieza (su interacción no se mide igual → ER≈0 distorsiona
  // medianas y formatos); sí están en la serie mensual del dash.
  const igPosts: SocialPostLite[] = inp.igPosts.filter((p) => !/STORY/i.test(p.media_type ?? "")).map((p) => ({ id: p.post_id, permalink: p.permalink, caption: p.message, media_type: p.media_type, thumbnail: p.thumbnail_url, timestamp: p.fecha_post, reach: n0(p.reach), engagement: n0(p.engagement) }));
  // FB: interacciones = reacciones + comentarios&compartidos + clicks (mismo criterio que el dash).
  // FB: reach LIFETIME que madura ~50-60 días (CLAUDE.md → FB REACH NO CONFIABLE): solo posts con ≥ 60 días,
  // así las comparaciones por pieza no confunden maduración con caída.
  const fbMature = inp.refDate.getTime() - 60 * 864e5;
  const fbPosts: FbPost[] = inp.fbPosts.filter((p) => Date.parse(p.fecha_post) <= fbMature).map((p) => ({ id: p.post_id, permalink: p.permalink, message: p.message, media_type: p.media_type, thumbnail: p.thumbnail_url, timestamp: p.fecha_post, reach: n0(p.reach), engagement: n0(p.reactions) + n0(p.engagement) + n0(p.clicks), reactions: n0(p.reactions), clicks: n0(p.clicks), paid: false }));
  const lbl = (k: string) => inp.labels[k] ?? k;
  // Seguidores: el más reciente por marca/red primero (getLatestFollowers toma el primero).
  const fol = [...inp.followers].sort((a, b) => b.fecha.localeCompare(a.fecha));
  const igFollowers = fol.find((f) => f.marca === inp.ownKey && f.red_social === "INSTAGRAM")?.followers ?? 0;
  const fbFollowers = inp.fbFans ?? fol.find((f) => f.marca === inp.ownKey && f.red_social === "FACEBOOK")?.followers ?? 0;
  const igM = monthlyOf(inp.igMonthly, inp.year);
  const ig: IgOrganicSummary | null = igPosts.length || igM.some((m) => m.alcance != null) ? {
    ok: true, username: inp.ownKey, followers: igFollowers,
    totals: { reach: igM.reduce((s, m) => s + n0(m.alcance), 0), engagement: igM.reduce((s, m) => s + n0(m.engagement), 0), postCount: igPosts.length },
    monthly: igM, topPosts: igPosts,
    demoAge: (inp.igDemo?.age ?? []).map((d) => ({ label: d.category, value: d.value, pct: d.pct })),
    demoGender: (inp.igDemo?.gender ?? []).map((d) => ({ label: d.category, value: d.value, pct: d.pct })),
    demoCity: (inp.igDemo?.province ?? []).map((d) => ({ label: d.category, value: d.value, pct: d.pct })),
  } : null;
  const fbM = monthlyOf(inp.fbMonthly, inp.year);
  const fb: FbOrganicSummary | null = fbPosts.length || fbM.some((m) => m.alcance != null) ? {
    ok: true, name: "Drean", followers: fbFollowers,
    totals: { reach: fbM.reduce((s, m) => s + n0(m.alcance), 0), engagement: fbM.reduce((s, m) => s + n0(m.engagement), 0), postCount: fbPosts.length, paidCount: 0 },
    monthly: fbM, topPosts: fbPosts,
  } : null;

  // Sentimiento de la marca propia (social_posts trae % por post + cantidad de comentarios).
  const sentiment: SentimentLite[] = inp.social
    .filter((p) => p.marca === inp.ownKey && p.positivo != null && (p.comentarios ?? 0) > 0 && (n0(p.positivo) + n0(p.negativo) + n0(p.neutro)) > 0)
    .map((p) => {
      const c = n0(p.comentarios);
      const t = n0(p.positivo) + n0(p.negativo) + n0(p.neutro);
      const cnt = (v: number | null) => Math.round((n0(v) / t) * c);
      return { network: p.red_social === "FACEBOOK" ? "FB" : "IG", postId: p.url, ts: p.fecha ? Date.parse(`${p.fecha.slice(0, 10)}T12:00:00Z`) : undefined, sentiment: { positivo: cnt(p.positivo), negativo: cnt(p.negativo), neutro: cnt(p.neutro), resumen: p.resumen_sentimiento ?? undefined } };
    });

  // Competencia: engagement por seguidor recalculado con el snapshot de seguidores ≤ fecha (= enrichEngagement de Drean).
  const folAt = (marca: string, red: string, fecha: string | null): number | null => {
    if (!fecha) return null;
    let best: FollowerRowLite | null = null;
    for (const s of inp.followers) { if (s.marca !== marca || s.red_social !== red || s.fecha > fecha) continue; if (!best || s.fecha > best.fecha) best = s; }
    return best?.followers ?? null;
  };
  const posts: CompetitorPost[] = inp.social.map((p) => {
    const f = folAt(p.marca, p.red_social, p.fecha);
    const eng = f && f > 0 ? ((n0(p.likes) + n0(p.comentarios)) / f) * 100 : p.engagement;
    return {
      red_social: p.red_social as Red, url: p.url, marca: lbl(p.marca), fecha: p.fecha ? p.fecha.slice(0, 10) : null, pilar: p.pilar,
      positivo: p.positivo, negativo: p.negativo, neutro: p.neutro, resumen_sentimiento: p.resumen_sentimiento,
      likes: p.likes, comentarios: p.comentarios, views: p.views, engagement: eng ?? null, interacciones: n0(p.likes) + n0(p.comentarios),
      tipo: p.tipo === "PAUTA" ? "PAUTA" : p.tipo ? "ORGÁNICO" : null, content_type: p.content_type, followers: f ?? p.followers,
      thumbnail_url: p.thumbnail_url, copy: p.copy,
    };
  });
  const competitor = posts.length ? { posts, followers: fol.map((f) => ({ marca: lbl(f.marca), red_social: f.red_social as Red, followers: f.followers })), ownBrand: lbl(inp.ownKey) } : null;
  return { ig, fb, sentiment, competitor, refDate: inp.refDate };
}

// ─────────────────────────── WEB ───────────────────────────
export interface WebMonthRow { mes: string; sesiones: number | null; pageviews: number | null; bounce_rate: number | null; avg_session_duration: number | null }
export interface WebUsersRow { mes: string; total_users: number | null; new_users: number | null }
export interface WebChanRow { mes: string; canal: string; sesiones: number | null; conversiones: number | null; pageviews: number | null }
export interface WebCatRow { fecha: string; categoria: string | null; usuarios: number | null; sesiones: number | null; conversiones: number | null; pageviews: number | null }
export interface WebAdapterInput { year: number; now: Date; monthly: WebMonthRow[]; users: WebUsersRow[]; chan: WebChanRow[]; cats: WebCatRow[] }

const row = (dims: string[], mets: number[]): Ga4Row => ({ dimensionValues: dims.map((value) => ({ value })), metricValues: mets.map((v) => ({ value: String(v) })) });
/** Reportes estilo GA4 armados desde las vistas MENSUALES (vw_drean_web_monthly(_by_channel)), ga4_monthly_users y web_daily_by_category. Período = último mes cerrado vs el anterior. */
export function buildWebReports(inp: WebAdapterInput): { reports: WebReports; periodo: { start: string; end: string; label: string } } | null {
  const curYm = `${inp.now.getUTCFullYear()}-${String(inp.now.getUTCMonth() + 1).padStart(2, "0")}`;
  const ym = (s: string) => s.slice(0, 7);
  const closed = inp.monthly.filter((m) => ym(m.mes) < curYm && n0(m.sesiones) > 0).sort((a, b) => a.mes.localeCompare(b.mes));
  const cur = closed[closed.length - 1], prev = closed[closed.length - 2];
  if (!cur) return null;
  const usersBy = new Map(inp.users.map((u) => [ym(u.mes), u]));
  const convBy = new Map<string, number>();
  for (const c of inp.chan) convBy.set(ym(c.mes), (convBy.get(ym(c.mes)) ?? 0) + n0(c.conversiones));
  const totals = (m: WebMonthRow | undefined) => {
    if (!m) return { rows: [] };
    const u = usersBy.get(ym(m.mes));
    // 0 users · 1 sessions · 2 pv · 3 avgSession · 4 bounce · 5 tx · 6 revenue · 7 newUsers · 8 keyEvents
    return { rows: [row([], [n0(u?.total_users) || n0(m.sesiones), n0(m.sesiones), n0(m.pageviews), n0(m.avg_session_duration), n0(m.bounce_rate), 0, 0, n0(u?.new_users), convBy.get(ym(m.mes)) ?? 0])] };
  };
  const monthlyRows = inp.monthly.filter((m) => m.mes.startsWith(String(inp.year))).sort((a, b) => a.mes.localeCompare(b.mes)).map((m) => {
    const u = usersBy.get(ym(m.mes));
    return row([m.mes.slice(0, 4) + m.mes.slice(5, 7)], [n0(u?.total_users) || n0(m.sesiones), n0(m.sesiones), n0(m.pageviews), n0(m.avg_session_duration), 0, 0, convBy.get(ym(m.mes)) ?? 0]);
  });
  const curChan = inp.chan.filter((c) => ym(c.mes) === ym(cur.mes)).sort((a, b) => n0(b.sesiones) - n0(a.sesiones));
  const chanRows = curChan.map((c) => row([c.canal], [n0(c.sesiones), n0(c.sesiones), n0(c.pageviews), n0(c.conversiones)]));
  // "Landings" = categorías del sitio (web_daily_by_category) del mes → secciones del sitio.
  const catAgg = new Map<string, { ses: number; pv: number; ke: number }>();
  for (const r of inp.cats) {
    if (ym(r.fecha) !== ym(cur.mes)) continue;
    const k = `/${(r.categoria ?? "otros").toLowerCase().replace(/\s+/g, "-")}`;
    const e = catAgg.get(k) ?? { ses: 0, pv: 0, ke: 0 };
    e.ses += n0(r.sesiones); e.pv += n0(r.pageviews); e.ke += n0(r.conversiones); catAgg.set(k, e);
  }
  const landingRows = [...catAgg.entries()].sort((a, b) => b[1].ses - a[1].ses).map(([k, e]) => row([k], [e.ses, e.pv, e.ke]));
  const reports: WebReports = {
    cur: totals(cur), prev: totals(prev), monthly: { rows: monthlyRows }, daily: EMPTY_REPORT,
    chan: { rows: chanRows }, chanDaily: EMPTY_REPORT, landing: { rows: landingRows }, landingDaily: EMPTY_REPORT,
    items: EMPTY_REPORT, dev: EMPTY_REPORT, region: EMPTY_REPORT, pages: EMPTY_REPORT,
  };
  const [y, mm] = cur.mes.split("-");
  const lastDay = new Date(Date.UTC(Number(y), Number(mm), 0)).getUTCDate();
  return { reports, periodo: { start: ym(cur.mes) + "-01", end: `${ym(cur.mes)}-${String(lastDay).padStart(2, "0")}`, label: `${MES[Number(mm) - 1]} ${y} vs ${prev ? MES[Number(prev.mes.slice(5, 7)) - 1] : "—"}` } };
}

export interface CompetitorWebRowLite { competidor: string; dominio: string; fecha: string; visitas_estimadas: number | null; visitantes_unicos: number | null; bounce_rate: number | null; pages_per_visit: number | null; avg_visit_duration: number | null; fuentes_trafico: unknown; keywords_top: unknown }
/** Competencia web (SimilarWeb). La marca propia NO entra: Drean se mide con GA4 (no comparable 1:1). */
export function buildCompetitorWeb(rows: CompetitorWebRowLite[], history: { competidor: string; meses: { fecha: string; visitas: number }[] }[]): CompetitorWebData | null {
  const latest = new Map<string, CompetitorWebRowLite>();
  for (const r of [...rows].sort((a, b) => b.fecha.localeCompare(a.fecha))) if (!latest.has(r.competidor) && !/drean/i.test(r.competidor)) latest.set(r.competidor, r);
  if (!latest.size) return null;
  const fuentes = (x: unknown): Record<string, number> | null => {
    if (!x || typeof x !== "object" || Array.isArray(x)) return null;
    const o = Object.fromEntries(Object.entries(x as Record<string, unknown>).map(([k, v]) => [k, Number(v)]).filter(([, v]) => Number.isFinite(v as number)));
    return Object.keys(o).length ? (o as Record<string, number>) : null;
  };
  const domains: CompetitorDomain[] = [...latest.values()].map((r) => {
    const mon = (history.find((h) => h.competidor === r.competidor)?.meses ?? []).map((m) => ({ mes: m.fecha.slice(0, 7), visitas: m.visitas })).sort((a, b) => a.mes.localeCompare(b.mes));
    const a = mon[mon.length - 2]?.visitas, b = mon[mon.length - 1]?.visitas;
    return {
      dominio: r.dominio, marca: r.competidor, own: false,
      visitas: n0(r.visitas_estimadas), visitantes_unicos: n0(r.visitantes_unicos),
      bounce_rate: n0(r.bounce_rate), pages_per_visit: n0(r.pages_per_visit), avg_visit_duration: n0(r.avg_visit_duration),
      delta_mom: a && b ? ((b - a) / a) * 100 : null,
      fuentes: fuentes(r.fuentes_trafico),
      keywords_top: Array.isArray(r.keywords_top) ? (r.keywords_top as unknown[]).map(String).slice(0, 10) : null,
      monthly: mon,
    };
  });
  return { domains, updatedAt: [...latest.values()][0]?.fecha ?? "" };
}

// ─────────────────────────── SEO ───────────────────────────
export interface SeoAdapterInput {
  ownBrand: string; // "Drean"
  share: { categoria: string; marca: string; mes: string; vol: number; share_pct: number }[];
  trends: { categoria: string; marca: string; fecha: string; interes: number }[];
  serp: { marca: string; keyword: string; categoria: string | null; posicion: number | null; search_volume: number | null; dominio?: string | null }[];
  regions: { marca: string; categoria: string; provincia: string; interes: number | null }[];
  llmo: { categoria: string; marca: string; mes: string; menciones: number; prompts: number; share_pct: number; rank_prom: number | null }[];
  demanda: { categoria: string; mes: string; search_volume: number | null }[];
}
export function buildSeoData(inp: SeoAdapterInput): SeoData | null {
  const own = (m: string) => m.trim().toLowerCase() === inp.ownBrand.toLowerCase();
  const share: ShareRow[] = inp.share.map((s) => ({ categoria: s.categoria, marca: s.marca, own: own(s.marca), mes: s.mes.slice(0, 7), vol: n0(s.vol), share_pct: n0(s.share_pct) }));
  const cats = [...new Set([...share.map((s) => s.categoria), ...inp.serp.map((s) => s.categoria).filter((c): c is string => !!c)])];
  if (!cats.length) return null;
  const demanda: DemandaRow[] = inp.demanda.filter((d) => d.search_volume != null).map((d) => ({ categoria: d.categoria, mes: d.mes.slice(0, 7), search_volume: n0(d.search_volume) }));
  const serp: SerpRow[] = inp.serp.filter((r) => r.categoria).map((r) => ({ categoria: r.categoria!, marca: r.marca, own: own(r.marca), keyword: r.keyword, posicion: r.posicion, search_volume: n0(r.search_volume), dominio: r.dominio ?? undefined }));
  // IA: la foto más reciente por categoría.
  const lastLl = new Map<string, string>();
  // (se ignoran corridas fallidas: meses sin prompts, ej. sep-2026 con todo en 0)
  const conPrompts = new Set(inp.llmo.filter((l) => n0(l.prompts) > 0).map((l) => `${l.categoria}|${l.mes}`));
  for (const l of inp.llmo) if (conPrompts.has(`${l.categoria}|${l.mes}`) && (!lastLl.get(l.categoria) || l.mes > lastLl.get(l.categoria)!)) lastLl.set(l.categoria, l.mes);
  const llmo: LlmoRow[] = inp.llmo.filter((l) => l.mes === lastLl.get(l.categoria)).map((l) => ({ categoria: l.categoria, marca: l.marca, own: own(l.marca), menciones: n0(l.menciones), prompts: n0(l.prompts), share_pct: n0(l.share_pct), rank_prom: l.rank_prom }));
  const regions: RegionRow[] = inp.regions.filter((r) => r.interes != null).map((r) => ({ categoria: r.categoria, marca: own(r.marca) ? inp.ownBrand : r.marca, provincia: r.provincia, interes: n0(r.interes) }));
  const trends: TrendRow[] = inp.trends.map((t) => ({ categoria: t.categoria, marca: t.marca, fecha: t.fecha, interes: n0(t.interes) }));
  const c0 = cats[0]!;
  const lastMes = share.filter((s) => s.categoria === c0).map((s) => s.mes).sort().pop();
  const brands = share.filter((s) => s.categoria === c0 && s.mes === lastMes).map((s) => ({ marca: s.marca, own: s.own, keyword: `${c0} ${s.marca.toLowerCase()}`, volume: s.vol, share: s.share_pct }));
  const monthlyM = new Map<string, number>();
  for (const s of share) monthlyM.set(s.mes, (monthlyM.get(s.mes) ?? 0) + s.vol);
  const lastDem = (c: string) => demanda.filter((d) => d.categoria === c).sort((a, b) => a.mes.localeCompare(b.mes)).pop();
  return {
    categorias: cats,
    generic: cats.map((c) => ({ categoria: c, keyword: c, volume: lastDem(c)?.search_volume ?? 0 })),
    share, demanda, trends, serp, regions, llmo,
    categoria: c0, generic_keyword: c0, generic_volume: lastDem(c0)?.search_volume ?? 0,
    brands, monthly: [...monthlyM.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([mes, total]) => ({ mes, total })),
    updatedAt: new Date().toISOString(),
  };
}

// ─────────────────────────── SEGUIMIENTO ───────────────────────────
export interface DreanSegLite { disponible: boolean; refMes: string; objetivos: { id: string; nombre: string; pesoEstrategico: number; cumplMes: number | null; cumplYtd: number | null; cobertura: number; aportes: { kpi: string; peso: number; cumpl: number | null }[] }[]; saludMarca: { cumplMes: number | null; cumplYtd: number | null; cumplSerie?: (number | null)[] } }
/** Seguimiento de Drean (getSeguimientoObjetivos) + KPIs (getSeguimientoKpis) → forma BIP. Solo KPIs del Mapa. */
export function buildSeguimiento(seg: DreanSegLite, kpis: KpiSegLite[]): SeguimientoObjetivos {
  const enMapa = new Set(seg.objetivos.flatMap((o) => o.aportes.map((a) => a.kpi)));
  return {
    disponible: seg.disponible, refMes: seg.refMes,
    objetivos: seg.objetivos.map((o) => ({ id: o.id, nombre: o.nombre, pesoEstrategico: o.pesoEstrategico, cumplMes: o.cumplMes, cumplYtd: o.cumplYtd, cobertura: o.cobertura, aportes: o.aportes })),
    saludMarca: { cumplMes: seg.saludMarca.cumplMes, cumplYtd: seg.saludMarca.cumplYtd, cumplSerie: seg.saludMarca.cumplSerie },
    kpis: kpis.filter((k) => enMapa.has(k.kpi)),
  };
}
