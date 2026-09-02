import "server-only";

// Gaps por KPI × Categoría — vista accionable para encontrar dónde (qué KPI, qué
// categoría) estás más lejos de la meta. Expone el cálculo por categoría que el
// rollup de objetivos agrega y esconde: para cada KPI y cada categoría core
// (Lavado/Refrigeración/Cocción) devuelve real, meta y cumplimiento del mes de
// referencia y del acumulado del año (YTD), más un ranking de oportunidades.

import { getSeguimientoKpis, type KpiSeguimiento, type KpiUnit } from "./objetivos-kpis";
import { getMapaConfig } from "./mapa-server";
import { cumplimientoPct } from "./metas";
import { CATEGORIAS_CORE } from "./categorias";

export type { KpiUnit } from "./objetivos-kpis";

const MES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export interface GapCell {
  categoria: string;
  realMes: number | null;
  metaMes: number | null;
  cumplMes: number | null; // % (sin capar — >100 = sobrecumple)
  realYtd: number | null;
  metaYtd: number | null;
  cumplYtd: number | null;
}
export interface GapKpi {
  plan: string;
  kpi: string;
  medida: string;
  unit: KpiUnit;
  tipo: "sum" | "rate";
  direccion: "up" | "down";
  umbralVerde: number;
  umbralAmarillo: number;
  esGeneral: boolean; // true = mismo valor a las 3 categorías (sin desglose real)
  celdas: GapCell[]; // Lavado / Refrigeración / Cocción
  cumplMesTotal: number | null;
  cumplYtdTotal: number | null;
}
export interface GapOportunidad {
  plan: string;
  kpi: string;
  categoria: string;
  unit: KpiUnit;
  realMes: number | null;
  metaMes: number | null;
  cumplMes: number; // < 100
  gapPct: number; // negativo = por debajo de la meta
}
export interface GapData {
  disponible: boolean;
  refMes: string;
  kpis: GapKpi[];
  oportunidades: GapOportunidad[];
}

// KPIs de costo/insumo que no cuentan como "oportunidad de mejora" en el ranking.
const EXCLUIR_RANKING = new Set(["Inversión"]);

const sum = (xs: (number | null)[]) => xs.reduce((a: number, x) => a + (x ?? 0), 0);
const avg = (xs: (number | null)[]) => {
  const d = xs.filter((x): x is number => x != null);
  return d.length ? d.reduce((a, b) => a + b, 0) / d.length : null;
};

export async function getGapKpiCategoria(anio: number): Promise<GapData> {
  const now = new Date();
  const currentMonth = now.getUTCFullYear() > anio ? 13 : now.getUTCFullYear() < anio ? 1 : now.getUTCMonth() + 1;
  const refIdx = Math.max(0, Math.min(11, currentMonth - 2)); // último mes cerrado (0-based)
  const refMes = MES[refIdx] ?? "";

  const [kpis, mapa] = await Promise.all([getSeguimientoKpis(anio), getMapaConfig()]);

  const mixByKpi = new Map<string, Record<string, number>>();
  if (mapa) for (const p of mapa.planes) for (const k of p.kpis) if (k.mix) mixByKpi.set(k.nombre, k.mix);

  // ¿el KPI discrimina por categoría? (tiene meta propia por cat, o es SUM con mix + real por cat)
  const discrimina = (k: KpiSeguimiento): boolean =>
    !!k.metaCatM || (k.tipo === "sum" && mixByKpi.has(k.kpi) && !!k.realCatM);

  // real y meta de un KPI en una categoría, mes m.
  const catRealMeta = (k: KpiSeguimiento, cat: string, m: number): { real: number | null; meta: number | null } => {
    if (k.metaCatM) {
      // Meta propia por categoría (Floor Share): real por cat directo, sin Brand.
      return { real: k.realCatM?.[cat]?.[m] ?? null, meta: k.metaCatM[cat]?.[m] ?? null };
    }
    const mix = mixByKpi.get(k.kpi);
    if (k.tipo === "sum" && mix && k.realCatM) {
      const metaTot = k.metaM[m] ?? null;
      const catMix = (mix[cat] ?? 0) + (mix["Brand"] ?? 0);
      const meta = metaTot == null ? null : metaTot * (catMix / 100);
      const real = (k.realCatM[cat]?.[m] ?? 0) + (k.realCatM["Brand"]?.[m] ?? 0);
      return { real, meta };
    }
    // General: mismo valor total a las 3 categorías.
    return { real: k.realM[m] ?? null, meta: k.metaM[m] ?? null };
  };

  const gapKpis: GapKpi[] = kpis.map((k) => {
    const esGeneral = !discrimina(k);
    const celdas: GapCell[] = CATEGORIAS_CORE.map((cat) => {
      const rm = catRealMeta(k, cat, refIdx);
      const cumplMes = cumplimientoPct(rm.real, rm.meta, k.direccion);
      // YTD por categoría (0..refIdx).
      const realsCat: (number | null)[] = [];
      const metasCat: (number | null)[] = [];
      for (let m = 0; m <= refIdx; m++) {
        const x = catRealMeta(k, cat, m);
        realsCat.push(x.real);
        metasCat.push(x.meta);
      }
      const realYtd = k.tipo === "sum" ? sum(realsCat) : avg(realsCat);
      const metaYtd = k.tipo === "sum" ? sum(metasCat) : avg(metasCat);
      const cumplYtd = cumplimientoPct(realYtd, metaYtd, k.direccion);
      return { categoria: cat, realMes: rm.real, metaMes: rm.meta, cumplMes, realYtd, metaYtd, cumplYtd };
    });
    // Totales de referencia.
    const cumplMesTotal = cumplimientoPct(k.realM[refIdx] ?? null, k.metaM[refIdx] ?? null, k.direccion);
    const realYtdT = k.tipo === "sum" ? sum(k.realM.slice(0, refIdx + 1)) : avg(k.realM.slice(0, refIdx + 1));
    const metaYtdT = k.tipo === "sum" ? sum(k.metaM.slice(0, refIdx + 1)) : avg(k.metaM.slice(0, refIdx + 1));
    const cumplYtdTotal = cumplimientoPct(realYtdT, metaYtdT, k.direccion);
    return {
      plan: k.plan, kpi: k.kpi, medida: k.medida, unit: k.unit, tipo: k.tipo, direccion: k.direccion,
      umbralVerde: k.umbralVerde, umbralAmarillo: k.umbralAmarillo, esGeneral, celdas, cumplMesTotal, cumplYtdTotal,
    };
  });

  // Ranking de oportunidades: celdas KPI×categoría por debajo de la meta (cumpl < 100),
  // peor primero. Para KPIs generales toma una sola vez (las 3 son iguales).
  const oportunidades: GapOportunidad[] = [];
  for (const gk of gapKpis) {
    if (EXCLUIR_RANKING.has(gk.kpi)) continue;
    const celdas = gk.esGeneral ? gk.celdas.slice(0, 1) : gk.celdas;
    for (const c of celdas) {
      if (c.cumplMes == null || c.cumplMes >= 100) continue;
      oportunidades.push({
        plan: gk.plan, kpi: gk.kpi, categoria: gk.esGeneral ? "General" : c.categoria, unit: gk.unit,
        realMes: c.realMes, metaMes: c.metaMes, cumplMes: c.cumplMes, gapPct: c.cumplMes - 100,
      });
    }
  }
  oportunidades.sort((a, b) => a.gapPct - b.gapPct);

  return { disponible: gapKpis.length > 0, refMes, kpis: gapKpis, oportunidades };
}
