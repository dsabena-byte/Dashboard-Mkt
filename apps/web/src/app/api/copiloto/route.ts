import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase-server";
import { allowedFromRows, isPathAllowed } from "@/lib/dashboard-access";
import { verificarRespuesta, marcarRevisado, desactivarVerificada } from "@/lib/chat/feedback-server";

// Calidad del copiloto (/copiloto; portado de la vista de staff de BIP). Acceso = dashboard_access de
// /copiloto (sin filas = ve todo). Drean no tiene roles de staff: quien puede ver la página revisa.
//   action "verificar"   → guarda la respuesta (corregida o tal cual) como VERIFICADA; el copiloto la
//                          reusa como ejemplo de método en preguntas parecidas.
//   action "revisado"    → marca un 👎 como revisado (baja en la lista de "peores").
//   action "desactivar"  → saca una verificada.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  let email: string | null = null;
  try {
    const supabase = getServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "no autenticado" }, { status: 401 });
    email = user.email ?? null;
    let allowed: string[] | null = null;
    try { const { data } = await supabase.from("dashboard_access").select("dashboard_path"); allowed = allowedFromRows(data as { dashboard_path: string }[] | null); } catch { allowed = null; }
    if (!isPathAllowed("/copiloto", allowed)) return NextResponse.json({ error: "Tu usuario no tiene acceso a Calidad del copiloto." }, { status: 403 });
  } catch { return NextResponse.json({ error: "no autenticado" }, { status: 401 }); }

  const b = ((await req.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;
  const action = String(b.action ?? "");
  const id = Number(b.id);
  if (action === "verificar") {
    const pregunta = typeof b.pregunta === "string" ? b.pregunta.trim().slice(0, 2000) : "";
    const respuesta = typeof b.respuesta === "string" ? b.respuesta.trim().slice(0, 12000) : "";
    if (!pregunta || !respuesta) return NextResponse.json({ error: "faltan pregunta o respuesta" }, { status: 400 });
    const tools = Array.isArray(b.tools) ? b.tools.filter((t): t is string => typeof t === "string" && /^[a-z_]{2,40}$/.test(t)).slice(0, 20) : [];
    const pathname = typeof b.pathname === "string" && b.pathname.startsWith("/") ? b.pathname.slice(0, 200) : null;
    const r = await verificarRespuesta({ feedbackId: Number.isFinite(id) && id > 0 ? id : null, pregunta, respuesta, tools, pathname, email });
    return NextResponse.json(r, { status: r.ok ? 200 : 400 });
  }
  if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ error: "falta id" }, { status: 400 });
  if (action === "revisado") return NextResponse.json({ ok: await marcarRevisado(id) });
  if (action === "desactivar") return NextResponse.json({ ok: await desactivarVerificada(id) });
  return NextResponse.json({ error: "acción inválida" }, { status: 400 });
}
