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

/**
 * Variante estricta (miniaturas DV360): mismo bucket y misma lógica que `mirrorMetaImage`, pero devuelve el
 * resultado explícito y exige que la respuesta sea una imagen (no sube una página de error como si fuera .jpg).
 * `already` = ya estaba en el bucket (no se re-descarga). Con `dry` solo verifica que la fuente responda imagen.
 */
export async function mirrorImageStrict(
  srcUrl: string,
  key: string,
  opts: { dry?: boolean } = {},
): Promise<{ ok: true; url: string; already: boolean } | { ok: false; error: string }> {
  const supabaseUrl = env("NEXT_PUBLIC_SUPABASE_URL").replace(/\/+$/, "");
  const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY");
  try {
    if (await exists(supabaseUrl, key)) return { ok: true, url: publicUrl(supabaseUrl, key), already: true };
  } catch {
    // seguimos a la descarga
  }
  let buf: ArrayBuffer;
  let contentType: string;
  try {
    const res = await fetch(srcUrl, { cache: "no-store" });
    if (!res.ok) return { ok: false, error: `fuente ${res.status}` };
    contentType = (res.headers.get("content-type") || "").split(";")[0]!.trim();
    if (!contentType.startsWith("image/")) return { ok: false, error: `fuente no es imagen (${contentType || "sin content-type"})` };
    buf = await res.arrayBuffer();
    if (buf.byteLength < 100) return { ok: false, error: `imagen vacía (${buf.byteLength} B)` };
  } catch (e) {
    return { ok: false, error: `fuente: ${e instanceof Error ? e.message : String(e)}` };
  }
  if (opts.dry) return { ok: true, url: srcUrl, already: false };
  try {
    const up = await fetch(`${supabaseUrl}/storage/v1/object/${BUCKET}/${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": contentType, "x-upsert": "true" },
      body: buf,
    });
    if (!up.ok) return { ok: false, error: `storage ${up.status}: ${(await up.text()).slice(0, 200)}` };
  } catch (e) {
    return { ok: false, error: `storage: ${e instanceof Error ? e.message : String(e)}` };
  }
  return { ok: true, url: publicUrl(supabaseUrl, key), already: false };
}

/** Sube un JSON al mismo bucket (manifiestos). Cache corto para que el dash vea la versión nueva enseguida. */
export async function uploadBucketJson(key: string, data: unknown): Promise<{ ok: boolean; url: string; error?: string }> {
  const supabaseUrl = env("NEXT_PUBLIC_SUPABASE_URL").replace(/\/+$/, "");
  const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY");
  const url = publicUrl(supabaseUrl, key);
  const r = await fetch(`${supabaseUrl}/storage/v1/object/${BUCKET}/${encodeURIComponent(key)}`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      "x-upsert": "true",
      "cache-control": "max-age=60",
    },
    body: JSON.stringify(data),
  });
  return r.ok ? { ok: true, url } : { ok: false, url, error: `storage ${r.status}: ${(await r.text()).slice(0, 200)}` };
}

/** URL pública de un objeto del bucket de miniaturas. */
export function bucketPublicUrl(key: string): string {
  return publicUrl(env("NEXT_PUBLIC_SUPABASE_URL"), key);
}
