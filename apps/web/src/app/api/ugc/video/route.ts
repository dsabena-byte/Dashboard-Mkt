import { NextResponse } from "next/server";
import { generarVideoUgcSeedanceSubmit } from "@/lib/ugc";
import { aiQuotaGate } from "@/lib/ai-quota";
import { exigirEdicion } from "@/lib/usuarios-server";

// Encola el video UGC con Seedance 2.0 (nativo: persona + voz + escena en un paso)
// y devuelve el request_id. El cliente poolea /api/ugc/video/status hasta que esté
// listo (el render puede tardar minutos).

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const sinPermiso = await exigirEdicion("marketing");
  if (sinPermiso) return sinPermiso;
  try {
    const { guion, genero, escenario, duracion, edad, vestimenta, perfil, detalles } = (await request.json()) as { guion?: string; genero?: string; escenario?: string; duracion?: number; edad?: string; vestimenta?: string; perfil?: string; detalles?: string };
    if (!guion?.trim()) return NextResponse.json({ ok: false, error: "Falta el guion." }, { status: 400 });
    const cuota = await aiQuotaGate("video"); // tope diario persistido (D-10)
    if (cuota) return cuota;
    const h = await generarVideoUgcSeedanceSubmit(guion, genero, escenario, duracion, edad, vestimenta, perfil, detalles);
    return NextResponse.json({ ok: true, ...h });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
