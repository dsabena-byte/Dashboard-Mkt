import "server-only";
import { KANTAR_COCCION, KANTAR_LAVADO, KANTAR_REFRI } from "@/lib/salud-marca-model";
import { buildKantarOverlay, KANTAR_CFG_SLUG, mergeKantar, sanitizeKantarConfig, type KantarOverlayReport, type KantarSheetConfig, type KantarTables } from "@/lib/kantar-sheet-core";
import { getDataset, getReservedConfig } from "@/lib/tableros-server";

// Loader de Kantar para /salud-marca: constantes del código (default) o constantes + planilla
// configurada en Mis tableros (fila reservada `cfg-kantar` de la tabla `tableros`).
// FAIL-SAFE: cualquier problema (sin migración, sin config, planilla borrada) → constantes.

export const KANTAR_CONST: KantarTables = { lav: KANTAR_LAVADO, ref: KANTAR_REFRI, coc: KANTAR_COCCION };

export interface KantarData {
  source: "constantes" | "planilla";
  tables: KantarTables;
  datasetName?: string;
  updatedAt?: string | null;
  report?: KantarOverlayReport;
  warning?: string;
}

export async function getKantarConfig(): Promise<{ config: KantarSheetConfig; updatedAt: string | null } | null> {
  const r = await getReservedConfig<unknown>(KANTAR_CFG_SLUG);
  if (!r) return null;
  const cfg = sanitizeKantarConfig(r.config);
  return cfg ? { config: cfg, updatedAt: r.updatedAt } : null;
}

export async function getKantarData(): Promise<KantarData> {
  let cfg: Awaited<ReturnType<typeof getKantarConfig>> = null;
  try { cfg = await getKantarConfig(); } catch { return { source: "constantes", tables: KANTAR_CONST }; }
  if (!cfg) return { source: "constantes", tables: KANTAR_CONST };
  try {
    const ds = await getDataset(cfg.config.datasetId);
    if (!ds) return { source: "constantes", tables: KANTAR_CONST, warning: "La planilla de Kantar configurada ya no existe; se muestran los valores fijos." };
    const { overlay, report } = buildKantarOverlay(ds.columns, ds.rows, cfg.config, KANTAR_CONST);
    if (!report.celdas) return { source: "constantes", tables: KANTAR_CONST, warning: `La planilla “${ds.name}” no aportó valores para las olas medidas; se muestran los valores fijos.`, report };
    return { source: "planilla", tables: mergeKantar(KANTAR_CONST, overlay), datasetName: ds.name, updatedAt: cfg.updatedAt, report };
  } catch (e) {
    return { source: "constantes", tables: KANTAR_CONST, warning: `No se pudo leer la planilla de Kantar (${(e as Error).message.slice(0, 120)}); se muestran los valores fijos.` };
  }
}
