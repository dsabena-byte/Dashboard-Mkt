import { NextResponse } from "next/server";
import { getTopByPilar, PILARES, CATEGORIAS, categoriaBrief, filtrarPorCategoria } from "@/lib/contenido-queries";
import { placementGuide, BRAND_LOOK } from "@/lib/contenido-shared";
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
const MODEL_PRODUCT = "fal-ai/bria/product-shot";
const MAX_PIEZAS = 4;

const NO_TEXT = "CRITICAL: do NOT render any text, letters, words, captions, logos, brand names, watermarks or signage anywhere in the image. Clean image with no typography.";
const PERSONAS_ON = "Include real people (an individual or a family) naturally in the scene, candid and authentic, genuinely enjoying the moment; natural skin, natural expressions, realistic.";

function sanitizeScene(s: string): string {
  return s.normalize("NFKD").replace(/[^\x20-\x7E]/g, " ").replace(/["'`]/g, "").replace(/\s+/g, " ").trim().slice(0, 1000);
}

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
  "escena": "descripción CORTA en INGLÉS SOLO del sujeto/acción/momento de la escena (qué pasa, ${personas ? "quiénes son las personas y qué hacen, " : ""}props relevantes${productoNombre ? "" : `, el electrodoméstico Drean de ${categoriaTxt}`}). NO describas estilo/luz/colores. NO incluyas texto en la imagen.",
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

// Prompt final = sujeto + BRAND_LOOK (base on-brand) + personas + colocación
// (si el producto es protagonista) + no-text. La estética fina la aportan las
// referencias (posteos elegidos) vía image_urls.
function buildImagePrompt(escena: string, categoria: string, personas: boolean, esHero: boolean): string {
  const parts = [escena.trim(), BRAND_LOOK];
  if (personas) parts.push(PERSONAS_ON);
  if (esHero) parts.push(placementGuide(categoria));
  parts.push(NO_TEXT);
  return parts.filter(Boolean).join(" ");
}

function buildEmptyScenePrompt(categoria: string): string {
  const NICHOS: Record<string, string> = {
    cocinas:
      "An empty modern kitchen with a clearly defined empty NICHE at floor level, sized for a freestanding range. Base cabinets and a continuous countertop flank the empty niche on BOTH sides at the same height, forming one seamless flush cabinetry line. Directly behind the niche is a plain wall or backsplash (NOT a wall of cabinets or drawers). The floor is visible at the base of the niche.",
    lavarropas:
      "An empty modern laundry/kitchen area with a clearly defined empty NICHE at floor level, sized for a front-load washing machine, set flush within a run of cabinetry. Base cabinets and a continuous countertop flank the niche on BOTH sides at the same height (seamless flush line). A plain wall directly behind the niche (NOT a wall of drawers). Floor visible at the base.",
    heladeras:
      "An empty modern kitchen with a clearly defined tall empty NICHE from floor level, sized for a refrigerator, set flush within the cabinetry. Tall cabinets flank the niche on BOTH sides, aligned flush with where the fridge front will be. A plain wall directly behind the niche. Floor visible at the base.",
    porfolio:
      "An empty modern home setting with a clearly defined empty niche at floor level for the appliance, flanked by furniture at the same height forming a flush line, a plain wall directly behind, floor visible at the base.",
  };
  const nicho = NICHOS[categoria] ?? NICHOS.porfolio;
  const integ =
    "The appliance will sit INSIDE this niche, flush and perfectly in-line with the cabinetry, so cabinets/counters continue on both sides at the same plane. It must read as BUILT-IN, NOT standing in front of a wall of furniture. NO appliance present in this image.";
  return [nicho, integ, BRAND_LOOK, NO_TEXT].join(" ");
}

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
    const personas = body.personas ?? false;
    const cantidad = Math.min(MAX_PIEZAS, Math.max(1, Math.floor(body.cantidad ?? 1)));
    const mensajeOverride = (body.mensaje ?? "").trim();

    const topsAll = (await getTopByPilar())[pilar] ?? [];
    const tops = filtrarPorCategoria(topsAll, categoria);
    // Referencias de estilo: los posteos elegidos por el usuario.
    const styleRefs = (body.ref_urls ?? []).filter((u): u is string => !!u).slice(0, 3);

    // Con un modelo elegido, el producto real es protagonista (packshot vía Bria).
    const usarPackshot = !!producto;
    const engine = usarPackshot ? MODEL_PRODUCT : MODEL_IDEOGRAM;

    const piezas: Pieza[] = await Promise.all(
      Array.from({ length: cantidad }, (_, i) => i + 1).map(async (variante): Promise<Pieza> => {
        try {
          const brief = await disenarBrief(pilar, formato, categoriaBrief(categoria), producto?.nombre ?? null, personas, tops, variante);
          let imagenUrl: string | null;
          let promptMostrar: string;

          if (usarPackshot && producto) {
            // 2 etapas: escena on-brand vacía (con refs) → Bria compone el packshot real.
            const escenaPrompt = buildEmptyScenePrompt(categoria);
            const escena = await falImage(MODEL_IDEOGRAM, {
              prompt: escenaPrompt,
              image_size: FAL_SIZES[aspecto],
              num_images: 1,
              ...(styleRefs.length > 0 ? { image_urls: styleRefs } : {}),
            });
            const escenaUrl = escena.images[0]?.url ?? null;
            const prod = await falImage(MODEL_PRODUCT, {
              image_url: driveImageUrl(producto.driveFileId),
              // "automatic": Bria ubica el producto a ESCALA NATURAL en la escena
              // (con "original" quedaba gigante, piso a techo, porque el packshot
              // llena su frame). Mantiene la fidelidad del producto.
              placement_type: "automatic",
              num_results: 1,
              ...(escenaUrl ? { ref_image_url: escenaUrl } : { scene_description: sanitizeScene(escenaPrompt) }),
            });
            imagenUrl = prod.images[0]?.url ?? escenaUrl;
            promptMostrar = escenaPrompt;
          } else {
            const prompt = buildImagePrompt(brief.escena ?? "", categoria, personas, false);
            const img = await falImage(MODEL_IDEOGRAM, {
              prompt,
              image_size: FAL_SIZES[aspecto],
              num_images: 1,
              ...(styleRefs.length > 0 ? { image_urls: styleRefs } : {}),
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
      usa_packshot: usarPackshot,
      engine,
      piezas,
      producto_ref: producto ? driveImageUrl(producto.driveFileId) : null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
