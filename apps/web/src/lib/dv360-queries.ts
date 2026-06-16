import "server-only";
import { getServerSupabase } from "./supabase-server";
import type { Dv360Row } from "./dv360-data";

interface DbRow {
  mes: string;
  canal: string;
  impresiones: number | null;
  clicks: number | null;
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

export async function getDv360Performance(): Promise<Dv360Row[]> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("dv360_performance")
    .select("mes, canal, impresiones, clicks, starts, q25, q50, q75, q100, skips, revenue_usd")
    .order("mes", { ascending: true })
    .returns<DbRow[]>();
  if (error) throw new Error(`dv360_performance: ${error.message}`);
  return (data ?? []).map((r) => ({
    mes: r.mes,
    canal: r.canal,
    impresiones: num(r.impresiones),
    clicks: num(r.clicks),
    starts: num(r.starts),
    q25: num(r.q25),
    q50: num(r.q50),
    q75: num(r.q75),
    q100: num(r.q100),
    skips: num(r.skips),
    revenue_usd: num(r.revenue_usd),
  }));
}
