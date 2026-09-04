// Helpers del dash "Inversión de Marketing" (/funnel): clasificación de cuentas,
// lógica de cuatrimestres (comparación fija Real vs BGT vigente) y agregaciones.
// Portado del HTML estático bgt-mkt para reconstruirlo nativo en React.

// OJO: este módulo lo importan un client component (inversion-comparador) Y el
// server (funnel/page). NO importar nada runtime de módulos `server-only`
// (bgt-queries). Solo tipos (se borran en compilación) + constantes/funciones puras.
import type { BgtRow } from "./bgt-queries";

// Meses en MAYÚSCULA (igual que bgt-queries, duplicado acá para ser client-safe).
export const MESES_UP = [
  "ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO",
  "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE",
];

// Suma pura de una versión de presupuesto para un set de meses (UPPER). Pura →
// client-safe (la de bgt-queries es igual pero vive en un módulo server-only).
function sumVersion(rows: BgtRow[], version: string, meses: string[], field: "usd" | "ars" = "usd"): number {
  const set = new Set(meses);
  return rows.filter((r) => r.presupuesto === version && set.has(r.mes)).reduce((s, r) => s + r[field], 0);
}

// Número de cuenta por nombre (del plan de cuentas de Marketing).
export const CUENTA_NUM: Record<string, string> = {
  "PUBLICIDAD.PRODUCCION Y AGENCIAS": "6202010034",
  "PUBLICIDAD.MATERIALES GRAFICOS": "6202010036",
  "PUBLICIDAD TV": "6202010069",
  "PUBLICIDAD PROMOCIONES AL CONSUMIDOR": "6202010071",
  "PUBLICIDAD EXHIBICIONES": "6202010072",
  INTEGRALES: "6202010077",
  "PUBLICIDAD ESTUDIOS DE MERCADO": "6202010078",
  "PUBLICIDAD EVENTOS": "6202010082",
  "PUBLICIDAD COMPARTIDA": "6202010084",
  "GASTOS VAR- PAUTA DIGITAL": "6202010033",
};

// Clasificación estratégica de cada cuenta (por número). Orden de visualización.
export const CLASIF_ORDER = ["EQUITY", "VISIBILITY", "INTEGRALES", "DESARROLLO DE PDV", "TRADE MARKETING", "OTROS"] as const;
export type Clasif = (typeof CLASIF_ORDER)[number];

const CUENTA_CLASIF: Record<string, Clasif> = {
  "6202010034": "EQUITY", "6202010069": "EQUITY", "6202010078": "EQUITY",
  "6202010036": "VISIBILITY", "6202010072": "VISIBILITY",
  "6202010077": "INTEGRALES",
  "6202010082": "TRADE MARKETING", "6202010071": "TRADE MARKETING",
};

export function clasifDe(cuentaNombre: string): Clasif {
  const num = CUENTA_NUM[cuentaNombre] ?? "";
  return CUENTA_CLASIF[num] ?? "OTROS";
}

export function yearOf(ppto: string): number | null {
  const m = String(ppto).match(/20\d{2}/);
  return m ? parseInt(m[0], 10) : null;
}

export const MESES_CAP = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export type Moneda = "ars" | "usd";
export type Periodo = "anual" | "c1" | "c2" | "c3";

export function mesesDePeriodo(periodo: Periodo): string[] {
  if (periodo === "c1") return MESES_UP.slice(0, 4);
  if (periodo === "c2") return MESES_UP.slice(4, 8);
  if (periodo === "c3") return MESES_UP.slice(8, 12);
  return MESES_UP;
}

// ===== Cuatrimestres: comparación FIJA Real 2026 vs BGT vigente del cuatrimestre =====
// C1 (Ene–Abr) → Real 2026 vs BGT 2026
// C2 (May–Ago) → Real 2026 vs 4+8 2026
// C3 (Sep–Dic) → Real 2026 vs 8+4 2026
export const MAX_DESVIO = 5; // % — sobre-ejecución máxima permitida vs BGT vigente
export const MAX_INV_FACT = 1.3; // % — Inversión Mkt real / Facturación

export interface CuatriDef {
  id: "T1" | "T2" | "T3";
  label: string;
  meses: number[]; // 1-12
  bgtVersion: string;
  bgtLabel: string;
}

export function cuatrisDef(year: number): CuatriDef[] {
  return [
    { id: "T1", label: "Ene–Abr", meses: [1, 2, 3, 4], bgtVersion: `BGT ${year}`, bgtLabel: "BGT" },
    { id: "T2", label: "May–Ago", meses: [5, 6, 7, 8], bgtVersion: `4+8 ${year}`, bgtLabel: "BGT 4+8" },
    { id: "T3", label: "Sep–Dic", meses: [9, 10, 11, 12], bgtVersion: `8+4 ${year}`, bgtLabel: "BGT 8+4" },
  ];
}

export type EstadoCuatri = "cerrado" | "en curso" | "futuro";
export function estadoCuatri(meses: number[], curYear: number, year: number, curMonth: number): EstadoCuatri {
  if (curYear > year) return "cerrado";
  if (curYear < year) return "futuro";
  const last = Math.max(...meses), first = Math.min(...meses);
  if (curMonth > last) return "cerrado";
  if (curMonth < first) return "futuro";
  return "en curso";
}

export interface CuatriResult extends CuatriDef {
  estado: EstadoCuatri;
  bgtAvailable: boolean;
  partial: boolean;
  coverage: string | null;
  bgtVal: number; // USD
  realVal: number; // USD
  fact: number | null; // USD
  desvio: number | null; // %
  invFact: number | null; // %
  evaluable: boolean;
  desvioOk: boolean | null;
  invFactOk: boolean | null;
}

// Calcula los 3 cuatrimestres (todo en USD). rows = filas BGT; sumFact = suma de
// facturación (USD) para un set de meses "YYYY-MM-01".
export function computeCuatris(
  rows: BgtRow[],
  year: number,
  curYear: number,
  curMonth: number,
  hasVersion: (v: string) => boolean,
  sumFact: (mesesYm: string[]) => number | null,
): CuatriResult[] {
  const REAL = `REAL ${year}`;
  return cuatrisDef(year).map((c) => {
    const estado = estadoCuatri(c.meses, curYear, year, curMonth);
    const bgtAvailable = hasVersion(c.bgtVersion);
    const closedMonths = c.meses.filter((m) => (curYear > year ? true : curYear < year ? false : m < curMonth));
    const partial = estado === "en curso" && closedMonths.length > 0;
    const useMonths = partial ? closedMonths : c.meses;
    const mesesUp = useMonths.map((m) => MESES_UP[m - 1]!);
    const mesesYm = useMonths.map((m) => `${year}-${String(m).padStart(2, "0")}-01`);

    const bgtVal = sumVersion(rows, c.bgtVersion, mesesUp, "usd");
    const realVal = sumVersion(rows, REAL, mesesUp, "usd");
    const fact = sumFact(mesesYm);

    const desvio = bgtAvailable && bgtVal > 0 ? ((realVal - bgtVal) / bgtVal) * 100 : null;
    const invFact = fact && fact > 0 ? (realVal / fact) * 100 : null;
    const evaluable = estado === "cerrado" || partial;
    const desvioOk = desvio != null ? desvio < MAX_DESVIO : null;
    const invFactOk = invFact != null ? invFact <= MAX_INV_FACT : null;
    const coverage = partial ? coverageLabel(useMonths) : null;

    return { ...c, estado, bgtAvailable, partial, coverage, bgtVal, realVal, fact, desvio, invFact, evaluable, desvioOk, invFactOk };
  });
}

function coverageLabel(meses: number[]): string {
  if (meses.length === 0) return "";
  if (meses.length === 1) return MESES_CAP[meses[0]! - 1]!;
  return `${MESES_CAP[meses[0]! - 1]}–${MESES_CAP[meses[meses.length - 1]! - 1]}`;
}
