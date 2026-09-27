import { NextResponse } from "next/server";
import { computeSignalsDetailed, isSignalScope } from "@/lib/signals";

// Señales determinísticas de un tablero (motor de reglas, sin IA): se calculan al vuelo sobre
// fuentes precalculadas/baratas. Las pide el cliente al abrir la sección "Diagnóstico" (no en el
// render de la página). ?dash=<slug> (o "cruces"); sin dash = todos los tableros. ?fresh=1 saltea
// la caché de 15 min (botón "Reintentar"). Cada fuente tiene un tope de tiempo: si una no responde,
// se devuelven las demás señales + `skipped` (fuentes omitidas) en vez de colgar la respuesta.
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const dash = sp.get("dash") ?? "";
  if (dash && !isSignalScope(dash)) return NextResponse.json({ signals: [], skipped: [] });
  const fresh = sp.get("fresh") === "1";
  try {
    const r = await computeSignalsDetailed(dash && isSignalScope(dash) ? dash : undefined, { fresh });
    return NextResponse.json(
      { signals: r.signals, skipped: r.skipped, computedAt: r.computedAt, cached: r.cached, ms: r.ms, timings: r.timings },
      { headers: { "Server-Timing": `signals;dur=${r.ms};desc="${r.cached ? "cache" : "calc"}"` } },
    );
  } catch {
    return NextResponse.json({ signals: [], skipped: [], error: "No se pudieron calcular las señales." });
  }
}
