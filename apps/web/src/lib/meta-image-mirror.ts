// Mirror de thumbnails de Meta (FB e IG) a Supabase Storage.
// Las URLs originales caducan en 1-2 días por las firmas de Meta CDN.
// Acá: descargamos la imagen, la subimos a un bucket público y devolvemos
// la URL eterna. Si ya existe, devolvemos la URL existente sin re-descargar.

const BUCKET = "meta-thumbs";

function env(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Env var ${key} no configurada`);
  return v;
}

function publicUrl(supabaseUrl: string, key: string): string {
  return `${supabaseUrl.replace(/\/+$/, "")}/storage/v1/object/public/${BUCKET}/${key}`;
}

async function exists(supabaseUrl: string, key: string): Promise<boolean> {
  // El bucket es público — un HEAD a la URL pública dice si existe.
  // /object/info/* requería autenticación y el endpoint exacto cambió
  // entre versiones de Supabase Storage.
  const r = await fetch(publicUrl(supabaseUrl, key), { method: "HEAD" });
  return r.ok;
}

/**
 * Si la imagen ya fue espejada, devuelve la URL pública existente.
 * Si no, descarga la URL de Meta y la sube al bucket. Si algo falla,
 * devuelve la URL original (para que el cron no rompa por una imagen).
 */
export async function mirrorMetaImage(metaUrl: string | null | undefined, key: string): Promise<string | null> {
  if (!metaUrl) return null;
  const supabaseUrl = env("NEXT_PUBLIC_SUPABASE_URL").replace(/\/+$/, "");
  const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY");

  // Si ya está en el bucket, devolvemos la URL pública sin re-descargar
  try {
    if (await exists(supabaseUrl, key)) {
      return publicUrl(supabaseUrl, key);
    }
  } catch {
    // ignore — seguimos a la descarga
  }

  // Descargar la imagen desde Meta
  let imgBuf: ArrayBuffer;
  let contentType = "image/jpeg";
  try {
    const res = await fetch(metaUrl);
    if (!res.ok) return metaUrl;
    contentType = res.headers.get("content-type") || "image/jpeg";
    imgBuf = await res.arrayBuffer();
  } catch {
    return metaUrl;
  }

  // Subir al bucket
  try {
    const upRes = await fetch(`${supabaseUrl}/storage/v1/object/${BUCKET}/${encodeURIComponent(key)}`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": contentType,
        "x-upsert": "true",
      },
      body: imgBuf,
    });
    if (!upRes.ok) return metaUrl;
  } catch {
    return metaUrl;
  }

  return publicUrl(supabaseUrl, key);
}
