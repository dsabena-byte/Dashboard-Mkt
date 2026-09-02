// Modelo del Mapa Estratégico (aplanado, dic-2026).
//
// Cada KPI aporta un % ("peso inbound") a uno o varios objetivos. La regla clave:
// **por objetivo, la suma de los pesos de sus KPIs se capa en 100%** — así el peso
// es "qué fracción del objetivo explica ese KPI" y se puede hacer el rollup:
//   cumplimiento(objetivo) = Σ  pesoKPI × min(cumplimiento(KPI), 100%)
// Un mismo KPI puede aportar a varios objetivos; lo que se restringe es la suma
// por objetivo, no el total del KPI. Sin sub-objetivos (aplanado).
//
// La config se persiste en la tabla `mapa_estrategico` (antes: localStorage).

export type Vinculos = Record<string, number>; // objId -> peso inbound 0-100

export interface Kpi {
  nombre: string;
  vinculos: Vinculos;
}

export interface Plan {
  nombre: string;
  kpis: Kpi[];
}

export interface Objetivo {
  id: string;
  nombre: string;
  color: string;
  peso: number; // peso estratégico relativo (se normaliza a 100% entre objetivos)
}

export interface MapaConfig {
  objetivos: Objetivo[];
  planes: Plan[];
}

// Seed inicial (fallback para DB vacía). Objetivos = embudo de marca; KPIs = los que
// YA tienen meta cargada (Pauta Mkt / Web / Instagram), con pesos inbound que suman
// 100% por objetivo. Es una hipótesis: el usuario la ajusta y guarda.
export const OBJETIVOS_SEED: Objetivo[] = [
  { id: "awareness", nombre: "Awareness", color: "#7a5cf0", peso: 50 },
  { id: "poder", nombre: "Poder de Marca", color: "#159a5b", peso: 25 },
  { id: "impacto", nombre: "Impacto Negocio", color: "#d08a1e", peso: 25 },
];

export const PLANES_SEED: Plan[] = [
  {
    nombre: "Pauta Mkt",
    kpis: [
      { nombre: "Inversión", vinculos: {} },
      { nombre: "Alcance único", vinculos: { awareness: 35 } },
      { nombre: "Frecuencia", vinculos: { poder: 20 } },
      { nombre: "Impresiones", vinculos: { awareness: 25 } },
      { nombre: "VTR (≥50%)", vinculos: { poder: 35 } },
      { nombre: "Clicks", vinculos: { impacto: 20 } },
    ],
  },
  {
    nombre: "Web / Ecommerce",
    kpis: [
      { nombre: "Tráfico web (usuarios)", vinculos: { impacto: 30 } },
      { nombre: "Avg Sesión (segundos)", vinculos: { impacto: 10 } },
      { nombre: "Tasa de conversión", vinculos: { impacto: 40 } },
    ],
  },
  {
    nombre: "Instagram",
    kpis: [
      { nombre: "Alcance orgánico", vinculos: { awareness: 40 } },
      { nombre: "Engagement rate", vinculos: { poder: 45 } },
    ],
  },
];

export const MAPA_CONFIG_SEED: MapaConfig = { objetivos: OBJETIVOS_SEED, planes: PLANES_SEED };

// Peso estratégico normalizado a 100% (para mostrar y para el rollup global).
export function normPeso(objs: Objetivo[]): number[] {
  const t = objs.reduce((a, o) => a + o.peso, 0) || 1;
  return objs.map((o) => Math.round((o.peso / t) * 100));
}

// Suma de pesos inbound asignados a un objetivo (across todos los KPIs). Debe ser ≤100.
export function pesoAsignado(planes: Plan[], objId: string): number {
  let s = 0;
  for (const p of planes) for (const k of p.kpis) s += k.vinculos[objId] ?? 0;
  return s;
}

// Plave de localStorage legacy (draft offline). La fuente de verdad es la DB.
export const MAPA_STORAGE_KEY = "mapa-estrategico-ciclo1-v3";
