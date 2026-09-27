// Chequeo con DATA REAL (solo lectura): cierre proyectado del mes en curso desde ga4_purchases_daily
// + metas del plan "Web / Ecommerce". Correr: cd apps/web && npx tsx scripts/web-forecast-real.ts
import { cierreDeMes, type DiaWeb } from "../src/lib/web-forecast";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!, key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
async function all<T>(q: string): Promise<T[]> {
  const out: T[] = [];
  for (let f = 0; ; f += 1000) {
    const r = await fetch(`${url}/rest/v1/${q}`, { headers: { apikey: key, Authorization: `Bearer ${key}`, Range: `${f}-${f + 999}` } });
    const j = (await r.json()) as T[];
    if (!Array.isArray(j)) throw new Error(JSON.stringify(j));
    out.push(...j);
    if (j.length < 1000) break;
  }
  return out;
}

(async () => {
  const y = new Date().getUTCFullYear();
  const rows = await all<{ fecha: string; purchases: number | null; revenue: number | null }>(`ga4_purchases_daily?fecha=gte.${y}-01-01&select=fecha,purchases,revenue&order=id`);
  const by = new Map<string, DiaWeb>();
  for (const r of rows) { const d = by.get(r.fecha) ?? { fecha: r.fecha, tx: 0, ingresos: 0 }; d.tx += r.purchases ?? 0; d.ingresos += Number(r.revenue) || 0; by.set(r.fecha, d); }
  const serie = [...by.values()].sort((a, b) => a.fecha.localeCompare(b.fecha));
  console.log("días con dato", serie.length, "último", serie[serie.length - 1]?.fecha);
  const metas = await all<{ plan: string; kpi: string; mes: number; valor: number | null }>(`kpi_meta_valores?plan=eq.Web%20%2F%20Ecommerce&anio=eq.${y}&select=plan,kpi,mes,valor`).catch(() => []);
  const mes = Number(serie[serie.length - 1]!.fecha.slice(5, 7));
  const meta = (k: string) => metas.find((m) => m.kpi === k && Number(m.mes) === mes)?.valor ?? null;
  const c = cierreDeMes(serie, { metaTx: meta("Transacciones"), metaIngresos: meta("Total Ingresos") });
  console.log(JSON.stringify(c, null, 1));
})();
