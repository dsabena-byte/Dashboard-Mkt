import "server-only";
import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase-server";
import { checkRateLimit } from "@/lib/chat/rate-limit";

// Cuota DIARIA por usuario y función para todo lo que gasta en OpenAI o fal (auditoría D-10).
// Topes holgados para un equipo de ~8 (frenan un abuso o un loop, no el uso normal):
// chat 300 · diagnóstico IA 20 · Mis tableros 100 · resumen de sentimiento 100 · lector de reportes de
// Mkt Canal 60 · textos (guion UGC) 100 · imágenes fal 40 · videos fal 10 (los más caros, ~US$1–6 c/u).
export const AI_DAILY = {
  chat: 300,
  insights: 20,
  tableros: 100,
  sentimiento: 100,
  mkt_canal: 60,
  texto: 100,
  imagen: 40,
  video: 10,
} as const;
export type AiFeature = keyof typeof AI_DAILY;

const NOMBRE: Record<AiFeature, string> = {
  chat: "consultas al copiloto",
  insights: "diagnósticos IA",
  tableros: "pedidos a la IA de Mis tableros",
  sentimiento: "resúmenes de sentimiento",
  mkt_canal: "reportes leídos con IA",
  texto: "textos generados con IA",
  imagen: "imágenes generadas con IA",
  video: "videos generados con IA",
};

// Persistida en ai_usage vía la RPC ai_usage_take (migración 0135).
// Fail-safe: sin la migración (404 / PGRST202 / PGRST205 / 42P01 / 42883) cae al freno en memoria; ante
// cualquier otro error de infraestructura DEJA PASAR y loguea (un hipo de la base no corta el producto).
export async function takeAiQuota(email: string, feature: AiFeature): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const memoria = () => checkRateLimit(`ai:${feature}:${email}`).ok;
  if (!url || !key) return memoria();
  try {
    const r = await fetch(`${url}/rest/v1/rpc/ai_usage_take`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_email: email, p_feature: feature, p_limit: AI_DAILY[feature] }),
      cache: "no-store",
    });
    const txt = await r.text();
    if (r.ok) return txt.trim() === "true";
    if (r.status === 404 || /PGRST202|PGRST205|42P01|42883/.test(txt)) return memoria();
    console.error(`[ai-quota] ${feature}: RPC ${r.status} ${txt.slice(0, 200)} (se deja pasar)`);
    return true;
  } catch (e) {
    console.error(`[ai-quota] ${feature}: ${e instanceof Error ? e.message : String(e)} (se deja pasar)`);
    return true;
  }
}

// Para las rutas: usuario de la sesión + cuota. Devuelve la respuesta de error (401/429) o null si puede seguir.
export async function aiQuotaGate(feature: AiFeature): Promise<NextResponse | null> {
  const { data: { user } } = await getServerSupabase().auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "no autenticado" }, { status: 401 });
  if (await takeAiQuota(user.email ?? user.id, feature)) return null;
  return NextResponse.json(
    { ok: false, error: `Llegaste al tope diario de ${NOMBRE[feature]} (${AI_DAILY[feature]} por día). Probá mañana.` },
    { status: 429 },
  );
}
