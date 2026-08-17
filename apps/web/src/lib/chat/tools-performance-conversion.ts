import "server-only";
import { getConversionDaily, getConversionItems } from "@/lib/pauta-conversion-queries";
import type { ChatTool } from "./types";

export const performanceConversionTools: ChatTool[] = [
  {
    name: "get_conversion_diaria",
    description:
      "Conversión de pauta → web (GA4) por día y campaña: sesiones, usuarios, bounce rate, pageviews, transacciones, ingresos, costo, clics e impresiones de ads. Con esto se calculan CPA/CAC, CPC, ROAS y conversion rate.",
    parameters: { type: "object", properties: {} },
    run: async () => getConversionDaily(),
  },
  {
    name: "get_conversion_productos",
    description: "Productos comprados atribuidos a la pauta: por fecha y campaña, unidades e ingresos por item.",
    parameters: { type: "object", properties: {} },
    run: async () => getConversionItems(),
  },
];
