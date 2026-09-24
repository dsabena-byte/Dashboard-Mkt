import "server-only";
import { getPautaPerformance } from "@/lib/pauta-queries";
import { getMetaPaidCreatives } from "@/lib/meta-paid-queries";
import { getDv360Creatives } from "@/lib/dv360-queries";
import { getGoogleAdsOmd } from "@/lib/google-ads-omd-queries";
import { getFxRates } from "@/lib/fx-queries";
import { esMedioApi } from "@/lib/pauta-medios";
import { labelKey, ymKey, hoyAR, keyIso } from "./util";

// ============================================================================
// Modelo de pauta para el copiloto = MISMO criterio que el dash /performance:
//  - OMD (pauta_performance, carga manual) es la fuente oficial SOLO de medios sin API.
//  - Meta = API siempre (esMedioApi): se excluye de OMD y entra por meta_paid_creatives.
//  - Gap-fill: YouTube/Programmatic (DV360, USD→ARS con fx del mes), Google Search/Demand
//    Gen (GA4) y TikTok (API) entran SOLO si ese medio no tiene fila OMD ese mes.
//  - Performance Max se EXCLUYE (es ecommerce, vive en /performance-conversion).
//  - Real de OMD solo para meses CERRADOS (las filas de meses en curso/futuros son plan).
// Filas planas mes × medio × categoría × rol → las tools agregan a demanda.
// ============================================================================

export interface PautaFila {
  k: number; // clave de mes (anio*12+mes)
  medio: string;
  categoria: string;
  rol: string;
  fuente: "OMD" | "API";
  inversion: number; // ARS
  impresiones: number;
  alcance: number;
  clics: number;
  vimpr: number; // impresiones de video (base VTR)
  v50: number; // vistas ≥50%
}
export interface PautaPlanFila {
  k: number;
  medio: string;
  categoria: string;
  rol: string;
  inversion_plan: number;
  impresiones_plan: number;
  alcance_plan: number;
  clics_plan: number;
}
export interface PautaModelo {
  filas: PautaFila[];
  plan: PautaPlanFila[];
  mesEnCurso: number;
}

const DVMED: Record<string, string> = { YouTube: "YouTube", Programmatic: "Programmatic", "Demand Gen": "Google Demand Gen", Marketplace: "Mercado Ads" };
function rolDeCompra(tc: string | null): string {
  if (tc === "CPC") return "Consideración";
  if (tc === "CPA") return "Conversión";
  return "Awareness";
}

export async function getPautaModelo(): Promise<PautaModelo> {
  // OMD es la base: si falla, que falle la tool (robusta lo reporta). Las fuentes API
  // degradan a vacío para no tirar toda la respuesta por un medio.
  const [omd, meta, dv, gads, fx] = await Promise.all([
    getPautaPerformance(true),
    getMetaPaidCreatives(true).catch(() => []),
    getDv360Creatives().catch(() => []),
    getGoogleAdsOmd().catch(() => []),
    getFxRates().catch(() => ({}) as Record<string, number>),
  ]);
  const mesEnCurso = ymKey(hoyAR())!;
  const fxVals = Object.entries(fx).sort(([a], [b]) => a.localeCompare(b));
  const fxFallback = fxVals.length ? fxVals[fxVals.length - 1]![1] : 0;

  const filas: PautaFila[] = [];
  const plan: PautaPlanFila[] = [];
  const presentes = new Map<number, Set<string>>(); // medios con OMD real por mes

  for (const r of omd) {
    const k = labelKey(r.mes);
    if (k == null) continue;
    const pInv = r.inversion_plan ?? 0;
    if (pInv || r.impresiones_plan || r.alcance_plan || r.clics_plan) {
      plan.push({ k, medio: r.medio, categoria: r.categoria, rol: r.objetivo, inversion_plan: pInv, impresiones_plan: r.impresiones_plan ?? 0, alcance_plan: r.alcance_plan ?? 0, clics_plan: r.clics_plan ?? 0 });
    }
    if (esMedioApi(r.medio) || k >= mesEnCurso) continue; // Meta = API; mes en curso/futuro = plan
    const inv = r.inversion ?? 0, impr = r.impresiones ?? 0;
    if (!inv && !impr) continue;
    let s = presentes.get(k);
    if (!s) presentes.set(k, (s = new Set()));
    s.add(r.medio);
    filas.push({ k, medio: r.medio, categoria: r.categoria, rol: r.objetivo, fuente: "OMD", inversion: inv, impresiones: impr, alcance: r.alcance ?? 0, clics: r.clics ?? 0, vimpr: 0, v50: 0 });
  }
  const gap = (k: number, medio: string) => !presentes.get(k)?.has(medio);

  for (const r of meta) {
    const medio = r.plataforma === "meta" ? "Meta" : r.plataforma === "tiktok" ? "TikTok" : null;
    const k = labelKey(r.mes);
    if (!medio || k == null || !gap(k, medio)) continue;
    const quart = (r.video_p25 ?? 0) + (r.video_p50 ?? 0) + (r.video_p75 ?? 0) > 0;
    filas.push({
      k, medio, categoria: r.categoria ?? "Otros", rol: rolDeCompra(r.tipo_compra), fuente: "API",
      inversion: r.spend ?? 0, impresiones: r.impresiones ?? 0, alcance: r.alcance ?? 0, clics: r.clicks ?? 0,
      vimpr: quart ? r.impresiones ?? 0 : 0, v50: quart ? r.video_p50 ?? 0 : 0,
    });
  }
  for (const r of dv) {
    const k = ymKey(r.mes);
    const medio = DVMED[r.canal] ?? r.canal;
    if (k == null || !gap(k, medio)) continue;
    const rate = fx[keyIso(k)] ?? fxFallback;
    filas.push({
      k, medio, categoria: r.categoria || "Otros", rol: r.rol || "Awareness", fuente: "API",
      inversion: r.revenue_usd * rate, impresiones: r.impresiones, alcance: 0, clics: r.clicks,
      // Guard del dash (videoMetrics): solo video real (q50 ≤ impresiones); si no, la VTR daría >100%.
      vimpr: r.starts > 0 && r.q50 <= r.impresiones ? r.impresiones : 0, v50: r.starts > 0 && r.q50 <= r.impresiones ? r.q50 : 0,
    });
  }
  for (const r of gads) {
    const k = labelKey(r.mes);
    if (k == null || r.canal === "Google PMax" || !gap(k, r.canal)) continue;
    filas.push({ k, medio: r.canal, categoria: r.categoria, rol: "Consideración", fuente: "API", inversion: r.costo, impresiones: r.impresiones, alcance: 0, clics: r.clicks, vimpr: 0, v50: 0 });
  }
  return { filas, plan, mesEnCurso };
}
