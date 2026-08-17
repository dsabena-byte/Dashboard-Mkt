import "server-only";
import {
  getFloorShareRows,
  computeOverall,
  shareByBrand,
  shareByCatBrand,
} from "@/lib/floor-share-queries";
import type { ChatTool } from "./types";

export const floorShareTools: ChatTool[] = [
  {
    name: "get_floor_share",
    description:
      "Floor Share de Drean: overall total y por categoría (Lavado/Refrigeración/Cocción) con % de share y unidades, más share por marca y por categoría×marca. Objetivos: Lavado 32%, Refri 25%, Cocción 23%.",
    parameters: { type: "object", properties: {} },
    run: async () => {
      const rows = await getFloorShareRows({});
      return {
        overall: computeOverall(rows),
        por_marca: shareByBrand(rows),
        por_categoria_marca: shareByCatBrand(rows),
      };
    },
  },
];
