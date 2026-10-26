import { AsyncLocalStorage } from "node:async_hooks";
import { cookies } from "next/headers";
import { createServerClient as createDashboardServerClient, createServiceClient } from "@dashboard/db";

// Contexto "sistema": SOLO lo abren rutas ya autenticadas sin usuario (crons con CRON_SECRET,
// /compartido con link firmado). Ahí no hay sesión y el rol anon no tiene acceso a la base (0133).
const sistema = new AsyncLocalStorage<true>();

export function comoSistema<T>(fn: () => T): T {
  return sistema.run(true, fn);
}

/**
 * Helper Next.js-aware que envuelve createServerClient de @dashboard/db
 * pasándole el cookieStore correcto desde next/headers. Usar SOLO en
 * Server Components / Route Handlers. Dentro de `comoSistema` lee con service role.
 */
export function getServerSupabase() {
  if (sistema.getStore()) return createServiceClient();
  return createDashboardServerClient(cookies());
}
