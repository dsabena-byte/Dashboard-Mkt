// ============================================================================
// Pronóstico mensual por KPI + rango esperado (banda por residuos históricos). Puro y client-safe.
//
// Método (FPP3: benchmarks simples antes que modelos complejos, con series cortas):
//  · ESTACIONAL (≥13 meses y el mismo mes del año anterior para cada mes a pronosticar):
//      ŷ(t+k) = y(t+k−12) × tendencia, tendencia = Σ últimos 3 meses ÷ Σ mismos 3 meses del año
//      anterior, acotada a [0,5 ; 2] (misma lógica que forecastDemand de lib/simulador.ts).
//  · SUAVIZADO EXPONENCIAL SIMPLE (ETS A,N,N) con α elegido por mínimo error cuadrático a 1 paso
//      (grilla 0,1…0,9) cuando no hay estacionalidad utilizable y hay ≥3 meses.
//  · RITMO (promedio de los últimos meses) con menos de 3 meses: sin incertidumbre medible.
// La incertidumbre sale de los ERRORES RELATIVOS a 1 paso del propio método sobre la historia
// (y/ŷ − 1), que después se remuestrean (bootstrap) en las simulaciones.
// ============================================================================

export type MetodoPronostico = "estacional" | "estacional_tendencia" | "suavizado" | "ritmo";

export const METODO_TEXTO: Record<MetodoPronostico, string> = {
  estacional: "estacionalidad del año anterior",
  estacional_tendencia: "estacionalidad del año anterior × tendencia interanual",
  suavizado: "suavizado exponencial (ritmo reciente ponderado)",
  ritmo: "promedio de los últimos meses",
};

export interface Ajuste {
  metodo: MetodoPronostico;
  /** Índice (en la serie) del último valor observado. */
  ultimo: number;
  /** Pronóstico puntual para los próximos h meses (posición k-1 = ultimo + k). */
  puntos: number[];
  /** Errores relativos a 1 paso (y/ŷ − 1), en orden temporal. */
  residuos: number[];
  /** Posición en la serie de cada residuo (para alinear entre KPIs). */
  residuosIdx: number[];
  /** Cantidad de meses con dato. */
  n: number;
  /** Error típico a 1 paso ÷ promedio del KPI (RMSE / media). null sin residuos. */
  cvError: number | null;
  /** Solo suavizado: α y nivel final. */
  alpha?: number;
  nivel?: number;
  /** Solo estacional: factor de tendencia aplicado. */
  tendencia?: number;
}

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** Tendencia interanual en el origen t: Σ y[t-2..t] ÷ Σ y[t-14..t-12], acotada. null si falta algo. */
function tendenciaEn(s: (number | null)[], t: number): number | null {
  if (t - 14 < 0) return null;
  let rec = 0, ago = 0;
  for (let j = 0; j < 3; j++) {
    const a = s[t - j], b = s[t - 12 - j];
    if (!isNum(a) || !isNum(b)) return null;
    rec += a; ago += b;
  }
  if (ago <= 0) return null;
  return Math.min(2, Math.max(0.5, rec / ago));
}

function cvDe(ys: number[], fs: number[]): number | null {
  if (!ys.length) return null;
  let se = 0, sy = 0;
  for (let i = 0; i < ys.length; i++) { se += (ys[i]! - fs[i]!) ** 2; sy += ys[i]!; }
  const media = sy / ys.length;
  if (media === 0) return se === 0 ? 0 : Infinity;
  return Math.sqrt(se / ys.length) / Math.abs(media);
}

/**
 * Ajusta el mejor método disponible sobre `serie` (meses CONSECUTIVOS, null = sin dato) y
 * pronostica los `h` meses siguientes al último valor observado.
 */
export function ajustar(serie: (number | null)[], h: number): Ajuste | null {
  const s = serie.map((v) => (isNum(v) ? v : null));
  let ultimo = -1;
  for (let i = s.length - 1; i >= 0; i--) if (s[i] != null) { ultimo = i; break; }
  if (ultimo < 0) return null;
  const obsIdx: number[] = [];
  for (let i = 0; i <= ultimo; i++) if (s[i] != null) obsIdx.push(i);
  const n = obsIdx.length;
  h = Math.max(0, Math.floor(h));

  // ── Estacional (seasonal naïve × tendencia) ──
  if (n >= 13 && h <= 12) {
    let ok = true;
    for (let k = 1; k <= h; k++) if (s[ultimo + k - 12] == null) { ok = false; break; }
    const res: number[] = [], resIdx: number[] = [], ys: number[] = [], fs: number[] = [];
    if (ok) {
      for (const t of obsIdx) {
        const base = t - 12 >= 0 ? s[t - 12] : null;
        if (base == null) continue;
        const tr = t - 1 >= 0 ? tendenciaEn(s, t - 1) ?? 1 : 1;
        const f = base * tr;
        if (f <= 0) continue;
        res.push(s[t]! / f - 1); resIdx.push(t); ys.push(s[t]!); fs.push(f);
      }
    }
    if (ok && res.length >= 4) {
      const tr = tendenciaEn(s, ultimo);
      const puntos = Array.from({ length: h }, (_, i) => Math.max(0, s[ultimo + i + 1 - 12]! * (tr ?? 1)));
      return { metodo: tr != null ? "estacional_tendencia" : "estacional", ultimo, puntos, residuos: res, residuosIdx: resIdx, n, cvError: cvDe(ys, fs), tendencia: tr ?? 1 };
    }
  }

  const ys = obsIdx.map((i) => s[i]!);
  // ── Ritmo (muy pocos datos) ──
  if (n < 3) {
    const m = ys.reduce((a, b) => a + b, 0) / n;
    return { metodo: "ritmo", ultimo, puntos: Array(h).fill(m), residuos: [], residuosIdx: [], n, cvError: null };
  }

  // ── Suavizado exponencial simple ──
  let best: { alpha: number; sse: number } | null = null;
  for (let a10 = 1; a10 <= 9; a10++) {
    const alpha = a10 / 10;
    let l = ys[0]!, sse = 0;
    for (let t = 1; t < n; t++) { const e = ys[t]! - l; sse += e * e; l += alpha * e; }
    if (!best || sse < best.sse - 1e-12) best = { alpha, sse };
  }
  const alpha = best!.alpha;
  const res: number[] = [], resIdx: number[] = [], fs: number[] = [], yv: number[] = [];
  let l = ys[0]!;
  for (let t = 1; t < n; t++) {
    if (l > 0) { res.push(ys[t]! / l - 1); resIdx.push(obsIdx[t]!); fs.push(l); yv.push(ys[t]!); }
    l += alpha * (ys[t]! - l);
  }
  return { metodo: "suavizado", ultimo, puntos: Array(h).fill(Math.max(0, l)), residuos: res, residuosIdx: resIdx, n, cvError: cvDe(yv, fs), alpha, nivel: Math.max(0, l) };
}

export interface Banda {
  esperado: number;
  lo: number;
  hi: number;
  n: number;
  metodo: MetodoPronostico;
}

const media = (a: number[]) => a.reduce((s, v) => s + v, 0) / (a.length || 1);
const desvio = (a: number[]) => { const m = media(a); return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / Math.max(1, a.length - 1)); };

/**
 * RANGO ESPERADO del próximo mes dada la historia (meses consecutivos, sin el mes a evaluar):
 * esperado × (1 + sesgo ± z·σ) con σ = desvío de los errores relativos a 1 paso. null si hay
 * menos de `minN` meses o menos de 4 errores (dato insuficiente → el caller decide sin banda).
 */
export function bandaEsperada(hist: (number | null)[], opts: { z?: number; minN?: number } = {}): Banda | null {
  const z = opts.z ?? 1.96, minN = opts.minN ?? 6;
  const aj = ajustar(hist, 1);
  if (!aj || aj.n < minN || aj.residuos.length < 4 || !aj.puntos.length) return null;
  const p = aj.puntos[0]!, m = media(aj.residuos), sd = desvio(aj.residuos);
  return { esperado: p * (1 + m), lo: Math.max(0, p * (1 + m - z * sd)), hi: p * (1 + m + z * sd), n: aj.n, metodo: aj.metodo };
}

export interface EvalBanda extends Banda { actual: number; dentro: boolean; desvioPct: number | null }

/** ¿`actual` cae dentro del rango esperado según `hist`? null = no se puede decir (sin banda). */
export function evaluarContraBanda(hist: (number | null)[], actual: number, opts: { z?: number; minN?: number } = {}): EvalBanda | null {
  const b = bandaEsperada(hist, opts);
  if (!b || !isNum(actual)) return null;
  return { ...b, actual, dentro: actual >= b.lo && actual <= b.hi, desvioPct: b.esperado ? ((actual - b.esperado) / b.esperado) * 100 : null };
}
