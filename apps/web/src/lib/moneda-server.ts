import "server-only";
import { parseMoneda, resolverContexto, type ConvContext, type IndiceMes } from "./moneda";
import { getTcReal } from "./tc-finanzas";

/** Contexto de moneda para una página a partir de `?moneda=` (USD = monto ÷ TC REAL de finanzas del mes). */
export async function monedaContext(param: string | string[] | undefined): Promise<{ ctx: ConvContext; aviso: string | null; pedido: ReturnType<typeof parseMoneda>; rows: IndiceMes[] }> {
  const pedido = parseMoneda(param);
  const rows = await getTcReal();
  const { ctx, aviso } = resolverContexto(pedido, rows);
  return { ctx, aviso, pedido, rows };
}
