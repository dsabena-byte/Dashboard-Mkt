import "server-only";
import { getServerSupabase } from "@/lib/supabase-server";
import { div, oneOf, topN, periodo, enPeriodo, ymKey, keyLabel } from "./util";
import type { ChatTool } from "./types";

// ============================================================================
// Mkt Canal Comercial (/mkt-canal): acciones digitales en retailers. Antes devolvía
// la tabla cruda; ahora agrega por nivel con CTR, CPC, CPM y ROAS calculados.
// ============================================================================

interface MktCanalRow {
  cliente: string | null;
  accion: string | null;
  mes: string | null; // YYYY-MM
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
      "Acciones de marketing en retailers (Mkt Canal: Cetrogar, Frávega, Mercado Libre, etc.) agregadas por 'nivel': cliente | accion | plataforma | mes. Devuelve impresiones, clics, conversiones, ingresos, inversión y CTR, CPC, CPM, ROAS. Filtros: cliente, período (YYYY-MM).",
    parameters: {
      type: "object",
      properties: {
        nivel: { type: "string", enum: ["cliente", "accion", "plataforma", "mes"], description: "default cliente" },
        cliente: { type: "string" },
        desde: { type: "string", description: "YYYY-MM (default año en curso)" },
        hasta: { type: "string" },
        top: { type: "number", description: "default 15, máx 40" },
      },
    },
    run: async (args) => {
      const supabase = getServerSupabase();
      const { data, error } = await supabase
        .from("mkt_canal_acciones")
        .select("cliente, accion, mes, plataforma, impresiones, clics, conversiones, ingresos, inversion")
        .returns<MktCanalRow[]>();
      if (error) return { error: error.message };
      const nivel = oneOf(args.nivel, ["cliente", "accion", "plataforma", "mes"] as const, "cliente");
      const p = periodo(args);
      const cli = typeof args.cliente === "string" ? args.cliente.toLowerCase() : "";
      const g = new Map<string, { impr: number; clics: number; conv: number; ing: number; inv: number; acciones: Set<string> }>();
      for (const r of data ?? []) {
        if (!enPeriodo(ymKey(r.mes), p) || (cli && !(r.cliente ?? "").toLowerCase().includes(cli))) continue;
        const key = (nivel === "cliente" ? r.cliente : nivel === "accion" ? `${r.cliente ?? ""} · ${r.accion ?? ""}` : nivel === "plataforma" ? r.plataforma : r.mes) ?? "—";
        const e = g.get(key) ?? { impr: 0, clics: 0, conv: 0, ing: 0, inv: 0, acciones: new Set<string>() };
        e.impr += r.impresiones ?? 0; e.clics += r.clics ?? 0; e.conv += r.conversiones ?? 0; e.ing += r.ingresos ?? 0; e.inv += r.inversion ?? 0;
        e.acciones.add(`${r.cliente}|${r.accion}`);
        g.set(key, e);
      }
      const filas = [...g.entries()].map(([k, e]) => ({
        [nivel]: nivel === "mes" && ymKey(k) != null ? keyLabel(ymKey(k)!) : k,
        _k: k,
        acciones: e.acciones.size,
        impresiones: e.impr, clics: e.clics, conversiones: e.conv || null, ingresos: e.ing || null, inversion: e.inv || null,
        ctr_pct: div(e.clics, e.impr, 100), cpc: e.inv ? div(e.inv, e.clics) : null, cpm: e.inv ? div(e.inv, e.impr, 1000) : null, roas: e.inv && e.ing ? div(e.ing, e.inv) : null,
      }));
      if (nivel === "mes") filas.sort((a, b) => a._k.localeCompare(b._k));
      else filas.sort((a, b) => b.impresiones - a.impresiones);
      return {
        periodo: `${keyLabel(p.desde)} a ${keyLabel(p.hasta)}`,
        nota: "Muchas acciones no informan inversión/ingresos (null) → CPC/ROAS solo donde hay dato.",
        filas: filas.slice(0, topN(args.top, 15, 40)).map(({ _k, ...x }) => x),
      };
    },
  },
];
