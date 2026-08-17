import "server-only";
import {
  getCbRows,
  computeTotals,
  computeWeeklyEvolution,
  computeByDivision,
  getCbBaselineMedidas,
  getCbSuggestions,
} from "@/lib/cb-queries";
import type { ChatTool } from "./types";

export const cuadrosBasicosTools: ChatTool[] = [
  {
    name: "get_cb_cumplimiento",
    description:
      "Cumplimiento de Cuadro Básico: totales (% CB, Infaltables, Estratégicos, cantidad de tiendas), evolución semanal y por división. Opcional: filtrar por semanas (número ISO) o divisiones.",
    parameters: {
      type: "object",
      properties: {
        semanas: { type: "array", items: { type: "number" }, description: "números de semana ISO (opcional)" },
        divisiones: { type: "array", items: { type: "string" }, description: "divisiones (opcional)" },
      },
    },
    run: async (args) => {
      const filter: { semanas?: number[]; divisiones?: string[] } = {};
      if (Array.isArray(args.semanas)) filter.semanas = args.semanas as number[];
      if (Array.isArray(args.divisiones)) filter.divisiones = args.divisiones as string[];
      const rows = await getCbRows(filter);
      return {
        totales: computeTotals(rows),
        evolucion_semanal: computeWeeklyEvolution(rows),
        por_division: computeByDivision(rows),
      };
    },
  },
  {
    name: "get_cb_baseline",
    description:
      "Baseline de tiendas medidas (últimas 3 semanas): % CB e Infaltable promedio y cantidad de tiendas medidas.",
    parameters: { type: "object", properties: {} },
    run: async () => getCbBaselineMedidas(),
  },
  {
    name: "get_cb_sugerencias",
    description:
      "Tiendas NO medidas hoy pero candidatas a sumar al programa CB, con su % CB calculado (top 40).",
    parameters: { type: "object", properties: {} },
    run: async () => (await getCbSuggestions()).slice(0, 40),
  },
];
