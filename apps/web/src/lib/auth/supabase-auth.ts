import "server-only";
import { cookies, headers } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/**
 * Cliente Supabase (anon + cookies) que PUEDE escribir cookies de sesión: usar en server actions y
 * route handlers de auth (login, recuperación, callback, cambio de contraseña).
 */
export function getAuthSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL / ANON_KEY");
  }
  const cookieStore = cookies();
  return createServerClient(url, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet: { name: string; value: string; options?: Record<string, unknown> }[]) => {
        try {
          for (const { name, value, options } of toSet) cookieStore.set(name, value, options);
        } catch {
          // Llamado desde un Server Component (no puede escribir cookies): el middleware refresca.
        }
      },
    },
  });
}

/** Origen público del sitio para armar links de email (NEXT_PUBLIC_APP_URL o el host del request). */
export function getSiteOrigin(): string {
  const env = process.env.NEXT_PUBLIC_APP_URL;
  if (env) return env.replace(/\/$/, "");
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/** IP del cliente (para rate limit liviano). */
export function getClientIp(): string {
  const h = headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "unknown").trim();
}
