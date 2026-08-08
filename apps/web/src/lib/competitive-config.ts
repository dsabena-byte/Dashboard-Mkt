// Configuración del dashboard de Inteligencia Competitiva (demanda + SEO).
// Set competitivo de electrodomésticos en Argentina. La demanda (Módulo A) entra
// por keywords calificadas por categoría — NUNCA por la marca "pelada", que trae
// ruido de otras categorías (validado: "samsung" daba 86 vs Drean 10, mientras
// que "lavarropas samsung" = 14.800 vs "lavarropas drean" = 33.100).
//
// Las marcas se definen POR CATEGORÍA (CATEGORIA_MARCAS): el set de cocinas no es
// el mismo que el de lavarropas/heladeras (ej. Escorial/Florencia/Orbis compiten
// en cocinas pero no en lavado).

export const LOCATION_CODE_AR = 2032; // Argentina (DataForSEO)
export const LANGUAGE_CODE_ES = "es";

export type Categoria = "lavarropas" | "heladeras" | "cocinas";

// Término de búsqueda base por categoría (singular, como lo busca la gente).
export const CATEGORIA_TERMINO: Record<Categoria, string> = {
  lavarropas: "lavarropas",
  heladeras: "heladera",
  cocinas: "cocina",
};

export const CATEGORIAS: Categoria[] = ["lavarropas", "heladeras", "cocinas"];

export interface Marca {
  nombre: string;
  slug: string;   // minúsculas, para armar keywords ("drean", "escorial", ...)
  dominio: string; // para el Módulo B (SEO); se confirma contra data real
  emergente?: boolean;
}

// Registro de todas las marcas del set (unión de todas las categorías).
export const MARCAS: Marca[] = [
  { nombre: "Drean", slug: "drean", dominio: "drean.com.ar" },
  { nombre: "Whirlpool", slug: "whirlpool", dominio: "whirlpool.com.ar" },
  { nombre: "Electrolux", slug: "electrolux", dominio: "electrolux.com.ar" },
  { nombre: "Samsung", slug: "samsung", dominio: "samsung.com/ar" },
  { nombre: "LG", slug: "lg", dominio: "lg.com/ar" },
  { nombre: "BGH", slug: "bgh", dominio: "bgh.com.ar" },
  { nombre: "Gafa", slug: "gafa", dominio: "gafa.com.ar" },
  { nombre: "Philco", slug: "philco", dominio: "philco.com.ar" },
  { nombre: "Hisense", slug: "hisense", dominio: "hisense.com.ar", emergente: true },
  { nombre: "Midea", slug: "midea", dominio: "midea.com.ar", emergente: true },
  // Marcas de cocinas (mercado argentino tradicional):
  { nombre: "Escorial", slug: "escorial", dominio: "escorial.com.ar" },
  { nombre: "Florencia", slug: "florencia", dominio: "florencia.com.ar" },
  { nombre: "Orbis", slug: "orbis", dominio: "orbis.com.ar" },
];

const BY_SLUG: Record<string, Marca> = Object.fromEntries(MARCAS.map((m) => [m.slug, m]));

// Marcas que compiten en cada categoría (por slug).
export const CATEGORIA_MARCAS: Record<Categoria, string[]> = {
  lavarropas: ["drean", "whirlpool", "electrolux", "samsung", "lg", "bgh", "gafa", "philco", "hisense", "midea"],
  heladeras: ["drean", "whirlpool", "electrolux", "samsung", "lg", "bgh", "gafa", "philco", "hisense", "midea"],
  cocinas: ["drean", "whirlpool", "electrolux", "samsung", "gafa", "philco", "escorial", "florencia", "orbis"],
};

// Nombres de marca (display) de una categoría, en orden de config.
export function marcasDeCategoria(cat: Categoria): string[] {
  return (CATEGORIA_MARCAS[cat] ?? []).map((s) => BY_SLUG[s]?.nombre ?? s);
}

export interface KeywordDef {
  keyword: string;
  marca: string | null; // null = genérico de categoría
  categoria: Categoria;
  generico: boolean;
}

// Universo de keywords para el Módulo A (demanda / Share of Search):
//  - genérica por categoría: "lavarropas", "heladera", "cocina"
//  - de marca × categoría (solo las marcas que compiten en esa categoría).
// Forma canónica: "{termino} {marca}" (validado: la de mayor volumen real).
export function buildKeywordUniverse(): KeywordDef[] {
  const out: KeywordDef[] = [];
  for (const cat of CATEGORIAS) {
    const termino = CATEGORIA_TERMINO[cat];
    out.push({ keyword: termino, marca: null, categoria: cat, generico: true });
    for (const slug of CATEGORIA_MARCAS[cat] ?? []) {
      const m = BY_SLUG[slug];
      if (!m) continue;
      out.push({ keyword: `${termino} ${m.slug}`, marca: m.nombre, categoria: cat, generico: false });
    }
  }
  return out;
}
