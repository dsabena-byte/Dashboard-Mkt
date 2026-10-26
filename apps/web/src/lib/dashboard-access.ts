// Helpers puros para el control de acceso por dashboard. SIN "server-only":
// se usan tanto en el middleware (edge) como en server components.
//
// Convención: `allowed === null` significa "sin restricción" (ve todos los
// dashboards). Un array significa "restringido solo a esos paths".
// Las rutas salen del grupo del usuario (lib/usuarios-core.ts, tabla usuarios 0136); dashboard_access (0065) quedó superada.

// Rutas de contenido abiertas a TODO usuario logueado, aunque esté restringido por grupo
// (no exponen datos: /guia = Proceso Estratégico, capa de aprendizaje estática).
export const ALWAYS_ALLOWED_PATHS = ["/guia"];

export function isPathAllowed(pathname: string, allowed: string[] | null): boolean {
  if (allowed === null) return true; // sin restricción
  if (ALWAYS_ALLOWED_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return true;
  return allowed.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
