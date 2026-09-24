import "server-only";

// Emails transaccionales (Resend por API REST, sin SDK) — portado de BIP (sep-2026). Best-effort: si
// falta RESEND_API_KEY o el envío falla, devuelve false y NO rompe el request.
// Remitente: NOTIFY_FROM (dominio verificado en Resend). Default = remitente de prueba de Resend
// (solo entrega a la casilla dueña de la cuenta de Resend hasta verificar un dominio propio).
export function emailEnabled(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function sendEmail(to: string | string[], subject: string, html: string): Promise<{ ok: boolean; error?: string }> {
  const key = process.env.RESEND_API_KEY;
  const list = (Array.isArray(to) ? to : [to]).filter(Boolean);
  if (!key) return { ok: false, error: "RESEND_API_KEY no configurado" };
  if (!list.length) return { ok: false, error: "sin destinatarios" };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.NOTIFY_FROM || "Drean Marketing Dashboard <onboarding@resend.dev>", to: list, subject, html }),
      cache: "no-store",
    });
    if (res.ok) return { ok: true };
    return { ok: false, error: `Resend ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}` };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** URL absoluta del dashboard (links de los emails). */
export function appUrl(path = ""): string {
  return `${(process.env.NEXT_PUBLIC_APP_URL || "https://dashboard-mkt-seven.vercel.app").replace(/\/$/, "")}${path}`;
}
