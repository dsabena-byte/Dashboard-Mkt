import { NextResponse } from "next/server";
import { getTopByPilar, PILARES } from "@/lib/contenido-queries";
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

const MODELS: Record<string, string> = {
  flux: "fal-ai/flux-2-pro",   // realismo / producto / lifestyle
  ideogram: "fal-ai/ideogram/v3", // texto dentro de la imagen (placas, carrusel con copy)
};

interface Brief {
  image_prompt: string;
  caption_es: string;
  hashtags: string[];
  slides?: Array<{ titulo: string; texto: string }>;
}

async function disenarBrief(pilar: string, formato: string, tops: Array<{ message: string | null; media_type: string | null; engagement: number; video_views: number }>): Promise<Brief> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY no configurada.");
  const ref = tops
    .slice(0, 6)
    .map((t, i) => `${i + 1}. [${t.media_type ?? "?"}] interacciones=${t.engagement} views=${t.video_views} — "${(t.message ?? "").slice(0, 180)}"`)
    .join("\n");

  const sys = `Sos director creativo de Drean (marca argentina de electrodomésticos: lavado, refrigeración, cocción). Diseñás contenido orgánico para redes (IG/FB) que replica lo que mejor performó, manteniendo identidad de marca (cercana, confiable, argentina, sin estridencias). Respondé SOLO JSON.`;
  const user = `PILAR: "${pilar}" — ${PILAR_DEF[pilar] ?? ""}
FORMATO pedido: ${formato}
PIEZAS QUE MEJOR PERFORMARON en este pilar (referencia de qué funcionó):
${ref || "(sin data suficiente — usá tu criterio para el pilar)"}

Generá una pieza NUEVA para este pilar/formato, inspirada en los patrones ganadores (tema, hook, tono), sin copiar. Devolvé JSON con:
{
  "image_prompt": "prompt DETALLADO en INGLÉS para un generador de imágenes (FLUX): describí escena, encuadre, iluminación, estilo fotográfico, producto/contexto de electrodoméstico, mood de marca. NO incluyas texto en la imagen salvo que el formato lo pida.",
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
    const body = (await request.json()) as { pilar?: string; formato?: string; modelo?: string; aspecto?: FalSizeKey };
    const pilar = body.pilar && (PILARES as readonly string[]).includes(body.pilar) ? body.pilar : PILARES[0];
    const formato = body.formato ?? "imagen"; // imagen | carrusel
    const modelo = body.modelo && MODELS[body.modelo] ? body.modelo : (formato === "carrusel" ? "ideogram" : "flux");
    const aspecto: FalSizeKey = body.aspecto ?? "vertical";

    const tops = (await getTopByPilar())[pilar] ?? [];
    const brief = await disenarBrief(pilar, formato, tops);

    const img = await falImage(MODELS[modelo]!, {
      prompt: brief.image_prompt,
      image_size: FAL_SIZES[aspecto],
      num_images: 1,
    });

    return NextResponse.json({
      ok: true,
      pilar,
      formato,
      modelo,
      imagen: img.images[0]?.url ?? null,
      caption: brief.caption_es,
      hashtags: brief.hashtags ?? [],
      slides: brief.slides ?? [],
      image_prompt: brief.image_prompt,
      referencias: tops.slice(0, 6).map((t) => ({ permalink: t.permalink, message: t.message, media_type: t.media_type, engagement: t.engagement, video_views: t.video_views })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
