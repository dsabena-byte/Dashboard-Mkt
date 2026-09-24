// ============================================================================
// Copiloto de datos — tipos compartidos (motor v2, portado de BIP).
// GENÉRICO: el motor (app/api/chat) y la UI (components/data-chat) no conocen los
// dashboards; cada dashboard aporta su set de TOOLS (lib/chat/registry.ts).
// Client-safe (solo tipos).
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

/** Tabla para rankings/comparativos (render_table). */
export interface TableSpec {
  title?: string;
  columns: string[];
  rows: Array<Array<string | number | null>>;
}

/**
 * Tarjeta visual de un post/creativo (render_posts). El modelo solo pasa `ref`s: la
 * tarjeta (miniatura, link, métricas) la arma el servidor con lo que devolvieron las
 * tools → el modelo no puede inventar imágenes ni links.
 */
export interface PostCard {
  ref: string;
  red: string; // "Instagram" | "Facebook" | "Meta Ads" | "YouTube" …
  titulo: string;
  fecha?: string | null;
  formato?: string | null;
  thumbnail?: string | null;
  url?: string | null;
  metricas: { label: string; valor: string }[];
  badge?: string | null;
}

/** Contexto por request compartido entre tools (registro de posts vistos). */
export interface ToolCtx {
  posts: Map<string, PostCard>;
}

/** Paso del motor (qué dato consultó), para la UI ("Consultando…"). */
export interface ChatStep {
  tool: string;
  label: string;
}

/** Una herramienta que el modelo puede llamar: una query function envuelta. */
export interface ChatTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema (OpenAI function params)
  run: (args: Record<string, unknown>) => Promise<unknown>;
}
