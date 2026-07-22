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

// ---------------------------------------------------------------------------
// ESTILOS: tratamientos visuales FIJOS definidos con el equipo (no random).
// Cada estilo define el look (materiales, tonos, luz, composición) y cómo se
// trata el producto:
//   - producto: "hero"       → el producto es protagonista (packshot real vía
//                              Bria cuando se elige un modelo).
//   - producto: "contextual" → el producto aparece en la escena pero el foco
//                              son las personas/el momento (se genera en escena).
// ---------------------------------------------------------------------------
export interface Estilo {
  v: string;
  label: string;
  producto: "hero" | "contextual";
  personasDefault: boolean;
  treatment: string; // en inglés, va al prompt de imagen
}

export const ESTILOS: Estilo[] = [
  {
    v: "cocina_calida",
    label: "Cocina cálida premium",
    producto: "hero",
    personasDefault: false,
    treatment:
      "Warm premium modern kitchen with the appliance as the hero. Materials: rich natural walnut/oak wood (vertical wood-slat paneling and cabinetry) with veined marble/stone backsplash and warm wood countertops; stainless steel with dark glass. Palette: warm walnut browns, muted earthy tones, stainless grey — low-key, slightly moody. Lighting: soft warm directional light, the appliance is the well-lit hero while surroundings fall into gentle shadow, subtle window light, editorial premium mood. Composition: appliance built-in and flush with the cabinetry, eye level, front or slight 3/4 view, prominent within the kitchen. Sophisticated, aspirational, calm, homey.",
  },
  {
    v: "experiencia_uso",
    label: "Experiencia de uso",
    producto: "contextual",
    personasDefault: true,
    treatment:
      "Warm candid lifestyle scene in a cozy modern home, focused on PEOPLE and emotion — families, friends or individuals genuinely enjoying everyday home life (relaxing, celebrating, together). The Drean appliance appears naturally in the environment, contextual rather than hero. Cozy modern home with warm wood accents/paneling, soft sofas and textiles, warm lamps, large windows with soft natural daylight (sometimes a city view). Palette: warm beiges, soft browns, cozy neutrals, golden warm light. Soft natural warm window light, homey and inviting. Candid medium/wide shot capturing the human moment, authentic and relatable, not stiff. Mood: happiness, comfort, belonging, family warmth.",
  },
  {
    v: "porfolio_superior",
    label: "Porfolio Superior",
    producto: "hero",
    personasDefault: false,
    treatment:
      "Premium studio product showcase on an abstract, non-home background. Dark gradient studio backdrop (graphite/charcoal, subtle cool blue tint), glossy reflective floor, sometimes a circular podium/pedestal — no home context. Clean studio lighting with soft key and crisp rim/edge highlights on the stainless steel, subtle floor reflections, dramatic yet clean. Palette: dark premium graphite and silver/steel, cool neutral with subtle blue accents, high contrast. Composition: appliance centered and hero, orderly and symmetrical, front or slight 3/4, clean negative space for a headline. Mood: premium, technological, authoritative, flagship/portfolio.",
  },
  {
    v: "funciones_especiales",
    label: "Funciones especiales",
    producto: "contextual", // macro/detalle: se genera la escena, no el packshot completo
    personasDefault: false,
    treatment:
      "Feature spotlight: a macro / tight product-detail shot highlighting ONE specific function of the appliance — an extreme close-up of a control panel or digital display with LED indicators, a technology detail, or the RESULT of the feature (e.g., an ice-cold condensation-covered drink showing cooling power, or perfectly cooked food inside the oven). Composition: tight macro crop on the detail with shallow depth of field, the feature is the clear subject. Realistic crisp product photography with focused lighting that highlights the detail; accurate materials (stainless steel, glass display, LEDs). Clean technological demonstrative mood, with clean negative space for a small explanatory callout/label.",
  },
];

export function getEstilo(v: string | undefined | null): Estilo {
  return ESTILOS.find((e) => e.v === v) ?? ESTILOS[0]!;
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
