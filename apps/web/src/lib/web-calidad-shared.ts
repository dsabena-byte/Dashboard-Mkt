// ============================================================================
// Calidad del dato WEB — tipos + armado PURO (client-safe) del snapshot que llena el cron
// /api/cron/web-calidad (tabla web_calidad_snapshot, migración 0117). Portado de BIP (sep-2026).
//   · ga4: reportes GA4 de los últimos 28 días vs los 28 previos (embudo, tráfico desde IA,
//     landings, canales) → lib/web-calidad.ts (ecomFunnel / aiTraffic / landingDrops / trackingQuality).
//   · iaMensual: sesiones por asistente de IA por mes desde web_traffic (utm_source) + compras
//     de esas sesiones (ga4_purchases_daily) → serie y share sobre el sitio.
//   · consent: chequeo INDIRECTO de pérdida de medición (lib/web-consent.ts) con Search + PMax.
// El render de /web lee UNA fila (nunca pagina web_traffic en el render).
// ============================================================================
import type { Ga4Report } from "./web-calidad";
import { asistenteDe } from "./web-calidad";

export interface WebCalidadGa4 {
  ok: boolean;
  error?: string;
  periodo: { start: string; end: string; prevStart: string; prevEnd: string };
  reports: { landing: Ga4Report; chan: Ga4Report; events?: Ga4Report; aiRef?: Ga4Report; landingPrev?: Ga4Report };
  totals: { sessions: number; tx: number; revenue: number; ke: number; currency: string | null };
  failed: string[];
}

export interface IaMes { mes: string; sesiones: number; porAsistente: Record<string, number>; transacciones: number; ingresos: number; sesionesSitio: number | null }

export interface ConsentInput {
  /** Clicks de Google Ads (Search + Performance Max) por mes YYYY-MM. */
  clicks: Record<string, number>;
  /** Sesiones GA4 google / cpc de esas mismas campañas por mes. */
  sesiones: Record<string, number>;
  /** Sesiones google / cpc totales (todas las campañas) por mes — contexto. */
  sesionesTodas: Record<string, number>;
  criterio: string;
}

export interface WebCalidadSnapshot {
  v: 1;
  updatedAt: string;
  ga4: WebCalidadGa4 | null;
  iaMensual: IaMes[];
  consent: ConsentInput | null;
  errores: string[];
}

/** Filas diarias de web_traffic (utm_source ya filtrado a asistentes) → por mes y asistente. */
export function iaMensualDesdeFilas(
  trafico: { fecha: string; utm_source: string | null; sesiones: number | null }[],
  compras: { fecha: string; utm_source: string | null; purchases: number | null; revenue: number | null }[],
  sesionesSitio: Record<string, number>,
): IaMes[] {
  const by = new Map<string, IaMes>();
  const get = (mes: string) => {
    let e = by.get(mes);
    if (!e) { e = { mes, sesiones: 0, porAsistente: {}, transacciones: 0, ingresos: 0, sesionesSitio: sesionesSitio[mes] ?? null }; by.set(mes, e); }
    return e;
  };
  for (const r of trafico) {
    const a = asistenteDe(r.utm_source ?? "");
    if (!a || !r.fecha) continue;
    const e = get(r.fecha.slice(0, 7));
    const s = Number(r.sesiones) || 0;
    e.sesiones += s;
    e.porAsistente[a] = (e.porAsistente[a] ?? 0) + s;
  }
  for (const r of compras) {
    if (!asistenteDe(r.utm_source ?? "") || !r.fecha) continue;
    const e = get(r.fecha.slice(0, 7));
    e.transacciones += Number(r.purchases) || 0;
    e.ingresos += Number(r.revenue) || 0;
  }
  return [...by.values()].sort((a, b) => a.mes.localeCompare(b.mes));
}

/** Tipo de campaña de Google Ads por nombre (minúsculas). Demand Gen queda FUERA del chequeo: sus
 *  clicks (Discover/YouTube/Gmail) tienen una relación click→sesión estructuralmente baja. */
export function tipoCampania(nombre: string, porNombre: Map<string, string>): "search" | "pmax" | "demandgen" | "otra" {
  const n = (nombre || "").toLowerCase().trim();
  const t = (porNombre.get(n) ?? "").toLowerCase();
  if (/demand/.test(t) || /demand ?gen|demangen/.test(n)) return "demandgen";
  if (/performance max|pmax/.test(t) || (!t && /pmax/.test(n))) return "pmax";
  if (/search/.test(t)) return "search";
  return "otra";
}

/** Arma la entrada del chequeo de consent (Search + PMax). */
export function consentDesdeFilas(
  ads: { fecha: string; campaign_name: string | null; campaign_type: string | null; clicks: number | null }[],
  sesiones: { fecha: string; utm_campaign: string | null; sesiones: number | null }[],
): ConsentInput {
  const porNombre = new Map<string, string>();
  for (const a of ads) if (a.campaign_name) porNombre.set(a.campaign_name.toLowerCase().trim(), a.campaign_type ?? "");
  const clicks: Record<string, number> = {}, ses: Record<string, number> = {}, todas: Record<string, number> = {};
  for (const a of ads) {
    const t = tipoCampania(a.campaign_name ?? "", porNombre);
    if (t !== "search" && t !== "pmax") continue;
    const m = a.fecha.slice(0, 7);
    clicks[m] = (clicks[m] ?? 0) + (Number(a.clicks) || 0);
  }
  for (const s of sesiones) {
    const m = s.fecha.slice(0, 7);
    const v = Number(s.sesiones) || 0;
    todas[m] = (todas[m] ?? 0) + v;
    const t = tipoCampania(s.utm_campaign ?? "", porNombre);
    if (t === "search" || t === "pmax") ses[m] = (ses[m] ?? 0) + v;
  }
  return { clicks, sesiones: ses, sesionesTodas: todas, criterio: "Campañas de Search y Performance Max (Demand Gen fuera: su relación click→sesión es baja por diseño)" };
}
