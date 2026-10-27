// CB Ventas · vigencia del cuadro básico (migración 0140), PURO y client-safe.
// Cada renglón vale desde `desde` hasta `hasta` (fechas ISO; hasta null = sigue vigente). Sin la migración los renglones
// no traen fechas → valen siempre (mismos números que antes). Test: `npx tsx scripts/cb-ventas-vigencia.test.ts`.

export interface Vigencia { desde?: string | null; hasta?: string | null }

const pad = (n: number) => String(n).padStart(2, "0");
export const inicioMes = (anio: number, mes: number) => `${anio}-${pad(mes)}-01`;
export const finMes = (anio: number, mes: number) => `${anio}-${pad(mes)}-${pad(new Date(Date.UTC(anio, mes, 0)).getUTCDate())}`;

/** ¿El renglón vale en algún día entre a y b (ISO, inclusive)? */
export function vigenteEntre(v: Vigencia, a: string, b: string): boolean {
  return (!v.desde || v.desde <= b) && (!v.hasta || v.hasta >= a);
}
export const vigenteEnMes = (v: Vigencia, anio: number, mes: number) => vigenteEntre(v, inicioMes(anio, mes), finMes(anio, mes));
export const vigenteEnFecha = (v: Vigencia, iso: string) => vigenteEntre(v, iso, iso);

/** Hoy en Argentina (YYYY-MM-DD). */
export const hoyAR = (d = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(d);

/**
 * Cómo aplicar una edición sin tocar la historia: un renglón que nació ESTE mes (nunca valió en un mes pasado) se cambia
 * en el lugar; uno que ya valió antes se CIERRA al fin del mes anterior y el cambio nace el 1º de este mes.
 */
export function planEdicion(v: Vigencia, hoy: string): { modo: "en_lugar" } | { modo: "cerrar"; hasta: string; desde: string } {
  const [y, m] = hoy.split("-").map(Number) as [number, number];
  const desde = inicioMes(y, m);
  if (v.desde && v.desde >= desde) return { modo: "en_lugar" };
  return { modo: "cerrar", hasta: m === 1 ? finMes(y - 1, 12) : finMes(y, m - 1), desde };
}
