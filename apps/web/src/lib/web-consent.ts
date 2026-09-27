// ============================================================================
// Chequeo INDIRECTO de Consent Mode / pérdida de medición (puro, client-safe).
//
// GA4 no informa por la Data API si el sitio usa Consent Mode (básico/avanzado) ni cuántos usuarios
// rechazaron cookies. Lo que sí se puede medir con lo que BIP ya trae: cuántas SESIONES registra GA4
// desde Google Ads (sessionSourceMedium = "google / cpc") contra los CLICKS que informa Google Ads el
// mismo mes. Con medición sana GA4 ve ~75-100% de los clicks (las diferencias normales: rebotes antes
// de que cargue el tag, clicks inválidos, varias sesiones por click). Muy por debajo → parte del
// tráfico no se mide: Consent Mode BÁSICO (si rechazan, no se envía nada), un banner que bloquea GA4,
// el etiquetado automático (gclid) apagado o landings sin el tag. Una CAÍDA brusca de la relación
// con Ads estable = cambio en el sitio (banner nuevo, tag roto).
// Referencias: support.google.com/analytics/answer/9976101 (consent) y 11161109 (modelado).
// ============================================================================

export interface MesConsent { mes: string; clicks: number; sesiones: number; ratio: number | null }
export type EstadoConsent = "ok" | "perdida_media" | "perdida_alta" | "caida" | "sin_datos";

export interface ChequeoConsent {
  estado: EstadoConsent;
  meses: MesConsent[];
  ultimo: MesConsent | null;
  /** Relación típica de los meses previos (mediana), para la lectura de "caída". */
  ratioPrevio: number | null;
  titulo: string;
  detalle: string;
  acciones: string[];
}

export const MIN_CLICKS = 300;
const mediana = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); if (!s.length) return null; const m = Math.floor(s.length / 2); return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2; };
const pct = (x: number) => `${Math.round(x * 100)}%`;

const ACCIONES_BASE = [
  "Pedile a la agencia que confirme en Google Ads que cada clic lleva su \"marca\" de seguimiento (etiquetado automático o gclid) y que Google Ads está conectado con Analytics (GA4).",
  "Si el sitio tiene el cartel de cookies, pedile al desarrollador que lo configure para que Analytics igual pueda estimar las visitas de quien no acepta (Consent Mode \"avanzado\").",
  "Pedile al desarrollador que pruebe las páginas a las que llegan los anuncios con la herramienta gratuita de Google (Tag Assistant): el código de Analytics tiene que cargar aunque la persona todavía no haya respondido el cartel de cookies.",
];

/**
 * `clicksPorMes` = clicks de Google Ads por mes (YYYY-MM); `sesionesPorMes` = sesiones GA4 con
 * source/medium google / cpc. Solo cuenta meses CERRADOS (el que llama filtra el mes en curso).
 */
export function chequeoConsent(clicksPorMes: Record<string, number>, sesionesPorMes: Record<string, number>): ChequeoConsent {
  const meses: MesConsent[] = Object.keys(clicksPorMes).sort().map((mes) => {
    const clicks = clicksPorMes[mes] ?? 0, sesiones = sesionesPorMes[mes] ?? 0;
    return { mes, clicks, sesiones, ratio: clicks >= MIN_CLICKS ? sesiones / clicks : null };
  });
  const validos = meses.filter((m) => m.ratio != null);
  const ultimo = validos[validos.length - 1] ?? null;
  const previos = validos.slice(-4, -1).map((m) => m.ratio!);
  const ratioPrevio = previos.length >= 2 ? mediana(previos) : null;
  if (!ultimo) {
    return { estado: "sin_datos", meses, ultimo: null, ratioPrevio: null, titulo: "Sin datos para chequear", detalle: `Hace falta Google Ads conectado con al menos ${MIN_CLICKS} clicks en un mes cerrado.`, acciones: [] };
  }
  const r = ultimo.ratio!;
  if (ratioPrevio != null && ratioPrevio >= 0.6 && r < ratioPrevio * 0.7) {
    return { estado: "caida", meses, ultimo, ratioPrevio, titulo: "Cayó la parte de tus clicks que GA4 registra",
      detalle: `En ${ultimo.mes} GA4 registró ${pct(r)} de los clicks de Google Ads (antes ~${pct(ratioPrevio)}). Con la pauta estable, eso suele ser un cambio en el sitio: un cartel de cookies nuevo, uno configurado para no medir a quien no acepta (Consent Mode básico) o el código de medición roto en alguna página de llegada.`,
      acciones: ACCIONES_BASE };
  }
  if (r < 0.5) {
    return { estado: "perdida_alta", meses, ultimo, ratioPrevio, titulo: "GA4 ve menos de la mitad de tus clicks",
      detalle: `En ${ultimo.mes} GA4 registró ${pct(r)} de los clicks de Google Ads. Parte de tu tráfico no se está midiendo (el cartel de cookies bloquea la medición, los clics no llevan su marca de seguimiento —gclid— o alguna página de llegada no tiene el código de Analytics) → las ventas y conversiones que ves por canal quedan por debajo de las reales.`,
      acciones: ACCIONES_BASE };
  }
  if (r < 0.75) {
    return { estado: "perdida_media", meses, ultimo, ratioPrevio, titulo: "Parte de tus clicks no llega a GA4",
      detalle: `En ${ultimo.mes} GA4 registró ${pct(r)} de los clicks de Google Ads (lo sano es 75% o más).`, acciones: ACCIONES_BASE.slice(0, 2) };
  }
  return { estado: "ok", meses, ultimo, ratioPrevio, titulo: "La medición de Google Ads en GA4 se ve sana",
    detalle: `En ${ultimo.mes} GA4 registró ${pct(Math.min(r, 9.99))} de los clicks de Google Ads.`, acciones: [] };
}

/** Reporte GA4 (yearMonth, sessions) → { "YYYY-MM": sesiones }. */
export function sesionesPorMesGa4(rows: { dimensionValues: { value: string }[]; metricValues: { value: string }[] }[] | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows ?? []) {
    const ym = r.dimensionValues[0]?.value ?? "";
    if (/^\d{6}$/.test(ym)) out[`${ym.slice(0, 4)}-${ym.slice(4, 6)}`] = (out[`${ym.slice(0, 4)}-${ym.slice(4, 6)}`] ?? 0) + (Number(r.metricValues[0]?.value ?? 0) || 0);
  }
  return out;
}
