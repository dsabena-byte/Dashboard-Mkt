import { NextResponse } from "next/server";
import { getTopByPilar, PILARES, CATEGORIAS, categoriaBrief, filtrarPorCategoria } from "@/lib/contenido-queries";
import { BRAND_LOOK } from "@/lib/contenido-shared";
import { getModelo } from "@/lib/producto-catalog";
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
const MAX_PIEZAS = 4;

const NO_TEXT = "CRITICAL: do NOT render any text, letters, words, captions, logos, brand names, watermarks or signage anywhere in the image. Clean image with no typography.";
const PERSONAS_ON = "REQUIRED: include real people (an individual or a family) ACTIVELY USING and interacting with the Drean appliance — e.g. loading/using the washing machine, cooking on the range, taking food from the fridge — candid and authentic, natural skin and expressions, realistic. People are clearly present and engaged with the product.";

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
  "escena": "descripción CORTA en INGLÉS del sujeto/momento, incluyendo SIEMPRE el electrodoméstico Drean como protagonista: ${productoNombre ? `a Drean ${productoNombre}` : `a Drean ${categoriaTxt} appliance`}${personas ? ", with people actively using it," : ""}. Sumá props relevantes al mensaje. NO describas estilo/luz/colores (ya están definidos). NO incluyas texto en la imagen.",
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
  const parts = [escena.trim(), BRAND_LOOK, MINIMAL, PROPORCION[categoria] ?? PROPORCION.porfolio];
  if (medidas) parts.push(`REAL SIZE reference: the appliance measures ${medidas}; keep realistic proportions.`);
  if (personas) parts.push(PERSONAS_ON);
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
      ref_urls?: string[]; // posteos de referencia elegidos (definen el estilo)
    };
    const pilar = body.pilar && (PILARES as readonly string[]).includes(body.pilar) ? body.pilar : PILARES[0];
    const categoria = body.categoria && CATEGORIAS.some((c) => c.v === body.categoria) ? body.categoria : "porfolio";
    const formato = body.formato ?? "imagen";
    const aspecto: FalSizeKey = body.aspecto ?? "vertical";
    const producto = getModelo(body.modelo);
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
          const brief = await disenarBrief(pilar, formato, categoriaBrief(categoria), producto?.nombre ?? null, personas, tops, variante);
          const prompt = buildImagePrompt(brief.escena ?? "", categoria, personas, producto?.medidas);
          const img = await falImage(MODEL_IDEOGRAM, {
            prompt,
            image_size: FAL_SIZES[aspecto],
            num_images: 1,
          });
          const imagenUrl = img.images[0]?.url ?? null;
          const promptMostrar = prompt;

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
      usa_packshot: false,
      engine: MODEL_IDEOGRAM,
      piezas,
      producto_ref: null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
