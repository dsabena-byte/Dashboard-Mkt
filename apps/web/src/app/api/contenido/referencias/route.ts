import { NextResponse } from "next/server";
import { getReferenciaCandidatos } from "@/lib/contenido-queries";

export const dynamic = "force-dynamic";

// Posteos recientes (con imagen y pilar) para elegir como referencia de estilo.
export async function GET() {
  try {
    const candidatos = await getReferenciaCandidatos();
    return NextResponse.json({ ok: true, candidatos });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message, candidatos: [] }, { status: 500 });
  }
}
