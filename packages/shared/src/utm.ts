/**
 * Convención UTM: lowercase, kebab-case, sin espacios ni tildes.
 * source/medium/campaign son obligatorios. content/term son opcionales.
 * Ver docs/utm-conventions.md para detalle.
 */

export interface Utm {
  source: string;
  medium: string;
  campaign: string;
  content?: string;
  term?: string;
}

const UTM_PATTERN = /^[a-z0-9](?:[a-z0-9-_]*[a-z0-9])?$/;

export function normalizeUtmValue(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-_]/g, "");
}

export function isValidUtmValue(value: string): boolean {
  return UTM_PATTERN.test(value);
}

export interface UtmValidation {
  valid: boolean;
  errors: string[];
}

export function validateUtm(utm: Partial<Utm>): UtmValidation {
  const errors: string[] = [];
  const required: (keyof Utm)[] = ["source", "medium", "campaign"];

  for (const field of required) {
    const value = utm[field];
    if (!value) {
      errors.push(`utm_${field} es obligatorio`);
      continue;
    }
    if (!isValidUtmValue(value)) {
      errors.push(
        `utm_${field}="${value}" no cumple la convención (lowercase, kebab-case)`,
      );
    }
  }

  for (const field of ["content", "term"] as const) {
    const value = utm[field];
    if (value && !isValidUtmValue(value)) {
      errors.push(
        `utm_${field}="${value}" no cumple la convención (lowercase, kebab-case)`,
      );
    }
  }

  return { valid: errors.length === 0, errors };
}

export function buildUtmString(utm: Utm): string {
  const params = new URLSearchParams({
    utm_source: utm.source,
    utm_medium: utm.medium,
    utm_campaign: utm.campaign,
  });
  if (utm.content) params.set("utm_content", utm.content);
  if (utm.term) params.set("utm_term", utm.term);
  return params.toString();
}

export function parseUtmFromUrl(url: string): Partial<Utm> {
  const parsed = new URL(url);
  const get = (k: string) => parsed.searchParams.get(k) ?? undefined;
  return {
    source: get("utm_source"),
    medium: get("utm_medium"),
    campaign: get("utm_campaign"),
    content: get("utm_content"),
    term: get("utm_term"),
  };
}
