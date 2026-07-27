import { NextResponse } from "next/server";
import { sbAdmin } from "@/lib/supabase-admin";
import { getPageToken, borrarPublicacion } from "@/lib/meta-publish";

// Retira (borra) una publicación ya hecha en IG o FB. Acepta el postId directo
// (que el browser recibió al publicar) o lo busca en la base. Borra vía Graph
// API y limpia la columna guardada.

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TABLE = "contenido_calendario";

export async function POST(request: Request) {
  try {
    const { id, red, postId } = (await request.json()) as { id?: string; red?: string; postId?: string };
    if (!red || (red !== "instagram" && red !== "facebook")) return NextResponse.json({ ok: false, error: "Falta red válida." }, { status: 400 });

    const col = red === "instagram" ? "publicado_ig_id" : "publicado_fb_id";

    let pid = postId;
    if (!pid && id) {
      const rowRes = await sbAdmin(`${TABLE}?id=eq.${id}&select=${col}`, { method: "GET" });
      if (rowRes.ok) {
        const row = ((await rowRes.json()) as Record<string, string | null>[])[0];
        pid = row?.[col] ?? undefined;
      }
    }
    if (!pid) return NextResponse.json({ ok: false, error: "No hay un id de publicación para retirar (¿se publicó desde acá?)." }, { status: 400 });

    const pageToken = await getPageToken();
    await borrarPublicacion(pid, pageToken);

    // Limpiamos la columna (best-effort; si no existe, no pasa nada).
    if (id) await sbAdmin(`${TABLE}?id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ [col]: null }) }).catch(() => {});

    return NextResponse.json({ ok: true, red });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
