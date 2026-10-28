import "server-only";

// Precálculos que dependen de las cargas de Trade. Se recalculan al confirmar/deshacer una carga, al final de
// la migración (trade-migrar) y en el cron trade-agg. Así el tablero lee UNA fila en la vista default:
//   tr_precalc 'cb_default' (vista de /cuadros-basicos sin filtros), fs_precomputed id=1 (vista default de
//   /floor-share, semanas del año) y trade_monthly (Seguimiento).

import { trEstado, trInvalidarEstado, getTrCbRows, getTrFsRows, setTrPrecalc, trUpsert, trRest } from "./trade-db";
import { computeCbView } from "./cb-view";
import { computeFsView, fsVistasPorPeriodo } from "./fs-view";
import { enriquecerFs, enriquecerCb } from "./cb-mirror";
import { tradeMonthlyDeFilas } from "./trade-monthly";

export async function refrescarDerivados(): Promise<Record<string, string>> {
  trInvalidarEstado();
  const est = await trEstado();
  const out: Record<string, string> = {};
  const anio = est.cb ?? est.fs;
  if (anio == null) return { estado: "sin datos en tr_*" };

  const [cbRows, fsAll] = await Promise.all([
    est.cb != null ? getTrCbRows(est.cb) : Promise.resolve([]),
    est.fs != null ? getTrFsRows(est.fs, []) : Promise.resolve([]),
  ]);

  if (cbRows.length) {
    await setTrPrecalc("cb_default", computeCbView(await enriquecerCb(cbRows), {}));
    out.cb_default = `${cbRows.length} filas agregadas`;
  }

  if (fsAll.length) {
    // Vista default = todas las semanas del año (= app vieja), con cliente/promotor/supervisor.
    const enriched = await enriquecerFs(fsAll);
    const view = computeFsView(enriched, {});
    await trUpsert("fs_precomputed", [{ id: 1, data: view, updated_at: new Date().toISOString() }], "id");
    out.fs_default = `${enriched.length} filas, semanas ${view.semanaDesde}–${view.semanaHasta}`;
    // Una vista por MES (id 1000+mes) y por SEMANA (id 2000+semana): elegir un mes o una semana en /floor-share = leer UNA fila.
    const porPeriodo = fsVistasPorPeriodo(enriched, view);
    const ahora = new Date().toISOString();
    for (let i = 0; i < porPeriodo.length; i += 4) await trUpsert("fs_precomputed", porPeriodo.slice(i, i + 4).map((p) => ({ ...p, updated_at: ahora })), "id");
    await trRest(`fs_precomputed?id=gt.1&id=not.in.(${porPeriodo.map((p) => p.id).join(",") || 0})`, { method: "DELETE" });
    out.fs_periodos = `${porPeriodo.length} vistas (meses y semanas)`;
  }

  const t = tradeMonthlyDeFilas(cbRows, fsAll, anio);
  const now = new Date().toISOString();
  await trUpsert("trade_monthly", Array.from({ length: 12 }, (_, i) => ({
    anio, mes: i + 1, cb_pct: t.cb[i], fs_general: t.fsGeneral[i],
    fs_lavado: t.fsCat.Lavado?.[i] ?? null, fs_refri: t.fsCat["Refrigeración"]?.[i] ?? null, fs_coccion: t.fsCat["Cocción"]?.[i] ?? null,
    updated_at: now,
  })), "anio,mes");
  out.trade_monthly = `${anio} OK`;
  return out;
}
