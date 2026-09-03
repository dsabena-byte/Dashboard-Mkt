import "server-only";

// Seguimiento POR CATEGORÍA — misma info que el tab "Estado de KPIs" (cards de
// objetivos + scorecard de KPIs), pero calculada para cada categoría core
// (Lavado / Refrigeración / Cocción). Se precomputan las 3 en una sola pasada
// (getSeguimientoKpis corre una vez) y el selector cliente cambia al instante.

import { getSeguimientoKpis, kpiTimings, type KpiSeguimiento } from "./objetivos-kpis";
import { getMapaConfig } from "./mapa-server";
import { cumplimientoPct } from "./metas";
import { CATEGORIAS_CORE } from "./categorias";
import { getObjetivoMetas, getSeguimientoObjetivos, makeCatRealMeta, ponderado, type ObjetivoRollup, type SeguimientoObjetivos } from "./objetivos-rollup";

const MES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const cap = (v: number | null): number | null => (v == null ? null : Math.min(v, 100));
const sum = (xs: (number | null)[]) => xs.reduce((a: number, x) => a + (x ?? 0), 0);
const avg = (xs: (number | null)[]) => { const d = xs.filter((x): x is number => x != null); return d.length ? d.reduce((a, b) => a + b, 0) / d.length : null; };

export interface CategoriaSeguimiento {
  categoria: string;
  seg: SeguimientoObjetivos; // objetivos + salud de marca, para esta categoría
  kpis: KpiSeguimiento[]; // KPIs con real/meta de esta categoría (para el scorecard)
}
export interface SeguimientoPorCategoria {
  disponible: boolean;
  refMes: string;
  categorias: CategoriaSeguimiento[];
}

export async function getSeguimientoPorCategoria(anio: number): Promise<SeguimientoPorCategoria> {
  const now = new Date();
  const currentMonth = now.getUTCFullYear() > anio ? 13 : now.getUTCFullYear() < anio ? 1 : now.getUTCMonth() + 1;
  const refIdx = Math.max(0, Math.min(11, currentMonth - 2));
  const refMes = MES[refIdx] ?? "";

  const [kpis, mapa, objMetas] = await Promise.all([getSeguimientoKpis(anio), getMapaConfig(), getObjetivoMetas(anio)]);
  if (!mapa || mapa.objetivos.length === 0) return { disponible: false, refMes, categorias: [] };

  const catRM = makeCatRealMeta(kpis, mapa);
  const pT = mapa.objetivos.reduce((a, o) => a + (o.peso || 0), 0) || 1;
  // KPIs conectados a algún objetivo (para el scorecard, como en "Estado de KPIs").
  const mapeados = new Set<string>();
  for (const p of mapa.planes) for (const k of p.kpis) if (Object.values(k.vinculos ?? {}).some((w) => w > 0)) mapeados.add(k.nombre);

  const categorias: CategoriaSeguimiento[] = CATEGORIAS_CORE.map((cat) => {
    // Serie real/meta de cada KPI para esta categoría.
    const kpisCat: KpiSeguimiento[] = kpis.map((k) => {
      const realM: (number | null)[] = [];
      const metaM: (number | null)[] = [];
      for (let m = 0; m < 12; m++) { const rm = catRM(k.kpi, cat, m); realM.push(rm.real); metaM.push(rm.meta); }
      return {
        plan: k.plan, kpi: k.kpi, medida: k.medida, unit: k.unit, tipo: k.tipo, realM, metaM,
        direccion: k.direccion, umbralVerde: k.umbralVerde, umbralAmarillo: k.umbralAmarillo,
      };
    });

    // Cumplimiento de cada KPI en la categoría (idéntico al rollup pero sobre la serie por cat).
    const kpiCumpl = new Map<string, { mes: number | null; ytd: number | null; serie: (number | null)[] }>();
    for (const k of kpisCat) {
      let ri = -1;
      for (let i = 11; i >= 0; i--) { if (k.realM[i] != null) { ri = i; break; } }
      const realMes = ri >= 0 ? k.realM[ri]! : null;
      const metaMes = ri >= 0 ? (k.metaM[ri] ?? null) : null;
      const upto = ri >= 0 ? ri : 11;
      const isSum = k.tipo === "sum";
      const realYtd = isSum ? sum(k.realM.slice(0, upto + 1)) : avg(k.realM.slice(0, upto + 1));
      const metaYtd = isSum ? sum(k.metaM.slice(0, upto + 1)) : avg(k.metaM.slice(0, upto + 1));
      const serie = k.realM.map((r, i) => cap(cumplimientoPct(r, k.metaM[i] ?? null, k.direccion)));
      kpiCumpl.set(k.kpi, {
        mes: cap(cumplimientoPct(realMes, metaMes, k.direccion)),
        ytd: cap(cumplimientoPct(realYtd, metaYtd, k.direccion)),
        serie,
      });
    }

    const objetivos: ObjetivoRollup[] = mapa.objetivos.map((o) => {
      const conex: Array<{ kpi: string; peso: number; cumplMes: number | null; cumplYtd: number | null; serie: (number | null)[] }> = [];
      for (const p of mapa.planes) for (const k of p.kpis) {
        const peso = k.vinculos?.[o.id] ?? 0;
        if (peso <= 0) continue;
        const c = kpiCumpl.get(k.nombre);
        conex.push({ kpi: k.nombre, peso, cumplMes: c?.mes ?? null, cumplYtd: c?.ytd ?? null, serie: c?.serie ?? Array.from({ length: 12 }, () => null) });
      }
      const rMes = ponderado(conex.map((c) => ({ w: c.peso, c: c.cumplMes })));
      const rYtd = ponderado(conex.map((c) => ({ w: c.peso, c: c.cumplYtd })));
      const cumplSerie = Array.from({ length: 12 }, (_, m) => ponderado(conex.map((c) => ({ w: c.peso, c: c.serie[m] ?? null }))).val);
      conex.sort((a, b) => b.peso - a.peso);
      return {
        id: o.id, nombre: o.nombre, color: o.color,
        pesoEstrategico: Math.round(((o.peso || 0) / pT) * 100),
        cumplMes: rMes.val, cumplYtd: rYtd.val, cobertura: rMes.cobertura,
        metaNegMes: objMetas[o.nombre]?.[cat]?.[refIdx] ?? null, // meta de negocio de ESTA categoría
        cumplSerie, porCategoria: [], // ya estamos en una categoría → sin sub-desglose
        aportes: conex.map((c) => ({ kpi: c.kpi, peso: c.peso, cumpl: c.cumplMes })),
      };
    });

    const smMes = ponderado(objetivos.map((o) => ({ w: o.pesoEstrategico, c: o.cumplMes })));
    const smYtd = ponderado(objetivos.map((o) => ({ w: o.pesoEstrategico, c: o.cumplYtd })));
    const smMetaNeg = ponderado(objetivos.map((o) => ({ w: o.pesoEstrategico, c: o.metaNegMes }))).val;
    const smSerie = Array.from({ length: 12 }, (_, m) => ponderado(objetivos.map((o) => ({ w: o.pesoEstrategico, c: o.cumplSerie[m] ?? null }))).val);
    const seg: SeguimientoObjetivos = {
      disponible: true, refMes, waveKantar: null, objetivos,
      saludMarca: { cumplMes: smMes.val, cumplYtd: smYtd.val, metaNegMes: smMetaNeg, cumplSerie: smSerie, porCategoria: [] },
    };
    return { categoria: cat, seg, kpis: kpisCat.filter((k) => mapeados.has(k.kpi)) };
  });

  return { disponible: true, refMes, categorias };
}

// ===== Vista combinada: General + las 3 categorías, en UNA sola pasada =====
// getSeguimientoKpis está memoizado por request (React cache) → aunque lo llamen
// getSeguimientoObjetivos y getSeguimientoPorCategoria, la parte pesada corre una vez.
// El cliente cambia entre General/Lavado/Refri/Cocción al instante (sin recargar).
export interface VistaSeguimiento {
  key: string;
  label: string;
  seg: SeguimientoObjetivos;
  kpis: KpiSeguimiento[];
}
export interface SeguimientoCompleto {
  disponible: boolean;
  refMes: string;
  vistas: VistaSeguimiento[];
  debug?: { kpisMs: number; restMs: number; totalMs: number; breakdown?: Record<string, number> };
}

export async function getSeguimientoCompleto(anio: number): Promise<SeguimientoCompleto> {
  const t0 = Date.now();
  // 1) La parte pesada: fetch + cómputo de KPIs (memoizado por request).
  await getSeguimientoKpis(anio);
  const kpisMs = Date.now() - t0;
  // 2) El resto (rollups) reusa el cache de KPIs → mide solo su costo propio.
  const t1 = Date.now();
  const [kpis, general, porCat] = await Promise.all([
    getSeguimientoKpis(anio),
    getSeguimientoObjetivos(anio),
    getSeguimientoPorCategoria(anio),
  ]);
  const restMs = Date.now() - t1;
  // KPIs del scorecard General = solo los conectados a algún objetivo (como en "Estado").
  const mapeados = new Set(general.objetivos.flatMap((o) => o.aportes.map((a) => a.kpi)));
  const kpisGeneral = general.disponible && mapeados.size > 0 ? kpis.filter((k) => mapeados.has(k.kpi)) : kpis;
  const vistas: VistaSeguimiento[] = [
    { key: "general", label: "General", seg: general, kpis: kpisGeneral },
    ...porCat.categorias.map((c) => ({ key: c.categoria, label: c.categoria, seg: c.seg, kpis: c.kpis })),
  ];
  return {
    disponible: general.disponible,
    refMes: general.refMes || porCat.refMes,
    vistas,
    debug: { kpisMs, restMs, totalMs: Date.now() - t0, breakdown: { ...kpiTimings } },
  };
}
