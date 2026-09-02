import "server-only";

// Fase 3 — Rollup del Mapa Estratégico:
//   cumplimiento(KPI)      = min( real/meta , 100% )   (según dirección)
//   cumplimiento(objetivo) = Σ aporteKPI × cumpl(KPI) / Σ aporteKPI  (solo KPIs con dato)
//   Salud de Marca         = Σ pesoEstratégico × cumpl(objetivo)     (normalizado)
// El "aporte" es el peso inbound del Mapa (suma 100% por objetivo). Se renormaliza
// sobre los KPIs con dato → `cobertura` dice qué fracción del objetivo está instrumentada.
// La META de negocio del objetivo = Σ (meta por categoría × peso categoría) [mix nov-25].
//
// Desglose POR CATEGORÍA (reemplaza la capa Kantar): cada KPI tiene un mix por categoría
// (Brand/Lav/Refri/Cocc) definido en el Mapa. La meta por categoría de un KPI SUM =
// metaTotal × (mix[cat] + mix[Brand]); el real por categoría sale de `realCatM`. Para KPIs
// de tasa la meta es igual en las 3 categorías y el real es el genuino por categoría.
//   cumpl(objetivo, cat) = Σ peso × cumpl(KPI, cat)
//   resultado(objetivo, cat) = meta(objetivo, cat) × cumpl(objetivo, cat) / 100
// Así, si se cumplen los KPIs al 100% en una categoría, el resultado iguala la meta.

import { getSeguimientoKpis, type KpiSeguimiento } from "./objetivos-kpis";
import { getMapaConfig } from "./mapa-server";
import { cumplimientoPct } from "./metas";
import { CATEGORIAS_CORE, generalPonderado } from "./categorias";

const CAP = 100;
const MES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
// Objetivo (nombre) → dimensión de marca (para agregar la Salud de Marca = 0.25·Σ dims).
function dimKey(nombre: string): "tom" | "som" | "int" | "poder" | null {
  const n = nombre.toLowerCase();
  if (n.includes("tom") || n.includes("top of mind")) return "tom";
  if (n.includes("som") || n.includes("share of mind")) return "som";
  if (n.includes("inten")) return "int";
  if (n.includes("poder")) return "poder";
  return null;
}

export interface ObjAporte { kpi: string; peso: number; cumpl: number | null }
// Desglose por categoría: resultado (derivado del cumplimiento de KPIs) vs meta.
export interface CatDesglose { categoria: string; resultado: number | null; meta: number | null }
export interface ObjetivoRollup {
  id: string;
  nombre: string;
  color: string;
  pesoEstrategico: number; // % (normalizado a 100)
  cumplMes: number | null; // % de cumplimiento (rollup de KPIs), mes de referencia
  cumplYtd: number | null;
  cobertura: number; // % del peso del objetivo que tiene KPI con dato
  metaNegMes: number | null; // meta de negocio (General = Σ cat × peso) del mes ref
  cumplSerie: (number | null)[]; // cumplimiento por mes (12) — para el chart de evolución
  porCategoria: CatDesglose[]; // Kantar resultado vs meta, por categoría (Lav/Refri/Cocc)
  aportes: ObjAporte[];
}
export interface SeguimientoObjetivos {
  disponible: boolean; // false = no hay Mapa guardado en la DB
  refMes: string;
  waveKantar: string | null; // ola Kantar del resultado por categoría (ej. "nov-25")
  objetivos: ObjetivoRollup[];
  saludMarca: { cumplMes: number | null; cumplYtd: number | null; metaNegMes: number | null; cumplSerie: (number | null)[]; porCategoria: CatDesglose[] };
}

const cap = (v: number | null): number | null => (v == null ? null : Math.min(v, CAP));

// Media ponderada, ignorando los aportes sin dato. Devuelve {val, cobertura}.
function ponderado(pares: Array<{ w: number; c: number | null }>): { val: number | null; cobertura: number } {
  let sumW = 0, sumWC = 0, sumWData = 0;
  for (const { w, c } of pares) {
    sumW += w;
    if (c != null) { sumWC += w * c; sumWData += w; }
  }
  return {
    val: sumWData > 0 ? sumWC / sumWData : null,
    cobertura: sumW > 0 ? (sumWData / sumW) * 100 : 0,
  };
}

async function getObjetivoMetas(anio: number): Promise<Record<string, Record<string, (number | null)[]>>> {
  // { objetivoNombre: { categoria: [12 valores] } }
  const out: Record<string, Record<string, (number | null)[]>> = {};
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return out;
  try {
    const q = `kpi_meta_valores?plan=eq.${encodeURIComponent("Objetivos Estratégicos")}&anio=eq.${anio}&select=kpi,categoria,mes,valor`;
    const res = await fetch(`${url}/rest/v1/${q}`, { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "no-store" });
    if (!res.ok) return out;
    for (const r of (await res.json()) as Array<{ kpi: string; categoria: string; mes: number; valor: number | null }>) {
      if (r.valor == null) continue;
      const byCat = out[r.kpi] ?? (out[r.kpi] = {});
      const arr = byCat[r.categoria] ?? (byCat[r.categoria] = Array.from({ length: 12 }, () => null));
      const m = Number(r.mes);
      if (m >= 1 && m <= 12) arr[m - 1] = Number(r.valor);
    }
  } catch { /* vacío */ }
  return out;
}

// Meta de negocio General (Σ categoría × peso) de un objetivo en un mes (índice 0-11).
function metaGeneral(byCat: Record<string, (number | null)[]> | undefined, mesIdx: number): number | null {
  if (!byCat) return null;
  return generalPonderado(Object.fromEntries(Object.entries(byCat).map(([cat, arr]) => [cat, arr[mesIdx] ?? null])));
}

export async function getSeguimientoObjetivos(anio: number): Promise<SeguimientoObjetivos> {
  const now = new Date();
  const currentMonth = now.getUTCFullYear() > anio ? 13 : now.getUTCFullYear() < anio ? 1 : now.getUTCMonth() + 1;
  const refIdx = Math.max(0, Math.min(11, currentMonth - 2)); // último mes cerrado (0-based)
  const refMes = MES[refIdx] ?? "";

  const [kpis, mapa, objMetas] = await Promise.all([
    getSeguimientoKpis(anio),
    getMapaConfig(),
    getObjetivoMetas(anio),
  ]);

  const empty: SeguimientoObjetivos = { disponible: false, refMes, waveKantar: null, objetivos: [], saludMarca: { cumplMes: null, cumplYtd: null, metaNegMes: null, cumplSerie: [], porCategoria: [] } };
  if (!mapa || mapa.objetivos.length === 0) return empty;

  // Lookup de KPI (serie real + real por categoría) y del mix por categoría (del Mapa).
  const kpiByName = new Map<string, KpiSeguimiento>(kpis.map((k) => [k.kpi, k]));
  const mixByKpi = new Map<string, Record<string, number>>();
  for (const p of mapa.planes) for (const k of p.kpis) if (k.mix) mixByKpi.set(k.nombre, k.mix);

  // Cumplimiento de un KPI EN UNA CATEGORÍA (mes mesIdx), capado a 100%.
  // SUM: meta_cat = metaTotal × (mix[cat] + mix[Brand]); real_cat = realCatM[cat] + realCatM[Brand].
  // Rate: meta igual en las 3 cats; real = realCatM[cat] genuino (o total si el KPI no se desglosa).
  const cumplKpiCat = (kName: string, cat: string, mesIdx: number): number | null => {
    const k = kpiByName.get(kName);
    if (!k) return null;
    const metaTot = k.metaM[mesIdx] ?? null;
    if (metaTot == null) return null;
    if (k.tipo === "sum") {
      const mix = mixByKpi.get(kName);
      const rc = k.realCatM;
      if (!mix || !rc) return cap(cumplimientoPct(k.realM[mesIdx] ?? null, metaTot, k.direccion));
      const brandMix = mix["Brand"] ?? 0;
      const catMix = (mix[cat] ?? 0) + brandMix;
      const metaCat = metaTot * (catMix / 100);
      if (metaCat <= 0) return null;
      const realCat = (rc[cat]?.[mesIdx] ?? 0) + (rc["Brand"]?.[mesIdx] ?? 0);
      return cap(cumplimientoPct(realCat, metaCat, k.direccion));
    }
    const realCat = k.realCatM?.[cat]?.[mesIdx] ?? k.realM[mesIdx] ?? null;
    return cap(cumplimientoPct(realCat, metaTot, k.direccion));
  };

  // Cumplimiento de cada KPI (mes ref = su último mes con dato; capado a 100%).
  const kpiCumpl = new Map<string, { mes: number | null; ytd: number | null; serie: (number | null)[] }>();
  const sum = (xs: (number | null)[]) => xs.reduce((a: number, x) => a + (x ?? 0), 0);
  const avg = (xs: (number | null)[]) => { const d = xs.filter((x): x is number => x != null); return d.length ? d.reduce((a, b) => a + b, 0) / d.length : null; };
  for (const k of kpis) {
    let ri = -1;
    for (let i = 11; i >= 0; i--) { if (k.realM[i] != null) { ri = i; break; } }
    const realMes = ri >= 0 ? k.realM[ri]! : null;
    const metaMes = ri >= 0 ? (k.metaM[ri] ?? null) : null;
    const upto = ri >= 0 ? ri : 11;
    const isSum = k.tipo === "sum";
    const realYtd = isSum ? sum(k.realM.slice(0, upto + 1)) : avg(k.realM.slice(0, upto + 1));
    const metaYtd = isSum ? sum(k.metaM.slice(0, upto + 1)) : avg(k.metaM.slice(0, upto + 1));
    const serie = k.realM.map((r, i) => cap(cumplimientoPct(r, k.metaM[i] ?? null, k.direccion))); // cumpl por mes
    kpiCumpl.set(k.kpi, {
      mes: cap(cumplimientoPct(realMes, metaMes, k.direccion)),
      ytd: cap(cumplimientoPct(realYtd, metaYtd, k.direccion)),
      serie,
    });
  }

  // Peso estratégico normalizado a 100.
  const pT = mapa.objetivos.reduce((a, o) => a + (o.peso || 0), 0) || 1;

  const objetivos: ObjetivoRollup[] = mapa.objetivos.map((o) => {
    // KPIs conectados a este objetivo con su aporte inbound.
    const conexiones: Array<{ kpi: string; peso: number; cumplMes: number | null; cumplYtd: number | null; serie: (number | null)[] }> = [];
    for (const p of mapa.planes) {
      for (const k of p.kpis) {
        const peso = k.vinculos?.[o.id] ?? 0;
        if (peso <= 0) continue;
        const c = kpiCumpl.get(k.nombre);
        conexiones.push({ kpi: k.nombre, peso, cumplMes: c?.mes ?? null, cumplYtd: c?.ytd ?? null, serie: c?.serie ?? Array.from({ length: 12 }, () => null) });
      }
    }
    const rMes = ponderado(conexiones.map((c) => ({ w: c.peso, c: c.cumplMes })));
    const rYtd = ponderado(conexiones.map((c) => ({ w: c.peso, c: c.cumplYtd })));
    // Cumplimiento por mes = ponderado del cumplimiento de los KPIs en ese mes.
    const cumplSerie = Array.from({ length: 12 }, (_, m) => ponderado(conexiones.map((c) => ({ w: c.peso, c: c.serie[m] ?? null }))).val);
    conexiones.sort((a, b) => b.peso - a.peso);
    // Desglose por categoría: cumplimiento derivado de los KPIs → resultado = meta × cumpl/100.
    const porCategoria: CatDesglose[] = CATEGORIAS_CORE.map((cat) => {
      const cumplCat = ponderado(conexiones.map((c) => ({ w: c.peso, c: cumplKpiCat(c.kpi, cat, refIdx) }))).val;
      const meta = objMetas[o.nombre]?.[cat]?.[refIdx] ?? null;
      return { categoria: cat, resultado: meta != null && cumplCat != null ? (meta * cumplCat) / 100 : null, meta };
    });
    return {
      id: o.id,
      nombre: o.nombre,
      color: o.color,
      pesoEstrategico: Math.round(((o.peso || 0) / pT) * 100),
      cumplMes: rMes.val,
      cumplYtd: rYtd.val,
      cobertura: rMes.cobertura,
      metaNegMes: metaGeneral(objMetas[o.nombre], refIdx),
      cumplSerie,
      porCategoria,
      aportes: conexiones.map((c) => ({ kpi: c.kpi, peso: c.peso, cumpl: c.cumplMes })),
    };
  });

  // Salud de Marca = Σ pesoEstratégico × cumplimiento(objetivo), renormalizado.
  const smMes = ponderado(objetivos.map((o) => ({ w: o.pesoEstrategico, c: o.cumplMes })));
  const smYtd = ponderado(objetivos.map((o) => ({ w: o.pesoEstrategico, c: o.cumplYtd })));
  const smMetaNeg = ponderado(objetivos.map((o) => ({ w: o.pesoEstrategico, c: o.metaNegMes }))).val;
  const smSerie = Array.from({ length: 12 }, (_, m) => ponderado(objetivos.map((o) => ({ w: o.pesoEstrategico, c: o.cumplSerie[m] ?? null }))).val);

  // Salud de Marca por categoría = 0.25·Σ (dimensiones de marca), tanto la meta como el
  // resultado derivado (resultado(dim,cat) = meta × cumpl/100). Si todos los KPIs se cumplen
  // al 100%, el resultado iguala la meta de marca.
  const dimObjNames = new Set(mapa.objetivos.filter((o) => dimKey(o.nombre) != null).map((o) => o.nombre));
  const dimCards = objetivos.filter((o) => dimObjNames.has(o.nombre));
  const smPorCat: CatDesglose[] = CATEGORIAS_CORE.map((cat) => {
    const cells = dimCards.map((o) => o.porCategoria.find((pc) => pc.categoria === cat));
    const metas = cells.map((c) => c?.meta ?? null);
    const ress = cells.map((c) => c?.resultado ?? null);
    const allMeta = metas.length > 0 && metas.every((m) => m != null);
    const allRes = ress.length > 0 && ress.every((r) => r != null);
    return {
      categoria: cat,
      resultado: allRes ? 0.25 * (ress as number[]).reduce((a, b) => a + b, 0) : null,
      meta: allMeta ? 0.25 * (metas as number[]).reduce((a, b) => a + b, 0) : null,
    };
  });

  return {
    disponible: true,
    refMes,
    waveKantar: null,
    objetivos,
    saludMarca: { cumplMes: smMes.val, cumplYtd: smYtd.val, metaNegMes: smMetaNeg, cumplSerie: smSerie, porCategoria: smPorCat },
  };
}
