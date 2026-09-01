// Lectura server-side de metas (para overlays en los gráficos de los tableros).
// Usa REST con la service key — SOLO server. No importar desde componentes cliente.

import { CAT_GENERAL } from "./metas";

/**
 * Devuelve los 12 valores mensuales de la meta de un KPI (índice 0 = enero).
 * Meses sin meta cargada quedan en null.
 */
export async function getMetaValoresMensuales(
  plan: string,
  kpi: string,
  anio: number,
  categoria: string = CAT_GENERAL,
): Promise<(number | null)[]> {
  const out: (number | null)[] = Array.from({ length: 12 }, () => null);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return out;

  const q =
    `kpi_meta_valores?plan=eq.${encodeURIComponent(plan)}` +
    `&kpi=eq.${encodeURIComponent(kpi)}` +
    `&categoria=eq.${encodeURIComponent(categoria)}` +
    `&anio=eq.${anio}&select=mes,valor`;
  try {
    const res = await fetch(`${url}/rest/v1/${q}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: "no-store",
    });
    if (!res.ok) return out;
    const rows = (await res.json()) as Array<{ mes: number; valor: number | null }>;
    for (const r of rows) {
      const m = Number(r.mes);
      if (m >= 1 && m <= 12) out[m - 1] = r.valor == null ? null : Number(r.valor);
    }
  } catch {
    /* red/tabla no disponible → metas en null, el gráfico simplemente no dibuja la línea */
  }
  return out;
}
