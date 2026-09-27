import { NextResponse } from "next/server";
import { runEnviosTableros } from "@/lib/tablero-share-server";
import { logCronRun } from "@/lib/alerts";

// Cron del ENVÍO PROGRAMADO de Mis tableros (mail con el link de solo lectura): semanal = lunes,
// mensual = primer día del mes (hora AR). Corre todos los días desde alertas.yml; cada envío decide
// si le toca. Gateado por CRON_SECRET. ?force=1 (ignora el día) · ?dry=1 (no envía) · ?slug=<tablero>.
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
    const results = await runEnviosTableros({ force: u.searchParams.get("force") === "1", dry, slug: u.searchParams.get("slug") });
    if (!dry) await logCronRun("tableros-envio");
    return NextResponse.json({ ok: true, count: results.length, enviados: results.filter((r) => r.enviado).length, results });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
