// Motor de SEÑALES determinísticas (sin IA) — tipos + helpers compartidos. Portado de BIP
// (sep-2026). Client-safe: sin server-only (los componentes cliente importan los tipos).
// Los umbrales son relativos a la propia data (medianas / percentiles / período anterior).
// Drean suma tableros propios (trade, UGC, mercado GfK, Kantar, Mkt Canal, ecommerce, BGT).

export type SignalDash =
  | "redes" | "performance" | "web" | "seo-search" | "overview"
  | "cuadros-basicos" | "floor-share" | "influencia" | "mercado" | "salud-marca"
  | "mkt-canal" | "performance-conversion" | "funnel";

export interface Signal {
  key: string;
  dash: SignalDash;
  tipo: "alerta" | "oportunidad" | "info";
  prioridad: "alta" | "media" | "baja";
  titulo: string;
  descripcion: string;
  acciones: string[];
  datos: Record<string, unknown>;
  impacto?: { metrica: string; valor: number; unidad: string };
  /** Señal CRUZADA (lib/signals/cruces.ts): combina datos de 2+ fuentes (propios × mercado). */
  cruce?: boolean;
}

const PRIO: Record<Signal["prioridad"], number> = { alta: 0, media: 1, baja: 2 };
const TIPO: Record<Signal["tipo"], number> = { alerta: 0, oportunidad: 1, info: 2 };

// Orden: prioridad → tipo (alerta antes que oportunidad/info) → tamaño del impacto.
export function sortSignals(s: Signal[]): Signal[] {
  return [...s].sort((a, b) =>
    PRIO[a.prioridad] - PRIO[b.prioridad]
    || TIPO[a.tipo] - TIPO[b.tipo]
    || Math.abs(b.impacto?.valor ?? 0) - Math.abs(a.impacto?.valor ?? 0));
}

// ── Estadística básica ──────────────────────────────────────────────────────
export function quantile(xs: number[], q: number): number {
  const a = xs.filter((x) => Number.isFinite(x)).sort((x, y) => x - y);
  if (!a.length) return 0;
  const pos = (a.length - 1) * q;
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  return a[lo]! + (a[hi]! - a[lo]!) * (pos - lo);
}
export const median = (xs: number[]) => quantile(xs, 0.5);
export const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
export const avg = (xs: number[]) => (xs.length ? sum(xs) / xs.length : 0);
/** Variación % (null si la base es 0). */
export const deltaPct = (cur: number, prev: number): number | null => (prev ? ((cur - prev) / prev) * 100 : null);

// ── Formato (es-AR) ──────────────────────────────────────────────────────────
const nf0 = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
export const fInt = (v: number) => nf0.format(Math.round(v));
export const fNum = (v: number) => (Math.abs(v) >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : Math.abs(v) >= 1e4 ? `${(v / 1e3).toFixed(1)}K` : fInt(v));
export const fPct = (v: number, d = 1) => `${v.toFixed(d)}%`;
export const fDelta = (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(0)}%`;
export const fMoney = (v: number, cur?: string | null) => {
  const p = !cur || cur === "ARS" ? "$" : `${cur} `;
  const a = Math.abs(v);
  const body = a >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : a >= 1e4 ? `${(v / 1e3).toFixed(0)}K` : a >= 10 ? fInt(v) : v.toFixed(2);
  return p + body;
};
/** Recorta un texto (captions, nombres) para títulos. */
export const clip = (s: string | null | undefined, n = 70) => {
  const t = (s ?? "").replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t || "(sin texto)";
};
/** Redondeo para los `datos` (payload compacto para la IA / UI). */
export const r2 = (v: number) => Math.round(v * 100) / 100;
