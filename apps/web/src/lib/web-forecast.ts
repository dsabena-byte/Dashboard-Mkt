// ============================================================================
// Pronóstico a CIERRE DE MES de ingresos y transacciones (QW4 de docs/estado-del-arte/web.md). Puro,
// client-safe, imports relativos (lo usa el test).
//
// Método (run-rate ajustado por día de semana — "seasonal naive" diario con perfil de 8 semanas):
//  1. Perfil semanal: factor por día de la semana = promedio de ese día ÷ promedio general, sobre las
//     8 semanas previas al mes (≥2 observaciones por día; si no, 1).
//  2. Ritmo = promedio DESESTACIONALIZADO (y ÷ factor) de los últimos 14 días con dato (incluye los
//     días del mes en curso).
//  3. Días que faltan = ritmo × factor del día. Cierre = real del mes a ayer + lo que falta.
//  4. Rango p10–p90 por bootstrap de los errores diarios del propio método sobre la historia, en
//     BLOQUES de 7 días (conserva la autocorrelación: una semana floja suele seguir floja). Semilla
//     fija (lib/stats/prng) → mismo input, mismo rango en cada render.
// "Preliminar" con < 5 días del mes o < 14 días de historia (sin rango).
// ============================================================================
import { mulberry32, seedDe } from "./stats/prng";

export interface DiaWeb { fecha: string; tx: number; ingresos: number; sesiones?: number }

export interface ProyKpi {
  real: number;           // acumulado del mes a la fecha del dato
  cierre: number;         // p50
  p10: number | null;
  p90: number | null;
  meta: number | null;
  pctMeta: number | null; // cierre ÷ meta × 100
  /** Lo que hace falta por día (en los días que quedan) para llegar a la meta. */
  necesarioDia: number | null;
  ritmoDia: number;       // ritmo actual desestacionalizado × factor promedio de los días que faltan
  estado: "en_linea" | "debajo" | "sobre" | "sin_meta";
}

export interface CierreMes {
  mes: string;            // YYYY-MM
  hasta: string;          // último día con dato (YYYY-MM-DD)
  diasConDato: number;
  diasMes: number;
  diasRestantes: number;
  preliminar: boolean;
  metodo: string;
  tx: ProyKpi;
  ingresos: ProyKpi;
}

const N_SIMS = 1000;
const HIST_DIAS = 56;

const isoDow = (fecha: string) => new Date(`${fecha}T12:00:00Z`).getUTCDay();
function sumarDias(fecha: string, n: number): string {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const diasDelMes = (anio: number, mes: number) => new Date(Date.UTC(anio, mes, 0)).getUTCDate();

/** Factores por día de semana (0=domingo) sobre la historia. */
export function perfilSemanal(hist: { fecha: string; v: number }[]): number[] {
  const media = hist.length ? hist.reduce((a, d) => a + d.v, 0) / hist.length : 0;
  const f = Array(7).fill(1);
  if (!(media > 0)) return f;
  for (let dow = 0; dow < 7; dow++) {
    const xs = hist.filter((d) => isoDow(d.fecha) === dow).map((d) => d.v);
    if (xs.length >= 2) f[dow] = Math.max(0.05, xs.reduce((a, b) => a + b, 0) / xs.length / media);
  }
  // Normaliza para que el promedio de los 7 factores sea 1.
  const m = f.reduce((a, b) => a + b, 0) / 7;
  return f.map((x) => x / m);
}

function proyectar(serie: { fecha: string; v: number }[], mesIni: string, hasta: string, diasRest: string[], meta: number | null, seed: string, conRango: boolean, dir: "up"): ProyKpi {
  const hist = serie.filter((d) => d.fecha < mesIni).slice(-HIST_DIAS);
  const delMes = serie.filter((d) => d.fecha >= mesIni && d.fecha <= hasta);
  const real = delMes.reduce((a, d) => a + d.v, 0);
  const f = perfilSemanal(hist);
  const fac = (fe: string): number => f[isoDow(fe)] ?? 1;
  const des = (d: { fecha: string; v: number }) => d.v / fac(d.fecha);
  const recientes = serie.filter((d) => d.fecha <= hasta).slice(-14);
  const ritmo = recientes.length ? recientes.reduce((a, d) => a + des(d), 0) / recientes.length : 0;
  const puntos = diasRest.map((fe) => ritmo * fac(fe));
  const falta = puntos.reduce((a, b) => a + b, 0);
  const cierre = real + falta;

  let p10: number | null = null, p90: number | null = null;
  if (conRango && diasRest.length && hist.length >= 14) {
    // Errores diarios del método sobre la historia: y_t ÷ (ritmo de los 14 días previos × factor) − 1.
    const errs: number[] = [];
    for (let i = 14; i < hist.length; i++) {
      const prev = hist.slice(i - 14, i);
      const r = prev.reduce((a, d) => a + des(d), 0) / prev.length;
      const h = hist[i]!;
      const pred = r * fac(h.fecha);
      if (pred > 0) errs.push(h.v / pred - 1);
    }
    if (errs.length >= 7) {
      const rnd = mulberry32(seedDe(seed));
      const sims = new Float64Array(N_SIMS);
      for (let s = 0; s < N_SIMS; s++) {
        let tot = 0, j = 0;
        while (j < puntos.length) {
          const ini = Math.floor(rnd() * Math.max(1, errs.length - 6));
          for (let b = 0; b < 7 && j < puntos.length; b++, j++) tot += Math.max(0, puntos[j]! * (1 + errs[Math.min(errs.length - 1, ini + b)]!));
        }
        sims[s] = real + tot;
      }
      sims.sort();
      p10 = sims[Math.floor(N_SIMS * 0.1)] ?? null;
      p90 = sims[Math.floor(N_SIMS * 0.9)] ?? null;
    }
  }
  const pctMeta = meta && meta > 0 ? Math.round((cierre / meta) * 1000) / 10 : null;
  const necesarioDia = meta != null && diasRest.length ? Math.max(0, (meta - real) / diasRest.length) : null;
  const ritmoDia = diasRest.length ? falta / diasRest.length : 0;
  let estado: ProyKpi["estado"] = "sin_meta";
  if (meta && meta > 0) {
    // "En línea" = la meta cae dentro del rango probable (o ±5% sin rango).
    const lo = p10 ?? cierre * 0.95, hi = p90 ?? cierre * 1.05;
    estado = dir === "up" ? (meta < lo ? "sobre" : meta > hi ? "debajo" : "en_linea") : "en_linea";
  }
  return { real, cierre, p10, p90, meta, pctMeta, necesarioDia, ritmoDia, estado };
}

/**
 * Cierre proyectado del mes del último dato. `serie` = días (cualquier orden; se ordena), idealmente
 * 8 semanas previas + los días del mes en curso hasta ayer. Devuelve null sin datos del mes.
 */
export function cierreDeMes(serie: DiaWeb[], opts: { metaTx?: number | null; metaIngresos?: number | null; seed?: string } = {}): CierreMes | null {
  const s = [...serie].filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d.fecha)).sort((a, b) => a.fecha.localeCompare(b.fecha));
  if (!s.length) return null;
  const hasta = s[s.length - 1]!.fecha;
  const anio = Number(hasta.slice(0, 4)), mes = Number(hasta.slice(5, 7));
  const mesIni = `${hasta.slice(0, 7)}-01`;
  const dm = diasDelMes(anio, mes);
  const diasConDato = s.filter((d) => d.fecha >= mesIni).length;
  if (!diasConDato) return null;
  const diasRest: string[] = [];
  for (let fe = sumarDias(hasta, 1); fe.slice(0, 7) === hasta.slice(0, 7); fe = sumarDias(fe, 1)) diasRest.push(fe);
  const histN = s.filter((d) => d.fecha < mesIni).length;
  const preliminar = diasConDato < 5 || histN < 14;
  const seed = opts.seed ?? hasta;
  return {
    mes: hasta.slice(0, 7), hasta, diasConDato, diasMes: dm, diasRestantes: diasRest.length, preliminar,
    metodo: histN >= 14 ? "ritmo de los últimos 14 días ajustado por día de la semana (perfil de 8 semanas)" : "ritmo de los días del mes (sin historia suficiente para el perfil semanal)",
    tx: proyectar(s.map((d) => ({ fecha: d.fecha, v: d.tx })), mesIni, hasta, diasRest, opts.metaTx ?? null, `${seed}|tx`, !preliminar, "up"),
    ingresos: proyectar(s.map((d) => ({ fecha: d.fecha, v: d.ingresos })), mesIni, hasta, diasRest, opts.metaIngresos ?? null, `${seed}|rev`, !preliminar, "up"),
  };
}

/** Filas del reporte GA4 (date, transactions, purchaseRevenue, sessions) → serie diaria. */
export function serieDesdeGa4(rows: { dimensionValues: { value: string }[]; metricValues: { value: string }[] }[] | undefined): DiaWeb[] {
  return (rows ?? []).map((r) => {
    const d = r.dimensionValues[0]?.value ?? "";
    return { fecha: d.length === 8 ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}` : d, tx: Number(r.metricValues[0]?.value ?? 0) || 0, ingresos: Number(r.metricValues[1]?.value ?? 0) || 0, sesiones: Number(r.metricValues[2]?.value ?? 0) || 0 };
  });
}
