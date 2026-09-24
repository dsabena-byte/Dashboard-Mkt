import { NextResponse } from "next/server";
import { computeSignals, isSignalScope } from "@/lib/signals";

// Señales determinísticas de un tablero (motor de reglas, sin IA): se calculan al vuelo sobre
// fuentes precalculadas/baratas. Las pide el cliente al abrir la sección "Diagnóstico" (no en el
// render de la página). ?dash=<slug> (o "cruces"); sin dash = todos los tableros.
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: Request) {
  const dash = new URL(req.url).searchParams.get("dash") ?? "";
  if (dash && !isSignalScope(dash)) return NextResponse.json({ signals: [] });
  const signals = await computeSignals(dash && isSignalScope(dash) ? dash : undefined).catch(() => []);
  return NextResponse.json({ signals, computedAt: new Date().toISOString() });
}
