import "server-only";
import {
  getWebDailyKpis,
  aggregateDaily,
  getWebBySource,
  aggregateBySource,
  getAllMonthlyUsers,
} from "@/lib/web-queries";
import type { ChatTool } from "./types";

export const webTools: ChatTool[] = [
  {
    name: "get_web_kpis",
    description:
      "KPIs de la web (GA4) para un rango de fechas: sesiones, usuarios, conversiones, conversion rate, pageviews, bounce rate y duración media de sesión; más el desglose por canal.",
    parameters: {
      type: "object",
      required: ["from", "to"],
      properties: {
        from: { type: "string", description: "Fecha desde YYYY-MM-DD" },
        to: { type: "string", description: "Fecha hasta YYYY-MM-DD" },
      },
    },
    run: async (args) => {
      const range = { from: String(args.from ?? ""), to: String(args.to ?? "") };
      const [daily, bySource] = await Promise.all([getWebDailyKpis(range), getWebBySource(range)]);
      return { totales: aggregateDaily(daily), por_canal: aggregateBySource(bySource) };
    },
  },
  {
    name: "get_web_mensual",
    description: "Usuarios web por mes (histórico): total y nuevos.",
    parameters: { type: "object", properties: {} },
    run: async () => getAllMonthlyUsers(),
  },
];
