import { NextResponse } from "next/server";
import { getValidacionMapa } from "@/lib/mapa-validacion-server";

// Evidencia de cada vínculo KPI → objetivo del Mapa contra el share de mercado de Drean (correlación
// rezagada 0-3 meses en variaciones; lib/stats/validacion). A demanda: lee el Seguimiento (pesado
// para el render de /mapa-estrategico). Solo lectura.
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const maxDuration = 60;

export async function GET() {
  try {
    const data = await getValidacionMapa();
    return NextResponse.json({ data });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
