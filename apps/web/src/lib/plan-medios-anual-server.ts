import "server-only";
// Lectura/escritura del Plan de Medios anual (tabla plan_medios_anual, migración 0129) + todo lo que el
// cálculo necesita: meses cerrados por medio del Tablero e inflación cargada en /funnel. REST service key.
import { sbAdmin } from "@/lib/supabase-admin";
import { auditar, listInflacion } from "@/lib/presupuesto-server";
import { getPautaMesesRecientes } from "@/lib/simulador-server";
import { difPlan, planDefault, sanearPlan, type InflacionMes, type PlanConfig } from "@/lib/plan-medios-anual";

export const MIGRACION_PLAN = "Falta la tabla plan_medios_anual: corré 0129_plan_medios_anual.sql en el SQL Editor de Supabase.";

export interface PlanGuardado { config: PlanConfig; guardado: { at: string; por: string | null } | null; sinTabla: boolean }

export async function getPlanAnual(anio: number): Promise<PlanGuardado> {
  try {
    const res = await sbAdmin(`plan_medios_anual?anio=eq.${anio}&select=config,updated_at,updated_by`, { method: "GET" });
    if (!res.ok) return { config: planDefault(anio), guardado: null, sinTabla: true };
    const row = ((await res.json()) as { config: unknown; updated_at: string; updated_by: string | null }[])[0];
    if (!row) return { config: planDefault(anio), guardado: null, sinTabla: false };
    return { config: sanearPlan(row.config, anio), guardado: { at: row.updated_at, por: row.updated_by }, sinTabla: false };
  } catch {
    return { config: planDefault(anio), guardado: null, sinTabla: true };
  }
}

export async function guardarPlanAnual(cfg: PlanConfig, usuario: string): Promise<void> {
  const antes = await getPlanAnual(cfg.anio);
  const res = await sbAdmin("plan_medios_anual?on_conflict=anio", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify([{ anio: cfg.anio, config: cfg, updated_at: new Date().toISOString(), updated_by: usuario }]),
  });
  if (!res.ok) throw new Error(antes.sinTabla ? MIGRACION_PLAN : `No se pudo guardar el plan: ${(await res.text()).slice(0, 200)}`);
  const d = antes.guardado ? difPlan(antes.config, cfg) : { antes: null, despues: { "BGT anual": cfg.bgt.reduce((s, v) => s + v, 0), medios: cfg.medios.length } };
  if (antes.guardado && !Object.keys(d.despues ?? {}).length) return;
  await auditar([{ usuario, entidad: "plan_medios", accion: antes.guardado ? "cambio" : "alta", version: `Plan de Medios ${cfg.anio}`, clave: null, ...d }]).catch(() => undefined);
}

export async function getInflacionMes(): Promise<InflacionMes> {
  try { return Object.fromEntries((await listInflacion()).map((f) => [f.mes.slice(0, 7), f.pct])); } catch { return {}; }
}

/** Meses de referencia (año en curso + anterior, meses cerrados) para los impactos. */
export const getRefMeses = () => getPautaMesesRecientes();
