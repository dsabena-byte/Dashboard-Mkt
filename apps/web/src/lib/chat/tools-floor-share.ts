import "server-only";
import { getFsPrecomputed, getFloorShareRowsFast, getTiendaClienteMapFast, getAvailableWeeksFast } from "@/lib/cb-mirror";
import { computeFsView, type FsView, type FsEnrichedRow } from "@/lib/fs-view";
import { FS_OBJ_PCT, type CategoryBlock } from "@/lib/floor-share-queries";
import { rd, topN, oneOf } from "./util";
import type { ChatTool } from "./types";

// ============================================================================
// Floor Share (/floor-share). Lee la vista PRECALCULADA (fs_precomputed, la llena el
// cron cb-mirror: últimas 26 semanas) — antes paginaba ~135k filas del proyecto CB en
// cada pregunta. Fallback: computar sobre el mirror si el precálculo no existe.
// Para la evolución MENSUAL por categoría usar get_cumplimiento_floor_share (trade_monthly).
// ============================================================================

async function vista(): Promise<FsView | null> {
  const pre = await getFsPrecomputed();
  if (pre) return pre;
  const { weeks } = await getAvailableWeeksFast();
  const [raw, cli] = await Promise.all([getFloorShareRowsFast(weeks.slice(0, 26)), getTiendaClienteMapFast()]);
  const rows: FsEnrichedRow[] = raw
    .filter((r) => r.marca != null && r.categoria != null && r.numero_tienda != null && r.semana != null)
    .map((r) => ({ ...r, cliente: cli.get(r.numero_tienda) ?? "Sin cliente" }));
  return computeFsView(rows, {});
}
const blk = (b: CategoryBlock) => rd(b.total_units > 0 ? b.share : null, 1);

export const floorShareTools: ChatTool[] = [
  {
    name: "get_floor_share",
    description:
      "Floor Share (exhibición en góndola, últimas 26 semanas relevadas): % de Drean total y por categoría (Lavado/Refrigeración/Cocción, objetivos 32/25/23%) + el desglose pedido en 'nivel': marcas (ranking total) | categoria_marca (share por marca en cada categoría) | cliente (cadena) | tienda | semanal (share semanal de las top marcas).",
    parameters: {
      type: "object",
      properties: {
        nivel: { type: "string", enum: ["resumen", "marcas", "categoria_marca", "cliente", "tienda", "semanal"], description: "default resumen" },
        cliente: { type: "string", description: "filtrar una cadena (nivel cliente/tienda)" },
        orden: { type: "string", enum: ["peores", "mejores"], description: "nivel cliente/tienda (default peores)" },
        top: { type: "number", description: "filas (default 12, máx 40)" },
      },
    },
    run: async (args) => {
      const v = await vista();
      if (!v || !v.hasData) return { disponible: false, motivo: "Sin datos de Floor Share." };
      const nivel = oneOf(args.nivel, ["resumen", "marcas", "categoria_marca", "cliente", "tienda", "semanal"] as const, "resumen");
      const n = topN(args.top, 12, 40);
      const peores = args.orden !== "mejores";
      const cli = typeof args.cliente === "string" ? args.cliente.toLowerCase() : "";
      const overall = {
        drean_total_pct: blk(v.overall.total),
        lavado_pct: blk(v.overall.lavado),
        refrigeracion_pct: blk(v.overall.refri),
        coccion_pct: blk(v.overall.coccion),
        objetivos_pct: { lavado: FS_OBJ_PCT.lavado, refrigeracion: FS_OBJ_PCT.refri, coccion: FS_OBJ_PCT.coccion },
        tiendas: v.overall.tiendas,
        semanas: v.options.semanas.length ? `${v.options.semanas[0]}–${v.options.semanas[v.options.semanas.length - 1]}` : null,
      };
      const marcas = () => v.totalRanking.slice(0, n).map((b) => ({ marca: b.marca, share_pct: rd(b.share, 1), unidades: b.unidades }));
      switch (nivel) {
        case "resumen":
          return { overall, top_marcas: marcas().slice(0, 6) };
        case "marcas":
          return { overall, marcas: marcas() };
        case "categoria_marca": {
          const out: Record<string, Array<{ marca: string; share_pct: number | null }>> = {};
          for (const c of v.catBrand) (out[c.categoria] ??= []).push({ marca: c.marca, share_pct: rd(c.share, 1) });
          for (const k of Object.keys(out)) out[k] = out[k]!.sort((a, b) => (b.share_pct ?? 0) - (a.share_pct ?? 0)).slice(0, 8);
          return { overall, por_categoria: out };
        }
        case "cliente": {
          const xs = v.byCliente.filter((c) => !cli || c.cliente.toLowerCase().includes(cli)).sort((a, b) => (peores ? a.total.share - b.total.share : b.total.share - a.total.share));
          return { overall, clientes: xs.slice(0, n).map((c) => ({ cliente: c.cliente, total_pct: blk(c.total), lavado_pct: blk(c.lavado), refri_pct: blk(c.refri), coccion_pct: blk(c.coccion), tiendas: c.tiendas })) };
        }
        case "tienda": {
          const xs = v.byTienda.filter((t) => t.total.total_units > 0 && (!cli || t.cliente.toLowerCase().includes(cli))).sort((a, b) => (peores ? a.total.share - b.total.share : b.total.share - a.total.share));
          return { overall, tiendas: xs.slice(0, n).map((t) => ({ tienda: t.nombre_tienda, cliente: t.cliente, total_pct: blk(t.total), lavado_pct: blk(t.lavado), refri_pct: blk(t.refri), coccion_pct: blk(t.coccion) })), total_tiendas: xs.length };
        }
        case "semanal":
          return { overall, marcas: v.top5, semanal: v.weekly.map((w) => ({ semana: w.semana, ...Object.fromEntries(Object.entries(w.shares).map(([m, s]) => [m, rd(s, 1)])) })) };
      }
    },
  },
];
