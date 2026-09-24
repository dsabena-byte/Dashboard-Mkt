// Tipos del Diagnóstico IA por tablero (portado de BIP, sep-2026). Client-safe: sin server-only,
// lo importan el componente cliente (components/diagnostico/dash-diagnostico.tsx) y la API.

export interface InsItem { titulo: string; evidencia: string; lectura?: string }
export interface InsHallazgo { titulo: string; evidencia: string; tipo: "positivo" | "negativo"; porque: string }
export interface InsCorr { indicadores: string; hallazgo: string }
export interface InsPlanAccion { accion: string; prioridad: "alta" | "media" | "baja"; porque: string; impactoEsperado: string }
export interface InsOportunidad { palanca: string; impacto: string; calculo: string; prioridad: "alta" | "media" | "baja" }
export interface Insights {
  diagnostico: string;
  evolucion: InsItem[];
  metas: InsItem[];
  correlaciones: InsCorr[];
  hallazgos: InsHallazgo[];
  planAccion: InsPlanAccion[];
  oportunidades: InsOportunidad[];
}
export const EMPTY_INSIGHTS: Insights = { diagnostico: "", evolucion: [], metas: [], correlaciones: [], hallazgos: [], planAccion: [], oportunidades: [] };

/** Tableros con Diagnóstico IA (slug = ruta del dashboard). */
export const DIAG_DASHES = [
  "overview", "performance", "redes", "web", "seo-search",
  "cuadros-basicos", "floor-share", "influencia", "mercado", "salud-marca", "funnel",
  "mkt-canal", "performance-conversion",
] as const;
export type DiagDash = (typeof DIAG_DASHES)[number];
export const isDiagDash = (d: string): d is DiagDash => (DIAG_DASHES as readonly string[]).includes(d);

export interface ReportMeta { id: number; createdAt: string; diagnostico: string; model?: string | null }
