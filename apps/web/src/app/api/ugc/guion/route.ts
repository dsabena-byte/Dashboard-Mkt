import { NextResponse } from "next/server";
import { generarGuionUgc } from "@/lib/ugc";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const { perfil, tema, detalles } = (await request.json()) as { perfil?: string; tema?: string; detalles?: string };
    const guion = await generarGuionUgc(perfil ?? "usuario", tema ?? "", detalles);
    return NextResponse.json({ ok: true, guion });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
