"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAuthSupabase, getClientIp, getSiteOrigin } from "@/lib/auth/supabase-auth";
import { PASSWORD_OK_COOKIE, PASSWORD_PATH, safeNext, validateNewPassword } from "@/lib/auth/safe-next";
import { checkRateLimit } from "@/lib/chat/rate-limit";

export async function loginAction(formData: FormData): Promise<{ error?: string }> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const redirectTo = safeNext(String(formData.get("redirect") ?? "/"));

  if (!email || !password) {
    return { error: "Email y contraseña son requeridos" };
  }

  const supabase = getAuthSupabase();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: error.message };
  }

  redirect(redirectTo);
}

export async function logoutAction(): Promise<void> {
  const supabase = getAuthSupabase();
  await supabase.auth.signOut();
  redirect("/login");
}

/** Mensaje NEUTRO: igual exista o no la cuenta (no permite enumerar usuarios). */
const RESET_NEUTRAL =
  "Si el email está registrado, te enviamos un link para crear una contraseña nueva. Revisá tu casilla (y la carpeta de spam). El link vence en 1 hora.";

export async function requestPasswordResetAction(
  formData: FormData,
): Promise<{ ok?: string; error?: string }> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Ingresá un email válido." };
  }

  // Freno liviano por IP (en memoria, por instancia). Supabase además limita los envíos de email.
  const rl = checkRateLimit(`recuperar:${getClientIp()}`);
  if (!rl.ok) {
    return { error: `Demasiados intentos. Probá de nuevo en ${Math.ceil(rl.retryInSec / 60)} min.` };
  }

  try {
    const supabase = getAuthSupabase();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${getSiteOrigin()}/auth/callback?next=${encodeURIComponent(PASSWORD_PATH)}`,
    });
    // No se expone el error (p.ej. "user not found" / rate limit de Supabase) → mismo mensaje.
    if (error) console.warn("[recuperar] resetPasswordForEmail:", error.status, error.message);
  } catch (e) {
    console.warn("[recuperar] error:", e instanceof Error ? e.message : e);
  }
  return { ok: RESET_NEUTRAL };
}

export async function updatePasswordAction(formData: FormData): Promise<{ error?: string }> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const invalid = validateNewPassword(password, confirm);
  if (invalid) return { error: invalid };

  const supabase = getAuthSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Tu sesión venció. Pedí un link nuevo desde “¿Olvidaste tu contraseña?”." };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    const msg = /different from the old/i.test(error.message)
      ? "La contraseña nueva tiene que ser distinta de la anterior."
      : /weak|short|characters/i.test(error.message)
        ? "La contraseña es demasiado débil. Usá una más larga o con más variedad de caracteres."
        : error.message;
    return { error: msg };
  }

  cookies().set(PASSWORD_OK_COOKIE, "1", { maxAge: 60, path: "/", sameSite: "lax", httpOnly: false });
  redirect("/");
}
