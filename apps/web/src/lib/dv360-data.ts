// Tipos + agregaciones puras de DV360 (sin "server-only" → usable desde el
// client component del dash). El query a Supabase vive en dv360-queries.ts.

export interface Dv360Row {
  mes: string;
  canal: string;
  impresiones: number;
  clicks: number;
  starts: number;
  q25: number;
  q50: number;
  q75: number;
  q100: number;
  skips: number;
  revenue_usd: number;
}

// ---- Vista general: inversión + performance por canal -----------------------
export interface Dv360Channel {
  canal: string;
  impresiones: number;
  clicks: number;
  revenueUsd: number;
  cpm: number; // USD por mil impresiones
  cpc: number; // USD por click
  ctr: number; // %
}

export function aggregateDv360Channels(rows: Dv360Row[]): { canales: Dv360Channel[]; total: Dv360Channel } {
  const map = new Map<string, { impresiones: number; clicks: number; revenueUsd: number }>();
  for (const r of rows) {
    const c = map.get(r.canal) ?? { impresiones: 0, clicks: 0, revenueUsd: 0 };
    c.impresiones += r.impresiones;
    c.clicks += r.clicks;
    c.revenueUsd += r.revenue_usd;
    map.set(r.canal, c);
  }
  const build = (canal: string, v: { impresiones: number; clicks: number; revenueUsd: number }): Dv360Channel => ({
    canal,
    impresiones: v.impresiones,
    clicks: v.clicks,
    revenueUsd: v.revenueUsd,
    cpm: v.impresiones > 0 ? (v.revenueUsd / v.impresiones) * 1000 : 0,
    cpc: v.clicks > 0 ? v.revenueUsd / v.clicks : 0,
    ctr: v.impresiones > 0 ? (v.clicks / v.impresiones) * 100 : 0,
  });
  const canales = [...map.entries()].map(([k, v]) => build(k, v)).sort((a, b) => b.revenueUsd - a.revenueUsd);
  const totals = canales.reduce(
    (s, c) => ({ impresiones: s.impresiones + c.impresiones, clicks: s.clicks + c.clicks, revenueUsd: s.revenueUsd + c.revenueUsd }),
    { impresiones: 0, clicks: 0, revenueUsd: 0 },
  );
  return { canales, total: build("Total", totals) };
}

// ---- Embudo de visibilidad de video por canal (sólo canales con video) ------
export interface Dv360Funnel {
  canal: string;
  impresiones: number;
  starts: number;
  q25: number;
  q50: number;
  q75: number;
  q100: number;
  revenueUsd: number;
}

export function aggregateDv360Funnels(rows: Dv360Row[]): Dv360Funnel[] {
  const map = new Map<string, Dv360Funnel>();
  for (const r of rows) {
    if (r.starts <= 0) continue;
    const f =
      map.get(r.canal) ??
      { canal: r.canal, impresiones: 0, starts: 0, q25: 0, q50: 0, q75: 0, q100: 0, revenueUsd: 0 };
    f.impresiones += r.impresiones;
    f.starts += r.starts;
    f.q25 += r.q25;
    f.q50 += r.q50;
    f.q75 += r.q75;
    f.q100 += r.q100;
    f.revenueUsd += r.revenue_usd;
    map.set(r.canal, f);
  }
  return [...map.values()].sort((a, b) => b.impresiones - a.impresiones);
}
