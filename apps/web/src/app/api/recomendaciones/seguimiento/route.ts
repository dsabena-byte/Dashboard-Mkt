import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase-server";
import { allowedFromRows, isPathAllowed } from "@/lib/dashboard-access";
import { DIAG_DASHES } from "@/lib/insights/types";
import { sanearAccion } from "@/lib/recomendacion-seguimiento";
import { guardarSeguimiento, listSeguimiento, SeguimientoNoDisponible, MIGRACION_SEGUIMIENTO } from "@/lib/recomendacion-seguimiento-server";

// "Mis acciones" (migración 0122): seguimiento de las tarjetas de "Qué hacer ahora".
//   GET  ?dash=<tablero>                                   → { disponible, items }
//   POST { id, dash, estado, titulo, snapshot }             → { ok, item } (upsert por id)
// Exige sesión (se guarda el email del autor) y acceso al tablero (dashboard_access).
// La tabla se lee/escribe SOLO acá, con la service key (RLS sin policies).
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
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

const puedeVer = (dash: string, allowed: string[] | null) => (DIAG_DASHES as readonly string[]).includes(dash) && isPathAllowed(`/${dash}`, allowed);

export async function GET(req: Request) {
  const u = await usuario();
  if (!u) return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  const dash = new URL(req.url).searchParams.get("dash") ?? "";
  if (!puedeVer(dash, u.allowed)) return NextResponse.json({ error: "sin acceso a ese tablero" }, { status: 403 });
  const r = await listSeguimiento(dash);
  return NextResponse.json({ ...r, ...(r.disponible ? {} : { aviso: MIGRACION_SEGUIMIENTO }) });
}

export async function POST(req: Request) {
  const u = await usuario();
  if (!u) return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  const c = sanearAccion(await req.json().catch(() => null), DIAG_DASHES);
  if (!c.ok) return NextResponse.json({ error: c.error }, { status: 400 });
  if (!puedeVer(c.value.dash, u.allowed)) return NextResponse.json({ error: "Tu usuario no tiene acceso a ese tablero." }, { status: 403 });
  try {
    const item = await guardarSeguimiento(c.value, u.email);
    return NextResponse.json({ ok: true, item });
  } catch (e) {
    if (e instanceof SeguimientoNoDisponible) return NextResponse.json({ error: e.message, disponible: false }, { status: 503 });
    return NextResponse.json({ error: e instanceof Error ? e.message : "No se pudo guardar la acción." }, { status: 500 });
  }
}
