import "server-only";

// Ecommerce (Web / Ecommerce) — serie mensual de Transacciones, Total Ingresos y ROAS.
// - Transacciones + Ingresos: TODO el sitio (ga4_purchases_daily, sin filtro de campaña).
// - ROAS = Ingresos totales ÷ (inversión de rol Consideración [Pauta Mkt] + Conversión
//   [ecommerce inhouse]). Es un ROAS "blended" — se aclara en la UI.
// Lectura por REST con service-key (sin cookies → independiente del request scope).

// Fetch REST con paginación por Range (algunas tablas superan las 1000 filas/año).
async function fetchAll<T>(query: string): Promise<T[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return [];
  const out: T[] = [];
  const page = 1000;
  for (let from = 0; from < 200_000; from += page) {
    let res: Response;
    try {
      res = await fetch(`${url}/rest/v1/${query}`, {
        headers: { apikey: key, Authorization: `Bearer ${key}`, Range: `${from}-${from + page - 1}` },
        cache: "no-store",
      });
    } catch { break; }
    if (!res.ok) break;
    const rows = (await res.json()) as T[];
    out.push(...rows);
    if (rows.length < page) break;
  }
  return out;
}

export interface EcommerceMensual {
  transacciones: (number | null)[]; // 12 (índice 0 = enero)
  ingresos: (number | null)[];
  invConversion: (number | null)[]; // ecommerce inhouse (ga4_ads_cost_daily) — rol Conversión
}

// Inversión mensual de Ecommerce (Google Ads inhouse, rol Conversión) en ARS.
// Se suma SOLO a la Inversión de Pauta Mkt (Impacto Campaña), no a impresiones/clicks.
export async function getEcommerceInversionMensual(anio: number): Promise<(number | null)[]> {
  const cost = await fetchAll<{ fecha: string; cost: number | null }>(
    `ga4_ads_cost_daily?utm_campaign=ilike.inhouse*&fecha=gte.${anio}-01-01&fecha=lte.${anio}-12-31&select=fecha,cost`,
  );
  const out: (number | null)[] = Array.from({ length: 12 }, () => null);
  for (const r of cost) {
    const i = Number(r.fecha?.slice(5, 7)) - 1;
    if (i >= 0 && i < 12) out[i] = (out[i] ?? 0) + (Number(r.cost) || 0);
  }
  return out;
}

export async function getEcommerceMensual(anio: number): Promise<EcommerceMensual> {
  const [purch, cost] = await Promise.all([
    fetchAll<{ fecha: string; purchases: number | null; revenue: number | null }>(
      `ga4_purchases_daily?fecha=gte.${anio}-01-01&fecha=lte.${anio}-12-31&select=fecha,purchases,revenue`,
    ),
    fetchAll<{ fecha: string; cost: number | null }>(
      `ga4_ads_cost_daily?utm_campaign=ilike.inhouse*&fecha=gte.${anio}-01-01&fecha=lte.${anio}-12-31&select=fecha,cost`,
    ),
  ]);

  const trans: (number | null)[] = Array.from({ length: 12 }, () => null);
  const ing: (number | null)[] = Array.from({ length: 12 }, () => null);
  const conv: (number | null)[] = Array.from({ length: 12 }, () => null);
  const add = (arr: (number | null)[], i: number, v: number) => { arr[i] = (arr[i] ?? 0) + v; };

  for (const r of purch) {
    const i = Number(r.fecha?.slice(5, 7)) - 1;
    if (i >= 0 && i < 12) { add(trans, i, r.purchases ?? 0); add(ing, i, Number(r.revenue) || 0); }
  }
  for (const r of cost) {
    const i = Number(r.fecha?.slice(5, 7)) - 1;
    if (i >= 0 && i < 12) add(conv, i, Number(r.cost) || 0);
  }

  return { transacciones: trans, ingresos: ing, invConversion: conv };
}
