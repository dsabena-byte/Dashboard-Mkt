import { NextResponse } from "next/server";
import { getVideoUgcStatus } from "@/lib/ugc";

// Consulta el estado del render de video (por request_id). Devuelve status y,
// cuando terminó, la video_url.

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: Request) {
  try {
    const u = new URL(request.url);
    const statusUrl = u.searchParams.get("status_url");
    const responseUrl = u.searchParams.get("response_url");
    if (!statusUrl || !responseUrl) return NextResponse.json({ ok: false, error: "Faltan status_url/response_url." }, { status: 400 });
    // Seguridad mínima: sólo aceptamos URLs de la cola de fal.
    if (!statusUrl.startsWith("https://queue.fal.run/") || !responseUrl.startsWith("https://queue.fal.run/")) {
      return NextResponse.json({ ok: false, error: "URL inválida." }, { status: 400 });
    }
    const { status, video_url } = await getVideoUgcStatus(statusUrl, responseUrl);
    return NextResponse.json({ ok: true, status, video_url });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
