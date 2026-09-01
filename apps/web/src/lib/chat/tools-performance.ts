import "server-only";
import { getPautaPerformance } from "@/lib/pauta-queries";
import { getPlanningMedia } from "@/lib/planning-media-queries";
import type { ChatTool } from "./types";

export const performanceTools: ChatTool[] = [
  {
    name: "get_pauta_performance",
    description:
      "Performance de pauta (medios pagos) por mes/categoría/medio: alcance, impresiones, frecuencia, clics, views, inversión y CTR — con valores de plan vs real.",
    parameters: { type: "object", properties: {} },
    run: async () => getPautaPerformance(true), // consistente con el dashboard de Pauta Mkt (incluye UGC)
  },
  {
    name: "get_inversion_medios",
    description:
      "Inversión de medios (planning) por línea: fecha, campaña, rol, sistema, formato, inversión y tipo (media/costo). Sirve para el mix de inversión (Digital, TV Cable, DOOH, OOH).",
    parameters: { type: "object", properties: {} },
    run: async () => getPlanningMedia({}),
  },
];
