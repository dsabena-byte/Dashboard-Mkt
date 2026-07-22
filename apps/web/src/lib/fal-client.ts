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

// Tamaños para social. fal expone un enum acotado de presets:
// square_hd | square | portrait_4_3 | portrait_16_9 | landscape_4_3 | landscape_16_9.
// (portrait_4_5 NO existe → devolvía 422.)
export const FAL_SIZES = {
  feed: "square_hd", // 1:1 feed
  vertical: "portrait_4_3", // feed vertical (3:4, lo más cercano a 4:5)
  story: "portrait_16_9", // 9:16 stories/reels (portrait)
} as const;
export type FalSizeKey = keyof typeof FAL_SIZES;
