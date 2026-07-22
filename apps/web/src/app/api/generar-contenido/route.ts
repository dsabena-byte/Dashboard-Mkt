import { NextResponse } from "next/server";
import { getTopByPilar, PILARES, CATEGORIAS, categoriaBrief, filtrarPorCategoria } from "@/lib/contenido-queries";
import { getModelo, driveImageUrl } from "@/lib/producto-catalog";
import { falImage, FAL_SIZES, type FalSizeKey } from "@/lib/fal-client";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

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
// - product-photography: toma el packshot REAL (product_image_url) y le genera
//   una escena on-brand detrás, manteniendo el producto exacto.
const MODEL_IDEOGRAM = "fal-ai/ideogram/v3";
const MODEL_PRODUCT = "fal-ai/image-apps-v2/product-photography";

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
  categoriaTxt: string,
  productoNombre: string | null,
  tops: TopRef[],
): Promise<Brief> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY no configurada.");
  const ref = tops
    .slice(0, 6)
    .map((t, i) => `${i + 1}. [${t.media_type ?? "?"}] interacciones=${t.engagement} views=${t.video_views} — "${(t.message ?? "").slice(0, 180)}"`)
    .join("\n");

  // Si hay un producto real elegido, el prompt de imagen describe la ESCENA /
  // fondo donde va ese producto (product-photography mantiene el producto).
  // Si no, describe la escena completa incluyendo un electrodoméstico Drean.
  const promptGuide = productoNombre
    ? `prompt DETALLADO en INGLÉS para generar la ESCENA/FONDO donde se coloca el producto real "${productoNombre}" (${categoriaTxt}). NO describas el electrodoméstico en sí (ya lo aporta la foto real): describí el ambiente, encuadre, superficie, iluminación, props del hogar, estilo fotográfico y mood de marca Drean, que combine con el producto.`
    : `prompt DETALLADO en INGLÉS para un generador de imágenes: describí escena, encuadre, iluminación, estilo fotográfico, el electrodoméstico Drean de ${categoriaTxt} y su contexto, mood de marca. NO incluyas texto en la imagen salvo que el formato lo pida.`;

  const sys = `Sos director creativo de Drean (marca argentina de electrodomésticos: lavado, refrigeración, cocción). Diseñás contenido orgánico para redes (IG/FB) que replica lo que mejor performó, manteniendo identidad de marca (cercana, confiable, argentina, sin estridencias). Respondé SOLO JSON.`;
  const user = `PILAR: "${pilar}" — ${PILAR_DEF[pilar] ?? ""}
CATEGORÍA / PRODUCTO: ${categoriaTxt}${productoNombre ? ` — producto protagonista: ${productoNombre}` : ""}
FORMATO pedido: ${formato}
PIEZAS QUE MEJOR PERFORMARON en este pilar (referencia de qué funcionó):
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
      temperature: 0.8,
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const j = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return JSON.parse(j.choices?.[0]?.message?.content ?? "{}") as Brief;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      pilar?: string;
      categoria?: string;
      modelo?: string; // sku del catálogo (opcional)
      formato?: string;
      aspecto?: FalSizeKey;
    };
    const pilar = body.pilar && (PILARES as readonly string[]).includes(body.pilar) ? body.pilar : PILARES[0];
    const categoria = body.categoria && CATEGORIAS.some((c) => c.v === body.categoria) ? body.categoria : "porfolio";
    const formato = body.formato ?? "imagen"; // imagen | carrusel
    const aspecto: FalSizeKey = body.aspecto ?? "vertical";
    const producto = getModelo(body.modelo);

    // Top posts del pilar, priorizando la categoría para las referencias de estilo.
    const topsAll = (await getTopByPilar())[pilar] ?? [];
    const tops = filtrarPorCategoria(topsAll, categoria);
    const styleRefs = tops
      .map((t) => t.thumbnail_url)
      .filter((u): u is string => !!u)
      .slice(0, 3);

    const brief = await disenarBrief(pilar, formato, categoriaBrief(categoria), producto?.nombre ?? null, tops);

    // Elegir engine:
    // - Con producto real → product-photography (mantiene el packshot).
    // - Sin producto → Ideogram v3 con referencias de estilo de los posts reales.
    let engine: string;
    let falInput: Record<string, unknown>;
    if (producto) {
      engine = MODEL_PRODUCT;
      falInput = {
        product_image_url: driveImageUrl(producto.driveFileId),
        prompt: brief.image_prompt,
      };
    } else {
      engine = MODEL_IDEOGRAM;
      falInput = {
        prompt: brief.image_prompt,
        image_size: FAL_SIZES[aspecto],
        num_images: 1,
        ...(styleRefs.length > 0 ? { image_urls: styleRefs } : {}),
      };
    }

    const img = await falImage(engine, falInput);

    return NextResponse.json({
      ok: true,
      pilar,
      categoria,
      formato,
      modelo: producto?.sku ?? null,
      producto: producto?.nombre ?? null,
      engine,
      imagen: img.images[0]?.url ?? null,
      caption: brief.caption_es,
      hashtags: brief.hashtags ?? [],
      slides: brief.slides ?? [],
      image_prompt: brief.image_prompt,
      style_refs: styleRefs,
      producto_ref: producto ? driveImageUrl(producto.driveFileId) : null,
      referencias: tops.slice(0, 6).map((t) => ({ permalink: t.permalink, message: t.message, media_type: t.media_type, engagement: t.engagement, video_views: t.video_views })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
