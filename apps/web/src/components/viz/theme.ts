// Sistema visual de los tableros de planilla ("Mis tableros", portado de BIP; mismo sistema que Drean):
// dato real en azul #1e40af, meta en gris pizarra, rampa de azules/teal/pizarra para multi-serie,
// verde/amarillo/rojo SOLO para semáforo/estado. Ejes Y de ancho fijo (56px) para alinear.
import { SEMAFORO_COLOR, type Semaforo } from "@/lib/metas";

export const SEM_BG: Record<Semaforo, string> = {
  verde: "rgba(22,163,74,.12)",
  amarillo: "rgba(217,119,6,.14)",
  rojo: "rgba(220,38,38,.12)",
  "sin-meta": "rgba(100,116,139,.10)",
};

export const REAL = "#1e40af";
export const META_FILL = "#cbd5e1";
export const META_STROKE = "#64748b";
export const META_LINE = "#94a3b8";
export const INK = "#0f172a";
export const LABEL = "#1e293b";
export const GRID = "#e2e9f2";
export const AXIS = "#8496ac";
export const Y_W = 56;

export const PALETTES: Record<string, string[]> = {
  azul: ["#1e40af", "#3b82f6", "#93c5fd", "#1d4ed8", "#60a5fa", "#2563eb", "#bfdbfe", "#1e3a8a"],
  teal: ["#0f766e", "#14b8a6", "#5eead4", "#0d9488", "#2dd4bf", "#115e59", "#99f6e4", "#134e4a"],
  pizarra: ["#334155", "#64748b", "#94a3b8", "#475569", "#cbd5e1", "#1e293b", "#e2e8f0", "#0f172a"],
  // multi-serie por defecto: azules del sistema + teal + pizarra (PALETA_SECCIONES extendida)
  mixta: ["#1e40af", "#0ea5e9", "#14b8a6", "#64748b", "#60a5fa", "#0f766e", "#94a3b8", "#93c5fd", "#334155", "#5eead4", "#2563eb", "#cbd5e1"],
};
export const paletteOf = (p?: string, n = 1): string[] => (p && PALETTES[p] ? PALETTES[p] : n <= 1 ? PALETTES.azul! : PALETTES.mixta!);

export const tooltipStyle = { background: "#fff", border: `1px solid ${GRID}`, borderRadius: 8, fontSize: 12, boxShadow: "none" } as const;
export const tooltipLabelStyle = { color: "#57697f", fontWeight: 600 } as const;

export function semaforo(cumpl: number | null, green = 100, yellow = 90): Semaforo {
  if (cumpl == null || !Number.isFinite(cumpl)) return "sin-meta";
  if (cumpl >= green) return "verde";
  if (cumpl >= yellow) return "amarillo";
  return "rojo";
}
export { SEMAFORO_COLOR };

/** Interpolación de la escala secuencial azul (heatmap / escala de color). */
export function blueScale(t: number): string {
  const a = [238, 244, 255], b = [30, 64, 175];
  const k = Math.max(0, Math.min(1, t));
  const c = a.map((x, i) => Math.round(x + (b[i]! - x) * k));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

export const HEIGHT: Record<"s" | "m" | "l", number> = { s: 150, m: 270, l: 420 };
