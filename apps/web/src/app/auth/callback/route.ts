import { NextResponse, type NextRequest } from "next/server";
import { getAuthSupabase } from "@/lib/auth/supabase-auth";
import { PASSWORD_PATH, asOtpType, safeNext } from "@/lib/auth/safe-next";

export const dynamic = "force-dynamic";

/**
 * Destino de los links de email de Supabase Auth (recuperación de contraseña, invitación).
 * Soporta los dos formatos:
 *  - PKCE: `?code=...` → exchangeCodeForSession (requiere abrir el link en el MISMO navegador que lo pidió).
 *  - token_hash: `?token_hash=...&type=recovery|invite|...` → verifyOtp (funciona en cualquier dispositivo;
 *    requiere la plantilla de email con {{ .TokenHash }}).
 * Redirige a `next` (solo paths relativos seguros). Error → /login?error=link.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = asOtpType(searchParams.get("type"));
  // Recuperación/invitación sin `next` explícito → a crear la contraseña.
  const defaultNext = type === "recovery" || type === "invite" ? PASSWORD_PATH : "/";
  const next = safeNext(searchParams.get("next"), defaultNext);

  const fail = () => NextResponse.redirect(new URL("/login?error=link", origin));

  // Supabase manda ?error=...&error_description=... cuando el link venció o ya se usó.
  if (searchParams.get("error") || searchParams.get("error_code")) return fail();

  try {
    const supabase = getAuthSupabase();
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        console.warn("[auth/callback] exchangeCodeForSession:", error.status, error.message);
        return fail();
      }
    } else if (tokenHash && type) {
      const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
      if (error) {
        console.warn("[auth/callback] verifyOtp:", error.status, error.message);
        return fail();
      }
    } else {
      return fail();
    }
  } catch (e) {
    console.warn("[auth/callback] error:", e instanceof Error ? e.message : e);
    return fail();
  }

  return NextResponse.redirect(new URL(next, origin));
}
