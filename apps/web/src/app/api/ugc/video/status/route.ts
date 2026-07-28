import { NextResponse } from "next/server";
import { getVideoUgcStatus } from "@/lib/ugc";

// Consulta el estado del render de video (por request_id). Devuelve status y,
// cuando terminó, la video_url.

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: Request) {
  try {
    const id = new URL(request.url).searchParams.get("request_id");
    if (!id) return NextResponse.json({ ok: false, error: "Falta request_id." }, { status: 400 });
    const { status, video_url } = await getVideoUgcStatus(id);
    return NextResponse.json({ ok: true, status, video_url });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
