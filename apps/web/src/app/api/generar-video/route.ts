import { NextResponse } from "next/server";
import { falVideoQueue } from "@/lib/fal-client";

// Image-to-video: anima una pieza ya generada. Clips MUY cortos (~5s). Corre en
// la cola async de fal (lento: ~1-3 min). Selector Kling / Veo para comparar.

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Movimiento cinematográfico sutil por defecto (premium, sin sacudones).
const MOTION_BASE =
  "Subtle, premium, cinematic motion: a slow, smooth camera push-in with gentle parallax and soft breathing light; the Drean appliance stays sharp, elegant and the hero. High-end commercial feel. NO fast, shaky or jarring movement, no morphing or distortion of the product, no added text.";

// Modelos de video (image-to-video). IDs de fal — si alguno cambiara, se ajusta acá.
const VIDEO_MODELS: Record<string, { id: string; buildInput: (imageUrl: string, prompt: string, ar: string) => Record<string, unknown> }> = {
  kling: {
    id: "fal-ai/kling-video/v2.1/master/image-to-video",
    buildInput: (image_url, prompt, ar) => ({ image_url, prompt, duration: "5", aspect_ratio: ar, negative_prompt: "blur, distortion, morphing, text, watermark, extra limbs" }),
  },
  veo: {
    id: "fal-ai/veo3/image-to-video",
    buildInput: (image_url, prompt, ar) => ({ image_url, prompt, aspect_ratio: ar }),
  },
};

function aspectRatio(aspecto: string | undefined): string {
  if (aspecto === "feed") return "1:1";
  return "9:16"; // vertical / story
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      image_url?: string;
      modelo?: string; // "kling" | "veo"
      prompt?: string; // instrucciones de movimiento (opcional)
      aspecto?: string;
    };
    const imageUrl = (body.image_url ?? "").trim();
    if (!imageUrl) return NextResponse.json({ ok: false, error: "Falta image_url (la pieza a animar)." }, { status: 400 });

    const modeloKey = body.modelo === "veo" ? "veo" : "kling";
    const modelo = VIDEO_MODELS[modeloKey]!;
    const extra = (body.prompt ?? "").trim();
    const prompt = extra ? `${MOTION_BASE} ${extra}.` : MOTION_BASE;
    const ar = aspectRatio(body.aspecto);

    const input = modelo.buildInput(imageUrl, prompt, ar);
    const out = await falVideoQueue(modelo.id, input, { timeoutMs: 280000, pollMs: 5000 });

    if (!out.video_url) return NextResponse.json({ ok: false, error: "El modelo no devolvió video." }, { status: 502 });
    return NextResponse.json({ ok: true, engine: modelo.id, modelo: modeloKey, video_url: out.video_url });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
