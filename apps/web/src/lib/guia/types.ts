// ============================================================================
// Proceso Estratégico — modelo de contenido de la guía (client-safe, sin server-only).
//
// El contenido vive en TS (lib/guia/*.ts) pero está modelado como DATOS planos para poder
// migrarlo sin cambios de forma a una tabla `kb_content` en Supabase (una fila por módulo,
// `secciones/pasos/checklist/benchmarks` como jsonb). Nada de JSX adentro del contenido:
// los cuerpos son "markdown-lite" (párrafos, listas con "- " o "1. ", **negrita**).
// ============================================================================

export type Nivel = "estrategico" | "tactico" | "operativo";
export type Etapa = "construir" | "aprender" | "optimizar" | "acelerar";
export type Funnel = "awareness" | "consideracion" | "conversion" | "fidelizacion" | "transversal";
export type Plataforma = "meta" | "google" | "tiktok" | "ga4" | "search-console" | "bip";
export type PlanMin = "insight" | "optimize" | "accelerate";

export interface Seccion {
  titulo: string;
  /** markdown-lite: párrafos separados por línea en blanco, "- " viñetas, "1. " numeradas, **negrita**. */
  cuerpo: string;
}

export interface Paso {
  titulo: string;
  detalle: string;
}

export interface Benchmark {
  metrica: string;
  valor: string;
  nota: string;
}

export interface Modulo {
  id: string;
  titulo: string;
  resumen: string;
  nivel: Nivel;
  etapa: Etapa;
  funnel: Funnel[];
  canal?: string[];
  plataforma?: Plataforma;
  /** Slugs de tablero (ver DASH_HREF en lib/guia/index.ts). */
  dashSlugs: string[];
  /** Claves de KPI_KNOW (lib/knowledge.ts). */
  kpiKeys: string[];
  planMin?: PlanMin;
  secciones: Seccion[];
  pasos?: Paso[];
  checklist?: string[];
  /** Referencias orientativas: se leen contra tu propia historia (p75 propio), no como verdad absoluta. */
  benchmarks?: Benchmark[];
  /** Cómo se hace / se ve esto dentro de BIP: qué tablero y en qué paso del ciclo. */
  enBip: string;
  relacionados?: string[];
}

export const NIVEL_LABEL: Record<Nivel, string> = {
  estrategico: "Estratégico",
  tactico: "Táctico",
  operativo: "Operativo",
};

export const ETAPA_LABEL: Record<Etapa, string> = {
  construir: "Construir",
  aprender: "Aprender",
  optimizar: "Optimizar",
  acelerar: "Acelerar",
};

export const ETAPA_NUM: Record<Etapa, string> = { construir: "01", aprender: "02", optimizar: "03", acelerar: "04" };

export const ETAPA_BAJADA: Record<Etapa, string> = {
  construir: "Objetivos, modelo y metas. La base del trimestre.",
  aprender: "Leer real vs meta y entender por qué.",
  optimizar: "Reasignar inversión y esfuerzo con evidencia.",
  acelerar: "Escalar lo que funciona y recalibrar.",
};

export const FUNNEL_LABEL: Record<Funnel, string> = {
  awareness: "Awareness",
  consideracion: "Consideración",
  conversion: "Conversión",
  fidelizacion: "Fidelización",
  transversal: "Transversal",
};

export const PLATAFORMA_LABEL: Record<Plataforma, string> = {
  meta: "Meta Ads",
  google: "Google Ads",
  tiktok: "TikTok Ads",
  ga4: "Google Analytics 4",
  "search-console": "Search Console",
  bip: "Uso de la plataforma",
};

export const ETAPAS: Etapa[] = ["construir", "aprender", "optimizar", "acelerar"];
export const NIVELES: Nivel[] = ["estrategico", "tactico", "operativo"];
export const FUNNELS: Funnel[] = ["awareness", "consideracion", "conversion", "fidelizacion", "transversal"];
export const PLATAFORMAS: Plataforma[] = ["meta", "google", "tiktok", "ga4", "search-console", "bip"];
