import { cookies } from "next/headers";
import { createServerClient as createDashboardServerClient } from "@dashboard/db";

/**
 * Helper Next.js-aware que envuelve createServerClient de @dashboard/db
 * pasándole el cookieStore correcto desde next/headers. Usar SOLO en
 * Server Components / Route Handlers.
 */
export function getServerSupabase() {
  return createDashboardServerClient(cookies());
}
