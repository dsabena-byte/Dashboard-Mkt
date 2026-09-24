import "server-only";
// ============================================================================
// PACK DE DATOS del Diagnóstico IA (portado de BIP lib/insights-datapack, sep-2026) con los
// loaders de Drean (lib/signals/sources.ts → SOLO fuentes baratas/precalculadas). Lo más rico de
// cada tablero con campos con nombre + las señales del motor determinístico como "hallazgos
// pre-calculados". Best-effort: lo que falta no va. Tope MAX_PACK = 16k caracteres.
// ============================================================================
import type { Signal, SignalDash } from "@/lib/signals/types";
import { sortSignals, median, sum } from "@/lib/signals/types";
import { unifyPosts, formatTable, bucketOf, type UPost } from "@/lib/signals/redes";
import { aggBy, medioDe, rolDe } from "@/lib/signals/pauta";
import { webTotals, webChannels, webLandings } from "@/lib/signals/web";
import { keywordBuckets } from "@/lib/signals/seo";
import { palancas } from "@/lib/signals/overview";
import { spendByMonth } from "@/lib/signals/cruces";
import { sosMonthly, demandaMonthly, shareOfEngagement, seoPositionIndex, llmoPropio, computeBrandStats, computePilarStats, webMonthlyArr } from "@/lib/signals/model";
import type { PautaFull, SeoData, SeguimientoObjetivos } from "@/lib/signals/model";
import type { CrucesInput } from "@/lib/signals/cruces";
import type { RedesAdapted } from "@/lib/signals/adapters";
import { computeSignals, baseSignals, type LoadCtx } from "@/lib/signals";
import { loadPauta, loadRedes, loadWeb, loadSeo, loadCruces, loadCb, loadFs, loadUgc, loadMercado, loadSalud, loadMktCanal, loadConversion, loadInversion, type WebLoaded } from "@/lib/signals/sources";
import type { CbSignalInput, FsSignalInput, UgcSignalInput, MercadoRowLite, SaludSignalInput, MktCanalRowLite, ConvSignalInput, CuatriLite } from "@/lib/signals/drean";

const MES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
export const MAX_PACK = 16_000;

export interface DashLoaded {
  seg?: SeguimientoObjetivos | null;
  pauta?: PautaFull | null;
  redes?: RedesAdapted | null;
  web?: WebLoaded | null;
  seo?: SeoData | null;
  cruces?: CrucesInput | null;
  cb?: CbSignalInput | null;
  fs?: FsSignalInput | null;
  ugc?: UgcSignalInput | null;
  mercado?: MercadoRowLite[] | null;
  salud?: SaludSignalInput | null;
  mktCanal?: MktCanalRowLite[] | null;
  conv?: ConvSignalInput | null;
  inversion?: { cuatris: CuatriLite[]; maxDesvio: number; maxInvFact: number } | null;
}

// Redondeo recursivo (2 decimales) para un JSON compacto.
function rnd(x: unknown): unknown {
  if (typeof x === "number") return Number.isFinite(x) ? Math.round(x * 100) / 100 : null;
  if (Array.isArray(x)) return x.map(rnd);
  if (x && typeof x === "object") return Object.fromEntries(Object.entries(x).filter(([, v]) => v !== undefined && v !== null && v !== "").map(([k, v]) => [k, rnd(v)]));
  return x;
}
const cap = (s: string | null | undefined, n: number) => { const t = (s ?? "").replace(/\s+/g, " ").trim(); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };
const pctOf = (a: number, b: number) => (b ? (a / b) * 100 : 0);
const day = (ts: number) => new Date(ts).toISOString().slice(0, 10);
const safe = <T>(p: Promise<T>) => p.catch(() => null);

/** Lee lo que necesita el tablero (el overview lee todo lo de marketing para cruzar planes). */
export async function loadDash(ctx: LoadCtx, dash: string, seg: SeguimientoObjetivos | null): Promise<DashLoaded> {
  const need = (d: string) => dash === d || dash === "overview";
  const [pauta, redes, web, seo] = await Promise.all([
    need("performance") ? safe(loadPauta(ctx)) : null,
    need("redes") ? safe(loadRedes(ctx)) : null,
    need("web") ? safe(loadWeb(ctx)) : null,
    need("seo-search") ? safe(loadSeo(ctx)) : null,
  ]);
  const cruces = ["overview", "performance", "redes", "web", "seo-search"].includes(dash) ? await safe(loadCruces(ctx)) : null;
  const [cb, fs, ugc, mercado, salud, mktCanal, conv, inversion] = await Promise.all([
    need("cuadros-basicos") ? safe(loadCb(ctx)) : null,
    need("floor-share") ? safe(loadFs(ctx)) : null,
    dash === "influencia" ? safe(loadUgc(ctx)) : null,
    need("mercado") || dash === "salud-marca" ? safe(loadMercado(ctx)) : null,
    need("salud-marca") ? safe(loadSalud(ctx)) : null,
    dash === "mkt-canal" ? safe(loadMktCanal(ctx)) : null,
    dash === "performance-conversion" ? safe(loadConversion(ctx)) : null,
    need("funnel") ? safe(loadInversion(ctx)) : null,
  ]);
  return { seg, pauta, redes, web, seo, cruces, cb, fs, ugc, mercado, salud, mktCanal, conv, inversion };
}

// ── Mercado (propios × mercado) ──
function mercadoPack(dash: string, C: CrucesInput) {
  const now = new Date();
  const sos = sosMonthly(C.seo).slice(-8);
  const spend = spendByMonth(C.pauta, now);
  const dem = demandaMonthly(C.seo).slice(-12);
  const avgD = dem.length ? sum(dem.map((d) => d.busquedas)) / dem.length : 0;
  const soe = C.social ? shareOfEngagement(C.social.posts, C.social.ownBrand) : null;
  const pi = seoPositionIndex(C.seo);
  const out: Record<string, unknown> = {
    nota: "Share of search = búsquedas de tu marca ÷ las de todas las marcas del set (termómetro de mercado; la inversión de la competencia no se conoce). Share of engagement = tus interacciones ÷ las del set en redes.",
    shareOfSearchMensual: sos.map((x) => ({ mes: x.mes, share: x.share })),
    shareOfEngagement: soe ? { propio: soe.sharePropio, ventana: `${soe.desde}→${soe.hasta}`, porMarca: soe.porMarca.slice(0, 6).map((b) => ({ marca: b.marca, share: b.share })) } : null,
  };
  if (dash === "performance" || dash === "overview") {
    out.inversionVsShareOfSearch = [...spend.entries()].slice(-8).map(([mes, inv]) => ({ mes, inversion: Math.round(inv), shareSearch: sos.find((x) => x.mes === mes)?.share ?? null }));
    out.demandaCategoria = dem.map((d) => ({ mes: d.mes, busquedas: d.busquedas, indice: avgD ? d.busquedas / avgD : null }));
  }
  if (dash === "web" || dash === "seo-search" || dash === "overview") {
    out.fuentesCompetencia = (C.competitorWeb?.domains ?? []).slice(0, 5).map((d) => ({ marca: d.marca, fuentes: d.fuentes, variacionMensualPct: d.delta_mom }));
    out.indicePosicionSeo = pi.porMarca.slice(0, 6);
    out.visibilidadIaPropia = llmoPropio(C.seo);
  }
  if (dash === "redes") {
    const m = new Map<string, number[]>();
    for (const p of C.social?.posts ?? []) if (p.marca !== C.social?.ownBrand && p.content_type && p.engagement != null) m.set(p.content_type, [...(m.get(p.content_type) ?? []), p.engagement]);
    out.formatosCompetencia = [...m.entries()].map(([f, v]) => ({ formato: f, erPorSeguidor: sum(v) / v.length, posts: v.length }));
  }
  return out;
}

// ── Redes ──
function redesPack(R: RedesAdapted) {
  const posts = unifyPosts(R.ig, R.fb);
  const now = (R.refDate ?? new Date()).getTime();
  const er = (p: UPost) => (p.reach > 0 ? (p.eng / p.reach) * 100 : 0);
  const postRow = (p: UPost) => ({ fecha: day(p.ts), red: p.red, formato: p.formato, texto: cap(p.caption, 90), alcance: p.reach, interacciones: p.eng, er: er(p) });
  const ranked = (red: "IG" | "FB") => {
    const ps = posts.filter((p) => p.red === red && p.reach > 0);
    const medR = median(ps.map((p) => p.reach));
    const pool = ps.filter((p) => p.reach >= medR * 0.5);
    return { top: [...pool].sort((a, b) => er(b) - er(a)).slice(0, 6).map(postRow), peores: [...pool].sort((a, b) => er(a) - er(b)).slice(0, 3).map(postRow), medianaEr: median(ps.map(er)), medianaAlcance: medR };
  };
  const win = (red: "IG" | "FB", from: number, to: number) => { const b = bucketOf(posts.filter((p) => p.red === red && p.ts > from && p.ts <= to)); return { posts: b.posts, alcancePorPost: b.rpp, er: b.er }; };
  const ig = R.ig?.ok ? {
    cuenta: R.ig.username, seguidores: R.ig.followers,
    nota: "Mensual = todas las piezas (incluye Stories). Por pieza = Feed/Reels (sin Stories).",
    mensual: R.ig.monthly.filter((m) => m.alcance != null).map((m) => ({ mes: m.mes, alcance: m.alcance, interacciones: m.engagement, er: m.alcance ? pctOf(m.engagement ?? 0, m.alcance) : null })),
    ultimos30d: win("IG", now - 30 * 864e5, now), previos30d: win("IG", now - 60 * 864e5, now - 30 * 864e5),
    ...ranked("IG"),
    audiencia: { edad: R.ig.demoAge.slice(0, 5), genero: R.ig.demoGender.slice(0, 3), provincia: R.ig.demoCity.slice(0, 5) },
  } : null;
  const fb = R.fb?.ok ? {
    pagina: R.fb.name, seguidores: R.fb.followers,
    nota: "Alcance FB NO confiable (métrica nueva de Meta mezcla pago, madura ~60 días): se excluyen posts pagos y solo se analizan posts con ≥60 días. El OBJETIVO de Redes se mide con Instagram.",
    mensual: R.fb.monthly.filter((m) => m.alcance != null).map((m) => ({ mes: m.mes, alcance: m.alcance, interacciones: m.engagement })),
    ...ranked("FB"),
  } : null;
  const sent = (R.sentiment ?? []).filter((s) => s.sentiment);
  let sentimiento: unknown = null;
  if (sent.length) {
    const pos = sum(sent.map((s) => s.sentiment!.positivo)), neg = sum(sent.map((s) => s.sentiment!.negativo)), neu = sum(sent.map((s) => s.sentiment!.neutro));
    const masNeg = sent.map((s) => ({ s, t: s.sentiment!.positivo + s.sentiment!.negativo + s.sentiment!.neutro })).filter((x) => x.t >= 5)
      .sort((a, b) => b.s.sentiment!.negativo / b.t - a.s.sentiment!.negativo / a.t).slice(0, 3)
      .map(({ s, t }) => ({ red: s.network, comentarios: t, negativoPct: pctOf(s.sentiment!.negativo, t), resumen: cap(s.sentiment!.resumen, 160) }));
    sentimiento = { piezasAnalizadas: sent.length, comentarios: pos + neg + neu, positivoPct: pctOf(pos, pos + neg + neu), negativoPct: pctOf(neg, pos + neg + neu), neutroPct: pctOf(neu, pos + neg + neu), piezasMasCriticas: masNeg };
  }
  let competencia: unknown = null;
  if (R.competitor) {
    const { posts: cp, followers, ownBrand } = R.competitor;
    competencia = {
      marcaPropia: ownBrand,
      metodo: "engagement = (likes+comentarios)/seguidores ×100 por post; sentimiento en % de comentarios",
      marcas: computeBrandStats(cp, followers).slice(0, 8).map((b) => ({ marca: b.marca, posts: b.posts, postsPorSemana: b.posts_per_week, erPorSeguidor: b.engagement_promedio, seguidores: b.followers, positivoPct: b.positivo, negativoPct: b.negativo })),
      pilaresPropios: computePilarStats(cp.filter((p) => p.marca === ownBrand)).slice(0, 6),
      pilaresCompetencia: computePilarStats(cp.filter((p) => p.marca !== ownBrand)).slice(0, 6),
    };
  }
  return { instagram: ig, facebook: fb, formatosPorRed: formatTable(posts), sentimiento, competencia };
}

// ── Plan de medios ──
function pautaPack(P: PautaFull) {
  const camps = P.byCampaign.filter((c) => c.spend > 0 && !c.offline);
  const tot = sum(camps.map((c) => c.spend)) || 1;
  const agg = (k: (c: (typeof camps)[number]) => string) => aggBy(camps, k).map((a) => ({ grupo: a.medio, campañas: a.campañas, inversion: a.spend, share: pctOf(a.spend, tot), impresiones: a.impressions, clicks: a.clicks, cpm: a.cpm, cpc: a.cpc, ctr: a.ctr, vtr50: a.vtr50, cpcv: a.cpcv, vistasCompletas: a.p100 }));
  const t = P.totals;
  return {
    moneda: "ARS", medios: P.medios, rango: P.rangeLabel, avisos: P.warnings ?? [],
    reglaFuentes: "Medio con API (Meta, DV360 YouTube/Programmatic, Google Search/Demand Gen) = volumen de la API; OMD solo para medios sin API (TikTok, Mercado Ads, Geo, offline). UGC incluido; Performance Max excluido. DV360 USD→ARS con el fx del mes. Serie mensual solo meses cerrados. Alcance = suma por medio (no de-duplicado).",
    totales: { inversion: t.spend, inversionOffline: t.spendOffline ?? null, contactosOffline: t.contactosOffline ?? null, impresionesDigitales: t.impressions, alcanceMeta: t.reach, frecuenciaMeta: t.frequency, clicks: t.clicks, ctr: t.ctr, cpm: t.cpm, cpc: t.cpc, vtr50: t.vtr50, vtr100: t.vtr100, cpcv: t.cpcv },
    mensual: P.monthly.map((m) => ({ mes: m.mes, inversion: m.inv, inversionOffline: m.invOff ?? null, contactosOffline: m.contOff ?? null, impresiones: m.impr, alcance: m.alc, clicks: m.clic, cpm: m.impr ? ((m.invConImpr ?? m.inv - (m.invOff ?? 0)) / m.impr) * 1000 : null, ctr: m.impr ? pctOf(m.clic, m.impr) : null, vtr50: m.vbase ? pctOf(m.v50, m.vbase) : null, porMedio: m.invBy })),
    porMedio: agg(medioDe),
    porRol: agg((c) => rolDe(c.objective)),
    campañas: [...camps].sort((a, b) => b.spend - a.spend).slice(0, 15).map((c) => ({ nombre: cap(c.name, 60), medio: medioDe(c), rol: rolDe(c.objective), categoria: c.categoria, inversion: c.spend, share: pctOf(c.spend, tot), impresiones: c.impressions, alcance: c.reach || null, frecuencia: c.frequency || null, clicks: c.clicks, ctr: c.ctr, cpm: c.cpm, cpc: c.cpc, vtr50: c.vbase ? c.vtr50 : null, vtr100: c.vbase ? c.vtr100 : null, cpcv: c.p100 ? c.spend / c.p100 : null })),
    piezasMeta: P.topCreatives.slice(0, 8).map((c) => ({ nombre: cap(c.name, 60), activa: c.active, inversion: c.spend, impresiones: c.impressions, frecuencia: c.frequency, ctr: c.ctr, cpm: c.cpm, vtr100: c.vtr100 || null, reacciones: c.reactions, comentarios: c.comments, compartidos: c.shares, guardados: c.saves })),
    offline: P.offline ? { porMedio: P.offline.byMedio.map((m) => ({ medio: m.medio, inversion: m.spend, shareOffline: m.shareOffline, contactos: m.contactos, cpmContactos: m.cpmContactos })), meses: P.offline.meses } : null,
    embudoVideo: (t.vbase ?? 0) > 0 ? { impresionesVideo: t.vbase, p25: t.p25, p50: t.p50, p75: t.p75, p100: t.p100, retencion25: pctOf(t.p25, t.vbase ?? 0), retencion50: pctOf(t.p50, t.vbase ?? 0), retencion100: pctOf(t.p100, t.vbase ?? 0) } : null,
  };
}

// ── Web ──
function webPack(W: WebLoaded) {
  const r = W.reports;
  const year = new Date().getFullYear();
  const c = webTotals(r.cur), p = webTotals(r.prev);
  const { arr } = webMonthlyArr(r.monthly.rows, year);
  const ch = webChannels(r); const chTot = sum(ch.map((x) => x.sesiones));
  const land = webLandings(r); const lTot = sum(land.map((x) => x.sesiones));
  const delta = (a: number, b: number) => (b ? ((a - b) / b) * 100 : null);
  return {
    periodo: W.periodo,
    nota: "Fuente GA4 vía vistas mensuales. Conversión = eventos clave (conversiones GA4) / sesiones; por categoría la conversión no existe (solo total).",
    periodoActual: { ...c, conversionPct: c.sessions ? pctOf(c.ke, c.sessions) : null },
    periodoAnterior: { ...p, conversionPct: p.sessions ? pctOf(p.ke, p.sessions) : null },
    variacionPct: { usuarios: delta(c.users, p.users), sesiones: delta(c.sessions, p.sessions), eventosClave: delta(c.ke, p.ke), duracion: delta(c.avgSession, p.avgSession) },
    mensual: MES.map((m, i) => ({ mes: m, usuarios: arr.trafico[i], conversionPct: arr.conversion[i], duracionSesion: arr.avg_session[i] })).filter((x) => x.usuarios != null),
    canales: ch.slice(0, 10).map((x) => ({ canal: x.canal, sesiones: x.sesiones, share: pctOf(x.sesiones, chTot), eventosClave: x.eventosClave, convPct: x.conv })),
    categoriasDelSitio: land.slice(0, 10).map((l) => ({ categoria: l.path.replace(/^\//, ""), sesiones: l.sesiones, share: pctOf(l.sesiones, lTot), pageviews: l.pageviews })),
    competenciaWeb: W.competitor?.domains?.slice(0, 6).map((d) => ({ marca: d.marca, visitasEstimadas: d.visitas, rebote: d.bounce_rate, paginasPorVisita: d.pages_per_visit, variacionMensualPct: d.delta_mom, fuentes: d.fuentes })) ?? null,
  };
}

// ── SEO ──
function seoPack(D: SeoData) {
  return {
    categorias: D.categorias.slice(0, 4).map((cat) => {
      const sh = D.share.filter((s) => s.categoria === cat);
      const meses = [...new Set(sh.map((s) => s.mes))].sort();
      const last = meses[meses.length - 1];
      const ranking = sh.filter((s) => s.mes === last).sort((a, b) => b.share_pct - a.share_pct).slice(0, 6).map((s) => ({ marca: s.marca, propia: s.own, sharePct: s.share_pct, volumen: s.vol }));
      const lider = ranking.find((x) => !x.propia)?.marca;
      const serie = meses.slice(-6).map((m) => ({ mes: m, propia: sh.find((s) => s.mes === m && s.own)?.share_pct ?? null, lider: sh.find((s) => s.mes === m && s.marca === lider)?.share_pct ?? null }));
      const b = keywordBuckets(D.serp.filter((r) => r.categoria === cat));
      return {
        categoria: cat,
        shareOfSearch: { mes: last, ranking, serie6m: serie, lider },
        keywords: { volumenTotal: b.volTotal, faltantes: b.faltantes.slice(0, 8), quickWins4a20: b.quickWins.slice(0, 8), fuertesTop3: b.fuertes.slice(0, 6), conteo: { faltantes: b.faltantes.length, quickWins: b.quickWins.length, fuertes: b.fuertes.length } },
        visibilidadIA: D.llmo.filter((l) => l.categoria === cat).sort((a, b2) => b2.share_pct - a.share_pct).slice(0, 6).map((l) => ({ marca: l.marca, propia: l.own, sharePct: l.share_pct, menciones: l.menciones, prompts: l.prompts })),
        demandaMensual: D.demanda.filter((d) => d.categoria === cat).sort((a, b2) => a.mes.localeCompare(b2.mes)).slice(-12).map((d) => ({ mes: d.mes, busquedas: d.search_volume })),
      };
    }),
  };
}

// ── Tableros propios de Drean ──
const s12 = (xs: (number | null)[]) => xs.map((v, i) => (v == null ? null : { mes: MES[i], v })).filter(Boolean);
function cbPack(C: CbSignalInput) { return { nota: "% Cumplimiento del Cuadro Básico (surtido obligatorio) por mes, tiendas relevadas. Fuente trade_monthly (precalculada).", real: s12(C.cb), meta: s12(C.meta), objetivoTablero: C.objetivo }; }
function fsPack(F: FsSignalInput) {
  return {
    nota: "Floor Share = unidades Drean exhibidas ÷ total relevado en góndola. Mensual de trade_monthly; ranking y cadenas de fs_precomputed (vista precalculada).",
    porCategoria: Object.fromEntries(Object.entries(F.fsCat).map(([k, v]) => [k, { real: s12(v), meta: s12(F.metaCat[k] ?? []), objetivo: F.objetivo?.[k] }])),
    rankingPorCategoria: [...new Set((F.catBrand ?? []).map((r) => r.categoria))].map((c) => ({ categoria: c, marcas: (F.catBrand ?? []).filter((r) => r.categoria === c).sort((a, b) => b.share - a.share).slice(0, 5).map((r) => ({ marca: r.marca, share: r.share })) })),
    shareGeneral: F.overallShare,
    cadenas: [...(F.byCliente ?? [])].sort((a, b) => b.total.total_units - a.total.total_units).slice(0, 12).map((r) => ({ cliente: r.cliente, share: r.total.share, unidadesRelevadas: r.total.total_units })),
  };
}
function ugcPack(U: UgcSignalInput) {
  const er = (p: UgcSignalInput["pieces"][number]) => (p.impresiones ? ((p.reactions + p.comments + p.shares + p.saves) / p.impresiones) * 100 : 0);
  return {
    nota: "Piezas UGC pautadas en Meta (meta_paid_creatives categoría UGC) + análisis cualitativo de comentarios (ugc_piece_analysis). ER = interacciones / impresiones.",
    comparacionMarca: { cpmPautaMarca: U.brandCpm, erPautaMarca: U.brandEr },
    piezas: [...U.pieces].sort((a, b) => b.spend - a.spend).slice(0, 15).map((p) => ({ pieza: cap(p.nombre, 50), inversion: p.spend, impresiones: p.impresiones, cpm: p.impresiones ? (p.spend / p.impresiones) * 1000 : null, er: er(p), guardados: p.saves, compartidos: p.shares, vtr50: p.vbase ? (p.p50 / p.vbase) * 100 : null, credibilidad: p.analysis?.credibilidad, intencion: p.analysis?.intencion, percepcion: p.analysis?.percepcion })),
  };
}
function mercadoGfkPack(rows: MercadoRowLite[]) {
  const cats = [...new Set(rows.map((r) => r.categoria))];
  return {
    nota: "GfK mensual (value share y unit share, %). Segmentos High/Mid/Low + Total.",
    categorias: cats.map((c) => {
      const tot = rows.filter((r) => r.categoria === c && r.segmento === "Total");
      const meses = [...new Set(tot.map((r) => r.mes))].sort().slice(-6);
      const last = meses[meses.length - 1];
      return {
        categoria: c,
        rankingUltimoMes: tot.filter((r) => r.mes === last).sort((a, b) => (b.value_share ?? 0) - (a.value_share ?? 0)).slice(0, 6).map((r) => ({ marca: r.marca, value: r.value_share, unit: r.unit_share })),
        dreanSerie: meses.map((m) => { const r = tot.find((x) => x.mes === m && x.marca.toUpperCase() === "DREAN"); return { mes: m.slice(0, 7), value: r?.value_share ?? null, unit: r?.unit_share ?? null }; }),
        dreanPorSegmento: ["High", "Mid", "Low"].map((s) => { const r = rows.find((x) => x.categoria === c && x.segmento === s && x.mes === last && x.marca.toUpperCase() === "DREAN"); return { segmento: s, value: r?.value_share ?? null, unit: r?.unit_share ?? null }; }),
      };
    }),
  };
}
function saludPack(S: SaludSignalInput, mercado?: MercadoRowLite[] | null) {
  return {
    nota: "Kantar por ola (TOM/SOM/Intención/Poder en %). Son el resultado de los 4 objetivos estratégicos del Mapa. shareMat = value share GfK MAT de Drean.",
    porCategoria: Object.entries(S.kantar).map(([cat, byBrand]) => ({
      categoria: cat,
      drean: S.waves.map((w) => ({ ola: w, ...(byBrand[S.ownBrand ?? "Drean"]?.[w] ?? {}) })).filter((x) => Object.keys(x).length > 1),
      competidoresUltimaOla: Object.entries(byBrand).filter(([b]) => b !== (S.ownBrand ?? "Drean")).map(([b, v]) => { const w = [...S.waves].reverse().find((ww) => v[ww]?.tom != null); return w ? { marca: b, ola: w, ...v[w] } : null; }).filter(Boolean).slice(0, 5),
      shareMatUltimos: Object.entries(S.shareMat?.[cat] ?? {}).sort(([a], [b]) => a.localeCompare(b)).slice(-6),
    })),
    mercadoMensual: mercado ? mercadoGfkPack(mercado).categorias.map((c) => ({ categoria: c.categoria, dreanSerie: c.dreanSerie })) : null,
  };
}
function mktCanalPack(rows: MktCanalRowLite[]) {
  return { nota: "Acciones digitales en retailers (reportes de los retailers). CTR = clics/impresiones.", acciones: rows.slice(0, 40).map((r) => ({ cliente: r.cliente, accion: cap(r.accion, 40), mes: r.mes, plataforma: r.plataforma, impresiones: r.impresiones, clics: r.clics, ctr: r.impresiones ? pctOf(r.clics ?? 0, r.impresiones) : null, inversion: r.inversion, ingresos: r.ingresos })) };
}
function convPack(C: ConvSignalInput) {
  return {
    nota: "Pauta de conversión (campañas inhouse, ecommerce): costo de ga4_ads_cost_daily, compras/ingresos de ga4_purchases_daily (GA4). ROAS = ingresos/costo. Meses cerrados.",
    mensual: [...C.mensual].sort((a, b) => a.mesIdx - b.mesIdx).map((m) => ({ mes: MES[m.mesIdx], costo: m.costo, compras: m.compras, ingresos: m.ingresos, roas: m.costo ? m.ingresos / m.costo : null, cpa: m.compras ? m.costo / m.compras : null })),
    campanias: [...C.campanias].sort((a, b) => b.costo - a.costo).slice(0, 15).map((c) => ({ ...c, campania: cap(c.campania, 50), roas: c.costo ? c.ingresos / c.costo : null })),
  };
}
function inversionPack(I: NonNullable<DashLoaded["inversion"]>) {
  return { nota: `Ejecución del presupuesto de Marketing (USD) vs BGT vigente por cuatrimestre (T1·BGT, T2·4+8, T3·8+4). Tope desvío ${I.maxDesvio}%, Inv/Facturación ≤ ${I.maxInvFact}%.`, cuatrimestres: I.cuatris };
}
function overviewPack(L: DashLoaded) {
  const seg = L.seg;
  return {
    palancas: seg ? palancas(seg).slice(0, 8) : [],
    planes: {
      planDeMedios: L.pauta ? { inversion: L.pauta.totals.spend, impresiones: L.pauta.totals.impressions, ctr: L.pauta.totals.ctr, cpm: L.pauta.totals.cpm, vtr50: L.pauta.totals.vtr50, ultimosMeses: L.pauta.monthly.slice(-3).map((m) => ({ mes: m.mes, inversion: m.inv, impresiones: m.impr })) } : null,
      redesIG: L.redes?.ig?.ok ? { seguidores: L.redes.ig.followers, mensual: L.redes.ig.monthly.filter((m) => m.alcance != null).slice(-4).map((m) => ({ mes: m.mes, alcance: m.alcance, er: m.alcance ? pctOf(m.engagement ?? 0, m.alcance) : null })) } : null,
      web: L.web ? (() => { const c = webTotals(L.web.reports.cur); return { periodo: L.web.periodo.label, usuarios: c.users, sesiones: c.sessions, eventosClave: c.ke }; })() : null,
      seo: L.seo ? { shareOfSearchPropio: L.seo.brands.find((b) => b.own)?.share ?? null } : null,
      trade: { cb: L.cb ? s12(L.cb.cb).slice(-3) : null, floorShare: L.fs ? Object.fromEntries(Object.entries(L.fs.fsCat).map(([k, v]) => [k, s12(v).slice(-2)])) : null },
      mercado: L.mercado ? mercadoGfkPack(L.mercado).categorias.map((c) => ({ categoria: c.categoria, drean: c.dreanSerie.slice(-2), lider: c.rankingUltimoMes[0] })) : null,
      inversionBgt: L.inversion ? L.inversion.cuatris.map((c) => ({ id: c.id, estado: c.estado, desvio: c.desvio, invFact: c.invFact })) : null,
    },
  };
}

/** Señales del tablero sobre la data ya leída (reusa el ctx: no vuelve a leer). */
async function dashSignals(ctx: LoadCtx, dash: string): Promise<Signal[]> {
  if (dash === "overview") {
    const own = await computeSignals("overview", ctx).catch(() => [] as Signal[]);
    const others = await Promise.all((["performance", "redes", "web", "seo-search"] as SignalDash[]).map((d) => baseSignals(ctx, d).then((s) => s.slice(0, 3)).catch(() => [] as Signal[])));
    return [...own, ...sortSignals(others.flat())];
  }
  return computeSignals(dash as SignalDash, ctx).catch(() => [] as Signal[]);
}

/** Pack del tablero (texto JSON compacto) + señales (las del tablero; en overview, cruzadas). */
export async function buildDataPack(ctx: LoadCtx, dash: string, L: DashLoaded): Promise<{ pack: string; signals: Signal[] }> {
  let data: unknown = null;
  try {
    if (dash === "redes" && L.redes) data = redesPack(L.redes);
    else if (dash === "performance" && L.pauta) data = pautaPack(L.pauta);
    else if (dash === "web" && L.web) data = webPack(L.web);
    else if (dash === "seo-search" && L.seo) data = seoPack(L.seo);
    else if (dash === "cuadros-basicos" && L.cb) data = cbPack(L.cb);
    else if (dash === "floor-share" && L.fs) data = fsPack(L.fs);
    else if (dash === "influencia" && L.ugc) data = ugcPack(L.ugc);
    else if (dash === "mercado" && L.mercado) data = mercadoGfkPack(L.mercado);
    else if (dash === "salud-marca" && L.salud) data = saludPack(L.salud, L.mercado);
    else if (dash === "mkt-canal" && L.mktCanal) data = mktCanalPack(L.mktCanal);
    else if (dash === "performance-conversion" && L.conv) data = convPack(L.conv);
    else if (dash === "funnel" && L.inversion) data = inversionPack(L.inversion);
    else if (dash === "overview") data = overviewPack(L);
  } catch { data = null; }
  const signals = await dashSignals(ctx, dash);
  let mercado = "";
  try { if (L.cruces) mercado = JSON.stringify(rnd(mercadoPack(dash, L.cruces))); } catch { mercado = ""; }
  if (mercado.length > 3500) mercado = `${mercado.slice(0, 3500)}…(recortado)`;
  const room = MAX_PACK - (mercado ? mercado.length + 40 : 0);
  let pack = data ? JSON.stringify(rnd(data)) : "";
  if (pack.length > room) pack = `${pack.slice(0, room)}…(recortado)`;
  if (mercado) pack = pack ? `${pack}\n\nMERCADO (propios × mercado): ${mercado}` : `MERCADO (propios × mercado): ${mercado}`;
  return { pack, signals };
}

/** Señales en texto compacto para el prompt (top N, con impacto y acción). */
export function signalsForPrompt(signals: Signal[], n = 12): string {
  return signals.slice(0, n).map((s, i) => {
    const imp = s.impacto ? ` | impacto: ${s.impacto.valor.toLocaleString("es-AR", { maximumFractionDigits: 1 })} ${s.impacto.unidad} (${s.impacto.metrica})` : "";
    return `${i + 1}. [${s.tipo}/${s.prioridad}/${s.dash}${s.cruce ? "/cruce" : ""}] ${s.titulo} — ${s.descripcion}${imp} | acción sugerida: ${s.acciones[0] ?? "—"}`;
  }).join("\n");
}
