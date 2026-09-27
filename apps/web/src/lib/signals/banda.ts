// Rango esperado para las reglas de VARIACIÓN del motor de señales (portado de BIP, sep-2026; QW2 de
// docs/estado-del-arte/objetivos-inteligencia.md). Una variación grande que cae DENTRO del rango
// normal de la propia serie (pronóstico a 1 paso ± 1,96σ de los errores históricos) no dispara
// alerta: evita falsos positivos en series naturalmente volátiles. Con menos de 6 meses (o menos
// de 4 errores medibles) no hay banda → la regla sigue con su umbral fijo de siempre.
// Puro, imports relativos (lo compilan tests con tsc sin alias).
import { evaluarContraBanda, type EvalBanda } from "../stats/forecast";

export type { EvalBanda };

/** Evalúa `actual` contra la historia previa (meses consecutivos, sin el mes evaluado). */
export function rangoEsperado(hist: (number | null)[], actual: number): EvalBanda | null {
  return evaluarContraBanda(hist, actual);
}

/**
 * ¿Hay que SILENCIAR la señal? true solo si hay banda y el valor cae dentro del rango normal.
 * Sin banda (dato insuficiente) → false: decide el umbral fijo de la regla.
 */
export function dentroDeLoNormal(ev: EvalBanda | null): boolean {
  return !!ev && ev.dentro;
}

/** Datos compactos del rango para `Signal.datos` (payload para la IA / UI). */
export function datosRango(ev: EvalBanda | null): { esperado: number; min: number; max: number } | undefined {
  if (!ev) return undefined;
  const r = (v: number) => Math.round(v * 100) / 100;
  return { esperado: r(ev.esperado), min: r(ev.lo), max: r(ev.hi) };
}
