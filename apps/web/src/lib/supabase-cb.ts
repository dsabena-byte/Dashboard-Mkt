import "server-only";
import { createClient } from "@supabase/supabase-js";

// Cliente Supabase para el proyecto de Cuadros Básicos.
// Es un proyecto distinto al principal (dashboard-mkt) — usa env vars
// específicas (CB_SUPABASE_URL / CB_SUPABASE_SERVICE_ROLE_KEY).
//
// Si las env vars no están configuradas, devolvemos un cliente apuntado
// al Supabase principal como fallback (así no rompe build).

export function getCbSupabase() {
  const url = process.env.CB_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.CB_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) {
    throw new Error("CB_SUPABASE_URL / CB_SUPABASE_SERVICE_ROLE_KEY no configurados");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// REST URL para llamadas raw (PostgREST). Usado por el diag.
export function getCbSupabaseRestConfig(): { url: string; key: string } {
  const url = process.env.CB_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.CB_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  return { url, key };
}
