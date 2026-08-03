import { NextResponse } from "next/server";
import { falQueueVideoStatus } from "@/lib/fal-client";

// Poll del estado del reframe de video (cola async de fal). El cliente manda las
// URLs status_url/response_url que devolvió el submit y acá se consulta el estado
// → cuando está COMPLETED se devuelve la URL del mp4 final.

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { statusUrl, responseUrl } = (await request.json()) as { statusUrl?: string; responseUrl?: string };
    if (!statusUrl || !responseUrl) return NextResponse.json({ ok: false, error: "Faltan las URLs de estado." }, { status: 400 });
    const r = await falQueueVideoStatus(statusUrl, responseUrl);
    return NextResponse.json({ ok: true, status: r.status, video_url: r.video_url, raw: r.raw });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
