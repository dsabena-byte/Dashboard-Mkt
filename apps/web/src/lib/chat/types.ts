// ============================================================================
// Copiloto de datos — tipos compartidos (chat + gráficos dinámicos).
// GENÉRICO y reutilizable por cualquier dashboard: el motor se construye una vez;
// cada dashboard solo aporta su set de TOOLS (ver lib/chat/registry.ts).
// ============================================================================

export interface ChartSeries {
  key: string;
  label: string;
  type?: "bar" | "line";
  color?: string;
  axis?: "left" | "right";
}

export interface ChartSpec {
  type: "bar" | "line" | "composed";
  title?: string;
  data: Array<Record<string, string | number | null>>;
  xKey: string;
  series: ChartSeries[];
}

/** Tarjeta visual de un posteo (miniatura + métricas), para "mostrame los posts". */
export interface PostCard {
  titulo?: string;
  plataforma?: string;
  fecha?: string;
  tipo?: string;
  alcance?: number;
  engagement?: number;
  thumbnail?: string;
  url?: string;
}

/** Una herramienta que el modelo puede llamar: una query function envuelta. */
export interface ChatTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema (OpenAI function params)
  run: (args: Record<string, unknown>) => Promise<unknown>;
}
