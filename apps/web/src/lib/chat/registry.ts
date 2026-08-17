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
import type { ChatTool } from "./types";

// ============================================================================
// Registro de dashboards → sus tools + contexto para el copiloto.
// Agregar un dashboard nuevo = importar sus tools y sumar una entrada acá.
// El motor (/api/chat) y la UI (<DataChat>) NO cambian.
// ============================================================================

export interface DashboardChat {
  context: string;
  tools: ChatTool[];
}

const BASE =
  "Respondé SIEMPRE en español, conciso y con números concretos. Nunca inventes datos: usá solo lo que devuelven las tools. " +
  "FORMATO: breve y claro (máx ~6 líneas salvo que pidan detalle). Usá **negritas** SOLO en los números/nombres clave y listas cortas con '- '. " +
  "NUNCA pegues URLs, links, permalinks ni miniaturas/thumbnails como texto. No uses sintaxis de imagen markdown. " +
  "Si el usuario pide un gráfico, primero traé la data con las tools y después llamá a render_chart armando el spec con esa data (no repitas la tabla en texto si ya la graficaste). " +
  "Todo es de Drean (marca de electrodomésticos, Argentina). ";

const REGISTRY: Record<string, DashboardChat> = {
  redes: {
    context:
      BASE +
      "Dashboard Análisis de Redes: data orgánica de Facebook e Instagram (alcance, engagement, followers, video views, evolución mensual, top posts). El alcance de FB usa la métrica nueva de Meta (Total Unique Media Views), es acumulativa y excluye posts pagos. " +
      "Cuando el usuario pida VER/mostrar los posteos, llamá a render_posts pasando los posts tal como vinieron de la tool (con thumbnail y url), en vez de listarlos en texto.",
    tools: redesTools,
  },
  overview: {
    context:
      BASE +
      "Dashboard Overview / Objetivos de Marketing: cumplimiento de Cuadro Básico (obj 80%), Floor Share por categoría (obj 32/25/23%), facturación mensual y Salud de Marca. Es el tablero de objetivos; comparar siempre contra la meta.",
    tools: overviewTools,
  },
  "cuadros-basicos": {
    context:
      BASE +
      "Dashboard Cuadros Básicos: cumplimiento de CB por tienda/semana (% CB, Infaltables, Estratégicos), evolución semanal, por división, baseline de tiendas medidas (últimas 3 semanas) y sugerencias de tiendas a sumar. Objetivo: 80%.",
    tools: cuadrosBasicosTools,
  },
  "floor-share": {
    context:
      BASE +
      "Dashboard Floor Share: % de exhibición de Drean sobre el total del piso, por categoría (Lavado/Refrigeración/Cocción) y por marca. Objetivos: Lavado 32%, Refri 25%, Cocción 23%.",
    tools: floorShareTools,
  },
  web: {
    context:
      BASE +
      "Dashboard Web (GA4): sesiones, usuarios, conversiones, conversion rate, pageviews, bounce rate, duración de sesión, canales y evolución mensual. Las tools de rango necesitan from/to (YYYY-MM-DD); si no lo dan, pedilo o usá el mes actual.",
    tools: webTools,
  },
  "seo-search": {
    context:
      BASE +
      "Dashboard Share of Search: participación en búsquedas por categoría/marca, interés de Google Trends, demanda genérica y posición en buscadores (SERP).",
    tools: seoSearchTools,
  },
  performance: {
    context:
      BASE +
      "Dashboard Performance (pauta de medios): inversión por medio/categoría, alcance, impresiones, frecuencia, clics, views y CTR (plan vs real), y el mix de inversión (Digital/TV Cable/DOOH/OOH).",
    tools: performanceTools,
  },
  "performance-conversion": {
    context:
      BASE +
      "Dashboard Performance → Conversión (pauta a web, GA4): sesiones, transacciones, ingresos, conversion rate, bounce, inversión, y métricas derivadas CPA/CAC, CPC y ROAS. Calculá los ratios a partir de la data diaria.",
    tools: performanceConversionTools,
  },
  influencia: {
    context:
      BASE +
      "Dashboard Influencia (influencers/UGC): inversión ejecutada vs plan, alcance, impresiones, clics, CTR, CPM y video views.",
    tools: influenciaTools,
  },
  mercado: {
    context:
      BASE +
      "Dashboard Análisis de Mercado (GFK): value share, unit share e índice de precio por marca/categoría/segmento (High/Mid/Low). Drean vs competencia.",
    tools: mercadoTools,
  },
  "salud-marca": {
    context:
      BASE +
      "Dashboard Salud de Marca (Kantar): Top of Mind, Share of Mind, Intención de compra, Poder de Marca y puntaje SM consolidado, por categoría y ola.",
    tools: saludMarcaTools,
  },
  "mkt-canal": {
    context:
      BASE +
      "Dashboard Mkt Canal: acciones digitales en retailers (por cliente, acción, plataforma y mes) con impresiones, clics, conversiones, ingresos e inversión. Calculá CTR, CPC, CPM y ROAS por acción o cliente cuando lo pidan.",
    tools: mktCanalTools,
  },
};

export function getDashboardChat(dashboard: string): DashboardChat | undefined {
  return REGISTRY[dashboard];
}
