import "server-only";
import { redesTools } from "./tools-redes";
import type { ChatTool } from "./types";

// ============================================================================
// Registro de dashboards → sus tools + contexto para el copiloto.
// Agregar un dashboard nuevo = importar sus tools y sumar una entrada acá.
// El motor (/api/chat) y la UI (<DataChat>) NO cambian.
// ============================================================================

export interface DashboardChat {
  context: string; // system prompt específico del dashboard
  tools: ChatTool[];
}

const REGISTRY: Record<string, DashboardChat> = {
  redes: {
    context:
      "Sos el copiloto de datos del dashboard Análisis de Redes de Drean (marca de electrodomésticos, Argentina). " +
      "Trabajás sobre data orgánica de Facebook (Página) e Instagram (@dreanargentina): alcance, engagement, followers, " +
      "video views, evolución mensual y top posts. El alcance de FB usa la métrica nueva de Meta (Total Unique Media Views), " +
      "es acumulativa (los meses recientes suben con el tiempo) y excluye posts pagos/boosteados. " +
      "Respondé SIEMPRE en español, conciso y con números concretos. Nunca inventes datos: usá solo lo que devuelven las tools. " +
      "FORMATO: breve y claro (máx ~6 líneas salvo que pidan detalle). Usá **negritas** SOLO en los números/nombres clave y listas cortas con '- '. " +
      "NUNCA pegues URLs, links, permalinks ni miniaturas/thumbnails en la respuesta. No uses sintaxis de imagen markdown. " +
      "Si el usuario pide un gráfico, primero traé la data con las tools y después llamá a render_chart armando el spec con esa data (no repitas la tabla en texto si ya la graficaste).",
    tools: redesTools,
  },
};

export function getDashboardChat(dashboard: string): DashboardChat | undefined {
  return REGISTRY[dashboard];
}
