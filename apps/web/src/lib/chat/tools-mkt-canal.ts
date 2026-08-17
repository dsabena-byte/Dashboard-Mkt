import "server-only";
import { getServerSupabase } from "@/lib/supabase-server";
import type { ChatTool } from "./types";

interface MktCanalRow {
  cliente: string | null;
  accion: string | null;
  mes: string | null;
  periodo: string | null;
  plataforma: string | null;
  impresiones: number | null;
  clics: number | null;
  conversiones: number | null;
  ingresos: number | null;
  inversion: number | null;
}

export const mktCanalTools: ChatTool[] = [
  {
    name: "get_mkt_canal",
    description:
      "Acciones digitales en retailers (Mkt Canal): por cliente, acción, mes y plataforma, con impresiones, clics, conversiones, ingresos e inversión. Con esto se calculan CTR, CPC, CPM y ROAS por acción o cliente.",
    parameters: { type: "object", properties: {} },
    run: async () => {
      const supabase = getServerSupabase();
      const { data, error } = await supabase
        .from("mkt_canal_acciones")
        .select(
          "cliente, accion, mes, periodo, plataforma, impresiones, clics, conversiones, ingresos, inversion",
        )
        .order("id")
        .returns<MktCanalRow[]>();
      if (error) return { error: error.message };
      return data ?? [];
    },
  },
];
