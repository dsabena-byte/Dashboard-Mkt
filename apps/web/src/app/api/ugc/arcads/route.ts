import { NextResponse } from "next/server";
import { generarVideoUgcArcadsSubmit } from "@/lib/ugc";

// Encola un video UGC "pro" con Arcads (Veo 3.1 / Sora 2 / Kling / Seedance).
// Devuelve { id, kind } para poolear /api/ugc/arcads/status. Flujo paralelo al
// Seedance barato; requiere credenciales ARCADS_* en Vercel.

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const { model, guion, genero, escenario, duracion, edad, vestimenta } = (await request.json()) as {
      model?: string; guion?: string; genero?: string; escenario?: string; duracion?: number; edad?: string; vestimenta?: string;
    };
    if (!guion?.trim()) return NextResponse.json({ ok: false, error: "Falta el guion." }, { status: 400 });
    if (!model?.trim()) return NextResponse.json({ ok: false, error: "Elegí un modelo de Arcads." }, { status: 400 });
    const h = await generarVideoUgcArcadsSubmit(model, guion, genero, escenario, duracion, edad, vestimenta);
    return NextResponse.json({ ok: true, ...h });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
