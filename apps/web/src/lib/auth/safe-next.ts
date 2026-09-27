// Helpers PUROS de auth (client-safe, sin "server-only"): se usan en el middleware (edge),
// en route handlers, server actions y componentes cliente.

/** Destino post-login/post-link SEGURO: solo paths relativos del propio sitio ("/x", no "//x" ni "/\x"). */
export function safeNext(next: string | null | undefined, fallback = "/"): string {
  if (!next || typeof next !== "string") return fallback;
  const n = next.trim();
  if (!n.startsWith("/") || n.startsWith("//") || n.startsWith("/\\")) return fallback;
  // Sin caracteres de control ni backslashes (el browser los normaliza a "/" → "//evil.com").
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f\\]/.test(n)) return fallback;
  return n;
}

/** Tipos de OTP que acepta /auth/callback con token_hash (plantillas de email de Supabase). */
export const OTP_TYPES = ["recovery", "invite", "magiclink", "email", "signup", "email_change"] as const;
export type OtpType = (typeof OTP_TYPES)[number];
export function asOtpType(t: string | null | undefined): OtpType | null {
  return (OTP_TYPES as readonly string[]).includes(t ?? "") ? (t as OtpType) : null;
}

export const MIN_PASSWORD_LEN = 10;

/** Valida nueva contraseña + confirmación. Devuelve el mensaje de error o null si está OK. */
export function validateNewPassword(password: string, confirm: string): string | null {
  if (password.length < MIN_PASSWORD_LEN) return `La contraseña debe tener al menos ${MIN_PASSWORD_LEN} caracteres.`;
  if (password !== confirm) return "Las contraseñas no coinciden.";
  return null;
}

// ── Rutas de auth (las usa el middleware) ──
/** Callback de links de email (recuperación/invitación): siempre accesible, con o sin sesión. */
export const AUTH_CALLBACK_PATH = "/auth/callback";
/** Requiere sesión pero NO se somete a dashboard_access (cambiar la contraseña). */
export const PASSWORD_PATH = "/login/nueva-clave";
/** Públicas (sin sesión); a un usuario logueado que entra se lo manda a "/". */
export const PUBLIC_AUTH_PATHS = ["/login", "/login/recuperar"];

/** Cookie "flash" (no httpOnly, 60s) para avisar en la app que la contraseña se cambió. */
export const PASSWORD_OK_COOKIE = "clave_ok";
