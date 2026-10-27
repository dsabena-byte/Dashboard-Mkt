import "server-only";

// Precálculos que dependen de las cargas de Trade. Se recalculan al confirmar/deshacer una carga, al final de
// la migración (trade-migrar) y en el cron trade-agg. Así el tablero lee UNA fila en la vista default:
//   tr_precalc 'cb_default' (vista de /cuadros-basicos sin filtros), fs_precomputed id=1 (vista default de
//   /floor-share, 26 semanas) y trade_monthly (Seguimiento).

import { trEstado, trInvalidarEstado, getTrCbRows, getTrFsRows, getTrTiendaCliente, setTrPrecalc, trUpsert } from "./trade-db";
import { computeCbView } from "./cb-view";
import { computeFsView, type FsEnrichedRow } from "./fs-view";
import { tradeMonthlyDeFilas } from "./trade-monthly";

export async function refrescarDerivados(): Promise<Record<string, string>> {
  trInvalidarEstado();
  const est = await trEstado();
  const out: Record<string, string> = {};
  const anio = est.cb ?? est.fs;
  if (anio == null) return { estado: "sin datos en tr_*" };

  const [cbRows, fsAll, cliente] = await Promise.all([
    est.cb != null ? getTrCbRows(est.cb) : Promise.resolve([]),
    est.fs != null ? getTrFsRows(est.fs, []) : Promise.resolve([]),
    getTrTiendaCliente().catch(() => new Map<string, string>()),
  ]);

  if (cbRows.length) {
    await setTrPrecalc("cb_default", computeCbView(cbRows, {}));
    out.cb_default = `${cbRows.length} filas agregadas`;
  }

  if (fsAll.length) {
    const semanas = [...new Set(fsAll.map((r) => r.semana))].sort((a, b) => b - a).slice(0, 26);
    const def = new Set(semanas);
    const enriched: FsEnrichedRow[] = fsAll
      .filter((r) => r.marca != null && r.categoria != null && r.numero_tienda != null && def.has(r.semana))
      .map((r) => ({ ...r, cliente: cliente.get(r.numero_tienda) ?? "Sin cliente" }));
    await trUpsert("fs_precomputed", [{ id: 1, data: computeFsView(enriched, {}), updated_at: new Date().toISOString() }], "id");
    out.fs_default = `${enriched.length} filas, semanas ${Math.min(...semanas)}–${Math.max(...semanas)}`;
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
