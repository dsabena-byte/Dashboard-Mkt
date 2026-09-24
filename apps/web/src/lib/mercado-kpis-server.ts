import "server-only";
import { cache } from "react";
import { getMetaKpi, type MetaKpiData } from "./metas-server";
import { getTenant } from "./tenant/current";
import {
  buildMercadoSeries, MERCADO_KPIS, MERCADO_PLAN,
  type MercadoResult, type SosRowLite, type LlmoRowLite, type IdxRowLite, type SocialRowLite,
} from "./mercado-kpis";

// Lectura server-side de los KPIs de MERCADO Y COMPETENCIA (ver lib/mercado-kpis.ts).
// Fuentes BARATAS por REST con la service key (sin cookies → usable desde cualquier
// server component o route): vw_share_of_search (~1s), seo_llmo, seo_index_history y
// social_posts del año (~1k filas). Memoizado POR REQUEST con React cache() (lo usan el
// Seguimiento y /seo-search en el mismo render). NO unstable_cache: las páginas tienen
// fetchCache="force-no-store" y la Data Cache no persistiría igual.

async function fetchRows<T>(query: string): Promise<T[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return [];
  try {
    const res = await fetch(`${url}/rest/v1/${query}`, { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "no-store" });
    if (!res.ok) return [];
    return (await res.json()) as T[];
  } catch {
    return [];
  }
}

const currentMonthOf = (anio: number) => {
  const now = new Date();
  return now.getUTCFullYear() > anio ? 13 : now.getUTCFullYear() < anio ? 1 : now.getUTCMonth() + 1;
};

/** Series reales del año (4 KPIs) + detalle de share of engagement. */
export const getMercadoSeries = cache(async (anio: number): Promise<MercadoResult> => {
  const t = getTenant();
  const [sos, llmo, idx, social] = await Promise.all([
    fetchRows<SosRowLite>(`vw_share_of_search?mes=gte.${anio}-01-01&mes=lte.${anio}-12-31&select=categoria,marca,mes,vol&limit=5000`),
    fetchRows<LlmoRowLite>(`seo_llmo?mes=gte.${anio - 1}-01-01&select=categoria,marca,mes,prompts,share_pct&limit=5000`),
    fetchRows<IdxRowLite>(`seo_index_history?mes=gte.${anio}-01-01&mes=lte.${anio}-12-31&select=categoria,marca,mes,indice&limit=5000`),
    fetchRows<SocialRowLite>(`social_posts?fecha=gte.${anio}-01-01&fecha=lt.${anio + 1}-01-01&select=marca,red_social,fecha,likes,comentarios,url&limit=10000`),
  ]);
  return buildMercadoSeries(anio, currentMonthOf(anio), {
    ownBrand: t.ownBrand.label,
    ownSocialKey: t.ownBrand.key,
    socialLabels: Object.fromEntries(t.socialAccounts.map((a) => [a.key, a.label])),
    sos, llmo, idx, social,
  });
});

/** Metas (plan "Mercado y competencia") de los 4 KPIs, con la dirección por defecto de cada uno. */
export const getMercadoMetas = cache(async (anio: number): Promise<Record<string, MetaKpiData>> => {
  const metas = await Promise.all(
    MERCADO_KPIS.map((k) => getMetaKpi(MERCADO_PLAN, k.key, anio, undefined, { direccion: k.direccion, unidad: k.unidad === "%" ? "%" : null })),
  );
  return Object.fromEntries(MERCADO_KPIS.map((k, i) => [k.key, metas[i]!]));
});
