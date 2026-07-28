import { NextResponse } from "next/server";
import { falRun, falQueueSubmit, falQueueVideoStatus } from "@/lib/fal-client";

// PLAN B (pronunciación 100%): toma un VIDEO (p.ej. el de Seedance) + genera
// NUESTRO audio con ElevenLabs (pronunciación correcta y determinística) y
// re-sincroniza los labios (lip-sync). Diag para validar la calidad del lipsync
// antes de construir el flujo.
//
// Uso:
//   1) Encolar: GET /api/diag/lipsync?video=<url_video>&guion=<texto>&voz=Rachel&go=1
//        → { audio_url, handle, first_status }
//   2) Chequear: GET /api/diag/lipsync?status=<status_url>&response=<response_url>

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MODEL_TTS = "fal-ai/elevenlabs/tts/multilingual-v2";
// Modelo de lip-sync (video + audio → mismo video con la boca re-sincronizada).
const MODEL_LIPSYNC = "fal-ai/sync-lipsync/v2/pro";

export async function GET(request: Request) {
  const out: Record<string, unknown> = {};
  try {
    const u = new URL(request.url);
    const statusUrl = u.searchParams.get("status");
    const responseUrl = u.searchParams.get("response");
    if (statusUrl && responseUrl) {
      out.check = await falQueueVideoStatus(statusUrl, responseUrl);
      return NextResponse.json(out);
    }

    const video = u.searchParams.get("video");
    const guion = u.searchParams.get("guion") ?? "Hace unos meses cambié el lavarropas por uno de Dreán y se nota la diferencia: lava rápido, casi no vibra y la ropa queda impecable.";
    const voz = u.searchParams.get("voz") ?? "Rachel"; // TODO: cambiar por una voz rioplatense
    const lipsyncModel = u.searchParams.get("modelo") ?? MODEL_LIPSYNC;
    if (!video) return NextResponse.json({ ok: false, error: "Falta ?video=<url del video de Seedance>" }, { status: 400 });
    if (u.searchParams.get("go") !== "1") return NextResponse.json({ ok: true, dry: true, guion, voz, lipsyncModel, hint: "Agregá &go=1 para generar." });

    // 1) Voz nuestra (ElevenLabs, síncrono).
    const tts = await falRun(MODEL_TTS, { text: guion, voice: voz });
    const audioUrl = ((tts.audio as { url?: string } | undefined)?.url) ?? (tts.audio_url as string | undefined);
    out.audio_url = audioUrl ?? null;
    if (!audioUrl) { out.error = "TTS no devolvió audio"; return NextResponse.json(out, { status: 502 }); }

    // 2) Lip-sync: video + nuestro audio → boca re-sincronizada.
    const handle = await falQueueSubmit(lipsyncModel, { video_url: video, audio_url: audioUrl });
    out.lipsyncModel = lipsyncModel;
    out.handle = handle;
    out.first_status = await falQueueVideoStatus(handle.statusUrl, handle.responseUrl);
    out.hint = "Repetí con ?status=<status_url>&response=<response_url> hasta COMPLETED y video_url.";
    return NextResponse.json(out);
  } catch (e) {
    out.error = e instanceof Error ? e.message : String(e);
    return NextResponse.json(out, { status: 500 });
  }
}
