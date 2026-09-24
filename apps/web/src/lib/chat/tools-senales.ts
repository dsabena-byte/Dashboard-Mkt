import "server-only";
import { signalsSummaryForChat, isSignalScope } from "@/lib/signals";
import type { ChatTool } from "./types";

// Señales pre-calculadas (alertas/oportunidades) del motor determinístico lib/signals.
// Contrato: signalsSummaryForChat(tenantDash?: string, top?: number): Promise<unknown>.
export const senalesTools: ChatTool[] = [
  {
    name: "get_senales",
    description:
      "Señales pre-calculadas (alertas y oportunidades con impacto cuantificado y acción sugerida) por tablero: redes, performance (Plan de Medios), web, seo-search, overview (objetivos) o cruces (señales que cruzan datos propios con mercado/competencia). Usala PRIMERO ante preguntas de qué mejorar, qué está mal, oportunidades u optimización; después profundizá con las tools de detalle.",
    parameters: {
      type: "object",
      properties: {
        dash: { type: "string", enum: ["redes", "performance", "web", "seo-search", "overview", "cruces"], description: "Tablero; omitir = todos" },
        top: { type: "number", description: "Máximo de señales (default 15)" },
      },
    },
    run: async (args) => {
      const d = isSignalScope(args.dash) ? String(args.dash) : undefined;
      const top = Math.min(30, Math.max(1, Number(args.top) || 15));
      const senales = await signalsSummaryForChat(d, top);
      const vacio = senales == null || (Array.isArray(senales) && senales.length === 0);
      return vacio
        ? { senales: [], nota: "No hay señales activas (o el motor de señales todavía no está disponible). Analizá con las tools de detalle y calc." }
        : { senales };
    },
  },
];
