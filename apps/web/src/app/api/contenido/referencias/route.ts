import { NextResponse } from "next/server";
import { getReferenciaCandidatos } from "@/lib/contenido-queries";

export const dynamic = "force-dynamic";

// Candidatos de referencia de estilo para el selector (thumbnails de top posts
// del pilar/categoría). GET ?pilar=...&categoria=...
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const pilar = searchParams.get("pilar") ?? "";
    const categoria = searchParams.get("categoria") ?? "porfolio";
    const candidatos = await getReferenciaCandidatos(pilar, categoria);
    return NextResponse.json({ ok: true, candidatos });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message, candidatos: [] }, { status: 500 });
  }
}
