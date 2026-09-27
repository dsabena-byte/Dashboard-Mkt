import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { allowedFromRows, isPathAllowed } from "@/lib/dashboard-access";
import { AUTH_CALLBACK_PATH, PASSWORD_PATH, PUBLIC_AUTH_PATHS } from "@/lib/auth/safe-next";

// Rutas públicas (no requieren login): /login y /login/recuperar. OJO: /login/nueva-clave NO es
// pública (requiere sesión) pero tampoco pasa por dashboard_access.
const PUBLIC_PATHS = PUBLIC_AUTH_PATHS;

// Rutas que tienen su propia auth (no aplicar middleware)
// "/bip" = landing comercial pública (public/bip.html + public/bip/*), sin login.
// "/compartido" = vista pública de solo lectura de un tablero (link firmado con vencimiento; la página
// valida firma + vencimiento + revocación y responde 404 si no vale).
const BYPASS_PATHS = ["/api/cron", "/bip", "/compartido/"];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname === `${p}/`);
}

function isBypass(pathname: string): boolean {
  return BYPASS_PATHS.some((p) => pathname.startsWith(p));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isBypass(pathname)) {
    return NextResponse.next();
  }

  // Callback de los links de email (recuperación / invitación): accesible con o sin sesión; el route
  // handler crea la sesión y redirige.
  if (pathname === AUTH_CALLBACK_PATH) {
    return NextResponse.next();
  }

  // Crear cliente Supabase server-side con cookie forwarding
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    // Si faltan envs, dejamos pasar para no romper local dev sin Supabase
    return response;
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookies: { name: string; value: string; options?: Record<string, unknown> }[]) => {
        for (const { name, value, options } of cookies) {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // Refresca la sesión si está por expirar
  const { data: { user } } = await supabase.auth.getUser();

  if (!user && !isPublic(pathname)) {
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/") loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (user && isPublic(pathname)) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Control de acceso por dashboard (tabla dashboard_access). Si el usuario tiene
  // filas, queda restringido a esos paths; si no, ve todo. No aplica a /api.
  // /login/nueva-clave (cambiar contraseña) queda afuera: cualquier usuario logueado debe poder usarla.
  if (user && !pathname.startsWith("/api") && pathname !== PASSWORD_PATH) {
    try {
      const { data } = await supabase.from("dashboard_access").select("dashboard_path");
      const allowed = allowedFromRows(data as { dashboard_path: string }[] | null);
      if (allowed && !isPathAllowed(pathname, allowed)) {
        const target = allowed[0] ?? "/login";
        if (pathname !== target) {
          return NextResponse.redirect(new URL(target, request.url));
        }
      }
    } catch {
      // Tabla inexistente o error de consulta → no restringir (ve todo).
    }
  }

  return response;
}

export const config = {
  // Aplicar a todo excepto assets estáticos y _next
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico)$).*)",
  ],
};
