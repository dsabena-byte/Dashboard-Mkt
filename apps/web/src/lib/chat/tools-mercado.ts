import "server-only";
import { getMercadoRows } from "@/lib/mercado-queries";
import type { ChatTool } from "./types";

export const mercadoTools: ChatTool[] = [
  {
    name: "get_mercado",
    description:
      "Participación de mercado (GFK) por marca/categoría/segmento (High/Mid/Low): value share (%), unit share (%) e índice de precio. Parámetro 'agregacion': 'MAT' (móvil anual, default) o 'mensual'.",
    parameters: {
      type: "object",
      properties: { agregacion: { type: "string", enum: ["MAT", "mensual"] } },
    },
    run: async (args) => getMercadoRows(args.agregacion === "mensual" ? "mensual" : "MAT"),
  },
];
