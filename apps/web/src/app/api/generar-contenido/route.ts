import { NextResponse } from "next/server";
import { generarPiezas, type GenerarParams } from "@/lib/contenido-generar";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as GenerarParams;
    const result = await generarPiezas(body);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.piezas[0]?.error ?? "Falló la generación." }, { status: 500 });
    }
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
