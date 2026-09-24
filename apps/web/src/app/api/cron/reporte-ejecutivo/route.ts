import { NextResponse } from "next/server";
import { runExecutiveReport, logCronRun } from "@/lib/alerts";

// Cron del REPORTE EJECUTIVO mensual (portado de BIP, sep-2026): el primer día hábil del mes, resumen
// del mes cerrado (objetivos, KPIs vs meta, share of search, alertas, Diagnóstico IA si es reciente).
// Corre todos los días (workflow alertas.yml); solo actúa el 1er día hábil y no se repite en el mes
// (alert_log). Gateado por CRON_SECRET. ?force=1 (ignora el día y el dedupe) · ?dry=1 (no envía).
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const u = new URL(req.url);
  const dry = u.searchParams.get("dry") === "1";
  try {
    const r = await runExecutiveReport({ force: u.searchParams.get("force") === "1", dry });
    if (!dry) await logCronRun("reporte-ejecutivo");
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
