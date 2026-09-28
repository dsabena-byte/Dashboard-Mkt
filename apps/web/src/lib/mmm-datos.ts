// ============================================================================
// Datos del MMM-lite ("Qué aporta cada medio") para Drean — PURO, client-safe, imports RELATIVOS.
// Portado de BIP (lib/mmm-datos.ts, #135) y adaptado:
//  · Inversión mensual por medio = `buildPautaMediosMensual` (MISMO gap-fill que el Tablero, el
//    Seguimiento y el Simulador: Meta por API, OMD solo sin API, DV360 USD→ARS, UGC dentro, PMax
//    fuera) → vía `simMonthsFromPauta` (mismos alias de medio que el Simulador). + Ecommerce (Google
//    Ads inhouse) como un medio más, porque mueve las transacciones.
//  · KPI de negocio = serie mensual de GA4 (usuarios `ga4_monthly_users`, transacciones e ingresos
//    `ga4_purchases_daily`).
//  · Solo meses CERRADOS; el tramo va del primer mes con pauta al último mes con KPI, y el MMM usa el
//    tramo CONTINUO final con KPI (sin huecos en el adstock).
//  · Drean no tiene serie de IPC cargada → la inversión va en pesos corrientes (se avisa).
// ============================================================================
import { isOfflineCanal, type SimMesInput } from "./simulador";
import type { MmmInput } from "./stats/mmm";

export interface MmmKpiSerie { key: string; label: string; unidad: "" | "$"; porMes: Record<string, number | null> }
export interface MmmDatos {
  meses: string[];
  medios: { nombre: string; offline: boolean; porMes: Record<string, number> }[];
  kpis: MmmKpiSerie[];
  moneda: string | null;
  deflactado: boolean;
  baseMoneda: string | null;
  avisos: string[];
}

/** YYYY-MM de `desde` a `hasta` inclusive. */
export function mesesEntre(desde: string, hasta: string): string[] {
  if (!/^\d{4}-\d{2}$/.test(desde) || !/^\d{4}-\d{2}$/.test(hasta) || desde > hasta) return [];
  const out: string[] = [];
  let y = Number(desde.slice(0, 4)), m = Number(desde.slice(5, 7));
  for (let guard = 0; guard < 600; guard++) {
    const k = `${y}-${String(m).padStart(2, "0")}`;
    out.push(k);
    if (k === hasta) break;
    m++; if (m > 12) { m = 1; y++; }
  }
  return out;
}

export function construirDatosMmm(args: {
  meses: SimMesInput[];                               // inversión por medio y mes (simMonthsFromPauta)
  extra?: { medio: string; porMes: Record<string, number> }[]; // ej. Ecommerce
  kpis: MmmKpiSerie[];
  mesEnCurso: string;                                 // YYYY-MM (se excluye: parcial)
}): MmmDatos {
  const avisos: string[] = ["Drean no tiene serie de inflación (IPC) cargada: la inversión va en $ sin ajustar y el modelo puede confundir inflación con más inversión."];
  const spend = new Map<string, Map<string, number>>();
  const add = (medio: string, mes: string, v: number) => {
    if (!(v > 0) || mes >= args.mesEnCurso) return;
    const mm = spend.get(medio) ?? new Map<string, number>();
    mm.set(mes, (mm.get(mes) ?? 0) + v);
    spend.set(medio, mm);
  };
  for (const m of args.meses) for (const [medio, e] of Object.entries(m.medios)) add(medio, m.mes, e.inv);
  for (const e of args.extra ?? []) for (const [mes, v] of Object.entries(e.porMes)) add(e.medio, mes, v);
  const todos = [...spend.values()].flatMap((m) => [...m.keys()]).sort();
  if (!todos.length) return { meses: [], medios: [], kpis: args.kpis, moneda: "ARS", deflactado: false, baseMoneda: null, avisos };
  const ultimoKpi = args.kpis.flatMap((k) => Object.entries(k.porMes).filter(([mes, v]) => v != null && mes < args.mesEnCurso).map(([mes]) => mes)).sort().pop();
  const ultimo = todos[todos.length - 1]!;
  const hasta = ultimoKpi && ultimoKpi > ultimo ? ultimoKpi : ultimo;
  const meses = mesesEntre(todos[0]!, hasta).filter((k) => k < args.mesEnCurso);
  const medios = [...spend.entries()].map(([nombre, mm]) => {
    const porMes: Record<string, number> = {};
    for (const mes of meses) porMes[mes] = mm.get(mes) ?? 0;
    return { nombre, offline: isOfflineCanal(nombre), porMes };
  }).sort((a, b) => Object.values(b.porMes).reduce((s, v) => s + v, 0) - Object.values(a.porMes).reduce((s, v) => s + v, 0));
  return { meses, medios, kpis: args.kpis, moneda: "ARS", deflactado: false, baseMoneda: null, avisos };
}

/** Input del MMM para un KPI: el tramo CONTINUO final de meses con KPI (sin huecos en el adstock). */
export function inputMmm(d: MmmDatos, kpiKey: string): { input: MmmInput; recorte: string | null } | null {
  const k = d.kpis.find((x) => x.key === kpiKey);
  if (!k || !d.meses.length) return null;
  const val = (mes: string | undefined) => (mes != null ? k.porMes[mes] : undefined);
  let fin = d.meses.length - 1;
  while (fin >= 0 && !Number.isFinite(val(d.meses[fin]) ?? NaN)) fin--;
  if (fin < 0) return null;
  let ini = fin;
  while (ini - 1 >= 0 && Number.isFinite(val(d.meses[ini - 1]) ?? NaN)) ini--;
  const meses = d.meses.slice(ini, fin + 1);
  const recorte = ini > 0 ? `Se usan ${meses.length} meses continuos con ${k.label} (desde ${meses[0]}).` : null;
  return {
    recorte,
    input: {
      periodos: meses, kpiNombre: k.label, granularidad: "mensual",
      kpi: meses.map((m) => k.porMes[m] as number),
      medios: d.medios.map((m) => ({ nombre: m.nombre, offline: m.offline, inversion: meses.map((mes) => m.porMes[mes] ?? 0) })),
    },
  };
}
