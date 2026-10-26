import { NextResponse } from "next/server";
import { generarPersonaUgc } from "@/lib/ugc";
import { aiQuotaGate } from "@/lib/ai-quota";
import { exigirEdicion } from "@/lib/usuarios-server";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(request: Request) {
  const sinPermiso = await exigirEdicion("marketing");
  if (sinPermiso) return sinPermiso;
  try {
    const b = (await request.json()) as { perfil?: string; descripcion?: string; genero?: string; edad?: string };
    const cuota = await aiQuotaGate("imagen"); // tope diario persistido (D-10)
    if (cuota) return cuota;
    const image_url = await generarPersonaUgc({ perfil: b.perfil ?? "usuario", descripcion: b.descripcion, genero: b.genero, edad: b.edad });
    return NextResponse.json({ ok: true, image_url });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
