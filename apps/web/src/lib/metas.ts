// Metas por KPI — lógica compartida entre los tableros (que cargan la meta) y el
// Mapa/Resumen (que leen el semáforo). Una meta = configuración + valores
// mensuales. La clave de un KPI es (plan, kpi); `categoria` permite meta general
// ('__general__') o por categoría del negocio (Lavado/Refrigeración/Cocción).

export const CAT_GENERAL = "__general__";

export type Direccion = "up" | "down"; // up = mejor mayor, down = mejor menor
export type Referencia = "interno" | "mercado" | "periodo";
export type Agregacion = "mensual" | "U3M" | "U4M" | "MAT" | "YTD";
export type Frecuencia = "mensual" | "semanal" | "trimestral";
export type Semaforo = "verde" | "amarillo" | "rojo" | "sin-meta";

export interface MetaConfig {
  plan: string;
  kpi: string;
  categoria: string;
  unidad: string | null;
  direccion: Direccion;
  referencia: Referencia;
  frecuencia: Frecuencia;
  agregacion: Agregacion;
  umbralVerde: number;
  umbralAmarillo: number;
  notas: string | null;
}

export interface MetaValor {
  plan: string;
  kpi: string;
  categoria: string;
  anio: number;
  mes: number; // 1-12
  valor: number | null;
}

export interface MetasPayload {
  config: MetaConfig[];
  valores: MetaValor[];
}

export function defaultConfig(plan: string, kpi: string, categoria = CAT_GENERAL): MetaConfig {
  return {
    plan,
    kpi,
    categoria,
    unidad: null,
    direccion: "up",
    referencia: "interno",
    frecuencia: "mensual",
    agregacion: "mensual",
    umbralVerde: 100,
    umbralAmarillo: 90,
    notas: null,
  };
}

// % de cumplimiento de un valor real vs la meta, según la dirección.
// up: cumplir = llegar o superar la meta (real/meta). down: cumplir = quedar por
// debajo (meta/real). Devuelve null si no hay meta o real.
export function cumplimientoPct(
  actual: number | null | undefined,
  meta: number | null | undefined,
  direccion: Direccion,
): number | null {
  if (actual == null || meta == null || meta === 0) return null;
  const pct = direccion === "up" ? (actual / meta) * 100 : (meta / actual) * 100;
  return Number.isFinite(pct) ? pct : null;
}

export function semaforoDe(cumplimiento: number | null, cfg: Pick<MetaConfig, "umbralVerde" | "umbralAmarillo">): Semaforo {
  if (cumplimiento == null) return "sin-meta";
  if (cumplimiento >= cfg.umbralVerde) return "verde";
  if (cumplimiento >= cfg.umbralAmarillo) return "amarillo";
  return "rojo";
}

export const SEMAFORO_COLOR: Record<Semaforo, string> = {
  verde: "#16a34a",
  amarillo: "#d97706",
  rojo: "#dc2626",
  "sin-meta": "#94a3b8",
};

// Lee metas de un plan desde la API. Server-safe (usa fetch relativo => pasar base
// en server components no hace falta si se llama desde el cliente).
export async function fetchMetas(plan: string): Promise<MetasPayload> {
  const res = await fetch(`/api/metas?plan=${encodeURIComponent(plan)}`, { cache: "no-store" });
  if (!res.ok) return { config: [], valores: [] };
  return (await res.json()) as MetasPayload;
}
