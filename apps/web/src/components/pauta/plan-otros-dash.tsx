import { PlanOtrosTab } from "@/components/pauta/plan-otros-tab";
import type { AreaPlan } from "@/components/pauta/plan-otros";
import { getInflacionMes, getPlanAnual } from "@/lib/plan-medios-anual-server";
import { getHistOtros } from "@/lib/plan-otros-kpis-server";
import { getMetaValoresMensuales } from "@/lib/metas-server";
import { usuarioPresupuesto } from "@/lib/presupuesto-server";
import { calcInversion } from "@/lib/plan-medios-anual";
import { KPIS_OTROS, PLANES_OTROS, type HistOtros } from "@/lib/plan-otros-kpis";

const safe = async <T,>(p: Promise<T>, fb: T): Promise<T> => { try { return await p; } catch { return fb; } };
const AREAS: Record<AreaPlan, string[]> = { redes: ["redes", "fb"], web: ["web"], seo: ["seo"] };

/** Año que se planifica en las pestañas "Plan anual" de los tableros: el siguiente. */
export const anioPlan = () => new Date().getFullYear() + 1;

/** Pestaña "Plan anual" de Redes / Web / SEO (server: arma historia, plan guardado y metas actuales). */
export async function PlanOtrosDash({ area }: { area: AreaPlan }) {
  const anio = anioPlan();
  const planes = PLANES_OTROS.filter((p) => AREAS[area].includes(p.area)).map((p) => p.plan);
  const keys = planes.flatMap((p) => (KPIS_OTROS[p] ?? []).map(([k]) => [p, k] as const));
  const [plan, hist, { infl }, usuario, metas] = await Promise.all([
    getPlanAnual(anio),
    safe<HistOtros>(getHistOtros(anio), { anioBase: anio - 1, series: {}, seguidores: { ultimo: null, fecha: null, porMes: 0 } }),
    getInflacionMes(),
    safe(usuarioPresupuesto(), null),
    Promise.all(keys.map(([p, k]) => safe(getMetaValoresMensuales(p, k, anio), Array.from({ length: 12 }, () => null as number | null)))),
  ]);
  return (
    <PlanOtrosTab area={area} anio={anio} inicial={plan.config.otros} hist={hist} invPlan={calcInversion(plan.config, infl).total}
      editor={!!usuario?.editor} email={usuario?.email ?? null}
      metasActuales={Object.fromEntries(keys.map(([p, k], i) => [`${p}|${k}`, metas[i]!]))} />
  );
}
