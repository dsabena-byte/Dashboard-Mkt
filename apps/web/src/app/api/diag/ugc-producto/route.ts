import { NextResponse } from "next/server";
import { falImage, falQueueSubmit, falQueueVideoStatus } from "@/lib/fal-client";
import { getModelo, driveImageUrl } from "@/lib/producto-catalog";

// PILOTO: UGC con el PRODUCTO DREAN REAL en la escena. Dos pasos encadenados
// (reusa lo que ya existe en la app):
//   1) FRAME: se compone una imagen "persona + la Drean real" con nano-banana
//      /edit, pasando el packshot del catálogo como referencia (image_urls) para
//      que el electrodoméstico salga IDÉNTICO a la foto.
//   2) VIDEO: ese frame va a un modelo IMAGE-TO-VIDEO (con audio) para que la
//      persona hable al lado del producto real.
// Diag para validar la calidad ANTES de tocar el flujo UGC productivo. NO se usa
// en la app. Solo gasta un render cuando lo corrés con &go=1.
//
// Uso:
//   1) Encolar:  GET /api/diag/ugc-producto?sku=CD7609EI&guion=<texto>&genero=hombre&escenario=cocina&go=1
//        → { frame_url, handle: { status_url, response_url }, first_status }
//   2) Chequear: GET /api/diag/ugc-producto?status=<status_url>&response=<response_url>
//        → { status, video_url }

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MODEL_EDIT = "fal-ai/nano-banana/edit"; // compone escena manteniendo el producto de referencia
// Image-to-video con audio (misma familia que el UGC nativo). Se puede pisar con
// ?modelo_video=... para probar alternativas (Kling/Veo i2v, etc.).
const MODEL_VIDEO_DEFAULT = "bytedance/seedance-2.0/fast/image-to-video";

const ESCENARIOS: Record<string, string> = {
  cocina: "in their home kitchen",
  lavando: "in their home laundry area, next to the washing machine",
  cocinando: "cooking something in their home kitchen",
  living: "in their living room at home",
  selfie: "at home",
};

const EDAD: Record<string, string> = { joven: "in their mid 20s", adulto: "in their early 40s", mayor: "around 60 years old" };
const VESTIMENTA: Record<string, string> = {
  informal: "casual everyday clothes (a t-shirt or sweater)",
  camisa: "a casual button-up shirt",
  prolijo: "a smart-casual, neat and tidy outfit",
  deportivo: "sporty casual clothes",
  trabajo: "clean work clothes",
};

function buildFramePrompt(nombre: string, medidas: string | undefined, genero: string, escenario: string | null, edad: string | null, vestimenta: string | null): string {
  const persona = genero === "hombre" ? "man" : "woman";
  const edadTxt = edad ? (EDAD[edad] ?? edad) : "in their early 30s";
  const ropa = vestimenta ? `, wearing ${VESTIMENTA[vestimenta] ?? vestimenta}` : "";
  const donde = escenario ? (ESCENARIOS[escenario] ?? escenario) : ESCENARIOS.cocina;
  return (
    `Photorealistic vertical 9:16 UGC-style photo. An everyday Argentine ${persona} ${edadTxt}${ropa}, ${donde}, ` +
    `holding a phone as if filming a casual selfie video, talking to the camera, standing right next to the Drean ${nombre} shown in the provided product photo. ` +
    `CRITICAL: keep the appliance EXACTLY IDENTICAL to the reference photo — same design, doors, finish, controls and proportions${medidas ? ` (${medidas})` : ""}. Do NOT redesign or restyle it. ` +
    `The product is clearly visible in the scene, well integrated (not floating). Natural home lighting, amateur phone-photo look, authentic and candid — NOT a polished commercial. Single person, realistic and human. ` +
    `Avoid: distorted product, extra doors/handles, warped proportions, text, watermark, logo overlay.`
  );
}

function buildVideoPrompt(guion: string): string {
  return (
    `Realistic UGC-style vertical video: the person in the image talks to the camera in a natural, spontaneous way, like a real customer testimonial (amateur phone video, natural indoor lighting, subtle natural head and hand movements). ` +
    `They speak at a NORMAL, calm, natural conversational pace in warm RIOPLATENSE ARGENTINE Spanish (Buenos Aires accent, voseo). Not slowed-down or over-enunciated, but also NOT rushed. ` +
    `Keep the Drean appliance in the scene UNCHANGED and undistorted. ` +
    `The person says, calmly and at a natural pace: "${guion}". Vertical 9:16, single person, realistic and human.`
  );
}

// --- Modo INSERT SHOT: el producto real en una escena de hogar, SIN personas.
// Al no haber una persona real, image-to-video no viola la content policy y sí
// anima. Sirve como b-roll fiel del producto para intercalar con el talking-head.
function buildInsertFramePrompt(nombre: string, medidas: string | undefined, escenario: string | null): string {
  const donde = escenario ? (ESCENARIOS[escenario] ?? escenario) : ESCENARIOS.cocina;
  return (
    `Photorealistic vertical 9:16 photo of the Drean ${nombre} shown in the provided product photo, placed naturally ${donde} in a real Argentine home. ` +
    `CRITICAL: keep the appliance EXACTLY IDENTICAL to the reference photo — same design, doors, finish, controls and proportions${medidas ? ` (${medidas})` : ""}. Do NOT redesign or restyle it. ` +
    `Cozy realistic home setting around it, natural window light, shallow depth of field, authentic and lived-in (not a showroom, not a polished commercial). ` +
    `NO people, NO hands. Single hero appliance, well integrated (not floating). ` +
    `Avoid: people, hands, distorted product, extra doors/handles, warped proportions, text, watermark, logo overlay.`
  );
}

function buildInsertVideoPrompt(): string {
  return (
    `Cinematic product b-roll: a slow, smooth camera movement (gentle push-in and slight parallax) around the Drean appliance in a real home kitchen. ` +
    `The appliance stays EXACTLY UNCHANGED and undistorted — do not morph, melt or restyle it. Natural window light, shallow depth of field, calm and premium but realistic. ` +
    `NO people appear. Vertical 9:16, photorealistic, subtle and elegant motion.`
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

    const sku = u.searchParams.get("sku") ?? "CD7609EI";
    const modelo = getModelo(sku);
    if (!modelo) return NextResponse.json({ ok: false, error: `SKU desconocido: ${sku}. Ver producto-catalog.ts.` }, { status: 400 });
    const packshot = driveImageUrl(modelo.driveFileId);

    const guion = u.searchParams.get("guion") ?? "No sabía esto: el grill a gas dora la comida como en una parrilla. Queda espectacular.";
    const genero = u.searchParams.get("genero") ?? "hombre";
    const escenario = u.searchParams.get("escenario");
    const edad = u.searchParams.get("edad");
    const vestimenta = u.searchParams.get("vestimenta");
    const modeloVideo = u.searchParams.get("modelo_video") ?? MODEL_VIDEO_DEFAULT;
    // modo: "insert" (producto sin persona → sí anima) | "persona" (persona +
    // producto → el FRAME sirve, pero i2v lo rechaza por content policy).
    const modo = u.searchParams.get("modo") === "persona" ? "persona" : "insert";
    const framePrompt = modo === "persona"
      ? buildFramePrompt(modelo.nombre, modelo.medidas, genero, escenario, edad, vestimenta)
      : buildInsertFramePrompt(modelo.nombre, modelo.medidas, escenario);
    const videoPrompt = modo === "persona" ? buildVideoPrompt(guion) : buildInsertVideoPrompt();

    if (u.searchParams.get("go") !== "1") {
      return NextResponse.json({
        ok: true, dry: true, modo, sku, producto: modelo.nombre, packshot,
        model_edit: MODEL_EDIT, model_video: modeloVideo,
        frame_prompt: framePrompt, video_prompt: videoPrompt,
        hint: "Agregá &go=1 para componer el frame y encolar el video. modo=insert (default: producto real animado, SÍ genera video) | modo=persona (persona+producto: el frame sirve pero i2v lo rechaza por content policy). Escenarios: cocina|lavando|cocinando|living|selfie.",
      });
    }

    // Paso 1: componer el frame con el producto real (nano-banana edit).
    const frame = await falImage(MODEL_EDIT, { prompt: framePrompt, image_urls: [packshot], num_images: 1 });
    const frameUrl = frame.images[0]?.url;
    if (!frameUrl) return NextResponse.json({ ok: false, error: "No se generó el frame (nano-banana edit).", packshot }, { status: 500 });
    out.modo = modo;
    out.frame_url = frameUrl;

    // Paso 2: animar. En insert (sin persona) se anima el producto; en persona
    // el i2v lo rechaza por content policy (queda de referencia). Sin audio en
    // insert (es b-roll para intercalar).
    const input = { image_url: frameUrl, prompt: videoPrompt, duration: modo === "insert" ? "5" : "8", resolution: "720p", aspect_ratio: "9:16", generate_audio: modo === "persona" };
    const handle = await falQueueSubmit(modeloVideo, input);
    out.sku = sku;
    out.producto = modelo.nombre;
    out.packshot = packshot;
    out.model_video = modeloVideo;
    out.handle = handle;
    out.first_status = await falQueueVideoStatus(handle.statusUrl, handle.responseUrl);
    // Link listo para clickear que chequea el estado (ya URL-encodeado).
    out.check_url = `${u.origin}${u.pathname}?status=${encodeURIComponent(handle.statusUrl)}&response=${encodeURIComponent(handle.responseUrl)}`;
    out.hint = "1) Abrí frame_url (que el producto salga fiel a la Drean). 2) Esperá ~2-3 min y abrí check_url; repetí hasta que aparezca video_url.";
    return NextResponse.json(out);
  } catch (e) {
    out.error = e instanceof Error ? e.message : String(e);
    return NextResponse.json(out, { status: 500 });
  }
}
