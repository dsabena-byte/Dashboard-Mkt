import "server-only";
// Versiones guardadas del Diagnóstico IA (tabla `insights_report`, migración 0106; single-tenant).
// Guardar = versión nueva; leer = última versión (sin re-generar). FAIL-SAFE: si la migración no
// corrió (tabla inexistente), todo devuelve vacío/null y el diagnóstico se muestra igual sin guardar.
import type { Insights, ReportMeta } from "./types";

export interface SavedReport { id: number; createdAt: string; insights: Insights; model: string | null; signalsCount: number }
interface Row { id: number; dash: string; created_at: string; data: { insights?: Insights; model?: string; signalsCount?: number } | null }

function cfg() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? { url, key } : null;
}
/** Resultado de una llamada REST con el motivo real del error (status + cuerpo) cuando falla. */
type ReqResult<T> = { ok: true; data: T } | { ok: false; error: string };
async function reqDetalle<T>(path: string, init?: RequestInit): Promise<ReqResult<T>> {
  const c = cfg();
  if (!c) return { ok: false, error: "Supabase no configurado (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)." };
  try {
    const res = await fetch(`${c.url}/rest/v1/${path}`, { ...init, headers: { apikey: c.key, Authorization: `Bearer ${c.key}`, "Content-Type": "application/json", ...(init?.headers ?? {}) }, cache: "no-store" });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      const error = `HTTP ${res.status}: ${body.slice(0, 500)}`;
      // El error real va al log del servidor (Vercel), no se traga en silencio.
      console.error(`[insights/store] ${init?.method ?? "GET"} ${path.split("?")[0]} → ${error}`);
      return { ok: false, error };
    }
    return { ok: true, data: (await res.json()) as T };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error(`[insights/store] ${init?.method ?? "GET"} ${path.split("?")[0]} → ${error}`);
    return { ok: false, error };
  }
}
async function req<T>(path: string, init?: RequestInit): Promise<T | null> {
  const r = await reqDetalle<T>(path, init);
  return r.ok ? r.data : null;
}
const toSaved = (r: Row): SavedReport => ({ id: r.id, createdAt: r.created_at, insights: (r.data?.insights ?? null) as Insights, model: r.data?.model ?? null, signalsCount: r.data?.signalsCount ?? 0 });

export async function listReports(dash: string): Promise<ReportMeta[]> {
  const rows = await req<Row[]>(`insights_report?dash=eq.${encodeURIComponent(dash)}&select=id,dash,created_at,data&order=created_at.desc&limit=30`);
  return (rows ?? []).map((r) => ({ id: r.id, createdAt: r.created_at, diagnostico: String(r.data?.insights?.diagnostico ?? "").slice(0, 160), model: r.data?.model ?? null }));
}
export async function getReport(dash: string, id: number): Promise<SavedReport | null> {
  const rows = await req<Row[]>(`insights_report?dash=eq.${encodeURIComponent(dash)}&id=eq.${id}&select=id,dash,created_at,data`);
  return rows?.[0] ? toSaved(rows[0]) : null;
}
export async function getLatestReport(dash: string): Promise<SavedReport | null> {
  const rows = await req<Row[]>(`insights_report?dash=eq.${encodeURIComponent(dash)}&select=id,dash,created_at,data&order=created_at.desc&limit=1`);
  return rows?.[0] ? toSaved(rows[0]) : null;
}
/** Guarda una versión nueva. Si falla (p. ej. migración 0106 sin correr) devuelve `saved: null` + el error real. */
export async function saveReport(dash: string, insights: Insights, meta: { model: string; signalsCount: number }): Promise<{ saved: SavedReport | null; error: string | null }> {
  const r = await reqDetalle<Row[]>("insights_report?select=id,dash,created_at,data", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ dash, data: { insights, model: meta.model, signalsCount: meta.signalsCount } }),
  });
  if (!r.ok) return { saved: null, error: r.error };
  return r.data?.[0] ? { saved: toSaved(r.data[0]), error: null } : { saved: null, error: "La base no devolvió la fila guardada." };
}
