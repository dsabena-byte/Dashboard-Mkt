// Semilla versionada del Mapa Estratégico (Ciclo 1 — hipótesis).
//
// Modelo de contribución: cada KPI de un Plan aporta a uno o más objetivos
// estratégicos con un "peso" 0-100 (% de contribución estimado). En el Ciclo 1
// los pesos son hipótesis de negocio (sin estadística); en el Ciclo 2 se
// recalibran contra los datos (correlación/regresión) — ver docs/brujula-salud-marca.md.
//
// Esta es la config de arranque. La pantalla de calibración
// (components/mapa-estrategico/mapa-editor) hidrata desde localStorage si el
// usuario ya editó, y si no, cae a este seed.

export type Vinculos = Record<string, number>; // objId -> peso 0-100

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
  color: string; // hex — color semántico del objetivo en el mapa
  peso: number; // peso estratégico relativo (se normaliza a 100%)
}

// Paleta por objetivo (estable, semántica).
export const OBJETIVOS_SEED: Objetivo[] = [
  { id: "o1", nombre: "Salud de Marca", color: "#7a5cf0", peso: 40 },
  { id: "o2", nombre: "Facturación", color: "#159a5b", peso: 40 },
  { id: "o3", nombre: "Inv. Mkt / Facturación", color: "#d08a1e", peso: 20 },
];

export const PLANES_SEED: Plan[] = [
  {
    nombre: "Pauta en Medios",
    kpis: [
      { nombre: "Alcance / Cobertura", vinculos: { o1: 85, o2: 20 } },
      { nombre: "VTR (view-through)", vinculos: { o1: 70 } },
      { nombre: "Share of Voice", vinculos: { o1: 75, o2: 25 } },
    ],
  },
  {
    nombre: "Pauta Ecommerce",
    kpis: [
      { nombre: "ROAS", vinculos: { o3: 90 } },
      { nombre: "Conversiones", vinculos: { o2: 55, o3: 60 } },
      { nombre: "CPA", vinculos: { o3: 65 } },
    ],
  },
  {
    nombre: "Redes Sociales",
    kpis: [
      { nombre: "Alcance orgánico", vinculos: { o1: 70 } },
      { nombre: "Engagement rate", vinculos: { o1: 80 } },
      { nombre: "Sentiment", vinculos: { o1: 55 } },
    ],
  },
  {
    nombre: "Mkt de Influencia",
    kpis: [
      { nombre: "Alcance de creadores", vinculos: { o1: 75 } },
      { nombre: "Afinidad / Engagement", vinculos: { o1: 85 } },
      { nombre: "Menciones / EMV", vinculos: { o1: 55, o2: 20 } },
    ],
  },
  {
    nombre: "SEO / Search",
    kpis: [
      { nombre: "Share of Search", vinculos: { o1: 60, o2: 45 } },
      { nombre: "Tráfico orgánico", vinculos: { o2: 30, o3: 55 } },
      { nombre: "Posición media", vinculos: { o1: 40, o3: 35 } },
    ],
  },
  {
    nombre: "Web / Ecommerce",
    kpis: [
      { nombre: "Tráfico web (usuarios)", vinculos: { o2: 35, o3: 55 } },
      { nombre: "Tasa de conversión", vinculos: { o3: 85 } },
      { nombre: "Ingresos ecommerce", vinculos: { o2: 40, o3: 75 } },
    ],
  },
  {
    nombre: "Trade (CB · Floor · Canal)",
    kpis: [
      { nombre: "% Cumplimiento CB", vinculos: { o2: 85 } },
      { nombre: "Floor Share (exhibición)", vinculos: { o2: 80, o1: 30 } },
      { nombre: "Sell-out en PDV", vinculos: { o2: 65, o1: 25 } },
    ],
  },
];

export const MAPA_STORAGE_KEY = "mapa-estrategico-ciclo1-v1";
