import "server-only";
// ============================================================================
// Web mensual por canal (sesiones / conversiones / pageviews) — lectura RÁPIDA.
// Fuente: tabla precalculada `web_monthly_by_channel` (migración 0121, la llena el cron web-cat-agg
// cada 6h). Fallback: la vista `vw_drean_web_monthly_by_channel` (agrega web_traffic entera, ~5 s
// aislada y mucho más bajo carga) SOLO si la tabla no existe o no tiene filas en el rango.
// REST con service key (sin cookies) → usable desde páginas, route handlers y crons.
// ============================================================================

export interface WebMonthChannelRow { mes: string; canal: string; sesiones: number | null; conversiones: number | null; pageviews: number | null }

async function rest<T>(query: string, timeoutMs: number): Promise<T[] | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  try {
    const res = await fetch(`${url}/rest/v1/${query}`, { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "no-store", signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return null; // 404/PGRST205 = migración 0121 sin correr
    return (await res.json()) as T[];
  } catch { return null; }
}

/**
 * Filas mes×canal con `mes` en [desde, hasta] (YYYY-MM-DD, `hasta` opcional). Orden por mes.
 * Devuelve [] si no hay forma de leer (sin env / ambas fuentes fallan).
 */
export async function getWebMonthlyByChannelRows(desde: string, hasta?: string): Promise<WebMonthChannelRow[]> {
  const rango = `mes=gte.${desde}${hasta ? `&mes=lte.${hasta}` : ""}`;
  const sel = "select=mes,canal,sesiones,conversiones,pageviews";
  const tabla = await rest<WebMonthChannelRow>(`web_monthly_by_channel?${rango}&${sel}&order=mes,canal&limit=5000`, 8_000);
  if (tabla && tabla.length) return tabla;
  return (await rest<WebMonthChannelRow>(`vw_drean_web_monthly_by_channel?${rango}&${sel}&order=mes`, 25_000)) ?? [];
}
