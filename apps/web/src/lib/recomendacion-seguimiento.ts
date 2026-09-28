// ============================================================================
// "MIS ACCIONES" — seguimiento de las tarjetas de "Qué hacer ahora" (portado y simplificado de la
// plataforma de origen, sep-2026; Drean single-tenant). PURO y client-safe: lo usan la API
// (/api/recomendaciones/seguimiento, validación) y el cliente (bloque "Mis acciones").
//
//   · Cada tarjeta tiene un id ESTABLE: `senal:<dash>:<clave de la regla>` o `ia:<dash>:<hash del título>`
//     (lib/recomendacion.ts → fromSignal / fromPlanAccion / fromOportunidad / fromHallazgo).
//   · Estados: "planificada" (La voy a hacer) · "hecha" · "descartada".
//   · Se guarda una FOTO (snapshot) de la tarjeta al marcarla: así "Mis acciones" la sigue mostrando
//     aunque la señal o el Diagnóstico IA ya no la produzcan ("ya no aparece en los datos").
// Tabla: recomendacion_seguimiento (migración 0122). Test: npx tsx scripts/recomendacion-seguimiento.test.ts
// ============================================================================
import { canonRec, hashRec, slugKey, type Recomendacion } from "@/lib/recomendacion";

export type EstadoAccion = "planificada" | "hecha" | "descartada";
export const ESTADOS_ACCION: EstadoAccion[] = ["planificada", "hecha", "descartada"];

export const ESTADO_LABEL: Record<EstadoAccion, string> = {
  planificada: "La voy a hacer",
  hecha: "Hecha",
  descartada: "Descartada",
};
/** Texto del botón que lleva a ese estado. */
export const ESTADO_BOTON: Record<EstadoAccion, string> = {
  planificada: "La voy a hacer",
  hecha: "Hecha",
  descartada: "Descartar",
};

/** Foto mínima de la tarjeta al marcarla (lo necesario para mostrarla después sin la señal). */
export interface SnapshotAccion {
  tipo: Recomendacion["tipo"];
  origen: Recomendacion["origen"];
  porque: string;
  pasos: string[];
  prioridad: Recomendacion["prioridad"]["nivel"];
  impacto: string | null;
  kpi: string | null;
}

export interface AccionSeguida {
  id: string;
  dash: string;
  estado: EstadoAccion;
  titulo: string;
  snapshot: SnapshotAccion | null;
  autor: string | null;
  updatedAt: string;
}

// ── Ids estables ─────────────────────────────────────────────────────────────
/** Id de una tarjeta que sale de una señal (misma fórmula que fromSignal). */
export const idSenal = (dash: string, key: string) => `senal:${dash}:${slugKey(key)}`;
/** Id de una tarjeta del Diagnóstico IA (hash del título normalizado; misma fórmula que fromPlanAccion…). */
export const idIa = (dash: string, titulo: string) => `ia:${dash}:${hashRec(canonRec(titulo))}`;
/** Formato válido de id (lo que acepta la API). */
export const ID_ACCION_RE = /^(senal|ia):[a-z-]{2,40}:[\w.-]{1,120}$/i;

// ── Snapshot + validación del POST ──────────────────────────────────────────
const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

export function snapshotDe(rec: Pick<Recomendacion, "tipo" | "origen" | "porque" | "pasos" | "prioridad" | "kpi"> & { impactoTexto?: string | null }): SnapshotAccion {
  return {
    tipo: rec.tipo,
    origen: rec.origen,
    porque: str(rec.porque, 1200),
    pasos: (rec.pasos ?? []).slice(0, 6).map((p) => str(p, 400)),
    prioridad: rec.prioridad.nivel,
    impacto: rec.impactoTexto ? str(rec.impactoTexto, 200) : null,
    kpi: rec.kpi?.nombre ? str(rec.kpi.nombre, 120) : null,
  };
}

const TIPOS = new Set(["alerta", "oportunidad", "mejora"]);
const ORIGENES = new Set(["senal", "ia_plan", "ia_oportunidad", "ia_hallazgo"]);
const PRIOS = new Set(["critica", "alta", "media", "baja"]);

/** Normaliza el body del POST. Nada de lo que se persiste sale sin validar. */
export function sanearAccion(raw: unknown, dashesValidos: readonly string[]):
  { ok: true; value: { id: string; dash: string; estado: EstadoAccion; titulo: string; snapshot: SnapshotAccion | null } } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") return { ok: false, error: "pedido inválido" };
  const r = raw as Record<string, unknown>;
  const id = str(r.id, 200).trim();
  const dash = str(r.dash, 40).trim();
  const estado = str(r.estado, 20) as EstadoAccion;
  const titulo = str(r.titulo, 300).trim();
  if (!ID_ACCION_RE.test(id)) return { ok: false, error: "id inválido" };
  if (!dashesValidos.includes(dash)) return { ok: false, error: "tablero desconocido" };
  if (id.split(":")[1] !== dash) return { ok: false, error: "el id no corresponde al tablero" };
  if (!ESTADOS_ACCION.includes(estado)) return { ok: false, error: "estado inválido" };
  if (!titulo) return { ok: false, error: "falta el título" };
  let snapshot: SnapshotAccion | null = null;
  const s = r.snapshot as Record<string, unknown> | null | undefined;
  if (s && typeof s === "object") {
    snapshot = {
      tipo: (TIPOS.has(String(s.tipo)) ? s.tipo : "mejora") as SnapshotAccion["tipo"],
      origen: (ORIGENES.has(String(s.origen)) ? s.origen : (id.startsWith("ia:") ? "ia_plan" : "senal")) as SnapshotAccion["origen"],
      porque: str(s.porque, 1200),
      pasos: Array.isArray(s.pasos) ? s.pasos.slice(0, 6).map((p) => str(p, 400)).filter(Boolean) : [],
      prioridad: (PRIOS.has(String(s.prioridad)) ? s.prioridad : "media") as SnapshotAccion["prioridad"],
      impacto: s.impacto ? str(s.impacto, 200) : null,
      kpi: s.kpi ? str(s.kpi, 120) : null,
    };
  }
  return { ok: true, value: { id, dash, estado, titulo, snapshot } };
}

// ── "Mis acciones" ───────────────────────────────────────────────────────────
export interface MiAccion extends AccionSeguida {
  /** La tarjeta sigue saliendo hoy (señal o Diagnóstico IA). false = "ya no aparece en los datos". */
  vigente: boolean;
  /** La tarjeta actual (si sigue vigente), para mostrarla con los datos de hoy. */
  actual: Recomendacion | null;
}
const ORDEN_ESTADO: Record<EstadoAccion, number> = { planificada: 0, hecha: 1, descartada: 2 };

/**
 * Cruza lo marcado con las tarjetas de hoy: todas las marcadas (aunque ya no salgan), primero las
 * "La voy a hacer", después las hechas y al final las descartadas; dentro de cada grupo, lo más reciente primero.
 */
export function misAcciones(seguidas: AccionSeguida[], actuales: Recomendacion[]): MiAccion[] {
  const porId = new Map(actuales.map((r) => [r.id, r]));
  return seguidas
    .map((a) => ({ ...a, vigente: porId.has(a.id), actual: porId.get(a.id) ?? null }))
    .sort((a, b) => ORDEN_ESTADO[a.estado] - ORDEN_ESTADO[b.estado] || b.updatedAt.localeCompare(a.updatedAt));
}

/** Estado actual de cada tarjeta marcada (para pintar los botones de "Qué hacer ahora"). */
export function estadoPorId(seguidas: AccionSeguida[]): Map<string, EstadoAccion> {
  return new Map(seguidas.map((a) => [a.id, a.estado]));
}

/** Aplica localmente un cambio de estado (UI optimista) sin duplicar ids. */
export function aplicarCambio(seguidas: AccionSeguida[], cambio: AccionSeguida): AccionSeguida[] {
  return [cambio, ...seguidas.filter((a) => a.id !== cambio.id)];
}
