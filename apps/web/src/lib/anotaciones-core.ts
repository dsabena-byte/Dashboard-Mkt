// Anotaciones en gráficos (portado de BIP, sep-2026) — núcleo PURO y client-safe.
// Una anotación = fecha + texto corto ("lanzamiento TV", "corte de stock"), de un tablero o de todo el
// dashboard (tablero null). Se dibujan como marca vertical en los gráficos por fecha y entran como contexto
// humano al Diagnóstico IA. Imports solo relativos (test suelto).
import { bucketKey } from "./viz/parse";
import type { DateGrain } from "./viz/types";

export interface Anotacion { id: string; fecha: string; tablero: string | null; texto: string; autor?: string | null }
export const MAX_TEXTO = 280;
const TABLERO_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;

/** Valida el alta. Fecha ISO real (no futura más de 1 año), texto 1-280, tablero = slug o null. */
export function cleanAnotacion(raw: unknown, hoy = new Date()): { ok: true; value: Omit<Anotacion, "id" | "autor"> } | { ok: false; error: string } {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const fecha = String(o.fecha ?? "").slice(0, 10);
  const t = Date.parse(`${fecha}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || Number.isNaN(t) || new Date(t).toISOString().slice(0, 10) !== fecha) return { ok: false, error: "Elegí una fecha válida." };
  if (t > hoy.getTime() + 366 * 86_400_000) return { ok: false, error: "La fecha está demasiado lejos en el futuro." };
  const texto = String(o.texto ?? "").replace(/\s+/g, " ").trim();
  if (!texto) return { ok: false, error: "Escribí qué pasó (ej.: “lanzamiento TV”)." };
  if (texto.length > MAX_TEXTO) return { ok: false, error: `Máximo ${MAX_TEXTO} caracteres.` };
  const tb = o.tablero == null || o.tablero === "" ? null : String(o.tablero).toLowerCase();
  if (tb !== null && !TABLERO_RE.test(tb)) return { ok: false, error: "Tablero inválido." };
  return { ok: true, value: { fecha, tablero: tb, texto } };
}

/** Las que aplican a un tablero: las propias + las de toda la cuenta. */
export function paraTablero(notas: Anotacion[], tablero: string | null | undefined): Anotacion[] {
  return notas.filter((n) => n.tablero == null || (tablero != null && n.tablero === tablero));
}

/** Marcas sobre un eje de fechas: agrupa las anotaciones por la clave del bucket del gráfico. */
export function marcasEnEje(notas: Anotacion[], xKeys: { key: string; label: string }[], grain: DateGrain): { key: string; label: string; textos: string[] }[] {
  const byKey = new Map(xKeys.map((x) => [x.key, x.label]));
  const out = new Map<string, { key: string; label: string; textos: string[] }>();
  for (const n of notas) {
    const t = Date.parse(`${n.fecha}T00:00:00Z`);
    if (Number.isNaN(t)) continue;
    const k = bucketKey(t, grain);
    const label = byKey.get(k);
    if (label == null) continue;
    const cur = out.get(k) ?? { key: k, label, textos: [] };
    cur.textos.push(n.texto);
    out.set(k, cur);
  }
  return [...out.values()];
}

/** Bloque de texto para el prompt del Diagnóstico IA (más recientes primero, con tope). */
export function anotacionesParaPrompt(notas: Anotacion[], max = 30): string {
  return [...notas].sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, max)
    .map((n) => `- ${n.fecha}${n.tablero ? ` [${n.tablero}]` : ""}: ${n.texto.slice(0, MAX_TEXTO)}`).join("\n");
}
