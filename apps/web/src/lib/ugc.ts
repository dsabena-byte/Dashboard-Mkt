import "server-only";
import { falImage, falQueueSubmit, falQueueVideoStatus, FAL_SIZES } from "@/lib/fal-client";
import { UGC_VOCES } from "@/lib/ugc-opciones";
import { diferencialesTexto } from "@/lib/diferenciales";

// Generación de contenido UGC (persona hablando a cámara) para Drean.
// Pipeline sobre fal.ai: guion (OpenAI) → voz (ElevenLabs en fal) → avatar
// parlante (OmniHuman: retrato + audio → video).
//
// Los guiones siguen el PLAYBOOK UGC del plan de Marketing de Influencia Drean
// 2026 (estructura, tono, naming de marca, formatos y pilares) para que no sean
// genéricos y respeten la estrategia de la marca.

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
export interface GuionParams { perfil: string; tema: string; pilar?: string; formato?: string; detalles?: string; modelo?: string; duracion?: number; atributos?: string[]; cta?: string; }

// Cupo de palabras para que la persona diga el guion NATURAL y tranquilo en
// `duracion` segundos: ritmo rioplatense ~2,3 pal/seg reservando ~1,5s para el
// beat del hook; si hay CTA, ocupa parte del cupo. Se comparte con el enforcement
// (post-generación) y sirve de referencia para el indicador del editor.
export function maxPalabrasGuion(duracion?: number, cta?: string): number {
  const seg = duracion && duracion > 0 ? duracion : 15;
  const efectivo = Math.max(3, seg - 1.5);
  let maxPal = Math.max(8, Math.round(efectivo * 2.3));
  if (cta?.trim()) maxPal = Math.max(8, maxPal - 5);
  return maxPal;
}

const contarPalabras = (t: string): number => t.trim().split(/\s+/).filter(Boolean).length;

// Recorte duro a la última oración completa dentro del cupo (última red de seguridad).
function recortarAOracion(texto: string, maxPal: number): string {
  const palabras = texto.trim().split(/\s+/).filter(Boolean);
  if (palabras.length <= maxPal) return texto.trim();
  const cortado = palabras.slice(0, maxPal).join(" ");
  const m = cortado.match(/^[\s\S]*[.!?…]/);
  return (m ? m[0] : cortado).trim();
}

// Segunda pasada: GPT suele ignorar el cupo. Si se pasó, comprimimos manteniendo
// hook + CTA; si aún se pasa, recorte duro. Garantiza que entre en la duración.
async function comprimirGuion(apiKey: string, guion: string, maxPal: number, cta?: string): Promise<string> {
  const sys =
    `Sos editor de guiones UGC en español rioplatense (voseo). Reescribí el texto para que se diga NATURAL y tranquilo en poco tiempo: MÁXIMO ${maxPal} palabras. ` +
    `Mantené el hook del arranque, UN solo diferencial y frases cortas.` +
    (cta?.trim() ? ` Terminá EXACTAMENTE con: "${cta.trim()}".` : "") +
    ` Devolvé SOLO el texto hablado, sin comillas ni acotaciones.`;
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "gpt-4o-mini", messages: [{ role: "system", content: sys }, { role: "user", content: guion }], temperature: 0.5 }),
    cache: "no-store",
  });
  if (!res.ok) return recortarAOracion(guion, maxPal);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const corto = data.choices?.[0]?.message?.content?.trim();
  if (!corto) return recortarAOracion(guion, maxPal);
  return contarPalabras(corto) <= maxPal + 3 ? corto : recortarAOracion(corto, maxPal);
}

export async function generarGuionUgc(params: GuionParams): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY no configurada.");
  const p = perfil(params.perfil);
  const maxPal = maxPalabrasGuion(params.duracion, params.cta);
  const bloques = [
    p.guionSys,
    PLAYBOOK,
    params.pilar && PILAR_DESC[params.pilar] ? PILAR_DESC[params.pilar] : "",
    params.formato && FORMATO_DESC[params.formato] ? FORMATO_DESC[params.formato] : "",
    diferencialesTexto(params.modelo, params.atributos),
    (() => {
      // El video dura EXACTAMENTE `seg` y el modelo mete TODO el texto adentro: si
      // sobran palabras, la persona habla apurada y antinatural. El cupo `maxPal`
      // es conservador (ver maxPalabrasGuion) y además se fuerza post-generación.
      const seg = params.duracion && params.duracion > 0 ? params.duracion : 15;
      return `DURACIÓN CRÍTICA: el video dura EXACTAMENTE ${seg} segundos y la persona tiene que decir TODO el texto adentro hablando TRANQUILA y a ritmo natural (nunca apurada). Por eso: MÁXIMO ${maxPal} palabras${params.cta?.trim() ? " (CTA incluido)" : ""}. Es MEJOR quedarse corto que pasarse. Un solo diferencial bien contado, no una lista. Ante la duda, menos palabras. Contá las palabras y no te pases. SOLO el texto hablado.`;
    })(),
    // CTA de cierre: la marca NO se dice (va en el copy/link); el guion cierra
    // mandando al copy/link con esta frase natural.
    params.cta?.trim() ? `CIERRE OBLIGATORIO: terminá el guion con este call-to-action, redactado natural y al final: "${params.cta.trim()}". No agregues nada después.` : "",
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
  let guion = data.choices?.[0]?.message?.content?.trim();
  if (!guion) throw new Error("OpenAI no devolvió guion.");
  // Enforcement: si GPT ignoró el cupo (le pasa seguido), comprimimos para que
  // realmente entre en la duración y la persona no hable apurada.
  if (contarPalabras(guion) > maxPal + 2) {
    guion = await comprimirGuion(apiKey, guion, maxPal, params.cta);
  }
  return guion;
}

// ---- Retrato de la persona (fal imagen) ----
export interface PersonaParams { perfil: string; descripcion?: string; genero?: string; edad?: string; }

function sujetoPersona(genero?: string, edad?: string): string {
  const gen = genero === "hombre" ? "man" : genero === "mujer" ? "woman" : "person";
  const edadTxt = edad === "joven" ? "young, about 25 years old," : edad === "adulto" ? "middle-aged, about 40 years old," : edad === "mayor" ? "older, about 60 years old," : "";
  return `an Argentine ${edadTxt} ${gen}`.replace(/\s+/g, " ").trim();
}

export async function generarPersonaUgc(params: PersonaParams): Promise<string> {
  const p = perfil(params.perfil);
  const descripcion = params.descripcion;
  const prompt =
    `High-quality photorealistic vertical portrait of ${sujetoPersona(params.genero, params.edad)} — ${p.personaPrompt}. ` +
    (descripcion ? `${descripcion}. ` : "") +
    "Sharp focus, highly detailed and realistic face with natural skin texture and pores, clear and evenly well-lit facial features, catchlights in the eyes, looking straight at the camera with a relaxed natural expression, head-and-shoulders framing, face clearly visible and centered, single person only. " +
    "Tidy, aesthetically pleasing and realistic background with subtle depth of field. Natural and authentic (UGC feel, not over-retouched or plasticky), but crisp and high-resolution so it holds up when zoomed in. " +
    "Correct human anatomy: well-formed symmetrical face, normal eyes, natural hands with five fingers. Avoid: blurry, low quality, distorted or deformed face, extra fingers or limbs, warped background, text, watermark, logo.";
  const img = await falImage(MODEL_PERSONA, { prompt, image_size: FAL_SIZES.story, num_images: 1, rendering_speed: "QUALITY" });
  const url = img.images[0]?.url;
  if (!url) throw new Error("No se generó el retrato de la persona.");
  return url;
}

// ---- Video NATIVO con Seedance 2.0 (persona + voz + escena en un solo paso) ----
// Validado como el mejor método: video natural (no "foto hablando" ni lipsync
// borroso). La persona se genera nativa, con la voz nativa de Seedance. La marca
// NO se dice (el guion es "marca-free" y cierra con CTA al copy/link), así se
// evita el problema de pronunciación de nombres propios.
const MODEL_SEEDANCE = "bytedance/seedance-2.0/fast/text-to-video";

// Escenarios/tomas (claves de UGC_ESCENARIOS) → descripción de escena para el prompt.
const ESCENARIOS_PROMPT: Record<string, string> = {
  selfie: "at home in a casual setting, filming themselves with a phone front camera, talking directly to the camera",
  sillon: "relaxed on the living-room sofa at home, phone propped up in front of them, talking casually to the camera",
  compu: "sitting at a desk with a laptop, glancing at the screen and then turning to talk to the camera",
  cocina: "standing in a home kitchen next to the appliances, doing a small everyday task while talking to the camera",
  desempacando: "unpacking grocery and shopping bags on the kitchen counter at home, talking to the camera in between",
  lavando: "next to the washing machine at home, loading or taking out laundry, talking to the camera while doing it",
  doblando: "folding freshly washed laundry on the bed or sofa, talking casually to the camera",
  cafe: "sitting relaxed at home with a cup of coffee or mate, talking to the camera",
};

// Rango de edad (claves de UGC_EDADES) → descripción para el prompt.
const EDAD_PROMPT: Record<string, string> = {
  joven: "in their mid 20s",
  adulto: "in their early 40s",
  mayor: "around 60 years old",
};

// Estilo de ropa (claves de UGC_VESTIMENTAS) → descripción para el prompt.
const VESTIMENTA_PROMPT: Record<string, string> = {
  informal: "casual everyday clothes (a t-shirt or sweater)",
  camisa: "a casual button-up shirt",
  prolijo: "a smart-casual, neat and tidy outfit",
  deportivo: "sporty casual clothes",
  trabajo: "clean work clothes / a tidy uniform",
};

function buildPromptSeedance(guion: string, genero?: string, escenario?: string | null, edad?: string | null, vestimenta?: string | null): string {
  const persona = genero === "hombre" ? "man" : "woman";
  // Edad/ropa: clave conocida → preset; si no, se toma el texto libre tal cual.
  const edadTxt = edad ? (EDAD_PROMPT[edad] ?? edad) : "in their early 30s";
  const escena = escenario ? (ESCENARIOS_PROMPT[escenario] ?? escenario) : ESCENARIOS_PROMPT.selfie;
  const ropaTxt = vestimenta?.trim() ? `, wearing ${VESTIMENTA_PROMPT[vestimenta] ?? vestimenta}` : "";
  return (
    `Realistic UGC-style vertical video of a natural, everyday Argentine ${persona} ${edadTxt}${ropaTxt}, ` +
    `${escena}. ` +
    `Authentic and spontaneous, like a real customer testimonial — NOT a polished actor or a commercial. ` +
    `Amateur phone-video look, natural indoor lighting, natural subtle head and hand movements, natural skin. ` +
    `They speak at a NORMAL, calm, natural, spontaneous conversational pace in warm RIOPLATENSE ARGENTINE Spanish (Buenos Aires accent, voseo). Not slowed-down or over-enunciated, but also NOT rushed or crammed — relaxed and unhurried. ` +
    `The person says, calmly and at a natural pace, without rushing: "${guion}". ` +
    `Vertical 9:16, single person, realistic and human.`
  );
}

// Encola el video (Seedance, async). El render tarda; el cliente poolea status().
export interface UgcVideoHandle { request_id: string; status_url: string; response_url: string }

export async function generarVideoUgcSeedanceSubmit(guion: string, genero?: string, escenario?: string | null, duracion?: number, edad?: string | null, vestimenta?: string | null): Promise<UgcVideoHandle> {
  const seg = Math.min(15, Math.max(4, duracion && duracion > 0 ? duracion : 10)); // Seedance: 4-15s
  const input = { prompt: buildPromptSeedance(guion, genero, escenario, edad, vestimenta), duration: String(seg), resolution: "720p", aspect_ratio: "9:16", generate_audio: true };
  const h = await falQueueSubmit(MODEL_SEEDANCE, input);
  return { request_id: h.requestId, status_url: h.statusUrl, response_url: h.responseUrl };
}

export async function getVideoUgcStatus(statusUrl: string, responseUrl: string): Promise<{ status: string; video_url: string | null }> {
  return falQueueVideoStatus(statusUrl, responseUrl);
}
