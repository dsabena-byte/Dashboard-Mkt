// Puro y client-safe (test: scripts/fs-mes.test.ts).

/** Mes calendario de una semana ISO (el del LUNES, = isoWeekToMes) como "YYYY-MM". La semana 1 de 2026 empieza el
 *  29-dic-2025 → "2025-12" (antes se rotulaba "Diciembre 2026"). Año = el de `periodo` ("2026-W01"). */
export function mesKeySemana(periodo: string | null | undefined, semana: number): string {
  const anio = Number(String(periodo ?? "").slice(0, 4)) || new Date().getUTCFullYear();
  const jan4 = new Date(Date.UTC(anio, 0, 4));
  const lunes = new Date(Date.UTC(anio, 0, 4 - (jan4.getUTCDay() || 7) + 1 + (semana - 1) * 7));
  return `${lunes.getUTCFullYear()}-${String(lunes.getUTCMonth() + 1).padStart(2, "0")}`;
}
