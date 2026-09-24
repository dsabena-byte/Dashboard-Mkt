// Test de los ADAPTADORES Drean → modelo de señales (BIP) + reglas propias de Drean, con datos
// SINTÉTICOS. Correr: cd apps/web && npx tsx scripts/signals-drean.test.ts
// Incluye una copia del cálculo ANTERIOR de computePautaImpacto (objetivos-kpis) para verificar
// que el modelo por medio extraído (lib/pauta-medios-model) da EXACTAMENTE los mismos totales.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { buildPautaMediosMensual, PAUTA_MES_FULL } from "../src/lib/pauta-medios-model";
import { esMedioApi } from "../src/lib/pauta-medios";
import { buildPautaFull, buildRedesInput, buildWebReports, buildSeoData, buildSeguimiento } from "../src/lib/signals/adapters";
import { computePautaSignals } from "../src/lib/signals/pauta";
import { computeRedesSignals } from "../src/lib/signals/redes";
import { computeWebSignals } from "../src/lib/signals/web";
import { computeSeoSignals } from "../src/lib/signals/seo";
import { computeOverviewSignals } from "../src/lib/signals/overview";
import { computeCrucesSignals } from "../src/lib/signals/cruces";
import { computeCbSignals, computeFsSignals, computeUgcSignals, computeMercadoSignals, computeSaludSignals, computeMktCanalSignals, computeConversionSignals, computeInversionSignals } from "../src/lib/signals/drean";
import type { Signal } from "../src/lib/signals/types";
import type { MetaPaidCreativeRow } from "../src/lib/meta-paid-queries";
import type { Dv360CreativeRow } from "../src/lib/dv360-data";

// ── Cálculo ANTERIOR (referencia, copiado tal cual de objetivos-kpis antes de la extracción) ──

function legacyComputePautaImpacto(
  data: any[],
  metaPaid: any[],
  dv360: any[],
  dv360Reach: any[],
  googleAdsOmd: any[],
  fxRates: Record<string, number>,
  anio: number,
  currentMonth: number,
): any[] {
  const DVMED: Record<string, string> = { YouTube: "YouTube", Programmatic: "Programmatic", "Demand Gen": "Google Demand Gen", Marketplace: "Mercado Ads" };
  const fxVals = Object.values(fxRates);
  const fxFallback = fxVals.length ? fxVals[fxVals.length - 1]! : 1;

  return PAUTA_MES_FULL.map((full, i) => {
    if (i + 1 >= currentMonth) return null; // solo meses cerrados
    const mesLabel = `${full} ${anio}`;
    const iso = `${anio}-${String(i + 1).padStart(2, "0")}-01`;
    const fx = fxRates[iso] ?? fxFallback;

    const omd = new Map<string, { impr: number; alc: number; clic: number; inv: number }>();
    for (const r of data) {
      // Meta (medio con API) NO se toma de OMD: entra por la API en el gap-fill de abajo (misma regla
      // que /performance). Antes el Seguimiento usaba la fila OMD de Meta → ago-2026 subcontaba $49M.
      if (r.mes !== mesLabel || esMedioApi(r.medio)) continue;
      const e = omd.get(r.medio) ?? { impr: 0, alc: 0, clic: 0, inv: 0 };
      e.impr += r.impresiones ?? 0; e.alc += r.alcance ?? 0; e.clic += r.clics ?? 0; e.inv += r.inversion ?? 0;
      omd.set(r.medio, e);
    }
    let inv = 0, impr = 0, alc = 0, clic = 0;
    for (const e of omd.values()) { inv += e.inv; impr += e.impr; alc += e.alc; clic += e.clic; }
    const present = new Set([...omd].filter(([, e]) => e.impr > 0).map(([m]) => m));

    const auto = new Map<string, { impr: number; alc: number; clic: number; inv: number }>();
    const addAuto = (medio: string, im: number, al: number, cl: number, iv: number) => {
      const e = auto.get(medio) ?? { impr: 0, alc: 0, clic: 0, inv: 0 };
      e.impr += im; e.alc += al; e.clic += cl; e.inv += iv; auto.set(medio, e);
    };
    for (const r of dv360) { if (r.mes === iso) addAuto(DVMED[r.canal] ?? r.canal, r.impresiones ?? 0, 0, r.clicks ?? 0, (r.revenue_usd ?? 0) * fx); }
    for (const r of dv360Reach) { if (r.mes === iso) { const e = auto.get(DVMED[r.canal] ?? r.canal); if (e) e.alc += r.reach ?? 0; } }
    for (const r of metaPaid) {
      if (r.mes !== mesLabel) continue;
      const medio = r.plataforma === "meta" ? "Meta" : r.plataforma === "tiktok" ? "TikTok" : null;
      if (!medio) continue;
      addAuto(medio, r.impresiones ?? 0, r.alcance ?? 0, r.clicks ?? 0, r.spend ?? 0);
    }
    for (const r of googleAdsOmd) { if (r.mes === mesLabel) addAuto(r.canal, r.impresiones, 0, r.clicks, r.costo); }
    for (const [medio, e] of auto) { if (!present.has(medio) && e.impr > 0) { impr += e.impr; alc += e.alc; clic += e.clic; inv += e.inv; } }

    let v50 = 0, vbase = 0;
    for (const r of metaPaid) {
      if (r.mes !== mesLabel) continue;
      if ((r.video_p25 ?? 0) + (r.video_p50 ?? 0) + (r.video_p75 ?? 0) > 0) { vbase += r.impresiones ?? 0; v50 += r.video_p50 ?? 0; }
    }
    for (const r of dv360) { if (r.mes === iso && (r.starts ?? 0) > 0) { vbase += r.impresiones ?? 0; v50 += r.q50 ?? 0; } }

    if (impr === 0 && inv === 0) return null;
    return { inv, alc, impr, clic, v50, vbase };
  });
}


// ───────────────────────────── helpers ─────────────────────────────
let fails = 0, passes = 0;
function ok(cond: unknown, msg: string) { if (cond) passes++; else { fails++; console.error("FAIL:", msg); } }
function near(a: number, b: number, msg: string, tol = 1e-6) { ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${msg} (got ${a}, want ${b})`); }
const keys = (s: Signal[]) => s.map((x) => x.key);
const has = (s: Signal[], k: string | RegExp) => s.some((x) => (typeof k === "string" ? x.key === k : k.test(x.key)));

const ANIO = 2026;
const NOW = new Date(Date.UTC(2026, 8, 20)); // 20-sep-2026 → meses cerrados: ene..ago
const CM = 9;
const meta = (o: Partial<MetaPaidCreativeRow>): MetaPaidCreativeRow => ({
  ad_id: "a", creative_id: null, mes: "Agosto 2026", plataforma: "meta", campaign_name: "C", adset_name: null, ad_name: "ad", objective: "OUTCOME_AWARENESS",
  categoria: "Lavado", tipo_compra: null, source: "api", thumbnail_url: null, image_url: null, body: null, permalink_url: null, instagram_permalink_url: null,
  impresiones: 0, alcance: 0, frecuencia: null, clicks: 0, spend: 0, ctr: null, cpm: null, cpc: null, views_total: null, views_completed: null, vtr: null,
  video_plays: 0, video_p25: 0, video_p50: 0, video_p75: 0, video_p100: 0, video_thruplay: 0, vtr_p25: null, vtr_p50: null, vtr_p75: null, vtr_p100: null,
  reactions: 0, comments: 0, shares: 0, saves: 0, post_engagement: null, dias_activos: null, activa: true, ...o,
});
const dv = (o: Partial<Dv360CreativeRow>): Dv360CreativeRow => ({ mes: "2026-08-01", canal: "YouTube", categoria: "Lavado", rol: "Awareness", creative: "x", impresiones: 0, clicks: 0, starts: 0, q25: 0, q50: 0, q75: 0, q100: 0, skips: 0, revenue_usd: 0, ...o });
const omd = (o: Record<string, unknown>) => ({ mes: "Agosto 2026", medio: "TikTok", categoria: "Lavado", objetivo: "Awareness", impresiones: 0, alcance: 0, clics: 0, inversion: 0, ...o }) as never;

// ───────────────────────────── 1. Modelo por medio == cálculo anterior ─────────────────────────────
{
  const pauta = [
    omd({ medio: "Meta", impresiones: 1_000_000, inversion: 13_400_000 }), // OMD de Meta: NO cuenta (regla API)
    omd({ medio: "TikTok", impresiones: 500_000, alcance: 200_000, clics: 900, inversion: 3_000_000 }),
    omd({ medio: "Mercado Ads", impresiones: 300_000, clics: 1500, inversion: 2_000_000 }),
    omd({ medio: "OOH", impresiones: 4_000_000, inversion: 35_500_000 }),
    omd({ mes: "Julio 2026", medio: "TikTok", impresiones: 0, inversion: 1_000_000 }), // OMD sin impresiones: no bloquea la API
    omd({ mes: "Septiembre 2026", medio: "TikTok", impresiones: 999, inversion: 7 }),   // mes no cerrado → fuera
  ];
  const metaPaid = [
    meta({ ad_id: "m1", impresiones: 2_000_000, alcance: 800_000, clicks: 4000, spend: 40_000_000, video_p25: 900_000, video_p50: 600_000, video_p75: 300_000 }),
    meta({ ad_id: "m2", impresiones: 1_500_000, alcance: 700_000, clicks: 2000, spend: 22_700_000 }),
    meta({ ad_id: "t1", plataforma: "tiktok", impresiones: 400_000, spend: 5_000_000 }),               // TikTok API bloqueado por OMD con impr
    meta({ ad_id: "t2", mes: "Julio 2026", plataforma: "tiktok", impresiones: 100_000, spend: 900_000 }), // julio: OMD sin impr → API suma
  ];
  const dv360 = [
    dv({ impresiones: 3_000_000, clicks: 1000, starts: 2_000_000, q50: 1_200_000, revenue_usd: 10_000 }),
    dv({ canal: "Programmatic", impresiones: 5_000_000, clicks: 3000, revenue_usd: 4_000 }),
    dv({ canal: "Marketplace", impresiones: 250_000, clicks: 500, revenue_usd: 1_000 }), // Mercado Ads: OMD presente → no suma
  ];
  const dvReach = [{ mes: "2026-08-01", canal: "YouTube", reach: 1_100_000 }];
  const gads = [
    { mes: "Agosto 2026", categoria: "Lavado", canal: "Google Search", costo: 3_000_000, impresiones: 200_000, clicks: 9000 },
    { mes: "Agosto 2026", categoria: "Lavado", canal: "Google Demand Gen", costo: 1_000_000, impresiones: 900_000, clicks: 2000 },
  ];
  const fx = { "2026-07-01": 1400, "2026-08-01": 1480 };
  const legacy = legacyComputePautaImpacto(pauta, metaPaid, dv360, dvReach, gads, fx, ANIO, CM);
  const neu = buildPautaMediosMensual({ pauta, metaPaid, dv360, dv360Reach: dvReach, googleAdsOmd: gads, fxRates: fx, anio: ANIO, currentMonth: CM });
  for (let i = 0; i < 12; i++) {
    const a = legacy[i], b = neu[i]?.tot ?? null;
    ok((a == null) === (b == null), `mes ${i} null-ness igual`);
    if (a && b) for (const k of ["inv", "alc", "impr", "clic", "v50", "vbase"] as const) ok(a[k] === b[k], `mes ${i} ${k} idéntico (${a[k]} vs ${b[k]})`);
  }
  const ago = neu[7]!;
  near(ago.medios.Meta!.inv, 62_700_000, "Meta ago = API ($62,7M), no la fila OMD ($13,4M)");
  ok(!("Mercado Ads" in ago.medios) || ago.medios["Mercado Ads"]!.fuente === "omd", "Mercado Ads: manda OMD, DV360 Marketplace no suma");
  near(ago.medios.YouTube!.inv, 10_000 * 1480, "DV360 YouTube USD→ARS con fx del mes");
  near(ago.medios.YouTube!.alc, 1_100_000, "reach DV360 al medio");
  ok(!ago.medios.TikTok || ago.medios.TikTok.fuente === "omd", "TikTok ago: OMD con impresiones bloquea la API");
  near(neu[6]!.medios.TikTok!.inv, 1_000_000 + 900_000, "TikTok jul: OMD sin impresiones + API");
  ok(neu[8] == null, "septiembre (mes en curso) excluido");

  // ── 2. PautaFull (señales) ──
  const P = buildPautaFull({ pauta, metaPaid, dv360, dv360Reach: dvReach, googleAdsOmd: [...gads, { mes: "Agosto 2026", categoria: "Otros", canal: "Google PMax", costo: 9e9, impresiones: 9e9, clicks: 1 }], fxRates: fx, anio: ANIO, now: NOW });
  const agoM = P.monthly.find((m) => m.mesIdx === 7)!;
  near(agoM.invOff ?? 0, 35_500_000, "OOH va como offline");
  near(agoM.contOff ?? 0, 4_000_000, "contactos OOH fuera de las impresiones digitales");
  ok(!(agoM.invBy ?? {})["Google PMax"], "PMax excluido de Pauta Mkt");
  ok(P.monthly.every((m) => m.mesIdx < 8), "serie mensual solo con meses cerrados");
  ok(P.byCampaign.some((c) => c.offline && c.medio === "OOH"), "fila offline OOH");
  ok(!P.byCampaign.some((c) => /pmax/i.test(c.name)), "sin campañas PMax");
  ok(P.byCampaign.filter((c) => c.medio === "Meta").reduce((s, c) => s + c.spend, 0) === 62_700_000, "campañas Meta suman la API");
  ok(P.topCreatives.length === 2 && P.topCreatives[0]!.id === "m1", "top creativos Meta por inversión");
  const sig = computePautaSignals(P, { now: NOW });
  ok(Array.isArray(sig), "computePautaSignals corre sobre el PautaFull adaptado");
  ok(sig.every((s) => s.dash === "performance"), "señales de pauta en dash performance");
  ok(has(sig, "pauta_off_medio_concentration") || has(sig, /pauta_/), `hay señales de pauta (${keys(sig).join(",")})`);
}

// ── 2b. Reasignación de video: 3 campañas de video con CPCV muy distinto ──
{
  const rows = [
    meta({ ad_id: "v1", campaign_name: "Video A", spend: 10_000_000, impresiones: 2_000_000, video_p25: 500_000, video_p50: 400_000, video_p75: 300_000, video_p100: 200_000 }),
    meta({ ad_id: "v2", campaign_name: "Video B", spend: 10_000_000, impresiones: 2_000_000, video_p25: 500_000, video_p50: 400_000, video_p75: 300_000, video_p100: 20_000 }),
    meta({ ad_id: "v3", campaign_name: "Video C", spend: 10_000_000, impresiones: 2_000_000, video_p25: 500_000, video_p50: 400_000, video_p75: 300_000, video_p100: 100_000 }),
  ];
  const P = buildPautaFull({ pauta: [], metaPaid: rows, dv360: [], dv360Reach: [], googleAdsOmd: [], fxRates: {}, anio: ANIO, now: NOW });
  const s = computePautaSignals(P, { now: NOW });
  ok(has(s, "pauta_realloc_video"), "reasignación de video detectada");
  ok(has(s, /pauta_cpcv_outlier_meta_video_b/), `CPCV outlier de "Video B" (${keys(s).join(",")})`);
}

// ───────────────────────────── 3. Redes ─────────────────────────────
{
  const day = (d: number) => new Date(NOW.getTime() - d * 864e5).toISOString();
  const igPosts = [
    ...Array.from({ length: 5 }, (_, i) => ({ post_id: `c${i}`, fecha_post: day(5 + i * 4), permalink: null, message: `nuevo ${i}`, media_type: "REELS", thumbnail_url: null, reach: 2000, engagement: 40 })),
    ...Array.from({ length: 5 }, (_, i) => ({ post_id: `p${i}`, fecha_post: day(35 + i * 4), permalink: null, message: `viejo ${i}`, media_type: "REELS", thumbnail_url: null, reach: 6000, engagement: 120 })),
    { post_id: "s1", fecha_post: day(3), permalink: null, message: "story", media_type: "STORY", thumbnail_url: null, reach: 900, engagement: 0 },
  ];
  const social = [
    { red_social: "INSTAGRAM", url: "u1", marca: "dreanargentina", fecha: day(4).slice(0, 10), pilar: "Producto", positivo: 20, negativo: 60, neutro: 20, resumen_sentimiento: "Neg: service", likes: 100, comentarios: 50, views: null, engagement: null, tipo: "ORGÁNICO", content_type: "VIDEO", followers: null, thumbnail_url: null, copy: null },
    { red_social: "INSTAGRAM", url: "u2", marca: "whirlpoolarg", fecha: day(4).slice(0, 10), pilar: "Promo", positivo: null, negativo: null, neutro: null, resumen_sentimiento: null, likes: 1000, comentarios: 100, views: null, engagement: null, tipo: "ORGÁNICO", content_type: "VIDEO", followers: null, thumbnail_url: null, copy: null },
  ];
  const followers = [
    { marca: "dreanargentina", red_social: "INSTAGRAM", fecha: "2026-05-01", followers: 144000 },
    { marca: "whirlpoolarg", red_social: "INSTAGRAM", fecha: "2026-05-01", followers: 149000 },
  ];
  const igMonthly = Array.from({ length: 12 }, (_, i) => ({ mes: `m${i}`, alcance: i < 8 ? (i === 7 ? 20_000 : 60_000) : null, engagement: i < 8 ? 1500 : null }));
  const R = buildRedesInput({ year: ANIO, refDate: NOW, igPosts, igMonthly, fbPosts: [], fbMonthly: [], social, followers, ownKey: "dreanargentina", labels: { dreanargentina: "Drean", whirlpoolarg: "Whirlpool" } });
  ok(R.ig?.monthly[7]?.mesIdx === 7 && R.ig?.monthly[7]?.anio === ANIO, "IG mensual con mesIdx/año");
  ok(R.sentiment.length === 1 && R.sentiment[0]!.sentiment!.negativo === 30, "sentimiento: % → cantidad de comentarios");
  ok(R.competitor?.ownBrand === "Drean" && R.competitor.posts.some((p) => p.marca === "Whirlpool"), "competencia con labels de marca");
  near(R.competitor!.posts.find((p) => p.marca === "Drean")!.engagement!, (150 / 144000) * 100, "engagement por seguidor recalculado (enrichEngagement)");
  const s = computeRedesSignals({ ...R, refDate: NOW });
  ok(has(s, "redes_IG_Reels/Video_reach_per_post_drop"), `caída de alcance por pieza en Reels (${keys(s).join(",")})`);
  ok(has(s, "redes_ig_monthly_reach_drop"), "caída de alcance mensual IG (ago vs 3 previos)");
}

// ───────────────────────────── 4. Web ─────────────────────────────
{
  const monthly = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((m) => ({ mes: `2026-${String(m).padStart(2, "0")}-01`, sesiones: m === 8 ? 300_000 : 500_000, pageviews: 800_000, bounce_rate: 0.03, avg_session_duration: 140 }));
  const users = monthly.map((m) => ({ mes: m.mes, total_users: (m.sesiones ?? 0) * 0.8, new_users: 1 }));
  const chan = [
    { mes: "2026-08-01", canal: "Paid Social", sesiones: 200_000, conversiones: 10, pageviews: 1 },
    { mes: "2026-08-01", canal: "Paid Search", sesiones: 30_000, conversiones: 400, pageviews: 1 },
    { mes: "2026-08-01", canal: "Organic Search", sesiones: 50_000, conversiones: 50, pageviews: 1 },
    { mes: "2026-07-01", canal: "Paid Social", sesiones: 500_000, conversiones: 400, pageviews: 1 },
  ];
  const cats = [{ fecha: "2026-08-10", categoria: "Lavado", usuarios: 1, sesiones: 1000, conversiones: 0, pageviews: 2000 }];
  const W = buildWebReports({ year: ANIO, now: NOW, monthly, users, chan, cats })!;
  ok(W.periodo.start === "2026-08-01", "período web = último mes cerrado");
  const s = computeWebSignals(W.reports, { now: NOW, year: ANIO });
  ok(has(s, "web_traffic_drop"), `caída de sesiones vs mes previo (${keys(s).join(",")})`);
  ok(has(s, "web_channel_convert_Paid Search"), "canal que convierte sobre el promedio");
  ok(has(s, "web_monthly_traffic_drop"), "serie mensual: usuarios ago vs 3 previos");
}

// ───────────────────────────── 5. SEO ─────────────────────────────
{
  const share = ["2026-05-01", "2026-06-01", "2026-07-01", "2026-08-01"].flatMap((mes, i) => [
    { categoria: "lavarropas", marca: "Drean", mes, vol: 10_000 - i * 1500, share_pct: 30 - i * 3 },
    { categoria: "lavarropas", marca: "Samsung", mes, vol: 20_000, share_pct: 45 },
  ]);
  const serp = [
    { marca: "Drean", keyword: "lavarropas automatico", categoria: "lavarropas", posicion: 8, search_volume: 60_500 },
    { marca: "ML", keyword: "lavarropas automatico", categoria: "lavarropas", posicion: 1, search_volume: 60_500 },
    { marca: "Frávega", keyword: "lavarropas carga frontal", categoria: "lavarropas", posicion: 2, search_volume: 40_000 },
    { marca: "Drean", keyword: "lavarropas drean", categoria: "lavarropas", posicion: 1, search_volume: 33_100 },
  ];
  const D = buildSeoData({ ownBrand: "Drean", share, trends: [], serp, regions: [], llmo: [{ categoria: "lavarropas", marca: "Whirlpool", mes: "2026-08-01", menciones: 5, prompts: 5, share_pct: 30, rank_prom: 1 }], demanda: [] })!;
  const s = computeSeoSignals(D);
  ok(has(s, "seo_share_gap_lavarropas"), `brecha de share of search (${keys(s).join(",")})`);
  ok(has(s, "seo_share_trend_down_lavarropas"), "share of search cae 3 meses");
  ok(has(s, "seo_keywords_quick_wins_lavarropas"), "quick wins pos 4-20");
  ok(has(s, "seo_keywords_missing_lavarropas"), "keywords faltantes");
  ok(has(s, "seo_llm_absent_lavarropas"), "ausente en IA");
}

// ───────────────────────────── 6. Seguimiento ─────────────────────────────
{
  const seg = { disponible: true, refMes: "Ago", objetivos: [{ id: "tom", nombre: "TOM", pesoEstrategico: 25, cumplMes: 70, cumplYtd: 55, cobertura: 100, aportes: [{ kpi: "Alcance único", peso: 60, cumpl: 50 }, { kpi: "VTR (≥50%)", peso: 40, cumpl: 90 }] }], saludMarca: { cumplMes: 60, cumplYtd: 80 } };
  const kpis = [
    { plan: "Pauta Mkt", kpi: "Alcance único", tipo: "sum" as const, realM: [10, 9, 8, null, null, null, null, null, null, null, null, null], metaM: Array(12).fill(10), direccion: "up" as const },
    { plan: "Pauta Mkt", kpi: "Inversión", tipo: "sum" as const, realM: Array(12).fill(1), metaM: Array(12).fill(1), direccion: "up" as const },
  ];
  const S = buildSeguimiento(seg, kpis);
  ok(S.kpis.length === 1 && S.kpis[0]!.kpi === "Alcance único", "solo KPIs del Mapa (Inversión fuera)");
  const s = computeOverviewSignals(S);
  ok(has(s, "overview_objective_off_tom"), `objetivo fuera de rumbo (${keys(s).join(",")})`);
  ok(has(s, /overview_lever_/), "palancas");
  ok(has(s, "overview_salud_trend"), "salud de marca mes vs YTD");
}

// ───────────────────────────── 7. Tableros propios de Drean ─────────────────────────────
{
  const cb = computeCbSignals({ cb: [null, null, 58, 59, 68, 72, 70, 60, null, null, null, null], meta: Array(12).fill(75) });
  ok(has(cb, "cb_below_meta") && has(cb, "cb_trend_down"), `CB bajo meta y en caída (${keys(cb).join(",")})`);
  const fs = computeFsSignals({
    fsCat: { Lavado: [null, null, 25, 24, 22, 22, 22, 20, null, null, null, null] }, metaCat: { Lavado: Array(12).fill(32) },
    catBrand: [{ marca: "Samsung", share: 26, categoria: "Lavado" }, { marca: "Drean", share: 20, categoria: "Lavado" }],
    byCliente: Array.from({ length: 6 }, (_, i) => ({ cliente: `C${i}`, total: { share: i === 0 ? 8 : 22, drean_units: 10, total_units: 1000 - i } })), overallShare: 21,
  });
  ok(has(fs, "fs_below_meta_lavado") && has(fs, "fs_leader_lost_Lavado") && has(fs, "fs_clientes_bajo_share"), `Floor Share (${keys(fs).join(",")})`);
  const ugc = computeUgcSignals({
    pieces: [
      { id: "1", nombre: "star", permalink: null, spend: 100, impresiones: 10_000, clicks: 0, reactions: 500, comments: 0, shares: 0, saves: 0, vbase: 0, p50: 0, analysis: { intencion: "alta" } },
      ...[2, 3, 4].map((i) => ({ id: `${i}`, nombre: `p${i}`, permalink: null, spend: 1000, impresiones: 10_000, clicks: 0, reactions: 100, comments: 0, shares: 0, saves: 0, vbase: 0, p50: 0, analysis: { percepcion: i === 2 ? "negativa" : "positiva" } })),
    ], brandCpm: 500, brandEr: 0.2,
  });
  ok(has(ugc, "ugc_piece_star_1") && has(ugc, "ugc_percepcion_negativa") && has(ugc, "ugc_vs_brand_engagement") && has(ugc, "ugc_intencion_alta_subinvertida"), `UGC (${keys(ugc).join(",")})`);
  const merc = computeMercadoSignals([
    ...["2026-04-01", "2026-05-01", "2026-06-01", "2026-07-01"].map((mes, i) => ({ mes, categoria: "Lavado", segmento: "Total", marca: "DREAN", unit_share: 30, value_share: 28 - i * 1.2 })),
    { mes: "2026-07-01", categoria: "Lavado", segmento: "Total", marca: "SAMSUNG", unit_share: 20, value_share: 30 },
    { mes: "2026-07-01", categoria: "Lavado", segmento: "High", marca: "DREAN", unit_share: 5, value_share: 10 },
  ]);
  ok(has(merc, "mercado_leader_gap_Lavado") && has(merc, "mercado_share_down_Lavado") && has(merc, "mercado_segment_weak_High_Lavado"), `Mercado (${keys(merc).join(",")})`);
  const sal = computeSaludSignals({
    kantar: { Lavado: { Drean: { "jun-25": { tom: 45, som: 74, int: 38, poder: 19.6 }, "nov-25": { tom: 40, som: 69, int: 40, poder: 17.4 } }, Samsung: { "nov-25": { tom: 14, som: 47, int: 34, poder: 16 } } } },
    waves: ["jun-25", "nov-25"], shareMat: { Lavado: { "2025-06": 25, "2025-11": 26 } },
  });
  ok(has(sal, "salud_tom_down_Lavado") && has(sal, "salud_cruce_share_up_tom_down_Lavado"), `Salud de marca + cruce share↔TOM (${keys(sal).join(",")})`);
  ok(sal.find((x) => x.key === "salud_cruce_share_up_tom_down_Lavado")?.cruce === true, "el cruce se marca cruce:true");
  const mk = computeMktCanalSignals([
    { cliente: "A", accion: "x", mes: "2026-01", plataforma: "Meta", impresiones: 100_000, clics: 5000, conversiones: null, ingresos: null, inversion: null },
    { cliente: "B", accion: "y", mes: "2026-01", plataforma: "Meta", impresiones: 100_000, clics: 1000, conversiones: null, ingresos: null, inversion: null },
    { cliente: "C", accion: "z", mes: "2026-01", plataforma: "Meta", impresiones: 100_000, clics: 1100, conversiones: null, ingresos: null, inversion: null },
    { cliente: "D", accion: "w", mes: "2026-01", plataforma: "Meta", impresiones: 100_000, clics: 200, conversiones: null, ingresos: null, inversion: null },
    { cliente: "E", accion: "v", mes: "2026-01", plataforma: "Meta", impresiones: 100_000, clics: 1000, conversiones: null, ingresos: null, inversion: null },
  ]);
  ok(has(mk, /mktcanal_best_Meta_A/) && has(mk, "mktcanal_sin_inversion"), `Mkt Canal (${keys(mk).join(",")})`);
  const conv = computeConversionSignals({
    mensual: [4, 5, 6, 7].map((i) => ({ mesIdx: i, costo: 1000, compras: 10, ingresos: i === 7 ? 2000 : 5000, clicks: 1 })),
    campanias: [{ campania: "inhouse_a", costo: 5000, compras: 10, ingresos: 5000 }, { campania: "inhouse_b", costo: 500, compras: 5, ingresos: 5000 }, { campania: "inhouse_c", costo: 2000, compras: 5, ingresos: 6000 }],
  });
  ok(has(conv, "conv_roas_drop") && has(conv, "conv_realloc"), `Conversión (${keys(conv).join(",")})`);
  const inv = computeInversionSignals([
    { id: "T1", label: "Ene–Abr", estado: "cerrado", bgtAvailable: true, bgtLabel: "BGT", coverage: null, bgtVal: 100, realVal: 112, desvio: 12, invFact: 1.5, evaluable: true },
    { id: "T3", label: "Sep–Dic", estado: "en curso", bgtAvailable: false, bgtLabel: "BGT 8+4", coverage: "Sep", bgtVal: 0, realVal: 10, desvio: null, invFact: null, evaluable: true },
  ], { maxDesvio: 5, maxInvFact: 1.3 });
  ok(has(inv, "inv_sobre_ejecucion_T1") && has(inv, "inv_fact_alta_T1") && has(inv, "inv_bgt_missing_T3"), `Inversión BGT (${keys(inv).join(",")})`);
}

// ───────────────────────────── 8. Cruces (propios × mercado) ─────────────────────────────
{
  const monthly = ["Feb", "Mar", "Abr", "May", "Jun", "Jul"].map((m, i) => ({ mes: `${m} 26`, mesIdx: i + 1, inv: i < 3 ? 100e6 : 50e6, alc: 0, impr: 1, clic: 0, v50: 0, vbase: 0 }));
  const share = ["2026-02-01", "2026-03-01", "2026-04-01", "2026-05-01", "2026-06-01", "2026-07-01"].flatMap((mes, i) => [
    { categoria: "lavarropas", marca: "Drean", mes, vol: i < 3 ? 30_000 : 20_000, share_pct: 0 },
    { categoria: "lavarropas", marca: "Samsung", mes, vol: 50_000, share_pct: 0 },
  ]);
  const D = buildSeoData({ ownBrand: "Drean", share, trends: [], serp: [], regions: [], llmo: [], demanda: [] })!;
  const s = computeCrucesSignals({ now: NOW, ownBrand: "Drean", pauta: { monthly, currency: "ARS", year: ANIO }, seo: D, social: null, web: null, competitorWeb: null, searchConsole: null });
  ok(has(s, "cruce_esov_sos_down_spend_down"), `ESOV: baja inversión y cae el share of search (${keys(s).join(",")})`);
}

console.log(`\nsignals-drean: ${passes} OK, ${fails} FAIL`);
if (fails) process.exit(1);
