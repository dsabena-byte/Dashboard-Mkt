import { NextResponse } from "next/server";
import { runDigest, logCronRun } from "@/lib/alerts";

// Cron de ALERTAS por email (portado de BIP, sep-2026). Corre todos los días (workflow alertas.yml):
// lunes = resumen semanal; resto de los días = solo si aparece algo NUEVO de prioridad alta
// (según alert_prefs.frecuencia). Gateado por CRON_SECRET.
//   ?force=1 → manda el resumen semanal hoy · ?modo=semanal|diaria → fuerza el modo · ?dry=1 → no envía.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const u = new URL(req.url);
  const modoQ = u.searchParams.get("modo");
  const modo = modoQ === "semanal" || modoQ === "diaria" ? modoQ : undefined;
  const dry = u.searchParams.get("dry") === "1";
  try {
    const r = await runDigest({ force: u.searchParams.get("force") === "1", dry, modo });
    if (!dry) await logCronRun("alertas");
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
