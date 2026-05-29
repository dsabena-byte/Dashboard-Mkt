import "server-only";
import { getServerSupabase } from "./supabase-server";
import type { PautaRow } from "./pauta-data";

interface DbPautaRow {
  mes: string;
  categoria: string;
  medio: string;
  objetivo: string;
  tipo_compra: string;
  alcance_plan: number | null;
  alcance: number | null;
  frecuencia_plan: string | number | null;
  frecuencia: string | number | null;
  impresiones_plan: number | null;
  impresiones: number | null;
  clics_plan: number | null;
  clics: number | null;
  views_plan: number | null;
  views: number | null;
  inversion_plan: string | number | null;
  inversion: string | number | null;
  costo_plan: string | number | null;
  costo: string | number | null;
  ctr_plan: string | number | null;
  ctr: string | number | null;
}

// PostgREST devuelve numeric como string para preservar precisión. Coercemos a number.
const num = (v: string | number | null): number | null =>
  v == null ? null : typeof v === "number" ? v : Number(v);

function mapRow(r: DbPautaRow): PautaRow {
  return {
    mes: r.mes,
    categoria: r.categoria,
    medio: r.medio,
    objetivo: r.objetivo,
    tipo_compra: r.tipo_compra,
    alcance_plan: r.alcance_plan,
    alcance: r.alcance,
    frecuencia_plan: num(r.frecuencia_plan),
    frecuencia: num(r.frecuencia),
    impresiones_plan: r.impresiones_plan,
    impresiones: r.impresiones,
    clics_plan: r.clics_plan,
    clics: r.clics,
    views_plan: r.views_plan,
    views: r.views,
    inversion_plan: num(r.inversion_plan),
    inversion: num(r.inversion),
    costo_plan: num(r.costo_plan),
    costo: num(r.costo),
    ctr_plan: num(r.ctr_plan),
    ctr: num(r.ctr),
  };
}

export async function getPautaPerformance(): Promise<PautaRow[]> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("pauta_performance")
    .select(
      "mes, categoria, medio, objetivo, tipo_compra, alcance_plan, alcance, frecuencia_plan, frecuencia, impresiones_plan, impresiones, clics_plan, clics, views_plan, views, inversion_plan, inversion, costo_plan, costo, ctr_plan, ctr",
    )
    .order("id", { ascending: true })
    .returns<DbPautaRow[]>();
  if (error) throw new Error(`pauta_performance: ${error.message}`);
  return (data ?? []).map(mapRow);
}
