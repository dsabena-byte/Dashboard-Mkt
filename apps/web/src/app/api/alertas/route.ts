import { NextResponse } from "next/server";
import { getAlertPrefs, saveAlertPrefs } from "@/lib/alerts";
import { cleanRecipients, FRECUENCIAS, type Frecuencia } from "@/lib/alerts-shared";
import { alertasUser } from "./_lib/auth";

// Preferencias de alertas por email (singleton alert_prefs, migración 0108).
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const u = await alertasUser();
  if (!u.ok) return NextResponse.json({ error: u.error }, { status: u.status });
  return NextResponse.json({ prefs: await getAlertPrefs() });
}

export async function POST(req: Request) {
  const u = await alertasUser();
  if (!u.ok) return NextResponse.json({ error: u.error }, { status: u.status });
  const b = (await req.json().catch(() => ({}))) as { emailOn?: boolean; frecuencia?: string; destinatarios?: unknown; reporteOn?: boolean };
  const frecuencia = (FRECUENCIAS.includes(String(b.frecuencia) as Frecuencia) ? b.frecuencia : "auto") as Frecuencia;
  try {
    await saveAlertPrefs({ emailOn: b.emailOn !== false, frecuencia, destinatarios: cleanRecipients(b.destinatarios), reporteOn: b.reporteOn !== false }, u.email);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
