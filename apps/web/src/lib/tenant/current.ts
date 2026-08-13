// Resolución del tenant activo — el "seam" de la arquitectura multi-empresa.
//
// FASE 0: hay un solo tenant (Drean), así que `getTenant()` lo devuelve fijo.
// FASE 1: acá se resuelve la empresa desde el subdominio / la sesión y se
// devuelve su config (del control plane). El resto del código ya no cambia
// porque consume esta función, no las constantes hardcodeadas.
//
// No importa "server-only": debe poder usarse desde server y client components.

import { DREAN, TENANTS, type TenantConfig } from "./config";

/** Devuelve la config del tenant activo. Fase 0: siempre Drean. */
export function getTenant(): TenantConfig {
  return DREAN;
}

/** Busca un tenant por id. Útil para Fase 1 (resolución por subdominio/sesión). */
export function getTenantById(id: string): TenantConfig | undefined {
  return TENANTS[id];
}
