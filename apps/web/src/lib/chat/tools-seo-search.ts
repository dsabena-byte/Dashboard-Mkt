import "server-only";
import {
  getShareOfSearch,
  getTrendsInterest,
  getDemandaGenerica,
  getSeoCompetitivo,
} from "@/lib/competitive-queries";
import type { ChatTool } from "./types";

export const seoSearchTools: ChatTool[] = [
  {
    name: "get_share_of_search",
    description:
      "Share of Search por categoría y marca: volumen de búsqueda y % de participación (Drean vs competencia), por mes.",
    parameters: { type: "object", properties: {} },
    run: async () => getShareOfSearch(),
  },
  {
    name: "get_demanda_y_trends",
    description:
      "Interés de Google Trends (0-100) por marca/categoría y demanda genérica (volumen de búsqueda del término de categoría).",
    parameters: { type: "object", properties: {} },
    run: async () => ({
      trends: await getTrendsInterest(),
      demanda_generica: await getDemandaGenerica(),
    }),
  },
  {
    name: "get_seo_competitivo",
    description: "Posición en buscadores (SERP) por marca y keyword, con volumen de búsqueda.",
    parameters: { type: "object", properties: {} },
    run: async () => getSeoCompetitivo(),
  },
];
