import "server-only";
import { getServerSupabase } from "./supabase-server";

export interface Dv360VideoRow {
  mes: string;
  fuente: string;
  impresiones: number;
  starts: number;
  q25: number;
  q50: number;
  q75: number;
  q100: number;
  skips: number;
  revenue_usd: number;
}

interface DbRow {
  mes: string;
  fuente: string;
  impresiones: number | null;
  starts: number | null;
  q25: number | null;
  q50: number | null;
  q75: number | null;
  q100: number | null;
  skips: number | null;
  revenue_usd: string | number | null;
}

const num = (v: string | number | null): number =>
  v == null ? 0 : typeof v === "number" ? v : Number(v);

export async function getDv360VideoMetrics(): Promise<Dv360VideoRow[]> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("dv360_video_metrics")
    .select("mes, fuente, impresiones, starts, q25, q50, q75, q100, skips, revenue_usd")
    .order("mes", { ascending: true })
    .returns<DbRow[]>();
  if (error) throw new Error(`dv360_video_metrics: ${error.message}`);
  return (data ?? []).map((r) => ({
    mes: r.mes,
    fuente: r.fuente,
    impresiones: num(r.impresiones),
    starts: num(r.starts),
    q25: num(r.q25),
    q50: num(r.q50),
    q75: num(r.q75),
    q100: num(r.q100),
    skips: num(r.skips),
    revenue_usd: num(r.revenue_usd),
  }));
}

export interface Dv360Funnel {
  fuente: string;
  impresiones: number;
  starts: number;
  q25: number;
  q50: number;
  q75: number;
  q100: number;
  revenueUsd: number;
}

// Suma el embudo por fuente (a lo largo de todos los meses). Excluye 'Display'
// (no es video). Devuelve las fuentes con video ordenadas por impresiones.
export function aggregateDv360Funnels(rows: Dv360VideoRow[]): Dv360Funnel[] {
  const map = new Map<string, Dv360Funnel>();
  for (const r of rows) {
    if (r.fuente === "Display" || r.starts <= 0) continue;
    const f =
      map.get(r.fuente) ??
      { fuente: r.fuente, impresiones: 0, starts: 0, q25: 0, q50: 0, q75: 0, q100: 0, revenueUsd: 0 };
    f.impresiones += r.impresiones;
    f.starts += r.starts;
    f.q25 += r.q25;
    f.q50 += r.q50;
    f.q75 += r.q75;
    f.q100 += r.q100;
    f.revenueUsd += r.revenue_usd;
    map.set(r.fuente, f);
  }
  return [...map.values()].sort((a, b) => b.impresiones - a.impresiones);
}
