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

async function del(path: string, tok: string): Promise<Record<string, unknown>> {
  const sep = path.includes("?") ? "&" : "?";
  const res = await fetch(`${GRAPH}${path}${sep}access_token=${encodeURIComponent(tok)}`, { method: "DELETE", cache: "no-store" });
  const j = (await res.json()) as Record<string, unknown>;
  if (!res.ok || j.error) throw new Error(`Graph DELETE ${path}: ${JSON.stringify(j.error ?? j).slice(0, 400)}`);
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

// Espera a que el contenedor de IG esté FINISHED antes de publicar. Meta procesa
// el media de forma async (incluso las imágenes: tiene que bajar la URL). Si se
// publica antes, tira 9007 "Media ID is not available / no está listo".
async function esperarContenedor(creationId: string, pageToken: string, tries: number, intervalMs: number): Promise<void> {
  for (let i = 0; i < tries; i++) {
    const st = await get(`/${creationId}?fields=status_code`, pageToken);
    if (st.status_code === "FINISHED") return;
    if (st.status_code === "ERROR") throw new Error("IG: el contenido falló al procesarse.");
    await sleep(intervalMs);
  }
  throw new Error("IG: el contenido no terminó de procesarse a tiempo. Probá de nuevo en un momento.");
}

// ---- Instagram ----
export async function publicarImagenIG(imageUrl: string, caption: string, pageToken: string): Promise<string> {
  const cont = await post(`/${IG_ID}/media`, { image_url: imageUrl, caption, access_token: pageToken });
  const creationId = cont.id as string;
  // Imágenes: suelen estar listas en 1-3s; esperamos hasta ~30s por las dudas.
  await esperarContenedor(creationId, pageToken, 15, 2000);
  const pub = await post(`/${IG_ID}/media_publish`, { creation_id: creationId, access_token: pageToken });
  return pub.id as string;
}

export async function publicarReelIG(videoUrl: string, caption: string, pageToken: string): Promise<string> {
  const cont = await post(`/${IG_ID}/media`, { media_type: "REELS", video_url: videoUrl, caption, access_token: pageToken });
  const creationId = cont.id as string;
  // El contenedor de video tarda más en procesarse: esperamos hasta ~2,5 min.
  await esperarContenedor(creationId, pageToken, 30, 5000);
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

// ---- Retirar (borrar) una publicación ----
// Tanto en IG (media id) como en FB (post/photo/video id) el borrado es
// DELETE /{id}. Devuelve {success:true, deleted_id} de la Graph API.
export async function borrarPublicacion(objectId: string, pageToken: string): Promise<void> {
  await del(`/${objectId}`, pageToken);
}
