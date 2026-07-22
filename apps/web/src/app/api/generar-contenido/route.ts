import { NextResponse } from "next/server";
import { getTopByPilar, PILARES, CATEGORIAS, categoriaBrief, filtrarPorCategoria } from "@/lib/contenido-queries";
import { placementGuide } from "@/lib/contenido-shared";
import { getModelo, driveImageUrl } from "@/lib/producto-catalog";
import { falImage, FAL_SIZES, type FalSizeKey } from "@/lib/fal-client";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Definiciones de pilar (guía creativa) — resumen de las del clasificador.
const PILAR_DEF: Record<string, string> = {
  "Liderazgo marca/porfolio": "Liderazgo, portfolio único, superioridad/premium tangible, tecnología propia.",
  "Calidad superior": "Calidad como evidencia; durabilidad y calidad que se siente (‘toda tu vida’).",
  "Respaldo Posventa": "Servicio, garantía, red de posventa, tranquilidad de estar respaldado.",
  "Elegir bien": "Ayuda a decidir la compra correcta; comparativas, guías, tips prácticos.",
  "Experiencia uso": "La vida cotidiana con el producto; usos reales, beneficios en el día a día.",
};

// Modelos fal.
// - ideogram/v3: texto→imagen, acepta image_urls como REFERENCIAS DE ESTILO
//   (clona paleta/luz/estética de los posts reales). Es el engine por defecto.
// - bria/product-shot: toma el packshot REAL (image_url), lo segmenta y lo
//   coloca en una escena nueva descrita por scene_description (lifestyle).
//   Es el modelo hecho para "producto real en escena generada".
const MODEL_IDEOGRAM = "fal-ai/ideogram/v3";
const MODEL_PRODUCT = "fal-ai/bria/product-shot";

const MAX_PIEZAS = 4;

// Bria solo acepta inglés y sin caracteres especiales en scene_description.
function sanitizeScene(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, " ") // fuera no-ASCII (tildes, emojis)
    .replace(/["'`]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1000);
}

interface Brief {
  image_prompt: string;
  caption_es: string;
  hashtags: string[];
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
  categoria: string,
  categoriaTxt: string,
  productoNombre: string | null,
  tops: TopRef[],
  variante: number,
): Promise<Brief> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY no configurada.");
  const ref = tops
    .slice(0, 6)
    .map((t, i) => `${i + 1}. [${t.media_type ?? "?"}] interacciones=${t.engagement} views=${t.video_views} — "${(t.message ?? "").slice(0, 180)}"`)
    .join("\n");

  const placement = placementGuide(categoria);

  // Si hay un producto real elegido, el prompt de imagen describe la ESCENA /
  // fondo donde va ese producto (Bria mantiene el producto). Si no, describe la
  // escena completa incluyendo un electrodoméstico Drean. En ambos casos se
  // aplican los LINEAMIENTOS de colocación del producto en el espacio.
  const promptGuide = productoNombre
    ? `prompt DETALLADO en INGLÉS para generar la ESCENA/FONDO donde se coloca el producto real "${productoNombre}" (${categoriaTxt}). NO describas el electrodoméstico en sí (ya lo aporta la foto real): describí el ambiente, encuadre, superficie, iluminación, props del hogar, estilo fotográfico y mood de marca Drean. OBLIGATORIO respetar la colocación del producto: ${placement}`
    : `prompt DETALLADO en INGLÉS para un generador de imágenes: describí escena, encuadre, iluminación, estilo fotográfico, el electrodoméstico Drean de ${categoriaTxt} y su contexto, mood de marca. OBLIGATORIO respetar la colocación del producto: ${placement} NO incluyas texto en la imagen salvo que el formato lo pida.`;

  const sys = `Sos director creativo de Drean (marca argentina de electrodomésticos: lavado, refrigeración, cocción). Diseñás contenido orgánico para redes (IG/FB) que replica lo que mejor performó, manteniendo identidad de marca (cercana, confiable, argentina, sin estridencias). Respondé SOLO JSON.`;
  const user = `PILAR: "${pilar}" — ${PILAR_DEF[pilar] ?? ""}
CATEGORÍA / PRODUCTO: ${categoriaTxt}${productoNombre ? ` — producto protagonista: ${productoNombre}` : ""}
FORMATO pedido: ${formato}
${variante > 1 ? `VARIANTE #${variante}: buscá un ángulo/tema/escena DISTINTO a las otras variantes (otro ambiente, otro momento del día, otro beneficio).\n` : ""}PIEZAS QUE MEJOR PERFORMARON en este pilar (referencia de qué funcionó):
${ref || "(sin data suficiente — usá tu criterio para el pilar)"}

Generá una pieza NUEVA para este pilar/categoría/formato, inspirada en los patrones ganadores (tema, hook, tono), sin copiar. Devolvé JSON con:
{
  "image_prompt": "${promptGuide}",
  "caption_es": "caption en español: hook potente en la 1ra línea + cuerpo breve + CTA claro",
  "hashtags": ["#...", "#..."],
  ${formato === "carrusel" ? `"slides": [{"titulo":"...","texto":"..."}] (4 a 6 slides con el guión del carrusel)` : `"slides": []`}
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

interface Pieza {
  imagen: string | null;
  caption: string;
  hashtags: string[];
  slides: Array<{ titulo: string; texto: string }>;
  image_prompt: string;
  error?: string;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      pilar?: string;
      categoria?: string;
      modelo?: string; // sku del catálogo (opcional)
      formato?: string;
      aspecto?: FalSizeKey;
      cantidad?: number;
      ref_urls?: string[]; // referencias de estilo elegidas manualmente (opcional)
    };
    const pilar = body.pilar && (PILARES as readonly string[]).includes(body.pilar) ? body.pilar : PILARES[0];
    const categoria = body.categoria && CATEGORIAS.some((c) => c.v === body.categoria) ? body.categoria : "porfolio";
    const formato = body.formato ?? "imagen"; // imagen | carrusel
    const aspecto: FalSizeKey = body.aspecto ?? "vertical";
    const producto = getModelo(body.modelo);
    const cantidad = Math.min(MAX_PIEZAS, Math.max(1, Math.floor(body.cantidad ?? 1)));

    // Top posts del pilar, priorizando la categoría.
    const topsAll = (await getTopByPilar())[pilar] ?? [];
    const tops = filtrarPorCategoria(topsAll, categoria);
    // Referencias de estilo: las elegidas manualmente, si no las top automáticas.
    const styleRefs =
      body.ref_urls && body.ref_urls.length > 0
        ? body.ref_urls.slice(0, 3)
        : tops.map((t) => t.thumbnail_url).filter((u): u is string => !!u).slice(0, 3);

    const engine = producto ? MODEL_PRODUCT : MODEL_IDEOGRAM;

    // Generar N piezas en paralelo (cada una con su propio brief para variedad).
    const piezas: Pieza[] = await Promise.all(
      Array.from({ length: cantidad }, (_, i) => i + 1).map(async (variante): Promise<Pieza> => {
        try {
          const brief = await disenarBrief(pilar, formato, categoria, categoriaBrief(categoria), producto?.nombre ?? null, tops, variante);
          const falInput: Record<string, unknown> = producto
            ? {
                image_url: driveImageUrl(producto.driveFileId),
                scene_description: sanitizeScene(brief.image_prompt),
                placement_type: "original",
                num_results: 1,
              }
            : {
                prompt: brief.image_prompt,
                image_size: FAL_SIZES[aspecto],
                num_images: 1,
                ...(styleRefs.length > 0 ? { image_urls: styleRefs } : {}),
              };
          const img = await falImage(engine, falInput);
          return {
            imagen: img.images[0]?.url ?? null,
            caption: brief.caption_es,
            hashtags: brief.hashtags ?? [],
            slides: brief.slides ?? [],
            image_prompt: brief.image_prompt,
          };
        } catch (e) {
          return {
            imagen: null,
            caption: "",
            hashtags: [],
            slides: [],
            image_prompt: "",
            error: e instanceof Error ? e.message : String(e),
          };
        }
      }),
    );

    // Si TODAS fallaron, devolver error para que la UI lo muestre.
    if (piezas.every((p) => p.error)) {
      return NextResponse.json({ ok: false, error: piezas[0]?.error ?? "Falló la generación." }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      pilar,
      categoria,
      formato,
      modelo: producto?.sku ?? null,
      producto: producto?.nombre ?? null,
      engine,
      piezas,
      style_refs: styleRefs,
      producto_ref: producto ? driveImageUrl(producto.driveFileId) : null,
      referencias: tops.slice(0, 6).map((t) => ({ permalink: t.permalink, message: t.message, media_type: t.media_type, engagement: t.engagement, video_views: t.video_views })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
