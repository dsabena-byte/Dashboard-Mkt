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
import { getAllMonthlyUsers } from "./web-queries";
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
// Web sale de web_monthly_by_category (PRECALCULADA por el cron web-cat-agg → rápido);
// si esa tabla está vacía (antes de migrar/correr el cron), cae a la vista lenta
// vw_drean_web_by_category. CACHE 6h: data de fuente (sin metas).
const getWebIgCatRows = unstable_cache(
  async (anio: number): Promise<{ web: WebCatRow[]; ig: IgCatRow[] }> => {
    const [webPre, ig] = await Promise.all([
      safe(fetchRows<WebCatRow>(`web_monthly_by_category?mes=gte.${anio}-01-01&mes=lte.${anio}-12-31&select=fecha:mes,categoria,usuarios`), []),
      safe(fetchRows<IgCatRow>(`meta_posts?platform=eq.instagram&fecha_post=gte.${anio}-01-01&fecha_post=lt.${anio + 1}-01-01&select=fecha_post,categoria,reach`), []),
    ]);
    const web = webPre.length > 0
      ? webPre
      : await safe(fetchRows<WebCatRow>(`vw_drean_web_by_category?fecha=gte.${anio}-01-01&fecha=lte.${anio}-12-31&select=fecha,categoria,usuarios`), []);
    return { web, ig };
  },
  ["objetivos-webig-cat-rows-v2"],
  { revalidate: 21600 }, // 6 h
);

// Web mensual para el Seguimiento — sesiones + avg (vw_drean_web_monthly) y conversiones
// (vw_drean_web_monthly_by_channel). Reemplaza a vw_drean_web_daily_kpis (~6.7s, agrega
// una tabla enorme): las vistas mensuales son ~10x más rápidas y dan los mismos valores.
// CACHE 30 min: data de fuente, sin metas.
type WebMonthAgg = { ses: number[]; avg: number[]; conv: number[]; has: boolean[] };
const getWebMonthlySeguimiento = unstable_cache(
  async (anio: number): Promise<WebMonthAgg> => {
    const [mon, chan] = await Promise.all([
      safe(fetchRows<{ mes: string; sesiones: number | null; avg_session_duration: number | null }>(`vw_drean_web_monthly?mes=gte.${anio}-01-01&mes=lte.${anio}-12-31&select=mes,sesiones,avg_session_duration`), []),
      safe(fetchRows<{ mes: string; conversiones: number | null }>(`vw_drean_web_monthly_by_channel?mes=gte.${anio}-01-01&mes=lte.${anio}-12-31&select=mes,conversiones`), []),
    ]);
    const ses = Array<number>(12).fill(0), avg = Array<number>(12).fill(0), conv = Array<number>(12).fill(0), has = Array<boolean>(12).fill(false);
    for (const r of mon) { const i = Number(r.mes?.slice(5, 7)) - 1; if (i >= 0 && i < 12) { ses[i] = r.sesiones ?? 0; avg[i] = r.avg_session_duration ?? 0; has[i] = true; } }
    for (const r of chan) { const i = Number(r.mes?.slice(5, 7)) - 1; if (i >= 0 && i < 12) conv[i] = (conv[i] ?? 0) + (r.conversiones ?? 0); }
    return { ses, avg, conv, has };
  },
  ["objetivos-web-monthly-seg-v1"],
  { revalidate: 1800 },
);

// ===== Trade (CB / Floor Share): agregado MENSUAL cacheado =====
// getCbRows({}) y getFloorShareRows({}) paginan la tabla CB ENTERA (decenas de
// miles de filas, N round-trips seriales contra el proyecto CB, que responde
// lento) → hacían el Seguimiento tardar ~25s EN CADA render. Acá se pagina una
// sola vez por hora (unstable_cache; getCbSupabase es service-key SIN cookies →
// seguro para cachear) y se devuelve solo lo que el Seguimiento necesita: el %
// mensual y el share por categoría. El filtro "mes cerrado" se aplica AFUERA
// (depende de hoy) para no envenenar la cache.
const MES_SHORT_TRADE = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

const getCbMonthlyPct = unstable_cache(
  async (anio: number): Promise<(number | null)[]> => {
    const rows = await safe(getCbRows({}), [] as Awaited<ReturnType<typeof getCbRows>>);
    return MES_SHORT_TRADE.map((short) => {
      const rs = rows.filter((r) => isoWeekToMes(r.semana, anio) === short);
      return rs.length ? computeTotals(rs).cb_pct : null;
    });
  },
  ["objetivos-cb-monthly-v1"],
  { revalidate: 3600 }, // 1 h
);

interface FloorMonthly { general: (number | null)[]; cat: Record<string, (number | null)[]> }
const getFloorMonthly = unstable_cache(
  async (anio: number): Promise<FloorMonthly> => {
    const rows = await safe(getFloorShareRows({}), [] as Awaited<ReturnType<typeof getFloorShareRows>>);
    const general: (number | null)[] = Array(12).fill(null);
    const cat: Record<string, (number | null)[]> = {
      Brand: Array(12).fill(null), Lavado: Array(12).fill(null), Refrigeración: Array(12).fill(null), Cocción: Array(12).fill(null),
    };
    MES_SHORT_TRADE.forEach((short, i) => {
      const rs = rows.filter((r) => isoWeekToMes(r.semana, anio) === short);
      if (!rs.length) return;
      const o = computeOverall(rs);
      general[i] = generalPonderado({ Lavado: o.lavado.share, Refrigeración: o.refri.share, Cocción: o.coccion.share });
      cat.Lavado![i] = o.lavado.share; cat["Refrigeración"]![i] = o.refri.share; cat["Cocción"]![i] = o.coccion.share;
    });
    return { general, cat };
  },
  ["objetivos-floor-monthly-v1"],
  { revalidate: 3600 }, // 1 h
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
// skipTrade=true: NO trae CB/Floor Share (paginan la tabla CB entera, ~26s contra
// el proyecto CB lento). Se usa para el PRIMER paint rápido; el trade llega después
// por fetch cliente (/api/seguimiento) sin bloquear la vista.
export const getSeguimientoKpis = cache(
  async (anio: number, skipTrade = false): Promise<KpiSeguimiento[]> => computeSeguimientoKpis(anio, skipTrade),
);

// Breakdown de tiempos por grupo de queries (DIAGNÓSTICO temporal). Se llena en
// computeSeguimientoKpis y lo lee getSeguimientoCompleto para mostrarlo en el header.
export let kpiTimings: Record<string, number> = {};

// Inversión TOTAL de medios de Pauta Mkt por mes (gap-fill, todos los objetivos).
// Es la MISMA inversión que muestra el dashboard de Pauta Mkt (Impacto Campaña).
// NO incluye ecommerce (rol Conversión) — se suma aparte donde haga falta.
// Se llama desde server components en scope de request (usa getServerSupabase → cookies).
export async function getPautaInversionTotalMensual(anio: number): Promise<(number | null)[]> {
  const now = new Date();
  const currentMonth = now.getUTCFullYear() > anio ? 13 : now.getUTCFullYear() < anio ? 1 : now.getUTCMonth() + 1;
  const [pauta, metaPaid, dv360, dv360Reach, gads, fx] = await Promise.all([
    safe(getPautaPerformance(true), [] as Awaited<ReturnType<typeof getPautaPerformance>>),
    safe(getMetaPaidCreatives(true), [] as Awaited<ReturnType<typeof getMetaPaidCreatives>>),
    safe(getDv360Creatives(), [] as Awaited<ReturnType<typeof getDv360Creatives>>),
    safe(getDv360Reach(), [] as Awaited<ReturnType<typeof getDv360Reach>>),
    safe(getGoogleAdsOmd(), [] as Awaited<ReturnType<typeof getGoogleAdsOmd>>),
    safe(getFxRates(), {} as Record<string, number>),
  ]);
  const pm = computePautaImpacto(pauta, metaPaid, dv360, dv360Reach, gads, fx, anio, currentMonth);
  return pm.map((m) => (m ? m.inv : null));
}

async function computeSeguimientoKpis(anio: number, skipTrade = false): Promise<KpiSeguimiento[]> {
  const now = new Date();
  const currentMonth = now.getUTCFullYear() > anio ? 13 : now.getUTCFullYear() < anio ? 1 : now.getUTCMonth() + 1;
  const closed = (i: number) => i + 1 < currentMonth;

  const yearRange = { from: `${anio}-01-01`, to: `${anio}-12-31` };

  // --- Instrumentación temporal: mide cuánto tarda cada grupo (todas arrancan a la
  // vez, así que el total ≈ la más lenta). Guarda el máx por etiqueta. ---
  const timings: Record<string, number> = {};
  const t0 = Date.now();
  const T = <R,>(label: string, p: Promise<R>): Promise<R> => {
    const done = () => { timings[label] = Math.max(timings[label] ?? 0, Date.now() - t0); };
    return p.then((r) => { done(); return r; }, (e) => { done(); throw e; });
  };

  // Distribución web/IG por categoría: se ARRANCA acá (no se espera) para que corra
  // EN PARALELO con el resto, no serializada después. Se cachea 6h (vista lenta ~8.8s).
  const webIgCatP = T("webIgCat", getWebIgCatRows(anio));

  // Trade (CB/Floor Share): en skipTrade se resuelve al instante con nulls (el dato
  // real llega después por /api/seguimiento). Si no, paga el agregado mensual.
  const emptyFloor: FloorMonthly = {
    general: Array(12).fill(null),
    cat: { Brand: Array(12).fill(null), Lavado: Array(12).fill(null), Refrigeración: Array(12).fill(null), Cocción: Array(12).fill(null) },
  };
  const cbP = skipTrade ? Promise.resolve<(number | null)[]>(Array(12).fill(null)) : getCbMonthlyPct(anio);
  const fsP = skipTrade ? Promise.resolve<FloorMonthly>(emptyFloor) : getFloorMonthly(anio);

  const [
    pauta, metaPaid, dv360, dv360Reach, gads, fx,
    webMonthly, monthlyUsers, ig,
    mInv, mAlc, mFrec, mImpr, mVtr, mClicks,
    mWebUsers, mWebAvg, mWebConv,
    mIgAlc, mIgEng,
    cbMonthly, fsMonthly, mCb, mFsLav, mFsRef, mFsCoc,
  ] = await Promise.all([
    safe(T("pauta", getPautaPerformance(true)), [] as Awaited<ReturnType<typeof getPautaPerformance>>),
    safe(T("metaPaid", getMetaPaidCreatives(true)), [] as Awaited<ReturnType<typeof getMetaPaidCreatives>>),
    safe(T("dv360", getDv360Creatives()), [] as Awaited<ReturnType<typeof getDv360Creatives>>),
    safe(T("dv360Reach", getDv360Reach()), [] as Awaited<ReturnType<typeof getDv360Reach>>),
    safe(T("gads", getGoogleAdsOmd()), [] as Awaited<ReturnType<typeof getGoogleAdsOmd>>),
    safe(T("fx", getFxRates()), {} as Record<string, number>),
    T("webMonthly", getWebMonthlySeguimiento(anio)),
    safe(T("monthlyUsers", getAllMonthlyUsers()), [] as Awaited<ReturnType<typeof getAllMonthlyUsers>>),
    safe(T("ig", getIgOrganicSummary(yearRange)), null as Awaited<ReturnType<typeof getIgOrganicSummary>> | null),
    T("metas", getMetaKpi("Pauta Mkt", "Inversión", anio)),
    T("metas", getMetaKpi("Pauta Mkt", "Alcance único", anio)),
    T("metas", getMetaKpi("Pauta Mkt", "Frecuencia", anio)),
    T("metas", getMetaKpi("Pauta Mkt", "Impresiones", anio)),
    T("metas", getMetaKpi("Pauta Mkt", "VTR (≥50%)", anio)),
    T("metas", getMetaKpi("Pauta Mkt", "Clicks", anio)),
    T("metas", getMetaKpi("Web / Ecommerce", "Tráfico web (usuarios)", anio)),
    T("metas", getMetaKpi("Web / Ecommerce", "Avg Sesión (segundos)", anio)),
    T("metas", getMetaKpi("Web / Ecommerce", "Tasa de conversión", anio)),
    T("metas", getMetaKpi("Redes Sociales", "Alcance orgánico", anio)),
    T("metas", getMetaKpi("Redes Sociales", "Engagement rate", anio)),
    // Trade (proyecto CB): agregado mensual (o nulls si skipTrade). El filtro "mes
    // cerrado" se aplica afuera.
    T("cb", cbP),
    T("floorShare", fsP),
    T("metas", getMetaKpi("Cuadros Básicos", "% Cumplimiento CB", anio)),
    T("metas", getMetaKpi("Floor Share", "Floor Share (exhibición)", anio, "Lavado")),
    T("metas", getMetaKpi("Floor Share", "Floor Share (exhibición)", anio, "Refrigeración")),
    T("metas", getMetaKpi("Floor Share", "Floor Share (exhibición)", anio, "Cocción")),
  ]);
  kpiTimings = timings;

  // ---- Pauta (6) ----
  const pm = computePautaImpacto(pauta, metaPaid, dv360, dv360Reach, gads, fx, anio, currentMonth);

  // ---- Web (3): desde las vistas MENSUALES (rápidas), solo meses cerrados ----
  // Usuarios únicos por mes desde ga4_monthly_users.
  const usersByMonth = new Map<number, number>();
  for (const u of monthlyUsers) {
    if (!u.mes?.startsWith(String(anio))) continue;
    usersByMonth.set(Number(u.mes.slice(5, 7)) - 1, u.total_users ?? 0);
  }
  const webUsersM = Array.from({ length: 12 }, (_, i) => (closed(i) && (webMonthly.has[i] || usersByMonth.has(i)) ? (usersByMonth.get(i) ?? 0) : null));
  const webAvgM = Array.from({ length: 12 }, (_, i) => (closed(i) && webMonthly.has[i] ? (webMonthly.avg[i] ?? null) : null));
  const webConvM = Array.from({ length: 12 }, (_, i) => (closed(i) && (webMonthly.ses[i] ?? 0) > 0 ? ((webMonthly.conv[i] ?? 0) / webMonthly.ses[i]!) * 100 : null));

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
  // Agregados mensuales cacheados (getCbMonthlyPct / getFloorMonthly); acá solo se
  // aplica el filtro de mes cerrado (depende de hoy, por eso queda fuera de la cache).
  const cbRealM = cbMonthly.map((v, i) => (closed(i) ? v : null));
  const fsRealM = fsMonthly.general.map((v, i) => (closed(i) ? v : null));
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
  // Web + IG: por categoría (ya se arrancó arriba, corre en paralelo). Cacheado 6h.
  const { web: webCatRows, ig: igCatRows } = await webIgCatP;
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
  // Floor Share: real POR categoría directo (del agregado mensual cacheado), solo meses cerrados.
  const fsCatReal: Record<string, (number | null)[]> = { Brand: Array(12).fill(null), Lavado: Array(12).fill(null), Refrigeración: Array(12).fill(null), Cocción: Array(12).fill(null) };
  for (const c of ["Lavado", "Refrigeración", "Cocción"]) {
    fsCatReal[c] = (fsMonthly.cat[c] ?? Array(12).fill(null)).map((v, i) => (closed(i) ? v : null));
  }

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
