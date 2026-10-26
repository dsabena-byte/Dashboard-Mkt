import "server-only";

// Precálculos que dependen de las cargas de Trade. Se recalculan al confirmar/deshacer una carga, al final de
// la migración (trade-migrar) y en el cron trade-agg. Así el tablero lee UNA fila en la vista default:
//   tr_precalc 'cb_default' (vista de /cuadros-basicos sin filtros), fs_precomputed id=1 (vista default de
//   /floor-share, 26 semanas) y trade_monthly (Seguimiento).

import { trEstado, trInvalidarEstado, getTrCbRows, getTrCbDetalle, getTrFsRows, getTrTiendaCliente, getFsObjetivos, setTrPrecalc, trUpsert, trAll } from "./trade-db";
import { construirCruce } from "./trade-cruce";
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

  if (cbRows.length) {
    // Cruce CB × Floor Share (pestaña de /cuadros-basicos): estado actual por tienda, con SKU.
    const [det, obj, tiendas, asig] = await Promise.all([
      getTrCbDetalle(est.cb!), getFsObjetivos(),
      trAll<{ id: number; numero: string }>("tr_tiendas?select=id,numero"),
      trAll<{ tienda_id: number; promotor: string | null; supervisor: string | null }>("tr_tienda_asignacion?select=tienda_id,promotor,supervisor&hasta=is.null"),
    ]);
    const numDe = new Map(tiendas.map((t) => [t.id, t.numero]));
    const promotor = new Map<string, string>(), supervisor = new Map<string, string>();
    for (const a of asig) {
      const n = numDe.get(a.tienda_id); if (!n) continue; // shortcut: el número no es único entre cadenas; gana la primera asignación
      if (a.promotor && !promotor.has(n)) promotor.set(n, a.promotor);
      if (a.supervisor && !supervisor.has(n)) supervisor.set(n, a.supervisor);
    }
    const cruce = construirCruce(det, fsAll, { ...obj }, { cadena: new Map(), promotor, supervisor });
    await setTrPrecalc("cruce", { ...cruce, calculado: new Date().toISOString() });
    out.cruce = `${cruce.tiendas.length} tiendas`;
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
