import { NextResponse } from "next/server";
import { falRun } from "@/lib/fal-client";

// DIAG de PRONUNCIACIÓN (barato: SOLO audio, sin video/lip-sync). Sirve para
// iterar la grafía del guion hasta que ElevenLabs pronuncie perfecto la marca y
// las palabras difíciles ("Dreán", "lavarropas", "se nota") ANTES de pagar un
// video. TTS es síncrono y cuesta centavos.
//
// Uso:
//   GET /api/diag/tts?guion=<texto>&voz=<voice_id>&go=1  → { audio_url }
//   GET /api/diag/tts?probar=1&voz=<voice_id>&go=1       → prueba varias grafías
//     de "Drean" de una sola vez y devuelve un audio por variante para comparar.
//
// Voces argentinas (ElevenLabs voice_id):
//   Agustín (masc, Bs As): KqSsYz0buWgkvSbaGn1n
//   Beto    (masc, Arg):    ukupJ4zdf9bo1Py6MiO6

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MODEL_TTS = "fal-ai/elevenlabs/tts/multilingual-v2";
const VOZ_DEFAULT = "KqSsYz0buWgkvSbaGn1n"; // Agustín (masc, Buenos Aires)

// Distintas grafías de la marca para forzar la pronunciación /dre'an/ (evitar
// que ElevenLabs lea "drian" juntando la e-a en diptongo).
const VARIANTES_MARCA = ["Dreán", "Dre-án", "Dre án", "Drean", "Drehán"];

function frase(marca: string): string {
  return `Cambié el lavarropas por uno de ${marca} y se nota la diferencia.`;
}

async function tts(text: string, voice: string): Promise<string | null> {
  const r = await falRun(MODEL_TTS, { text, voice });
  return ((r.audio as { url?: string } | undefined)?.url) ?? (r.audio_url as string | undefined) ?? null;
}

export async function GET(request: Request) {
  const out: Record<string, unknown> = {};
  try {
    const u = new URL(request.url);
    const voz = u.searchParams.get("voz") ?? VOZ_DEFAULT;

    if (u.searchParams.get("go") !== "1") {
      return NextResponse.json({ ok: true, dry: true, voz, hint: "Agregá &go=1. Modo prueba: &probar=1 compara grafías de la marca." });
    }

    // Modo comparación de grafías de la marca.
    if (u.searchParams.get("probar") === "1") {
      const resultados: Record<string, string | null> = {};
      for (const marca of VARIANTES_MARCA) {
        resultados[marca] = await tts(frase(marca), voz);
      }
      out.voz = voz;
      out.frase = frase("<marca>");
      out.variantes = resultados;
      out.hint = "Escuchá cada audio y decime qué grafía suena bien 'Dreán'. Esa la fijamos en el generador.";
      return NextResponse.json(out);
    }

    // Modo guion libre.
    const guion = u.searchParams.get("guion") ?? frase("Dre-án");
    const audio = await tts(guion, voz);
    out.voz = voz;
    out.guion = guion;
    out.audio_url = audio;
    if (!audio) { out.error = "TTS no devolvió audio"; return NextResponse.json(out, { status: 502 }); }
    return NextResponse.json(out);
  } catch (e) {
    out.error = e instanceof Error ? e.message : String(e);
    return NextResponse.json(out, { status: 500 });
  }
}
