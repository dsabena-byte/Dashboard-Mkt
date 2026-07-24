import "server-only";

// Cliente REST de Supabase con service-role (bypassa RLS) para lectura/escritura
// desde route handlers server-side. Mismo patrón que usan los crons.

function cfg() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase admin no configurado (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).");
  return { url, key };
}

export async function sbAdmin(path: string, init: RequestInit & { method: string }): Promise<Response> {
  const { url, key } = cfg();
  return fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });
}
