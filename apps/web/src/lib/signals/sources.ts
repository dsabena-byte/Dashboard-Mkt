import "server-only";
// ============================================================================
// Lectores (server) de la data que alimenta las señales y el pack del Diagnóstico IA.
// Reglas de PERF de Drean (CLAUDE.md): SOLO fuentes baratas/precalculadas —
//  · Web: vw_drean_web_monthly(_by_channel), ga4_monthly_users, web_daily_by_category (1-2 meses).
//    NUNCA las vistas de web_landing_daily ni 24 meses de data diaria.
//  · Trade: trade_monthly + fs_precomputed (NUNCA paginar CB / Floor Share).
//  · Pauta: las mismas queries que /performance (tablas chicas) + modelo gap-fill compartido.
//  · Seguimiento: getSeguimientoObjetivos / getSeguimientoKpis (React cache por request).
// Sin llamadas a OpenAI ni a APIs externas. Nunca tiran: sin data devuelven null.
// Se usan desde route handlers (/api/insights*, copiloto) — no desde el render de las páginas.
// ============================================================================
import { getPautaPerformance } from "@/lib/pauta-queries";
import { getMetaPaidCreatives, getMetaUgcCreatives } from "@/lib/meta-paid-queries";
import { getDv360Creatives, getDv360Reach } from "@/lib/dv360-queries";
import { getGoogleAdsOmd } from "@/lib/google-ads-omd-queries";
import { getFxRates } from "@/lib/fx-queries";
import { getIgOrganicSummary } from "@/lib/meta-ig-queries";
import { getFbOrganicSummary } from "@/lib/meta-fb-queries";
import { getSocialPosts, getSocialFollowers, OWN_BRAND, BRAND_LABELS } from "@/lib/social-posts-queries";
import { getCompetitorMonthlyHistory } from "@/lib/competitor-web-queries";
import { getShareOfSearch, getSeoCompetitivo, getSearchRegion, getLlmo, getDemandaGenerica } from "@/lib/competitive-queries";
import { getSeguimientoObjetivos } from "@/lib/objetivos-rollup";
import { getSearchConsoleData } from "@/lib/search-console";
import { getSeguimientoKpis } from "@/lib/objetivos-kpis";
import { getTradeMonthly } from "@/lib/trade-monthly";
import { getMetaKpi } from "@/lib/metas-server";
import { getBgtData, hasVersion } from "@/lib/bgt-queries";
import { getFacturacionMensual, sumFacturacion } from "@/lib/facturacion-queries";
import { computeCuatris, MAX_DESVIO, MAX_INV_FACT } from "@/lib/bgt-dashboard";
import { KANTAR_LAVADO, KANTAR_REFRI, KANTAR_COCCION, SM_WAVES } from "@/lib/salud-marca-model";
import { buildPautaFull, buildRedesInput, buildWebReports, buildCompetitorWeb, buildSeoData, buildSeguimiento, type RedesAdapted, type CompetitorWebRowLite } from "./adapters";
import type { PautaFull, WebReports, CompetitorWebData, SeoData, SeguimientoObjetivos } from "./model";
import type { CrucesInput } from "./cruces";
import type { CbSignalInput, FsSignalInput, UgcSignalInput, MercadoRowLite, SaludSignalInput, MktCanalRowLite, ConvSignalInput, CuatriLite } from "./drean";

const safe = async <T>(p: Promise<T>): Promise<T | null> => { try { return await p; } catch { return null; } };
const year = () => new Date().getFullYear();

async function rest<T>(query: string): Promise<T[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return [];
  try {
    const res = await fetch(`${url}/rest/v1/${query}`, { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "no-store" });
    if (!res.ok) return [];
    return (await res.json()) as T[];
  } catch { return []; }
}

/** Memo por invocación: computeSignals / el diagnóstico comparten lecturas (overview y cruces reusan pauta/SEO/redes/web). */
export class LoadCtx {
  private m = new Map<string, Promise<unknown>>();
  once<T>(k: string, f: () => Promise<T>): Promise<T> {
    if (!this.m.has(k)) this.m.set(k, f());
    return this.m.get(k) as Promise<T>;
  }
}

// ── Plan de medios ──
export function loadPauta(ctx: LoadCtx): Promise<PautaFull | null> {
  return ctx.once("pauta", async () => {
    const [pauta, metaPaid, dv360, dv360Reach, gads, fx] = await Promise.all([
      safe(getPautaPerformance(true)), safe(getMetaPaidCreatives(true)), safe(getDv360Creatives()),
      safe(getDv360Reach()), safe(getGoogleAdsOmd()), safe(getFxRates()),
    ]);
    const p = buildPautaFull({ pauta: pauta ?? [], metaPaid: metaPaid ?? [], dv360: dv360 ?? [], dv360Reach: dv360Reach ?? [], googleAdsOmd: gads ?? [], fxRates: fx ?? {}, anio: year(), now: new Date() });
    return p.ok ? p : null;
  });
}

// ── Redes ──
export function loadRedes(ctx: LoadCtx): Promise<RedesAdapted | null> {
  return ctx.once("redes", async () => {
    const y = year();
    const now = new Date();
    const range = { from: `${y}-01-01`, to: now.toISOString().slice(0, 10) };
    const since = new Date(now.getTime() - 120 * 864e5).toISOString().slice(0, 10);
    const [igPosts, ig, fb, social, followers] = await Promise.all([
      rest<{ post_id: string; fecha_post: string; permalink: string | null; message: string | null; media_type: string | null; thumbnail_url: string | null; reach: number | null; engagement: number | null }>(
        `meta_posts?platform=eq.instagram&fecha_post=gte.${since}T00:00:00Z&select=post_id,fecha_post,permalink,message,media_type,thumbnail_url,reach,engagement&order=fecha_post.desc&limit=1000`),
      safe(getIgOrganicSummary(range)),
      safe(getFbOrganicSummary(range)),
      safe(getSocialPosts({})),
      safe(getSocialFollowers()),
    ]);
    if (!igPosts.length && !ig && !fb) return null;
    return buildRedesInput({
      year: y, refDate: now, igPosts,
      igMonthly: ig?.monthlyData ?? [],
      fbPosts: (fb?.topPosts ?? []).map((p) => ({ post_id: p.post_id, fecha_post: p.fecha_post, permalink: p.permalink, message: p.message, media_type: p.media_type, thumbnail_url: p.thumbnail_url, reach: p.reach, engagement: p.engagement, reactions: p.reactions, clicks: p.clicks })),
      fbMonthly: (fb?.monthlyData ?? []).map((m) => ({ mes: m.mes, alcance: m.alcance, engagement: m.engagement, clicks: m.clicks })),
      fbFans: fb?.totals.fans_total ?? null,
      social: social ?? [], followers: followers ?? [],
      ownKey: OWN_BRAND, labels: BRAND_LABELS,
      igDemo: ig ? { age: ig.demoAge, gender: ig.demoGender, province: ig.demoProvince } : undefined,
    });
  });
}

// ── Web (vistas mensuales + precalculadas) ──
export interface WebLoaded { reports: WebReports; periodo: { start: string; end: string; label: string }; competitor: CompetitorWebData | null }
export function loadWeb(ctx: LoadCtx): Promise<WebLoaded | null> {
  return ctx.once("web", async () => {
    const y = year();
    const now = new Date();
    const prevStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 2, 1)).toISOString().slice(0, 10);
    const [monthly, users, chan, cats, comp] = await Promise.all([
      rest<{ mes: string; sesiones: number | null; pageviews: number | null; bounce_rate: number | null; avg_session_duration: number | null }>(`vw_drean_web_monthly?mes=gte.${y - 1}-01-01&select=mes,sesiones,pageviews,bounce_rate,avg_session_duration&order=mes`),
      rest<{ mes: string; total_users: number | null; new_users: number | null }>(`ga4_monthly_users?mes=gte.${y - 1}-01-01&select=mes,total_users,new_users&order=mes`),
      rest<{ mes: string; canal: string; sesiones: number | null; conversiones: number | null; pageviews: number | null }>(`vw_drean_web_monthly_by_channel?mes=gte.${y}-01-01&select=mes,canal,sesiones,conversiones,pageviews`),
      rest<{ fecha: string; categoria: string | null; usuarios: number | null; sesiones: number | null; conversiones: number | null; pageviews: number | null }>(`web_daily_by_category?fecha=gte.${prevStart}&select=fecha,categoria,usuarios,sesiones,conversiones,pageviews&limit=5000`),
      loadCompetitorWeb(ctx),
    ]);
    const w = buildWebReports({ year: y, now, monthly, users, chan, cats });
    if (!w) return comp ? { reports: emptyReports(), periodo: { start: "", end: "", label: "" }, competitor: comp } : null;
    return { ...w, competitor: comp };
  });
}
const emptyReports = (): WebReports => ({ cur: { rows: [] }, prev: { rows: [] }, monthly: { rows: [] }, daily: { rows: [] }, chan: { rows: [] }, chanDaily: { rows: [] }, landing: { rows: [] }, landingDaily: { rows: [] }, items: { rows: [] }, dev: { rows: [] }, region: { rows: [] }, pages: { rows: [] } });
function loadCompetitorWeb(ctx: LoadCtx): Promise<CompetitorWebData | null> {
  return ctx.once("compweb", async () => {
    const [rows, hist] = await Promise.all([
      rest<CompetitorWebRowLite>("competitor_web?select=competidor,dominio,fecha,visitas_estimadas,visitantes_unicos,bounce_rate,pages_per_visit,avg_visit_duration,fuentes_trafico,keywords_top&competidor=neq.Samsung&order=fecha.desc&limit=500"),
      safe(getCompetitorMonthlyHistory()),
    ]);
    return buildCompetitorWeb(rows, hist ?? []);
  });
}

// ── SEO ──
export function loadSeo(ctx: LoadCtx): Promise<SeoData | null> {
  return ctx.once("seo", async () => {
    const [share, serp, regions, llmo, demanda] = await Promise.all([
      safe(getShareOfSearch()), safe(getSeoCompetitivo()), safe(getSearchRegion()), safe(getLlmo()), safe(getDemandaGenerica()),
    ]);
    return buildSeoData({ ownBrand: "Drean", share: share ?? [], trends: [], serp: serp ?? [], regions: regions ?? [], llmo: llmo ?? [], demanda: demanda ?? [] });
  });
}

// ── Seguimiento (overview) ──
export function loadOverview(ctx: LoadCtx): Promise<SeguimientoObjetivos | null> {
  return ctx.once("overview", async () => {
    const y = year();
    const [seg, kpis] = await Promise.all([safe(getSeguimientoObjetivos(y)), safe(getSeguimientoKpis(y))]);
    if (!seg?.disponible) return null;
    return buildSeguimiento(seg, (kpis ?? []).map((k) => ({ plan: k.plan, kpi: k.kpi, medida: k.medida, unit: k.unit, tipo: k.tipo, realM: k.realM, metaM: k.metaM, direccion: k.direccion })));
  });
}

// ── Cruces propios × mercado (Drean tiene la capa competitiva completa) ──
export function loadCruces(ctx: LoadCtx): Promise<CrucesInput | null> {
  return ctx.once("cruces", async () => {
    // Search Console: snapshot de search_console_snapshot (null si no hay dato OK → cruce_sc_* no dispara).
    const [pauta, seo, redes, web, sc] = await Promise.all([loadPauta(ctx), loadSeo(ctx), loadRedes(ctx), loadWeb(ctx), safe(getSearchConsoleData())]);
    const inp: CrucesInput = {
      ownBrand: "Drean",
      pauta: pauta ? { monthly: pauta.monthly, currency: pauta.currency, year: year() } : null,
      seo, social: redes?.competitor ? { posts: redes.competitor.posts, ownBrand: redes.competitor.ownBrand } : null,
      web: web?.reports ?? null, competitorWeb: web?.competitor ?? null, searchConsole: sc ?? null,
    };
    return inp.seo || inp.social || inp.competitorWeb || inp.searchConsole ? inp : null;
  });
}

// ── Trade ──
const FS_OBJ: Record<string, number> = { Lavado: 32, "Refrigeración": 25, "Cocción": 23 }; // = FS_OBJ_PCT (floor-share-queries)
export function loadCb(ctx: LoadCtx): Promise<CbSignalInput | null> {
  return ctx.once("cb", async () => {
    const y = year(), now = new Date();
    const cm = now.getFullYear() > y ? 13 : now.getMonth() + 1;
    const [t, meta] = await Promise.all([safe(getTradeMonthly(y)), safe(getMetaKpi("Cuadros Básicos", "% Cumplimiento CB", y))]);
    if (!t) return null;
    return { cb: t.cb.map((v, i) => (i + 1 < cm ? v : null)), meta: meta?.valores ?? Array(12).fill(null), objetivo: 80 };
  });
}
export function loadFs(ctx: LoadCtx): Promise<FsSignalInput | null> {
  return ctx.once("fs", async () => {
    const y = year(), now = new Date();
    const cm = now.getFullYear() > y ? 13 : now.getMonth() + 1;
    const [t, mL, mR, mC, pre] = await Promise.all([
      safe(getTradeMonthly(y)),
      safe(getMetaKpi("Floor Share", "Floor Share (exhibición)", y, "Lavado")),
      safe(getMetaKpi("Floor Share", "Floor Share (exhibición)", y, "Refrigeración")),
      safe(getMetaKpi("Floor Share", "Floor Share (exhibición)", y, "Cocción")),
      rest<{ data: { catBrand?: FsSignalInput["catBrand"]; byCliente?: FsSignalInput["byCliente"]; overall?: { total?: { share?: number } } } }>("fs_precomputed?id=eq.1&select=data"),
    ]);
    if (!t) return null;
    const closed = (s: (number | null)[]) => s.map((v, i) => (i + 1 < cm ? v : null));
    const d = pre[0]?.data;
    const catName: Record<string, string> = { lavado: "Lavado", refri: "Refrigeración", coccion: "Cocción" };
    return {
      fsCat: { Lavado: closed(t.fsCat.Lavado ?? []), "Refrigeración": closed(t.fsCat["Refrigeración"] ?? []), "Cocción": closed(t.fsCat["Cocción"] ?? []) },
      metaCat: { Lavado: mL?.valores ?? [], "Refrigeración": mR?.valores ?? [], "Cocción": mC?.valores ?? [] },
      objetivo: FS_OBJ,
      catBrand: (d?.catBrand ?? []).map((r) => ({ ...r, categoria: catName[r.categoria] ?? r.categoria })),
      byCliente: d?.byCliente ?? [],
      overallShare: d?.overall?.total?.share ?? null,
    };
  });
}

// ── Influencia / UGC ──
export function loadUgc(ctx: LoadCtx): Promise<UgcSignalInput | null> {
  return ctx.once("ugc", async () => {
    const [ugc, brand, analysis] = await Promise.all([
      safe(getMetaUgcCreatives()),
      safe(getMetaPaidCreatives(false)),
      rest<{ permalink: string; analysis: { credibilidad?: { nivel?: string }; intencion_compra?: { nivel?: string }; percepcion_marca?: { nivel?: string } } | null }>("ugc_piece_analysis?select=permalink,analysis"),
    ]);
    if (!ugc?.length) return null;
    const an = new Map(analysis.map((a) => [a.permalink, a.analysis]));
    const byPiece = new Map<string, UgcSignalInput["pieces"][number]>();
    for (const r of ugc) {
      const id = r.instagram_permalink_url || r.ad_id;
      const e = byPiece.get(id) ?? { id: r.ad_id, nombre: r.ad_name || r.campaign_name || r.ad_id, permalink: r.instagram_permalink_url || r.permalink_url, spend: 0, impresiones: 0, clicks: 0, reactions: 0, comments: 0, shares: 0, saves: 0, vbase: 0, p50: 0, analysis: null };
      e.spend += r.spend ?? 0; e.impresiones += r.impresiones ?? 0; e.clicks += r.clicks ?? 0;
      e.reactions += r.reactions ?? 0; e.comments += r.comments ?? 0; e.shares += r.shares ?? 0; e.saves += r.saves ?? 0;
      if ((r.video_p25 ?? 0) + (r.video_p50 ?? 0) + (r.video_p75 ?? 0) > 0) { e.vbase += r.impresiones ?? 0; e.p50 += r.video_p50 ?? 0; }
      const a = r.instagram_permalink_url ? an.get(r.instagram_permalink_url) : null;
      if (a) e.analysis = { credibilidad: a.credibilidad?.nivel ?? null, intencion: a.intencion_compra?.nivel ?? null, percepcion: a.percepcion_marca?.nivel ?? null };
      byPiece.set(id, e);
    }
    const b = (brand ?? []).filter((r) => r.plataforma === "meta");
    const bImpr = b.reduce((s, r) => s + (r.impresiones ?? 0), 0);
    const bSpend = b.reduce((s, r) => s + (r.spend ?? 0), 0);
    const bInt = b.reduce((s, r) => s + (r.reactions ?? 0) + (r.comments ?? 0) + (r.shares ?? 0) + (r.saves ?? 0), 0);
    return { pieces: [...byPiece.values()], brandCpm: bImpr ? (bSpend / bImpr) * 1000 : null, brandEr: bImpr ? (bInt / bImpr) * 100 : null };
  });
}

// ── Mercado GfK ──
export function loadMercado(ctx: LoadCtx): Promise<MercadoRowLite[] | null> {
  return ctx.once("mercado", async () => {
    const d = new Date(); d.setMonth(d.getMonth() - 16);
    const rows = await rest<MercadoRowLite>(`mercado_share?agregacion=eq.mensual&mes=gte.${d.toISOString().slice(0, 7)}-01&select=mes,categoria,segmento,marca,unit_share,value_share&limit=10000`);
    return rows.length ? rows : null;
  });
}

// ── Salud de Marca (Kantar, constantes del modelo) + share MAT GfK para el cruce ──
export function loadSalud(ctx: LoadCtx): Promise<SaludSignalInput> {
  return ctx.once("salud", async () => {
    const rows = await rest<{ mes: string; categoria: string; value_share: number | null }>("mercado_share?agregacion=eq.MAT&segmento=eq.Total&marca=eq.DREAN&select=mes,categoria,value_share&limit=2000");
    const shareMat: Record<string, Record<string, number>> = {};
    for (const r of rows) if (r.value_share != null) (shareMat[r.categoria] ??= {})[r.mes.slice(0, 7)] = r.value_share;
    const k = (src: typeof KANTAR_LAVADO) => Object.fromEntries(Object.entries(src).map(([b, w]) => [b, Object.fromEntries(Object.entries(w).map(([ww, v]) => [ww, { tom: v.tom, som: v.som, int: v.int, poder: v.poder }]))]));
    return { kantar: { Lavado: k(KANTAR_LAVADO), "Refrigeración": k(KANTAR_REFRI), "Cocción": k(KANTAR_COCCION) }, waves: [...SM_WAVES], ownBrand: "Drean", shareMat };
  });
}

// ── Mkt Canal ──
export function loadMktCanal(ctx: LoadCtx): Promise<MktCanalRowLite[] | null> {
  return ctx.once("mktcanal", async () => {
    const rows = await rest<MktCanalRowLite>("mkt_canal_acciones?select=cliente,accion,mes,plataforma,impresiones,clics,conversiones,ingresos,inversion&limit=5000");
    return rows.length ? rows : null;
  });
}

// ── Performance-Conversión (ecommerce inhouse): costo y compras diarios (tablas chicas) ──
export function loadConversion(ctx: LoadCtx): Promise<ConvSignalInput | null> {
  return ctx.once("conv", async () => {
    const y = year();
    const [cost, purch] = await Promise.all([
      rest<{ fecha: string; utm_campaign: string | null; cost: number | string | null; ad_clicks: number | null }>(`ga4_ads_cost_daily?utm_campaign=ilike.inhouse*&fecha=gte.${y}-01-01&select=fecha,utm_campaign,cost,ad_clicks&limit=20000`),
      rest<{ fecha: string; utm_campaign: string | null; purchases: number | null; revenue: number | string | null }>(`ga4_purchases_daily?utm_campaign=ilike.inhouse*&fecha=gte.${y}-01-01&select=fecha,utm_campaign,purchases,revenue&limit=20000`),
    ]);
    if (!cost.length) return null;
    const cm = new Date().getMonth(); // solo meses cerrados en la serie
    const mo = new Map<number, ConvSignalInput["mensual"][number]>();
    const ca = new Map<string, ConvSignalInput["campanias"][number]>();
    const M = (i: number) => mo.get(i) ?? { mesIdx: i, costo: 0, compras: 0, ingresos: 0, clicks: 0 };
    const C = (k: string) => ca.get(k) ?? { campania: k, costo: 0, compras: 0, ingresos: 0 };
    for (const r of cost) { const i = Number(r.fecha.slice(5, 7)) - 1; const c = Number(r.cost ?? 0) || 0; if (i < cm) { const m = M(i); m.costo += c; m.clicks += r.ad_clicks ?? 0; mo.set(i, m); } const k = r.utm_campaign ?? "—"; const e = C(k); e.costo += c; ca.set(k, e); }
    for (const r of purch) { const i = Number(r.fecha.slice(5, 7)) - 1; const v = Number(r.revenue ?? 0) || 0; if (i < cm) { const m = M(i); m.compras += r.purchases ?? 0; m.ingresos += v; mo.set(i, m); } const k = r.utm_campaign ?? "—"; const e = C(k); e.compras += r.purchases ?? 0; e.ingresos += v; ca.set(k, e); }
    return { mensual: [...mo.values()], campanias: [...ca.values()] };
  });
}

// ── Inversión de Marketing (BGT) ──
export function loadInversion(ctx: LoadCtx): Promise<{ cuatris: CuatriLite[]; maxDesvio: number; maxInvFact: number } | null> {
  return ctx.once("inversion", async () => {
    const [bgt, fact] = await Promise.all([safe(getBgtData()), safe(getFacturacionMensual())]);
    if (!bgt?.rows.length) return null;
    const now = new Date();
    const y = year();
    const cuatris = computeCuatris(bgt.rows, y, now.getUTCFullYear(), now.getUTCMonth() + 1, (v) => hasVersion(bgt.rows, v), (m) => sumFacturacion(fact ?? [], m));
    return { cuatris, maxDesvio: MAX_DESVIO, maxInvFact: MAX_INV_FACT };
  });
}
