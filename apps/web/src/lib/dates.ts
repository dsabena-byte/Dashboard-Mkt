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

export function parseDateRange(
  searchParams: Record<string, string | string[] | undefined>,
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
  return SEED_DATE_RANGE;
}

export function formatFechaCorta(iso: string, locale = "es-AR"): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  }).format(d);
}
