// Semilla versionada del Mapa Estratégico (Ciclo 1 — hipótesis).
//
// Modelo de contribución jerárquico:
//   Plan → KPI → (sub-indicador hoja) → [sub-indicador intermedio] → Objetivo
//
// Un objetivo puede descomponerse en sub-indicadores (árbol de N niveles). Los
// KPIs se conectan a las HOJAS (no al objetivo en general). Cada sub-indicador
// tiene un `peso` de composición dentro de su padre. Ej. Salud de Marca =
// TOM + SOM + Intención + Poder (25% c/u), y Poder = Saliencia + Significancia +
// Diferenciación (33% c/u). Ver docs/brujula-salud-marca.md.
//
// En el Ciclo 1 los pesos KPI→hoja son hipótesis de negocio (sin estadística);
// en el Ciclo 2 se recalibran contra los datos.

export type Vinculos = Record<string, number>; // leafId -> peso 0-100

export interface Kpi {
  nombre: string;
  vinculos: Vinculos;
}

export interface Plan {
  nombre: string;
  kpis: Kpi[];
}

// Sub-indicador de un objetivo. Si tiene `subs`, es un nodo intermedio; si no,
// es una hoja (los KPIs se conectan a las hojas por su id).
export interface SubIndicador {
  id: string;
  nombre: string;
  peso: number; // composición dentro del padre (los hermanos suman ~100)
  subs?: SubIndicador[];
}

export interface Objetivo {
  id: string;
  nombre: string;
  color: string; // hex — color semántico del objetivo
  peso: number; // peso estratégico relativo (se normaliza a 100%)
  subs?: SubIndicador[]; // si no tiene, el objetivo es su propia hoja
}

// Hoja aplanada (para la matriz de conexión y el mapa).
export interface Leaf {
  id: string; // id de la hoja (sub-indicador hoja, o el objetivo si es plano)
  nombre: string;
  objId: string; // objetivo raíz
  color: string;
  parentId: string; // padre inmediato (objetivo o sub-indicador intermedio)
  intermedioId?: string; // si cuelga de un intermedio, su id
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
      {
        id: "pod",
        nombre: "Poder de Marca",
        peso: 25,
        subs: [
          { id: "sal", nombre: "Saliencia", peso: 33 },
          { id: "sig", nombre: "Significancia", peso: 33 },
          { id: "dif", nombre: "Diferenciación", peso: 33 },
        ],
      },
    ],
  },
  { id: "o2", nombre: "Facturación", color: "#159a5b", peso: 40 },
  { id: "o3", nombre: "Inv. Mkt / Facturación", color: "#d08a1e", peso: 20 },
];

// Planes → KPIs → vínculos a HOJAS (o2/o3 son planos: la hoja es el objetivo).
export const PLANES_SEED: Plan[] = [
  {
    nombre: "Pauta en Medios",
    kpis: [
      { nombre: "Alcance / Cobertura", vinculos: { tom: 50, som: 35, o2: 20 } },
      { nombre: "VTR (view-through)", vinculos: { som: 40, sal: 30 } },
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
      { nombre: "Engagement rate", vinculos: { sig: 50, int: 30 } },
      { nombre: "Sentiment", vinculos: { sig: 45, dif: 25 } },
    ],
  },
  {
    nombre: "Mkt de Influencia",
    kpis: [
      { nombre: "Alcance de creadores", vinculos: { som: 45, tom: 30 } },
      { nombre: "Afinidad / Engagement", vinculos: { sig: 55, dif: 30 } },
      { nombre: "Menciones / EMV", vinculos: { som: 40, dif: 20, o2: 20 } },
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

// Aplana el árbol de objetivos a sus hojas (lo que un KPI puede tocar).
export function leavesOf(objs: Objetivo[]): Leaf[] {
  const out: Leaf[] = [];
  for (const o of objs) {
    if (!o.subs || o.subs.length === 0) {
      out.push({ id: o.id, nombre: o.nombre, objId: o.id, color: o.color, parentId: o.id });
      continue;
    }
    for (const s of o.subs) {
      if (!s.subs || s.subs.length === 0) {
        out.push({ id: s.id, nombre: s.nombre, objId: o.id, color: o.color, parentId: o.id });
      } else {
        for (const ss of s.subs) {
          out.push({ id: ss.id, nombre: ss.nombre, objId: o.id, color: o.color, parentId: s.id, intermedioId: s.id });
        }
      }
    }
  }
  return out;
}

// Bump de versión: el modelo cambió (árbol), así que la clave nueva descarta
// calibraciones viejas con el esquema plano.
export const MAPA_STORAGE_KEY = "mapa-estrategico-ciclo1-v2";
