import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";

// Serie real mensual (año completo) + meta de cada KPI estratégico con meta cargada.
// Centraliza acá lo que hoy vive disperso en cada dashboard, para el tab "Estado de
// KPIs" de Seguimiento Objetivos. Solo se computan meses CERRADOS (el mes en curso
// arranca parcial → null), consistente con las cards de cada tablero.

import { getMetaKpi } from "./metas-server";
import { getPautaPerformance } from "./pauta-queries";
import { getMetaPaidCreatives } from "./meta-paid-queries";
import { getDv360Creatives, getDv360Reach } from "./dv360-queries";
import { getGoogleAdsOmd } from "./google-ads-omd-queries";
import { getFxRates } from "./fx-queries";
import { getWebDailyKpis, getAllMonthlyUsers } from "./web-queries";
import { getIgOrganicSummary } from "./meta-ig-queries";
import { getCbRows, computeTotals, isoWeekToMes } from "./cb-queries";
import { getFloorShareRows, computeOverall } from "./floor-share-queries";
import { generalPonderado } from "./categorias";
import type { MetaKpiData } from "./metas-server";

export type KpiUnit = "$" | "" | "x" | "%" | "s";

export interface KpiSeguimiento {
  plan: string;
  kpi: string;
  medida: string;
  unit: KpiUnit;
  tipo: "sum" | "rate"; // cómo se acumula el YTD
  realM: (number | null)[]; // 12 valores (índice 0 = enero)
  metaM: (number | null)[]; // 12 valores
  direccion: "up" | "down";
  umbralVerde: number;
  umbralAmarillo: number;
  // Real por categoría (Brand/Lavado/Refrigeración/Cocción). Undefined = KPI sin
  // desglose (usa el total para las 3). Cada valor = realM × share de la categoría.
  realCatM?: Record<string, (number | null)[]>;
  // Meta POR categoría (solo KPIs con meta propia por categoría, ej. Floor Share).
  // Undefined = la meta por categoría se deriva del mix del Mapa (SUM) o es total (rate).
  metaCatM?: Record<string, (number | null)[]>;
}

// Categorías del desglose (deben matchear MIX_CATEGORIAS del mapa).
const CATS4 = ["Brand", "Lavado", "Refrigeración", "Cocción"] as const;
// Normaliza el valor de categoría de la data cruda a una de CATS4 (o null = ignorar).
// Cocinas = Cocción; Promoción/UGC/Home se doblan a Brand; Lavavajillas/Otros/null se ignoran.
function normCat(raw: string | null | undefined): (typeof CATS4)[number] | null {
  const c = (raw ?? "").toLowerCase();
  if (c.includes("lavado")) return "Lavado";
  if (c.includes("refri")) return "Refrigeración";
  if (c.includes("cocc") || c.includes("cocin")) return "Cocción";
  if (c.includes("brand") || c.includes("promo") || c.includes("ugc") || c === "home") return "Brand";
  return null;
}
// share por mes: acc[mes][cat] / Σcat. Devuelve Record<cat, share[12]>.
function sharesFromTotals(acc: Array<Record<string, number>>): Record<string, (number | null)[]> {
  const out: Record<string, (number | null)[]> = {};
  for (const c of CATS4) out[c] = Array.from({ length: 12 }, () => null);
  acc.forEach((byCat, m) => {
    const tot = CATS4.reduce((a, c) => a + (byCat[c] ?? 0), 0);
    if (tot <= 0) return;
    for (const c of CATS4) out[c]![m] = (byCat[c] ?? 0) / tot;
  });
  return out;
}
const applyShare = (realM: (number | null)[], share: Record<string, (number | null)[]>): Record<string, (number | null)[]> => {
  const out: Record<string, (number | null)[]> = {};
  for (const c of CATS4) out[c] = realM.map((r, m) => (r == null || share[c]![m] == null ? null : r * share[c]![m]!));
  return out;
};
const MES_FULL = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

async function safe<T>(p: Promise<T>, fallback: T): Promise<T> {
  try { return await p; } catch { return fallback; }
}

// Fetch REST directo (service key) para vistas/tablas sin helper propio.
async function fetchRows<T>(query: string): Promise<T[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return [];
  const res = await fetch(`${url}/rest/v1/${query}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    cache: "no-store",
  });
  if (!res.ok) return [];
  return (await res.json()) as T[];
}

type WebCatRow = { fecha: string; categoria: string | null; usuarios: number | null };
type IgCatRow = { fecha_post: string; categoria: string | null; reach: number | null };
// Distribución por categoría (Web usuarios · IG reach) para el real por categoría.
// CACHE 30 min: es data de fuente (sin metas → no afecta el guardado de metas) y el
// view vw_drean_web_by_category es LENTO (~6s). Cachearlo evita pagarlo en cada carga.
const getWebIgCatRows = unstable_cache(
  async (anio: number): Promise<{ web: WebCatRow[]; ig: IgCatRow[] }> => {
    const [web, ig] = await Promise.all([
      safe(fetchRows<WebCatRow>(`vw_drean_web_by_category?fecha=gte.${anio}-01-01&fecha=lte.${anio}-12-31&select=fecha,categoria,usuarios`), []),
      safe(fetchRows<IgCatRow>(`meta_posts?platform=eq.instagram&fecha_post=gte.${anio}-01-01&fecha_post=lt.${anio + 1}-01-01&select=fecha_post,categoria,reach`), []),
    ]);
    return { web, ig };
  },
  ["objetivos-webig-cat-rows-v1"],
  { revalidate: 1800 },
);

// ===== Pauta Mkt: mismo modelo gap-fill que impactoMensual (performance-client) =====
interface PautaMes { inv: number; alc: number; impr: number; clic: number; v50: number; vbase: number }

function computePautaImpacto(
  data: Awaited<ReturnType<typeof getPautaPerformance>>,
  metaPaid: Awaited<ReturnType<typeof getMetaPaidCreatives>>,
  dv360: Awaited<ReturnType<typeof getDv360Creatives>>,
  dv360Reach: Awaited<ReturnType<typeof getDv360Reach>>,
  googleAdsOmd: Awaited<ReturnType<typeof getGoogleAdsOmd>>,
  fxRates: Record<string, number>,
  anio: number,
  currentMonth: number,
): (PautaMes | null)[] {
  const DVMED: Record<string, string> = { YouTube: "YouTube", Programmatic: "Programmatic", "Demand Gen": "Google Demand Gen", Marketplace: "Mercado Ads" };
  const fxVals = Object.values(fxRates);
  const fxFallback = fxVals.length ? fxVals[fxVals.length - 1]! : 1;

  return MES_FULL.map((full, i) => {
    if (i + 1 >= currentMonth) return null; // solo meses cerrados
    const mesLabel = `${full} ${anio}`;
    const iso = `${anio}-${String(i + 1).padStart(2, "0")}-01`;
    const fx = fxRates[iso] ?? fxFallback;

    const omd = new Map<string, { impr: number; alc: number; clic: number; inv: number }>();
    for (const r of data) {
      if (r.mes !== mesLabel) continue;
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

// Extrae una serie de 12 desde un array de PautaMes con un accessor (sum) o num/den (rate).
const serieSum = (ms: (PautaMes | null)[], f: (m: PautaMes) => number): (number | null)[] =>
  ms.map((m) => (m ? f(m) : null));
const serieRate = (ms: (PautaMes | null)[], num: (m: PautaMes) => number, den: (m: PautaMes) => number, scale = 1): (number | null)[] =>
  ms.map((m) => (m && den(m) > 0 ? (num(m) / den(m)) * scale : null));

// NO usar unstable_cache acá: las queries usan getServerSupabase() (cookies()), que
// EXPLOTA fuera del scope del request → los datos salían vacíos. Se usa React cache()
// para dedup POR REQUEST (el tab "Estado" lo llama 2x: directo + vía el rollup).
export const getSeguimientoKpis = cache(
  async (anio: number): Promise<KpiSeguimiento[]> => computeSeguimientoKpis(anio),
);

async function computeSeguimientoKpis(anio: number): Promise<KpiSeguimiento[]> {
  const now = new Date();
  const currentMonth = now.getUTCFullYear() > anio ? 13 : now.getUTCFullYear() < anio ? 1 : now.getUTCMonth() + 1;
  const closed = (i: number) => i + 1 < currentMonth;

  const yearRange = { from: `${anio}-01-01`, to: `${anio}-12-31` };

  const [
    pauta, metaPaid, dv360, dv360Reach, gads, fx,
    webDaily, monthlyUsers, ig,
    mInv, mAlc, mFrec, mImpr, mVtr, mClicks,
    mWebUsers, mWebAvg, mWebConv,
    mIgAlc, mIgEng,
    cbRows, fsRows, mCb, mFsLav, mFsRef, mFsCoc,
  ] = await Promise.all([
    safe(getPautaPerformance(true), [] as Awaited<ReturnType<typeof getPautaPerformance>>),
    safe(getMetaPaidCreatives(true), [] as Awaited<ReturnType<typeof getMetaPaidCreatives>>),
    safe(getDv360Creatives(), [] as Awaited<ReturnType<typeof getDv360Creatives>>),
    safe(getDv360Reach(), [] as Awaited<ReturnType<typeof getDv360Reach>>),
    safe(getGoogleAdsOmd(), [] as Awaited<ReturnType<typeof getGoogleAdsOmd>>),
    safe(getFxRates(), {} as Record<string, number>),
    safe(getWebDailyKpis(yearRange), [] as Awaited<ReturnType<typeof getWebDailyKpis>>),
    safe(getAllMonthlyUsers(), [] as Awaited<ReturnType<typeof getAllMonthlyUsers>>),
    safe(getIgOrganicSummary(yearRange), null as Awaited<ReturnType<typeof getIgOrganicSummary>> | null),
    getMetaKpi("Pauta Mkt", "Inversión", anio),
    getMetaKpi("Pauta Mkt", "Alcance único", anio),
    getMetaKpi("Pauta Mkt", "Frecuencia", anio),
    getMetaKpi("Pauta Mkt", "Impresiones", anio),
    getMetaKpi("Pauta Mkt", "VTR (≥50%)", anio),
    getMetaKpi("Pauta Mkt", "Clicks", anio),
    getMetaKpi("Web / Ecommerce", "Tráfico web (usuarios)", anio),
    getMetaKpi("Web / Ecommerce", "Avg Sesión (segundos)", anio),
    getMetaKpi("Web / Ecommerce", "Tasa de conversión", anio),
    getMetaKpi("Redes Sociales", "Alcance orgánico", anio),
    getMetaKpi("Redes Sociales", "Engagement rate", anio),
    // Trade (proyecto CB): filas crudas para agregar por mes + metas.
    safe(getCbRows({}), [] as Awaited<ReturnType<typeof getCbRows>>),
    safe(getFloorShareRows({}), [] as Awaited<ReturnType<typeof getFloorShareRows>>),
    getMetaKpi("Cuadros Básicos", "% Cumplimiento CB", anio),
    getMetaKpi("Floor Share", "Floor Share (exhibición)", anio, "Lavado"),
    getMetaKpi("Floor Share", "Floor Share (exhibición)", anio, "Refrigeración"),
    getMetaKpi("Floor Share", "Floor Share (exhibición)", anio, "Cocción"),
  ]);

  // ---- Pauta (6) ----
  const pm = computePautaImpacto(pauta, metaPaid, dv360, dv360Reach, gads, fx, anio, currentMonth);

  // ---- Web (3): agrega los daily kpis por mes (solo meses cerrados) ----
  const webAgg = Array.from({ length: 12 }, () => ({ ses: 0, conv: 0, avgW: 0, usu: 0, has: false }));
  for (const r of webDaily) {
    if (!r.fecha?.startsWith(String(anio))) continue;
    const mi = Number(r.fecha.slice(5, 7)) - 1;
    if (mi < 0 || mi > 11) continue;
    const a = webAgg[mi]!;
    a.ses += r.sesiones ?? 0; a.conv += r.conversiones ?? 0; a.usu += r.usuarios ?? 0;
    a.avgW += (r.avg_session_duration ?? 0) * (r.sesiones ?? 0);
    a.has = true;
  }
  // Usuarios únicos por mes desde ga4_monthly_users (más preciso que la suma diaria).
  const usersByMonth = new Map<number, number>();
  for (const u of monthlyUsers) {
    if (!u.mes?.startsWith(String(anio))) continue;
    usersByMonth.set(Number(u.mes.slice(5, 7)) - 1, u.total_users ?? 0);
  }
  const webUsersM = webAgg.map((a, i) => (closed(i) && a.has ? (usersByMonth.get(i) ?? a.usu) : null));
  const webAvgM = webAgg.map((a, i) => (closed(i) && a.ses > 0 ? a.avgW / a.ses : null));
  const webConvM = webAgg.map((a, i) => (closed(i) && a.ses > 0 ? (a.conv / a.ses) * 100 : null));

  // ---- Instagram (2): de monthlyData (año completo), solo meses cerrados ----
  const igAlcM: (number | null)[] = Array.from({ length: 12 }, () => null);
  const igEngM: (number | null)[] = Array.from({ length: 12 }, () => null);
  if (ig) {
    ig.monthlyData.forEach((d, i) => {
      if (!closed(i)) return;
      igAlcM[i] = d.alcance;
      igEngM[i] = d.alcance && d.engagement != null && d.alcance > 0 ? (d.engagement / d.alcance) * 100 : null;
    });
  }

  // ---- Trade: Cuadros Básicos (% CB por mes) y Floor Share (Drean por categoría → General) ----
  // OJO: isoWeekToMes devuelve el mes CORTO ("Ene".."Dic"), no el completo.
  const MES_SHORT = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  const cbRealM = MES_SHORT.map((short, i) => {
    if (!closed(i)) return null;
    const rows = cbRows.filter((r) => isoWeekToMes(r.semana, anio) === short);
    return rows.length ? computeTotals(rows).cb_pct : null;
  });
  const fsRealM = MES_SHORT.map((short, i) => {
    if (!closed(i)) return null;
    const rows = fsRows.filter((r) => isoWeekToMes(r.semana, anio) === short);
    if (!rows.length) return null;
    const o = computeOverall(rows);
    return generalPonderado({ Lavado: o.lavado.share, Refrigeración: o.refri.share, Cocción: o.coccion.share });
  });
  // Meta General de Floor Share = Σ (meta por categoría × peso). Se construye una
  // MetaKpiData sintética (dirección/umbrales de la config por categoría).
  const fsMetaM = Array.from({ length: 12 }, (_, i) =>
    generalPonderado({ Lavado: mFsLav.valores[i], Refrigeración: mFsRef.valores[i], Cocción: mFsCoc.valores[i] }),
  );
  const mFs: MetaKpiData = { valores: fsMetaM, direccion: mFsLav.direccion, umbralVerde: mFsLav.umbralVerde, umbralAmarillo: mFsLav.umbralAmarillo, unidad: "%" };

  // ===== Shares por categoría por plan (para el real por categoría) =====
  const mesIdxFull = (label: string) => MES_FULL.indexOf(label.split(" ")[0] ?? "");
  const emptyAcc = () => Array.from({ length: 12 }, () => ({}) as Record<string, number>);
  // Pauta: distribución por impresiones (pauta_performance + meta_paid).
  const pautaAcc = emptyAcc();
  for (const r of pauta) { const mi = mesIdxFull(r.mes); const c = normCat(r.categoria); if (mi >= 0 && c) pautaAcc[mi]![c] = (pautaAcc[mi]![c] ?? 0) + (r.impresiones ?? 0); }
  for (const r of metaPaid) { const mi = mesIdxFull(r.mes); const c = normCat(r.categoria); if (mi >= 0 && c) pautaAcc[mi]![c] = (pautaAcc[mi]![c] ?? 0) + (r.impresiones ?? 0); }
  const pautaShare = sharesFromTotals(pautaAcc);
  // Web + IG: por categoría (vw_drean_web_by_category; meta_posts IG) — cacheado 30 min.
  const { web: webCatRows, ig: igCatRows } = await getWebIgCatRows(anio);
  // Tráfico web = SUM → share por usuarios. (Conversión NO se desglosa: la vista
  // vw_drean_web_by_category trae conversiones=0 por categoría — el dato de conversión
  // solo existe a nivel total en vw_drean_web_daily_kpis. → Conversión queda total-only.)
  const webAcc = emptyAcc();
  for (const r of webCatRows) {
    const mi = Number(r.fecha?.slice(5, 7)) - 1; const c = normCat(r.categoria);
    if (mi >= 0 && mi < 12 && c) webAcc[mi]![c] = (webAcc[mi]![c] ?? 0) + (r.usuarios ?? 0);
  }
  const webShare = sharesFromTotals(webAcc);
  // Alcance IG = SUM → share por reach. (Engagement queda total-only: es un KPI "general".)
  const igAcc = emptyAcc();
  for (const r of igCatRows) {
    const mi = Number(r.fecha_post?.slice(5, 7)) - 1; const c = normCat(r.categoria);
    if (mi >= 0 && mi < 12 && c) igAcc[mi]![c] = (igAcc[mi]![c] ?? 0) + (r.reach ?? 0);
  }
  const igShare = sharesFromTotals(igAcc);
  // Floor Share: real POR categoría directo (share Drean por góndola), no vía total.
  const fsCatReal: Record<string, (number | null)[]> = { Brand: Array(12).fill(null), Lavado: Array(12).fill(null), Refrigeración: Array(12).fill(null), Cocción: Array(12).fill(null) };
  MES_SHORT.forEach((short, i) => {
    if (!closed(i)) return;
    const rows = fsRows.filter((r) => isoWeekToMes(r.semana, anio) === short);
    if (!rows.length) return;
    const o = computeOverall(rows);
    fsCatReal.Lavado![i] = o.lavado.share; fsCatReal["Refrigeración"]![i] = o.refri.share; fsCatReal["Cocción"]![i] = o.coccion.share;
  });

  const mk = (
    plan: string, kpi: string, medida: string, unit: KpiUnit, tipo: "sum" | "rate",
    realM: (number | null)[], meta: MetaKpiData,
    realCatM?: Record<string, (number | null)[]>, metaCatM?: Record<string, (number | null)[]>,
  ): KpiSeguimiento => ({
    plan, kpi, medida, unit, tipo, realM, metaM: meta.valores,
    direccion: meta.direccion, umbralVerde: meta.umbralVerde, umbralAmarillo: meta.umbralAmarillo, realCatM, metaCatM,
  });

  // Floor Share tiene meta por categoría propia (Lav/Refri/Cocc), no derivada del mix.
  const fsMetaCat: Record<string, (number | null)[]> = {
    Lavado: mFsLav.valores, Refrigeración: mFsRef.valores, Cocción: mFsCoc.valores,
  };

  const pautaAlcM = serieSum(pm, (m) => m.alc);
  const pautaImprM = serieSum(pm, (m) => m.impr);
  const pautaClicM = serieSum(pm, (m) => m.clic);

  return [
    // Pauta Mkt (share por impresiones). Inversión/Frecuencia/VTR no se desglosan por categoría.
    mk("Pauta Mkt", "Inversión", "Inversión ejecutada (ARS)", "$", "sum", serieSum(pm, (m) => m.inv), mInv),
    mk("Pauta Mkt", "Alcance único", "Personas alcanzadas", "", "sum", pautaAlcM, mAlc, applyShare(pautaAlcM, pautaShare)),
    mk("Pauta Mkt", "Frecuencia", "Impresiones ÷ alcance", "x", "rate", serieRate(pm, (m) => m.impr, (m) => m.alc), mFrec),
    mk("Pauta Mkt", "Impresiones", "Impresiones totales", "", "sum", pautaImprM, mImpr, applyShare(pautaImprM, pautaShare)),
    mk("Pauta Mkt", "VTR (≥50%)", "Vistas 50% ÷ impr. de video", "%", "rate", serieRate(pm, (m) => m.v50, (m) => m.vbase, 100), mVtr),
    mk("Pauta Mkt", "Clicks", "Clicks totales", "", "sum", pautaClicM, mClicks, applyShare(pautaClicM, pautaShare)),
    // Web / Ecommerce (share por usuarios). Avg Sesión = total, mismo valor a las 3 categorías.
    mk("Web / Ecommerce", "Tráfico web (usuarios)", "Usuarios únicos del mes", "", "sum", webUsersM, mWebUsers, applyShare(webUsersM, webShare)),
    mk("Web / Ecommerce", "Avg Sesión (segundos)", "Duración media de sesión", "s", "rate", webAvgM, mWebAvg),
    mk("Web / Ecommerce", "Tasa de conversión", "Conversiones ÷ sesiones", "%", "rate", webConvM, mWebConv),
    // Instagram (el objetivo de Redes se mide solo con IG; share por reach de posts)
    mk("Instagram", "Alcance orgánico", "Alcance IG del mes", "", "sum", igAlcM, mIgAlc, applyShare(igAlcM, igShare)),
    mk("Instagram", "Engagement rate", "Interacciones ÷ alcance", "%", "rate", igEngM, mIgEng),
    // Trade Mkt (Floor Share = real POR categoría directo; CB total-only)
    mk("Cuadros Básicos", "% Cumplimiento CB", "% CB del mes", "%", "rate", cbRealM, mCb),
    mk("Floor Share", "Floor Share (exhibición)", "Share Drean góndola (Σ cat × peso)", "%", "rate", fsRealM, mFs, fsCatReal, fsMetaCat),
  ];
}
