// Tipos + agregaciones puras de DV360 (sin "server-only" → usable desde el
// client component). Los queries a Supabase viven en dv360-queries.ts.

export interface Dv360CreativeRow {
  mes: string;
  canal: string;
  categoria: string;
  rol: string;
  creative: string;
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

export interface Dv360ReachRow {
  mes: string;
  canal: string;
  line_item: string;
  impresiones: number;
  revenue_usd: number;
  reach: number;
  frequency: number;
}

// ---- Resumen por canal: inversión + performance (+ reach por canal) ----------
export interface Dv360Channel {
  canal: string;
  impresiones: number;
  clicks: number;
  revenueUsd: number;
  reach: number; // suma de reach de las líneas del canal (aprox: hay solapamiento)
  cpm: number;
  cpc: number;
  ctr: number;
  frequency: number; // impresiones / reach
}

export function aggregateDv360Channels(
  creatives: Dv360CreativeRow[],
  reach: Dv360ReachRow[],
): { canales: Dv360Channel[]; total: Dv360Channel } {
  const base = new Map<string, { impresiones: number; clicks: number; revenueUsd: number; reach: number }>();
  for (const r of creatives) {
    const c = base.get(r.canal) ?? { impresiones: 0, clicks: 0, revenueUsd: 0, reach: 0 };
    c.impresiones += r.impresiones;
    c.clicks += r.clicks;
    c.revenueUsd += r.revenue_usd;
    base.set(r.canal, c);
  }
  for (const r of reach) {
    const c = base.get(r.canal) ?? { impresiones: 0, clicks: 0, revenueUsd: 0, reach: 0 };
    c.reach += r.reach;
    base.set(r.canal, c);
  }
  const build = (canal: string, v: { impresiones: number; clicks: number; revenueUsd: number; reach: number }): Dv360Channel => ({
    canal,
    impresiones: v.impresiones,
    clicks: v.clicks,
    revenueUsd: v.revenueUsd,
    reach: v.reach,
    cpm: v.impresiones > 0 ? (v.revenueUsd / v.impresiones) * 1000 : 0,
    cpc: v.clicks > 0 ? v.revenueUsd / v.clicks : 0,
    ctr: v.impresiones > 0 ? (v.clicks / v.impresiones) * 100 : 0,
    frequency: v.reach > 0 ? v.impresiones / v.reach : 0,
  });
  const canales = [...base.entries()].map(([k, v]) => build(k, v)).sort((a, b) => b.revenueUsd - a.revenueUsd);
  const totals = canales.reduce(
    (s, c) => ({
      impresiones: s.impresiones + c.impresiones,
      clicks: s.clicks + c.clicks,
      revenueUsd: s.revenueUsd + c.revenueUsd,
      reach: s.reach + c.reach,
    }),
    { impresiones: 0, clicks: 0, revenueUsd: 0, reach: 0 },
  );
  return { canales, total: build("Total", totals) };
}

// ---- Embudo de visibilidad de video por canal -------------------------------
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

export function aggregateDv360Funnels(creatives: Dv360CreativeRow[]): Dv360Funnel[] {
  const map = new Map<string, Dv360Funnel>();
  for (const r of creatives) {
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

// ---- Piezas (creatives) con KPIs --------------------------------------------
export interface Dv360Piece {
  creative: string;
  canal: string;
  categoria: string;
  rol: string;
  impresiones: number;
  clicks: number;
  revenueUsd: number;
  ctr: number;
  cpm: number;
  vtr: number; // % completions / starts
}

// Top piezas por inversión, sumadas across meses. Excluye 'Unknown' (YouTube no
// expone el creative) porque no es una pieza real.
export function aggregateDv360Pieces(creatives: Dv360CreativeRow[], limit = 25): Dv360Piece[] {
  const map = new Map<string, { canal: string; categoria: string; rol: string; impresiones: number; clicks: number; revenueUsd: number; starts: number; q100: number }>();
  for (const r of creatives) {
    if (r.creative === "Unknown") continue;
    const key = `${r.canal}|${r.categoria}|${r.rol}|${r.creative}`;
    const p = map.get(key) ?? { canal: r.canal, categoria: r.categoria, rol: r.rol, impresiones: 0, clicks: 0, revenueUsd: 0, starts: 0, q100: 0 };
    p.impresiones += r.impresiones;
    p.clicks += r.clicks;
    p.revenueUsd += r.revenue_usd;
    p.starts += r.starts;
    p.q100 += r.q100;
    map.set(key, p);
  }
  return [...map.entries()]
    .map(([key, p]) => ({
      creative: key.split("|").slice(3).join("|"),
      canal: p.canal,
      categoria: p.categoria,
      rol: p.rol,
      impresiones: p.impresiones,
      clicks: p.clicks,
      revenueUsd: p.revenueUsd,
      ctr: p.impresiones > 0 ? (p.clicks / p.impresiones) * 100 : 0,
      cpm: p.impresiones > 0 ? (p.revenueUsd / p.impresiones) * 1000 : 0,
      vtr: p.starts > 0 ? (p.q100 / p.starts) * 100 : 0,
    }))
    .sort((a, b) => b.revenueUsd - a.revenueUsd)
    .slice(0, limit);
}

// ---- Inversión por dimensión (categoría o rol) ------------------------------
export interface Dv360Breakdown {
  nombre: string;
  impresiones: number;
  clicks: number;
  revenueUsd: number;
  ctr: number;
  cpm: number;
}

export function aggregateDv360By(creatives: Dv360CreativeRow[], dim: "categoria" | "rol"): Dv360Breakdown[] {
  const map = new Map<string, { impresiones: number; clicks: number; revenueUsd: number }>();
  for (const r of creatives) {
    const k = dim === "categoria" ? r.categoria : r.rol;
    const v = map.get(k) ?? { impresiones: 0, clicks: 0, revenueUsd: 0 };
    v.impresiones += r.impresiones;
    v.clicks += r.clicks;
    v.revenueUsd += r.revenue_usd;
    map.set(k, v);
  }
  return [...map.entries()]
    .map(([nombre, v]) => ({
      nombre,
      impresiones: v.impresiones,
      clicks: v.clicks,
      revenueUsd: v.revenueUsd,
      ctr: v.impresiones > 0 ? (v.clicks / v.impresiones) * 100 : 0,
      cpm: v.impresiones > 0 ? (v.revenueUsd / v.impresiones) * 1000 : 0,
    }))
    .sort((a, b) => b.revenueUsd - a.revenueUsd);
}
