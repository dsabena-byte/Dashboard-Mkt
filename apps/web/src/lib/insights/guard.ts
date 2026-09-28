// ============================================================================
// Guarda del Diagnóstico IA (portado de la plataforma de origen, sep-2026). PURO y client-safe.
// Si el tablero ya tiene un diagnóstico de hace menos de GUARD_HORAS y el pedido no trae
// `force: true`, la API devuelve el guardado SIN llamar a OpenAI (ahorra costo y evita versiones
// repetidas por un doble clic). El botón muestra "Ya tenés un diagnóstico de hace X. ¿Generar otro?"
// y, si el usuario confirma, reenvía con force.
// Test: cd apps/web && npx tsx scripts/recomendacion-seguimiento.test.ts
// ============================================================================

export const GUARD_HORAS = 12;
const HORA = 3_600_000;

/** ¿Hay que devolver el diagnóstico guardado en vez de generar uno nuevo? */
export function debeReusarDiagnostico(ultimoCreadoISO: string | null | undefined, ahora: Date, force: boolean, horas = GUARD_HORAS): { reusar: boolean; edadMs: number | null } {
  if (!ultimoCreadoISO) return { reusar: false, edadMs: null };
  const t = Date.parse(ultimoCreadoISO);
  if (!Number.isFinite(t)) return { reusar: false, edadMs: null };
  const edadMs = Math.max(0, ahora.getTime() - t);
  return { reusar: !force && edadMs < horas * HORA, edadMs };
}

/** "5 minutos", "1 hora", "3 horas", "2 días" — para el aviso de la guarda. */
export function haceTexto(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms)) return "un rato";
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "menos de un minuto";
  if (min < 60) return `${min} minuto${min === 1 ? "" : "s"}`;
  const h = Math.floor(ms / HORA);
  if (h < 48) return `${h} hora${h === 1 ? "" : "s"}`;
  const d = Math.floor(ms / (24 * HORA));
  return `${d} días`;
}

/** "27/09 14:05" (hora de Argentina). */
export function fechaCorta(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Buenos_Aires", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(d);
  const p = (t: string) => (parts.find((x) => x.type === t)?.value ?? "").padStart(2, "0");
  return `${p("day")}/${p("month")} ${p("hour") === "24" ? "00" : p("hour")}:${p("minute")}`;
}
