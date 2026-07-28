import { NextResponse } from "next/server";
import { falRun, falQueueSubmit, falQueueVideoStatus } from "@/lib/fal-client";

// Diagnóstico del pipeline de video UGC (voz + OmniHuman). NO se usa en la app;
// sirve para VALIDAR que fal responde bien y ver las URLs reales de la cola.
//
// Uso:  GET /api/diag/ugc-video?image=<url_retrato>&text=Hola,%20probando
//   - hace TTS (voz) + encola OmniHuman y devuelve el handle (request_id +
//     status_url/response_url REALES de fal) + un primer chequeo de estado.
//   - repetí la llamada con &status=<status_url>&response=<response_url> para ver
//     el estado sin re-encolar.

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MODEL_TTS = "fal-ai/elevenlabs/tts/multilingual-v2";
const MODEL_AVATAR = "fal-ai/bytedance/omnihuman";

export async function GET(request: Request) {
  const out: Record<string, unknown> = {};
  try {
    const u = new URL(request.url);
    const statusUrl = u.searchParams.get("status");
    const responseUrl = u.searchParams.get("response");
    // Modo "sólo chequear estado".
    if (statusUrl && responseUrl) {
      out.check = await falQueueVideoStatus(statusUrl, responseUrl);
      return NextResponse.json(out);
    }
    const image = u.searchParams.get("image");
    const text = u.searchParams.get("text") ?? "Hola, estoy probando el generador de contenido.";
    if (!image) return NextResponse.json({ ok: false, error: "Falta ?image=<url del retrato>" }, { status: 400 });

    const tts = await falRun(MODEL_TTS, { text, voice: "Rachel" });
    const audioUrl = ((tts.audio as { url?: string } | undefined)?.url) ?? (tts.audio_url as string | undefined);
    out.audio_url = audioUrl ?? null;
    if (!audioUrl) { out.error = "TTS no devolvió audio"; return NextResponse.json(out, { status: 502 }); }

    const handle = await falQueueSubmit(MODEL_AVATAR, { image_url: image, audio_url: audioUrl });
    out.handle = handle;
    // primer chequeo inmediato
    out.first_status = await falQueueVideoStatus(handle.statusUrl, handle.responseUrl);
    out.hint = "Repetí con ?status=<status_url>&response=<response_url> (encodeados) hasta que status sea COMPLETED y aparezca video_url.";
    return NextResponse.json(out);
  } catch (e) {
    out.error = e instanceof Error ? e.message : String(e);
    return NextResponse.json(out, { status: 500 });
  }
}
