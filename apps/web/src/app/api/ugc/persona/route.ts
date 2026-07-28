import { NextResponse } from "next/server";
import { generarPersonaUgc } from "@/lib/ugc";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    const b = (await request.json()) as { perfil?: string; descripcion?: string; genero?: string; edad?: string };
    const image_url = await generarPersonaUgc({ perfil: b.perfil ?? "usuario", descripcion: b.descripcion, genero: b.genero, edad: b.edad });
    return NextResponse.json({ ok: true, image_url });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
