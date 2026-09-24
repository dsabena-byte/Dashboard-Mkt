import { NextResponse } from "next/server";
import { runDigest, runExecutiveReport, getAlertPrefs, resolveRecipients } from "@/lib/alerts";
import { emailEnabled } from "@/lib/notify";
import { alertasUser } from "../_lib/auth";

// "Enviar una prueba ahora": manda el email de alertas (o el reporte ejecutivo) con los datos de HOY a
// los destinatarios configurados (o al usuario si no hay). No afecta el dedupe de los envíos automáticos.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  const u = await alertasUser();
  if (!u.ok) return NextResponse.json({ error: u.error }, { status: u.status });
  if (!emailEnabled()) return NextResponse.json({ error: "El envío de emails no está configurado (falta RESEND_API_KEY en Vercel)." }, { status: 503 });
  const b = (await req.json().catch(() => ({}))) as { tipo?: "alertas" | "reporte" };
  const prefs = await getAlertPrefs();
  let to = resolveRecipients(prefs);
  if (!to.length && u.email) to = [u.email];
  if (!to.length) return NextResponse.json({ error: "No hay destinatarios: cargá al menos un email." }, { status: 400 });
  try {
    if (b.tipo === "reporte") {
      const r = await runExecutiveReport({ test: true, to });
      return r.enviado ? NextResponse.json({ ok: true, to }) : NextResponse.json({ error: r.motivo ?? "No se pudo enviar." }, { status: 500 });
    }
    const r = await runDigest({ test: true, to });
    return r.enviado ? NextResponse.json({ ok: true, to, items: r.items }) : NextResponse.json({ error: r.motivo ?? "No se pudo enviar." }, { status: 500 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
