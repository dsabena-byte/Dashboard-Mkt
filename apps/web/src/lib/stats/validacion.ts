// ============================================================================
// Validación empírica de los pesos del Mapa (D4 de objetivos-inteligencia.md). Puro, client-safe.
//
// "El Mapa como hipótesis": para cada vínculo KPI → objetivo, ¿el KPI se mueve con tu RESULTADO
// de negocio (ingresos, transacciones, ventas/share cargados) con 0-3 meses de adelanto?
//  · Series mensuales alineadas; se trabajan en VARIACIONES (Δlog si son positivas, Δ si no) para
//    no confundir dos tendencias con una relación (correlación espuria por tendencia).
//  · Pearson r para cada rezago 0..3 (KPI en t vs resultado en t+k); se informa el mejor por |r|,
//    con n, IC 95% (Fisher z) y p-valor (t de Student) CORREGIDO por probar 4 rezagos (Bonferroni).
//  · Mínimo 12 pares. KPIs "menor es mejor" (costos): se espera r negativo.
//  · NUNCA "causa": es una asociación; puede haber estacionalidad común o un tercer factor
//    (lo decimos en la UI, como IPA).
// ============================================================================

export type Transformacion = "dlog" | "dif" | "nivel";
export interface CorrRezagada {
  lag: number;
  r: number;
  n: number;
  ic: [number, number];
  p: number;
  /** p × cantidad de rezagos probados (Bonferroni), tope 1. */
  pAjustado: number;
  transformacion: Transformacion;
  /** r de cada rezago probado (para transparencia). */
  porLag: { lag: number; r: number | null; n: number }[];
}

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

// ── Distribuciones (Numerical Recipes: beta incompleta regularizada) ──
function lnGamma(x: number): number {
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let y = x;
  const tmp = x + 5.5 - (x + 0.5) * Math.log(x + 5.5);
  let ser = 1.000000000190015;
  for (const cj of c) ser += cj / ++y;
  return -tmp + Math.log((2.5066282746310005 * ser) / x);
}
function betacf(a: number, b: number, x: number): number {
  const MAXIT = 200, EPS = 3e-14, FPMIN = 1e-300;
  const qab = a + b, qap = a + 1, qam = a - 1;
  let c = 1, d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d; h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}
/** Beta incompleta regularizada I_x(a,b). */
export function betaInc(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(lnGamma(a + b) - lnGamma(a) - lnGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? (bt * betacf(a, b, x)) / a : 1 - (bt * betacf(b, a, 1 - x)) / b;
}
/** p-valor bilateral de un t con `df` grados de libertad. */
export function pValorT(t: number, df: number): number {
  if (!Number.isFinite(t)) return 0;
  return betaInc(df / (df + t * t), df / 2, 0.5);
}
/** p-valor bilateral de una correlación r con n pares (H0: ρ = 0). */
export function pValorR(r: number, n: number): number {
  if (n < 3) return 1;
  if (Math.abs(r) >= 1) return 0;
  return pValorT(r * Math.sqrt((n - 2) / (1 - r * r)), n - 2);
}
/** IC 95% de r por la transformación z de Fisher. */
export function icFisher(r: number, n: number, z = 1.96): [number, number] {
  if (n <= 3) return [-1, 1];
  const rr = Math.max(-0.999999, Math.min(0.999999, r));
  const f = Math.atanh(rr), se = 1 / Math.sqrt(n - 3);
  return [Math.tanh(f - z * se), Math.tanh(f + z * se)];
}

function pearson(a: number[], b: number[]): number | null {
  const n = a.length;
  if (n < 3) return null;
  const ma = a.reduce((s, v) => s + v, 0) / n, mb = b.reduce((s, v) => s + v, 0) / n;
  let sab = 0, saa = 0, sbb = 0;
  for (let i = 0; i < n; i++) { const x = a[i]! - ma, y = b[i]! - mb; sab += x * y; saa += x * x; sbb += y * y; }
  return saa > 0 && sbb > 0 ? sab / Math.sqrt(saa * sbb) : null;
}

/** Transforma a variaciones (null donde falta el punto o el anterior). */
export function transformar(s: (number | null)[], t: Transformacion): (number | null)[] {
  if (t === "nivel") return s.map((v) => (isNum(v) ? v : null));
  return s.map((v, i) => {
    const a = i > 0 ? s[i - 1] : null;
    if (!isNum(v) || !isNum(a)) return null;
    if (t === "dlog") return v > 0 && a > 0 ? Math.log(v / a) : null;
    return v - a;
  });
}
const todasPositivas = (s: (number | null)[]) => s.filter(isNum).every((v) => v > 0);

export function correlacionRezagada(x: (number | null)[], y: (number | null)[], opts: { maxLag?: number; minN?: number; transformacion?: Transformacion } = {}): CorrRezagada | null {
  const maxLag = Math.max(0, Math.min(6, opts.maxLag ?? 3));
  const minN = opts.minN ?? 12;
  const t: Transformacion = opts.transformacion ?? (todasPositivas(x) && todasPositivas(y) ? "dlog" : "dif");
  const tx = transformar(x, t), ty = transformar(y, t);
  const porLag: CorrRezagada["porLag"] = [];
  let best: { lag: number; r: number; n: number } | null = null;
  for (let lag = 0; lag <= maxLag; lag++) {
    const xs: number[] = [], ys: number[] = [];
    for (let i = 0; i + lag < ty.length && i < tx.length; i++) {
      const a = tx[i], b = ty[i + lag];
      if (isNum(a) && isNum(b)) { xs.push(a); ys.push(b); }
    }
    const r = xs.length >= minN ? pearson(xs, ys) : null;
    porLag.push({ lag, r, n: xs.length });
    if (r != null && (!best || Math.abs(r) > Math.abs(best.r))) best = { lag, r, n: xs.length };
  }
  if (!best) return null;
  const p = pValorR(best.r, best.n);
  return { lag: best.lag, r: best.r, n: best.n, ic: icFisher(best.r, best.n), p, pAjustado: Math.min(1, p * (maxLag + 1)), transformacion: t, porLag };
}

// ── Validación del Mapa ──
export type NivelEvidencia = "fuerte" | "moderada" | "sin evidencia" | "contraria" | "sin datos" | "es el resultado";
export interface VinculoEntrada { plan: string; kpi: string; objetivoId: string; peso: number; direccion: "up" | "down"; serie: (number | null)[] }
export interface VinculoEvidencia {
  plan: string; kpi: string; objetivoId: string; peso: number;
  nivel: NivelEvidencia;
  corr: CorrRezagada | null;
  /** Lectura en castellano (sin "causa"). */
  lectura: string;
  /** Sugerencia sobre el peso (null si no hay nada que sugerir). */
  sugerencia: string | null;
}
export interface ValidacionMapa {
  resultado: string;
  vinculos: VinculoEvidencia[];
  resumen: { fuerte: number; moderada: number; sinEvidencia: number; contraria: number; sinDatos: number };
  advertencia: string;
}

export const ADVERTENCIA_CAUSALIDAD = "Es una asociación en tus datos, no una prueba de causa: dos series pueden moverse juntas por la estacionalidad o por un tercer factor (precio, distribución, un evento). Usalo para revisar hipótesis, no para fijar pesos solo con esto.";

export function evidenciaVinculo(serieKpi: (number | null)[], serieResultado: (number | null)[], direccion: "up" | "down", opts: { maxLag?: number; minN?: number } = {}): { nivel: NivelEvidencia; corr: CorrRezagada | null } {
  const corr = correlacionRezagada(serieKpi, serieResultado, opts);
  if (!corr) return { nivel: "sin datos", corr: null };
  const signo = direccion === "down" ? -corr.r : corr.r; // KPIs de costo: se espera r < 0
  const sig = corr.pAjustado < 0.05;
  let nivel: NivelEvidencia;
  if (sig && signo < 0) nivel = "contraria";
  else if (sig && Math.abs(corr.r) >= 0.5) nivel = "fuerte";
  else if (sig || (corr.pAjustado < 0.2 && signo > 0 && Math.abs(corr.r) >= 0.3)) nivel = "moderada";
  else nivel = "sin evidencia";
  return { nivel, corr };
}

const MESES_TXT = (k: number) => (k === 0 ? "en el mismo mes" : `con ${k} ${k === 1 ? "mes" : "meses"} de adelanto`);

export function validarMapa(vinculos: VinculoEntrada[], resultado: { nombre: string; serie: (number | null)[]; plan?: string; kpi?: string }, opts: { maxLag?: number; minN?: number } = {}): ValidacionMapa {
  const out: VinculoEvidencia[] = vinculos.map((v) => {
    if (resultado.kpi && v.kpi === resultado.kpi && (!resultado.plan || v.plan === resultado.plan)) {
      return { plan: v.plan, kpi: v.kpi, objetivoId: v.objetivoId, peso: v.peso, nivel: "es el resultado" as const, corr: null, lectura: `Es el mismo resultado contra el que se compara (${resultado.nombre}).`, sugerencia: null };
    }
    const { nivel, corr } = evidenciaVinculo(v.serie, resultado.serie, v.direccion, opts);
    let lectura: string;
    if (!corr) lectura = `Faltan meses con dato de ${v.kpi} y de ${resultado.nombre} a la vez (mínimo ${opts.minN ?? 12}).`;
    else {
      const rTxt = `r=${corr.r.toFixed(2)}, n=${corr.n}, IC95% [${corr.ic[0].toFixed(2)}; ${corr.ic[1].toFixed(2)}]`;
      lectura = nivel === "fuerte" || nivel === "moderada"
        ? `Las variaciones de ${v.kpi} acompañan a las de ${resultado.nombre} ${MESES_TXT(corr.lag)} (${rTxt}).`
        : nivel === "contraria"
          ? `${v.kpi} se mueve al revés de lo esperado respecto de ${resultado.nombre} ${MESES_TXT(corr.lag)} (${rTxt}).`
          : `No se ve una relación clara entre ${v.kpi} y ${resultado.nombre} (mejor rezago: ${MESES_TXT(corr.lag)}, ${rTxt}).`;
    }
    let sugerencia: string | null = null;
    if (nivel === "fuerte" && v.peso <= 15) sugerencia = `Tiene evidencia fuerte y pesa ${v.peso}%: podría pesar más.`;
    else if ((nivel === "sin evidencia" || nivel === "contraria") && v.peso >= 25) sugerencia = `Pesa ${v.peso}% pero no muestra relación con ${resultado.nombre}: revisá si es el KPI correcto o si su efecto es de más largo plazo (marca).`;
    return { plan: v.plan, kpi: v.kpi, objetivoId: v.objetivoId, peso: v.peso, nivel, corr, lectura, sugerencia };
  });
  const c = (n: NivelEvidencia) => out.filter((x) => x.nivel === n).length;
  return {
    resultado: resultado.nombre, vinculos: out,
    resumen: { fuerte: c("fuerte"), moderada: c("moderada"), sinEvidencia: c("sin evidencia"), contraria: c("contraria"), sinDatos: c("sin datos") },
    advertencia: ADVERTENCIA_CAUSALIDAD,
  };
}
