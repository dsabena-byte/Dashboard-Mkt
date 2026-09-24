// ============================================================================
// Modelo mensual POR MEDIO de Pauta Mkt (puro, sin server-only).
// Es el MISMO gap-fill que `impactoMensual` de /performance y que el Seguimiento
// (objetivos-kpis → computePautaImpacto), extraído acá para que lo compartan el
// Seguimiento y el motor de señales (lib/signals) sin duplicar la regla:
//  · OMD (`pauta_performance`) SOLO para medios SIN API (esMedioApi → Meta va por la API).
//  · Ejecución real de APIs (Meta/TikTok de meta_paid_creatives, DV360 YouTube/Programmatic/
//    Marketplace, Google Search/Demand Gen) SOLO para medios sin fila OMD con impresiones ese mes.
//  · DV360 USD→ARS con el fx del mes. Solo meses CERRADOS (i+1 < currentMonth).
//  · v50/vbase (VTR≥50%) de Meta + DV360 siempre (tasa de calidad, no se gap-fillea).
// `tot` replica EXACTAMENTE la acumulación original (mismo orden de sumas → mismos números);
// `medios` agrega el desglose por medio para las señales.
// ============================================================================
import { esMedioApi } from "./pauta-medios";

export const PAUTA_MES_FULL = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
// Canal DV360 → medio del dash.
export const DV360_MEDIO: Record<string, string> = { YouTube: "YouTube", Programmatic: "Programmatic", "Demand Gen": "Google Demand Gen", Marketplace: "Mercado Ads" };

// Filas mínimas (estructurales) de cada fuente — compatibles con los tipos de las queries.
export interface PautaOmdLite { mes: string; medio: string; categoria?: string | null; objetivo?: string | null; impresiones: number | null; alcance: number | null; clics: number | null; inversion: number | null }
export interface MetaPaidLite { mes: string; plataforma: string; impresiones: number | null; alcance: number | null; clicks: number | null; spend: number | null; video_p25: number | null; video_p50: number | null; video_p75: number | null }
export interface Dv360Lite { mes: string; canal: string; impresiones: number | null; clicks: number | null; revenue_usd: number | null; starts: number | null; q50: number | null }
export interface Dv360ReachLite { mes: string; canal: string; reach: number | null }
export interface GoogleAdsLite { mes: string; canal: string; impresiones: number; clicks: number; costo: number }

export interface PautaMes { inv: number; alc: number; impr: number; clic: number; v50: number; vbase: number }
export interface PautaMedioMes { inv: number; alc: number; impr: number; clic: number; v50: number; vbase: number; fuente: "omd" | "api" | "omd+api" }
export interface PautaMesMedios { mesIdx: number; mesLabel: string; iso: string; tot: PautaMes; medios: Record<string, PautaMedioMes> }

export interface PautaMediosInput {
  pauta: PautaOmdLite[];
  metaPaid: MetaPaidLite[];
  dv360: Dv360Lite[];
  dv360Reach: Dv360ReachLite[];
  googleAdsOmd: GoogleAdsLite[];
  fxRates: Record<string, number>;
  anio: number;
  currentMonth: number; // 1-12 (13 = año cerrado completo)
}

const metaMedio = (plataforma: string) => (plataforma === "meta" ? "Meta" : plataforma === "tiktok" ? "TikTok" : null);

/** 12 meses (null = mes no cerrado o sin ejecución). */
export function buildPautaMediosMensual(inp: PautaMediosInput): (PautaMesMedios | null)[] {
  const { pauta: data, metaPaid, dv360, dv360Reach, googleAdsOmd, fxRates, anio, currentMonth } = inp;
  const fxVals = Object.values(fxRates);
  const fxFallback = fxVals.length ? fxVals[fxVals.length - 1]! : 1;

  return PAUTA_MES_FULL.map((full, i) => {
    if (i + 1 >= currentMonth) return null; // solo meses cerrados
    const mesLabel = `${full} ${anio}`;
    const iso = `${anio}-${String(i + 1).padStart(2, "0")}-01`;
    const fx = fxRates[iso] ?? fxFallback;
    const medios: Record<string, PautaMedioMes> = {};
    const addMedio = (medio: string, im: number, al: number, cl: number, iv: number, fuente: "omd" | "api") => {
      const e = medios[medio] ?? { inv: 0, alc: 0, impr: 0, clic: 0, v50: 0, vbase: 0, fuente };
      e.impr += im; e.alc += al; e.clic += cl; e.inv += iv;
      if (e.fuente !== fuente) e.fuente = "omd+api";
      medios[medio] = e;
    };

    const omd = new Map<string, { impr: number; alc: number; clic: number; inv: number }>();
    for (const r of data) {
      // Meta (medio con API) NO se toma de OMD: entra por la API (regla API_MEDIOS).
      if (r.mes !== mesLabel || esMedioApi(r.medio)) continue;
      const e = omd.get(r.medio) ?? { impr: 0, alc: 0, clic: 0, inv: 0 };
      e.impr += r.impresiones ?? 0; e.alc += r.alcance ?? 0; e.clic += r.clics ?? 0; e.inv += r.inversion ?? 0;
      omd.set(r.medio, e);
    }
    let inv = 0, impr = 0, alc = 0, clic = 0;
    for (const e of omd.values()) { inv += e.inv; impr += e.impr; alc += e.alc; clic += e.clic; }
    for (const [m, e] of omd) addMedio(m, e.impr, e.alc, e.clic, e.inv, "omd");
    const present = new Set([...omd].filter(([, e]) => e.impr > 0).map(([m]) => m));

    const auto = new Map<string, { impr: number; alc: number; clic: number; inv: number }>();
    const addAuto = (medio: string, im: number, al: number, cl: number, iv: number) => {
      const e = auto.get(medio) ?? { impr: 0, alc: 0, clic: 0, inv: 0 };
      e.impr += im; e.alc += al; e.clic += cl; e.inv += iv; auto.set(medio, e);
    };
    for (const r of dv360) { if (r.mes === iso) addAuto(DV360_MEDIO[r.canal] ?? r.canal, r.impresiones ?? 0, 0, r.clicks ?? 0, (r.revenue_usd ?? 0) * fx); }
    for (const r of dv360Reach) { if (r.mes === iso) { const e = auto.get(DV360_MEDIO[r.canal] ?? r.canal); if (e) e.alc += r.reach ?? 0; } }
    for (const r of metaPaid) {
      if (r.mes !== mesLabel) continue;
      const medio = metaMedio(r.plataforma);
      if (!medio) continue;
      addAuto(medio, r.impresiones ?? 0, r.alcance ?? 0, r.clicks ?? 0, r.spend ?? 0);
    }
    for (const r of googleAdsOmd) { if (r.mes === mesLabel) addAuto(r.canal, r.impresiones, 0, r.clicks, r.costo); }
    for (const [medio, e] of auto) {
      if (!present.has(medio) && e.impr > 0) {
        impr += e.impr; alc += e.alc; clic += e.clic; inv += e.inv;
        addMedio(medio, e.impr, e.alc, e.clic, e.inv, "api");
      }
    }

    let v50 = 0, vbase = 0;
    const addVid = (medio: string, b: number, v: number) => { const e = medios[medio]; if (e) { e.vbase += b; e.v50 += v; } };
    for (const r of metaPaid) {
      if (r.mes !== mesLabel) continue;
      if ((r.video_p25 ?? 0) + (r.video_p50 ?? 0) + (r.video_p75 ?? 0) > 0) {
        vbase += r.impresiones ?? 0; v50 += r.video_p50 ?? 0;
        addVid(metaMedio(r.plataforma) ?? r.plataforma, r.impresiones ?? 0, r.video_p50 ?? 0);
      }
    }
    for (const r of dv360) {
      if (r.mes === iso && (r.starts ?? 0) > 0) {
        vbase += r.impresiones ?? 0; v50 += r.q50 ?? 0;
        addVid(DV360_MEDIO[r.canal] ?? r.canal, r.impresiones ?? 0, r.q50 ?? 0);
      }
    }

    if (impr === 0 && inv === 0) return null;
    return { mesIdx: i, mesLabel, iso, tot: { inv, alc, impr, clic, v50, vbase }, medios };
  });
}
