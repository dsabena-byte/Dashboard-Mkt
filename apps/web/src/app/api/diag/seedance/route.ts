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

// Guía fonética SOLO para las palabras que Seedance rompe (marca y términos
// clave). Se pasa en el prompt SIN pedir que hable lento/claro (eso mataba la
// naturalidad): el objetivo es que las diga bien manteniendo el ritmo normal.
// Se puede extender con ?fonetica=palabra=como-suena;otra=como-suena
const FONETICA_BASE: Record<string, string> = {
  "Dreán": "dre-AN (two clear syllables, stress on the last; NEVER 'drian' or 'drin')",
  "Drean": "dre-AN (two clear syllables, stress on the last; NEVER 'drian' or 'drin')",
  "lavarropas": "la-va-RRO-pas",
};

function guiaFonetica(extra?: string | null): string {
  const dict: Record<string, string> = { ...FONETICA_BASE };
  if (extra) {
    for (const par of extra.split(";")) {
      const [w, s] = par.split("=");
      if (w && s) dict[w.trim()] = s.trim();
    }
  }
  return Object.entries(dict).map(([w, s]) => `"${w}" = ${s}`).join("; ");
}

// Escenarios/tomas para dar VARIEDAD (no siempre "hablando de frente"). Cada uno
// describe el entorno + la acción; la persona sigue dando el testimonio en su voz.
const ESCENARIOS: Record<string, string> = {
  selfie: "at home in a casual setting, filming themselves with a phone front camera, talking directly to the camera",
  sillon: "relaxed on the living-room sofa at home, phone propped up in front of them, talking casually to the camera",
  compu: "sitting at a desk with a laptop, glancing at the screen and then turning to talk to the camera",
  cocina: "standing in a home kitchen next to the appliances, doing a small everyday task while talking to the camera",
  desempacando: "unpacking grocery and shopping bags on the kitchen counter at home, talking to the camera in between",
  lavando: "next to the washing machine at home, loading or taking out laundry, talking to the camera while doing it",
  doblando: "folding freshly washed laundry on the bed or sofa, talking casually to the camera",
  cafe: "sitting relaxed at home with a cup of coffee or mate, talking to the camera",
};

function buildPrompt(guion: string, genero: string, escenario?: string | null, fonetica?: string | null): string {
  const persona = genero === "hombre" ? "man" : "woman";
  // Escenario: si es una CLAVE conocida usa el preset; si no, se toma el texto
  // LIBRE tal cual (podés describir cualquier escena). Si no hay, "selfie".
  const escena = escenario ? (ESCENARIOS[escenario] ?? escenario) : ESCENARIOS.selfie;
  return (
    `Realistic UGC-style vertical video of a natural, everyday Argentine ${persona} in their early 30s, ` +
    `${escena}. ` +
    `Authentic and spontaneous, like a real customer testimonial — NOT a polished actor or a commercial. ` +
    `Amateur phone-video look, natural indoor lighting, natural subtle head and hand movements, natural skin. ` +
    // Ritmo NORMAL y espontáneo (no lento, no sobre-articulado) para no perder naturalidad.
    `They speak at a NORMAL, natural, spontaneous conversational pace in warm RIOPLATENSE ARGENTINE Spanish (Buenos Aires accent, voseo). Do NOT slow down and do NOT over-enunciate. ` +
    // La corrección se logra con clave fonética puntual, no bajando el ritmo.
    `Pronounce the Spanish correctly and naturally. Pronunciation key for specific words: ${guiaFonetica(fonetica)}. ` +
    `The person says, naturally and at a normal pace: "${guion}". ` +
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

    const guion = u.searchParams.get("guion") ?? "Hace poco cambié el lavarropas y no lo puedo creer: lava en la mitad de tiempo, casi no hace ruido y la ropa queda impecable. Re contenta.";
    const genero = u.searchParams.get("genero") ?? "mujer";
    const escenario = u.searchParams.get("escenario");
    const fonetica = u.searchParams.get("fonetica");
    if (u.searchParams.get("go") !== "1") {
      return NextResponse.json({ ok: true, dry: true, model: MODEL, escenarios: Object.keys(ESCENARIOS), prompt: buildPrompt(guion, genero, escenario, fonetica), hint: "Agregá &go=1 para encolar el clip. Probá &escenario=sillon|compu|cocina|desempacando|lavando|doblando|cafe|selfie" });
    }

    const input = { prompt: buildPrompt(guion, genero, escenario, fonetica), duration: "8", resolution: "720p", aspect_ratio: "9:16", generate_audio: true };
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
