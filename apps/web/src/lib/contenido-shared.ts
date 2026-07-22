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

// Lineamientos de CÓMO mostrar el producto en el espacio (en inglés, van al
// prompt de la escena). Evita errores típicos: cocina flotando o sobre la
// mesada en vez de apoyada en el piso y al ras de los muebles.
export const PLACEMENT_GUIDE: Record<string, string> = {
  cocinas:
    "The stove/range is a FREESTANDING kitchen range STANDING ON THE FLOOR, positioned flush and built-in between lower kitchen cabinets and countertops that are at the SAME HEIGHT as the cooktop surface (seamless built-in look). The kitchen floor is visible at its base and its feet rest on the floor. NEVER place the stove on top of a countertop, table or island, and never make it float. Front 3/4 view at natural eye level.",
  heladeras:
    "The refrigerator STANDS ON THE FLOOR against a kitchen wall, flush and aligned with the surrounding cabinetry, its base resting on the floor. Doors closed. Front 3/4 view at natural eye level. Never floating or on top of furniture.",
  lavarropas:
    "The washing machine STANDS ON THE FLOOR in a laundry or kitchen area, flush with the surrounding cabinetry or against the wall, base resting on the floor. Front view at natural eye level. Never floating or on a counter.",
  porfolio:
    "The appliance rests naturally on the floor of a real home environment, flush and aligned with the surrounding furniture, at natural eye level. Never floating or on top of a counter.",
};

export function placementGuide(v: string): string {
  return PLACEMENT_GUIDE[v] ?? PLACEMENT_GUIDE.porfolio ?? "";
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
