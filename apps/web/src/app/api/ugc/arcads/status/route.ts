import { NextResponse } from "next/server";
import { getVideoUgcArcadsStatus } from "@/lib/ugc";

// Consulta el estado del render de Arcads por id + kind (videos|assets).
// Devuelve status y, cuando terminó, la video_url (y créditos consumidos).

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: Request) {
  try {
    const u = new URL(request.url);
    const id = u.searchParams.get("id");
    const kind = u.searchParams.get("kind") ?? "videos";
    if (!id) return NextResponse.json({ ok: false, error: "Falta id." }, { status: 400 });
    const { status, video_url, credits } = await getVideoUgcArcadsStatus(id, kind);
    return NextResponse.json({ ok: true, status, video_url, credits });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
