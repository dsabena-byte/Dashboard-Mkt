import { NextResponse } from "next/server";
import { getAlertPrefs, saveAlertPrefs } from "@/lib/alerts";
import { cleanRecipients, dominiosEnvio, soloDominiosEnvio, FRECUENCIAS, type Frecuencia } from "@/lib/alerts-shared";
import { cleanPhones } from "@/lib/whatsapp-shared";
import { alertasUser } from "./_lib/auth";
import { exigirEdicion } from "@/lib/usuarios-server";

// Preferencias de alertas por email y WhatsApp (singleton alert_prefs, migraciones 0108 + 0123).
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
  const sinPermiso = await exigirEdicion("marketing");
  if (sinPermiso) return sinPermiso;
  const b = (await req.json().catch(() => ({}))) as { emailOn?: boolean; frecuencia?: string; destinatarios?: unknown; reporteOn?: boolean; whatsappOn?: boolean; whatsappDestinatarios?: unknown };
  const frecuencia = (FRECUENCIAS.includes(String(b.frecuencia) as Frecuencia) ? b.frecuencia : "auto") as Frecuencia;
  const { ok: destinatarios, rejected } = soloDominiosEnvio(cleanRecipients(b.destinatarios), dominiosEnvio(process.env.SHARE_ALLOWED_DOMAINS));
  if (rejected.length) return NextResponse.json({ error: `Solo se puede enviar a emails de la empresa. Fuera: ${rejected.join(", ")}` }, { status: 400 });
  try {
    const r = await saveAlertPrefs({
      emailOn: b.emailOn !== false, frecuencia, destinatarios, reporteOn: b.reporteOn !== false,
      whatsappOn: b.whatsappOn === true, whatsappDestinatarios: cleanPhones(b.whatsappDestinatarios),
    }, u.email);
    return NextResponse.json({ ok: true, whatsappSaved: r.whatsappSaved });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
