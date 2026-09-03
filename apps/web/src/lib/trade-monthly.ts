import "server-only";

// Resultado mensual de Trade (CB + Floor Share) para el Seguimiento Objetivos.
// - computeTradeMonthlyFromCb: LENTO (pagina la tabla CB entera del proyecto CB,
//   ~26s). Solo lo usa el cron trade-agg, en background.
// - getTradeMonthly: RÁPIDO (~300ms). Lee la tabla precalculada trade_monthly del
//   proyecto PRINCIPAL. Lo usa el render del dash → nunca paga los 26s.

import { getCbRows, computeTotals, isoWeekToMes } from "./cb-queries";
import { getFloorShareRows, computeOverall } from "./floor-share-queries";
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

// LENTO — pagina las tablas CB completas y agrega por mes. Solo para el cron.
export async function computeTradeMonthlyFromCb(anio: number): Promise<TradeMonthly> {
  const [cbRows, fsRows] = await Promise.all([
    getCbRows({}).catch(() => [] as Awaited<ReturnType<typeof getCbRows>>),
    getFloorShareRows({}).catch(() => [] as Awaited<ReturnType<typeof getFloorShareRows>>),
  ]);
  const out = emptyTradeMonthly();
  MES_SHORT.forEach((short, i) => {
    const cbM = cbRows.filter((r) => isoWeekToMes(r.semana, anio) === short);
    if (cbM.length) out.cb[i] = computeTotals(cbM).cb_pct;
    const fsM = fsRows.filter((r) => isoWeekToMes(r.semana, anio) === short);
    if (fsM.length) {
      const o = computeOverall(fsM);
      out.fsGeneral[i] = generalPonderado({ Lavado: o.lavado.share, Refrigeración: o.refri.share, Cocción: o.coccion.share });
      out.fsCat.Lavado![i] = o.lavado.share; out.fsCat["Refrigeración"]![i] = o.refri.share; out.fsCat["Cocción"]![i] = o.coccion.share;
    }
  });
  return out;
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
