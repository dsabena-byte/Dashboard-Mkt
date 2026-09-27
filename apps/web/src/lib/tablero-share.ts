import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// ============================================================================
// Links de SOLO LECTURA de "Mis tableros" + envío programado por mail (portado de BIP, sep-2026;
// single-tenant). Núcleo sin server-only (testeable con `npx tsx scripts/tablero-share.test.ts`), pero
// usa node:crypto → NO importarlo desde un "use client".
//
// Token = base64url(JSON {s: slug, e: vence (epoch s), n: nonce}) + "." + HMAC-SHA256.
// El link vale si (1) la firma es correcta, (2) no venció y (3) el nonce coincide con el guardado en la
// fila RESERVADA `cfg-compartir` de la tabla `tableros` (revocar = borrar/rotar el nonce). Sin migración.
// Secreto: SHARE_LINK_SECRET, o derivado de la service key (nunca expuesta).
// ============================================================================

export const SHARE_SLUG = "cfg-compartir";
export const SHARE_DIAS = [7, 30, 90] as const;
export type FrecuenciaEnvio = "semanal" | "mensual";

export interface ShareLink { nonce: string; exp: number; creado: string }
export interface ShareEnvio { frecuencia: FrecuenciaEnvio; destinatarios: string[]; ultimo?: string | null; por?: string | null }
export interface ShareState { v: 1; links: Record<string, ShareLink>; envios: Record<string, ShareEnvio> }
export interface SharePayload { s: string; e: number; n: string }

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,63}$/;
const b64u = (b: Buffer) => b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64u = (s: string) => Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");

export function safeEqual(a: string, b: string): boolean {
  const A = Buffer.from(a), B = Buffer.from(b);
  return A.length === B.length && timingSafeEqual(A, B);
}

export function newNonce(): string { return b64u(randomBytes(12)); }

export function signShare(p: SharePayload, secret: string): string {
  const body = b64u(Buffer.from(JSON.stringify({ s: p.s, e: p.e, n: p.n })));
  const mac = b64u(createHmac("sha256", secret).update(body).digest());
  return `${body}.${mac}`;
}

/** Verifica firma y vencimiento. NO chequea revocación (eso lo hace el server contra el estado). */
export function verifyShare(token: string, secret: string, nowMs = Date.now()): SharePayload | null {
  if (!secret || typeof token !== "string" || token.length > 600) return null;
  const [body, mac, extra] = token.split(".");
  if (!body || !mac || extra !== undefined) return null;
  const want = b64u(createHmac("sha256", secret).update(body).digest());
  if (!safeEqual(mac, want)) return null;
  try {
    const p = JSON.parse(fromB64u(body).toString("utf8")) as Partial<SharePayload>;
    if (typeof p.s !== "string" || typeof p.n !== "string" || typeof p.e !== "number") return null;
    if (!SLUG_RE.test(p.s) || p.e * 1000 <= nowMs) return null;
    return { s: p.s, e: p.e, n: p.n };
  } catch { return null; }
}

/** ¿El link sigue vigente según el estado guardado (no revocado ni rotado)? */
export function isActive(state: ShareState, p: SharePayload, nowMs = Date.now()): boolean {
  const l = state.links[p.s];
  return Boolean(l) && l!.nonce === p.n && l!.exp === p.e && l!.exp * 1000 > nowMs;
}

const EMAIL_RE = /^[^\s@<>"']+@[^\s@<>"']+\.[a-z]{2,}$/i;
export function sanitizeState(raw: unknown): ShareState {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const links: Record<string, ShareLink> = {};
  for (const [slug, v] of Object.entries((r.links as Record<string, unknown>) ?? {})) {
    const l = v as Partial<ShareLink>;
    if (SLUG_RE.test(slug) && typeof l?.nonce === "string" && typeof l.exp === "number") links[slug] = { nonce: l.nonce, exp: l.exp, creado: typeof l.creado === "string" ? l.creado : "" };
  }
  const envios: Record<string, ShareEnvio> = {};
  for (const [slug, v] of Object.entries((r.envios as Record<string, unknown>) ?? {})) {
    const e = v as Partial<ShareEnvio>;
    if (!SLUG_RE.test(slug) || (e?.frecuencia !== "semanal" && e?.frecuencia !== "mensual")) continue;
    const dest = cleanDest(e.destinatarios);
    if (dest.length) envios[slug] = { frecuencia: e.frecuencia, destinatarios: dest, ultimo: typeof e.ultimo === "string" ? e.ultimo : null, por: typeof e.por === "string" ? e.por : null };
  }
  return { v: 1, links, envios };
}

export function cleanDest(list: unknown): string[] {
  const arr = Array.isArray(list) ? list : String(list ?? "").split(/[,;\s]+/);
  return [...new Set(arr.map((x) => String(x).trim().toLowerCase()).filter((x) => EMAIL_RE.test(x)))].slice(0, 10);
}

/** Separa los destinatarios por dominio permitido (el del usuario, los de las alertas y SHARE_ALLOWED_DOMAINS). */
export function splitByDomain(list: string[], dominios: string[]): { ok: string[]; rejected: string[] } {
  const doms = new Set(dominios.map((d) => d.trim().toLowerCase().replace(/^@/, "")).filter(Boolean));
  const ok: string[] = [], rejected: string[] = [];
  for (const e of list) (doms.has(e.split("@")[1] ?? "") ? ok : rejected).push(e);
  return { ok, rejected };
}

/** Fecha en Argentina (UTC−3, sin horario de verano). */
const arDate = (now: Date) => new Date(now.getTime() - 3 * 3600_000);

/**
 * ¿Toca mandar hoy? Semanal = los lunes (hora AR), si no se mandó en los últimos 6 días.
 * Mensual = del día 1 al 3 del mes (hora AR; margen por si falla una corrida) si no se mandó ese mes.
 */
export function isEnvioDue(e: ShareEnvio, now = new Date()): boolean {
  const d = arDate(now);
  const last = e.ultimo ? new Date(e.ultimo) : null;
  if (e.frecuencia === "semanal") {
    if (d.getUTCDay() !== 1) return false;
    return !last || now.getTime() - last.getTime() >= 6 * 86400_000;
  }
  if (d.getUTCDate() > 3) return false;
  if (!last) return true;
  const l = arDate(last);
  return l.getUTCFullYear() !== d.getUTCFullYear() || l.getUTCMonth() !== d.getUTCMonth();
}

/** Días de validez de un link nuevo (acota a las opciones ofrecidas). */
export function clampDias(v: unknown): number {
  const n = Number(v);
  return (SHARE_DIAS as readonly number[]).includes(n) ? n : 30;
}
