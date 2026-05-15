/**
 * Helpers de fechas. Trabajamos en UTC para evitar líos de timezone con la DB.
 */

export const DEFAULT_RANGE_DAYS = 7;

export interface DateRange {
  from: string;
  to: string;
}

function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function defaultDateRange(referenceDate?: Date): DateRange {
  const ref = referenceDate ?? new Date();
  const to = new Date(ref);
  const from = new Date(ref);
  from.setUTCDate(from.getUTCDate() - (DEFAULT_RANGE_DAYS - 1));
  return { from: toISODate(from), to: toISODate(to) };
}

/**
 * Rango "demo": calcula automáticamente la ventana donde hay seed data
 * (2026-05-04 → 2026-05-08). Se usa cuando no hay datos en el rango por
 * defecto, así el dashboard de demo siempre renderiza algo útil.
 */
export const SEED_DATE_RANGE: DateRange = {
  from: "2026-05-04",
  to: "2026-05-08",
};

/**
 * Último mes cerrado: si hoy es 15-may-2026 → 1-abr-2026 a 30-abr-2026.
 * Útil como default cuando los datos mensuales necesitan rango completo.
 */
export function lastClosedMonthRange(referenceDate?: Date): DateRange {
  const ref = referenceDate ?? new Date();
  const year = ref.getUTCFullYear();
  const month = ref.getUTCMonth(); // 0-indexed; mes en curso
  // Primer día del mes anterior
  const fromD = new Date(Date.UTC(year, month - 1, 1));
  // Último día del mes anterior = day 0 del mes en curso
  const toD = new Date(Date.UTC(year, month, 0));
  return { from: toISODate(fromD), to: toISODate(toD) };
}

export function parseDateRange(
  searchParams: Record<string, string | string[] | undefined>,
  fallback: DateRange = SEED_DATE_RANGE,
): DateRange {
  const fromRaw = searchParams.from;
  const toRaw = searchParams.to;
  const fromValue = Array.isArray(fromRaw) ? fromRaw[0] : fromRaw;
  const toValue = Array.isArray(toRaw) ? toRaw[0] : toRaw;
  const isValid = (v: string | undefined): v is string =>
    !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
  if (isValid(fromValue) && isValid(toValue)) {
    return { from: fromValue, to: toValue };
  }
  return fallback;
}

export function formatFechaCorta(iso: string, locale = "es-AR"): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  }).format(d);
}
