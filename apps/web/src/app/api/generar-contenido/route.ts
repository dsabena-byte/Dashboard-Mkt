import { NextResponse } from "next/server";
import { generarPiezas, type GenerarParams } from "@/lib/contenido-generar";
import { aiQuotaGate } from "@/lib/ai-quota";
import { exigirEdicion } from "@/lib/usuarios-server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request) {
  const sinPermiso = await exigirEdicion("marketing");
  if (sinPermiso) return sinPermiso;
  try {
    const body = (await request.json()) as GenerarParams;
    const cuota = await aiQuotaGate("imagen"); // tope diario persistido (D-10)
    if (cuota) return cuota;
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
