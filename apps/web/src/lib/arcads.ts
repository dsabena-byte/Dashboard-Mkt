import "server-only";

// Cliente mínimo de la API externa de Arcads (plataforma UGC "pro").
// Docs: https://external-api.arcads.ai/docs (Scalar). Base y auth abajo.
//
// Auth: HTTP Basic. La cuenta entrega Client ID + Client Secret (Settings →
// Public API). Soportamos ambas formas por robustez:
//   - ARCADS_CLIENT_ID + ARCADS_CLIENT_SECRET  → base64("id:secret")
//   - ARCADS_API_KEY                            → base64("key:")  (secret solo)
//
// Flujo de video (unificado): POST /v2/videos/generate { model, productId,
// prompt, ... } → 201 { id, status, creditsCharged }. Se poolea el estado:
//   - modelos de video (sora2/veo31/kling/grok) → GET /v1/videos/{id}
//   - assets (seedance-2.0)                      → GET /v1/assets/{id}
// productId es requerido → se crea un "product" contenedor (o se fija por env).

const BASE = process.env.ARCADS_BASE_URL?.replace(/\/$/, "") || "https://external-api.arcads.ai";

function authHeader(): string {
  const id = process.env.ARCADS_CLIENT_ID?.trim();
  const secret = process.env.ARCADS_CLIENT_SECRET?.trim();
  const key = process.env.ARCADS_API_KEY?.trim();
  let user: string;
  let pass: string;
  if (id && secret) { user = id; pass = secret; }
  else if (key) { user = key; pass = ""; }
  else throw new Error("Arcads sin credenciales: seteá ARCADS_CLIENT_ID + ARCADS_CLIENT_SECRET (o ARCADS_API_KEY) en Vercel.");
  return "Basic " + Buffer.from(`${user}:${pass}`).toString("base64");
}

async function arcadsFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${BASE}${path}`, {
    ...init,
    headers: { Authorization: authHeader(), "Content-Type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
  });
}

// ---- Modelos de video expuestos ----------------------------------------------
// kind = cómo se poolea el estado (videos vs assets, según la API).
export type ArcadsModel = "veo31" | "sora2" | "sora2-pro" | "kling-3.0" | "kling-2.6" | "grok-video" | "seedance-2.0";
export type ArcadsPollKind = "videos" | "assets";

const ASSET_MODELS = new Set<ArcadsModel>(["seedance-2.0"]);
export function pollKindFor(model: ArcadsModel): ArcadsPollKind {
  return ASSET_MODELS.has(model) ? "assets" : "videos";
}
function isModel(m: string): m is ArcadsModel {
  return ["veo31", "sora2", "sora2-pro", "kling-3.0", "kling-2.6", "grok-video", "seedance-2.0"].includes(m);
}

// ---- Product contenedor (requerido por /v2/videos/generate) ------------------
// Se cachea en memoria del proceso; en serverless puede recrearse por cold start,
// por eso conviene fijar ARCADS_PRODUCT_ID en Vercel para reusar siempre el mismo.
let cachedProductId: string | null = null;

async function ensureProductId(): Promise<string> {
  const env = process.env.ARCADS_PRODUCT_ID?.trim();
  if (env) return env;
  if (cachedProductId) return cachedProductId;
  const res = await arcadsFetch("/v1/products", { method: "POST", body: JSON.stringify({ name: "Drean UGC (dashboard)" }) });
  if (!res.ok) throw new Error(`Arcads product ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const j = (await res.json()) as { id?: string; productId?: string };
  const pid = j.id ?? j.productId;
  if (!pid) throw new Error("Arcads: /v1/products no devolvió id.");
  cachedProductId = pid;
  return pid;
}

// Duración válida por modelo (segundos). veo31 la determina solo → no se envía.
function clampDuration(model: ArcadsModel, seg?: number): number | undefined {
  if (model === "veo31") return undefined;
  const s = seg && seg > 0 ? seg : 8;
  if (model === "seedance-2.0") return Math.min(15, Math.max(4, s));
  if (model === "sora2" || model === "sora2-pro") return [4, 8, 12, 16, 20].reduce((a, b) => (Math.abs(b - s) < Math.abs(a - s) ? b : a), 8);
  return Math.min(15, Math.max(4, s));
}

export interface ArcadsHandle { id: string; kind: ArcadsPollKind; model: ArcadsModel; credits: number | null }

export async function arcadsGenerateVideo(opts: {
  model: string;
  prompt: string;
  aspectRatio?: string;
  duration?: number;
  audioEnabled?: boolean;
}): Promise<ArcadsHandle> {
  const model = isModel(opts.model) ? opts.model : "veo31";
  const productId = await ensureProductId();
  const dur = clampDuration(model, opts.duration);
  const body: Record<string, unknown> = {
    model,
    productId,
    prompt: opts.prompt,
    aspectRatio: opts.aspectRatio ?? "9:16",
    audioEnabled: opts.audioEnabled ?? true,
    nbGenerations: 1,
  };
  if (dur != null) body.duration = dur;
  const res = await arcadsFetch("/v2/videos/generate", { method: "POST", body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`Arcads generate ${res.status}: ${(await res.text()).slice(0, 400)}`);
  const j = (await res.json()) as { id?: string; assetId?: string; videoId?: string; creditsCharged?: number };
  const id = j.id ?? j.assetId ?? j.videoId;
  if (!id) throw new Error("Arcads: la generación no devolvió id.");
  return { id, kind: pollKindFor(model), model, credits: j.creditsCharged ?? null };
}

// Extrae la URL del mp4 cubriendo las formas conocidas de la respuesta.
function extractUrl(d: Record<string, unknown>): string | null {
  const cands = [d.videoUrl, d.video_url, d.url, (d.asset as Record<string, unknown> | undefined)?.videoUrl, (d.video as Record<string, unknown> | undefined)?.url];
  for (const c of cands) if (typeof c === "string" && c) return c;
  return null;
}

const DONE = new Set(["generated", "completed", "uploaded", "succeeded", "success"]);
const FAILED = new Set(["failed", "error", "canceled", "cancelled"]);

export async function arcadsVideoStatus(id: string, kind: ArcadsPollKind): Promise<{ status: string; video_url: string | null; credits: number | null; raw?: unknown }> {
  const res = await arcadsFetch(`/v1/${kind === "assets" ? "assets" : "videos"}/${encodeURIComponent(id)}`, { method: "GET" });
  if (!res.ok) return { status: "PENDING", video_url: null, credits: null };
  const bodyText = await res.text();
  let d: Record<string, unknown> = {};
  try { d = JSON.parse(bodyText) as Record<string, unknown>; } catch { /* body no-JSON */ }
  const raw = (typeof d.status === "string" ? d.status : typeof d.videoStatus === "string" ? d.videoStatus : "pending").toLowerCase();
  const url = extractUrl(d);
  const credits = typeof d.creditsCharged === "number" ? d.creditsCharged : null;
  if (url && (DONE.has(raw) || raw === "pending")) return { status: "COMPLETED", video_url: url, credits };
  if (DONE.has(raw)) return { status: "COMPLETED", video_url: url, credits, ...(url ? {} : { raw: { http: res.status, body: bodyText.slice(0, 1200) } }) };
  if (FAILED.has(raw)) return { status: "FAILED", video_url: null, credits, raw: { http: res.status, body: bodyText.slice(0, 1200) } };
  return { status: raw.toUpperCase(), video_url: null, credits };
}
