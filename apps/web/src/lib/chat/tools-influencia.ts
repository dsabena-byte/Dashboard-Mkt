import "server-only";
import { getInfluenciaPerformance } from "@/lib/pauta-queries";
import type { ChatTool } from "./types";

export const influenciaTools: ChatTool[] = [
  {
    name: "get_influencia_performance",
    description:
      "Performance de influencers/UGC por mes: inversión ejecutada (vs plan), alcance, impresiones, clics, views, CTR y CPM.",
    parameters: { type: "object", properties: {} },
    run: async () => getInfluenciaPerformance(),
  },
];
