import "server-only";
import { cache } from "react";
import { indicesDesdeTc, type IndiceMes } from "./moneda";

// FUENTE ÚNICA del tipo de cambio de todos los tableros (decisión del user, 21-oct-2026): el TC REAL que carga
// finanzas en /funnel → Cargar datos → Tipos de cambio (tabla `bgt_tc`, versión "REAL <año>", pesos por dólar).
// Lo usan: DV360 USD→$ (Plan de Medios, Seguimiento, señales, simulador, copiloto) y el selector $/USD.
// REST con service key (bgt_tc tiene RLS sin policies). Fail-safe: sin dato → [] (los montos quedan en $ con aviso).
export const getTcReal = cache(async (): Promise<IndiceMes[]> => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return [];
  try {
    const res = await fetch(`${url}/rest/v1/bgt_tc?select=version,mes,tc&version=like.REAL*&limit=2000`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: "no-store",
    });
    if (!res.ok) return [];
    return indicesDesdeTc(await res.json());
  } catch {
    return [];
  }
});

/** TC REAL por mes en el formato de los lectores de pauta: "YYYY-MM-01" → pesos por dólar. */
export async function getFxRates(): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const r of await getTcReal()) if (r.tc) out[`${r.mes}-01`] = r.tc;
  return out;
}
