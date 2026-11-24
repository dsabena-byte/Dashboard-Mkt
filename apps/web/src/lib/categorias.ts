// Categorías core del negocio y su peso ponderado (mix), compartido por el sistema
// de metas por categoría (objetivos de marca, Floor Share) y el rollup del Mapa.
// Peso: mix de Salud de Marca Kantar, ola nov-25 = nov-26 (LAV 62% · REFRI 35% · COCC 3%).

export const CATEGORIAS_CORE = ["Lavado", "Refrigeración", "Cocción"] as const;

export const CATEGORIA_PESOS: Record<string, number> = { Lavado: 62, Refrigeración: 35, Cocción: 3 };

// Normaliza los pesos a fracción (suma 1).
export function catPesoNorm(pesos: Record<string, number> = CATEGORIA_PESOS): Record<string, number> {
  const t = Object.values(pesos).reduce((a, b) => a + b, 0) || 1;
  const out: Record<string, number> = {};
  for (const [c, w] of Object.entries(pesos)) out[c] = w / t;
  return out;
}

// Agrega valores por categoría a un General ponderado (Σ cat × peso).
/** Floor Share: el general pondera cada categoría por las UNIDADES exhibidas (presencia en el piso), nunca por facturación. */
export function pesosPiso(o: { lavado: { total_units: number }; refri: { total_units: number }; coccion: { total_units: number } }): Record<string, number> {
  const w = { Lavado: o.lavado.total_units, Refrigeración: o.refri.total_units, Cocción: o.coccion.total_units };
  return w.Lavado + w.Refrigeración + w.Cocción > 0 ? w : { Lavado: 1, Refrigeración: 1, Cocción: 1 };
}

export function generalPonderado(porCat: Record<string, number | null | undefined>, pesos: Record<string, number> = CATEGORIA_PESOS): number | null {
  const norm = catPesoNorm(pesos);
  let sum = 0, any = false;
  for (const [cat, w] of Object.entries(norm)) {
    const v = porCat[cat];
    if (v != null) { sum += v * w; any = true; }
  }
  return any ? sum : null;
}
