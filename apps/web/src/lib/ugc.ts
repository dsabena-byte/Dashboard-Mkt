import "server-only";
import { falImage, falRun, falVideoQueue, FAL_SIZES } from "@/lib/fal-client";
import { UGC_VOCES } from "@/lib/ugc-opciones";
import { diferencialesTexto } from "@/lib/diferenciales";

// Generación de contenido UGC (persona hablando a cámara) para Drean.
// Pipeline sobre fal.ai: guion (OpenAI) → voz (ElevenLabs en fal) → avatar
// parlante (OmniHuman: retrato + audio → video).
//
// Los guiones siguen el PLAYBOOK UGC del plan de Marketing de Influencia Drean
// 2026 (estructura, tono, naming de marca, formatos y pilares) para que no sean
// genéricos y respeten la estrategia de la marca.

const MODEL_TTS = "fal-ai/elevenlabs/tts/multilingual-v2";
const MODEL_AVATAR = "fal-ai/bytedance/omnihuman";
const MODEL_PERSONA = "fal-ai/ideogram/v3";

// ---- Base de conocimiento: playbook UGC Drean ----
const PLAYBOOK = `PLAYBOOK UGC DREAN (obligatorio):

PRINCIPIOS: Real > perfecto (credibilidad manda, evitar estética publicitaria). Mostrar > decir (la prueba visual reemplaza el claim). Estructura: problema → evidencia → conclusión. Contexto real (técnicos/usuarios, no actores).

ESTRUCTURA DEL VIDEO (15-30s, es lo que la persona DICE a cámara):
- 0-3s HOOK: intriga o problema real. SIN nombrar la marca.
- 3-15s EVIDENCIA: mostrás/demostrás algo concreto (un detalle, un uso, una comparación).
- 15-25s EXPLICACIÓN: por qué pasa, el beneficio implícito.
- 25-30s CIERRE SUAVE: mención natural opcional, sin CTA agresivo.

TONO: conversacional, explicativo, honesto. Español rioplatense (voseo).

KILL LIST (NUNCA): superlativos ("el mejor", "increíble", "la mejor tecnología del mercado"), claims de marca directos, lectura de beneficios, sonar a comercial, guion evidente, sobreactuar. Lenguaje concreto y sensorial: en vez de "la mejor tecnología" → "esto hace que vibre menos".

NAMING DE MARCA (crítico): la marca es CONSECUENCIA, no protagonista. NO la nombres en el hook. Preferí que se VEA el producto sin nombrarlo (implícito = máxima credibilidad). Si hace falta: "este modelo…" / "este equipo…", o una sola vez sin énfasis "en este Drean…", idealmente en la explicación técnica o el cierre. Ejemplo correcto: "Esto pasa porque tiene motor inverter…" (la marca aparece después, si corresponde).

Escribí SOLO lo que la persona dice: sin acotaciones de escena, sin emojis, sin hashtags, sin comillas, sin subtítulos.`;

const PILAR_DESC: Record<string, string> = {
  liderazgo: "Pilar Liderazgo/porfolio: superioridad tangible, único en su categoría, tecnología exclusiva Drean, comparativas implícitas (sin nombrar competidores).",
  calidad: "Pilar Calidad superior: calidad que se SIENTE. Diferenciales reales (conformal coating, Inverter Direct Motion). Foco sensorial: detalles, texturas, sonido. Enseñar a identificar/discriminar calidad real vs percibida.",
  posventa: "Pilar Respaldo posventa: red nacional de servicio, repuestos disponibles, técnicos certificados. Tranquilidad y seguridad. Contraste riesgo vs respaldo (diferencial frente a marcas sin red instalada).",
  elegir: "Pilar Elegir bien: inversión vs gasto, durabilidad vs reemplazo prematuro, elegir barato vs elegir bien. Mostrar el costo oculto de lo barato. Comprar sin arrepentirse.",
  experiencia: "Pilar Experiencia de uso: uso cotidiano superior, diseño integrado al hogar, tips prácticos (recetas, organización, eficiencia), testimonios reales.",
};

const FORMATO_DESC: Record<string, string> = {
  no_sabia: "Formato 'No sabía esto…': arrancá con un insight técnico simple que la gente no conoce (ej: 'Nadie te cuenta esto de los lavarropas…'). Ideal para técnico.",
  error_comun: "Formato 'Error común': hook con un problema concreto (ej: 'El error que hace que vibre…') + la solución.",
  comparativa: "Formato 'Comparativa real': mostrá dos situaciones y la diferencia visible (ej: 'Mirá la diferencia entre…'). Evidencia visual, sin nombrar competidores.",
  uso_cotidiano: "Formato 'Uso cotidiano': experiencia sostenida en el tiempo (ej: 'Lo uso hace unos meses y…').",
  momento_verdad: "Formato 'Momento de verdad': foco en un detalle sensorial (sonido, vibración, el cierre de la puerta) que transmite calidad (ej: 'Escuchá esto…').",
};

export interface UgcPerfil { key: string; label: string; objetivo: string; guionSys: string; personaPrompt: string; }

export const UGC_PERFILES_FULL: UgcPerfil[] = [
  {
    key: "usuario",
    label: "Usuario",
    objetivo: "Testimonio / prueba social de un usuario real (darkpost)",
    guionSys: "Sos un USUARIO real de Drean grabando con el celular, sin producción. Hablás desde tu experiencia cotidiana concreta, con naturalidad. Credibilidad ante todo.",
    personaPrompt: "everyday Argentine person at home, casual clothes, natural and relatable, filming a selfie video with a phone, soft home lighting, amateur look",
  },
  {
    key: "tecnico",
    label: "Técnico posventa",
    objetivo: "Insight técnico con autoridad (darkpost)",
    guionSys: "Sos un TÉCNICO de posventa/reparación, creíble y prolijo (estética premium, no descuidada). Aportás un insight técnico simple que el usuario común no conoce, desde la experiencia de reparar equipos. Autoridad tranquila, nada vendedor.",
    personaPrompt: "Argentine appliance repair technician with a tidy, premium look, wearing a clean work polo, trustworthy and professional, workshop or home-service background, filming to camera",
  },
  {
    key: "personal",
    label: "Personal Drean",
    objetivo: "Humanización de marca (orgánico)",
    guionSys: "Sos parte del EQUIPO de Drean. Compartís algo del detrás de escena o el orgullo por el producto, con calidez y cercanía. Humano, de comunidad, nada corporativo.",
    personaPrompt: "Argentine company employee, smart-casual, friendly and proud, modern office or showroom background, filming to camera",
  },
];

export const UGC_VOCES_FULL = UGC_VOCES.map((v) => ({ ...v, voice: v.key === "masc" ? "Adam" : "Rachel" }));

function perfil(key: string): UgcPerfil { return UGC_PERFILES_FULL.find((p) => p.key === key) ?? UGC_PERFILES_FULL[0]!; }

// ---- Guion (OpenAI) siguiendo el playbook ----
export interface GuionParams { perfil: string; tema: string; pilar?: string; formato?: string; detalles?: string; modelo?: string; }

export async function generarGuionUgc(params: GuionParams): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY no configurada.");
  const p = perfil(params.perfil);
  const bloques = [
    p.guionSys,
    PLAYBOOK,
    params.pilar && PILAR_DESC[params.pilar] ? PILAR_DESC[params.pilar] : "",
    params.formato && FORMATO_DESC[params.formato] ? FORMATO_DESC[params.formato] : "",
    diferencialesTexto(params.modelo),
    "Salida: entre 15 y 25 segundos (aprox. 45-70 palabras). SOLO el texto hablado.",
  ].filter(Boolean);
  const sys = bloques.join("\n\n");
  const user = `Marca: Drean (electrodomésticos, Argentina).\nProducto/tema: ${params.tema || "un electrodoméstico Drean"}.` +
    (params.detalles ? `\nDetalles/contexto: ${params.detalles}` : "");
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "gpt-4o-mini", messages: [{ role: "system", content: sys }, { role: "user", content: user }], temperature: 1 }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const guion = data.choices?.[0]?.message?.content?.trim();
  if (!guion) throw new Error("OpenAI no devolvió guion.");
  return guion;
}

// ---- Retrato de la persona (fal imagen) ----
export async function generarPersonaUgc(perfilKey: string, descripcion?: string): Promise<string> {
  const p = perfil(perfilKey);
  const prompt =
    `High-quality photorealistic vertical portrait of a ${p.personaPrompt}. ` +
    (descripcion ? `${descripcion}. ` : "") +
    "Sharp focus, highly detailed and realistic face with natural skin texture and pores, clear and evenly well-lit facial features, catchlights in the eyes, looking straight at the camera with a relaxed natural expression, head-and-shoulders framing, face clearly visible and centered, single person only. " +
    "Tidy, aesthetically pleasing and realistic background with subtle depth of field. Natural and authentic (UGC feel, not over-retouched or plasticky), but crisp and high-resolution so it holds up when zoomed in. " +
    "Correct human anatomy: well-formed symmetrical face, normal eyes, natural hands with five fingers. Avoid: blurry, low quality, distorted or deformed face, extra fingers or limbs, warped background, text, watermark, logo.";
  const img = await falImage(MODEL_PERSONA, { prompt, image_size: FAL_SIZES.story, num_images: 1, rendering_speed: "QUALITY" });
  const url = img.images[0]?.url;
  if (!url) throw new Error("No se generó el retrato de la persona.");
  return url;
}

// ---- Voz + video (ElevenLabs TTS + OmniHuman) ----
export interface UgcVideoResult { audio_url: string; video_url: string; }
export async function generarVideoUgc(guion: string, vozKey: string, personaUrl: string): Promise<UgcVideoResult> {
  const voz = UGC_VOCES_FULL.find((v) => v.key === vozKey) ?? UGC_VOCES_FULL[0]!;
  const tts = await falRun(MODEL_TTS, { text: guion, voice: voz.voice });
  const audioUrl = ((tts.audio as { url?: string } | undefined)?.url) ?? (tts.audio_url as string | undefined);
  if (!audioUrl) throw new Error("No se generó el audio de la voz.");
  const out = await falVideoQueue(MODEL_AVATAR, { image_url: personaUrl, audio_url: audioUrl }, { timeoutMs: 280000, pollMs: 5000 });
  if (!out.video_url) throw new Error("No se generó el video del avatar.");
  return { audio_url: audioUrl, video_url: out.video_url };
}
