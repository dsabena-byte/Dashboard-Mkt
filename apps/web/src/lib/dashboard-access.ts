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

export function isPathAllowed(pathname: string, allowed: string[] | null): boolean {
  if (allowed === null) return true; // sin restricción
  return allowed.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
