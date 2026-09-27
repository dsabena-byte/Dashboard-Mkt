import "server-only";
import { createHash } from "node:crypto";
import { appUrl, sendEmail } from "@/lib/notify";
import { getAlertPrefs, envRecipients, logSent } from "@/lib/alerts";
import { getTenant } from "@/lib/tenant/current";
import { getDashboardConfig, getReservedConfig, saveReservedConfig } from "@/lib/tableros-server";
import {
  SHARE_SLUG, isActive, isEnvioDue, newNonce, sanitizeState, signShare, splitByDomain, verifyShare,
  type ShareEnvio, type ShareState, type SharePayload,
} from "@/lib/tablero-share";

// Lado server de los links de solo lectura y del envío programado (ver lib/tablero-share.ts).
// Estado en la fila reservada `tableros.slug = 'cfg-compartir'` (tabla de la migración 0109).

export function shareSecret(): string | null {
  if (process.env.SHARE_LINK_SECRET) return process.env.SHARE_LINK_SECRET;
  const k = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return k ? createHash("sha256").update(`drean-tablero-share|${k}`).digest("hex") : null;
}

export async function getShareState(): Promise<ShareState> {
  try { return sanitizeState((await getReservedConfig<unknown>(SHARE_SLUG))?.config); } catch { return sanitizeState(null); }
}

export async function saveShareState(st: ShareState): Promise<void> {
  await saveReservedConfig(SHARE_SLUG, "Tableros compartidos", sanitizeState(st));
}

export function linkUrl(slug: string, st: ShareState): string | null {
  const l = st.links[slug];
  const secret = shareSecret();
  if (!l || !secret || l.exp * 1000 <= Date.now()) return null;
  return appUrl(`/compartido/${signShare({ s: slug, e: l.exp, n: l.nonce }, secret)}`);
}

/** Crea (o rota) el link del tablero con `dias` de validez. Los links anteriores dejan de andar. */
export async function createLink(slug: string, dias: number): Promise<{ url: string; exp: number }> {
  if (!shareSecret()) throw new Error("sin secreto para firmar links");
  const st = await getShareState();
  const exp = Math.floor(Date.now() / 1000) + dias * 86400;
  st.links[slug] = { nonce: newNonce(), exp, creado: new Date().toISOString() };
  await saveShareState(st);
  return { url: linkUrl(slug, st)!, exp };
}

export async function revokeLink(slug: string): Promise<void> {
  const st = await getShareState();
  delete st.links[slug];
  await saveShareState(st);
}

/** Token → slug, solo si la firma es válida, no venció y no fue revocado. */
export async function resolveShareToken(token: string): Promise<SharePayload | null> {
  const secret = shareSecret();
  if (!secret) return null;
  const p = verifyShare(token, secret);
  if (!p) return null;
  return isActive(await getShareState(), p) ? p : null;
}

/** Dominios permitidos para el envío: el de quien lo programa + los de las alertas + SHARE_ALLOWED_DOMAINS. */
export async function allowedDomains(userEmail: string | null): Promise<string[]> {
  const prefs = await getAlertPrefs().catch(() => null);
  const mails = [userEmail ?? "", ...(prefs?.destinatarios ?? []), ...envRecipients()];
  const env = (process.env.SHARE_ALLOWED_DOMAINS ?? "").split(/[,;\s]+/);
  return [...new Set([...mails.map((m) => m.split("@")[1] ?? ""), ...env].map((d) => d.trim().toLowerCase()).filter(Boolean))];
}

export async function validRecipients(list: string[], userEmail: string | null): Promise<{ ok: string[]; rejected: string[] }> {
  return splitByDomain(list, await allowedDomains(userEmail));
}

// ── Envío programado ────────────────────────────────────────────────────────
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export function renderEnvioEmail(marca: string, title: string, url: string, frec: ShareEnvio["frecuencia"], exp: number): { subject: string; html: string } {
  const t = title.slice(0, 100);
  const vence = new Date(exp * 1000).toLocaleDateString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" });
  const subject = `${marca} · ${t} · reporte ${frec === "semanal" ? "semanal" : "del mes"}`;
  const html = `<!doctype html><html><body style="margin:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#0f172a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 0"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
<tr><td style="background:#0f172a;padding:16px 24px"><span style="font-weight:600;font-size:19px;color:#fff">${esc(marca)}</span><span style="color:#94a3b8;font-size:13px"> · Marketing Dashboard</span></td></tr>
<tr><td style="padding:22px 24px 6px;font-size:14px;line-height:1.55">Hola. Acá está el tablero <b style="font-weight:600">${esc(t)}</b> actualizado, listo para mirar (no hace falta iniciar sesión).</td></tr>
<tr><td style="padding:14px 24px"><a href="${esc(url)}" style="display:inline-block;background:#1e40af;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:10px 18px;border-radius:8px">Ver el tablero</a></td></tr>
<tr><td style="padding:10px 24px 22px;font-size:12px;color:#64748b;line-height:1.5">Es una vista de solo lectura con los datos al día de hoy. El link vence el ${esc(vence)}. Para dejar de recibir este envío, pedile a quien lo programó que lo desactive en Mis tableros → Compartir.</td></tr>
</table></td></tr></table></body></html>`;
  return { subject, html };
}

export interface EnvioResult { slug: string; enviado: boolean; motivo?: string; to?: number }

/** Recorre los envíos configurados y manda los que tocan hoy. */
export async function runEnviosTableros(opts: { force?: boolean; dry?: boolean; slug?: string | null } = {}): Promise<EnvioResult[]> {
  const st = await getShareState();
  const due = Object.entries(st.envios).filter(([slug, e]) => (!opts.slug || slug === opts.slug) && (opts.force || isEnvioDue(e)));
  const out: EnvioResult[] = [];
  if (!due.length) return out;
  const secret = shareSecret();
  const marca = getTenant().displayName;
  let changed = false;
  for (const [slug, e] of due) {
    const cfg = await getDashboardConfig(slug).catch(() => null);
    if (!cfg || !cfg.widgets.length) { out.push({ slug, enviado: false, motivo: "tablero vacío o borrado" }); continue; }
    if (!secret) { out.push({ slug, enviado: false, motivo: "sin secreto para firmar el link" }); continue; }
    // Link vigente con al menos 10 días por delante; si no, uno nuevo de 35 días (rota el anterior).
    let link = st.links[slug];
    if (!link || link.exp * 1000 < Date.now() + 10 * 86400_000) {
      link = { nonce: newNonce(), exp: Math.floor(Date.now() / 1000) + 35 * 86400, creado: new Date().toISOString() };
      if (!opts.dry) { st.links[slug] = link; changed = true; }
    }
    if (opts.dry) { out.push({ slug, enviado: false, motivo: "dry-run", to: e.destinatarios.length }); continue; }
    const url = appUrl(`/compartido/${signShare({ s: slug, e: link.exp, n: link.nonce }, secret)}`);
    const { subject, html } = renderEnvioEmail(marca, cfg.title || "Tablero", url, e.frecuencia, link.exp);
    const sent = await sendEmail(e.destinatarios, subject, html);
    if (sent.ok) { st.envios[slug] = { ...e, ultimo: new Date().toISOString() }; changed = true; await logSent([`tablero:${slug}:${new Date().toISOString().slice(0, 10)}`], "tablero"); }
    out.push({ slug, enviado: sent.ok, to: e.destinatarios.length, motivo: sent.ok ? undefined : sent.error ?? "falló el envío (Resend)" });
  }
  if (changed) await saveShareState(st).catch(() => undefined);
  return out;
}
