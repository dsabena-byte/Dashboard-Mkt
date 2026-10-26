import "server-only";

// Resultado mensual de Trade (CB + Floor Share) para el Seguimiento Objetivos.
// - computeTradeMonthlyFromCb: LENTO (lee CB + FS del año). Solo cron trade-agg y cargas de Trade.
// - getTradeMonthly: RÁPIDO (~300ms). Lee la tabla precalculada trade_monthly del
//   proyecto PRINCIPAL. Lo usa el render del dash → nunca paga los 26s.

import { getCbRows, computeTotals, isoWeekToMes, type CbRow } from "./cb-queries";
import { getFloorShareRows, computeOverall, type FloorShareRow } from "./floor-share-queries";
import { trEstado, getTrCbRows, getTrFsRows } from "./trade-db";
import { generalPonderado } from "./categorias";

const MES_SHORT = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export interface TradeMonthly {
  cb: (number | null)[]; // 12 — % Cumplimiento CB (total)
  fsGeneral: (number | null)[]; // 12 — Floor Share Drean ponderado
  fsCat: Record<string, (number | null)[]>; // Lavado / Refrigeración / Cocción
}

export function emptyTradeMonthly(): TradeMonthly {
  return {
    cb: Array(12).fill(null),
    fsGeneral: Array(12).fill(null),
    fsCat: { Lavado: Array(12).fill(null), Refrigeración: Array(12).fill(null), Cocción: Array(12).fill(null) },
  };
}

// Agrega por mes (puro). Solo filas SEMANALES de FS (las cargas mensuales viejas, semana null, caían en "Dic").
export function tradeMonthlyDeFilas(cbRows: CbRow[], fsRows: FloorShareRow[], anio: number): TradeMonthly {
  const out = emptyTradeMonthly();
  MES_SHORT.forEach((short, i) => {
    const cbM = cbRows.filter((r) => isoWeekToMes(r.semana, anio) === short);
    if (cbM.length) out.cb[i] = computeTotals(cbM).cb_pct;
    const fsM = fsRows.filter((r) => r.semana != null && isoWeekToMes(r.semana, anio) === short);
    if (fsM.length) {
      const o = computeOverall(fsM);
      out.fsGeneral[i] = generalPonderado({ Lavado: o.lavado.share, Refrigeración: o.refri.share, Cocción: o.coccion.share });
      out.fsCat.Lavado![i] = o.lavado.share; out.fsCat["Refrigeración"]![i] = o.refri.share; out.fsCat["Cocción"]![i] = o.coccion.share;
    }
  });
  return out;
}

// LENTO — solo cron/cargas. Lee las tablas tr_* del principal (0138) y, si están vacías, el proyecto CB.
export async function computeTradeMonthlyFromCb(anio: number): Promise<TradeMonthly> {
  const est = await trEstado();
  if (est.cb != null) {
    const [cbRows, fsRows] = await Promise.all([getTrCbRows(anio), est.fs != null ? getTrFsRows(anio, []) : Promise.resolve([])]);
    return tradeMonthlyDeFilas(cbRows, fsRows, anio);
  }
  const [cbRows, fsRows] = await Promise.all([
    getCbRows({}).catch(() => [] as CbRow[]),
    getFloorShareRows({}).catch(() => [] as FloorShareRow[]),
  ]);
  return tradeMonthlyDeFilas(cbRows, fsRows, anio);
}

// RÁPIDO — lee la tabla precalculada del proyecto principal. Para el render.
export async function getTradeMonthly(anio: number): Promise<TradeMonthly> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const out = emptyTradeMonthly();
  if (!url || !key) return out;
  try {
    const res = await fetch(
      `${url}/rest/v1/trade_monthly?anio=eq.${anio}&select=mes,cb_pct,fs_general,fs_lavado,fs_refri,fs_coccion`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "no-store" },
    );
    if (!res.ok) return out;
    const rows = (await res.json()) as Array<{ mes: number; cb_pct: number | null; fs_general: number | null; fs_lavado: number | null; fs_refri: number | null; fs_coccion: number | null }>;
    for (const r of rows) {
      const i = r.mes - 1;
      if (i < 0 || i > 11) continue;
      out.cb[i] = r.cb_pct;
      out.fsGeneral[i] = r.fs_general;
      out.fsCat.Lavado![i] = r.fs_lavado;
      out.fsCat["Refrigeración"]![i] = r.fs_refri;
      out.fsCat["Cocción"]![i] = r.fs_coccion;
    }
  } catch {
    /* devuelve nulls */
  }
  return out;
}
