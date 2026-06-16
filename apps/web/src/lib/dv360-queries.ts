import "server-only";
import { getServerSupabase } from "./supabase-server";
import type { Dv360CreativeRow, Dv360ReachRow } from "./dv360-data";

const num = (v: string | number | null): number =>
  v == null ? 0 : typeof v === "number" ? v : Number(v);

interface DbCreative {
  mes: string;
  canal: string;
  creative: string;
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

export async function getDv360Creatives(): Promise<Dv360CreativeRow[]> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("dv360_creatives")
    .select("mes, canal, creative, impresiones, clicks, starts, q25, q50, q75, q100, skips, revenue_usd")
    .order("mes", { ascending: true })
    .returns<DbCreative[]>();
  if (error) throw new Error(`dv360_creatives: ${error.message}`);
  return (data ?? []).map((r) => ({
    mes: r.mes,
    canal: r.canal,
    creative: r.creative,
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

interface DbReach {
  mes: string;
  canal: string;
  line_item: string;
  impresiones: number | null;
  revenue_usd: string | number | null;
  reach: number | null;
  frequency: string | number | null;
}

export async function getDv360Reach(): Promise<Dv360ReachRow[]> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("dv360_reach")
    .select("mes, canal, line_item, impresiones, revenue_usd, reach, frequency")
    .order("mes", { ascending: true })
    .returns<DbReach[]>();
  if (error) throw new Error(`dv360_reach: ${error.message}`);
  return (data ?? []).map((r) => ({
    mes: r.mes,
    canal: r.canal,
    line_item: r.line_item,
    impresiones: num(r.impresiones),
    revenue_usd: num(r.revenue_usd),
    reach: num(r.reach),
    frequency: num(r.frequency),
  }));
}
