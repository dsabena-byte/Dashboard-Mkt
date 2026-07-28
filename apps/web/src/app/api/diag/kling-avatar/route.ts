import { NextResponse } from "next/server";
import { falImage, falRun, falQueueSubmit, falQueueVideoStatus, FAL_SIZES } from "@/lib/fal-client";

// PILOTO UGC-v2 con KLING AI AVATAR v2 PRO (audio-driven): retrato limpio + NUESTRO
// audio (ElevenLabs) → video de testimonio con la BOCA GENERADA DE CERO (nativa, no
// lip-sync pegado → sin borroso). La pronunciación la controlamos en el audio.
//
// Clave (aprendizaje de OmniHuman): el retrato tiene que ser cara+hombros, SIN manos
// ni celular, con la cara ocupando >=40% del cuadro (Kling rinde mejor así y no
// intenta animar manos/objetos, que es lo que rompía).
//
// Uso:
//   1) Encolar: GET /api/diag/kling-avatar?genero=hombre&guion=<texto>&voz=<id>&go=1
//        (opcional: &imagen=<url_retrato> para reusar uno; &audio=<url> para reusar audio)
//        → { imagen_url, audio_url, handle, first_status }
//   2) Chequear: GET /api/diag/kling-avatar?status=<status_url>&response=<response_url>

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MODEL_AVATAR = "fal-ai/kling-video/ai-avatar/v2/pro";
const MODEL_TTS = "fal-ai/elevenlabs/tts/multilingual-v2";
const MODEL_PERSONA = "fal-ai/ideogram/v3";
const VOZ_DEFAULT = "KqSsYz0buWgkvSbaGn1n"; // Agustín (masc, Buenos Aires)

function sujeto(genero: string): string {
  const gen = genero === "hombre" ? "man" : "woman";
  return `an everyday Argentine ${gen} in their early 30s`;
}

// Retrato pensado para Kling: cara dominante, SIN manos ni celular en cuadro.
function promptRetrato(genero: string): string {
  return (
    `Photorealistic vertical head-and-shoulders portrait of ${sujeto(genero)}. ` +
    `The face is large and dominant, occupying at least half of the frame, centered, ` +
    `looking straight into a phone front camera with a relaxed, friendly, natural expression. ` +
    `Casual everyday person at home, authentic UGC selfie vibe (not a model, not over-retouched). ` +
    `Evenly lit natural face, realistic detailed skin with pores, catchlights in the eyes, sharp focus, high resolution. ` +
    `Simple tidy home background with subtle depth of field. ` +
    `IMPORTANT: only head and shoulders visible — NO hands, NO phone, NO arms in the frame. ` +
    `Correct facial anatomy, symmetric natural face, normal eyes. ` +
    `Avoid: blurry, low quality, distorted or deformed face, hands, phone, arms, text, watermark, logo.`
  );
}

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

    const genero = u.searchParams.get("genero") ?? "hombre";
    const guion = u.searchParams.get("guion") ?? "Hace unos meses cambié mi lavarropas por un Dreán y la verdad, lava rapidísimo y la ropa queda impecable.";
    const voz = u.searchParams.get("voz") ?? VOZ_DEFAULT;
    const imagenParam = u.searchParams.get("imagen");
    const audioParam = u.searchParams.get("audio");

    if (u.searchParams.get("go") !== "1") {
      return NextResponse.json({ ok: true, dry: true, model: MODEL_AVATAR, genero, guion, voz, retrato_prompt: promptRetrato(genero), hint: "Agregá &go=1 para generar. Opcional: &imagen=<url> y/o &audio=<url> para reusar." });
    }

    // 1) Retrato limpio (cara+hombros, sin manos/celular) — salvo que pasen ?imagen=.
    let imagenUrl: string | undefined = imagenParam ?? undefined;
    if (!imagenUrl) {
      const img = await falImage(MODEL_PERSONA, { prompt: promptRetrato(genero), image_size: FAL_SIZES.story, num_images: 1, rendering_speed: "QUALITY" });
      imagenUrl = img.images[0]?.url;
    }
    out.imagen_url = imagenUrl ?? null;
    if (!imagenUrl) { out.error = "No se generó el retrato."; return NextResponse.json(out, { status: 502 }); }

    // 2) Nuestro audio (ElevenLabs) — salvo que pasen ?audio= (p.ej. el ya aprobado).
    let audioUrl: string | undefined = audioParam ?? undefined;
    if (!audioUrl) {
      const tts = await falRun(MODEL_TTS, { text: guion, voice: voz });
      audioUrl = ((tts.audio as { url?: string } | undefined)?.url) ?? (tts.audio_url as string | undefined);
    }
    out.audio_url = audioUrl ?? null;
    if (!audioUrl) { out.error = "TTS no devolvió audio."; return NextResponse.json(out, { status: 502 }); }

    // 3) Kling AI Avatar v2 Pro: retrato + audio → video con boca nativa.
    const handle = await falQueueSubmit(MODEL_AVATAR, { image_url: imagenUrl, audio_url: audioUrl });
    out.model = MODEL_AVATAR;
    out.handle = handle;
    out.first_status = await falQueueVideoStatus(handle.statusUrl, handle.responseUrl);
    out.hint = "Repetí con ?status=<status_url>&response=<response_url> (encodeados) hasta COMPLETED y video_url.";
    return NextResponse.json(out);
  } catch (e) {
    out.error = e instanceof Error ? e.message : String(e);
    return NextResponse.json(out, { status: 500 });
  }
}
