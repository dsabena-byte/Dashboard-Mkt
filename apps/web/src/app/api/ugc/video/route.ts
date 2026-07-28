import { NextResponse } from "next/server";
import { generarVideoUgc } from "@/lib/ugc";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const { guion, voz, persona_url } = (await request.json()) as { guion?: string; voz?: string; persona_url?: string };
    if (!guion?.trim()) return NextResponse.json({ ok: false, error: "Falta el guion." }, { status: 400 });
    if (!persona_url) return NextResponse.json({ ok: false, error: "Falta el retrato de la persona (generalo primero)." }, { status: 400 });
    const out = await generarVideoUgc(guion, voz ?? "fem", persona_url);
    return NextResponse.json({ ok: true, ...out });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
