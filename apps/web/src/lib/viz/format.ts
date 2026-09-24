// Formato es-AR: compacto (K / M / MM) para ejes/labels y completo para tooltips/tablas.
import type { NumFormat } from "./types";

const nf0 = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

function compactNum(v: number): string {
  const a = Math.abs(v);
  if (a >= 1e9) return `${nf1.format(v / 1e9)}MM`;
  if (a >= 1e6) return `${nf1.format(v / 1e6)}M`;
  if (a >= 1e4) return `${nf0.format(v / 1e3)}K`;
  if (a >= 1e3) return `${nf1.format(v / 1e3)}K`;
  if (a >= 100 || Number.isInteger(v)) return nf0.format(v);
  return nf2.format(v);
}

/** Valor formateado. compact=true para ejes/labels/KPIs. */
export function fmtValue(v: number | null | undefined, format: NumFormat = "auto", compact = true): string {
  if (v == null || !Number.isFinite(v)) return "—";
  switch (format) {
    case "percent": return `${nf1.format(v)}%`;
    case "pct_frac": return `${nf1.format(v * 100)}%`;
    case "ratio": return `${nf2.format(v)}x`;
    case "currency": return `$${compact ? compactNum(v) : nf0.format(v)}`.replace("$-", "-$");
    case "integer": return compact ? compactNum(Math.round(v)) : nf0.format(Math.round(v));
    case "decimal": return nf2.format(v);
    default: return compact ? compactNum(v) : (Number.isInteger(v) ? nf0.format(v) : nf2.format(v));
  }
}

/** Delta porcentual con signo (para comparaciones). */
export function fmtDelta(pct: number | null | undefined): string {
  if (pct == null || !Number.isFinite(pct)) return "—";
  return `${pct >= 0 ? "▲" : "▼"} ${nf1.format(Math.abs(pct))}%`;
}

export const NUM_FORMATS: { v: NumFormat; label: string }[] = [
  { v: "auto", label: "Automático" },
  { v: "number", label: "Número" },
  { v: "integer", label: "Entero" },
  { v: "decimal", label: "Decimal" },
  { v: "currency", label: "Moneda ($)" },
  { v: "percent", label: "% (valor ya en %)" },
  { v: "pct_frac", label: "% (fracción 0–1)" },
  { v: "ratio", label: "Veces (x)" },
];
