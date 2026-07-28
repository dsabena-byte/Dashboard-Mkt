import { NextResponse } from "next/server";
import { falQueueSubmit, falQueueVideoStatus } from "@/lib/fal-client";

// PILOTO de video UGC con SEEDANCE 2.0 (video NATIVO: persona + movimiento + voz
// en un solo paso, sin animar una foto). Diag para validar el método antes de
// construir el flujo. NO se usa en la app.
//
// Uso:
//   1) Encolar:  GET /api/diag/seedance?guion=<texto>&genero=mujer&go=1
//        → devuelve { handle: { request_id, status_url, response_url }, first_status, submit_raw }
//   2) Chequear: GET /api/diag/seedance?status=<status_url>&response=<response_url>
//        → { status, video_url }  (video_url aparece cuando termina)

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Variante "fast" = más barata/rápida para el piloto.
const MODEL = "bytedance/seedance-2.0/fast/text-to-video";

function buildPrompt(guion: string, genero: string): string {
  const persona = genero === "hombre" ? "man" : "woman";
  return (
    `Realistic UGC-style vertical selfie video of a natural, everyday Argentine ${persona} in their early 30s, ` +
    `at home in a casual setting, filming themselves with a phone front camera, talking directly to the camera. ` +
    `Authentic and spontaneous, like a real customer testimonial — NOT a polished actor or a commercial. ` +
    `Amateur phone-video look, natural indoor lighting, natural subtle head and hand movements, natural skin. ` +
    `They speak in warm, natural RIOPLATENSE ARGENTINE Spanish (Buenos Aires accent, voseo), with clear lip-sync. ` +
    `The person says, in Argentine Spanish: "${guion}". ` +
    `Vertical 9:16, single person, realistic and human.`
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

    const guion = u.searchParams.get("guion") ?? "Hace unos meses cambié mi lavarropas por un Drean y la verdad que se nota la diferencia: lava rápido y casi no hace ruido.";
    const genero = u.searchParams.get("genero") ?? "mujer";
    if (u.searchParams.get("go") !== "1") {
      return NextResponse.json({ ok: true, dry: true, model: MODEL, prompt: buildPrompt(guion, genero), hint: "Agregá &go=1 para encolar el clip." });
    }

    const input = { prompt: buildPrompt(guion, genero), duration: "8", resolution: "720p", aspect_ratio: "9:16", generate_audio: true };
    const handle = await falQueueSubmit(MODEL, input);
    out.model = MODEL;
    out.handle = handle;
    out.first_status = await falQueueVideoStatus(handle.statusUrl, handle.responseUrl);
    out.hint = "Repetí con ?status=<status_url>&response=<response_url> (encodeados) hasta que status sea COMPLETED y aparezca video_url.";
    return NextResponse.json(out);
  } catch (e) {
    out.error = e instanceof Error ? e.message : String(e);
    return NextResponse.json(out, { status: 500 });
  }
}
