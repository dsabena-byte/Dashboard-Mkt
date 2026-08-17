import "server-only";
import { getDreanSerie } from "@/lib/salud-marca-queries";
import { computeDreanConsolidado } from "@/lib/salud-marca-model";
import type { ChatTool } from "./types";

export const saludMarcaTools: ChatTool[] = [
  {
    name: "get_salud_de_marca",
    description:
      "Salud de Marca de Drean (fuente Kantar) por categoría (Lavado/Refrigeración/Cocción) y ola: Top of Mind, Share of Mind, Intención de compra, Poder de Marca y el puntaje consolidado SM.",
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
