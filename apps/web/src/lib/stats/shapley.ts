// ============================================================================
// Descomposición de contribución por valores de SHAPLEY (D1 de objetivos-inteligencia.md). Puro.
//
// φ_i = Σ_{S ⊆ N∖{i}} |S|!(n−|S|−1)!/n! · [v(S ∪ {i}) − v(S)]
//  · Exacto por enumeración de subconjuntos hasta 14 jugadores (2^14 evaluaciones); con más,
//    Monte Carlo por permutaciones con PRNG con semilla (determinístico).
//  · Eficiencia: Σ φ_i = v(N) − v(∅) (lo que se reparte suma EXACTO el total).
//
// Aplicado al Seguimiento (rollup del Mapa):
//  · BRECHA: cuánto de "100% − cumplimiento del objetivo" explica cada KPI. Jugador = KPI; en v(S)
//    los KPIs de S toman su cumplimiento real y el resto "cumple" (100). El objetivo se promedia
//    renormalizando sobre los KPIs CON DATO (igual que el rollup), y un KPI sin dato no juega.
//  · VARIACIÓN: por qué el cumplimiento cambió entre dos meses. En v(S) los KPIs de S toman el valor
//    del mes nuevo y el resto el del mes anterior; entrar/salir de la cobertura (dato que aparece o
//    desaparece) hace el rollup NO lineal → ahí Shapley reparte la interacción de forma justa.
//  · Grupos (plan del catálogo = "categoría" del KPI): suma de los φ de sus KPIs.
// ============================================================================
import { mulberry32, seedDe } from "./prng";

export const SHAPLEY_EXACTO_MAX = 14;

/** Valores de Shapley de `n` jugadores para la función característica `v` (máscara de bits → valor). */
export function shapley(n: number, v: (miembros: boolean[]) => number, opts: { muestras?: number; seed?: number | string } = {}): number[] {
  const phi = new Array<number>(n).fill(0);
  if (n === 0) return phi;
  if (n <= SHAPLEY_EXACTO_MAX) {
    const total = 1 << n;
    const val = new Float64Array(total);
    const m = new Array<boolean>(n).fill(false);
    for (let mask = 0; mask < total; mask++) {
      for (let i = 0; i < n; i++) m[i] = (mask & (1 << i)) !== 0;
      val[mask] = v(m);
    }
    // Pesos |S|!(n−|S|−1)!/n! por tamaño.
    const fact = [1];
    for (let i = 1; i <= n; i++) fact.push(fact[i - 1]! * i);
    const w = Array.from({ length: n }, (_, s) => (fact[s]! * fact[n - s - 1]!) / fact[n]!);
    for (let mask = 0; mask < total; mask++) {
      let size = 0;
      for (let i = 0; i < n; i++) if (mask & (1 << i)) size++;
      for (let i = 0; i < n; i++) {
        if (mask & (1 << i)) continue;
        phi[i] = phi[i]! + w[size]! * (val[mask | (1 << i)]! - val[mask]!);
      }
    }
    return phi;
  }
  // Monte Carlo por permutaciones (antitéticas: cada permutación y su inversa).
  const K = Math.max(50, Math.floor(opts.muestras ?? 2000));
  const rng = mulberry32(seedDe(opts.seed ?? "bip-shapley"));
  const perm = Array.from({ length: n }, (_, i) => i);
  let cnt = 0;
  for (let k = 0; k < K; k++) {
    for (let i = n - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const t = perm[i]!; perm[i] = perm[j]!; perm[j] = t; }
    for (const orden of [perm, [...perm].reverse()]) {
      const m = new Array<boolean>(n).fill(false);
      let prev = v(m);
      for (const i of orden) { m[i] = true; const cur = v(m); phi[i] = phi[i]! + cur - prev; prev = cur; }
      cnt++;
    }
  }
  return phi.map((x) => x / cnt);
}

// ── Seguimiento: contribución a la brecha y a la variación del cumplimiento ──
export interface JugadorKpi {
  nombre: string;
  /** Plan del catálogo (Plan de Medios / Web / Redes / Mercado): agrupa en "categorías". */
  grupo?: string;
  /** Peso inbound en el objetivo (o peso estratégico si los jugadores son objetivos). */
  w: number;
  /** Cumplimiento actual (capado en 100 como el rollup). null = sin dato (no juega). */
  cumpl: number | null;
  /** Cumplimiento del período de comparación (para la variación). */
  cumplAntes?: number | null;
}

/** Rollup del Mapa: Σ w·c / Σ w sobre los que tienen dato (null si ninguno). */
export function rollupPonderado(items: { w: number; c: number | null }[]): number | null {
  let sw = 0, swc = 0;
  for (const { w, c } of items) if (c != null && w > 0) { sw += w; swc += w * c; }
  return sw > 0 ? swc / sw : null;
}

export interface AporteShapley { nombre: string; grupo: string | null; puntos: number; pctDelTotal: number | null }
export interface AporteGrupo { grupo: string; puntos: number; pctDelTotal: number | null; kpis: number }
export interface ContribucionShapley {
  /** Valor de referencia (100 = todo cumplido; o el cumplimiento del mes anterior). */
  desde: number;
  /** Valor actual. */
  hasta: number;
  /** hasta − desde (lo que se reparte). */
  total: number;
  aportes: AporteShapley[];
  grupos: AporteGrupo[];
  exacto: boolean;
}

const cap = (c: number | null | undefined) => (c == null || !Number.isFinite(c) ? null : Math.min(100, c));

function armar(jug: JugadorKpi[], phi: number[], desde: number, hasta: number, exacto: boolean): ContribucionShapley {
  const total = hasta - desde;
  const pct = (x: number) => (Math.abs(total) > 1e-9 ? (x / total) * 100 : null);
  const aportes = jug.map((j, i) => ({ nombre: j.nombre, grupo: j.grupo ?? null, puntos: phi[i]!, pctDelTotal: pct(phi[i]!) }))
    .sort((a, b) => a.puntos - b.puntos || a.nombre.localeCompare(b.nombre));
  const g = new Map<string, { p: number; k: number }>();
  for (const a of aportes) { const k = a.grupo ?? "Otros"; const x = g.get(k) ?? { p: 0, k: 0 }; x.p += a.puntos; x.k++; g.set(k, x); }
  const grupos = [...g.entries()].map(([grupo, x]) => ({ grupo, puntos: x.p, pctDelTotal: pct(x.p), kpis: x.k })).sort((a, b) => a.puntos - b.puntos);
  return { desde, hasta, total, aportes, grupos, exacto };
}

/**
 * ¿Qué KPI explica la BRECHA del objetivo? v(S) = rollup con los KPIs de S en su cumplimiento real
 * y el resto en 100. Σ aportes = cumplimiento − 100 (negativo = puntos que faltan). null sin dato.
 */
export function contribucionBrecha(jugadores: JugadorKpi[], opts: { seed?: string | number } = {}): ContribucionShapley | null {
  const jug = jugadores.filter((j) => j.w > 0 && cap(j.cumpl) != null);
  if (!jug.length) return null;
  const v = (m: boolean[]) => rollupPonderado(jug.map((j, i) => ({ w: j.w, c: m[i] ? cap(j.cumpl) : 100 }))) ?? 100;
  const phi = shapley(jug.length, v, { seed: opts.seed });
  return armar(jug, phi, 100, v(jug.map(() => true)), jug.length <= SHAPLEY_EXACTO_MAX);
}

/**
 * ¿Por qué cambió el cumplimiento del objetivo entre dos meses? v(S) = rollup con los KPIs de S en
 * su valor nuevo y el resto en el anterior (un KPI sin dato queda fuera de la cobertura en ese
 * estado). Σ aportes = hasta − desde. null si algún extremo no tiene dato.
 */
export function contribucionVariacion(jugadores: JugadorKpi[], opts: { seed?: string | number } = {}): ContribucionShapley | null {
  const jug = jugadores.filter((j) => j.w > 0 && (cap(j.cumpl) != null || cap(j.cumplAntes) != null));
  if (!jug.length) return null;
  const val = (m: boolean[]) => rollupPonderado(jug.map((j, i) => ({ w: j.w, c: m[i] ? cap(j.cumpl) : cap(j.cumplAntes) })));
  const desde = val(jug.map(() => false)), hasta = val(jug.map(() => true));
  if (desde == null || hasta == null) return null;
  // Un estado intermedio sin ningún KPI con dato no tiene rollup: se toma el valor de partida
  // (sin información no se atribuye movimiento).
  const phi = shapley(jug.length, (m) => val(m) ?? desde, { seed: opts.seed });
  return armar(jug, phi, desde, hasta, jug.length <= SHAPLEY_EXACTO_MAX);
}
