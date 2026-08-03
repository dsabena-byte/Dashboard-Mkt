import { NextResponse } from "next/server";
import { falQueueSubmit } from "@/lib/fal-client";

// Reframe de VIDEO a otro ratio con outpainting generativo (Luma Ray 2 Flash
// Reframe en fal). El modelo extiende el encuadre al ratio destino sin deformar
// el foco. Es un render largo → cola async: acá SOLO se encola (submit) y se
// devuelve el handle; el cliente poolea el estado en /api/pauta/reframe-video/status.

export const dynamic = "force-dynamic";

const MODEL = "fal-ai/luma-dream-machine/ray-2-flash/reframe";
const RATIOS = new Set(["9:16", "1:1", "16:9"]);

export async function POST(request: Request) {
  try {
    const { video_url, aspect_ratio } = (await request.json()) as { video_url?: string; aspect_ratio?: string };
    if (!video_url) return NextResponse.json({ ok: false, error: "Falta el video de referencia." }, { status: 400 });
    if (!aspect_ratio || !RATIOS.has(aspect_ratio)) return NextResponse.json({ ok: false, error: "Ratio no soportado (9:16, 1:1, 16:9)." }, { status: 400 });
    const h = await falQueueSubmit(MODEL, { video_url, aspect_ratio });
    return NextResponse.json({ ok: true, requestId: h.requestId, statusUrl: h.statusUrl, responseUrl: h.responseUrl });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
