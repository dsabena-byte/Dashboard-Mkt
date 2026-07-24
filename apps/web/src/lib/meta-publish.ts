import "server-only";

// Publicación en IG/FB vía Graph API (Fase 2 del calendario). Usa el token de
// system user (META_SYSTEM_USER_TOKEN) para obtener el Page token y publicar.
// Requiere los scopes pages_manage_posts + instagram_content_publish.

const GRAPH = "https://graph.facebook.com/v22.0";
export const PAGE_ID = "257587170945975";   // Página FB Drean
export const IG_ID = "17841404990509161";   // IG @dreanargentina

function token(): string {
  const t = process.env.META_SYSTEM_USER_TOKEN;
  if (!t) throw new Error("META_SYSTEM_USER_TOKEN no configurada.");
  return t;
}

async function post(path: string, params: Record<string, string>): Promise<Record<string, unknown>> {
  const body = new URLSearchParams(params);
  const res = await fetch(`${GRAPH}${path}`, { method: "POST", body, cache: "no-store" });
  const j = (await res.json()) as Record<string, unknown>;
  if (!res.ok || j.error) throw new Error(`Graph ${path}: ${JSON.stringify(j.error ?? j).slice(0, 400)}`);
  return j;
}

async function get(path: string, tok: string): Promise<Record<string, unknown>> {
  const sep = path.includes("?") ? "&" : "?";
  const res = await fetch(`${GRAPH}${path}${sep}access_token=${encodeURIComponent(tok)}`, { cache: "no-store" });
  const j = (await res.json()) as Record<string, unknown>;
  if (!res.ok || j.error) throw new Error(`Graph ${path}: ${JSON.stringify(j.error ?? j).slice(0, 400)}`);
  return j;
}

// Page access token (necesario para publicar en la Página y en IG).
export async function getPageToken(): Promise<string> {
  const j = await get(`/${PAGE_ID}?fields=access_token`, token());
  const pt = j.access_token as string | undefined;
  if (!pt) throw new Error("No se obtuvo el Page access token (¿faltan permisos?).");
  return pt;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---- Instagram ----
export async function publicarImagenIG(imageUrl: string, caption: string, pageToken: string): Promise<string> {
  const cont = await post(`/${IG_ID}/media`, { image_url: imageUrl, caption, access_token: pageToken });
  const creationId = cont.id as string;
  const pub = await post(`/${IG_ID}/media_publish`, { creation_id: creationId, access_token: pageToken });
  return pub.id as string;
}

export async function publicarReelIG(videoUrl: string, caption: string, pageToken: string): Promise<string> {
  const cont = await post(`/${IG_ID}/media`, { media_type: "REELS", video_url: videoUrl, caption, access_token: pageToken });
  const creationId = cont.id as string;
  // El contenedor de video se procesa async: esperar a que esté FINISHED.
  for (let i = 0; i < 30; i++) {
    await sleep(5000);
    const st = await get(`/${creationId}?fields=status_code`, pageToken);
    if (st.status_code === "FINISHED") break;
    if (st.status_code === "ERROR") throw new Error("IG: el video falló al procesarse.");
  }
  const pub = await post(`/${IG_ID}/media_publish`, { creation_id: creationId, access_token: pageToken });
  return pub.id as string;
}

// ---- Facebook Page ----
export async function publicarImagenFB(imageUrl: string, caption: string, pageToken: string): Promise<string> {
  const j = await post(`/${PAGE_ID}/photos`, { url: imageUrl, caption, access_token: pageToken });
  return (j.post_id ?? j.id) as string;
}

export async function publicarVideoFB(videoUrl: string, description: string, pageToken: string): Promise<string> {
  const j = await post(`/${PAGE_ID}/videos`, { file_url: videoUrl, description, access_token: pageToken });
  return j.id as string;
}
