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

// Video: los modelos (Kling / Veo) son lentos y corren en la COLA async de fal
// (queue.fal.run). Se hace submit → se poolea el estado hasta COMPLETED → se lee
// el resultado. Devuelve la URL del mp4.
export interface FalVideoResult {
  video_url: string | null;
  raw: unknown;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
  const data = (await res.json()) as { video?: { url?: string }; url?: string };
  return { video_url: data.video?.url ?? data.url ?? null, raw: data };
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
