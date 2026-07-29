import { NextResponse } from "next/server";
import { generarInsertProductoSubmit } from "@/lib/ugc";

// Encola un INSERT SHOT del producto Drean real (b-roll sin persona) para
// intercalar con el talking-head. Devuelve el frame + las URLs de estado; el
// cliente poolea /api/ugc/video/status hasta que aparece el video.

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    const { sku, escenario } = (await request.json()) as { sku?: string; escenario?: string };
    if (!sku?.trim()) return NextResponse.json({ ok: false, error: "Elegí un producto (modelo) para el insert." }, { status: 400 });
    const h = await generarInsertProductoSubmit(sku, escenario);
    return NextResponse.json({ ok: true, ...h });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
