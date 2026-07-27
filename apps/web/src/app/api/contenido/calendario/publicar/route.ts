import { NextResponse } from "next/server";
import { sbAdmin } from "@/lib/supabase-admin";
import { getPageToken, publicarImagenIG, publicarReelIG, publicarImagenFB, publicarVideoFB } from "@/lib/meta-publish";

// Publica UNA pieza del calendario en la red indicada, AHORA (a mano, botón de
// prueba). No cambia el estado ni depende del cron: sólo publica y devuelve el id.

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const TABLE = "contenido_calendario";

interface Row {
  imagen_final_url: string | null;
  imagen_url: string | null;
  video_url: string | null;
  caption: string | null;
  hashtags: string[] | null;
}

export async function POST(request: Request) {
  try {
    const { id, red, imageUrl } = (await request.json()) as { id?: string; red?: string; imageUrl?: string };
    if (!id || !red) return NextResponse.json({ ok: false, error: "Falta id o red." }, { status: 400 });

    const rowRes = await sbAdmin(`${TABLE}?id=eq.${id}&select=imagen_final_url,imagen_url,video_url,caption,hashtags`, { method: "GET" });
    if (!rowRes.ok) return NextResponse.json({ ok: false, error: `read ${rowRes.status}` }, { status: 500 });
    const row = ((await rowRes.json()) as Row[])[0];
    if (!row) return NextResponse.json({ ok: false, error: "Pieza no encontrada." }, { status: 404 });

    // imageUrl (imagen compuesta con placa, enviada por el browser) tiene prioridad;
    // si no vino, caemos a la final guardada o a la cruda.
    const imagen = imageUrl ?? row.imagen_final_url ?? row.imagen_url;
    const esVideo = !imagen && !!row.video_url;
    if (!imagen && !row.video_url) return NextResponse.json({ ok: false, error: "La pieza no tiene imagen ni video." }, { status: 400 });
    const caption = [row.caption ?? "", (row.hashtags ?? []).join(" ")].filter(Boolean).join("\n\n");

    const pageToken = await getPageToken();
    let postId: string;
    if (red === "instagram") {
      postId = esVideo && row.video_url ? await publicarReelIG(row.video_url, caption, pageToken) : await publicarImagenIG(imagen!, caption, pageToken);
    } else {
      postId = esVideo && row.video_url ? await publicarVideoFB(row.video_url, caption, pageToken) : await publicarImagenFB(imagen!, caption, pageToken);
    }

    // Guardamos el id del post (best-effort) para poder retirarlo después. Si las
    // columnas no existen todavía, el PATCH falla en silencio y el browser igual
    // recibe el id para poder retirar en la misma sesión.
    const col = red === "instagram" ? "publicado_ig_id" : "publicado_fb_id";
    await sbAdmin(`${TABLE}?id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ [col]: postId }) }).catch(() => {});

    return NextResponse.json({ ok: true, red, id: postId });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
