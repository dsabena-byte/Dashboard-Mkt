import "server-only";
import { redesTools } from "./tools-redes";
import { overviewTools } from "./tools-overview";
import { cuadrosBasicosTools } from "./tools-cuadros-basicos";
import { floorShareTools } from "./tools-floor-share";
import { webTools } from "./tools-web";
import { seoSearchTools } from "./tools-seo-search";
import { performanceTools } from "./tools-performance";
import { performanceConversionTools } from "./tools-performance-conversion";
import { influenciaTools } from "./tools-influencia";
import { mercadoTools } from "./tools-mercado";
import { saludMarcaTools } from "./tools-salud-marca";
import { mktCanalTools } from "./tools-mkt-canal";
import { inversionTools } from "./tools-inversion";
import { crucesTools } from "./tools-cruces";
import { senalesTools } from "./tools-senales";
import { guiaTools } from "./tools-guia";
import { archivosTools } from "./tools-archivos";
import { calc, CALC_TOOL_PARAMS } from "./calc";
import { dashPath } from "./contexto";
import { isPathAllowed } from "@/lib/dashboard-access";
import type { ChatTool, ToolCtx } from "./types";

// ============================================================================
// Registro de sets de tools por dashboard. Copiloto v2 = CROSS-DASHBOARD: en cualquier
// página el modelo ve TODOS los sets que el usuario tiene permitidos (dashboard_access),
// con el set de la página primero. Agregar un dashboard = un tools-<dash>.ts + una
// entrada acá + su contexto en contexto.ts. El motor (/api/chat) y la UI no cambian.
// ============================================================================

type Factory = (ctx: ToolCtx) => ChatTool[];
const fijo = (t: ChatTool[]): Factory => () => t;

const SETS: Record<string, Factory> = {
  overview: fijo([...overviewTools, ...saludMarcaTools]),
  "mapa-estrategico": fijo(overviewTools),
  performance: performanceTools,
  "performance-conversion": fijo(performanceConversionTools),
  redes: redesTools,
  influencia: influenciaTools,
  "mkt-canal": fijo(mktCanalTools),
  web: fijo(webTools),
  "seo-search": fijo(seoSearchTools),
  "cuadros-basicos": fijo(cuadrosBasicosTools),
  "floor-share": fijo(floorShareTools),
  "salud-marca": fijo(saludMarcaTools),
  mercado: fijo([...mercadoTools, overviewTools.find((t) => t.name === "get_facturacion_mensual")!]),
  funnel: fijo(inversionTools),
  tableros: fijo(archivosTools), // planillas propias de Mis tableros
};

const CALC_TOOL: ChatTool = {
  name: "calc",
  description:
    "Calculadora determinística. SIEMPRE usala en vez de hacer cuentas: correlacion (Pearson r, r², n, fuerza, pendiente; lag opcional), elasticidad (log-log: +10% X ⇒ ?% Y), variacion, ratio, participacion, proyeccion_cierre (a diciembre: tendencia lineal y ritmo de últimos 3 meses, vs meta), cpa, roas, cpcv, reasignacion (cuántos resultados se ganan moviendo $ de un costo unitario a otro).",
  parameters: CALC_TOOL_PARAMS as unknown as Record<string, unknown>,
  run: async (args) => calc(args),
};

// Toda tool robusta: un error nunca rompe la conversación → {disponible:false, motivo}.
function robusta(t: ChatTool): ChatTool {
  return {
    ...t,
    run: async (args) => {
      try {
        return await t.run(args ?? {});
      } catch (e) {
        return { disponible: false, motivo: `No se pudo leer esta fuente (${(e as Error).message?.slice(0, 160) ?? "error"}).` };
      }
    },
  };
}

/**
 * Tools del copiloto para un request. `allowed` = dashboards permitidos del usuario
 * (null = sin restricción). Los cruces cross-dashboard y las señales solo se ofrecen a
 * usuarios sin restricción (mezclan fuentes de varios dashboards).
 */
export function buildChatTools(pageKey: string, allowed: string[] | null, ctx: ToolCtx): { tools: ChatTool[]; sets: string[] } {
  const keys = Object.keys(SETS).filter((k) => isPathAllowed(dashPath(k), allowed));
  const ordered = [...keys.filter((k) => k === pageKey), ...keys.filter((k) => k !== pageKey)];
  const seen = new Set<string>();
  const tools: ChatTool[] = [];
  const push = (t: ChatTool) => {
    if (seen.has(t.name)) return;
    seen.add(t.name);
    tools.push(robusta(t));
  };
  for (const k of ordered) SETS[k]!(ctx).forEach(push);
  if (allowed === null) {
    crucesTools.forEach(push);
    senalesTools.forEach(push);
  }
  guiaTools.forEach(push); // Método BIP: contenido estático, en todos los dashboards y para todo usuario
  push(CALC_TOOL);
  return { tools, sets: ordered };
}
