// Helpers puros para el control de acceso por dashboard. SIN "server-only":
// se usan tanto en el middleware (edge) como en server components.
//
// Convención: `allowed === null` significa "sin restricción" (ve todos los
// dashboards). Un array significa "restringido solo a esos paths".

export function allowedFromRows(
  rows: { dashboard_path: string }[] | null | undefined,
): string[] | null {
  if (!rows || rows.length === 0) return null; // sin filas → ve todo
  return rows.map((r) => r.dashboard_path);
}

// Rutas de contenido abiertas a TODO usuario logueado, aunque tenga dashboard_access restringido
// (no exponen datos: /guia = Proceso Estratégico, capa de aprendizaje estática).
export const ALWAYS_ALLOWED_PATHS = ["/guia"];

export function isPathAllowed(pathname: string, allowed: string[] | null): boolean {
  if (allowed === null) return true; // sin restricción
  if (ALWAYS_ALLOWED_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return true;
  return allowed.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
