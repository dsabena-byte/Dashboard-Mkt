// Alertas y reportes — tipos + helpers PUROS (client-safe). La parte server está en lib/alerts.ts.
// Portado de BIP (sep-2026), single-tenant (Drean).

/** auto = resumen semanal (lunes) + alertas diarias SOLO si aparece algo nuevo de prioridad alta. */
export type Frecuencia = "auto" | "semanal" | "diaria" | "off";
export const FRECUENCIAS: Frecuencia[] = ["auto", "semanal", "diaria", "off"];
export const FREC_LABEL: Record<Frecuencia, string> = {
  auto: "Resumen semanal (lunes) + alertas diarias de prioridad alta",
  semanal: "Solo el resumen semanal (lunes)",
  diaria: "Solo alertas diarias (cuando aparece algo nuevo de prioridad alta)",
  off: "No recibir emails de alertas",
};

export interface AlertPrefs { emailOn: boolean; frecuencia: Frecuencia; destinatarios: string[]; reporteOn: boolean; migrated: boolean }

export interface AlertItem {
  key: string;
  fuente: "senal" | "objetivo" | "competencia";
  dash: string;
  tipo: "alerta" | "oportunidad" | "info";
  prioridad: "alta" | "media" | "baja";
  titulo: string;
  descripcion: string;
  accion?: string | null;
  href: string;
  nueva?: boolean; // no se envió en la ventana de dedupe
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function cleanRecipients(list: unknown): string[] {
  const arr = Array.isArray(list) ? list : String(list ?? "").split(/[,;\s]+/);
  return [...new Set(arr.map((x) => String(x).trim().toLowerCase()).filter((x) => EMAIL_RE.test(x)))].slice(0, 20);
}

/** Qué email toca HOY según la frecuencia (lunes = semanal; resto = diario). Hora AR (UTC-3). */
export function modoDelDia(frec: Frecuencia, now = new Date()): "semanal" | "diaria" | null {
  if (frec === "off") return null;
  const lunes = new Date(now.getTime() - 3 * 3_600_000).getUTCDay() === 1;
  if (lunes && (frec === "auto" || frec === "semanal")) return "semanal";
  if (frec === "auto" || frec === "diaria") return "diaria";
  return null;
}

const PRIO_ORDER = { alta: 0, media: 1, baja: 2 } as const;
export function sortItems(items: AlertItem[]): AlertItem[] {
  return [...items].sort((a, b) => PRIO_ORDER[a.prioridad] - PRIO_ORDER[b.prioridad] || (a.tipo === "alerta" ? 0 : 1) - (b.tipo === "alerta" ? 0 : 1));
}

/** Selección del digest. Diaria = solo si hay algo NUEVO de prioridad alta. */
export function selectDigest(items: AlertItem[], sent: Set<string> | null, modo: "semanal" | "diaria" | "prueba"): AlertItem[] {
  const mark = items.map((x) => ({ ...x, nueva: sent ? !sent.has(x.key) : true }));
  if (modo === "diaria") {
    const nuevasAltas = mark.filter((x) => x.nueva && x.prioridad === "alta");
    if (!nuevasAltas.length) return [];
    return [...nuevasAltas, ...mark.filter((x) => x.nueva && x.prioridad === "media")].slice(0, 8);
  }
  const relevantes = mark.filter((x) => x.prioridad !== "baja");
  // Semanal / prueba: primero lo nuevo, después lo que sigue abierto (máx. 12).
  return [...relevantes.filter((x) => x.nueva), ...relevantes.filter((x) => !x.nueva)].slice(0, 12);
}

/** Primer día hábil (lun-vie) del mes, en hora AR. */
export function isFirstBusinessDay(now = new Date()): boolean {
  const ar = new Date(now.getTime() - 3 * 3_600_000);
  const y = ar.getUTCFullYear(), m = ar.getUTCMonth();
  for (let d = 1; d <= 7; d++) {
    const dow = new Date(Date.UTC(y, m, d)).getUTCDay();
    if (dow !== 0 && dow !== 6) return ar.getUTCDate() === d;
  }
  return false;
}
