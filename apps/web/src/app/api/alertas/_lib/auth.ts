import "server-only";
import { getServerSupabase } from "@/lib/supabase-server";
import { isPathAllowed } from "@/lib/dashboard-access";
import { getAllowedPaths } from "@/lib/usuarios-server";

// Auth de las APIs de Alertas: usuario logueado con acceso a /alerts (grupo del usuario, tabla usuarios).
export async function alertasUser(): Promise<{ ok: true; email: string | null } | { ok: false; status: number; error: string }> {
  try {
    const supabase = getServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, status: 401, error: "no autenticado" };
    if (!isPathAllowed("/alerts", await getAllowedPaths())) return { ok: false, status: 403, error: "Tu usuario no tiene acceso a Alertas y reportes." };
    return { ok: true, email: user.email ?? null };
  } catch {
    return { ok: false, status: 401, error: "no autenticado" };
  }
}
