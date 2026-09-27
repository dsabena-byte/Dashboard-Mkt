import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase-server";
import { parseFeedback } from "@/lib/chat/verified";
import { guardarFeedback } from "@/lib/chat/feedback-server";
import { chatModel } from "@/lib/chat/copiloto";

// 👍/👎 + "¿qué estaba mal?" de una respuesta del copiloto (portado de BIP). Cualquier usuario logueado
// (usa el copiloto). Sin la migración 0120 responde ok con stored:false (la UI agradece igual).
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  let email: string | null = null;
  try {
    const { data: { user } } = await getServerSupabase().auth.getUser();
    if (!user) return NextResponse.json({ error: "no autenticado" }, { status: 401 });
    email = user.email ?? null;
  } catch { return NextResponse.json({ error: "no autenticado" }, { status: 401 }); }
  const raw = await req.text().catch(() => "");
  if (raw.length > 64 * 1024) return NextResponse.json({ error: "demasiado largo" }, { status: 413 });
  let body: unknown = null;
  try { body = JSON.parse(raw); } catch { body = null; }
  const p = parseFeedback(body);
  if (!p.ok) return NextResponse.json({ error: p.error }, { status: 400 });
  const r = await guardarFeedback(email, chatModel(), p.v);
  return NextResponse.json({ ok: true, stored: r.stored });
}
