import "server-only";
// ============================================================================
// WhatsApp por Evolution API v2.3.7 (self-host en Railway) — runbook: docs/whatsapp-evolution-railway.md.
//   · sendWhatsAppText(to, text): POST {EVO_URL}/message/sendText/{EVO_INSTANCE}, header `apikey`,
//     body { number, text } (number = dígitos con código de país, sin "+"). Éxito = HTTP 201 (2xx).
//   · whatsappStatus(): GET {EVO_URL}/instance/connectionState/{EVO_INSTANCE} → { instance: { state } }
//     ("open" = número vinculado y listo; "close"/"connecting" = no envía).
//   · Latido en alert_log (canal 'whatsapp', key 'wa-estado:<estado>:<fecha>', columna `estado` de la
//     migración 0123; sin ella se guarda sin la columna y el estado se lee de la key) → /monitoreo y /alerts.
// NUNCA tira: todo devuelve { ok, error } (los crons siguen aunque WhatsApp esté caído o sin vincular).
// Env: EVO_URL, EVO_API_KEY (la AUTHENTICATION_API_KEY global de Railway), EVO_INSTANCE (default drean-cron).
// ============================================================================
import { normalizeWhatsAppNumber } from "@/lib/whatsapp-shared";

const TIMEOUT_MS = 15_000;

function evo(): { url: string; key: string; instance: string } | null {
  const url = process.env.EVO_URL?.trim(), key = process.env.EVO_API_KEY?.trim();
  if (!url || !key) return null;
  return { url: url.replace(/\/+$/, ""), key, instance: process.env.EVO_INSTANCE?.trim() || "drean-cron" };
}

export function whatsappConfigured(): boolean {
  return evo() !== null;
}

export type WaState = "open" | "close" | "connecting" | "sin_config" | "error";
export interface WaStatus { ok: boolean; state: WaState; instance: string; error?: string }

/** Estado de la instancia. ok = "open" (vinculada y lista para enviar). Nunca tira. */
export async function whatsappStatus(timeoutMs = TIMEOUT_MS): Promise<WaStatus> {
  const c = evo();
  const instance = process.env.EVO_INSTANCE?.trim() || "drean-cron";
  if (!c) return { ok: false, state: "sin_config", instance, error: "Faltan EVO_URL / EVO_API_KEY en Vercel." };
  try {
    const res = await fetch(`${c.url}/instance/connectionState/${encodeURIComponent(c.instance)}`, {
      headers: { apikey: c.key }, cache: "no-store", signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return { ok: false, state: "error", instance, error: `Evolution ${res.status}: ${(await res.text().catch(() => "")).slice(0, 160)}` };
    const j = (await res.json().catch(() => ({}))) as { instance?: { state?: string }; state?: string };
    const raw = String(j.instance?.state ?? j.state ?? "").toLowerCase();
    const state: WaState = raw === "open" ? "open" : raw === "connecting" ? "connecting" : raw ? "close" : "error";
    return { ok: state === "open", state, instance, ...(state === "error" ? { error: "respuesta sin estado" } : {}) };
  } catch (e) {
    return { ok: false, state: "error", instance, error: (e as Error).name === "TimeoutError" ? "Evolution no respondió en 15 s" : (e as Error).message };
  }
}

/** Envía un texto a un número (se normaliza: AR "11 1234-5678" → 5491112345678). Nunca tira. */
export async function sendWhatsAppText(to: string, text: string): Promise<{ ok: boolean; error?: string }> {
  const c = evo();
  if (!c) return { ok: false, error: "Faltan EVO_URL / EVO_API_KEY en Vercel." };
  const number = normalizeWhatsAppNumber(to);
  if (!number) return { ok: false, error: `número inválido: ${String(to).slice(0, 30)}` };
  if (!text.trim()) return { ok: false, error: "mensaje vacío" };
  try {
    const res = await fetch(`${c.url}/message/sendText/${encodeURIComponent(c.instance)}`, {
      method: "POST",
      headers: { apikey: c.key, "Content-Type": "application/json" },
      // delay = "escribiendo…" en ms antes de mandar (throttle suave, baja el riesgo de ban).
      body: JSON.stringify({ number, text, delay: 1200, linkPreview: false }),
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.ok) return { ok: true };
    return { ok: false, error: `Evolution ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}` };
  } catch (e) {
    return { ok: false, error: (e as Error).name === "TimeoutError" ? "Evolution no respondió en 15 s" : (e as Error).message };
  }
}

/** Envía el mismo texto a varios números, en serie (sin ráfagas). */
export async function sendWhatsAppMany(to: string[], text: string): Promise<{ enviados: number; errores: { to: string; error: string }[] }> {
  let enviados = 0;
  const errores: { to: string; error: string }[] = [];
  for (const n of to) {
    const r = await sendWhatsAppText(n, text);
    if (r.ok) enviados++;
    else errores.push({ to: n, error: r.error ?? "error" });
  }
  return { enviados, errores };
}

// ── Latido en alert_log (REST, service key) ─────────────────────────────────
export type WaHeartbeat = "enviado" | "desconectado" | "sin_config" | "sin_destinatarios" | "error";

function rest(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? { url: url.replace(/\/+$/, ""), key } : null;
}

/** Deja una fila canal 'whatsapp' con el estado del envío (una por corrida y tipo). Nunca tira. */
export async function logWhatsappHeartbeat(estado: WaHeartbeat, tipo: "alertas" | "reporte"): Promise<void> {
  const c = rest();
  if (!c) return;
  const key = `wa-estado:${estado}:${tipo}:${new Date().toISOString().slice(0, 16)}`;
  const post = (row: Record<string, unknown>) => fetch(`${c.url}/rest/v1/alert_log`, {
    method: "POST",
    headers: { apikey: c.key, Authorization: `Bearer ${c.key}`, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify(row), cache: "no-store",
  });
  try {
    const r = await post({ key, canal: "whatsapp", estado });
    if (!r.ok) await post({ key, canal: "whatsapp" }); // sin la columna `estado` (migración 0123): el estado va en la key
  } catch { /* best-effort */ }
}

/** Último latido de WhatsApp (para /alerts y /monitoreo). null = nunca corrió o sin tabla. */
export async function lastWhatsappHeartbeat(): Promise<{ estado: string; tipo: string; at: string } | null> {
  const c = rest();
  if (!c) return null;
  try {
    const res = await fetch(`${c.url}/rest/v1/alert_log?canal=eq.whatsapp&key=like.${encodeURIComponent("wa-estado:*")}&select=key,sent_at&order=sent_at.desc&limit=1`, {
      headers: { apikey: c.key, Authorization: `Bearer ${c.key}` }, cache: "no-store",
    });
    if (!res.ok) return null;
    const rows = (await res.json().catch(() => [])) as { key: string; sent_at: string }[];
    const r = rows[0];
    if (!r) return null;
    const [, estado = "?", tipo = ""] = r.key.split(":");
    return { estado, tipo, at: r.sent_at };
  } catch { return null; }
}
