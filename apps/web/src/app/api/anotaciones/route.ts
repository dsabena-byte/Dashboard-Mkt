import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase-server";
import { allowedFromRows } from "@/lib/dashboard-access";
import { addAnotacion, getAnotacion, listAnotaciones, MIGRACION_ANOTACIONES, puedeAnotar, removeAnotacion } from "@/lib/anotaciones";
import { cleanAnotacion } from "@/lib/anotaciones-core";

// Anotaciones en gráficos (migración 0119): GET ?tablero= lista (las del tablero + las de todo el
// dashboard) · POST alta · DELETE baja. Acceso = dashboard_access del tablero ("t-…" = /tableros);
// las de "todo el dashboard" (tablero null) solo las crea/borra un usuario sin restricción.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function usuario(): Promise<{ email: string | null; allowed: string[] | null } | null> {
  try {
    const supabase = getServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    let allowed: string[] | null = null;
    try { const { data } = await supabase.from("dashboard_access").select("dashboard_path"); allowed = allowedFromRows(data as { dashboard_path: string }[] | null); } catch { allowed = null; }
    return { email: user.email ?? null, allowed };
  } catch { return null; }
}

export async function GET(req: Request) {
  const u = await usuario();
  if (!u) return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  const tb = new URL(req.url).searchParams.get("tablero");
  if (!tb || !puedeAnotar(tb, u.allowed)) return NextResponse.json({ error: "sin acceso a ese tablero" }, { status: 403 });
  const r = await listAnotaciones({ tablero: tb });
  return NextResponse.json({ ...r, puedeGlobal: u.allowed === null });
}

export async function POST(req: Request) {
  const u = await usuario();
  if (!u) return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const c = cleanAnotacion(body);
  if (!c.ok) return NextResponse.json({ error: c.error }, { status: 400 });
  if (!puedeAnotar(c.value.tablero, u.allowed)) return NextResponse.json({ error: c.value.tablero == null ? "Solo un usuario con acceso a todo el dashboard puede anotar para todos los tableros." : "Tu usuario no tiene acceso a ese tablero." }, { status: 403 });
  try {
    return NextResponse.json({ nota: await addAnotacion({ ...c.value, autor: u.email }) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: msg }, { status: msg === MIGRACION_ANOTACIONES ? 503 : 500 });
  }
}

export async function DELETE(req: Request) {
  const u = await usuario();
  if (!u) return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  const id = String(((await req.json().catch(() => ({}))) as { id?: unknown }).id ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "id inválido" }, { status: 400 });
  const nota = await getAnotacion(id);
  if (!nota) return NextResponse.json({ ok: true });
  if (!puedeAnotar(nota.tablero, u.allowed)) return NextResponse.json({ error: "Tu usuario no puede borrar esa anotación." }, { status: 403 });
  try { await removeAnotacion(id); return NextResponse.json({ ok: true }); }
  catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500 }); }
}
