import { NextResponse } from "next/server";
import { generarVideoUgcProductoSubmit } from "@/lib/ugc";

// Encola un talking-head UGC CON el producto Drean real en la escena, usando el
// endpoint reference-to-video de Seedance 2.0 (el packshot va como @Image1 y se
// mantiene fiel). El cliente poolea /api/ugc/video/status hasta que esté listo.

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const { sku, guion, genero, escenario, duracion, edad, vestimenta, perfil, detalles } = (await request.json()) as {
      sku?: string; guion?: string; genero?: string; escenario?: string; duracion?: number; edad?: string; vestimenta?: string; perfil?: string; detalles?: string;
    };
    if (!guion?.trim()) return NextResponse.json({ ok: false, error: "Falta el guion." }, { status: 400 });
    if (!sku?.trim()) return NextResponse.json({ ok: false, error: "Elegí un producto (modelo) para meterlo en la escena." }, { status: 400 });
    const h = await generarVideoUgcProductoSubmit(sku, guion, genero, escenario, duracion, edad, vestimenta, perfil, detalles);
    return NextResponse.json({ ok: true, ...h });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
