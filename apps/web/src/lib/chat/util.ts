// ============================================================================
// Helpers puros del copiloto (sin server-only: los usan tools, contexto y tests).
// Base portada de BIP + helpers de Drean (meses "Julio 2026", ISO "2026-07-01").
// ============================================================================

export const MES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
export const MES_LARGO = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
export const TZ_AR = "America/Argentina/Buenos_Aires";

// Redondeo seguro (null si no es finito). Menos tokens y sin "0.30000000004".
export function rd(v: number | null | undefined, d = 2): number | null {
  if (v == null || !Number.isFinite(v)) return null;
  const f = 10 ** d;
  return Math.round(v * f) / f;
}
// Variación % (a vs b). null si b = 0.
export const varPct = (a: number | null | undefined, b: number | null | undefined): number | null =>
  a == null || b == null || !b ? null : rd(((a - b) / Math.abs(b)) * 100, 1);
export const div = (a: number, b: number, mult = 1): number | null => (b ? rd((a / b) * mult, 2) : null);

// Fecha de hoy en Argentina (YYYY-MM-DD).
const ymdFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ_AR, year: "numeric", month: "2-digit", day: "2-digit" });
export const hoyAR = (d = new Date()) => ymdFmt.format(d);

// ---- Claves de mes: anio*12 + mesIdx (comparables) --------------------------
export const keyOf = (anio: number, mesIdx: number) => anio * 12 + mesIdx;
export const keyAnio = (k: number) => Math.floor(k / 12);
export const keyMes = (k: number) => k % 12;
/** "YYYY-MM" | "YYYY-MM-DD" → clave. null si no parsea. */
export function ymKey(s: unknown): number | null {
  const m = String(s ?? "").match(/^(\d{4})-(\d{1,2})/);
  if (!m) return null;
  const y = Number(m[1]), mo = Number(m[2]);
  return mo >= 1 && mo <= 12 ? y * 12 + (mo - 1) : null;
}
/** "Julio 2026" → clave (formato de pauta_performance / meta_paid_creatives). */
export function labelKey(s: unknown): number | null {
  const [n, y] = String(s ?? "").trim().split(/\s+/);
  const i = MES_LARGO.findIndex((m) => m.toLowerCase() === (n ?? "").toLowerCase());
  const yy = Number(y);
  return i >= 0 && Number.isFinite(yy) ? keyOf(yy, i) : null;
}
/** Clave → "2026-07". */
export const keyYm = (k: number) => `${keyAnio(k)}-${String(keyMes(k) + 1).padStart(2, "0")}`;
/** Clave → "Jul 26". */
export const keyLabel = (k: number) => `${MES[keyMes(k)]} ${String(keyAnio(k)).slice(2)}`;
/** Clave → "2026-07-01". */
export const keyIso = (k: number) => `${keyYm(k)}-01`;
/** Último día del mes de la clave → "2026-07-31". */
export function keyIsoFin(k: number): string {
  const d = new Date(Date.UTC(keyAnio(k), keyMes(k) + 1, 0));
  return d.toISOString().slice(0, 10);
}

/** Período desde args {desde, hasta} (YYYY-MM o YYYY-MM-DD). Default: año en curso hasta hoy. */
export function periodo(args: Record<string, unknown>, defMesesAtras?: number): { desde: number; hasta: number } {
  const hoy = ymKey(hoyAR())!;
  const hasta = ymKey(args.hasta) ?? hoy;
  const desde = ymKey(args.desde) ?? (defMesesAtras != null ? hasta - (defMesesAtras - 1) : keyOf(keyAnio(hasta), 0));
  return desde <= hasta ? { desde, hasta } : { desde: hasta, hasta: desde };
}
export const enPeriodo = (k: number | null, p: { desde: number; hasta: number }) => k != null && k >= p.desde && k <= p.hasta;

// Top N acotado (default/máximo) para no mandar payloads enormes.
export function topN(v: unknown, def: number, max: number): number {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n > 0 ? Math.min(n, max) : def;
}
export const clip = (s: string | null | undefined, n: number) => {
  const t = (s ?? "").replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};
export const oneOf = <T extends string>(v: unknown, opts: readonly T[], def: T): T =>
  (opts as readonly string[]).includes(String(v)) ? (v as T) : def;
export const strArr = (v: unknown): string[] => (Array.isArray(v) ? v.map(String).filter(Boolean) : typeof v === "string" && v ? [v] : []);

/** Normaliza una categoría de negocio (Lavado / Refrigeración / Cocción / Brand / otra). */
export function normCategoria(raw: string | null | undefined): string {
  const c = (raw ?? "").toLowerCase();
  if (c.includes("lav") || c.includes("secarrop")) return "Lavado";
  if (c.includes("refri") || c.includes("helad") || c.includes("freez")) return "Refrigeración";
  if (c.includes("cocc") || c.includes("cocin") || c.includes("horno") || c.includes("anafe")) return "Cocción";
  if (c.includes("brand") || c.includes("marca") || c.includes("institucional")) return "Brand";
  return raw?.trim() || "Otros";
}
export const mismaCategoria = (raw: string | null | undefined, filtro: string | undefined) =>
  !filtro || normCategoria(raw) === normCategoria(filtro);

// Mediana (para comparar cada fila contra la "típica").
export function mediana(xs: number[]): number | null {
  const s = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!s.length) return null;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

// Formato corto para métricas de tarjetas (es-AR).
export function fmtN(v: number | null | undefined, d = 0): string {
  if (v == null || !Number.isFinite(v)) return "–";
  const a = Math.abs(v);
  if (a >= 1e6) return `${(v / 1e6).toLocaleString("es-AR", { maximumFractionDigits: 1 })}M`;
  if (a >= 1e4) return `${(v / 1e3).toLocaleString("es-AR", { maximumFractionDigits: 1 })}K`;
  return v.toLocaleString("es-AR", { maximumFractionDigits: d });
}
