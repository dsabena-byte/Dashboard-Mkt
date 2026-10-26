import "server-only";
import { getCbVentasDatos } from "@/lib/cb-ventas/server";
import { calcularPorcentajes, mapasClasificacion, OBJETIVO_SELLIN } from "@/lib/cb-ventas/metrics";
import type { CuadroBasicoItem } from "@/lib/cb-ventas/types";
import { oneOf, topN, TZ_AR } from "./util";
import type { ChatTool } from "./types";

// CB Ventas (/cb-ventas): mismas fórmulas que la pantalla (lib/cb-ventas/metrics.ts) y el MISMO alcance:
// getCbVentasDatos() ya recorta a los clientes del vendedor / gerencia del usuario logueado.

const mesAR = (iso: string) => Number(new Intl.DateTimeFormat("en-CA", { timeZone: TZ_AR, month: "numeric" }).format(new Date(iso)));

export const cbVentasTools: ChatTool[] = [
  {
    name: "get_cb_ventas",
    description:
      "CB Ventas (cuadro básico de ventas por cliente/razón social, compras FC facturas + BO pedidos pendientes, homólogos, objetivo 80%): % de cumplimiento total, Infaltables y Estratégicos + desglose por 'nivel': vendedor | cliente | gerencia | categoria | tipologia | faltantes (modelos del cuadro básico sin compra de un cliente). Ventana: facturas de los últimos 2 meses cerrados (3 en Small Retailers) y todo el BO.",
    parameters: {
      type: "object",
      properties: {
        nivel: { type: "string", enum: ["resumen", "vendedor", "cliente", "gerencia", "categoria", "tipologia", "faltantes"], description: "default resumen" },
        cliente: { type: "string", description: "filtrar un cliente (texto contenido en la razón social)" },
        vendedor: { type: "string", description: "filtrar un vendedor" },
        orden: { type: "string", enum: ["peores", "mejores"], description: "default peores" },
        top: { type: "number", description: "filas (default 12, máx 40)" },
      },
    },
    run: async (args) => {
      const d = await getCbVentasDatos();
      if (d.estado !== "ok") return { disponible: false, motivo: d.mensaje };
      if (!d.cuadroBasico.length) return { disponible: false, motivo: "Todavía no hay cuadro básico cargado." };
      const { vendedorPorCliente, gerentePorVendedor } = mapasClasificacion(d.clasificacion);
      const nivel = oneOf(args.nivel, ["resumen", "vendedor", "cliente", "gerencia", "categoria", "tipologia", "faltantes"] as const, "resumen");
      const n = topN(args.top, 12, 40);
      const cli = typeof args.cliente === "string" ? args.cliente.toLowerCase() : "";
      const ven = typeof args.vendedor === "string" ? args.vendedor.toLowerCase() : "";
      const items = d.cuadroBasico.filter((i) =>
        (!cli || i.cliente.toLowerCase().includes(cli)) && (!ven || (vendedorPorCliente.get(i.cliente) ?? "").toLowerCase().includes(ven)));
      const ctx = { hayFiltroMes: false, mesEnCurso: mesAR(d.ventas.generatedAt) };
      const pct = (its: CuadroBasicoItem[]) => {
        const p = calcularPorcentajes(its, d.ventas.rows, ctx);
        return { pct_cb: p.pctCB, pct_infaltables: p.pctInf, pct_estrategicos: p.pctEst, cumplidos: p.cumplidosCB, total: p.totalCB, faltan_para_80: Math.max(0, Math.ceil(0.8 * p.totalCB) - p.cumplidosCB) };
      };
      const base = { objetivo_pct: OBJETIVO_SELLIN, ultima_carga_ventas: d.ventas.source === "dummy" ? null : d.ventas.generatedAt, alcance: d.alcance, total: pct(items) };
      if (nivel === "resumen") return base;
      if (nivel === "faltantes") {
        const p = calcularPorcentajes(items, d.ventas.rows, ctx);
        return { ...base, faltantes: p.itemsFaltantes.slice(0, n * 3).map((i) => ({ cliente: i.cliente, modelo: i.sku, categoria: i.categoria, tipo: i.tipo })) };
      }
      const clave = (i: CuadroBasicoItem): string | undefined => {
        const v = vendedorPorCliente.get(i.cliente);
        return nivel === "vendedor" ? v : nivel === "cliente" ? i.cliente : nivel === "gerencia" ? (v ? gerentePorVendedor.get(v) : undefined) : nivel === "categoria" ? i.categoria : i.tipologia;
      };
      const grupos = new Map<string, CuadroBasicoItem[]>();
      for (const i of items) { const k = clave(i); if (k) (grupos.get(k) ?? grupos.set(k, []).get(k)!).push(i); }
      const filas = [...grupos].map(([nombre, its]) => ({ nombre, ...pct(its) })).sort((a, b) => (args.orden === "mejores" ? b.pct_cb - a.pct_cb : a.pct_cb - b.pct_cb));
      return { ...base, nivel, filas: filas.slice(0, n) };
    },
  },
];
