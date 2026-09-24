// ============================================================================
// Simulador de presupuesto (Plan de Medios) — portado de BIP (sep-2026). Matemática PURA y
// client-safe (sin server-only, imports RELATIVOS para correrlo suelto en el test:
// scripts/simulador.test.ts).
//
// Modelo por MEDIO (Meta, YouTube, Programmatic, Google Search, Google Demand Gen, TikTok,
// Mercado Ads, Geo Mobile/Tap Tap… + offline TV/OOH/DOOH/radio con contactos) y por métrica
// (impresiones/contactos, alcance, clicks): curva de respuesta con rendimientos decrecientes
//     resultado = a · inversión^b      (0 < b ≤ 1)
// ajustada por regresión log-log (MCO sobre ln y = ln a + b·ln x) con los MESES del propio medio.
// Con menos de 4 meses o un ajuste pobre (R² < 0,3) se usa la eficiencia promedio con un
// decaimiento conservador (b = 0,8) → la curva es APROXIMADA.
// La curva se CALIBRA al promedio mensual reciente: con la inversión actual reproduce el
// resultado actual (sin cambios, la simulación da lo mismo que hoy).
// Optimizar = asignación greedy por retorno marginal (óptima para curvas cóncavas) con topes.
//
// FUENTE (Drean): los meses por medio salen de `buildPautaMediosMensual` (lib/pauta-medios-model)
// = MISMO gap-fill que /performance, el Seguimiento y las señales: Meta siempre por la API, OMD solo
// para medios sin API, DV360 USD→ARS con fx del mes, UGC incluido, PMax excluido, solo meses
// CERRADOS. Año en curso + anterior. Alcance = SUMA del alcance de cada medio (semántica de Drean:
// Impacto Campaña suma el alcance por medio, sin deduplicar).
// ============================================================================

import type { PautaMesMedios } from "./pauta-medios-model";

export type SimMetric = "impresiones" | "alcance" | "clicks";
export const SIM_METRICS: { key: SimMetric; label: string; unit: string; costLabel: string; costPer: number }[] = [
  { key: "impresiones", label: "Impresiones / contactos", unit: "impactos", costLabel: "CPM", costPer: 1000 },
  { key: "alcance", label: "Alcance", unit: "personas", costLabel: "Costo cada 1.000 personas", costPer: 1000 },
  { key: "clicks", label: "Clicks", unit: "clicks", costLabel: "CPC", costPer: 1 },
];

export const DEFAULT_B = 0.8;   // decaimiento conservador cuando no hay datos para estimarlo
const B_MIN = 0.3, B_MAX = 1.0; // rango razonable de la elasticidad
const MIN_POINTS = 4;
const MIN_R2 = 0.3;

// Offline = mismo criterio que lib/signals/adapters (OFFLINE_RE). Duplicado a propósito para no
// arrastrar el módulo de señales al bundle cliente; el test verifica que coincidan.
export const SIM_OFFLINE_RE = /\b(tv|television|televisi[oó]n|ooh|dooh|radio|cine|v[ií]a p[úu]blica|gr[aá]fica|revista|diario|prensa|out of home)\b/i;
export const isOfflineCanal = (medio: string) => SIM_OFFLINE_RE.test(medio);

export interface Curve {
  a: number; b: number;
  r2: number | null;
  n: number;                        // puntos usados
  method: "meses" | "promedio";
  confianza: "alta" | "media" | "baja";
}
export interface SimChannel {
  canal: string;
  offline: boolean;
  currentSpend: number;                          // inversión mensual promedio reciente
  current: Record<SimMetric, number>;            // resultado mensual promedio reciente
  curves: Partial<Record<SimMetric, Curve>>;     // sin curva = el medio no informa esa métrica
  mesesConDato: number;                          // meses (con inversión y performance) usados
}
export interface SimModel { channels: SimChannel[]; currency: string; meses: number; mesesLabel: string[]; nota: string[] }

/** Un mes (YYYY-MM) con el desglose por medio. */
export interface SimMesInput { mes: string; medios: Record<string, { inv: number; impr: number; alc: number; clic: number }> }

// ── Ajuste ──────────────────────────────────────────────────────────────────
/** Regresión log-log. Devuelve null si no hay puntos válidos. */
export function fitLogLog(pts: { x: number; y: number }[]): { a: number; b: number; r2: number; n: number } | null {
  const v = pts.filter((p) => p.x > 0 && p.y > 0 && Number.isFinite(p.x) && Number.isFinite(p.y));
  const n = v.length;
  if (n < 2) return null;
  const X = v.map((p) => Math.log(p.x)), Y = v.map((p) => Math.log(p.y));
  const mx = X.reduce((s, x) => s + x, 0) / n, my = Y.reduce((s, y) => s + y, 0) / n;
  let sxx = 0, sxy = 0, syy = 0;
  for (let i = 0; i < n; i++) { sxx += (X[i]! - mx) ** 2; sxy += (X[i]! - mx) * (Y[i]! - my); syy += (Y[i]! - my) ** 2; }
  if (sxx <= 1e-12) return null; // todos con la misma inversión: no se puede estimar la pendiente
  const b = sxy / sxx;
  const lnA = my - b * mx;
  const r2 = syy > 0 ? (sxy * sxy) / (sxx * syy) : 0;
  return { a: Math.exp(lnA), b, r2, n };
}

/** Curva de un medio/métrica: regresión si alcanza, si no promedio con decaimiento conservador. */
export function fitCurve(pts: { x: number; y: number }[]): Curve | null {
  const v = pts.filter((p) => p.x > 0 && p.y > 0);
  if (!v.length) return null;
  const f = v.length >= MIN_POINTS ? fitLogLog(v) : null;
  if (f && f.r2 >= MIN_R2 && f.b > 0) {
    const b = Math.min(B_MAX, Math.max(B_MIN, f.b));
    const clamped = b !== f.b;
    const confianza: Curve["confianza"] = !clamped && f.r2 >= 0.6 && f.n >= 6 ? "alta" : "media";
    // Re-estimar `a` con la b acotada (mismo centro geométrico de los datos).
    const n = v.length;
    const mx = v.reduce((s, p) => s + Math.log(p.x), 0) / n, my = v.reduce((s, p) => s + Math.log(p.y), 0) / n;
    return { a: Math.exp(my - b * mx), b, r2: f.r2, n: f.n, method: "meses", confianza };
  }
  // Promedio: y = a·x^b con b conservadora, anclada al promedio.
  const sx = v.reduce((s, p) => s + p.x, 0), sy = v.reduce((s, p) => s + p.y, 0);
  const xm = sx / v.length, ym = sy / v.length;
  return { a: ym / Math.pow(xm, DEFAULT_B), b: DEFAULT_B, r2: f ? f.r2 : null, n: v.length, method: "promedio", confianza: "baja" };
}

export const predict = (c: Curve, spend: number) => (spend > 0 ? c.a * Math.pow(spend, c.b) : 0);
export const marginal = (c: Curve, spend: number) => (spend > 0 ? c.a * c.b * Math.pow(spend, c.b - 1) : c.b >= 1 ? c.a : Number.POSITIVE_INFINITY);

/** Recalibra `a` para que la curva pase por (spend, value) — mantiene la forma (b). */
export function calibrate(c: Curve, spend: number, value: number): Curve {
  if (!(spend > 0) || !(value > 0)) return c;
  return { ...c, a: value / Math.pow(spend, c.b) };
}

// ── Entrada desde el modelo de Pauta de Drean ────────────────────────────────
// Alias de medios que OMD carga con nombres distintos según el mes (CLAUDE.md: Geo Mobile =
// "Medios directos" = Tap Tap, pauta geolocalizada) → un solo medio para que la curva tenga todos
// sus meses.
export const SIM_CANAL_ALIAS: Record<string, string> = { "Geo Mobile": "Geo Mobile (Tap Tap)", "Medios directos": "Geo Mobile (Tap Tap)" };

/** Convierte la salida de buildPautaMediosMensual (uno o varios años) a meses YYYY-MM. */
export function simMonthsFromPauta(...years: (PautaMesMedios | null)[][]): SimMesInput[] {
  const out: SimMesInput[] = [];
  for (const y of years) {
    for (const m of y) {
      if (!m) continue;
      const medios: SimMesInput["medios"] = {};
      for (const [k0, e] of Object.entries(m.medios)) {
        const k = SIM_CANAL_ALIAS[k0] ?? k0;
        const acc = medios[k] ?? { inv: 0, impr: 0, alc: 0, clic: 0 };
        acc.inv += e.inv; acc.impr += e.impr; acc.alc += e.alc; acc.clic += e.clic;
        medios[k] = acc;
      }
      out.push({ mes: m.iso.slice(0, 7), medios });
    }
  }
  return out.sort((a, b) => a.mes.localeCompare(b.mes));
}

const METRIC_OF: Record<SimMetric, "impr" | "alc" | "clic"> = { impresiones: "impr", alcance: "alc", clicks: "clic" };

/**
 * Arma el modelo desde los meses por medio (año en curso + anterior).
 * `recentMonths` = meses (con inversión) que definen el "hoy" (promedio mensual).
 */
export function buildSimModel(monthsIn: SimMesInput[], opts: { recentMonths?: number } = {}): SimModel {
  const recentN = opts.recentMonths ?? 3;
  const nota: string[] = [];
  const months = [...monthsIn]
    .filter((m) => Object.values(m.medios).some((e) => e.inv > 0))
    .sort((a, b) => a.mes.localeCompare(b.mes));
  const recent = months.slice(-recentN);
  if (!recent.length) nota.push("No hay meses cerrados con inversión: el simulador se arma con al menos un mes de pauta.");

  const canales = new Set<string>(months.flatMap((m) => Object.keys(m.medios)));
  const channels: SimChannel[] = [];
  const sinPerf: string[] = [];
  const sinReciente: string[] = [];
  for (const canal of canales) {
    const offline = isOfflineCanal(canal);
    const currentSpend = recent.reduce((s, m) => s + (m.medios[canal]?.inv ?? 0), 0) / Math.max(1, recent.length);
    if (!(currentSpend > 0)) { sinReciente.push(canal); continue; }
    // Meses del medio con inversión Y performance: los que sirven para la curva y la eficiencia.
    const withData = months.filter((m) => (m.medios[canal]?.inv ?? 0) > 0);
    if (recent.some((m) => (m.medios[canal]?.inv ?? 0) > 0 && !((m.medios[canal]?.impr ?? 0) > 0))) sinPerf.push(canal);
    const current = { impresiones: 0, alcance: 0, clicks: 0 } as Record<SimMetric, number>;
    const curves: SimChannel["curves"] = {};
    let used = 0;
    for (const { key } of SIM_METRICS) {
      if (offline && key !== "impresiones") continue; // offline: solo contactos
      const f = METRIC_OF[key];
      const pts = withData.map((m) => ({ x: m.medios[canal]!.inv, y: m.medios[canal]![f] })).filter((p) => p.x > 0 && p.y > 0);
      if (!pts.length) continue;
      // Eficiencia "de hoy": meses recientes con dato; si no hay, toda la historia del medio.
      const recPts = recent.map((m) => m.medios[canal]).filter((e): e is NonNullable<typeof e> => !!e && e.inv > 0 && e[f] > 0).map((e) => ({ x: e.inv, y: e[f] }));
      const base = recPts.length ? recPts : pts;
      const eff = base.reduce((s, p) => s + p.y, 0) / base.reduce((s, p) => s + p.x, 0);
      current[key] = eff * currentSpend;
      const raw = fitCurve(pts);
      if (!raw || !(current[key] > 0)) continue;
      curves[key] = calibrate(raw, currentSpend, current[key]);
      used = Math.max(used, pts.length);
    }
    channels.push({ canal, offline, currentSpend, current, curves, mesesConDato: used });
  }
  channels.sort((a, b) => Number(a.offline) - Number(b.offline) || b.currentSpend - a.currentSpend);
  if (channels.some((c) => Object.values(c.curves).some((k) => k?.confianza === "baja"))) nota.push("Con pocos meses la curva es aproximada: se usa la eficiencia promedio del medio con rendimientos decrecientes conservadores (b = 0,8).");
  if (channels.some((c) => c.offline)) nota.push("Medios offline (TV, OOH, DOOH, radio…): se proyectan contactos cuando están cargados; no tienen alcance ni clicks comparables.");
  if (channels.some((c) => c.offline && !c.curves.impresiones)) nota.push("Medios offline sin contactos cargados: su inversión entra al total pero no proyectan resultados.");
  if (sinPerf.length) nota.push(`Con inversión reciente y sin performance cargada en algún mes (${sinPerf.join(", ")}): se proyectan con su eficiencia de los meses con dato.`);
  if (sinReciente.length) nota.push(`Sin inversión en los últimos ${recent.length || recentN} meses (no se simulan): ${sinReciente.join(", ")}.`);
  return { channels, currency: "ARS", meses: recent.length, mesesLabel: recent.map((m) => m.mes), nota };
}

// ── Simulación ──────────────────────────────────────────────────────────────
export interface SimResult {
  byChannel: { canal: string; spend: number; values: Record<SimMetric, number | null>; base: Record<SimMetric, number | null> }[];
  total: { spend: number; values: Record<SimMetric, number>; base: Record<SimMetric, number>; baseSpend: number };
}

export function simulate(model: SimModel, alloc: Record<string, number>): SimResult {
  const byChannel: SimResult["byChannel"] = [];
  const tv = { impresiones: 0, alcance: 0, clicks: 0 }, tb = { impresiones: 0, alcance: 0, clicks: 0 };
  let spend = 0, baseSpend = 0;
  for (const ch of model.channels) {
    const s = Math.max(0, alloc[ch.canal] ?? ch.currentSpend);
    spend += s; baseSpend += ch.currentSpend;
    const values = { impresiones: null, alcance: null, clicks: null } as Record<SimMetric, number | null>;
    const base = { impresiones: null, alcance: null, clicks: null } as Record<SimMetric, number | null>;
    for (const { key } of SIM_METRICS) {
      const c = ch.curves[key];
      if (!c) continue;
      const v = predict(c, s), b = predict(c, ch.currentSpend);
      values[key] = v; base[key] = b;
      tv[key] += v; tb[key] += b;
    }
    byChannel.push({ canal: ch.canal, spend: s, values, base });
  }
  return { byChannel, total: { spend, values: tv, base: tb, baseSpend } };
}

export interface Bounds { min: number; max: number }
/** Topes por defecto: entre 50% y 200% de la inversión actual del medio. */
export function defaultBounds(model: SimModel, lo = 0.5, hi = 2): Record<string, Bounds> {
  const out: Record<string, Bounds> = {};
  for (const c of model.channels) out[c.canal] = { min: Math.round(c.currentSpend * lo), max: Math.round(c.currentSpend * hi) };
  return out;
}

/**
 * Reparte `total` entre los medios maximizando `metric` (greedy por retorno marginal, en
 * `steps` incrementos). Respeta min/max. Si los mínimos superan el total, se escalan.
 */
export function optimize(model: SimModel, total: number, metric: SimMetric, bounds: Record<string, Bounds>, steps = 400, keep?: Record<string, number>): Record<string, number> {
  // Con `keep`: los medios que NO informan la métrica (ej. TV sin contactos) quedan fijos en su
  // inversión actual y solo se reparte el resto — así no se les saca presupuesto "gratis".
  const fixed: Record<string, number> = {};
  if (keep) for (const c of model.channels) if (!c.curves[metric]) fixed[c.canal] = Math.max(0, Math.min(keep[c.canal] ?? 0, total));
  const fixedSum = Object.values(fixed).reduce((a, b) => a + b, 0);
  if (fixedSum > 0) {
    const rest = optimize({ ...model, channels: model.channels.filter((c) => !(c.canal in fixed)) }, Math.max(0, total - fixedSum), metric, bounds, steps);
    return { ...rest, ...fixed };
  }
  const chs = model.channels;
  const alloc: Record<string, number> = {};
  let minSum = 0;
  for (const c of chs) minSum += Math.max(0, bounds[c.canal]?.min ?? 0);
  const scale = minSum > total && minSum > 0 ? total / minSum : 1;
  for (const c of chs) alloc[c.canal] = Math.max(0, bounds[c.canal]?.min ?? 0) * scale;
  let left = total - chs.reduce((s, c) => s + (alloc[c.canal] ?? 0), 0);
  if (left <= 0) return alloc;
  const step = Math.max(total / steps, 1e-9);
  const EPS = 1e-9;
  const capOf = (canal: string) => bounds[canal]?.max ?? Number.POSITIVE_INFINITY;
  while (left > EPS) {
    const inc = Math.min(step, left);
    let best: string | null = null, bestGain = 0;
    for (const c of chs) {
      const cur = alloc[c.canal] ?? 0;
      const cap = capOf(c.canal);
      if (cur + EPS >= cap) continue;
      const curve = c.curves[metric];
      if (!curve) continue;
      const add = Math.min(inc, cap - cur);
      const gain = (predict(curve, cur + add) - predict(curve, cur)) / add;
      if (gain > bestGain) { bestGain = gain; best = c.canal; }
    }
    if (!best) {
      // Ningún medio con esa métrica tiene lugar: el resto va parejo a los que tienen cupo.
      const open = chs.filter((c) => (alloc[c.canal] ?? 0) < capOf(c.canal) - EPS);
      if (!open.length) break;
      const each = left / open.length;
      for (const c of open) { const add = Math.min(each, capOf(c.canal) - (alloc[c.canal] ?? 0)); alloc[c.canal] = (alloc[c.canal] ?? 0) + add; left -= add; }
      if (open.every((c) => (alloc[c.canal] ?? 0) >= capOf(c.canal) - EPS)) break;
      continue;
    }
    const add = Math.min(inc, capOf(best) - (alloc[best] ?? 0));
    alloc[best] = (alloc[best] ?? 0) + add; left -= add;
  }
  return alloc;
}

/** Reescala una asignación para que sume `total` (modo "presupuesto total fijo"). */
export function rescaleTo(alloc: Record<string, number>, total: number, changed?: string): Record<string, number> {
  const keys = Object.keys(alloc);
  if (!changed || !(changed in alloc)) {
    const s = keys.reduce((a, k) => a + (alloc[k] ?? 0), 0) || 1;
    return Object.fromEntries(keys.map((k) => [k, ((alloc[k] ?? 0) / s) * total]));
  }
  const fixed = Math.min(total, Math.max(0, alloc[changed] ?? 0));
  const others = keys.filter((k) => k !== changed);
  const so = others.reduce((a, k) => a + (alloc[k] ?? 0), 0);
  const rest = total - fixed;
  const out: Record<string, number> = { [changed]: fixed };
  for (const k of others) out[k] = so > 0 ? ((alloc[k] ?? 0) / so) * rest : rest / Math.max(1, others.length);
  return out;
}

/** Costo por unidad (CPM / CPC / costo cada 1.000 personas). */
export function costPer(metric: SimMetric, spend: number, value: number | null): number | null {
  const m = SIM_METRICS.find((x) => x.key === metric)!;
  return value && value > 0 ? (spend / value) * m.costPer : null;
}

// ── Proyección de demanda (búsquedas genéricas de la categoría) ─────────────
export interface DemandPoint { mes: string; v: number }
/**
 * Proyección simple y explicable de los próximos `h` meses:
 *  · ≥ 12 meses: estacionalidad (mismo mes del año anterior) × tendencia (últimos 3 meses vs los
 *    mismos 3 meses del año anterior, si hay 15+ meses; si no, sin ajuste de tendencia).
 *  · 3 a 11 meses: promedio de los últimos 3 meses.
 */
export function forecastDemand(series: DemandPoint[], h = 3): { puntos: DemandPoint[]; metodo: string } {
  const s = [...series].filter((p) => Number.isFinite(p.v)).sort((a, b) => a.mes.localeCompare(b.mes));
  if (s.length < 3) return { puntos: [], metodo: "sin datos suficientes" };
  const nextMes = (ym: string, k: number) => { const [y, m] = ym.split("-").map(Number); const d = new Date(Date.UTC(y!, m! - 1 + k, 1)); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`; };
  const last = s[s.length - 1]!.mes;
  const byMes = new Map(s.map((p) => [p.mes, p.v]));
  if (s.length >= 12) {
    let trend = 1, metodo = "estacionalidad del último año";
    if (s.length >= 15) {
      const rec = s.slice(-3).reduce((a, p) => a + p.v, 0);
      const ago = s.slice(-15, -12).reduce((a, p) => a + p.v, 0);
      if (ago > 0) { trend = Math.min(2, Math.max(0.5, rec / ago)); metodo = "estacionalidad del último año × tendencia interanual"; }
    }
    const puntos: DemandPoint[] = [];
    for (let k = 1; k <= h; k++) {
      const mes = nextMes(last, k);
      const base = byMes.get(nextMes(mes, -12));
      if (base == null) break;
      puntos.push({ mes, v: Math.round(base * trend) });
    }
    if (puntos.length) return { puntos, metodo };
  }
  const avg = s.slice(-3).reduce((a, p) => a + p.v, 0) / 3;
  return { puntos: Array.from({ length: h }, (_, i) => ({ mes: nextMes(last, i + 1), v: Math.round(avg) })), metodo: "promedio de los últimos 3 meses" };
}
