// Parsing robusto de valores de planilla: números es-AR / en, moneda, %, negativos entre
// paréntesis, fechas (ISO, dd/mm/aaaa, dd-mm-aa, nombres de mes es/en, "ene-26", serial de
// Excel, aaaa-mm, trimestres) y booleanos. Todo puro.
import type { DateGrain, FieldRole, FieldType, NumFormat } from "./types";

export type NumLocale = "es" | "en";

const CUR_RE = /(US\$|U\$S|USD|ARS|AR\$|R\$|EUR|€|\$|£)/gi;

/** Número desde celda. locale decide el caso ambiguo "1.234" / "1,234" (default es-AR). */
export function parseNumber(v: unknown, locale: NumLocale = "es"): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "boolean") return v ? 1 : 0;
  let s = String(v).trim();
  if (!s || s === "-" || s === "—" || s === "–") return null;
  let neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1).trim(); }
  s = s.replace(CUR_RE, "").replace(/[\s  ']/g, "").replace(/%$/, "");
  if (s.endsWith("-")) { neg = !neg; s = s.slice(0, -1); }
  if (s.startsWith("-")) { neg = !neg; s = s.slice(1); }
  else if (s.startsWith("+")) s = s.slice(1);
  if (!/^[0-9.,]+$/.test(s) || !/[0-9]/.test(s)) return null;
  const hasC = s.includes(","), hasD = s.includes(".");
  if (hasC && hasD) {
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
  } else if (hasC) {
    const many = (s.match(/,/g) ?? []).length > 1;
    if (many || (locale === "en" && /^\d{1,3}(,\d{3})+$/.test(s))) s = s.replace(/,/g, "");
    else s = s.replace(",", ".");
  } else if (hasD) {
    const many = (s.match(/\./g) ?? []).length > 1;
    if (many || (locale === "es" && /^\d{1,3}(\.\d{3})+$/.test(s))) s = s.replace(/\./g, "");
  }
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return neg ? -n : n;
}

/** Detecta el locale de una columna por muestras no ambiguas. */
export function detectLocale(samples: unknown[]): NumLocale {
  let es = 0, en = 0;
  for (const v of samples) {
    if (typeof v !== "string") continue;
    const s = v.replace(CUR_RE, "").replace(/[\s%() -]/g, "");
    if (/^\d{1,3}(\.\d{3})+,\d+$/.test(s) || /^\d+,\d{1,2}$/.test(s)) es++;
    else if (/^\d{1,3}(,\d{3})+\.\d+$/.test(s) || /^\d{1,3}(,\d{3})+$/.test(s)) en++;
    else if (/^\d{1,3}(\.\d{3})+$/.test(s)) es++;
  }
  return en > es ? "en" : "es";
}

// ── Fechas (todas en UTC, ms a medianoche) ──
const MES_ES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MES_EN = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const MES_LARGO: Record<string, number> = {
  enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5, julio: 6, agosto: 7, septiembre: 8, setiembre: 8, octubre: 9, noviembre: 10, diciembre: 11,
  january: 0, february: 1, march: 2, april: 3, june: 5, july: 6, august: 7, september: 8, october: 9, november: 10, december: 11, sept: 8, set: 8,
};
function monthIdx(tok: string): number {
  const t = tok.toLowerCase().replace(/\.$/, "").normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (t in MES_LARGO) return MES_LARGO[t]!;
  const a = t.slice(0, 3);
  let i = MES_ES.indexOf(a); if (i >= 0 && t.length <= 4) return i;
  i = MES_EN.indexOf(a); if (i >= 0 && t.length <= 4) return i;
  return -1;
}
const yr = (y: number) => (y < 100 ? (y < 70 ? 2000 + y : 1900 + y) : y);
const utc = (y: number, m: number, d: number) => {
  if (m < 0 || m > 11 || d < 1 || d > 31 || y < 1900 || y > 2200) return null;
  const t = Date.UTC(y, m, d);
  return new Date(t).getUTCMonth() === m ? t : null;
};
export const EXCEL_MIN = 20000, EXCEL_MAX = 80000; // ~1954 → 2119

/** Serial de Excel → ms UTC. */
export const excelSerial = (n: number) => Math.round((n - 25569) * 86400000 / 86400000) * 86400000;

export interface DateParse { t: number; monthOnly?: boolean }

/** Fecha desde texto. `serial` = aceptar números como serial de Excel. */
export function parseDate(v: unknown, opts: { serial?: boolean; year?: number } = {}): DateParse | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) return Number.isFinite(v.getTime()) ? { t: Date.UTC(v.getUTCFullYear(), v.getUTCMonth(), v.getUTCDate()) } : null;
  if (typeof v === "number") {
    if (opts.serial && v >= EXCEL_MIN && v <= EXCEL_MAX) return { t: excelSerial(Math.floor(v)) };
    return null;
  }
  const s = String(v).trim();
  if (!s || s.length > 40) return null;
  let m: RegExpMatchArray | null;
  // ISO aaaa-mm-dd[Thh:mm…] / aaaa/mm/dd
  if ((m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T ].*)?$/))) { const t = utc(+m[1]!, +m[2]! - 1, +m[3]!); return t == null ? null : { t }; }
  // aaaa-mm
  if ((m = s.match(/^(\d{4})[-/](\d{1,2})$/))) { const t = utc(+m[1]!, +m[2]! - 1, 1); return t == null ? null : { t }; }
  // aaaamm (202603) — solo si es texto de 6 dígitos con mes válido
  if ((m = s.match(/^(20\d{2})(0[1-9]|1[0-2])$/))) return { t: Date.UTC(+m[1]!, +m[2]! - 1, 1) };
  // dd/mm/aaaa, dd-mm-aa, dd.mm.aaaa (es-AR; si el 2º > 12 se asume mm/dd)
  if ((m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})(?:\s+\d{1,2}:\d{2}.*)?$/))) {
    let d = +m[1]!, mo = +m[2]!;
    if (mo > 12 && d <= 12) [d, mo] = [mo, d];
    const t = utc(yr(+m[3]!), mo - 1, d); return t == null ? null : { t };
  }
  // mm/aaaa
  if ((m = s.match(/^(\d{1,2})[/.-](\d{4})$/))) { const t = utc(+m[2]!, +m[1]! - 1, 1); return t == null ? null : { t }; }
  // Trimestre: "Q1 2026", "1T 2026", "T1-26", "2026-Q1"
  if ((m = s.match(/^(?:Q|T)([1-4])[\s\-/]*(\d{2,4})$/i)) || (m = s.match(/^([1-4])(?:Q|T)[\s\-/]*(\d{2,4})$/i))) return { t: Date.UTC(yr(+m[2]!), (+m[1]! - 1) * 3, 1) };
  if ((m = s.match(/^(\d{4})[\s\-/]*(?:Q|T)([1-4])$/i))) return { t: Date.UTC(+m[1]!, (+m[2]! - 1) * 3, 1) };
  // "15 de marzo de 2026", "15-mar-2026", "15 mar 26"
  if ((m = s.match(/^(\d{1,2})(?:\s+de\s+|[\s\-/.]+)([A-Za-zÁÉÍÓÚáéíóú.]+)(?:\s+de\s+|[\s\-/.,]+)(\d{2,4})$/))) {
    const mi = monthIdx(m[2]!); if (mi >= 0) { const t = utc(yr(+m[3]!), mi, +m[1]!); if (t != null) return { t }; }
  }
  // "ene-26", "Ene 2026", "enero de 2026", "March 2026", "sep.26"
  if ((m = s.match(/^([A-Za-zÁÉÍÓÚáéíóú.]+)(?:\s+de\s+|[\s\-/.',]+)(\d{2,4})$/))) {
    const mi = monthIdx(m[1]!); if (mi >= 0) return { t: Date.UTC(yr(+m[2]!), mi, 1) };
  }
  // "2026 ene" / "2026-mar"
  if ((m = s.match(/^(\d{4})[\s\-/.]+([A-Za-zÁÉÍÓÚáéíóú.]+)$/))) {
    const mi = monthIdx(m[2]!); if (mi >= 0) return { t: Date.UTC(+m[1]!, mi, 1) };
  }
  // Solo el mes ("Ene", "Marzo") → año de referencia
  const mi = monthIdx(s);
  if (mi >= 0) return { t: Date.UTC(opts.year ?? new Date().getUTCFullYear(), mi, 1), monthOnly: true };
  return null;
}

const BOOL_T = new Set(["si", "sí", "true", "verdadero", "yes", "x", "✓"]);
const BOOL_F = new Set(["no", "false", "falso"]);
export function parseBool(v: unknown): boolean | null {
  if (v == null || v === "") return null;
  if (typeof v === "boolean") return v;
  const s = String(v).trim().toLowerCase();
  if (BOOL_T.has(s)) return true;
  if (BOOL_F.has(s)) return false;
  return null;
}

// ── Inferencia de tipo/rol/formato por columna ──
const H_DATE = /(fecha|date|d[ií]a\b|periodo|período|month|mes\b|semana|week|a[ñn]o.?mes)/i;
const H_DIM_NUM = /(^|\b)(id|c[oó]d(igo)?|sku|ean|cp|zip|a[ñn]o|year|mes|month|semana|week|trimestre|quarter|n[uú]mero de|nro|dni|cuit|tel)/i;
const H_CUR = /(\$|monto|importe|inversi|venta|factur|costo|gasto|precio|presupuest|\bbgt\b|budget|revenue|spend|ingreso|ticket|cpm|cpc|cpa|valor)/i;
const H_PCT = /(%|share|porcentaje|\btasa\b|ctr|vtr|margen|particip|cumplimiento|\bpct\b|percent)/i;

export interface Inferred { type: FieldType; role: FieldRole; format: NumFormat; locale: NumLocale; monthOnly?: boolean; distinct: number }

/** Muestra repartida (inicio, medio, fin) de valores no vacíos de una columna. */
export function sampleCol(rows: unknown[][], i: number, max = 400): unknown[] {
  const out: unknown[] = [];
  const n = rows.length;
  const step = n > max ? n / max : 1;
  for (let k = 0; k < n && out.length < max; k += step) {
    const v = rows[Math.floor(k)]?.[i];
    if (v != null && v !== "") out.push(v);
  }
  return out;
}

export function inferColumn(label: string, vals: unknown[]): Inferred {
  const locale = detectLocale(vals);
  const distinct = new Set(vals.map((v) => String(v))).size;
  if (!vals.length) return { type: "text", role: "dimension", format: "auto", locale, distinct };
  const nums = vals.map((v) => parseNumber(v, locale));
  const numOk = nums.filter((n) => n != null).length / vals.length;
  const strVals = vals.filter((v) => typeof v === "string");
  const dateStr = strVals.map((v) => parseDate(v)).filter(Boolean) as DateParse[];
  const dateOk = strVals.length ? dateStr.length / vals.length : 0;
  const hDate = H_DATE.test(label);

  // Fecha por texto (evitar que "2026" suelto o "12" sean fechas: parseDate no los toma)
  if (dateOk >= 0.8 && !(numOk >= 0.8 && dateOk < 0.95)) {
    return { type: "date", role: "dimension", format: "auto", locale, monthOnly: dateStr.every((d) => d.monthOnly), distinct };
  }
  // Serial de Excel: números en rango + encabezado de fecha
  if (numOk >= 0.8 && hDate && nums.every((n) => n == null || (n >= EXCEL_MIN && n <= EXCEL_MAX && Number.isInteger(Math.floor(n))))) {
    return { type: "date", role: "dimension", format: "auto", locale, distinct };
  }
  const bools = vals.filter((v) => parseBool(v) != null).length;
  if (bools / vals.length >= 0.95 && distinct <= 3 && numOk < 0.5) return { type: "boolean", role: "dimension", format: "auto", locale, distinct };

  if (numOk >= 0.8) {
    const ns = nums.filter((n): n is number => n != null);
    const allInt = ns.every((n) => Number.isInteger(n));
    const yearLike = allInt && ns.every((n) => n >= 1990 && n <= 2100);
    const monthLike = allInt && /mes|month/i.test(label) && ns.every((n) => n >= 1 && n <= 12);
    const dimByHeader = H_DIM_NUM.test(label) && !H_CUR.test(label);
    const role: FieldRole = yearLike || monthLike || dimByHeader ? "dimension" : "measure";
    const hasPct = strVals.some((v) => String(v).trim().endsWith("%"));
    const hasCur = strVals.some((v) => /[$€£]|USD|ARS/i.test(String(v)));
    let format: NumFormat = allInt ? "integer" : "number";
    if (hasPct) format = "percent";
    else if (H_PCT.test(label)) format = ns.every((n) => Math.abs(n) <= 1.5) ? "pct_frac" : "percent";
    else if (hasCur || H_CUR.test(label)) format = "currency";
    return { type: "number", role, format: role === "dimension" ? "auto" : format, locale, distinct };
  }
  return { type: "text", role: "dimension", format: "auto", locale, distinct };
}

// ── Buckets de fecha ──
const MES_LBL = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const p2 = (n: number) => String(n).padStart(2, "0");

/** Inicio del bucket (ms UTC). */
export function bucketStart(t: number, g: DateGrain): number {
  const d = new Date(t);
  const y = d.getUTCFullYear(), m = d.getUTCMonth();
  if (g === "day") return Date.UTC(y, m, d.getUTCDate());
  if (g === "week") { const dow = (d.getUTCDay() + 6) % 7; return Date.UTC(y, m, d.getUTCDate() - dow); }
  if (g === "month") return Date.UTC(y, m, 1);
  if (g === "quarter") return Date.UTC(y, Math.floor(m / 3) * 3, 1);
  return Date.UTC(y, 0, 1);
}
/** Clave ordenable del bucket. */
export function bucketKey(t: number, g: DateGrain): string {
  const d = new Date(bucketStart(t, g));
  const y = d.getUTCFullYear(), m = d.getUTCMonth();
  if (g === "day" || g === "week") return `${y}-${p2(m + 1)}-${p2(d.getUTCDate())}`;
  if (g === "month") return `${y}-${p2(m + 1)}`;
  if (g === "quarter") return `${y}-Q${Math.floor(m / 3) + 1}`;
  return String(y);
}
export function keyToStart(key: string, g: DateGrain): number {
  if (g === "quarter") { const [y, q] = key.split("-Q"); return Date.UTC(+y!, (+q! - 1) * 3, 1); }
  if (g === "year") return Date.UTC(+key, 0, 1);
  const [y, m, d] = key.split("-").map(Number);
  return Date.UTC(y!, (m || 1) - 1, d || 1);
}
/** Etiqueta legible del bucket. `withYear=false` omite el año (datos de un solo año). */
export function bucketLabel(key: string, g: DateGrain, withYear = true): string {
  if (g === "year") return key;
  if (g === "quarter") { const [y, q] = key.split("-Q"); return withYear ? `T${q} ${y!.slice(2)}` : `T${q}`; }
  const [y, m, d] = key.split("-");
  if (g === "month") return withYear ? `${MES_LBL[+m! - 1]} ${y!.slice(2)}` : MES_LBL[+m! - 1]!;
  if (g === "week") return `Sem ${d}/${m}`;
  return withYear ? `${d}/${m}/${y!.slice(2)}` : `${d}/${m}`;
}
/** Bucket equivalente del período anterior (1) o del año anterior. */
export function shiftKey(key: string, g: DateGrain, mode: "prev" | "year"): string {
  const t = keyToStart(key, g);
  const d = new Date(t);
  const y = d.getUTCFullYear(), m = d.getUTCMonth(), day = d.getUTCDate();
  if (mode === "year") {
    if (g === "week") return bucketKey(t - 364 * 86400000, g);
    return bucketKey(Date.UTC(y - 1, m, g === "day" ? day : 1), g);
  }
  if (g === "day") return bucketKey(t - 86400000, g);
  if (g === "week") return bucketKey(t - 7 * 86400000, g);
  if (g === "month") return bucketKey(Date.UTC(y, m - 1, 1), g);
  if (g === "quarter") return bucketKey(Date.UTC(y, m - 3, 1), g);
  return bucketKey(Date.UTC(y - 1, 0, 1), g);
}
export const fmtDate = (t: number) => { const d = new Date(t); return `${p2(d.getUTCDate())}/${p2(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`; };
export const isoDate = (t: number) => new Date(t).toISOString().slice(0, 10);
