import { NextResponse } from "next/server";
import { generarVideoUgcSubmit } from "@/lib/ugc";

// Encola el video (voz + OmniHuman) y devuelve el request_id. El cliente poolea
// /api/ugc/video/status hasta que esté listo (el render puede tardar minutos).

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const { guion, voz, persona_url } = (await request.json()) as { guion?: string; voz?: string; persona_url?: string };
    if (!guion?.trim()) return NextResponse.json({ ok: false, error: "Falta el guion." }, { status: 400 });
    if (!persona_url) return NextResponse.json({ ok: false, error: "Falta el retrato de la persona (generalo primero)." }, { status: 400 });
    const h = await generarVideoUgcSubmit(guion, voz ?? "fem", persona_url);
    return NextResponse.json({ ok: true, ...h });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
