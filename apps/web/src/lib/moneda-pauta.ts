// ============================================================================
// Moneda (USD) aplicada al Plan de Medios de Drean (portado de BIP lib/moneda-pauta.ts,
// sep-2026). PURO y client-safe. Lo usa el server component de /performance ANTES de pasarle la data
// al tablero → el cliente (performance-client) NO cambia: recibe los montos ya convertidos y todo lo
// derivado (CPM, CPC, costo por vista, cuatrimestres, metas) sale en la misma moneda.
//  · Cada fila se convierte con el factor de SU mes ("Junio 2026" / "2026-06-01" / fecha).
//  · DV360 viene en USD y el tablero lo pasa a ARS con fx_rates del mes: se aplica el mismo factor
//    mensual a revenue_usd (el producto conmuta). En "usd": revenue_usd × fx ÷ dólar oficial ≈ USD.
//  · Metas de Inversión (valores[12] del año) con el mismo factor → se comparan en la misma moneda.
// Default (sin ?moneda) = "$" (corrientes) → devuelve los mismos objetos (cero cambio).
// ============================================================================
import { factorMes, normMes, mesKey, type ConvContext } from "./moneda";

const MES_FULL: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};

/** "Junio 2026" | "2026-06-01" | "2026-06-15" → "2026-06" (null si no se reconoce). */
export function mesDeLabel(label: string | null | undefined): string | null {
  const s = String(label ?? "").trim();
  const iso = normMes(s);
  if (iso) return iso;
  const [n, y] = s.split(/\s+/);
  const m = MES_FULL[(n ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")];
  return m && /^\d{4}$/.test(y ?? "") ? `${y}-${String(m).padStart(2, "0")}` : null;
}

export interface ConvCollector { faltantes: Set<string> }

/** Factor de conversión del mes de una fila (1 si no se reconoce el mes o es "corrientes"). */
export function factorFila(ctx: ConvContext, mesLabel: string | null | undefined, col?: ConvCollector): number {
  if (ctx.moneda === "corrientes") return 1;
  const k = mesDeLabel(mesLabel);
  if (!k) return 1;
  const f = factorMes(ctx, k);
  if (f.faltante && col) col.faltantes.add(k);
  return f.factor;
}

const mul = (v: number | null | undefined, f: number) => (v == null || !Number.isFinite(v) ? v ?? null : v * f);

/** Convierte los campos monetarios `fields` de cada fila por el factor de su mes. */
export function convertirFilas<T extends object>(ctx: ConvContext, rows: T[], mesDe: (r: T) => string | null | undefined, fields: (keyof T)[], col?: ConvCollector): T[] {
  if (ctx.moneda === "corrientes") return rows;
  return rows.map((r) => {
    const f = factorFila(ctx, mesDe(r), col);
    if (f === 1) return r;
    const o = { ...r };
    for (const fld of fields) {
      const v = o[fld] as unknown;
      if (typeof v === "number") (o[fld] as unknown as number | null) = mul(v, f);
    }
    return o;
  });
}

/** Serie [12] del año `anio` (mesIdx 0..11). */
export function convertir12(ctx: ConvContext, anio: number, vals: (number | null)[], col?: ConvCollector): (number | null)[] {
  if (ctx.moneda === "corrientes") return vals;
  return vals.map((v, i) => (v == null ? v : mul(v, factorFila(ctx, mesKey(anio, i), col))));
}

/** Planificación por mes (clave "Junio 2026") con buckets numéricos. */
export function convertirPorMes<V extends Record<string, number>>(ctx: ConvContext, byMes: Record<string, V>, col?: ConvCollector): Record<string, V> {
  if (ctx.moneda === "corrientes") return byMes;
  const out: Record<string, V> = {};
  for (const [mes, v] of Object.entries(byMes)) {
    const f = factorFila(ctx, mes, col);
    out[mes] = Object.fromEntries(Object.entries(v).map(([k, n]) => [k, n * f])) as V;
  }
  return out;
}
