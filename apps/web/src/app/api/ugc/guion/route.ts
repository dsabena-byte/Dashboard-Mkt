import { NextResponse } from "next/server";
import { generarGuionUgc } from "@/lib/ugc";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const b = (await request.json()) as { perfil?: string; tema?: string; pilar?: string; formato?: string; detalles?: string; modelo?: string };
    const guion = await generarGuionUgc({ perfil: b.perfil ?? "usuario", tema: b.tema ?? "", pilar: b.pilar, formato: b.formato, detalles: b.detalles, modelo: b.modelo });
    return NextResponse.json({ ok: true, guion });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
