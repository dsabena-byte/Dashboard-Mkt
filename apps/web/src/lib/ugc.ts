import "server-only";
import { falImage, falRun, falVideoQueue, FAL_SIZES } from "@/lib/fal-client";

// Generación de contenido UGC (persona hablando a cámara) para Drean.
// Pipeline, todo sobre fal.ai: guion (OpenAI) → voz (ElevenLabs en fal) →
// avatar parlante (OmniHuman: retrato + audio → video). 3 perfiles con objetivo
// e identidad propios.

const MODEL_TTS = "fal-ai/elevenlabs/tts/multilingual-v2";
const MODEL_AVATAR = "fal-ai/bytedance/omnihuman"; // retrato + audio → persona hablando
const MODEL_PERSONA = "fal-ai/ideogram/v3"; // retrato realista de la persona

export interface UgcPerfil {
  key: string;
  label: string;
  objetivo: string;
  guionSys: string;   // guía para el guion
  personaPrompt: string; // guía para el retrato
}

export const UGC_PERFILES: UgcPerfil[] = [
  {
    key: "usuario",
    label: "Usuario",
    objetivo: "Testimonio / prueba social de un cliente real (para darkpost)",
    guionSys:
      "Sos un CLIENTE común de Drean grabando un testimonio espontáneo con el celular. Contás tu experiencia real y cotidiana con el electrodoméstico, con entusiasmo genuino pero creíble (no publicitario). Nada de tecnicismos.",
    personaPrompt:
      "everyday Argentine person at home, casual clothes, natural, warm, relatable, filming a selfie video with a phone, soft home lighting",
  },
  {
    key: "tecnico",
    label: "Técnico posventa",
    objetivo: "Recomendación con autoridad de un técnico de posventa (para darkpost)",
    guionSys:
      "Sos un TÉCNICO de posventa de electrodomésticos. Hablás con autoridad y confianza, desde la experiencia de reparar equipos: por qué este Drean es confiable, qué mirás vos como técnico. Tono cercano pero experto.",
    personaPrompt:
      "Argentine appliance repair technician, wearing a work polo shirt, tidy, trustworthy, professional but approachable, workshop or home-service background, filming to camera",
  },
  {
    key: "personal",
    label: "Personal Drean",
    objetivo: "Humanización de marca / detrás de escena (orgánico)",
    guionSys:
      "Sos parte del EQUIPO de Drean. Compartís algo del detrás de escena, el orgullo por el producto o la marca, con calidez y cercanía. Tono humano, de comunidad, nada corporativo.",
    personaPrompt:
      "Argentine company employee, smart-casual with a subtle brand feel, friendly and proud, modern office or showroom background, filming to camera",
  },
];

export interface UgcVoz {
  key: string;
  label: string;
  voice: string; // nombre de voz de ElevenLabs
}
export const UGC_VOCES: UgcVoz[] = [
  { key: "fem", label: "Femenina", voice: "Rachel" },
  { key: "masc", label: "Masculina", voice: "Adam" },
];

function perfil(key: string): UgcPerfil {
  return UGC_PERFILES.find((p) => p.key === key) ?? UGC_PERFILES[0]!;
}

// ---- Guion (OpenAI) ----
export async function generarGuionUgc(perfilKey: string, tema: string, detalles?: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY no configurada.");
  const p = perfil(perfilKey);
  const sys =
    `${p.guionSys}\n\n` +
    "Escribí SOLO lo que la persona dice a cámara. Español rioplatense (voseo), natural y hablado. " +
    "Entre 15 y 25 segundos (aprox. 45-70 palabras). Sin hashtags, sin emojis, sin acotaciones ni indicaciones de escena, sin comillas. " +
    "Un gancho al inicio y un cierre que invite a la acción, pero sin sonar a comercial.";
  const user = `Marca: Drean (electrodomésticos, Argentina).\nProducto/tema: ${tema || "un electrodoméstico Drean"}.` +
    (detalles ? `\nDetalles a incluir: ${detalles}` : "");
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
    `Photorealistic vertical portrait, UGC selfie style, of a ${p.personaPrompt}. ` +
    (descripcion ? `${descripcion}. ` : "") +
    "Natural skin texture, realistic, looking at the camera, upper body, single person, authentic amateur phone photo look. No text, no watermark, no logo.";
  const img = await falImage(MODEL_PERSONA, { prompt, image_size: FAL_SIZES.story, num_images: 1 });
  const url = img.images[0]?.url;
  if (!url) throw new Error("No se generó el retrato de la persona.");
  return url;
}

// ---- Voz + video (ElevenLabs TTS + OmniHuman) ----
export interface UgcVideoResult {
  audio_url: string;
  video_url: string;
}
export async function generarVideoUgc(guion: string, vozKey: string, personaUrl: string): Promise<UgcVideoResult> {
  const voz = UGC_VOCES.find((v) => v.key === vozKey) ?? UGC_VOCES[0]!;
  // 1) Voz (ElevenLabs en fal, síncrono).
  const tts = await falRun(MODEL_TTS, { text: guion, voice: voz.voice });
  const audioUrl = ((tts.audio as { url?: string } | undefined)?.url) ?? (tts.audio_url as string | undefined);
  if (!audioUrl) throw new Error("No se generó el audio de la voz.");
  // 2) Avatar parlante (OmniHuman: retrato + audio → video). Lento → cola.
  const out = await falVideoQueue(MODEL_AVATAR, { image_url: personaUrl, audio_url: audioUrl }, { timeoutMs: 280000, pollMs: 5000 });
  if (!out.video_url) throw new Error("No se generó el video del avatar.");
  return { audio_url: audioUrl, video_url: out.video_url };
}
