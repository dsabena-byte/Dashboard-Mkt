import "server-only";
import { cache } from "react";
import { parseMoneda, resolverContexto, type ConvContext, type IndiceMes } from "./moneda";

// Lectura de `indices_macro` (migración 0110; portado de BIP sep-2026). REST con service key, ~24
// filas por año. FAIL-SAFE: sin la migración o sin filas devuelve [] y los tableros quedan en pesos
// corrientes con un aviso (nunca rompe el render). React cache() = una lectura por request.

export const getIndicesMacro = cache(async (): Promise<IndiceMes[]> => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return [];
  try {
    const res = await fetch(`${url}/rest/v1/indices_macro?select=mes,usd_oficial,usd_mep&order=mes.asc&limit=2000`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: "no-store",
    });
    if (!res.ok) return [];
    const rows = (await res.json()) as { mes: string; usd_oficial: number | string | null; usd_mep: number | string | null }[];
    return rows.map((r) => ({
      mes: String(r.mes).slice(0, 7),
      usd_oficial: r.usd_oficial == null ? null : Number(r.usd_oficial),
      usd_mep: r.usd_mep == null ? null : Number(r.usd_mep),
    }));
  } catch {
    return [];
  }
});

/** Contexto de moneda para una página a partir de `?moneda=`. */
export async function monedaContext(param: string | string[] | undefined): Promise<{ ctx: ConvContext; aviso: string | null; pedido: ReturnType<typeof parseMoneda>; rows: IndiceMes[] }> {
  const pedido = parseMoneda(param);
  const rows = await getIndicesMacro();
  const { ctx, aviso } = resolverContexto(pedido, rows);
  return { ctx, aviso, pedido, rows };
}
