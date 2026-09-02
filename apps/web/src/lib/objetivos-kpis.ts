import "server-only";

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
}

const MES_FULL = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

async function safe<T>(p: Promise<T>, fallback: T): Promise<T> {
  try { return await p; } catch { return fallback; }
}

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

export async function getSeguimientoKpis(anio: number): Promise<KpiSeguimiento[]> {
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
  const MES_FULL = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  const cbRealM = MES_FULL.map((full, i) => {
    if (!closed(i)) return null;
    const rows = cbRows.filter((r) => isoWeekToMes(r.semana, anio) === full);
    return rows.length ? computeTotals(rows).cb_pct : null;
  });
  const fsRealM = MES_FULL.map((full, i) => {
    if (!closed(i)) return null;
    const rows = fsRows.filter((r) => isoWeekToMes(r.semana, anio) === full);
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

  const mk = (
    plan: string, kpi: string, medida: string, unit: KpiUnit, tipo: "sum" | "rate",
    realM: (number | null)[], meta: MetaKpiData,
  ): KpiSeguimiento => ({
    plan, kpi, medida, unit, tipo, realM, metaM: meta.valores,
    direccion: meta.direccion, umbralVerde: meta.umbralVerde, umbralAmarillo: meta.umbralAmarillo,
  });

  return [
    // Pauta Mkt
    mk("Pauta Mkt", "Inversión", "Inversión ejecutada (ARS)", "$", "sum", serieSum(pm, (m) => m.inv), mInv),
    mk("Pauta Mkt", "Alcance único", "Personas alcanzadas", "", "sum", serieSum(pm, (m) => m.alc), mAlc),
    mk("Pauta Mkt", "Frecuencia", "Impresiones ÷ alcance", "x", "rate", serieRate(pm, (m) => m.impr, (m) => m.alc), mFrec),
    mk("Pauta Mkt", "Impresiones", "Impresiones totales", "", "sum", serieSum(pm, (m) => m.impr), mImpr),
    mk("Pauta Mkt", "VTR (≥50%)", "Vistas 50% ÷ impr. de video", "%", "rate", serieRate(pm, (m) => m.v50, (m) => m.vbase, 100), mVtr),
    mk("Pauta Mkt", "Clicks", "Clicks totales", "", "sum", serieSum(pm, (m) => m.clic), mClicks),
    // Web / Ecommerce
    mk("Web / Ecommerce", "Tráfico web (usuarios)", "Usuarios únicos del mes", "", "sum", webUsersM, mWebUsers),
    mk("Web / Ecommerce", "Avg Sesión (segundos)", "Duración media de sesión", "s", "rate", webAvgM, mWebAvg),
    mk("Web / Ecommerce", "Tasa de conversión", "Conversiones ÷ sesiones", "%", "rate", webConvM, mWebConv),
    // Instagram (el objetivo de Redes se mide solo con IG)
    mk("Instagram", "Alcance orgánico", "Alcance IG del mes", "", "sum", igAlcM, mIgAlc),
    mk("Instagram", "Engagement rate", "Interacciones ÷ alcance", "%", "rate", igEngM, mIgEng),
    // Trade Mkt
    mk("Cuadros Básicos", "% Cumplimiento CB", "% CB del mes", "%", "rate", cbRealM, mCb),
    mk("Floor Share", "Floor Share (exhibición)", "Share Drean góndola (Σ cat × peso)", "%", "rate", fsRealM, mFs),
  ];
}
