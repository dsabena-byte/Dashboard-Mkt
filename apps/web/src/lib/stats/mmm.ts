// ============================================================================
// MMM-lite ("Impacto en tu negocio") — PURO, client-safe, sin dependencias (imports relativos).
//
// Modelo (Jin et al. 2017, Google; misma familia que Robyn / Meridian / PyMC-Marketing, en chico):
//     y_t = b0 + b1·tendencia_t + Σ_m β_m · Hill( Adstock(x_m)_t / x̄_m ; K_m, s_m ) + ε_t
//  · Adstock geométrico NORMALIZADO: a_t = (1−λ)·x_t + λ·a_{t−1}  → con inversión constante S el
//    adstock vale S (la curva de respuesta "en régimen" se lee directo en $ por período).
//  · Saturación Hill: h(a) = a^s / (a^s + K^s), con a en unidades de la inversión media del medio.
//  · Estimación MAP (no MCMC): para cada combinación de (λ, K, s) por medio, los coeficientes
//    lineales salen de una regresión ridge BAYESIANA (prior normal centrado en 0 → shrink hacia
//    "sin efecto", conservador) con β_m ≥ 0; los parámetros no lineales se eligen por búsqueda en
//    grilla coordinada (medio por medio, varias pasadas) minimizando −log posterior (verosimilitud
//    perfilada + priors débiles: Beta para el decay según tipo de medio y granularidad, lognormal
//    para K centrada en la inversión media, leve preferencia por curva cóncava s=1).
//  · Incertidumbre: bootstrap por BLOQUES de residuos (conserva autocorrelación) → cada réplica se
//    reajusta (grilla local alrededor del MAP) → bandas p10–p90 de contribución, ROI, ROI marginal y
//    curva de respuesta. PRNG con semilla → mismo resultado en cada render.
//  · Honestidad: con pocos puntos por parámetro la incertidumbre es grande y se MUESTRA (semáforo
//    de confianza, backtest fuera de muestra, "sin evidencia" por medio). Correlación ≠ causa: sin
//    experimentos (geo / lift) es una asociación condicionada al modelo.
// La inversión entra en $ nominales, tal cual (sin ajuste por inflación: decisión del user 28-sep-2026).
// ============================================================================
import { mulberry32, seedDe } from "./prng";

export type Granularidad = "mensual" | "semanal";

export interface MmmMedioInput {
  nombre: string;
  /** Inversión por período (misma longitud que `kpi`); 0 = no hubo pauta ese período. */
  inversion: number[];
  /** TV / radio / vía pública…: carryover más largo en el prior. */
  offline?: boolean;
}
export interface MmmInput {
  periodos: string[];
  kpi: number[];
  kpiNombre?: string;
  medios: MmmMedioInput[];
  granularidad: Granularidad;
  /** Variables de control ya alineadas (ej. feriados / Hot Sale 0-1). Opcional. */
  controles?: { nombre: string; valores: number[] }[];
}
export interface MmmOpciones {
  /** Réplicas bootstrap (default 120). 0 = solo MAP. */
  bootstrap?: number;
  seed?: number | string;
  /** Fuerza del prior ridge sobre los β de medios (en unidades escaladas). Default 1. */
  lambda?: number;
  /** Incluir tendencia lineal (default: sí si n ≥ 12). */
  tendencia?: boolean;
  /** Períodos finales que se reservan para el backtest fuera de muestra (default 3 mensual / 8 semanal). */
  holdout?: number;
  /** Períodos que definen la inversión "de hoy" (default 3 mensual / 8 semanal). */
  recientes?: number;
}

export interface Rango { p50: number; p10: number; p90: number }
export interface PuntoCurva { inversion: number; p50: number; p10: number; p90: number }
export type Evidencia = "con evidencia" | "débil" | "sin evidencia";
export interface MmmMedioResultado {
  nombre: string;
  offline: boolean;
  /** Parámetros MAP. */
  decay: number; K: number; s: number;
  /** β en unidades del KPI (efecto máximo por período si el medio se saturara). */
  beta: number;
  inversionTotal: number;
  /** Inversión media por período de los últimos `recientes` períodos ("hoy"). */
  inversionHoy: number;
  /** Media de la inversión del medio en la ventana (escala de la curva). */
  inversionMedia: number;
  /** Contribución al KPI en toda la ventana (unidades del KPI). */
  contribucion: Rango;
  /** Participación de la contribución en el KPI total de la ventana (%). */
  contribucionPct: Rango;
  /** KPI por cada $ invertido en la ventana (promedio). */
  roi: Rango;
  /** KPI adicional por período por cada $ extra por período, a la inversión de hoy (en régimen). */
  mroi: Rango;
  /** Cuánto del techo de la curva se usa hoy (0-1). */
  saturacion: number;
  zona: "lineal" | "rendimientos decrecientes" | "saturado";
  evidencia: Evidencia;
  /** P(β > 0 y aporta ≥ 1% del KPI) entre las réplicas bootstrap. */
  probAporte: number;
  curva: PuntoCurva[];
  /** Contribución por período (MAP). */
  serie: number[];
}
export interface MmmDraw { b0: number; bt: number; bc: number[]; medios: { beta: number; decay: number; K: number; s: number }[] }
export interface MmmOk {
  ok: true;
  n: number;
  granularidad: Granularidad;
  kpiNombre: string;
  periodos: string[];
  kpi: number[];
  ajustado: number[];
  medios: MmmMedioResultado[];
  /** Base (lo que el modelo atribuye a no-medios: marca, estacionalidad, tendencia…). */
  base: { contribucion: Rango; contribucionPct: Rango; serie: number[] };
  ajuste: { r2: number; mape: number | null; backtest: { h: number; mape: number | null } | null };
  confianza: "baja" | "media" | "alta";
  obsPorParametro: number;
  motivosConfianza: string[];
  avisos: string[];
  /** Medios excluidos del modelo y por qué. */
  excluidos: { nombre: string; motivo: string }[];
  /** Réplicas (MAP primero) para simular escenarios con banda. */
  draws: MmmDraw[];
  /** Escalas internas (para simular). */
  escala: { y: number; x: number[]; tUltimo: number; controlesMedios: number[] };
}
export interface MmmInsuficiente { ok: false; motivo: string; n: number; excluidos: { nombre: string; motivo: string }[] }
export type MmmResultado = MmmOk | MmmInsuficiente;

// ── Transformaciones ────────────────────────────────────────────────────────
/** Adstock geométrico normalizado (con inversión constante S devuelve S). */
export function adstock(x: number[], decay: number, inicial?: number): number[] {
  const out = new Array<number>(x.length);
  let a = inicial ?? (x.length ? x.slice(0, 3).reduce((s, v) => s + v, 0) / Math.min(3, x.length) : 0);
  for (let t = 0; t < x.length; t++) { a = (1 - decay) * x[t]! + decay * a; out[t] = a; }
  return out;
}
/** Saturación Hill en [0,1). */
export function hill(a: number, K: number, s: number): number {
  if (!(a > 0)) return 0;
  const as = Math.pow(a, s);
  return as / (as + Math.pow(K, s));
}
/** Derivada de Hill respecto de a. */
function hillD(a: number, K: number, s: number): number {
  if (!(a > 0)) return s === 1 ? 1 / K : 0;
  const as = Math.pow(a, s), ks = Math.pow(K, s);
  return (s * Math.pow(a, s - 1) * ks) / ((as + ks) * (as + ks));
}

// ── Grillas y priors ────────────────────────────────────────────────────────
export const DECAY_GRID = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8];
export const K_GRID = [0.35, 0.5, 0.7, 1, 1.4, 2, 2.8];
export const S_GRID = [1, 2];

/** Prior Beta(a,b) del decay por tipo de medio y granularidad (carryover mensual << semanal). */
export function priorDecay(g: Granularidad, offline: boolean): { a: number; b: number } {
  if (g === "mensual") return offline ? { a: 2, b: 4 } : { a: 1.3, b: 5 };
  return offline ? { a: 3, b: 2.5 } : { a: 2, b: 4 };
}
function logPriorDecay(d: number, p: { a: number; b: number }): number {
  const dd = Math.min(0.97, Math.max(0.03, d)); // sin -∞ en los bordes de la grilla
  return (p.a - 1) * Math.log(dd) + (p.b - 1) * Math.log(1 - dd);
}
const LOGK_SD = 0.7;
const logPriorK = (K: number) => -(Math.log(K) ** 2) / (2 * LOGK_SD * LOGK_SD);
const logPriorS = (s: number) => (s === 1 ? Math.log(0.6) : Math.log(0.4));

// ── Álgebra chica ───────────────────────────────────────────────────────────
/** Resuelve A·x = b (A p×p, simétrica PD) por eliminación gaussiana con pivoteo. null si singular. */
export function resolver(A: number[][], b: number[]): number[] | null {
  const p = b.length;
  const M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < p; c++) {
    let piv = c;
    for (let r = c + 1; r < p; r++) if (Math.abs(M[r]![c]!) > Math.abs(M[piv]![c]!)) piv = r;
    if (Math.abs(M[piv]![c]!) < 1e-12) return null;
    if (piv !== c) { const tmp = M[c]!; M[c] = M[piv]!; M[piv] = tmp; }
    for (let r = c + 1; r < p; r++) {
      const f = M[r]![c]! / M[c]![c]!;
      if (f === 0) continue;
      for (let k = c; k <= p; k++) M[r]![k]! -= f * M[c]![k]!;
    }
  }
  const x = new Array<number>(p).fill(0);
  for (let r = p - 1; r >= 0; r--) {
    let s = M[r]![p];
    for (let k = r + 1; k < p; k++) s! -= M[r]![k]! * x[k]!;
    x[r] = s! / M[r]![r]!;
  }
  return x.every(Number.isFinite) ? x : null;
}

interface Ridge { coef: number[]; rss: number; pen: number; fit: number[] }
/**
 * Ridge con penalización por columna (lam[j]) hacia 0 y no negatividad en las columnas `nonneg`
 * (conjunto activo: la que queda negativa se fija en 0 y se reajusta).
 */
function ridge(cols: number[][], y: number[], lam: number[], nonneg: boolean[]): Ridge | null {
  const n = y.length, p = cols.length;
  const activo = cols.map(() => true);
  for (let iter = 0; iter <= p; iter++) {
    const idx = cols.map((_, j) => j).filter((j) => activo[j]);
    const q = idx.length;
    const A: number[][] = Array.from({ length: q }, () => new Array<number>(q).fill(0));
    const bv = new Array<number>(q).fill(0);
    for (let a = 0; a < q; a++) {
      const ca = cols[idx[a]!];
      let sy = 0;
      for (let t = 0; t < n; t++) sy += ca![t]! * y[t]!;
      bv[a] = sy;
      for (let b = a; b < q; b++) {
        const cb = cols[idx[b]!];
        let s = 0;
        for (let t = 0; t < n; t++) s += ca![t]! * cb![t]!;
        A[a]![b] = s; A[b]![a] = s;
      }
      A[a]![a]! += lam[idx[a]!]!;
    }
    const sol = resolver(A, bv);
    if (!sol) return null;
    const neg = idx.map((j, a) => ({ j, v: sol[a] })).filter((z) => nonneg[z.j] && z.v! < 0);
    if (neg.length) { for (const z of neg) activo[z.j] = false; continue; }
    const coef = new Array<number>(p).fill(0);
    idx.forEach((j, a) => { coef[j] = sol[a]!; });
    const fit = new Array<number>(n).fill(0);
    for (let j = 0; j < p; j++) if (coef[j] !== 0) for (let t = 0; t < n; t++) fit[t]! += coef[j]! * cols[j]![t]!;
    let rss = 0;
    for (let t = 0; t < n; t++) rss += (y[t]! - fit[t]!) ** 2;
    let pen = 0;
    for (let j = 0; j < p; j++) pen += lam[j]! * coef[j]! * coef[j]!;
    return { coef, rss, pen, fit };
  }
  return null;
}

// ── Núcleo de ajuste (sobre datos escalados) ────────────────────────────────
interface Param { d: number; k: number; s: number } // índices en las grillas (d,k) y valor s
interface Core {
  ys: number[];            // KPI escalado
  xs: number[][];          // inversión por medio escalada (÷ media)
  base: number[][];        // columnas fijas: intercepto, tendencia, controles
  lamBase: number[];
  lam: number;
  priors: { a: number; b: number }[];
  /** Formas de curva a explorar: con serie mensual o corta solo cóncava (s=1); la S necesita datos. */
  sGrid: number[];
}
interface FitCore { params: Param[]; coef: number[]; nlp: number; fit: number[]; feats: number[][] }

function feature(xs: number[], p: Param): number[] {
  const a = adstock(xs, DECAY_GRID[p.d]!);
  const K = K_GRID[p.k];
  return a.map((v) => hill(v, K!, p.s));
}

function varianza(a: number[]): number {
  const m = a.reduce((s, v) => s + v, 0) / (a.length || 1);
  return a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length || 1);
}

function evaluar(core: Core, feats: number[][], params: Param[]): { nlp: number; coef: number[]; fit: number[] } | null {
  const cols = [...core.base, ...feats];
  // Prior sobre el efecto ESTANDARIZADO (β·desvío de la variable): la penalización escala con la
  // varianza de la columna → no depende de la unidad ni de cuánto se mueve la inversión.
  const lam = [...core.lamBase, ...feats.map((f) => core.lam * varianza(f))];
  const nonneg = [...core.base.map(() => false), ...feats.map(() => true)];
  const r = ridge(cols, core.ys, lam, nonneg);
  if (!r) return null;
  const n = core.ys.length;
  let lp = 0;
  params.forEach((p, m) => { lp += logPriorDecay(DECAY_GRID[p.d]!, core.priors[m]!) + logPriorK(K_GRID[p.k]!) + logPriorS(p.s); });
  const nlp = (n / 2) * Math.log(Math.max(1e-12, (r.rss + r.pen) / n)) - lp;
  return { nlp, coef: r.coef, fit: r.fit };
}

function ajustarCore(core: Core, inicio: Param[], opts: { pasadas: number; local: boolean }): FitCore | null {
  const params = inicio.map((p) => ({ ...p }));
  const feats = params.map((p, m) => feature(core.xs[m]!, p));
  let best = evaluar(core, feats, params);
  if (!best) return null;
  for (let pasada = 0; pasada < opts.pasadas; pasada++) {
    let mejoro = false;
    for (let m = 0; m < params.length; m++) {
      const cur = params[m];
      const ds = opts.local ? [cur!.d - 1, cur!.d, cur!.d + 1].filter((i) => i >= 0 && i < DECAY_GRID.length) : DECAY_GRID.map((_, i) => i);
      const ks = opts.local ? [cur!.k - 1, cur!.k, cur!.k + 1].filter((i) => i >= 0 && i < K_GRID.length) : K_GRID.map((_, i) => i);
      let bestP = cur, bestFeat = feats[m];
      for (const d of ds) {
        const a = adstock(core.xs[m]!, DECAY_GRID[d]!);
        for (const k of ks) for (const s of core.sGrid) {
          if (d === cur!.d && k === cur!.k && s === cur!.s) continue;
          const K = K_GRID[k];
          const f = a.map((v) => hill(v, K!, s));
          const trial = feats.slice(); trial[m] = f;
          const pr = params.slice(); pr[m] = { d, k, s };
          const e = evaluar(core, trial, pr);
          if (e && e.nlp < best.nlp - 1e-9) { best = e; bestP = { d, k, s }; bestFeat = f; mejoro = true; }
        }
      }
      params[m] = bestP!; feats[m] = bestFeat!;
    }
    if (!mejoro) break;
  }
  return { params, coef: best.coef, nlp: best.nlp, fit: best.fit, feats };
}

// ── Utilidades ──────────────────────────────────────────────────────────────
const mean = (a: number[]) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);
function q(sorted: number[], p: number): number {
  if (!sorted.length) return NaN;
  const pos = (sorted.length - 1) * p, lo = Math.floor(pos), hi = Math.ceil(pos);
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (pos - lo);
}
function rango(vals: number[], map: number): Rango {
  const s = [...vals].filter(Number.isFinite).sort((a, b) => a - b);
  if (!s.length) return { p50: map, p10: map, p90: map };
  return { p50: q(s, 0.5), p10: q(s, 0.1), p90: q(s, 0.9) };
}
function pearson(a: number[], b: number[]): number | null {
  const n = a.length;
  if (n < 3) return null;
  const ma = mean(a), mb = mean(b);
  let sab = 0, saa = 0, sbb = 0;
  for (let i = 0; i < n; i++) { const x = a[i]! - ma, y = b[i]! - mb; sab += x * y; saa += x * x; sbb += y * y; }
  return saa > 0 && sbb > 0 ? sab / Math.sqrt(saa * sbb) : null;
}
function mapeDe(y: number[], f: number[]): number | null {
  let s = 0, c = 0;
  for (let i = 0; i < y.length; i++) if (Math.abs(y[i]!) > 1e-12) { s += Math.abs((y[i]! - f[i]!) / y[i]!); c++; }
  return c ? (s / c) * 100 : null;
}

export const MIN_PERIODOS: Record<Granularidad, number> = { mensual: 12, semanal: 26 };
/** Mínimo de observaciones por parámetro para mostrar resultados (debajo = dato insuficiente). */
export const MIN_OBS_POR_PARAM = 1.5;

// ── API principal ───────────────────────────────────────────────────────────
export function ajustarMmm(input: MmmInput, opts: MmmOpciones = {}): MmmResultado {
  const g = input.granularidad;
  const n = input.kpi.length;
  const excluidos: { nombre: string; motivo: string }[] = [];
  const avisos: string[] = [];
  if (n < MIN_PERIODOS[g] || !input.kpi.every((v) => Number.isFinite(v))) {
    return { ok: false, n, excluidos, motivo: `dato insuficiente: ${n} ${g === "mensual" ? "meses" : "semanas"} con KPI e inversión (mínimo ${MIN_PERIODOS[g]})` };
  }
  const yScale = mean(input.kpi);
  if (!(yScale > 0)) return { ok: false, n, excluidos, motivo: "el KPI no tiene valores positivos" };

  // Medios utilizables: suficientes períodos con inversión y variación (si la inversión es
  // constante, su efecto es indistinguible de la base → se excluye y se avisa).
  const medios: { nombre: string; offline: boolean; x: number[]; media: number }[] = [];
  for (const m of input.medios) {
    const x = m.inversion.slice(0, n).map((v) => (Number.isFinite(v) && v > 0 ? v : 0));
    while (x.length < n) x.push(0);
    const activos = x.filter((v) => v > 0).length;
    const mu = mean(x);
    const sd = Math.sqrt(mean(x.map((v) => (v - mu) ** 2)));
    if (activos < 3) { excluidos.push({ nombre: m.nombre, motivo: `solo ${activos} ${activos === 1 ? "período" : "períodos"} con inversión` }); continue; }
    if (!(mu > 0) || sd / mu < 0.15) { excluidos.push({ nombre: m.nombre, motivo: "inversión casi constante: su efecto no se distingue de la base" }); continue; }
    medios.push({ nombre: m.nombre, offline: !!m.offline, x, media: mu });
  }
  if (!medios.length) return { ok: false, n, excluidos, motivo: "ningún medio tiene suficientes períodos con inversión variable para estimar su efecto" };

  const tendencia = opts.tendencia ?? n >= 12;
  const controles = (input.controles ?? []).filter((c) => c.valores.length >= n && c.valores.slice(0, n).some((v) => v !== c.valores[0]));
  const nParams = 1 + (tendencia ? 1 : 0) + controles.length + medios.length * 3; // β, decay, K por medio
  const obsPorParametro = n / nParams;
  if (obsPorParametro < MIN_OBS_POR_PARAM) {
    return { ok: false, n, excluidos, motivo: `dato insuficiente: ${n} períodos para ${nParams} parámetros (${obsPorParametro.toFixed(1)} por parámetro; mínimo ${MIN_OBS_POR_PARAM})` };
  }

  const tCol = (len: number) => Array.from({ length: len }, (_, t) => (len > 1 ? (2 * t) / (len - 1) - 1 : 0));
  const mkCore = (ys: number[], len: number): Core => {
    const base: number[][] = [new Array<number>(len).fill(1)];
    const lamBase = [1e-6];
    if (tendencia) { base.push(tCol(len)); lamBase.push(0.05); }
    for (const c of controles) { base.push(c.valores.slice(0, len)); lamBase.push(0.05); }
    return { ys, xs: medios.map((m) => m.x.slice(0, len).map((v) => v / m.media)), base, lamBase, lam: opts.lambda ?? 1, priors: medios.map((m) => priorDecay(g, m.offline)), sGrid: g === "semanal" && n >= 52 ? S_GRID : [1] };
  };
  const ys = input.kpi.map((v) => v / yScale);
  const core = mkCore(ys, n);
  // Arranque: moda del prior de decay, K = media, s = 1.
  const inicio: Param[] = medios.map((m) => {
    const p = priorDecay(g, m.offline);
    const moda = p.a > 1 && p.b > 1 ? (p.a - 1) / (p.a + p.b - 2) : 0;
    let d = 0;
    DECAY_GRID.forEach((v, i) => { if (Math.abs(v - moda) < Math.abs(DECAY_GRID[d]! - moda)) d = i; });
    return { d, k: K_GRID.indexOf(1), s: 1 };
  });
  const map = ajustarCore(core, inicio, { pasadas: 4, local: false });
  if (!map) return { ok: false, n, excluidos, motivo: "no se pudo ajustar el modelo (datos degenerados)" };

  const nb = core.base.length;
  const drawDe = (f: FitCore): MmmDraw => ({
    b0: f.coef[0]!, bt: tendencia ? f.coef[1]! : 0, bc: controles.map((_, i) => f.coef[(tendencia ? 2 : 1) + i]!),
    medios: f.params.map((p, m) => ({ beta: f.coef[nb + m]!, decay: DECAY_GRID[p.d]!, K: K_GRID[p.k]!, s: p.s })),
  });

  // ── Bootstrap por bloques de residuos ──
  const B = Math.max(0, Math.floor(opts.bootstrap ?? 120));
  const rng = mulberry32(seedDe(opts.seed ?? "mmm"));
  const resid = ys.map((v, t) => v - map.fit[t]!);
  const L = g === "mensual" ? 3 : 4;
  const fits: FitCore[] = [map];
  for (let b = 0; b < B; b++) {
    const yb = new Array<number>(n);
    let t = 0;
    while (t < n) {
      const start = Math.floor(rng() * Math.max(1, n - L + 1));
      for (let j = 0; j < L && t < n; j++, t++) yb[t] = map.fit[t]! + resid[Math.min(n - 1, start + j)]!;
    }
    const f = ajustarCore({ ...core, ys: yb }, map.params, { pasadas: 2, local: false });
    if (f) fits.push(f);
  }
  const draws = fits.map(drawDe);

  // ── Resultados por medio ──
  const R = Math.max(1, Math.floor(opts.recientes ?? (g === "mensual" ? 3 : 8)));
  const kpiTotal = input.kpi.reduce((s, v) => s + v, 0);
  const contribDe = (d: MmmDraw, m: number): number[] => {
    const md = d.medios[m];
    const a = adstock(core.xs[m]!, md!.decay);
    return a.map((v) => md!.beta * hill(v, md!.K, md!.s) * yScale);
  };
  const resMedios: MmmMedioResultado[] = medios.map((med, m) => {
    const inversionTotal = med.x.reduce((s, v) => s + v, 0);
    const inversionHoy = mean(med.x.slice(-R));
    const aHoy = inversionHoy / med.media;
    const contribs: number[] = [], rois: number[] = [], mrois: number[] = [];
    let aporta = 0;
    for (const d of draws) {
      const c = contribDe(d, m).reduce((s, v) => s + v, 0);
      contribs.push(c);
      rois.push(inversionTotal > 0 ? c / inversionTotal : 0);
      const md = d.medios[m];
      mrois.push((md!.beta * yScale * hillD(aHoy, md!.K, md!.s)) / med.media);
      if (md!.beta > 0 && kpiTotal > 0 && c / kpiTotal >= 0.01) aporta++;
    }
    const mapD = draws[0]!.medios[m];
    const serie = contribDe(draws[0]!, m);
    const cMap = serie.reduce((s, v) => s + v, 0);
    const probAporte = aporta / draws.length;
    const saturacion = hill(aHoy, mapD!.K, mapD!.s);
    // Zona por elasticidad de la curva en "hoy": d ln h / d ln a = s·(1 − h).
    const elasticidad = mapD!.s * (1 - saturacion);
    const zona: MmmMedioResultado["zona"] = elasticidad >= 0.7 ? "lineal" : elasticidad >= 0.25 ? "rendimientos decrecientes" : "saturado";
    const contribucion = rango(contribs, cMap);
    const evidencia: Evidencia = probAporte >= 0.9 && contribucion.p10 > 0 ? "con evidencia" : probAporte >= 0.6 ? "débil" : "sin evidencia";
    // Curva de respuesta en régimen: contribución por período con inversión constante S.
    const maxS = Math.max(inversionHoy * 2.5, med.media * 2.5, Math.max(...med.x));
    const curva: PuntoCurva[] = Array.from({ length: 25 }, (_, i) => {
      const S = (maxS * i) / 24;
      const vals = draws.map((d) => { const md = d.medios[m]; return md!.beta * yScale * hill(S / med.media, md!.K, md!.s); });
      const r = rango(vals, vals[0]!);
      return { inversion: S, p50: r.p50, p10: r.p10, p90: r.p90 };
    });
    return {
      nombre: med.nombre, offline: med.offline, decay: mapD!.decay, K: mapD!.K, s: mapD!.s, beta: mapD!.beta * yScale,
      inversionTotal, inversionHoy, inversionMedia: med.media,
      contribucion, contribucionPct: { p50: (contribucion.p50 / kpiTotal) * 100, p10: (contribucion.p10 / kpiTotal) * 100, p90: (contribucion.p90 / kpiTotal) * 100 },
      roi: rango(rois, rois[0]!), mroi: rango(mrois, mrois[0]!),
      saturacion, zona, evidencia, probAporte, curva, serie,
    };
  });

  // Base = KPI − medios (por réplica).
  const baseTot = draws.map((d) => kpiTotal - medios.reduce((s, _, m) => s + contribDe(d, m).reduce((a, v) => a + v, 0), 0));
  const baseSerie = input.kpi.map((_, t) => map.fit[t]! * yScale - resMedios.reduce((s, r) => s + r.serie[t]!, 0));
  const baseR = rango(baseTot, baseTot[0]!);

  // ── Ajuste y backtest ──
  const ajustado = map.fit.map((v) => v * yScale);
  const ssTot = input.kpi.reduce((s, v) => s + (v - yScale) ** 2, 0);
  const ssRes = input.kpi.reduce((s, v, t) => s + (v - ajustado[t]!) ** 2, 0);
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;
  const H = Math.max(0, Math.floor(opts.holdout ?? (g === "mensual" ? 3 : 8)));
  let backtest: MmmOk["ajuste"]["backtest"] = null;
  if (H > 0 && n - H >= MIN_PERIODOS[g] - 2) {
    // Reajuste con los primeros n−H y pronóstico de los últimos H con la inversión real.
    const nTr = n - H;
    const cTr = mkCore(ys.slice(0, nTr), nTr);
    const fTr = ajustarCore(cTr, map.params, { pasadas: 3, local: false });
    if (fTr) {
      const tFull = tCol(nTr).length > 1 ? (t: number) => (2 * t) / (nTr - 1) - 1 : () => 0;
      const pred: number[] = [];
      for (let t = nTr; t < n; t++) {
        let v = fTr.coef[0]! + (tendencia ? fTr.coef[1]! * tFull(nTr - 1) : 0); // tendencia congelada en el último punto de entrenamiento
        controles.forEach((c, i) => { v += fTr.coef[(tendencia ? 2 : 1) + i]! * c.valores[t]!; });
        fTr.params.forEach((p, m) => {
          const a = adstock(core.xs[m]!.slice(0, t + 1), DECAY_GRID[p.d]!);
          v += fTr.coef[nb + m]! * hill(a[t]!, K_GRID[p.k]!, p.s);
        });
        pred.push(v * yScale);
      }
      backtest = { h: H, mape: mapeDe(input.kpi.slice(nTr), pred) };
    }
  }

  // ── Confianza (identificabilidad) ──
  const motivos: string[] = [];
  let conf: MmmOk["confianza"] = obsPorParametro >= 10 ? "alta" : obsPorParametro >= 4 ? "media" : "baja";
  if (obsPorParametro < 4) motivos.push(`${obsPorParametro.toFixed(1)} datos por parámetro (Meridian considera "bajo" ~4 y "direccional" ~15)`);
  let maxCorr = 0, par = "";
  for (let a = 0; a < medios.length; a++) for (let b = a + 1; b < medios.length; b++) {
    const r = pearson(medios[a]!.x, medios[b]!.x);
    if (r != null && Math.abs(r) > maxCorr) { maxCorr = Math.abs(r); par = `${medios[a]!.nombre} y ${medios[b]!.nombre}`; }
  }
  if (maxCorr >= 0.8) { motivos.push(`${par} se invierten casi siempre juntos (r=${maxCorr.toFixed(2)}): el modelo no puede separar bien sus efectos`); if (conf === "alta") conf = "media"; else conf = "baja"; }
  if (backtest?.mape != null && backtest.mape > 20) { motivos.push(`el backtest de los últimos ${backtest.h} períodos erra ${backtest.mape.toFixed(0)}% en promedio`); conf = conf === "alta" ? "media" : "baja"; }
  const sinEv = resMedios.filter((r) => r.evidencia === "sin evidencia").length;
  if (sinEv) motivos.push(`${sinEv} de ${resMedios.length} medios sin evidencia suficiente de efecto (la banda incluye cero)`);
  if (g === "mensual") avisos.push("Serie mensual: pocos puntos para un MMM (la industria pide ~2 años semanales). Leé los rangos, no el punto.");
  avisos.push("Correlación, no causa: sin un experimento (apagar un medio en algunas regiones) esto es una asociación condicionada al modelo.");

  return {
    ok: true, n, granularidad: g, kpiNombre: input.kpiNombre ?? "KPI", periodos: input.periodos.slice(0, n), kpi: input.kpi.slice(0, n), ajustado,
    medios: resMedios,
    base: { contribucion: baseR, contribucionPct: { p50: (baseR.p50 / kpiTotal) * 100, p10: (baseR.p10 / kpiTotal) * 100, p90: (baseR.p90 / kpiTotal) * 100 }, serie: baseSerie },
    ajuste: { r2, mape: mapeDe(input.kpi, ajustado), backtest },
    confianza: conf, obsPorParametro, motivosConfianza: motivos, avisos, excluidos, draws,
    escala: { y: yScale, x: medios.map((m) => m.media), tUltimo: tendencia ? 1 : 0, controlesMedios: controles.map((c) => mean(c.valores.slice(-R))) },
  };
}

// ── Escenarios ──────────────────────────────────────────────────────────────
export interface EscenarioMmm {
  /** KPI por período en régimen con la inversión `alloc` (rango). */
  kpi: Rango;
  /** Diferencia vs la inversión de hoy (rango, pareado por réplica). */
  delta: Rango;
  porMedio: { nombre: string; inversion: number; contribucion: Rango }[];
}
/** KPI por período en régimen (inversión constante por medio) para cada réplica. */
function kpiRegimen(res: MmmOk, d: MmmDraw, alloc: (m: number) => number): { total: number; porMedio: number[] } {
  let v = d.b0 + d.bt * res.escala.tUltimo;
  d.bc.forEach((b, i) => { v += b * (res.escala.controlesMedios[i] ?? 0); });
  const porMedio = d.medios.map((md, m) => md.beta * hill(alloc(m) / res.escala.x[m]!, md.K, md.s) * res.escala.y);
  return { total: v * res.escala.y + porMedio.reduce((s, x) => s + x, 0), porMedio };
}
export function simularMmm(res: MmmOk, alloc: Record<string, number>): EscenarioMmm {
  const at = (m: number) => Math.max(0, alloc[res.medios[m]!.nombre] ?? res.medios[m]!.inversionHoy);
  const hoy = (m: number) => res.medios[m]!.inversionHoy;
  const tot: number[] = [], del: number[] = [];
  const pm: number[][] = res.medios.map(() => []);
  for (const d of res.draws) {
    const a = kpiRegimen(res, d, at), b = kpiRegimen(res, d, hoy);
    tot.push(a.total); del.push(a.total - b.total);
    a.porMedio.forEach((v, m) => pm[m]!.push(v));
  }
  return {
    kpi: rango(tot, tot[0]!), delta: rango(del, del[0]!),
    porMedio: res.medios.map((r, m) => ({ nombre: r.nombre, inversion: at(m), contribucion: rango(pm[m]!, pm[m]![0]!) })),
  };
}

/**
 * Reparte `total` por período entre los medios del modelo maximizando el KPI (curvas MAP, greedy
 * por retorno marginal: óptimo para curvas cóncavas; con curvas en S es una buena aproximación).
 */
export function optimizarMmm(res: MmmOk, total: number, bounds: Record<string, { min: number; max: number }> = {}, pasos = 400): Record<string, number> {
  const d = res.draws[0];
  const alloc: Record<string, number> = {};
  const b = (nombre: string, m: number) => bounds[nombre] ?? { min: res.medios[m]!.inversionHoy * 0.5, max: res.medios[m]!.inversionHoy * 2 };
  let minSum = 0;
  res.medios.forEach((r, m) => { minSum += Math.max(0, b(r.nombre, m).min); });
  const scale = minSum > total && minSum > 0 ? total / minSum : 1;
  res.medios.forEach((r, m) => { alloc[r.nombre] = Math.max(0, b(r.nombre, m).min) * scale; });
  let left = total - Object.values(alloc).reduce((s, v) => s + v, 0);
  const step = Math.max(total / pasos, 1e-9);
  const resp = (m: number, S: number) => { const md = d!.medios[m]; return md!.beta * hill(S / res.escala.x[m]!, md!.K, md!.s); };
  while (left > 1e-9) {
    const inc = Math.min(step, left);
    let best = -1, gain = 0;
    res.medios.forEach((r, m) => {
      const cap = b(r.nombre, m).max;
      const add = Math.min(inc, cap - alloc[r.nombre]!);
      if (add <= 1e-9) return;
      const gg = (resp(m, alloc[r.nombre]! + add) - resp(m, alloc[r.nombre]!)) / add;
      if (gg > gain) { gain = gg; best = m; }
    });
    if (best < 0) break;
    const nm = res.medios[best]!.nombre;
    const add = Math.min(inc, b(nm, best).max - alloc[nm]!);
    alloc[nm]! += add; left -= add;
  }
  return alloc;
}

/** Texto corto del semáforo de confianza. */
export const CONFIANZA_TEXTO: Record<MmmOk["confianza"], string> = {
  alta: "Confianza alta: suficientes datos por parámetro y buen backtest.",
  media: "Confianza media: el modelo es direccional; mirá los rangos.",
  baja: "Confianza baja: pocos datos para separar efectos. Usalo como hipótesis a testear, no para decidir solo con esto.",
};
