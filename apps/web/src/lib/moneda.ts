// ============================================================================
// MONEDA DE LOS MONTOS (portado de BIP, sep-2026) — módulo PURO y client-safe (sin server-only, sin fetch).
//
// El selector de los tableros ofrece DOS formas de leer un monto (sep-2026: se sacó "$ constantes"
// de la UI a pedido del user — "es muy confuso, no se utiliza en Argentina"):
//   · "corrientes"  → "$": tal cual lo informó la plataforma (default).
//   · "usd"         → monto ÷ dólar oficial del mes (promedio de los días hábiles del mes).
// "constantes" (monto × IPC(base) ÷ IPC(mes)) queda SOLO como cálculo interno (deflactar montos en
// "Validar con mis datos" del Mapa); no es una opción del selector y `?moneda=constantes` cae a "$".
// Fuente de índices: tabla `indices_macro` (mes, ipc, usd_oficial, usd_mep) que llena el cron
// `sync-macro` (IPC INDEC vía API de Series de Tiempo de datos.gob.ar; dólar vía API del BCRA).
// Si falta el índice de un mes se usa el ÚLTIMO disponible anterior (o el primero posterior si no
// hay anterior) y se AVISA (nunca un cero silencioso). Las metas en pesos se convierten con la
// misma función → se comparan en la misma moneda que el real.
// Test: cd apps/web && npx tsx scripts/moneda.test.ts
// ============================================================================

/** Monedas del selector de los tableros ("$" y "USD"). */
export type Moneda = "corrientes" | "usd";
export const MONEDAS: Moneda[] = ["corrientes", "usd"];
/** Monedas de cálculo: las del selector + "constantes" (deflactor IPC, uso interno de análisis). */
export type MonedaCalc = Moneda | "constantes";

/** Fila de `indices_macro`. mes = "YYYY-MM" (se acepta "YYYY-MM-DD" y se recorta). */
export interface IndiceMes { mes: string; ipc: number | null; usd_oficial: number | null; usd_mep?: number | null }

export interface IndicesMacro {
  ipc: Map<string, number>;
  usd: Map<string, number>;
  meses: string[];            // todos los meses con algún dato, ascendente
  ultimoIpc: string | null;   // último mes con IPC (= base por defecto de "constantes")
  ultimoUsd: string | null;
}

export interface ConvContext {
  moneda: MonedaCalc;
  idx: IndicesMacro;
  base: string | null;        // mes base de "constantes" (YYYY-MM)
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
  const ipc = new Map<string, number>(), usd = new Map<string, number>();
  for (const r of rows ?? []) {
    const k = normMes(r.mes);
    if (!k) continue;
    const i = pos(r.ipc), u = pos(r.usd_oficial);
    if (i != null) ipc.set(k, i);
    if (u != null) usd.set(k, u);
  }
  const meses = [...new Set([...ipc.keys(), ...usd.keys()])].sort();
  const last = (m: Map<string, number>) => [...m.keys()].sort().pop() ?? null;
  return { ipc, usd, meses, ultimoIpc: last(ipc), ultimoUsd: last(usd) };
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
  if (ctx.moneda === "usd") {
    const u = lookup(ctx.idx.usd, k);
    if (!u) return { factor: 1, mesUsado: null, faltante: true, sinIndice: true };
    return { factor: 1 / u.valor, mesUsado: u.mesUsado, faltante: !u.exacto, sinIndice: false };
  }
  const base = ctx.base ?? ctx.idx.ultimoIpc;
  const b = base ? lookup(ctx.idx.ipc, base) : null;
  const i = lookup(ctx.idx.ipc, k);
  if (!b || !i) return { factor: 1, mesUsado: null, faltante: true, sinIndice: true };
  return { factor: b.valor / i.valor, mesUsado: i.mesUsado, faltante: !i.exacto, sinIndice: false };
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

/** Contexto listo para usar: si se pidió usd (o constantes, uso interno) y no hay índices, vuelve a "$" y lo avisa. */
export function resolverContexto(moneda: MonedaCalc, rows: IndiceMes[] | null | undefined, base?: string | null): { ctx: ConvContext; aviso: string | null } {
  const idx = buildIndices(rows);
  if (moneda === "constantes" && !idx.ipc.size) return { ctx: { moneda: "corrientes", idx, base: null }, aviso: "Todavía no tenemos la serie de inflación (IPC): los montos van sin ajustar." };
  if (moneda === "usd" && !idx.usd.size) return { ctx: { moneda: "corrientes", idx, base: null }, aviso: "Todavía no tenemos la serie del dólar oficial: se muestran en $." };
  const b = normMes(base ?? null) && idx.ipc.has(normMes(base)!) ? normMes(base) : idx.ultimoIpc;
  return { ctx: { moneda, idx, base: moneda === "constantes" ? b : null }, aviso: null };
}

/** Texto del aviso de meses sin índice (se usó el último disponible). null si no hay faltantes. */
export function avisoFaltantes(ctx: ConvContext, faltantes: string[]): string | null {
  if (ctx.moneda === "corrientes") return null;
  const u = [...new Set(faltantes)].sort();
  if (!u.length) return null;
  const serie = ctx.moneda === "usd" ? "dólar oficial" : "IPC";
  const ult = ctx.moneda === "usd" ? ctx.idx.ultimoUsd : ctx.idx.ultimoIpc;
  return `Sin ${serie} publicado para ${u.map(mesLabel).join(", ")}: se usó el último disponible (${mesLabel(ult)}).`;
}

export function monedaLabel(ctx: Pick<ConvContext, "moneda" | "base">): string {
  if (ctx.moneda === "usd") return "USD (dólar oficial del mes)";
  if (ctx.moneda === "constantes") return `Pesos constantes (de ${mesLabel(ctx.base)})`;
  return "$";
}

/** Código de moneda para los formateadores ("ARS" / "USD"). */
export const monedaCode = (ctx: Pick<ConvContext, "moneda">, original: string | null = "ARS"): string | null => (ctx.moneda === "usd" ? "USD" : original);

// ── Parsers de las fuentes (robustos: ignoran filas inválidas, nunca tiran) ──────────────────

/** API de Series de Tiempo (apis.datos.gob.ar/series/api/series?ids=…&format=json) → [{mes, valor}]. */
export function parseSeriesApi(json: unknown, col = 1): { mes: string; valor: number }[] {
  const data = (json as { data?: unknown })?.data;
  if (!Array.isArray(data)) return [];
  const out = new Map<string, number>();
  for (const row of data) {
    if (!Array.isArray(row)) continue;
    const mes = normMes(String(row[0] ?? ""));
    const v = pos(row[col]);
    if (mes && v != null) out.set(mes, v);
  }
  return [...out.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([mes, valor]) => ({ mes, valor }));
}

/** API del BCRA "Estadísticas Cambiarias v1.0" /Cotizaciones/USD → diario [{fecha, valor}]. */
export function parseBcraCotizaciones(json: unknown, codigo = "USD"): { fecha: string; valor: number }[] {
  const res = (json as { results?: unknown })?.results;
  if (!Array.isArray(res)) return [];
  const out: { fecha: string; valor: number }[] = [];
  for (const r of res as { fecha?: string; detalle?: { codigoMoneda?: string; tipoCotizacion?: unknown }[] }[]) {
    const fecha = String(r?.fecha ?? "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !Array.isArray(r.detalle)) continue;
    const d = r.detalle.find((x) => String(x?.codigoMoneda ?? "").toUpperCase() === codigo);
    const v = pos(d?.tipoCotizacion);
    if (v != null) out.push({ fecha, valor: v });
  }
  return out;
}

/** API de argentinadatos.com /v1/cotizaciones/dolares/<casa> → diario [{fecha, valor}] (venta). */
export function parseArgentinaDatos(json: unknown): { fecha: string; valor: number }[] {
  if (!Array.isArray(json)) return [];
  const out: { fecha: string; valor: number }[] = [];
  for (const r of json as { fecha?: string; venta?: unknown; compra?: unknown }[]) {
    const fecha = String(r?.fecha ?? "").slice(0, 10);
    const v = pos(r?.venta) ?? pos(r?.compra);
    if (/^\d{4}-\d{2}-\d{2}$/.test(fecha) && v != null) out.push({ fecha, valor: v });
  }
  return out;
}

/** Promedio mensual de una serie diaria (días con dato). */
export function promedioMensual(diario: { fecha: string; valor: number }[]): { mes: string; valor: number; dias: number }[] {
  const acc = new Map<string, { s: number; n: number }>();
  for (const d of diario) {
    const k = normMes(d.fecha);
    if (!k || !(d.valor > 0)) continue;
    const a = acc.get(k) ?? { s: 0, n: 0 };
    a.s += d.valor; a.n++; acc.set(k, a);
  }
  return [...acc.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([mes, a]) => ({ mes, valor: Math.round((a.s / a.n) * 10000) / 10000, dias: a.n }));
}

/** Une IPC + oficial + MEP en filas de `indices_macro` (un mes aparece si tiene al menos un dato). */
export function mergeIndices(ipc: { mes: string; valor: number }[], oficial: { mes: string; valor: number }[], mep: { mes: string; valor: number }[] = []): IndiceMes[] {
  const m = new Map<string, IndiceMes>();
  const get = (mes: string) => m.get(mes) ?? { mes, ipc: null, usd_oficial: null, usd_mep: null };
  for (const r of ipc) m.set(r.mes, { ...get(r.mes), ipc: r.valor });
  for (const r of oficial) m.set(r.mes, { ...get(r.mes), usd_oficial: r.valor });
  for (const r of mep) m.set(r.mes, { ...get(r.mes), usd_mep: r.valor });
  return [...m.values()].sort((a, b) => a.mes.localeCompare(b.mes));
}
