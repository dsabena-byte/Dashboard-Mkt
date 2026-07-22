// Constantes/helpers de categorías de contenido. SIN "server-only": se usan
// tanto en la página (client) como en el endpoint (server).

// Categorías de producto (para elegir qué línea protagoniza la pieza y para
// priorizar referencias de estilo del mismo rubro).
export const CATEGORIAS = [
  { v: "porfolio", l: "Todo el porfolio", brief: "el porfolio Drean en general (lavado, refrigeración y cocción)" },
  { v: "lavarropas", l: "Lavarropas", brief: "lavarropas Drean (línea de lavado)", kw: /lavarrop|lavado|lava\b|secarrop|carga frontal|carga superior/i },
  { v: "heladeras", l: "Heladeras", brief: "heladeras Drean (línea de refrigeración)", kw: /heladera|refriger|freezer|no frost|fr[ií]o|nevera/i },
  { v: "cocinas", l: "Cocinas", brief: "cocinas Drean (línea de cocción)", kw: /cocina|cocci[oó]n|horno|anafe|hornalla/i },
] as const;
export type CategoriaKey = (typeof CATEGORIAS)[number]["v"];

export function categoriaBrief(v: string): string {
  return CATEGORIAS.find((c) => c.v === v)?.brief ?? CATEGORIAS[0].brief;
}

// Filtra posts por keyword de categoría (best-effort sobre el copy). Si el
// filtro deja muy pocos, devolvemos todos (la categoría es una preferencia,
// no un requisito duro — muchos posts no mencionan la línea en el texto).
export function filtrarPorCategoria<T extends { message: string | null }>(posts: T[], categoria: string): T[] {
  const cat = CATEGORIAS.find((c) => c.v === categoria);
  if (!cat || !("kw" in cat) || !cat.kw) return posts;
  const kw = cat.kw;
  const match = posts.filter((p) => kw.test(p.message ?? ""));
  return match.length >= 2 ? match : posts;
}
