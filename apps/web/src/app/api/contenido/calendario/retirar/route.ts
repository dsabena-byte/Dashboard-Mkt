import { NextResponse } from "next/server";
import { sbAdmin } from "@/lib/supabase-admin";
import { getPageToken, borrarPublicacion } from "@/lib/meta-publish";
import { exigirEdicion } from "@/lib/usuarios-server";

// Retira (borra) una publicación ya hecha en IG o FB. Toma el id de la publicación
// SOLO de la fila (lo guarda /publicar). Borra vía Graph API y limpia la columna.

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TABLE = "contenido_calendario";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const sinPermiso = await exigirEdicion("marketing");
  if (sinPermiso) return sinPermiso;
  try {
    const { id, red } = (await request.json()) as { id?: string; red?: string };
    if (!red || (red !== "instagram" && red !== "facebook")) return NextResponse.json({ ok: false, error: "Falta red válida." }, { status: 400 });
    if (!id || !UUID.test(id)) return NextResponse.json({ ok: false, error: "Falta id válido." }, { status: 400 });

    const col = red === "instagram" ? "publicado_ig_id" : "publicado_fb_id";

    // Solo se borra lo que publicamos nosotros (id guardado en la fila), nunca un id que mande el navegador.
    let pid: string | undefined;
    const rowRes = await sbAdmin(`${TABLE}?id=eq.${id}&select=${col}`, { method: "GET" });
    if (rowRes.ok) {
      const row = ((await rowRes.json()) as Record<string, string | null>[])[0];
      pid = row?.[col] ?? undefined;
    }
    if (pid && !/^\d+(_\d+)?$/.test(pid)) return NextResponse.json({ ok: false, error: "Id de publicación inválido." }, { status: 400 });
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
