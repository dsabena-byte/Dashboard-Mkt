import { NextResponse } from "next/server";
import { previewEscenaImagen } from "@/lib/ugc";

// Preview BARATO de la escena como imagen fija (fal image), para verla antes de
// gastar en video. Devuelve { image_url }.

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const { genero, escenario, edad, vestimenta, perfil } = (await request.json()) as {
      genero?: string; escenario?: string; edad?: string; vestimenta?: string; perfil?: string;
    };
    const image_url = await previewEscenaImagen({ genero, escenario, edad, vestimenta, perfil });
    return NextResponse.json({ ok: true, image_url });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
