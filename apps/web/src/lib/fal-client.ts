import "server-only";

// Cliente mínimo de fal.ai (REST). Auth: header "Authorization: Key <FAL_KEY>".
// Endpoint síncrono: POST https://fal.run/<model-id> con el input en el body.
// Modelos: fal-ai/flux-2-pro (realismo), fal-ai/ideogram/v3 (texto en imagen).
// El video (kling/veo) usa la cola queue.fal.run — se suma en una 2da etapa.

export interface FalImage {
  url: string;
  width?: number;
  height?: number;
  content_type?: string;
}

export interface FalImageResponse {
  images: FalImage[];
  seed?: number;
  raw: unknown;
}

export async function falImage(model: string, input: Record<string, unknown>): Promise<FalImageResponse> {
  const key = process.env.FAL_KEY;
  if (!key) throw new Error("FAL_KEY no configurada (crear en fal.ai/dashboard/keys y setear en Vercel).");
  const res = await fetch(`https://fal.run/${model}`, {
    method: "POST",
    headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(input),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`fal ${res.status}: ${body.slice(0, 500)}`);
  }
  const data = (await res.json()) as { images?: FalImage[]; seed?: number };
  return { images: data.images ?? [], seed: data.seed, raw: data };
}

// Endpoint síncrono genérico: devuelve el JSON crudo. Sirve para modelos rápidos
// (p.ej. TTS de ElevenLabs en fal → { audio: { url } }).
export async function falRun(model: string, input: Record<string, unknown>): Promise<Record<string, unknown>> {
  const key = process.env.FAL_KEY;
  if (!key) throw new Error("FAL_KEY no configurada (crear en fal.ai/dashboard/keys y setear en Vercel).");
  const res = await fetch(`https://fal.run/${model}`, {
    method: "POST",
    headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(input),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`fal ${res.status}: ${(await res.text()).slice(0, 500)}`);
  return (await res.json()) as Record<string, unknown>;
}

// Video: los modelos (Kling / Veo) son lentos y corren en la COLA async de fal
// (queue.fal.run). Se hace submit → se poolea el estado hasta COMPLETED → se lee
// el resultado. Devuelve la URL del mp4.
export interface FalVideoResult {
  video_url: string | null;
  raw: unknown;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---- Cola async separada en submit + status (para renders largos que no entran
// en el límite de una request serverless; el cliente poolea el estado). ----
// IMPORTANTE: se usan las URLs status_url/response_url que DEVUELVE fal al
// encolar. No se reconstruyen a mano: para modelos con subruta (p.ej.
// fal-ai/bytedance/omnihuman) la URL de estado NO es /${model}/requests/... y
// reconstruirla mal hace que nunca se detecte el COMPLETED.
export interface FalQueueHandle { requestId: string; statusUrl: string; responseUrl: string }

export async function falQueueSubmit(model: string, input: Record<string, unknown>): Promise<FalQueueHandle> {
  const key = process.env.FAL_KEY;
  if (!key) throw new Error("FAL_KEY no configurada.");
  const sub = await fetch(`https://queue.fal.run/${model}`, {
    method: "POST",
    headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(input),
    cache: "no-store",
  });
  if (!sub.ok) throw new Error(`fal submit ${sub.status}: ${(await sub.text()).slice(0, 400)}`);
  const j = (await sub.json()) as { request_id?: string; status_url?: string; response_url?: string };
  if (!j.request_id) throw new Error("fal: respuesta sin request_id");
  const base = `https://queue.fal.run/${model.split("/").slice(0, 2).join("/")}/requests/${j.request_id}`;
  return {
    requestId: j.request_id,
    statusUrl: j.status_url ?? `${base}/status`,
    responseUrl: j.response_url ?? base,
  };
}

// Estructura de respuesta de los modelos de video de fal (varía según el modelo:
// text-to-video, image-to-video, etc.). Extraemos la URL del mp4 cubriendo las
// formas conocidas.
interface FalVideoResp {
  video?: { url?: string } | string;
  url?: string;
  videos?: Array<{ url?: string }>;
  output?: { video?: { url?: string }; url?: string; videos?: Array<{ url?: string }> };
}

export function extractVideoUrl(d: FalVideoResp): string | null {
  const v = d.video;
  if (typeof v === "string") return v;
  return v?.url ?? d.url ?? d.videos?.[0]?.url ?? d.output?.video?.url ?? d.output?.url ?? d.output?.videos?.[0]?.url ?? null;
}

export async function falQueueVideoStatus(statusUrl: string, responseUrl: string): Promise<{ status: string; video_url: string | null; raw?: unknown }> {
  const key = process.env.FAL_KEY;
  if (!key) throw new Error("FAL_KEY no configurada.");
  const headers = { Authorization: `Key ${key}`, "Content-Type": "application/json" };
  const st = await fetch(statusUrl, { headers, cache: "no-store" });
  if (!st.ok) return { status: "PENDING", video_url: null };
  const stData = (await st.json()) as { status?: string };
  if (stData.status === "FAILED" || stData.status === "ERROR") return { status: "FAILED", video_url: null };
  if (stData.status !== "COMPLETED") return { status: stData.status ?? "IN_PROGRESS", video_url: null };
  const res = await fetch(responseUrl, { headers, cache: "no-store" });
  if (!res.ok) return { status: "COMPLETED", video_url: null };
  const data = (await res.json()) as FalVideoResp;
  const video_url = extractVideoUrl(data);
  // Si no lo encontramos, devolvemos la respuesta cruda para poder ver el formato.
  return { status: "COMPLETED", video_url, ...(video_url ? {} : { raw: data }) };
}

export async function falVideoQueue(
  model: string,
  input: Record<string, unknown>,
  opts?: { timeoutMs?: number; pollMs?: number },
): Promise<FalVideoResult> {
  const key = process.env.FAL_KEY;
  if (!key) throw new Error("FAL_KEY no configurada (crear en fal.ai/dashboard/keys y setear en Vercel).");
  const headers = { Authorization: `Key ${key}`, "Content-Type": "application/json" };

  // 1) Submit a la cola.
  const sub = await fetch(`https://queue.fal.run/${model}`, {
    method: "POST",
    headers,
    body: JSON.stringify(input),
    cache: "no-store",
  });
  if (!sub.ok) throw new Error(`fal submit ${sub.status}: ${(await sub.text()).slice(0, 400)}`);
  const subData = (await sub.json()) as { request_id?: string; status_url?: string; response_url?: string };
  const requestId = subData.request_id;
  if (!requestId) throw new Error("fal: respuesta sin request_id");
  const statusUrl = subData.status_url ?? `https://queue.fal.run/${model}/requests/${requestId}/status`;
  const responseUrl = subData.response_url ?? `https://queue.fal.run/${model}/requests/${requestId}`;

  // 2) Poll hasta COMPLETED (o timeout).
  const timeoutMs = opts?.timeoutMs ?? 280000;
  const pollMs = opts?.pollMs ?? 5000;
  const start = Date.now();
  for (;;) {
    if (Date.now() - start > timeoutMs) throw new Error("fal video: timeout esperando el render");
    await sleep(pollMs);
    const st = await fetch(statusUrl, { headers, cache: "no-store" });
    if (!st.ok) continue;
    const stData = (await st.json()) as { status?: string };
    if (stData.status === "COMPLETED") break;
    if (stData.status === "FAILED" || stData.status === "ERROR") throw new Error(`fal video: ${stData.status}`);
  }

  // 3) Resultado.
  const res = await fetch(responseUrl, { headers, cache: "no-store" });
  if (!res.ok) throw new Error(`fal result ${res.status}: ${(await res.text()).slice(0, 400)}`);
  const data = (await res.json()) as FalVideoResp;
  return { video_url: extractVideoUrl(data), raw: data };
}

// Tamaños para social. fal expone un enum acotado de presets:
// square_hd | square | portrait_4_3 | portrait_16_9 | landscape_4_3 | landscape_16_9.
// (portrait_4_5 NO existe → devolvía 422.)
export const FAL_SIZES = {
  feed: "square_hd", // 1:1 feed
  vertical: "portrait_4_3", // feed vertical (3:4, lo más cercano a 4:5)
  story: "portrait_16_9", // 9:16 stories/reels (portrait)
} as const;
export type FalSizeKey = keyof typeof FAL_SIZES;
