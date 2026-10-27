import "server-only";

// Objetivos de Floor Share = FUENTE ÚNICA: las metas MENSUALES por categoría del plan "Floor Share"
// (kpi_meta_valores, se cargan en /floor-share → "Metas de Floor Share"). Cada mes se compara contra SU meta,
// así editar un mes no cambia el semáforo de los otros. Mes sin meta → 32 / 25 / 23 (objetivo histórico).

import { getMetaKpi } from "./metas-server";
import { isoWeekToMes } from "./cb-queries";

export const MESES_FS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export const FS_PLAN = "Floor Share";
export const FS_KPI = "Floor Share (exhibición)";
export interface FsObjetivos { lavado: number; refrigeracion: number; coccion: number }
export const FS_OBJETIVOS_DEFAULT: FsObjetivos = { lavado: 32, refrigeracion: 25, coccion: 23 };

/** 12 objetivos (índice 0 = enero) por categoría para el año. */
export async function getFsObjetivosAnio(anio: number): Promise<FsObjetivos[]> {
  const [l, r, c] = await Promise.all(
    (["Lavado", "Refrigeración", "Cocción"] as const).map((cat) => getMetaKpi(FS_PLAN, FS_KPI, anio, cat)),
  );
  const d = FS_OBJETIVOS_DEFAULT;
  return Array.from({ length: 12 }, (_, i) => ({
    lavado: l!.valores[i] ?? d.lavado,
    refrigeracion: r!.valores[i] ?? d.refrigeracion,
    coccion: c!.valores[i] ?? d.coccion,
  }));
}

/** Mes de referencia de una vista de Floor Share: el mes filtrado (índice) o el de la última semana relevada.
 *  shortcut: año = el actual salvo que ese mes todavía no llegó (vista que cruza año → año anterior). */
export function mesRefFs(semMax: number, mesFiltrado?: number, hoy = new Date()): { anio: number; mesIdx: number } {
  const mesIdx = mesFiltrado != null && mesFiltrado >= 0 ? mesFiltrado
    : semMax > 0 ? MESES_FS.indexOf(isoWeekToMes(semMax, hoy.getFullYear())) : hoy.getMonth();
  return { mesIdx, anio: mesIdx > hoy.getMonth() ? hoy.getFullYear() - 1 : hoy.getFullYear() };
}
