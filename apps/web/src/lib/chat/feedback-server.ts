import "server-only";
import { sbAdmin } from "@/lib/supabase-admin";
import type { FeedbackInput, FeedbackRow, Verificada } from "@/lib/chat/verified";

// Persistencia del feedback del copiloto y de las respuestas verificadas (migración 0120; portado de BIP).
// Por REST con la service key. Fail-safe: sin las tablas NADA rompe (guardar devuelve stored:false, leer []).
export const MIGRACION_COPILOTO = "Falta correr la migración 0120_copiloto_feedback.sql en el SQL Editor de Supabase.";
const MISSING_RE = /PGRST205|42P01|does not exist|could not find the table/i;

async function req(path: string, init: RequestInit & { method: string }): Promise<{ ok: boolean; missing: boolean; data: unknown }> {
  try {
    const res = await sbAdmin(path, init);
    if (!res.ok) { const t = await res.text().catch(() => ""); return { ok: false, missing: res.status === 404 || MISSING_RE.test(t), data: null }; }
    const txt = await res.text();
    return { ok: true, missing: false, data: txt ? JSON.parse(txt) : null };
  } catch { return { ok: false, missing: false, data: null }; }
}

export async function guardarFeedback(userEmail: string | null, model: string, f: FeedbackInput): Promise<{ stored: boolean; id?: number }> {
  const r = await req("chat_feedback", {
    method: "POST", headers: { Prefer: "return=representation" },
    body: JSON.stringify([{ user_email: userEmail, rating: f.rating, motivo: f.motivo, comentario: f.comentario, pregunta: f.pregunta, respuesta: f.respuesta, tools: f.tools, pathname: f.pathname, model }]),
  });
  if (!r.ok) return { stored: false };
  return { stored: true, id: (r.data as { id: number }[] | null)?.[0]?.id };
}

// Cache corto por instancia: el copiloto lee las verificadas en cada pregunta.
let cacheVer: { at: number; rows: Verificada[] } | null = null;

/** Verificadas activas (ejemplos de método para el copiloto). */
export async function verificadasActivas(): Promise<Verificada[]> {
  if (cacheVer && Date.now() - cacheVer.at < 60_000) return cacheVer.rows;
  const r = await req("chat_verified?activo=eq.true&select=id,pregunta,respuesta,tools,pathname&order=id.desc&limit=300", { method: "GET" });
  if (!r.ok) return [];
  const rows = ((r.data as Record<string, unknown>[]) ?? []).map((x) => ({ id: Number(x.id), pregunta: String(x.pregunta), respuesta: String(x.respuesta), tools: Array.isArray(x.tools) ? (x.tools as string[]) : [], pathname: (x.pathname as string | null) ?? null }));
  cacheVer = { at: Date.now(), rows };
  return rows;
}

// ── Revisión (/copiloto) ─────────────────────────────────────────────────────
export interface RevisionCopiloto {
  disponible: boolean;
  feedback: FeedbackRow[];
  verificadas: (Verificada & { verified_by: string | null; created_at: string })[];
}

export async function cargarRevision(dias = 90): Promise<RevisionCopiloto> {
  const desde = new Date(Date.now() - dias * 86_400_000).toISOString();
  const [fb, ver] = await Promise.all([
    req(`chat_feedback?created_at=gte.${encodeURIComponent(desde)}&select=id,user_email,rating,motivo,comentario,pregunta,respuesta,tools,pathname,revisado,created_at&order=created_at.desc&limit=2000`, { method: "GET" }),
    req("chat_verified?activo=eq.true&select=id,pregunta,respuesta,tools,pathname,verified_by,created_at&order=id.desc&limit=300", { method: "GET" }),
  ]);
  if (!fb.ok && fb.missing) return { disponible: false, feedback: [], verificadas: [] };
  return {
    disponible: fb.ok,
    feedback: ((fb.data as Record<string, unknown>[]) ?? []).map((r) => ({
      id: Number(r.id), user_email: (r.user_email as string | null) ?? null, rating: Number(r.rating), motivo: (r.motivo as string | null) ?? null,
      comentario: (r.comentario as string | null) ?? null, pregunta: String(r.pregunta), respuesta: String(r.respuesta),
      tools: Array.isArray(r.tools) ? (r.tools as string[]) : [], pathname: (r.pathname as string | null) ?? null,
      revisado: Boolean(r.revisado), created_at: String(r.created_at),
    })),
    verificadas: ((ver.ok ? ver.data : []) as Record<string, unknown>[] ?? []).map((r) => ({
      id: Number(r.id), pregunta: String(r.pregunta), respuesta: String(r.respuesta), tools: Array.isArray(r.tools) ? (r.tools as string[]) : [],
      pathname: (r.pathname as string | null) ?? null, verified_by: (r.verified_by as string | null) ?? null, created_at: String(r.created_at),
    })),
  };
}

export async function verificarRespuesta(p: { feedbackId: number | null; pregunta: string; respuesta: string; tools: string[]; pathname: string | null; email: string | null }): Promise<{ ok: boolean; error?: string }> {
  const r = await req("chat_verified", {
    method: "POST", headers: { Prefer: "return=minimal" },
    body: JSON.stringify([{ pregunta: p.pregunta, respuesta: p.respuesta, tools: p.tools, pathname: p.pathname, feedback_id: p.feedbackId, verified_by: p.email }]),
  });
  if (!r.ok) return { ok: false, error: r.missing ? MIGRACION_COPILOTO : "No se pudo guardar." };
  if (p.feedbackId) await marcarRevisado(p.feedbackId);
  cacheVer = null;
  return { ok: true };
}

export async function marcarRevisado(feedbackId: number): Promise<boolean> {
  return (await req(`chat_feedback?id=eq.${feedbackId}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ revisado: true }) })).ok;
}

export async function desactivarVerificada(id: number): Promise<boolean> {
  const ok = (await req(`chat_verified?id=eq.${id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ activo: false }) })).ok;
  cacheVer = null;
  return ok;
}
