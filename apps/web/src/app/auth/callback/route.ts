import { NextResponse, type NextRequest } from "next/server";
import { getAuthSupabase } from "@/lib/auth/supabase-auth";
import { PASSWORD_PATH, asOtpType, safeNext, type OtpType } from "@/lib/auth/safe-next";
import { getTenant } from "@/lib/tenant/current";

export const dynamic = "force-dynamic";

/**
 * Destino de los links de email de Supabase Auth (recuperación de contraseña, invitación).
 * Soporta los dos formatos:
 *  - PKCE: `?code=...` → exchangeCodeForSession (requiere abrir el link en el MISMO navegador que lo pidió).
 *  - token_hash: `?token_hash=...&type=recovery|invite|...` → verifyOtp (funciona en cualquier dispositivo;
 *    requiere la plantilla de email con {{ .TokenHash }}).
 *
 * OJO escáneres de mail (Microsoft Safe Links / Defender en casillas corporativas): abren cada link con un GET
 * antes que el usuario. El token_hash es de UN solo uso → si el GET lo verificara, al usuario le llegaba
 * "link vencido" (pasó con la casilla de Mabe). Por eso el GET con token_hash NO verifica: muestra una
 * pantalla con el botón "Continuar" (form POST) y la verificación ocurre recién en el POST.
 * Redirige a `next` (solo paths relativos seguros). Error → /login?error=link.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = asOtpType(searchParams.get("type"));
  const next = safeNext(searchParams.get("next"), defaultNext(type));

  // Supabase manda ?error=...&error_description=... cuando el link venció o ya se usó.
  if (searchParams.get("error") || searchParams.get("error_code")) return fail(origin);

  if (tokenHash && type) return confirmPage(tokenHash, type, next);

  if (code) {
    try {
      const supabase = getAuthSupabase();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        console.warn("[auth/callback] exchangeCodeForSession:", error.status, error.message);
        return fail(origin);
      }
    } catch (e) {
      console.warn("[auth/callback] error:", e instanceof Error ? e.message : e);
      return fail(origin);
    }
    return NextResponse.redirect(new URL(next, origin));
  }

  return fail(origin);
}

/** "Continuar" de la pantalla de confirmación: acá se consume el token_hash. */
export async function POST(request: NextRequest) {
  const { origin } = request.nextUrl;
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail(origin);
  }
  const tokenHash = String(form.get("token_hash") ?? "");
  const type = asOtpType(String(form.get("type") ?? ""));
  const next = safeNext(String(form.get("next") ?? ""), defaultNext(type));
  if (!tokenHash || !type) return fail(origin);

  try {
    const supabase = getAuthSupabase();
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (error) {
      console.warn("[auth/callback] verifyOtp:", error.status, error.message);
      return fail(origin);
    }
  } catch (e) {
    console.warn("[auth/callback] error:", e instanceof Error ? e.message : e);
    return fail(origin);
  }
  // 303: después de un POST, el browser sigue con GET.
  return NextResponse.redirect(new URL(next, origin), 303);
}

function defaultNext(type: OtpType | null): string {
  // Recuperación/invitación sin `next` explícito → a crear la contraseña.
  return type === "recovery" || type === "invite" ? PASSWORD_PATH : "/";
}

function fail(origin: string) {
  return NextResponse.redirect(new URL("/login?error=link", origin), 303);
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function confirmPage(tokenHash: string, type: OtpType, next: string) {
  const brand = esc(getTenant().displayName.toUpperCase());
  const msg = type === "recovery" ? "Tocá continuar para crear tu contraseña nueva." : "Tocá continuar para ingresar.";
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>${brand} · Continuar</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;
background:linear-gradient(135deg,#f8fafc,#f1f5f9);font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#0f172a}
.c{width:100%;max-width:384px;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:32px;box-shadow:0 10px 15px -3px rgba(0,0,0,.1);text-align:center}
h1{margin:0;font-size:24px}p{margin:8px 0 24px;color:#64748b;font-size:14px}
button{width:100%;padding:10px;border:0;border-radius:6px;background:#0f172a;color:#fff;font-weight:600;font-size:14px;cursor:pointer}</style></head>
<body><div class="c"><h1>${brand}</h1><p>${msg}</p>
<form method="post" action="/auth/callback">
<input type="hidden" name="token_hash" value="${esc(tokenHash)}"><input type="hidden" name="type" value="${esc(type)}">
<input type="hidden" name="next" value="${esc(next)}"><button type="submit">Continuar</button></form></div></body></html>`;
  return new NextResponse(html, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "referrer-policy": "no-referrer" },
  });
}
