// Copia literal de cuadros-basicos/lib/cb-match.ts + normalize-cliente.ts.
import type { CuadroBasicoItem, VentaRow } from "./types";

// Una venta cumple un CB cuando el cliente matchea exacto y el SKU coincide
// con el primary (modelo) o cualquier homólogo declarado en la columna del
// CSV de Cuadro Básico.
export function matchesCB(c: VentaRow, item: CuadroBasicoItem): boolean {
  if (c.cliente !== item.cliente) return false;
  if (c.sku === item.sku) return true;
  const aliases = item.skuAliases;
  if (!aliases || aliases.length === 0) return false;
  return aliases.includes(c.sku);
}

// SKUs válidos para un CB row (primary + homólogos). Útil para construir
// índices (ej. en /api/ventas o /api/cb-pairs).
export function allSkusOfCB(item: CuadroBasicoItem): string[] {
  if (!item.skuAliases || item.skuAliases.length === 0) return [item.sku];
  return [item.sku, ...item.skuAliases];
}
export function normalizeCliente(s: string): string {
  return String(s ?? "")
    .trim()
    .toUpperCase()
    .replace(/\./g, "")
    .replace(/\s+/g, "");
}
