// PRNG con semilla (mulberry32) para que las simulaciones sean DETERMINÍSTICAS: mismo input →
// misma probabilidad en cada render, en el server y en el cliente. Puro, sin dependencias.

/** Generador uniforme [0,1) con semilla de 32 bits. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Semilla estable a partir de un texto (FNV-1a de 32 bits). */
export function seedDe(s: string | number): number {
  if (typeof s === "number") return s >>> 0;
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

/**
 * Matriz de uniformes COMPARTIDA (nSims × h). Usar la misma matriz para varios KPIs hace que, en
 * cada simulación, todos "sorteen" el mismo mes histórico de error cuando sus residuos están
 * alineados en el tiempo → se conserva la correlación entre KPIs (bootstrap por mes), en vez de
 * suponerlos independientes (lo que subestimaría la probabilidad de un objetivo).
 */
export interface Uniformes { nSims: number; h: number; u: Float64Array }
export function crearUniformes(seed: number | string, nSims = 2000, h = 24): Uniformes {
  const r = mulberry32(seedDe(seed));
  const u = new Float64Array(nSims * h);
  for (let i = 0; i < u.length; i++) u[i] = r();
  return { nSims, h, u };
}
