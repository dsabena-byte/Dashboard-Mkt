import "server-only";
import { maxUpdatedAt } from "./freshness-queries";
import { PROCS, estadoDe, type Estado, type Proc } from "./monitoreo-config";

export interface HealthRow {
  proc: Proc;
  date: string | null;
  estado: Estado;
  ageH: number | null;
}

// Estado de frescura de todos los procesos (última actualización real vs
// periodicidad esperada). No consulta GitHub Actions — eso lo aporta el watchdog.
export async function getHealth(): Promise<HealthRow[]> {
  const now = Date.now();
  const dates = await Promise.all(
    PROCS.map((p) => maxUpdatedAt(p.tabla, p.db ?? "principal", p.col ?? "updated_at", p.filter).catch(() => null)),
  );
  return PROCS.map((p, i) => {
    const date = dates[i] ?? null;
    return { proc: p, date, ...estadoDe(date, p.cadenciaH, now) };
  });
}
