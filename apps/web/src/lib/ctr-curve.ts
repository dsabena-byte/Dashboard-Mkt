// ============================================================================
// Curva de CTR orgánico por posición — MÓDULO ÚNICO (puro, client-safe, sin imports).
// Reemplaza las dos curvas viejas (ctrPos de lib/signals/seo.ts y ctrEsperado de
// lib/search-console-analysis.ts: 28/15/10/7/5…, tipo Sistrix 2020, pre-AI Overviews), que
// sobreestimaban los clics 1,4–2,5x en el top-3 (docs/estado-del-arte/seo-geo.md §4.0, gap G2).
//
// Fuente de la curva de referencia: Advanced Web Ranking (AWR), CTR study jul-2026, EE.UU.
// desktop, todas las intenciones — https://www.advancedwebranking.com/seo/organic-ctr
//   sin AI Overview: pos 1 20,0% · 2 10,4% · 3 3,9% · 4 1,7% · 5 1,1% · 6 0,7% · 7-10 ~0,5% · 11-20 ~0,6-0,8%
//   con AI Overview: pos 1 9,7% · 2 3,7% · 3 1,7% · 4 1,3% · 5 1,0%
// Ajustes propios (documentados): 11-20 se fija en 0,5% (la cifra de AWR 0,6-0,8% es mayor que
// la de 7-10 → se fuerza monotonía, lo conservador); >20 = 0,1%; el multiplicador de AIO para
// pos ≥ 6 (AWR no lo publica) se toma igual al de pos 5 (0,91).
// Hay mucha dispersión entre estudios (pos 1 entre 14,6% y 39,8%: realserp.com/ctr-by-position),
// por eso los clics estimados se muestran como RANGO (bajo–alto).
//
// Curva propia (§4.0 "preferida"): con Search Console conectado se calibra con el CTR real de las
// búsquedas NO de marca del cliente, por tramo de posición (1, 2, 3, 4-5, 6-10, 11-20), CTR
// ponderado por impresiones (Σclics/Σimpresiones) y suavizado isotónico (monótono decreciente).
// Un tramo sin datos suficientes (<CAL_MIN_QUERIES búsquedas con ≥CAL_MIN_IMPR impresiones) usa
// la referencia.
// ============================================================================

/** CTR (%) de referencia SIN AI Overview por posición entera 1..20 (índice 0 sin uso). */
export const CTR_REF_2026: readonly number[] = [0, 20.0, 10.4, 3.9, 1.7, 1.1, 0.7, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5];
/** CTR (%) de referencia CON AI Overview para las posiciones que publica AWR (1..5). */
export const CTR_AIO_2026: readonly number[] = [0, 9.7, 3.7, 1.7, 1.3, 1.0];
export const CTR_BEYOND_20 = 0.1;
export const CTR_FUENTE = "AWR jul-2026 (EE.UU. desktop)";

/** Multiplicador de AIO m(p) = CTR_con_AIO(p) / CTR_sin_AIO(p) (≥ 6 → el de pos 5). */
export function mAio(pos: number): number {
  const p = Math.min(5, Math.max(1, Math.round(pos)));
  return CTR_AIO_2026[p]! / CTR_REF_2026[p]!;
}

/** CTR (%) de referencia sin AIO, interpolado linealmente entre posiciones enteras. */
export function ctrRef(pos: number | null | undefined): number {
  if (pos == null || !Number.isFinite(pos)) return 0;
  if (pos <= 1) return CTR_REF_2026[1]!;
  if (pos > 20) return CTR_BEYOND_20;
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  return CTR_REF_2026[lo]! + (CTR_REF_2026[hi]! - CTR_REF_2026[lo]!) * (pos - lo);
}

// ── Curva propia (Search Console) ────────────────────────────────────────────
/** Tramos de posición y su "centro" (para interpolar). */
export const TRAMOS: readonly { desde: number; hasta: number; centro: number; label: string }[] = [
  { desde: 0, hasta: 1.5, centro: 1, label: "1" },
  { desde: 1.5, hasta: 2.5, centro: 2, label: "2" },
  { desde: 2.5, hasta: 3.5, centro: 3, label: "3" },
  { desde: 3.5, hasta: 5.5, centro: 4.5, label: "4-5" },
  { desde: 5.5, hasta: 10.5, centro: 8, label: "6-10" },
  { desde: 10.5, hasta: 20.5, centro: 15, label: "11-20" },
];
export const CAL_MIN_QUERIES = 15;  // búsquedas por tramo para confiar en el CTR propio
export const CAL_MIN_IMPR = 100;    // impresiones mínimas por búsqueda para entrar en la calibración

export interface CtrCurve {
  /** CTR (%) por tramo (mismo orden que TRAMOS), ya monótono decreciente. */
  tramos: number[];
  /** Origen de cada tramo. */
  fuente: ("propia" | "referencia")[];
  /** Búsquedas usadas por tramo. */
  n: number[];
  calibrada: boolean;
}

const refTramo = (i: number): number => {
  const t = TRAMOS[i];
  const ps: number[] = [];
  for (let p = Math.max(1, Math.ceil(t!.desde)); p <= Math.floor(t!.hasta); p++) ps.push(CTR_REF_2026[p]!);
  return ps.length ? ps.reduce((a, b) => a + b, 0) / ps.length : ctrRef(t!.centro);
};

/** Pool-adjacent-violators: regresión isotónica DECRECIENTE ponderada. */
export function isotonicDecreasing(vals: number[], weights: number[]): number[] {
  const blocks: { v: number; w: number; len: number }[] = [];
  vals.forEach((v, i) => {
    blocks.push({ v, w: Math.max(1e-9, weights[i] ?? 1), len: 1 });
    while (blocks.length >= 2 && blocks[blocks.length - 2]!.v < blocks[blocks.length - 1]!.v) {
      const b = blocks.pop()!, a = blocks.pop()!;
      const w = a.w + b.w;
      blocks.push({ v: (a.v * a.w + b.v * b.w) / w, w, len: a.len + b.len });
    }
  });
  return blocks.flatMap((b) => Array(b.len).fill(b.v) as number[]);
}

const normTxt = (s: string) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/**
 * Curva propia desde las búsquedas de Search Console (ctr en %, como ScRow). Excluye las de
 * marca (contienen ownBrand). Devuelve null si ningún tramo tiene datos suficientes.
 */
export function calibrateCtrCurve(
  queries: readonly { key: string; clicks: number; impressions: number; position: number }[] | null | undefined,
  opts: { ownBrand?: string | null; minQueries?: number; minImpr?: number } = {},
): CtrCurve | null {
  const minQ = opts.minQueries ?? CAL_MIN_QUERIES, minI = opts.minImpr ?? CAL_MIN_IMPR;
  const brand = normTxt(opts.ownBrand ?? "");
  const acc = TRAMOS.map(() => ({ c: 0, i: 0, n: 0 }));
  for (const q of queries ?? []) {
    if (!(q.impressions >= minI) || !Number.isFinite(q.position) || q.position > 20.5) continue;
    if (brand.length >= 3 && normTxt(q.key).includes(brand)) continue;
    const t = TRAMOS.findIndex((x) => q.position > x.desde && q.position <= x.hasta);
    if (t < 0) continue;
    acc[t]!.c += q.clicks; acc[t]!.i += q.impressions; acc[t]!.n++;
  }
  const fuente = acc.map((a) => (a.n >= minQ && a.i > 0 ? "propia" : "referencia") as "propia" | "referencia");
  if (!fuente.includes("propia")) return null;
  const raw = acc.map((a, i) => (fuente[i] === "propia" ? (a.c / a.i) * 100 : refTramo(i)));
  // Peso: impresiones reales en los tramos propios; la referencia pesa poco (cede ante el dato).
  const w = acc.map((a, i) => (fuente[i] === "propia" ? a.i : 1));
  return { tramos: isotonicDecreasing(raw, w), fuente, n: acc.map((a) => a.n), calibrada: true };
}

/** CTR (%) de una curva (propia) interpolando entre centros de tramo. */
export function ctrFromCurve(curve: CtrCurve, pos: number | null | undefined): number {
  if (pos == null || !Number.isFinite(pos)) return 0;
  const c = TRAMOS.map((t) => t.centro);
  if (pos <= c[0]!) return curve.tramos[0]!;
  if (pos > 20) return Math.min(CTR_BEYOND_20, curve.tramos[curve.tramos.length - 1]!);
  for (let i = 1; i < c.length; i++) {
    if (pos <= c[i]!) return curve.tramos[i - 1]! + (curve.tramos[i]! - curve.tramos[i - 1]!) * ((pos - c[i - 1]!) / (c[i]! - c[i - 1]!));
  }
  return curve.tramos[curve.tramos.length - 1]!;
}

// ── API de uso ───────────────────────────────────────────────────────────────
export interface CtrOpts {
  /** true = la SERP tiene AI Overview; false = no tiene; null/undefined = no se sabe. */
  aio?: boolean | null;
  /** Curva propia del cliente (calibrateCtrCurve); si falta, referencia AWR. */
  curve?: CtrCurve | null;
}
export interface Rango { bajo: number; medio: number; alto: number }

/** CTR puntual (%) = medio del rango. */
export function ctrAt(pos: number | null | undefined, opts: CtrOpts = {}): number {
  return ctrRange(pos, opts).medio;
}

/**
 * Rango de CTR (%) para una posición.
 *  · Referencia: AIO desconocido → [con AIO, sin AIO]; AIO sí → curva con AIO; AIO no → sin AIO.
 *  · Curva propia (ya mezcla SERPs con y sin AIO): AIO sí → [propia × m_AIO, propia]; si no → propia.
 */
export function ctrRange(pos: number | null | undefined, opts: CtrOpts = {}): Rango {
  if (pos == null || !Number.isFinite(pos)) return { bajo: 0, medio: 0, alto: 0 };
  const m = mAio(pos);
  let bajo: number, alto: number;
  if (opts.curve) {
    const own = ctrFromCurve(opts.curve, pos);
    bajo = opts.aio === true ? own * m : own; alto = own;
  } else {
    const base = ctrRef(pos);
    if (opts.aio === true) bajo = alto = base * m;
    else if (opts.aio === false) bajo = alto = base;
    else { bajo = base * m; alto = base; }
  }
  return { bajo, medio: (bajo + alto) / 2, alto };
}

/** Posición objetivo de un quick win (§4.1): top-3, o top-1 si ya está en 4-5. */
export const targetPos = (pos: number): number => (pos <= 5 ? 1 : 3);

/**
 * Clics/mes adicionales (rango) si una keyword pasa de `from` (null = no rankea) a `to`,
 * con volumen mensual `vol`. Nunca negativo.
 */
export function clicksGain(vol: number, from: number | null, to: number, opts: CtrOpts = {}): Rango {
  const a = ctrRange(to, opts);
  const b = from == null ? { bajo: 0, medio: 0, alto: 0 } : ctrRange(from, opts);
  const g = (x: number, y: number) => Math.max(0, (vol * (x - y)) / 100);
  const bajo = g(a.bajo, b.bajo), alto = g(a.alto, b.alto);
  return { bajo: Math.min(bajo, alto), medio: g(a.medio, b.medio), alto: Math.max(bajo, alto) };
}

export const sumRango = (rs: Rango[]): Rango => rs.reduce((s, r) => ({ bajo: s.bajo + r.bajo, medio: s.medio + r.medio, alto: s.alto + r.alto }), { bajo: 0, medio: 0, alto: 0 });

/** "≈120–250" o "≈180" si el rango es angosto (<10%). */
export function fRango(r: Rango, fmt: (v: number) => string = (v) => String(Math.round(v))): string {
  if (r.alto <= 0) return "0";
  return r.alto - r.bajo <= Math.max(1, r.alto * 0.1) ? `≈${fmt(r.medio)}` : `≈${fmt(r.bajo)}–${fmt(r.alto)}`;
}
