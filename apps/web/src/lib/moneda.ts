// ============================================================================
// MONEDA DE LOS MONTOS (portado de BIP, sep-2026) — módulo PURO y client-safe (sin server-only, sin fetch).
//
// Solo DOS formas de leer un monto (decisión del user, 28-sep-2026: "solo valores reales en $ y luego
// USD, nada más, inflación no suma" → no hay pesos constantes ni ajuste por IPC en NINGÚN cálculo):
//   · "corrientes"  → "$": tal cual lo informó la plataforma (default).
//   · "usd"         → monto ÷ tipo de cambio REAL del mes.
// `?moneda=constantes` de links viejos cae a "$".
// Fuente ÚNICA del tipo de cambio (decisión del user, 21-oct-2026): el TC REAL que carga finanzas en
// /funnel → Cargar datos → Tipos de cambio (tabla `bgt_tc`, versión "REAL <año>"). Lo lee
// `lib/tc-finanzas.ts`. No hay sync del BCRA ni ninguna otra fuente de dólar.
// Si falta el dólar de un mes se usa el ÚLTIMO disponible anterior (o el primero posterior si no
// hay anterior) y se AVISA (nunca un cero silencioso). Las metas en pesos se convierten con la
// misma función → se comparan en la misma moneda que el real.
// Test: cd apps/web && npx tsx scripts/moneda.test.ts
// ============================================================================

export type Moneda = "corrientes" | "usd";
export const MONEDAS: Moneda[] = ["corrientes", "usd"];

/** Tipo de cambio de un mes (pesos por dólar). mes = "YYYY-MM" (se acepta "YYYY-MM-DD" y se recorta). */
export interface IndiceMes { mes: string; tc: number | null }

export interface IndicesMacro {
  usd: Map<string, number>;
  meses: string[];            // todos los meses con dólar, ascendente
  ultimoUsd: string | null;
}

export interface ConvContext {
  moneda: Moneda;
  idx: IndicesMacro;
}

const MES_LBL = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MES_RE = /^(\d{4})-(\d{2})/;

export function normMes(s: string | null | undefined): string | null {
  const m = MES_RE.exec(String(s ?? "").trim());
  if (!m) return null;
  const mm = Number(m[2]);
  return mm >= 1 && mm <= 12 ? `${m[1]}-${m[2]}` : null;
}
export const mesKey = (anio: number, mesIdx0: number) => `${anio}-${String(mesIdx0 + 1).padStart(2, "0")}`;
/** "2026-08" → "ago-2026". */
export function mesLabel(mes: string | null | undefined): string {
  const k = normMes(mes);
  if (!k) return "—";
  return `${MES_LBL[Number(k.slice(5, 7)) - 1]}-${k.slice(0, 4)}`;
}

export function parseMoneda(v: string | string[] | null | undefined): Moneda {
  const s = ((Array.isArray(v) ? v[0] : v) ?? "").toString().toLowerCase().trim();
  return s === "usd" ? "usd" : "corrientes"; // "constantes" (link viejo) cae a "$"
}

const pos = (x: unknown): number | null => { const n = Number(x); return x != null && x !== "" && Number.isFinite(n) && n > 0 ? n : null; };

export function buildIndices(rows: IndiceMes[] | null | undefined): IndicesMacro {
  const usd = new Map<string, number>();
  for (const r of rows ?? []) {
    const k = normMes(r.mes);
    const u = pos(r.tc);
    if (k && u != null) usd.set(k, u);
  }
  const meses = [...usd.keys()].sort();
  return { usd, meses, ultimoUsd: meses.at(-1) ?? null };
}

/** Valor del mes o, si falta, el último anterior disponible (o el primero posterior). */
export function lookup(map: Map<string, number>, mes: string): { valor: number; mesUsado: string; exacto: boolean } | null {
  const v = map.get(mes);
  if (v != null) return { valor: v, mesUsado: mes, exacto: true };
  const keys = [...map.keys()].sort();
  if (!keys.length) return null;
  let prev: string | null = null;
  for (const k of keys) { if (k < mes) prev = k; else break; }
  const k = prev ?? keys[0]!;
  return { valor: map.get(k)!, mesUsado: k, exacto: false };
}

export interface ConvResult { valor: number; factor: number; mesUsado: string | null; faltante: boolean; sinIndice: boolean }

/** Factor multiplicativo para llevar un monto de `mes` a la moneda del contexto. */
export function factorMes(ctx: ConvContext, mes: string): Omit<ConvResult, "valor"> {
  const k = normMes(mes);
  if (ctx.moneda === "corrientes" || !k) return { factor: 1, mesUsado: k, faltante: false, sinIndice: false };
  const u = lookup(ctx.idx.usd, k);
  if (!u) return { factor: 1, mesUsado: null, faltante: true, sinIndice: true };
  return { factor: 1 / u.valor, mesUsado: u.mesUsado, faltante: !u.exacto, sinIndice: false };
}

export function convertir(ctx: ConvContext, monto: number, mes: string): ConvResult {
  const f = factorMes(ctx, mes);
  return { ...f, valor: monto * f.factor };
}
export function convertirNullable(ctx: ConvContext, monto: number | null | undefined, mes: string): number | null {
  if (monto == null || !Number.isFinite(monto)) return monto ?? null;
  return convertir(ctx, monto, mes).valor;
}

/** Convierte un array mensual [12] del año `anio` (mesIdx 0..11). Devuelve también los meses faltantes. */
export function convertirSerie12(ctx: ConvContext, anio: number, vals: (number | null)[]): { valores: (number | null)[]; faltantes: string[] } {
  const faltantes: string[] = [];
  const valores = vals.map((v, i) => {
    if (v == null || !Number.isFinite(v)) return v ?? null;
    const r = convertir(ctx, v, mesKey(anio, i));
    if (r.faltante && ctx.moneda !== "corrientes") faltantes.push(mesKey(anio, i));
    return r.valor;
  });
  return { valores, faltantes };
}

/** Factor promedio de un rango de meses (para montos agregados de un período: tablas, top de productos). */
export function factorPeriodo(ctx: ConvContext, meses: string[], pesos?: number[]): number {
  if (ctx.moneda === "corrientes" || !meses.length) return 1;
  let num = 0, den = 0;
  meses.forEach((m, i) => { const w = pesos?.[i] ?? 1; if (w > 0) { num += factorMes(ctx, m).factor * w; den += w; } });
  return den > 0 ? num / den : 1;
}

/** Meses YYYY-MM entre dos fechas (inclusive). */
export function mesesEntre(desde: string, hasta: string): string[] {
  const a = normMes(desde), b = normMes(hasta);
  if (!a || !b || a > b) return a ? [a] : [];
  const out: string[] = [];
  let y = Number(a.slice(0, 4)), m = Number(a.slice(5, 7));
  for (let guard = 0; guard < 600; guard++) {
    const k = `${y}-${String(m).padStart(2, "0")}`;
    out.push(k);
    if (k === b) break;
    m++; if (m > 12) { m = 1; y++; }
  }
  return out;
}

/** Contexto listo para usar: si se pidió usd y no hay dólar cargado, vuelve a "$" y lo avisa. */
export function resolverContexto(moneda: Moneda, rows: IndiceMes[] | null | undefined): { ctx: ConvContext; aviso: string | null } {
  const idx = buildIndices(rows);
  if (moneda === "usd" && !idx.usd.size) return { ctx: { moneda: "corrientes", idx }, aviso: "Todavía no hay tipo de cambio REAL cargado (Inversión de Marketing → Cargar datos → Tipos de cambio): se muestran en $." };
  return { ctx: { moneda, idx }, aviso: null };
}

/** Texto del aviso de meses sin dólar (se usó el último disponible). null si no hay faltantes. */
export function avisoFaltantes(ctx: ConvContext, faltantes: string[]): string | null {
  if (ctx.moneda === "corrientes") return null;
  const u = [...new Set(faltantes)].sort();
  if (!u.length) return null;
  return `Sin tipo de cambio REAL cargado para ${u.map(mesLabel).join(", ")}: se usó el último disponible (${mesLabel(ctx.idx.ultimoUsd)}).`;
}

export function monedaLabel(ctx: Pick<ConvContext, "moneda">): string {
  return ctx.moneda === "usd" ? "USD (tipo de cambio REAL del mes)" : "$";
}

/** Código de moneda para los formateadores ("ARS" / "USD"). */
export const monedaCode = (ctx: Pick<ConvContext, "moneda">, original: string | null = "ARS"): string | null => (ctx.moneda === "usd" ? "USD" : original);

/** Filas de `bgt_tc` → tipo de cambio por mes. Solo versiones "REAL <año>" (lo ejecutado; los TC de BGT/4+8/8+4
 *  son de cada presupuesto y no se usan para convertir lo real). */
export function indicesDesdeTc(rows: { version: string; mes: number; tc: number | string | null }[] | null | undefined): IndiceMes[] {
  const out: IndiceMes[] = [];
  for (const r of rows ?? []) {
    const a = /^REAL (\d{4})$/.exec(String(r?.version ?? "").trim());
    const m = Number(r?.mes);
    if (!a || !(m >= 1 && m <= 12)) continue;
    out.push({ mes: mesKey(Number(a[1]), m - 1), tc: pos(r.tc) });
  }
  return out.sort((x, y) => x.mes.localeCompare(y.mes));
}
