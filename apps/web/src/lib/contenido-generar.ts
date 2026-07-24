import "server-only";
import { getTopByPilar, PILARES, CATEGORIAS, categoriaBrief, filtrarPorCategoria } from "@/lib/contenido-queries";
import { BRAND_LOOK } from "@/lib/contenido-shared";
import { getModelo, getModelos, driveImageUrl } from "@/lib/producto-catalog";
import { falImage, FAL_SIZES, type FalSizeKey } from "@/lib/fal-client";

// Generación de piezas de contenido (brief OpenAI + imagen fal). Extraído del
// endpoint /api/generar-contenido para que lo reuse también el calendario.

const PILAR_DEF: Record<string, string> = {
  "Liderazgo marca/porfolio": "Liderazgo, portfolio único, superioridad/premium tangible, tecnología propia.",
  "Calidad superior": "Calidad como evidencia; durabilidad y calidad que se siente (‘toda tu vida’).",
  "Respaldo Posventa": "Servicio, garantía, red de posventa, tranquilidad de estar respaldado.",
  "Elegir bien": "Ayuda a decidir la compra correcta; comparativas, guías, tips prácticos.",
  "Experiencia uso": "La vida cotidiana con el producto; usos reales, beneficios en el día a día.",
};

const MODEL_IDEOGRAM = "fal-ai/ideogram/v3";
// Modo "producto real": edición por referencia con el packshot real. Nano Banana
// (Gemini 2.5 Flash Image edit). Alternativa: "fal-ai/gemini-25-flash-image/edit".
const MODEL_EDIT = "fal-ai/nano-banana/edit";
export const MAX_PIEZAS = 4;

const NO_TEXT = "CRITICAL: do NOT render any text, letters, words, captions, logos, brand names, watermarks or signage anywhere in the image. Clean image with no typography.";
const PERSONAS_ON = "REQUIRED — this is a LIFESTYLE scene with PEOPLE, not an empty product shot: real people (a person or a family) are PROMINENTLY visible in the foreground as the MAIN SUBJECT, large in frame, actively USING and interacting with the Drean appliance (loading the washing machine, cooking on the range, taking food from the fridge). Candid, authentic, natural skin and expressions. The people MUST be clearly present and central. The whole scene is warmly but CLEARLY and BRIGHTLY lit (not dark, dim or gloomy), and the Drean appliance is well-lit, bright and clearly visible — never lost in shadow.";

const MINIMAL =
  "MINIMALIST and premium: a clean, uncluttered scene with generous negative space. There is ONLY ONE appliance in the entire image — the product itself. ABSOLUTELY NO other appliances (no second refrigerator, oven, microwave, range, dishwasher or washing machine) and no extra products. Very few props, only elements that complement the message. Do NOT overcrowd the scene.";

const PORFOLIO_SCENE =
  "DREAN LINEUP SHOWCASE: this is a BRAND / portfolio piece, NOT a single-product shot. Feature SEVERAL Drean appliances together in one cohesive premium home — a tall stainless refrigerator, a kitchen range/cooktop and a front-load washing machine — arranged tastefully, built-in and coordinated. Show the range of products together (do NOT show only one appliance). Clean, premium, uncluttered composition.";

const PROPORCION: Record<string, string> = {
  cocinas:
    "PROPORTIONS: the range is a COUNTER-HEIGHT appliance — its top edge is level and FLUSH with a continuous countertop that runs along both sides at the SAME height. Not taller than the counter.",
  lavarropas:
    "PROPORTIONS: the front-load washing machine is a COUNTER-HEIGHT appliance — its top edge is level and FLUSH with a continuous countertop that runs along both sides at the SAME height. Not taller than the counter.",
  heladeras:
    "PROPORTIONS: the refrigerator is a TALL floor-standing appliance, clearly TALLER than the surrounding countertops; it is built into a TALL cabinet column and flanked on both sides by tall cabinetry of the SAME height as the fridge, forming one seamless built-in column. It is NOT counter-height — it must be a large, prominent, tall appliance at realistic human scale.",
  porfolio:
    "PROPORTIONS: the appliance is integrated built-in at its correct real-world height, prominent and realistically scaled.",
};

const ACABADO: Record<string, string> = {
  heladeras:
    "FINISH: the refrigerator's stainless steel is MIRROR-POLISHED and highly reflective — glossy, luminous metal with bright specular highlights and clear streaks/glints of warm light gliding across the whole door, a lively metallic shine that visibly reflects the light. NEVER opaque, matte, flat, grey, dark or muddy.",
  cocinas:
    "FINISH: the stainless-steel range is BRIGHT and glossy — clean specular highlights on the steel front, oven door and control panel, the metal shines and clearly reflects the warm light, well-lit and legible. Not dark, matte or flat.",
  lavarropas:
    "FINISH: the graphite/dark-grey washer is clearly LIFTED OUT OF SHADOW and well-lit — bright enough to read easily, with a clear warm rim/edge light on its body and STRONG glossy specular highlights on the chrome door ring and round glass door; the control panel is legible. Never black, flat, matte or lost in shadow.",
  porfolio:
    "FINISH: the Drean appliances are BRIGHT and glossy, their stainless steel and glass catching clean specular highlights and clearly reflecting the warm light — never dull, matte, dark or muddy.",
};

// Estética para contenido CREATIVO/editorial (efemérides, trending, beneficio,
// disruptivo). Sale de la cocina y del producto-hero, PERO mantiene consistencia
// de marca (freno): premium, cohesivo, argentino, cálido, humano — no "stock".
const BRAND_CREATIVE =
  "DREAN BRAND — editorial/creative look (flexible but strongly ON-BRAND): a premium, modern, high-quality editorial image with a cohesive, tasteful, cinematic color grade and refined natural lighting. Brand personality: Argentine, warm, close, human, trustworthy, with a touch of emotion or wit as the idea requires. The SETTING IS FREE — indoor, outdoor, urban, aspirational, lifestyle, or surreal/conceptual — NOT restricted to a kitchen. Consistent premium look across posts: warm, refined palette, clean and uncluttered composition, generous negative space, high production value. STRICTLY AVOID: cheap generic stock photos, cluttered scenes, low quality, harsh flat lighting, cold clinical looks.";

// Orientación por sub-tipo de contenido creativo.
const SUBTIPO_GUIA: Record<string, string> = {
  efemeride: "It's a CALENDAR-MOMENT / holiday post (a special date, e.g. Mother's/Father's Day, Christmas, a national date). Warm, emotional, celebratory and human; tie the brand to the moment tastefully.",
  trending: "It's a CULTURAL / trending-topic post: timely, witty, on-trend and a bit disruptive; connect the brand to what people are talking about right now.",
  beneficio: "It's a BENEFIT post: convey the EMOTIONAL benefit of the brand's products WITHOUT necessarily showing the product (or only very subtly). Aspirational lifestyle, feeling, everyday life at home or beyond.",
  disruptivo: "It's a DISRUPTIVE / CREATIVE concept post: a bold, surreal, unexpected, scroll-stopping visual idea (e.g. a washing machine made of clouds in the sky). High creativity; metaphor and visual surprise are encouraged.",
};

export interface Brief {
  escena: string;
  caption_es: string;
  hashtags: string[];
  mensaje_clave: string;
  bajada: string;
  slides?: Array<{ titulo: string; texto: string }>;
}

interface TopRef {
  message: string | null;
  media_type: string | null;
  engagement: number;
  video_views: number;
}

export interface Pieza {
  imagen: string | null;
  caption: string;
  hashtags: string[];
  mensaje_clave: string;
  bajada: string;
  slides: Array<{ titulo: string; texto: string }>;
  image_prompt: string;
  error?: string;
}

async function disenarBrief(
  pilar: string,
  formato: string,
  categoriaTxt: string,
  productoNombre: string | null,
  personas: boolean,
  tops: TopRef[],
  variante: number,
  esPorfolio: boolean,
): Promise<Brief> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY no configurada.");
  const ref = tops
    .slice(0, 6)
    .map((t, i) => `${i + 1}. [${t.media_type ?? "?"}] interacciones=${t.engagement} views=${t.video_views} — "${(t.message ?? "").slice(0, 160)}"`)
    .join("\n");

  const sys = `Sos director creativo de Drean (marca argentina de electrodomésticos: lavado, refrigeración, cocción). Diseñás contenido orgánico para redes manteniendo identidad de marca (cercana, confiable, argentina, sin estridencias). Respondé SOLO JSON.`;
  const user = `PILAR: "${pilar}" — ${PILAR_DEF[pilar] ?? ""}
CATEGORÍA: ${categoriaTxt}${productoNombre ? ` — producto: ${productoNombre}` : ""}
${personas ? "La escena INCLUYE personas/familia.\n" : ""}FORMATO: ${formato}
${variante > 1 ? `VARIANTE #${variante}: buscá un ángulo/momento DISTINTO a las otras.\n` : ""}PIEZAS QUE MEJOR PERFORMARON en este pilar (referencia de qué funcionó):
${ref || "(sin data — usá tu criterio)"}

Devolvé JSON con:
{
  "escena": "descripción CORTA en INGLÉS del sujeto/momento. ${personas ? `El SUJETO PRINCIPAL son personas reales (una persona o una familia) bien visibles en primer plano, usando activamente un ${productoNombre ? `Drean ${productoNombre}` : `electrodoméstico Drean de ${categoriaTxt}`} (cargándolo, cocinando, sacando comida, etc.); el electrodoméstico presente y en uso.` : esPorfolio ? `The scene shows the DREAN APPLIANCE LINEUP together in one premium home — a refrigerator, a kitchen range and a washing machine, coordinated (this is a brand/portfolio piece, NOT a single product).` : `El electrodoméstico Drean es el protagonista de la escena: ${productoNombre ? `a Drean ${productoNombre}` : `a Drean ${categoriaTxt} appliance`}.`} Sumá props relevantes al mensaje. NO describas estilo/luz/colores (ya están definidos). NO incluyas texto en la imagen.",
  "mensaje_clave": "TÍTULO de la placa: frase corta y potente en español (máx 5 palabras, tono de marca)",
  "bajada": "BAJADA de la placa: una línea corta en español que complementa el título (máx 8 palabras)",
  "caption_es": "caption en español: hook en la 1ra línea + cuerpo breve + CTA",
  "hashtags": ["#...", "#..."],
  ${formato === "carrusel" ? `"slides": [{"titulo":"...","texto":"..."}] (4 a 6 slides)` : `"slides": []`}
}`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: sys }, { role: "user", content: user }],
      response_format: { type: "json_object" },
      temperature: 0.9,
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const j = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return JSON.parse(j.choices?.[0]?.message?.content ?? "{}") as Brief;
}

function buildImagePrompt(escena: string, categoria: string, personas: boolean, medidas?: string, detalles?: string): string {
  const parts = [escena.trim()];
  if (detalles) parts.push(`USER DETAILS (very important, follow these EXACTLY): ${detalles}.`);
  parts.push(BRAND_LOOK);
  if (personas) parts.push(PERSONAS_ON);
  else if (categoria === "porfolio") parts.push(PORFOLIO_SCENE);
  else {
    parts.push(MINIMAL, PROPORCION[categoria] ?? PROPORCION.porfolio ?? "");
    if (medidas) parts.push(`REAL SIZE reference: the appliance measures ${medidas}; keep realistic proportions.`);
  }
  if (ACABADO[categoria]) parts.push(ACABADO[categoria]!);
  parts.push(NO_TEXT);
  return parts.filter(Boolean).join(" ");
}

function buildEditPrompt(escena: string, categoria: string, nombre: string, personas: boolean, vertical: boolean, detalles?: string): string {
  const parts = [
    `Using the Drean ${nombre} shown in the provided product photo as the exact hero product, create a premium social-media image.`,
    `Scene: ${escena.trim()}.`,
  ];
  if (detalles) parts.push(`USER DETAILS (very important, follow these EXACTLY): ${detalles}.`);
  parts.push(
    "CRITICAL: keep the appliance IDENTICAL to the reference photo — same model, shape, proportions, colors, finish, doors, knobs and details. Do NOT redesign, replace, duplicate or restyle the product; there is only ONE appliance (the reference one). Build the environment around it.",
    "PRODUCT LIGHTING (very important): the appliance is BRILLIANTLY and evenly lit as the hero — bright, glossy, crisp and fully exposed, with strong clean specular highlights on its finish, glass, chrome and controls. It is the BRIGHTEST, clearest, most eye-catching element, clearly standing out and distinctly brighter than the surroundings. NEVER underexposed, dark, dim, matte, muddy or lost in shadow. The surrounding environment stays warm and premium but still clearly visible (not black).",
    BRAND_LOOK,
  );
  if (personas) parts.push(PERSONAS_ON);
  else parts.push(MINIMAL, PROPORCION[categoria] ?? PROPORCION.porfolio ?? "");
  if (ACABADO[categoria]) parts.push(ACABADO[categoria]!);
  if (vertical) parts.push("Vertical portrait composition, taller than wide.");
  parts.push(NO_TEXT);
  return parts.filter(Boolean).join(" ");
}

function buildPorfolioPrompt(escena: string, vertical: boolean, detalles?: string): string {
  const parts = [
    "Create a premium brand social-media image showing ALL the Drean appliances from the provided product photos arranged TOGETHER in one cohesive premium home (a modern kitchen/laundry).",
    `Context: ${escena.trim()}.`,
    detalles ? `USER DETAILS (very important, follow these EXACTLY): ${detalles}.` : "",
    "CRITICAL: use the EXACT products from the reference photos — keep each appliance IDENTICAL (same models, shapes, proportions, finishes, doors, controls); do NOT redesign, replace or invent appliances. Show all of them together, arranged tastefully and built-in as a coordinated lineup.",
    ACABADO.porfolio ?? "",
    BRAND_LOOK,
    "PRODUCT LIGHTING: every appliance is brightly and clearly lit, glossy with strong specular highlights, standing out as the heroes; the scene is warm, premium and clearly exposed (not dark).",
  ];
  if (vertical) parts.push("Vertical portrait composition, taller than wide.");
  parts.push(NO_TEXT);
  return parts.filter(Boolean).join(" ");
}

// Brief para contenido CREATIVO/editorial: OpenAI como director creativo diseña
// un concepto (no product shot) alrededor de una IDEA + sub-tipo.
async function disenarBriefCreativo(idea: string, subtipo: string, productoNombre: string | null, tops: TopRef[]): Promise<Brief> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY no configurada.");
  const ref = tops.slice(0, 6).map((t, i) => `${i + 1}. [${t.media_type ?? "?"}] int=${t.engagement} — "${(t.message ?? "").slice(0, 140)}"`).join("\n");
  const sys = `Sos director creativo de Drean (marca argentina de electrodomésticos). Diseñás contenido ORGÁNICO CONCEPTUAL/editorial para redes (NO product shots): efemérides, trending topics, beneficios emocionales, ideas disruptivas. Tono de marca: cercano, argentino, confiable, con emoción o humor según el caso. Respondé SOLO JSON.`;
  const user = `IDEA / TEMA: "${idea || "(libre — proponé un concepto on-brand)"}"
SUB-TIPO: ${subtipo} — ${SUBTIPO_GUIA[subtipo] ?? SUBTIPO_GUIA.beneficio}
${productoNombre ? `Producto asociado (mencionar SÓLO sutil/contextual o metafórico, NUNCA como product shot): ${productoNombre}` : "SIN producto visible (posteo de marca / concepto puro)."}
Posteos que performaron (referencia de tono):
${ref || "(sin data — usá tu criterio)"}

Devolvé JSON con:
{
  "escena": "descripción CORTA en INGLÉS de la IMAGEN CONCEPTUAL. El AMBIENTE es LIBRE (exterior, urbano, aspiracional, lifestyle o surreal/conceptual — NO restringido a una cocina). ${productoNombre ? "El producto puede aparecer sutil o metafórico." : "SIN producto visible."} NO incluyas texto en la imagen. NO describas estilo/luz/colores (ya están definidos).",
  "mensaje_clave": "TÍTULO de la placa: frase corta y potente en español (máx 5 palabras, tono de marca)",
  "bajada": "BAJADA: una línea corta en español que complementa (máx 8 palabras)",
  "caption_es": "caption en español: hook + cuerpo breve + CTA",
  "hashtags": ["#...", "#..."],
  "slides": []
}`;
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "gpt-4o-mini", messages: [{ role: "system", content: sys }, { role: "user", content: user }], response_format: { type: "json_object" }, temperature: 1 }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const j = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return JSON.parse(j.choices?.[0]?.message?.content ?? "{}") as Brief;
}

function buildCreativePrompt(escena: string, detalles?: string): string {
  const parts = [escena.trim()];
  if (detalles) parts.push(`USER DETAILS (very important, follow these EXACTLY): ${detalles}.`);
  parts.push(BRAND_CREATIVE, NO_TEXT);
  return parts.filter(Boolean).join(" ");
}

export interface GenerarParams {
  pilar?: string;
  categoria?: string;
  modelo?: string;
  personas?: boolean;
  mensaje?: string;
  formato?: string;
  aspecto?: FalSizeKey;
  cantidad?: number;
  productoReal?: boolean;
  detalles?: string;
  tipoContenido?: string; // "producto" (default) | "creativo"
  subtipo?: string; // creativo: efemeride | trending | beneficio | disruptivo
  idea?: string; // creativo: tema/idea en texto libre
}

export interface GenerarResult {
  ok: boolean;
  pilar: string;
  categoria: string;
  personas: boolean;
  formato: string;
  modelo: string | null;
  producto: string | null;
  usa_packshot: boolean;
  engine: string;
  piezas: Pieza[];
  producto_ref: string | null;
  error?: string;
}

export async function generarPiezas(body: GenerarParams): Promise<GenerarResult> {
  const pilar = body.pilar && (PILARES as readonly string[]).includes(body.pilar) ? body.pilar : PILARES[0];
  const categoria = body.categoria && CATEGORIAS.some((c) => c.v === body.categoria) ? body.categoria : "porfolio";
  const formato = body.formato ?? "imagen";
  const aspecto: FalSizeKey = body.aspecto ?? "vertical";
  const producto = getModelo(body.modelo);
  const productoReal = body.productoReal === true && producto != null;
  const packshotUrl = productoReal && producto ? driveImageUrl(producto.driveFileId) : null;
  const esPorfolio = categoria === "porfolio";
  const porfolioUrls = esPorfolio
    ? (["heladeras", "cocinas", "lavarropas"] as const)
        .map((c) => getModelos(c)[0])
        .filter((m): m is NonNullable<typeof m> => m != null)
        .map((m) => driveImageUrl(m.driveFileId))
    : [];
  const personas = body.personas ?? pilar === "Experiencia uso";
  const cantidad = Math.min(MAX_PIEZAS, Math.max(1, Math.floor(body.cantidad ?? 1)));
  const mensajeOverride = (body.mensaje ?? "").trim();
  const detalles = (body.detalles ?? "").trim();
  // Modo creativo/editorial (efemérides, trending, beneficio, disruptivo).
  const creativo = body.tipoContenido === "creativo";
  const subtipo = body.subtipo ?? "beneficio";
  const idea = (body.idea ?? "").trim();

  const topsAll = (await getTopByPilar())[pilar] ?? [];
  const tops = filtrarPorCategoria(topsAll, categoria);

  const piezas: Pieza[] = await Promise.all(
    Array.from({ length: cantidad }, (_, i) => i + 1).map(async (variante): Promise<Pieza> => {
      try {
        const productoDesc = producto ? `${producto.nombre}${producto.descripcion ? ` — ${producto.descripcion}` : ""}` : null;

        let imagenUrl: string | null;
        let promptMostrar: string;
        let brief: Brief;
        if (creativo) {
          // Concepto editorial: OpenAI director creativo + Ideogram estética flexible on-brand.
          brief = await disenarBriefCreativo(idea, subtipo, producto?.nombre ?? null, tops);
          const prompt = buildCreativePrompt(brief.escena ?? "", detalles);
          const img = await falImage(MODEL_IDEOGRAM, { prompt, image_size: FAL_SIZES[aspecto], num_images: 1 });
          imagenUrl = img.images[0]?.url ?? null;
          promptMostrar = prompt;
          return {
            imagen: imagenUrl,
            caption: brief.caption_es,
            hashtags: brief.hashtags ?? [],
            mensaje_clave: mensajeOverride || brief.mensaje_clave || "",
            bajada: brief.bajada || "",
            slides: brief.slides ?? [],
            image_prompt: promptMostrar,
          };
        }
        brief = await disenarBrief(pilar, formato, categoriaBrief(categoria), productoDesc, personas, tops, variante, esPorfolio);

        if (productoReal && producto && packshotUrl) {
          const editPrompt = buildEditPrompt(brief.escena ?? "", categoria, producto.nombre, personas, aspecto !== "feed", detalles);
          const img = await falImage(MODEL_EDIT, { prompt: editPrompt, image_urls: [packshotUrl], num_images: 1 });
          imagenUrl = img.images[0]?.url ?? null;
          promptMostrar = editPrompt;
        } else if (esPorfolio && porfolioUrls.length > 0) {
          const editPrompt = buildPorfolioPrompt(brief.escena ?? "", aspecto !== "feed", detalles);
          const img = await falImage(MODEL_EDIT, { prompt: editPrompt, image_urls: porfolioUrls, num_images: 1 });
          imagenUrl = img.images[0]?.url ?? null;
          promptMostrar = editPrompt;
        } else {
          const prompt = buildImagePrompt(brief.escena ?? "", categoria, personas, producto?.medidas, detalles);
          const img = await falImage(MODEL_IDEOGRAM, { prompt, image_size: FAL_SIZES[aspecto], num_images: 1 });
          imagenUrl = img.images[0]?.url ?? null;
          promptMostrar = prompt;
        }

        return {
          imagen: imagenUrl,
          caption: brief.caption_es,
          hashtags: brief.hashtags ?? [],
          mensaje_clave: mensajeOverride || brief.mensaje_clave || "",
          bajada: brief.bajada || "",
          slides: brief.slides ?? [],
          image_prompt: promptMostrar,
        };
      } catch (e) {
        return { imagen: null, caption: "", hashtags: [], mensaje_clave: "", bajada: "", slides: [], image_prompt: "", error: e instanceof Error ? e.message : String(e) };
      }
    }),
  );

  return {
    ok: !piezas.every((p) => p.error),
    pilar,
    categoria,
    personas,
    formato,
    modelo: producto?.sku ?? null,
    producto: creativo ? "Creativo/editorial" : producto?.nombre ?? (esPorfolio && porfolioUrls.length > 0 ? "Lineup Drean (porfolio)" : null),
    usa_packshot: !creativo && (productoReal || (esPorfolio && porfolioUrls.length > 0)),
    engine: !creativo && (productoReal || (esPorfolio && porfolioUrls.length > 0)) ? MODEL_EDIT : MODEL_IDEOGRAM,
    piezas,
    producto_ref: creativo ? null : packshotUrl ?? (porfolioUrls.length > 0 ? porfolioUrls.join(" · ") : null),
  };
}
