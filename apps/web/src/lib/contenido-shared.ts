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
  refImages?: string[]; // URLs de posts reales de la marca (referencia de estilo fija)
}

// Código visual TRANSVERSAL de Drean (va en TODOS los estilos). La marca es
// OSCURA, CÁLIDA, low-key y cinematográfica — NO clara/aireada/stock.
// Estética Drean FIJA (se aplica en todas las piezas, sin referencias externas).
export const BRAND_LOOK =
  "DREAN PREMIUM AESTHETIC (mandatory, consistent in EVERY image): a sophisticated, minimalist, warm and moody editorial look. " +
  "ENVIRONMENTS: clean, uncluttered minimalist modern kitchens and homes with generous negative space. " +
  "MATERIALS & FURNITURE: rich dark walnut and oak wood cabinetry (often vertical wood-slat panels), veined dark marble or natural stone countertops and backsplash, matte black details, brushed stainless steel. Handleless, high-end, seamless cabinetry. " +
  "TONES: warm dark browns, walnut, graphite and muted earthy tones, high contrast. " +
  "LIGHT: dramatic, warm directional lighting WITH a soft warm AMBIENT/FILL so the whole scene is comfortably lit — the product is the brightest, clearly and warmly lit hero (well exposed, full detail), and the environment and background stay clearly VISIBLE and readable in warm light. Moody but NOT dark: never black, murky or crushed. Amber/tungsten temperature, cinematic and premium. " +
  "STRICTLY AVOID: bright, airy, washed-out, overexposed, flat or cold white daylight; pale, pastel or white flat scenes; cluttered or generic stock-photo looks; and also crushed/underexposed too-dark images where the product loses detail. " +
  "Every image must feel warm, dark, premium, minimalist and cinematic.";

export const ESTILOS: Estilo[] = [
  {
    v: "cocina_calida",
    label: "Cocina cálida premium",
    producto: "hero",
    personasDefault: false,
    treatment:
      "Dark, moody, warm premium modern kitchen with the appliance as the hero. Deep walnut/dark oak wood — vertical wood-slat paneling and cabinetry — with veined dark marble/stone backsplash; stainless steel with dark glass. The kitchen is dimly and warmly lit, the appliance is the lit hero while the rest of the kitchen falls into rich shadow. Dramatic warm directional light, cinematic and low-key, high contrast. Composition: appliance built-in and flush with the cabinetry, eye level, front or slight 3/4 view, prominent. Sophisticated, aspirational, intimate.",
  },
  {
    v: "experiencia_uso",
    label: "Experiencia de uso",
    producto: "contextual",
    personasDefault: true,
    treatment:
      "Candid lifestyle scene in a DARK, warm, cozy modern home, focused on PEOPLE and emotion — a family, friends or an individual genuinely enjoying home life (relaxing, celebrating, together). The Drean appliance appears naturally in the environment, contextual rather than hero. Deep walnut wood paneling and warm dark interiors, warm lamplight and pools of warm light, rich shadows. The people are warmly lit against darker surroundings. Low-key, cinematic, intimate, high contrast — NOT bright daylight. Candid medium/wide shot capturing a real human moment, warm and emotional. Mood: warmth, comfort, belonging.",
  },
  {
    v: "porfolio_superior",
    label: "Porfolio Superior",
    producto: "hero",
    personasDefault: false,
    treatment:
      "Premium studio product showcase on an abstract, non-home background. Very dark gradient studio backdrop (near-black graphite/charcoal with warm undertone), glossy dark reflective floor, sometimes a circular pedestal — no home context. Dramatic low-key studio lighting with crisp warm rim/edge highlights on the stainless steel, deep shadows, high contrast, cinematic. Composition: appliance centered and hero, orderly and symmetrical, front or slight 3/4, clean dark negative space for a headline. Mood: premium, technological, authoritative, flagship.",
  },
  {
    v: "funciones_especiales",
    label: "Funciones especiales",
    producto: "contextual", // macro/detalle: se genera la escena, no el packshot completo
    personasDefault: false,
    treatment:
      "Feature spotlight: a macro / tight product-detail shot highlighting ONE specific function of the appliance — an extreme close-up of a control panel or digital display with glowing LED indicators, a technology detail, or the RESULT of the feature (e.g., an ice-cold condensation-covered drink, or perfectly cooked food inside a dark oven). Dark, dramatic, low-key macro product photography with a single focused warm light on the detail and deep shadows around it, shallow depth of field. Accurate materials (stainless steel, glass display, glowing LEDs). Cinematic, premium, technological, with clean dark negative space for a small callout.",
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
