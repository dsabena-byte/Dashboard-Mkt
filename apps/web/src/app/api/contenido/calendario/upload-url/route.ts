import { NextResponse } from "next/server";

// Genera una URL FIRMADA de subida para que el navegador suba el archivo DIRECTO
// a Supabase Storage (sin pasar por Vercel → sin límite de 4,5MB). Devuelve la
// URL de subida + la URL pública final. La escritura en la entrada del calendario
// la hace el cliente después con /api/contenido/calendario (JSON chico).

export const dynamic = "force-dynamic";

const BUCKET = "contenido-uploads";

function env(k: string): string {
  const v = process.env[k];
  if (!v) throw new Error(`Env var ${k} no configurada`);
  return v;
}

async function ensureBucket(url: string, key: string) {
  try {
    await fetch(`${url}/storage/v1/bucket`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ id: BUCKET, name: BUCKET, public: true }),
    });
  } catch { /* ya existe */ }
}

export async function POST(request: Request) {
  try {
    const { id, kind, filename } = (await request.json()) as { id?: string; kind?: string; filename?: string };
    if (!id) return NextResponse.json({ ok: false, error: "Falta id." }, { status: 400 });
    const esVideo = kind === "video";

    const url = env("NEXT_PUBLIC_SUPABASE_URL");
    const key = env("SUPABASE_SERVICE_ROLE_KEY");
    await ensureBucket(url, key);

    const ext = ((filename ?? "").split(".").pop() || (esVideo ? "mp4" : "jpg")).toLowerCase().replace(/[^a-z0-9]/g, "") || (esVideo ? "mp4" : "jpg");
    const path = `${id}/${crypto.randomUUID()}.${ext}`;

    // URL firmada de subida (createSignedUploadUrl vía REST).
    const signRes = await fetch(`${url}/storage/v1/object/upload/sign/${BUCKET}/${path}`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: "{}",
    });
    if (!signRes.ok) return NextResponse.json({ ok: false, error: `sign ${signRes.status}: ${(await signRes.text()).slice(0, 300)}` }, { status: 500 });
    const signData = (await signRes.json()) as { url?: string };
    if (!signData.url) return NextResponse.json({ ok: false, error: "No se obtuvo la URL firmada." }, { status: 500 });

    const uploadUrl = `${url}/storage/v1${signData.url}`; // signData.url arranca con /object/upload/sign/...
    const publicUrl = `${url}/storage/v1/object/public/${BUCKET}/${path}`;
    return NextResponse.json({ ok: true, uploadUrl, publicUrl, col: esVideo ? "video_url" : "imagen_url", esVideo });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
