import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { isPathAllowed } from "@/lib/dashboard-access";
import { AUTH_CALLBACK_PATH, PASSWORD_PATH, PUBLIC_AUTH_PATHS, usuarioHabilitado } from "@/lib/auth/safe-next";
import { apiPermitida, esTablaInexistente, rutasPermitidas, type UsuarioRow } from "@/lib/usuarios-core";

// Rutas públicas (no requieren login): /login y /login/recuperar. OJO: /login/nueva-clave NO es
// pública (requiere sesión) pero tampoco pasa por el control de tableros.
const PUBLIC_PATHS = PUBLIC_AUTH_PATHS;

// Rutas que tienen su propia auth (no aplicar middleware)
// "/bip" = landing comercial pública (public/bip.html + public/bip/*), sin login.
// "/compartido" = vista pública de solo lectura de un tablero (link firmado con vencimiento; la página
// valida firma + vencimiento + revocación y responde 404 si no vale).
// "/api/cb-ventas/ingesta" y "/pares" = Office Script del Excel de Ventas: se autentican con su propio secreto
// (lib/cb-ventas/ingesta-auth.ts, fail closed); solo esas dos rutas exactas, el resto de /api/cb-ventas pasa por sesión.
const BYPASS_PATHS = ["/api/cron", "/bip", "/compartido/"];
const BYPASS_EXACT = ["/api/cb-ventas/ingesta", "/api/cb-ventas/pares"];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname === `${p}/`);
}

function isBypass(pathname: string): boolean {
  return BYPASS_EXACT.includes(pathname) || BYPASS_PATHS.some((p) => pathname.startsWith(p));
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

  // Acceso por usuario y grupo (tabla usuarios, 0136). Sin la tabla (legacy) = regla vieja de dominio + ve todo.
  // Cualquier otra falla al leerla = sin acceso (fail closed).
  let allowed: string[] | null = null;
  let habilitado = true;
  if (user) {
    const { data, error, status } = await supabase
      .from("usuarios")
      .select("grupos,es_admin,activo")
      .eq("email", (user.email ?? "").toLowerCase())
      .maybeSingle();
    if (error && esTablaInexistente(error, status)) {
      habilitado = usuarioHabilitado(user);
    } else if (error) {
      console.error("[middleware] usuarios:", status, error.message);
      habilitado = false;
    } else {
      const row = data as Pick<UsuarioRow, "grupos" | "es_admin" | "activo"> | null;
      habilitado = !!row?.activo;
      allowed = row ? rutasPermitidas(row) : [];
    }
    if (habilitado && allowed && allowed.length === 0) habilitado = false; // sin grupos = sin tableros
  }

  // Cuenta logueada pero no habilitada: sin acceso a páginas ni a /api.
  if (user && !habilitado) {
    if (isPublic(pathname)) return response;
    if (pathname.startsWith("/api")) return NextResponse.json({ error: "Sin acceso" }, { status: 403 });
    return NextResponse.redirect(new URL("/login?error=acceso", request.url));
  }

  if (user && isPublic(pathname)) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Usuario restringido (Trade / Ventas): solo sus tableros y las APIs que esas pantallas usan.
  // /login/nueva-clave (cambiar contraseña) queda afuera: cualquier usuario logueado debe poder usarla.
  if (user && allowed) {
    if (pathname.startsWith("/api")) {
      if (!apiPermitida(pathname, allowed)) return NextResponse.json({ error: "Sin acceso" }, { status: 403 });
    } else if (pathname !== PASSWORD_PATH && !isPathAllowed(pathname, allowed)) {
      return NextResponse.redirect(new URL(allowed[0]!, request.url));
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
