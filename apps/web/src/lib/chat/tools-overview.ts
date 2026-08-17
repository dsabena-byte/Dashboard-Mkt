import "server-only";
import { getCbU3M } from "@/lib/cb-queries";
import { getFloorShareU4M } from "@/lib/floor-share-queries";
import { getFacturacionMensual } from "@/lib/facturacion-queries";
import { getDreanSerie } from "@/lib/salud-marca-queries";
import { computeDreanConsolidado } from "@/lib/salud-marca-model";
import type { ChatTool } from "./types";

export const overviewTools: ChatTool[] = [
  {
    name: "get_cumplimiento_cb",
    description:
      "Cumplimiento de Cuadro Básico (U3M): % CB, Infaltables y Estratégicos con objetivo (80%), promedio, último mes, proyección y serie mensual.",
    parameters: { type: "object", properties: {} },
    run: async () => getCbU3M(),
  },
  {
    name: "get_cumplimiento_floor_share",
    description:
      "Floor Share por categoría (U4M): Lavado, Refrigeración y Cocción con objetivo (32/25/23%), promedio, último y serie mensual.",
    parameters: { type: "object", properties: {} },
    run: async () => getFloorShareU4M(),
  },
  {
    name: "get_facturacion_mensual",
    description: "Facturación mensual de la empresa (por mes, en su moneda).",
    parameters: { type: "object", properties: {} },
    run: async () => getFacturacionMensual(),
  },
  {
    name: "get_salud_de_marca",
    description:
      "Salud de Marca consolidada de Drean por categoría (Top of Mind, Share of Mind, Intención, Poder, puntaje SM) por ola.",
    parameters: { type: "object", properties: {} },
    run: async () => {
      const [lav, ref, coc] = await Promise.all([
        getDreanSerie("Lavado", "MAT", "DREAN"),
        getDreanSerie("Refrigeración", "MAT", "DREAN"),
        getDreanSerie("Cocción", "MAT", "DREAN"),
      ]);
      return computeDreanConsolidado({ lav, ref, coc });
    },
  },
];
