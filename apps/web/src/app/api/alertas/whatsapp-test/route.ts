import { NextResponse } from "next/server";
import { getAlertPrefs, logSent } from "@/lib/alerts";
import { appUrl } from "@/lib/notify";
import { getTenant } from "@/lib/tenant/current";
import { whatsappStatus, sendWhatsAppMany, lastWhatsappHeartbeat } from "@/lib/whatsapp";
import { cleanPhones, formatTestWhatsApp } from "@/lib/whatsapp-shared";
import { alertasUser } from "../_lib/auth";

// WhatsApp de Alertas (Evolution API, docs/whatsapp-evolution-railway.md). Mismo permiso que editar las
// preferencias (alertasUser).
//   GET  → estado de la instancia (open = vinculada) + último latido de los crons.
//   POST → "Enviar prueba por WhatsApp" a los números del body (lo que está en pantalla) o a los guardados.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  const u = await alertasUser();
  if (!u.ok) return NextResponse.json({ error: u.error }, { status: u.status });
  const [st, hb] = await Promise.all([whatsappStatus(8_000), lastWhatsappHeartbeat()]);
  return NextResponse.json({ state: st.state, conectado: st.ok, instance: st.instance, error: st.error ?? null, ultimo: hb });
}

export async function POST(req: Request) {
  const u = await alertasUser();
  if (!u.ok) return NextResponse.json({ error: u.error }, { status: u.status });
  const b = (await req.json().catch(() => ({}))) as { numeros?: unknown };
  const fromBody = cleanPhones(b.numeros ?? []);
  const to = fromBody.length ? fromBody : (await getAlertPrefs()).whatsappDestinatarios;
  if (!to.length) return NextResponse.json({ error: "No hay números: cargá al menos un celular (ej. 11 1234-5678)." }, { status: 400 });
  const st = await whatsappStatus();
  if (!st.ok) {
    const error = st.state === "sin_config"
      ? "WhatsApp no está configurado en el servidor (faltan EVO_URL / EVO_API_KEY en Vercel). Pedíselo a tu administrador."
      : "WhatsApp está desconectado: falta vincular el número. Pedíselo a tu administrador.";
    return NextResponse.json({ error, state: st.state }, { status: 409 });
  }
  const r = await sendWhatsAppMany(to, formatTestWhatsApp({ marca: getTenant().displayName, appUrl: appUrl() }));
  if (r.enviados) await logSent(["test"], "prueba_whatsapp").catch(() => undefined);
  if (!r.enviados) return NextResponse.json({ error: r.errores.map((e) => e.error).join(" · ").slice(0, 300) || "No se pudo enviar." }, { status: 502 });
  return NextResponse.json({ ok: true, to, enviados: r.enviados, errores: r.errores });
}
