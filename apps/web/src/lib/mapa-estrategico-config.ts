// Semilla versionada del Mapa Estratégico (Ciclo 1 — hipótesis).
//
// Modelo: cada objetivo puede tener sub-indicadores (1 nivel). Los KPIs se
// conectan a las HOJAS con un "peso" 0-100 (% de contribución estimado):
//   - Salud de Marca = Top of Mind + Share of Mind + Intención + Poder (25% c/u).
//   - Facturación e Inv/Fact son planas (la hoja es el objetivo).
// Ciclo 1 = hipótesis de negocio; Ciclo 2 se recalibra con datos.
// Ver docs/brujula-salud-marca.md.

export type Vinculos = Record<string, number>; // leafId -> peso 0-100

export interface Kpi {
  nombre: string;
  vinculos: Vinculos;
}

export interface Plan {
  nombre: string;
  kpis: Kpi[];
}

export interface SubIndicador {
  id: string;
  nombre: string;
  peso: number; // composición dentro del objetivo (suma ~100)
}

export interface Objetivo {
  id: string;
  nombre: string;
  color: string;
  peso: number; // peso estratégico relativo (se normaliza a 100%)
  subs?: SubIndicador[];
}

export interface Leaf {
  id: string; // hoja (sub-indicador, o el objetivo si es plano)
  nombre: string;
  objId: string;
  objNombre: string;
  color: string;
}

export const OBJETIVOS_SEED: Objetivo[] = [
  {
    id: "o1",
    nombre: "Salud de Marca",
    color: "#7a5cf0",
    peso: 40,
    subs: [
      { id: "tom", nombre: "Top of Mind", peso: 25 },
      { id: "som", nombre: "Share of Mind", peso: 25 },
      { id: "int", nombre: "Intención de compra", peso: 25 },
      { id: "pod", nombre: "Poder de Marca", peso: 25 },
    ],
  },
  { id: "o2", nombre: "Facturación", color: "#159a5b", peso: 40 },
  { id: "o3", nombre: "Inv. Mkt / Facturación", color: "#d08a1e", peso: 20 },
];

export const PLANES_SEED: Plan[] = [
  {
    nombre: "Pauta en Medios",
    kpis: [
      { nombre: "Alcance / Cobertura", vinculos: { tom: 50, som: 35, o2: 20 } },
      { nombre: "VTR (view-through)", vinculos: { som: 40, pod: 30 } },
      { nombre: "Share of Voice", vinculos: { tom: 45, som: 30, o2: 25 } },
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
      { nombre: "Alcance orgánico", vinculos: { som: 70 } },
      { nombre: "Engagement rate", vinculos: { pod: 50, int: 30 } },
      { nombre: "Sentiment", vinculos: { pod: 45, int: 25 } },
    ],
  },
  {
    nombre: "Mkt de Influencia",
    kpis: [
      { nombre: "Alcance de creadores", vinculos: { som: 45, tom: 30 } },
      { nombre: "Afinidad / Engagement", vinculos: { pod: 55, int: 30 } },
      { nombre: "Menciones / EMV", vinculos: { som: 40, pod: 20, o2: 20 } },
    ],
  },
  {
    nombre: "SEO / Search",
    kpis: [
      { nombre: "Share of Search", vinculos: { tom: 45, som: 35, o2: 30 } },
      { nombre: "Tráfico orgánico", vinculos: { o2: 30, o3: 55 } },
      { nombre: "Posición media", vinculos: { tom: 40, o3: 35 } },
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
      { nombre: "Floor Share (exhibición)", vinculos: { int: 40, tom: 25, o2: 50 } },
      { nombre: "Sell-out en PDV", vinculos: { int: 45, o2: 50 } },
    ],
  },
];

// Hojas aplanadas (columnas de la matriz / nodos hoja del mapa).
export function leavesOf(objs: Objetivo[]): Leaf[] {
  const out: Leaf[] = [];
  for (const o of objs) {
    if (o.subs && o.subs.length) {
      for (const s of o.subs) out.push({ id: s.id, nombre: s.nombre, objId: o.id, objNombre: o.nombre, color: o.color });
    } else {
      out.push({ id: o.id, nombre: o.nombre, objId: o.id, objNombre: o.nombre, color: o.color });
    }
  }
  return out;
}

export const MAPA_STORAGE_KEY = "mapa-estrategico-ciclo1-v3";
