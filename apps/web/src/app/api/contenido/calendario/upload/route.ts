import { NextResponse } from "next/server";
import { sbAdmin } from "@/lib/supabase-admin";

// Sube una imagen/video externo (desarrollado por fuera) a un bucket de Supabase
// y lo guarda en la entrada del calendario (imagen_url / video_url). Permite
// mezclar contenido generado por IA con contenido propio.

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BUCKET = "contenido-uploads";
const TABLE = "contenido_calendario";

function env(k: string): string {
  const v = process.env[k];
  if (!v) throw new Error(`Env var ${k} no configurada`);
  return v;
}

// Best-effort: crea el bucket público si no existe (evita paso manual).
async function ensureBucket(url: string, key: string) {
  try {
    await fetch(`${url}/storage/v1/bucket`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ id: BUCKET, name: BUCKET, public: true }),
    });
  } catch { /* ya existe o sin permiso; el upload dirá si falla */ }
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    const id = form.get("id");
    const kind = form.get("kind"); // "imagen" | "video"
    if (!(file instanceof File)) return NextResponse.json({ ok: false, error: "Falta el archivo." }, { status: 400 });
    if (typeof id !== "string") return NextResponse.json({ ok: false, error: "Falta id." }, { status: 400 });
    const esVideo = kind === "video";
    const col = esVideo ? "video_url" : "imagen_url";

    const url = env("NEXT_PUBLIC_SUPABASE_URL");
    const key = env("SUPABASE_SERVICE_ROLE_KEY");
    await ensureBucket(url, key);

    const ext = (file.name.split(".").pop() || (esVideo ? "mp4" : "jpg")).toLowerCase().replace(/[^a-z0-9]/g, "") || (esVideo ? "mp4" : "jpg");
    const path = `${id}/${crypto.randomUUID()}.${ext}`;
    const bytes = await file.arrayBuffer();

    const up = await fetch(`${url}/storage/v1/object/${BUCKET}/${path}`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": file.type || "application/octet-stream", "x-upsert": "true" },
      body: bytes,
    });
    if (!up.ok) return NextResponse.json({ ok: false, error: `upload ${up.status}: ${(await up.text()).slice(0, 300)}` }, { status: 500 });
    const publicUrl = `${url}/storage/v1/object/public/${BUCKET}/${path}`;

    const patch: Record<string, unknown> = { [col]: publicUrl, updated_at: new Date().toISOString() };
    if (!esVideo) patch.estado = "generado"; // imagen subida = contenido listo para revisar
    const upd = await sbAdmin(`${TABLE}?id=eq.${id}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(patch) });
    if (!upd.ok) return NextResponse.json({ ok: false, error: `save ${upd.status}: ${(await upd.text()).slice(0, 300)}` }, { status: 500 });
    const rows = (await upd.json()) as unknown[];
    return NextResponse.json({ ok: true, item: rows[0] ?? null, url: publicUrl });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
