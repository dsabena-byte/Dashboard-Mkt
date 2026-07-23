import { NextResponse } from "next/server";
import { getTopByPilar, PILARES, CATEGORIAS, categoriaBrief, filtrarPorCategoria } from "@/lib/contenido-queries";
import { BRAND_LOOK } from "@/lib/contenido-shared";
import { getModelo, driveImageUrl } from "@/lib/producto-catalog";
import { falImage, FAL_SIZES, type FalSizeKey } from "@/lib/fal-client";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const PILAR_DEF: Record<string, string> = {
  "Liderazgo marca/porfolio": "Liderazgo, portfolio único, superioridad/premium tangible, tecnología propia.",
  "Calidad superior": "Calidad como evidencia; durabilidad y calidad que se siente (‘toda tu vida’).",
  "Respaldo Posventa": "Servicio, garantía, red de posventa, tranquilidad de estar respaldado.",
  "Elegir bien": "Ayuda a decidir la compra correcta; comparativas, guías, tips prácticos.",
  "Experiencia uso": "La vida cotidiana con el producto; usos reales, beneficios en el día a día.",
};

const MODEL_IDEOGRAM = "fal-ai/ideogram/v3";
// Modo "producto real": edición por referencia con el packshot real. Nano Banana
// (Gemini 2.5 Flash Image edit) preserva el producto exacto y arma la escena
// premium alrededor. Si fal cambiara el id, la alternativa es
// "fal-ai/gemini-25-flash-image/edit".
const MODEL_EDIT = "fal-ai/nano-banana/edit";
const MAX_PIEZAS = 4;

const NO_TEXT = "CRITICAL: do NOT render any text, letters, words, captions, logos, brand names, watermarks or signage anywhere in the image. Clean image with no typography.";
const PERSONAS_ON = "REQUIRED — this is a LIFESTYLE scene with PEOPLE, not an empty product shot: real people (a person or a family) are PROMINENTLY visible in the foreground as the MAIN SUBJECT, large in frame, actively USING and interacting with the Drean appliance (loading the washing machine, cooking on the range, taking food from the fridge). Candid, authentic, natural skin and expressions. The people MUST be clearly present and central.";

interface Brief {
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

async function disenarBrief(
  pilar: string,
  formato: string,
  categoriaTxt: string,
  productoNombre: string | null,
  personas: boolean,
  tops: TopRef[],
  variante: number,
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
  "escena": "descripción CORTA en INGLÉS del sujeto/momento. ${personas ? `El SUJETO PRINCIPAL son personas reales (una persona o una familia) bien visibles en primer plano, usando activamente un ${productoNombre ? `Drean ${productoNombre}` : `electrodoméstico Drean de ${categoriaTxt}`} (cargándolo, cocinando, sacando comida, etc.); el electrodoméstico presente y en uso.` : `El electrodoméstico Drean es el protagonista de la escena: ${productoNombre ? `a Drean ${productoNombre}` : `a Drean ${categoriaTxt} appliance`}.`} Sumá props relevantes al mensaje. NO describas estilo/luz/colores (ya están definidos). NO incluyas texto en la imagen.",
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

// Prompt final = sujeto + estética Drean fija + minimalismo + proporción por
// categoría (+ medidas reales) + personas + no-text. Todo lo genera Ideogram,
// que sí respeta el look premium (Bria salía claro/genérico).
function buildImagePrompt(escena: string, categoria: string, personas: boolean, medidas?: string): string {
  const parts = [escena.trim(), BRAND_LOOK];
  if (personas) {
    // Escena lifestyle: el foco son las personas; el producto es contextual.
    parts.push(PERSONAS_ON);
  } else {
    // Escena producto-hero: minimalista + proporción correcta del electrodoméstico.
    parts.push(MINIMAL, PROPORCION[categoria] ?? PROPORCION.porfolio ?? "");
    if (medidas) parts.push(`REAL SIZE reference: the appliance measures ${medidas}; keep realistic proportions.`);
  }
  if (ACABADO[categoria]) parts.push(ACABADO[categoria]!);
  parts.push(NO_TEXT);
  return parts.filter(Boolean).join(" ");
}

// Prompt para el modo "producto real" (Nano Banana edit). Le damos el packshot
// real como referencia y le pedimos que arme la escena premium alrededor SIN
// alterar el producto. La proporción sale de la foto real (no del prompt).
function buildEditPrompt(escena: string, categoria: string, nombre: string, personas: boolean, vertical: boolean): string {
  const parts = [
    `Using the Drean ${nombre} shown in the provided product photo as the exact hero product, create a premium social-media image.`,
    `Scene: ${escena.trim()}.`,
    "CRITICAL: keep the appliance IDENTICAL to the reference photo — same model, shape, proportions, colors, finish, doors, knobs and details. Do NOT redesign, replace, duplicate or restyle the product; there is only ONE appliance (the reference one). Build the environment around it.",
    // El relight a la escena oscura subexpone el producto → luz clave explícita.
    "PRODUCT LIGHTING (very important): put a STRONG, soft, warm KEY LIGHT on the appliance itself so its finish, glass door, controls, chrome and details are bright, crisp and fully exposed. The product must be the BRIGHTEST element and read clearly as the hero — distinctly brighter than the surroundings; it must NOT be underexposed, crushed to black, muddy or lost in shadow. Metallic and chrome surfaces show bright specular highlights. The surrounding environment stays warm and moody but still clearly visible (not black), and the appliance stands out from the background.",
    BRAND_LOOK,
  ];
  if (personas) parts.push(PERSONAS_ON);
  else parts.push(MINIMAL, PROPORCION[categoria] ?? PROPORCION.porfolio ?? "");
  if (ACABADO[categoria]) parts.push(ACABADO[categoria]!);
  if (vertical) parts.push("Vertical portrait composition, taller than wide.");
  parts.push(NO_TEXT);
  return parts.filter(Boolean).join(" ");
}

// Minimalismo transversal: un solo electrodoméstico, escena limpia y premium.
const MINIMAL =
  "MINIMALIST and premium: a clean, uncluttered scene with generous negative space. There is ONLY ONE appliance in the entire image — the product itself. ABSOLUTELY NO other appliances (no second refrigerator, oven, microwave, range, dishwasher or washing machine) and no extra products. Very few props, only elements that complement the message. Do NOT overcrowd the scene.";

// Proporción correcta por categoría (una cocina/lavarropas es altura mesada;
// una heladera es alta, más que la mesada).
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

// Acabado/brillo por categoría. Heladeras: chapa de acero bien brillante y
// reflejante (pedido de la marca; la chapa mate/apagada no vende).
const ACABADO: Record<string, string> = {
  heladeras:
    "FINISH: the refrigerator's stainless steel must be BRIGHT, polished and highly reflective, with strong clean specular highlights and a luminous, mirror-like metallic sheen catching the warm light across the whole door — never dull, matte, grey, dark or muddy. The steel clearly reflects the warm lighting.",
  lavarropas:
    "FINISH: the washer's graphite/dark-grey body must read CLEARLY and be well-lit — never black, murky or lost in shadow; its chrome door rim and round glass door catch bright specular highlights, and the control panel is clearly visible and legible.",
};

interface Pieza {
  imagen: string | null;
  caption: string;
  hashtags: string[];
  mensaje_clave: string;
  bajada: string;
  slides: Array<{ titulo: string; texto: string }>;
  image_prompt: string;
  error?: string;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      pilar?: string;
      categoria?: string;
      modelo?: string;
      personas?: boolean;
      mensaje?: string;
      formato?: string;
      aspecto?: FalSizeKey;
      cantidad?: number;
      productoReal?: boolean; // usar el packshot real (Nano Banana edit) en vez de recrear con Ideogram
      ref_urls?: string[]; // posteos de referencia elegidos (definen el estilo)
    };
    const pilar = body.pilar && (PILARES as readonly string[]).includes(body.pilar) ? body.pilar : PILARES[0];
    const categoria = body.categoria && CATEGORIAS.some((c) => c.v === body.categoria) ? body.categoria : "porfolio";
    const formato = body.formato ?? "imagen";
    const aspecto: FalSizeKey = body.aspecto ?? "vertical";
    const producto = getModelo(body.modelo);
    // Modo "producto real": sólo si hay un modelo elegido (necesitamos el packshot).
    const productoReal = body.productoReal === true && producto != null;
    const packshotUrl = productoReal && producto ? driveImageUrl(producto.driveFileId) : null;
    // Personas: obligatorias en "Experiencia uso" (gente usando el producto).
    const personas = body.personas ?? pilar === "Experiencia uso";
    const cantidad = Math.min(MAX_PIEZAS, Math.max(1, Math.floor(body.cantidad ?? 1)));
    const mensajeOverride = (body.mensaje ?? "").trim();

    const topsAll = (await getTopByPilar())[pilar] ?? [];
    const tops = filtrarPorCategoria(topsAll, categoria);

    // TODO se genera con Ideogram (respeta la estética premium; Bria salía claro
    // y genérico). Si hay modelo, se describe ese electrodoméstico para que se
    // parezca; no se usa el packshot pixel-exacto.
    const piezas: Pieza[] = await Promise.all(
      Array.from({ length: cantidad }, (_, i) => i + 1).map(async (variante): Promise<Pieza> => {
        try {
          // Descripción rica del modelo (nombre + rasgos visuales) para que
          // Ideogram recree un electrodoméstico lo más parecido posible al elegido.
          const productoDesc = producto ? `${producto.nombre}${producto.descripcion ? ` — ${producto.descripcion}` : ""}` : null;
          const brief = await disenarBrief(pilar, formato, categoriaBrief(categoria), productoDesc, personas, tops, variante);

          let imagenUrl: string | null;
          let promptMostrar: string;
          if (productoReal && producto && packshotUrl) {
            // Nano Banana edit: packshot real como referencia + escena premium alrededor.
            const editPrompt = buildEditPrompt(brief.escena ?? "", categoria, producto.nombre, personas, aspecto !== "feed");
            const img = await falImage(MODEL_EDIT, {
              prompt: editPrompt,
              image_urls: [packshotUrl],
              num_images: 1,
            });
            imagenUrl = img.images[0]?.url ?? null;
            promptMostrar = editPrompt;
          } else {
            // Ideogram: recrea el electrodoméstico a partir de la descripción.
            const prompt = buildImagePrompt(brief.escena ?? "", categoria, personas, producto?.medidas);
            const img = await falImage(MODEL_IDEOGRAM, {
              prompt,
              image_size: FAL_SIZES[aspecto],
              num_images: 1,
            });
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

    if (piezas.every((p) => p.error)) {
      return NextResponse.json({ ok: false, error: piezas[0]?.error ?? "Falló la generación." }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      pilar,
      categoria,
      personas,
      formato,
      modelo: producto?.sku ?? null,
      producto: producto?.nombre ?? null,
      usa_packshot: productoReal,
      engine: productoReal ? MODEL_EDIT : MODEL_IDEOGRAM,
      piezas,
      producto_ref: packshotUrl,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
