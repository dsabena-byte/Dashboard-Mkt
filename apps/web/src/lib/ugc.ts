import "server-only";
import { falImage, falQueueSubmit, falQueueVideoStatus, FAL_SIZES } from "@/lib/fal-client";
import { UGC_VOCES } from "@/lib/ugc-opciones";
import { diferencialesTexto } from "@/lib/diferenciales";
import { getModelo, driveImageUrl } from "@/lib/producto-catalog";

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
  // Ritmo UGC natural (~2,4 pal/seg): deja lugar para hook + UN beneficio +
  // cierre sin sonar apurado. El CTA ocupa ~4 palabras. Piso de 13 para que el
  // guion SIEMPRE alcance a contar algo (no un hook pelado).
  let maxPal = Math.round(seg * 2.4);
  if (cta?.trim()) maxPal -= 4;
  return Math.max(13, maxPal);
}

const contarPalabras = (t: string): number => t.trim().split(/\s+/).filter(Boolean).length;

// Segunda pasada: GPT a veces se pasa MUCHO del cupo. La comprimimos conservando
// lo que importa (hook + EL beneficio + CTA). Nunca devolvemos un fragmento sin
// sentido: si la compresión falla o queda demasiado corta, vuelve el original
// (mejor un guion un toque largo pero completo que un hook pelado).
async function comprimirGuion(apiKey: string, guion: string, maxPal: number, cta?: string): Promise<string> {
  const sys =
    `Sos editor de guiones UGC en español rioplatense (voseo). Acortá el texto para que se diga natural en poco tiempo, apuntando a ~${maxPal} palabras. ` +
    `OBLIGATORIO conservar: (1) el hook del arranque y (2) EL beneficio concreto que se cuenta — es lo importante, NO lo borres. Un solo beneficio, frases cortas, sin relleno.` +
    (cta?.trim() ? ` Terminá con: "${cta.trim()}".` : "") +
    ` Devolvé SOLO el texto hablado, sin comillas ni acotaciones.`;
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-4o-mini", messages: [{ role: "system", content: sys }, { role: "user", content: guion }], temperature: 0.5 }),
      cache: "no-store",
    });
    if (!res.ok) return guion;
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const corto = data.choices?.[0]?.message?.content?.trim();
    if (!corto || contarPalabras(corto) < 8) return guion; // no butcherear: mejor el original completo
    return corto;
  } catch {
    return guion;
  }
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
  // Enforcement: solo si el exceso es GRANDE (un poco de más se dice bien y
  // conserva el contenido). La compresión mantiene el beneficio; si falla, queda
  // el original completo — nunca un fragmento sin sentido.
  if (contarPalabras(guion) > Math.round(maxPal * 1.5)) {
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
    // Encuadre CERRADO (cara y hombros, fondo desenfocado): así el ambiente no
    // "compite" y el clip intercala limpio con el insert del producto.
    `Close selfie framing: head and shoulders fill the frame, with the background softly out of focus (shallow depth of field) — the room is not the focus. ` +
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

// ---- INSERT SHOT del producto real (estrategia "intercalar") ----
// Genera un b-roll fiel del producto Drean real (SIN persona → i2v lo procesa),
// para intercalar con el talking-head. Dos pasos: componer el frame con el
// packshot como referencia (nano-banana edit) → animarlo con movimiento de
// cámara con intención.
const MODEL_EDIT = "fal-ai/nano-banana/edit";
const MODEL_INSERT_VIDEO = "bytedance/seedance-2.0/fast/image-to-video";

const INSERT_ESCENARIOS: Record<string, string> = {
  selfie: "in a real Argentine home",
  cocina: "in their home kitchen",
  lavando: "in their home laundry area",
  doblando: "in a tidy home laundry area",
  sillon: "in a cozy living room at home",
  cafe: "in a warm home kitchen",
};

// Placement realista según el tipo de medida del catálogo (evita, p.ej., que una
// cocina counter-height salga más alta que la mesada).
function placementHintInsert(medidas?: string): string {
  const m = (medidas ?? "").toLowerCase();
  if (m.includes("counter-height") || m.includes("front-load")) return "PLACEMENT: standard counter-height appliance (~90 cm); its top surface is aligned and FLUSH with the adjacent countertop — NOT taller than the counter, level with the surrounding cabinets, standing on the floor.";
  if (m.includes("top-load")) return "PLACEMENT: standalone top-load washer standing on the floor, lid opening from the top.";
  if (m.includes("tall")) return "PLACEMENT: a TALL floor-standing appliance, taller than the counters, standing on the floor.";
  return "";
}

function buildInsertFrame(nombre: string, medidas: string | undefined, escenario?: string | null): string {
  const donde = escenario ? (INSERT_ESCENARIOS[escenario] ?? escenario) : INSERT_ESCENARIOS.cocina;
  return (
    `Photorealistic vertical 9:16 photo of the Drean ${nombre} shown in the provided product photo, placed naturally ${donde}. ` +
    `CRITICAL: keep the appliance EXACTLY IDENTICAL to the reference photo — same design, doors, finish, controls and proportions${medidas ? ` (${medidas})` : ""}. Do NOT redesign or restyle it. ` +
    `${placementHintInsert(medidas)} ` +
    `Cozy realistic home setting around it, natural window light, shallow depth of field, authentic and lived-in (not a showroom, not a polished commercial). ` +
    `NO people, NO hands. Single hero appliance, well integrated (not floating). ` +
    `Avoid: people, hands, distorted product, extra doors/handles, warped proportions, appliance taller than the countertop, text, watermark, logo overlay.`
  );
}

function buildInsertVideo(): string {
  return (
    `Cinematic product b-roll with ONE single, purposeful camera move: a slow, smooth, steady dolly push-in toward the Drean appliance, keeping it centered and in focus the whole time (a deliberate product hero shot). ` +
    `The move is continuous and intentional — NOT wandering, random or shaky. ` +
    `The appliance stays EXACTLY UNCHANGED and undistorted — do not morph, melt or restyle it. Natural window light, shallow depth of field, calm and premium but realistic. ` +
    `NO people appear. Vertical 9:16, photorealistic, subtle and elegant motion.`
  );
}

export interface InsertHandle { frame_url: string; request_id: string; status_url: string; response_url: string }

export async function generarInsertProductoSubmit(sku: string, escenario?: string | null): Promise<InsertHandle> {
  const modelo = getModelo(sku);
  if (!modelo) throw new Error(`Producto desconocido: ${sku}. Elegí un modelo del catálogo.`);
  const packshot = driveImageUrl(modelo.driveFileId);
  // 1) Frame con el producto real (packshot como referencia).
  const frame = await falImage(MODEL_EDIT, { prompt: buildInsertFrame(modelo.nombre, modelo.medidas, escenario), image_urls: [packshot], num_images: 1 });
  const frameUrl = frame.images[0]?.url;
  if (!frameUrl) throw new Error("No se generó el frame del insert.");
  // 2) Animarlo (sin audio: es b-roll).
  const input = { image_url: frameUrl, prompt: buildInsertVideo(), duration: "5", resolution: "720p", aspect_ratio: "9:16", generate_audio: false };
  const h = await falQueueSubmit(MODEL_INSERT_VIDEO, input);
  return { frame_url: frameUrl, request_id: h.requestId, status_url: h.statusUrl, response_url: h.responseUrl };
}
