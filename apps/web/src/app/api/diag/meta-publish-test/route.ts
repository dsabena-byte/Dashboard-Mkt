import { NextResponse } from "next/server";
import { getPageToken, publicarImagenIG, publicarReelIG, publicarImagenFB, publicarVideoFB } from "@/lib/meta-publish";

// Prueba MANUAL de publicación en IG/FB (Fase 2), sin tocar el calendario.
// Publica UN contenido puntual para confirmar que la conexión funciona.
//
// Uso:
//   GET /api/diag/meta-publish-test?red=ig&image=<url>&caption=<texto>        → DRY (no publica, sólo muestra qué haría)
//   GET /api/diag/meta-publish-test?red=ig&image=<url>&caption=<texto>&go=1   → PUBLICA de verdad
//   red: ig | fb | both
//   image=<url pública>  (o)  video=<url pública>
//
// ⚠️ Con go=1 publica en las cuentas REALES de Drean.

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const out: Record<string, unknown> = {};
  try {
    const url = new URL(request.url);
    const red = url.searchParams.get("red") ?? "ig";
    const image = url.searchParams.get("image") ?? "";
    const video = url.searchParams.get("video") ?? "";
    const caption = url.searchParams.get("caption") ?? "Prueba de publicación desde el dashboard 🧪";
    const go = url.searchParams.get("go") === "1";

    if (!image && !video) {
      return NextResponse.json({ ok: false, error: "Falta ?image=<url> o ?video=<url> (URL pública)." }, { status: 400 });
    }
    const redes = red === "both" ? ["instagram", "facebook"] : [red];
    out.plan = { redes, tipo: video ? "video" : "imagen", asset: video || image, caption, modo: go ? "PUBLICA" : "dry-run (no publica)" };

    if (!go) return NextResponse.json({ ok: true, dry: true, nota: "Agregá &go=1 para publicar de verdad.", ...out });

    const pageToken = await getPageToken();
    const resultado: Record<string, string> = {};
    for (const r of redes) {
      if (r === "instagram") {
        resultado.instagram = video ? await publicarReelIG(video, caption, pageToken) : await publicarImagenIG(image, caption, pageToken);
      } else if (r === "facebook") {
        resultado.facebook = video ? await publicarVideoFB(video, caption, pageToken) : await publicarImagenFB(image, caption, pageToken);
      }
    }
    return NextResponse.json({ ok: true, publicado: resultado, ...out });
  } catch (e) {
    out.error = e instanceof Error ? e.message : String(e);
    return NextResponse.json(out, { status: 500 });
  }
}
