// Lectura server-side de metas (para overlays en los gráficos de los tableros).
// Usa REST con la service key — SOLO server. No importar desde componentes cliente.

import { CAT_GENERAL, type Direccion } from "./metas";

export interface MetaKpiData {
  valores: (number | null)[]; // 12 valores mensuales (índice 0 = enero)
  direccion: Direccion;
  umbralVerde: number;
  umbralAmarillo: number;
  unidad: string | null;
}

/** Trae los valores mensuales + la config (umbrales/dirección/unidad) de un KPI. */
export async function getMetaKpi(
  plan: string,
  kpi: string,
  anio: number,
  categoria: string = CAT_GENERAL,
): Promise<MetaKpiData> {
  const base: MetaKpiData = {
    valores: Array.from({ length: 12 }, () => null),
    direccion: "up",
    umbralVerde: 100,
    umbralAmarillo: 90,
    unidad: null,
  };
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return base;
  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  const filt = `plan=eq.${encodeURIComponent(plan)}&kpi=eq.${encodeURIComponent(kpi)}&categoria=eq.${encodeURIComponent(categoria)}`;
  try {
    const [vRes, cRes] = await Promise.all([
      fetch(`${url}/rest/v1/kpi_meta_valores?${filt}&anio=eq.${anio}&select=mes,valor`, { headers, cache: "no-store" }),
      fetch(`${url}/rest/v1/kpi_meta_config?${filt}&select=direccion,umbral_verde,umbral_amarillo,unidad`, { headers, cache: "no-store" }),
    ]);
    if (vRes.ok) {
      for (const r of (await vRes.json()) as Array<{ mes: number; valor: number | null }>) {
        const m = Number(r.mes);
        if (m >= 1 && m <= 12) base.valores[m - 1] = r.valor == null ? null : Number(r.valor);
      }
    }
    if (cRes.ok) {
      const c = ((await cRes.json()) as Array<Record<string, unknown>>)[0];
      if (c) {
        base.direccion = c.direccion === "down" ? "down" : "up";
        base.umbralVerde = Number(c.umbral_verde ?? 100);
        base.umbralAmarillo = Number(c.umbral_amarillo ?? 90);
        base.unidad = (c.unidad as string | null) ?? null;
      }
    }
  } catch {
    /* red/tabla no disponible → base con metas en null */
  }
  return base;
}

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
