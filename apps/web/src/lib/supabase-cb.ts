import "server-only";
import { createClient } from "@supabase/supabase-js";

// Cliente Supabase para el proyecto de Cuadros Básicos.
// Es un proyecto distinto al principal (dashboard-mkt) — usa env vars
// específicas (CB_SUPABASE_URL / CB_SUPABASE_SERVICE_ROLE_KEY).
//
// Si las env vars no están configuradas, devolvemos un cliente apuntado
// al Supabase principal como fallback (así no rompe build).

function normalizeUrl(raw: string): string {
  return raw.trim().replace(/\/+$/, "").replace(/\/rest\/v1.*$/, "");
}

export function getCbSupabase() {
  const rawUrl = process.env.CB_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.CB_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!rawUrl || !key) {
    throw new Error("CB_SUPABASE_URL / CB_SUPABASE_SERVICE_ROLE_KEY no configurados");
  }
  const url = normalizeUrl(rawUrl);
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    // Forzar no-cache: Next.js / Vercel pueden cachear los fetch a Supabase
    // si no se especifica. Sin esto, vistas como vw_cb_baseline_medidas
    // pueden devolver datos viejos aunque la DB tenga semanas nuevas cargadas.
    global: {
      fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
    },
  });
}

// REST URL para llamadas raw (PostgREST). Usado por el diag.
export function getCbSupabaseRestConfig(): { url: string; key: string } {
  const url = process.env.CB_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.CB_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  return { url, key };
}
