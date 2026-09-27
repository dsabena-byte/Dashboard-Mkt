// Propagación de las simulaciones por el rollup del Mapa: cumpl(objetivo) = Σ w·cumpl(KPI) / Σ w,
// aplicado SIMULACIÓN POR SIMULACIÓN (con las mismas uniformes para todos los KPIs → se conserva la
// correlación entre KPIs). Da la distribución del cumplimiento del objetivo al cierre y la
// probabilidad de llegar al 100%. Puro.

export interface ItemRollup { w: number; sims: Float64Array | null }
export interface ResultadoRollup {
  p50: number; p10: number; p90: number;
  /** P(cumplimiento ≥ umbral). */
  probabilidad: number;
  /** % del peso con pronóstico confiable. */
  cobertura: number;
  sims: Float64Array;
}

const q = (a: Float64Array, p: number) => { const pos = (a.length - 1) * p, lo = Math.floor(pos), hi = Math.ceil(pos); return a[lo]! + (a[hi]! - a[lo]!) * (pos - lo); };

/**
 * null si el peso con simulaciones es menor a `coberturaMin` (0-1) del peso total → "dato
 * insuficiente" (no se renormaliza sobre muy poco). Los ítems sin sims se renormalizan afuera.
 */
export function propagarPonderado(items: ItemRollup[], opts: { coberturaMin?: number; umbral?: number } = {}): ResultadoRollup | null {
  const min = opts.coberturaMin ?? 0.6, umbral = opts.umbral ?? 100;
  const wTot = items.reduce((a, x) => a + Math.max(0, x.w), 0);
  const con = items.filter((x) => x.sims && x.w > 0);
  const wCon = con.reduce((a, x) => a + x.w, 0);
  if (!wTot || !wCon || wCon / wTot < min - 1e-9) return null;
  const nS = Math.min(...con.map((x) => x.sims!.length));
  const out = new Float64Array(nS);
  let ok = 0;
  for (let s = 0; s < nS; s++) {
    let v = 0;
    for (const x of con) v += x.w * x.sims![s]!;
    v /= wCon;
    out[s] = v;
    if (v >= umbral - 1e-9) ok++;
  }
  const sorted = Float64Array.from(out).sort();
  return { p50: q(sorted, 0.5), p10: q(sorted, 0.1), p90: q(sorted, 0.9), probabilidad: ok / nS, cobertura: (wCon / wTot) * 100, sims: out };
}
