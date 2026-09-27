// ============================================================================
// Índices de MARCA / MERCADO (quick wins del estado del arte, docs/estado-del-arte/mercado-marca.md
// Fase 1). Núcleo PURO y client-safe (sin imports): lo usan /seo-search, /research/salud-marca y los
// tests (`npx tsx scripts/marca-indices.test.ts`).
//
//  1. ESoS (Excess Share of Search, Binet / IPA):
//       SoS_MA6(t) = promedio móvil de 6 meses del share of search propio (búsquedas de tu marca ÷
//                    búsquedas de las marcas del set).
//       ESoS(t)    = SoS_MA6(t) − SoM(t)   (SoM = share de mercado, año móvil si hay ≥12 meses)
//       ratio(t)   = SoS_MA6(t) ÷ SoM(t)
//     Lectura: ESoS > 0 sostenido 3+ meses → el share tiende a subir; < 0 → tiende a bajar.
//     Rezago: correlación cruzada SoS(t) ↔ SoM(t+k), k = 0…12, sobre las VARIACIONES mensuales
//     (primeras diferencias, para no leer la tendencia común como relación). Solo con ≥18 meses
//     alineados y ≥12 pares por rezago; si no, se muestra el benchmark de Binet sin cifra propia.
//
//  2. Significancia entre olas (tracking de marca): test z de dos proporciones independientes.
//       MoE(p, n) = 1,96·√(p(1−p)/n)             (margen de una ola)
//       MoE_Δ     = 1,96·√(p1(1−p1)/n1 + p2(1−p2)/n2)   (margen de la diferencia)
//     ▲▼ solo si |Δ| > MoE_Δ; si no, "dentro del margen de error (±x pp)". Solo para indicadores
//     en % (TOM, conocimiento, consideración, intención); los índices (poder, hélice) no aplican.
//
//  3. Salud digital de marca (índice compuesto 0–100, siempre activo, sin estudio pago):
//       Componentes por marca y mes: Share of Search, Share of engagement, Visibilidad en IA e
//       Índice de posición SEO (este último invertido: menor posición = mejor).
//       z_c(marca) = (x − media del set) ÷ desvío del set   (por componente y mes; ≥3 marcas)
//       Índice = 50 + 10 · promedio(z_c)  (escala T: 50 = promedio del set; ±10 = ±1 desvío),
//       acotado a 0–100, pesos IGUALES, mínimo 2 componentes con dato.
// ============================================================================

export interface MesValor { mes: string; valor: number }
const ym = (s: string) => String(s ?? "").slice(0, 7);
const r2 = (v: number) => Math.round(v * 100) / 100;
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/** Meses YYYY-MM consecutivos entre a y b (inclusive). */
export function monthRange(a: string, b: string): string[] {
  const out: string[] = [];
  let [y, m] = a.split("-").map(Number);
  const [yb, mb] = b.split("-").map(Number);
  let guard = 0;
  while ((y! < yb! || (y === yb && m! <= mb!)) && guard++ < 600) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m!++; if (m! > 12) { m = 1; y!++; }
  }
  return out;
}

export function pearson(x: number[], y: number[]): number | null {
  const n = Math.min(x.length, y.length);
  if (n < 3) return null;
  const mx = mean(x.slice(0, n)), my = mean(y.slice(0, n));
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { const dx = x[i]! - mx, dy = y[i]! - my; sxy += dx * dy; sxx += dx * dx; syy += dy * dy; }
  if (sxx === 0 || syy === 0) return null;
  return sxy / Math.sqrt(sxx * syy);
}

// ── 1. ESoS ──────────────────────────────────────────────────────────────────
export interface EsosPoint { mes: string; sos: number | null; sosMa: number | null; som: number | null; esos: number | null; ratio: number | null }
export interface EsosLag { lag: number; r: number; n: number }
export interface EsosResult {
  puntos: EsosPoint[];
  ultimo: EsosPoint | null;
  /** Meses consecutivos (hasta el último con dato) con el mismo signo de ESoS. */
  racha: number;
  lectura: "sube" | "baja" | "neutral" | null;
  lag: EsosLag | null;
  mesesAlineados: number;
  ventanaMa: number;
}

/** Promedio móvil de `w` meses (requiere al menos ceil(w/2) meses con dato dentro de la ventana). */
export function movingAverage(serie: MesValor[], w: number): Map<string, number> {
  const by = new Map(serie.map((s) => [ym(s.mes), s.valor]));
  const meses = [...by.keys()].sort();
  const out = new Map<string, number>();
  if (!meses.length) return out;
  const all = monthRange(meses[0]!, meses[meses.length - 1]!);
  for (let i = 0; i < all.length; i++) {
    if (!by.has(all[i]!)) continue;
    const win = all.slice(Math.max(0, i - w + 1), i + 1).map((k) => by.get(k)).filter((v): v is number => v != null);
    if (win.length >= Math.ceil(w / 2)) out.set(all[i]!, mean(win));
  }
  return out;
}

/**
 * Correlación cruzada: ¿el SoS de hoy anticipa el share de dentro de k meses? Usa variaciones
 * mensuales (Δ) para no confundir tendencias. Devuelve el rezago con mayor r POSITIVO.
 */
export function bestLag(sos: MesValor[], som: MesValor[], opts: { maxLag?: number; minMeses?: number; minPares?: number } = {}): { lag: EsosLag | null; alineados: number } {
  const maxLag = opts.maxLag ?? 12, minMeses = opts.minMeses ?? 18, minPares = opts.minPares ?? 12;
  const a = new Map(sos.map((s) => [ym(s.mes), s.valor]));
  const b = new Map(som.map((s) => [ym(s.mes), s.valor]));
  const alineados = [...a.keys()].filter((k) => b.has(k)).length;
  if (alineados < minMeses) return { lag: null, alineados };
  const keys = [...new Set([...a.keys(), ...b.keys()])].sort();
  const all = monthRange(keys[0]!, keys[keys.length - 1]!);
  const diff = (m: Map<string, number>) => {
    const d = new Map<string, number>();
    for (let i = 1; i < all.length; i++) { const p = m.get(all[i - 1]!), c = m.get(all[i]!); if (p != null && c != null) d.set(all[i]!, c - p); }
    return d;
  };
  const da = diff(a), db = diff(b);
  let best: EsosLag | null = null;
  for (let k = 0; k <= maxLag; k++) {
    const xs: number[] = [], ys: number[] = [];
    for (let i = 0; i + k < all.length; i++) { const x = da.get(all[i]!), y = db.get(all[i + k]!); if (x != null && y != null) { xs.push(x); ys.push(y); } }
    if (xs.length < minPares) continue;
    const r = pearson(xs, ys);
    if (r != null && r > 0 && (!best || r > best.r)) best = { lag: k, r: r2(r), n: xs.length };
  }
  return { lag: best && best.r >= 0.3 ? best : null, alineados };
}

export function computeEsos(sos: MesValor[], som: MesValor[], opts: { ma?: number; umbralPp?: number } = {}): EsosResult {
  const w = opts.ma ?? 6, umbral = opts.umbralPp ?? 0.5;
  const ma = movingAverage(sos, w);
  const sosBy = new Map(sos.map((s) => [ym(s.mes), s.valor]));
  const somBy = new Map(som.map((s) => [ym(s.mes), s.valor]));
  const keys = [...new Set([...sosBy.keys(), ...somBy.keys()])].sort();
  const puntos: EsosPoint[] = keys.map((mes) => {
    const sm = ma.get(mes) ?? null, so = somBy.get(mes) ?? null;
    return { mes, sos: sosBy.get(mes) ?? null, sosMa: sm, som: so, esos: sm != null && so != null ? r2(sm - so) : null, ratio: sm != null && so != null && so > 0 ? r2(sm / so) : null };
  });
  const con = puntos.filter((p) => p.esos != null);
  const ultimo = con[con.length - 1] ?? null;
  let racha = 0;
  if (ultimo) {
    const sign = Math.sign(ultimo.esos!);
    for (let i = con.length - 1; i >= 0 && Math.sign(con[i]!.esos!) === sign && sign !== 0; i--) racha++;
  }
  let lectura: EsosResult["lectura"] = null;
  if (ultimo) {
    if (racha >= 3 && ultimo.esos! >= umbral) lectura = "sube";
    else if (racha >= 3 && ultimo.esos! <= -umbral) lectura = "baja";
    else lectura = "neutral";
  }
  const { lag, alineados } = bestLag(sos, som);
  return { puntos, ultimo, racha, lectura, lag, mesesAlineados: alineados, ventanaMa: w };
}

// ── 2. Significancia entre olas ─────────────────────────────────────────────
/** Margen de error (pp, 95%) de un % medido con base n. */
export function moePct(pct: number, n: number): number | null {
  if (!(n > 0) || pct < 0 || pct > 100) return null;
  const p = pct / 100;
  return 1.96 * Math.sqrt((p * (1 - p)) / n) * 100;
}

export interface DiffSig { delta: number; moe: number; z: number; sig: boolean }
/** Test z de dos proporciones independientes (valores en %, bases n1/n2). null si falta la base. */
export function diffSignificance(pct1: number, n1: number | null | undefined, pct2: number, n2: number | null | undefined): DiffSig | null {
  if (n1 == null || n2 == null || !(n1 > 0) || !(n2 > 0)) return null;
  if (pct1 < 0 || pct1 > 100 || pct2 < 0 || pct2 > 100) return null;
  const p1 = pct1 / 100, p2 = pct2 / 100;
  const se = Math.sqrt((p1 * (1 - p1)) / n1 + (p2 * (1 - p2)) / n2);
  const delta = pct2 - pct1;
  if (se === 0) return { delta, moe: 0, z: delta === 0 ? 0 : Infinity, sig: delta !== 0 };
  const moe = 1.96 * se * 100;
  const z = (p2 - p1) / se;
  return { delta, moe, z, sig: Math.abs(z) > 1.96 };
}

// ── 3. Salud digital de marca ───────────────────────────────────────────────
export type ComponenteDigital = "sos" | "soe" | "ia" | "serp";
export const COMPONENTE_LABEL: Record<ComponenteDigital, string> = {
  sos: "Share of Search", soe: "Share of engagement", ia: "Visibilidad en IA", serp: "Posición en Google",
};
/** true = menor es mejor (se invierte el z). */
const INVERTIDO: Record<ComponenteDigital, boolean> = { sos: false, soe: false, ia: false, serp: true };

export interface ObsDigital { mes: string; marca: string; componente: ComponenteDigital; valor: number }
export interface IndiceMarca { marca: string; own: boolean; indice: number; z: Partial<Record<ComponenteDigital, number>>; valores: Partial<Record<ComponenteDigital, number>>; componentes: number }
export interface IndiceMes { mes: string; marcas: IndiceMarca[]; componentes: ComponenteDigital[] }
export interface SaludDigital {
  meses: IndiceMes[];            // ordenados asc, solo meses con índice propio
  ultimo: IndiceMes | null;
  own: IndiceMarca | null;
  prev: IndiceMarca | null;      // tu índice el mes anterior con dato
  rank: number | null;
  serie: { mes: string; indice: number }[]; // tu índice por mes
}

const normBrand = (s: string) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

/**
 * Índice compuesto por mes. `obs` = observaciones (una por marca/componente/mes; si hay varias se
 * promedian). Por componente y mes hacen falta ≥3 marcas y desvío > 0; por marca, ≥2 componentes.
 */
export function saludDigital(obs: ObsDigital[], ownBrand: string | null, opts: { minMarcas?: number; minComponentes?: number } = {}): SaludDigital {
  const minM = opts.minMarcas ?? 3, minC = opts.minComponentes ?? 2;
  const ownK = ownBrand ? normBrand(ownBrand) : null;
  const display = new Map<string, string>();
  const acc = new Map<string, { s: number; n: number }>(); // mes|comp|marcaK
  for (const o of obs) {
    if (!Number.isFinite(o.valor)) continue;
    const k = normBrand(o.marca); if (!k) continue;
    if (!display.has(k) || k === ownK) display.set(k, o.marca);
    const key = `${ym(o.mes)}|${o.componente}|${k}`;
    const e = acc.get(key) ?? { s: 0, n: 0 }; e.s += o.valor; e.n++; acc.set(key, e);
  }
  const byMes = new Map<string, Map<ComponenteDigital, Map<string, number>>>();
  for (const [key, e] of acc) {
    const [mes, comp, k] = key.split("|") as [string, ComponenteDigital, string];
    const mm = byMes.get(mes) ?? new Map(); byMes.set(mes, mm);
    const cm = mm.get(comp) ?? new Map<string, number>(); mm.set(comp, cm);
    cm.set(k, e.s / e.n);
  }
  const meses: IndiceMes[] = [];
  for (const mes of [...byMes.keys()].sort()) {
    const comps = byMes.get(mes)!;
    const zBy = new Map<string, Partial<Record<ComponenteDigital, number>>>();
    const vBy = new Map<string, Partial<Record<ComponenteDigital, number>>>();
    const usados: ComponenteDigital[] = [];
    for (const [comp, cm] of comps) {
      const vals = [...cm.values()];
      if (vals.length < minM) continue;
      const mu = mean(vals);
      const sd = Math.sqrt(mean(vals.map((v) => (v - mu) ** 2)));
      if (!(sd > 0)) continue;
      usados.push(comp);
      for (const [k, v] of cm) {
        const z = ((v - mu) / sd) * (INVERTIDO[comp] ? -1 : 1);
        zBy.set(k, { ...(zBy.get(k) ?? {}), [comp]: z });
        vBy.set(k, { ...(vBy.get(k) ?? {}), [comp]: v });
      }
    }
    const marcas: IndiceMarca[] = [];
    for (const [k, zs] of zBy) {
      const zv = Object.values(zs) as number[];
      if (zv.length < minC) continue;
      const indice = Math.max(0, Math.min(100, 50 + 10 * mean(zv)));
      marcas.push({ marca: display.get(k) ?? k, own: k === ownK, indice: r2(indice), z: zs, valores: vBy.get(k) ?? {}, componentes: zv.length });
    }
    marcas.sort((a, b) => b.indice - a.indice);
    if (marcas.length >= minM && marcas.some((m) => m.own)) meses.push({ mes, marcas, componentes: usados.sort() });
  }
  // Mes de referencia: entre los últimos 3 con índice, el que tiene MÁS componentes (empate → el más
  // reciente). Evita que el mes en curso — con solo la foto de IA/SEO y sin búsquedas cerradas —
  // pise a un mes completo.
  const tail = meses.slice(-3);
  const ultimo = tail.reduce<IndiceMes | null>((b, m) => (!b || m.componentes.length >= b.componentes.length ? m : b), null);
  const own = ultimo?.marcas.find((m) => m.own) ?? null;
  const ui = ultimo ? meses.indexOf(ultimo) : -1;
  const prevMes = ui >= 1 ? meses[ui - 1] : null;
  const prev = prevMes?.marcas.find((m) => m.own) ?? null;
  const rank = own && ultimo ? ultimo.marcas.indexOf(own) + 1 : null;
  const serie = meses.map((m) => ({ mes: m.mes, indice: m.marcas.find((x) => x.own)!.indice }));
  return { meses, ultimo, own, prev, rank, serie };
}

/** Lectura corta del índice propio (para la card y el chat). */
export function lecturaIndice(own: IndiceMarca | null): string {
  if (!own) return "Sin datos suficientes";
  const v = own.indice;
  if (v >= 60) return "Muy por encima del set";
  if (v >= 53) return "Por encima del set";
  if (v > 47) return "En el promedio del set";
  if (v > 40) return "Por debajo del set";
  return "Muy por debajo del set";
}
