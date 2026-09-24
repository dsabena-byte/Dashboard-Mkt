import "server-only";
import { getServerSupabase } from "@/lib/supabase-server";
import { allowedFromRows, isPathAllowed } from "@/lib/dashboard-access";

// Auth de las APIs de Alertas: usuario logueado con acceso a /alerts (dashboard_access sin filas = ve
// todo). El middleware no aplica dashboard_access a /api, por eso se chequea acá.
export async function alertasUser(): Promise<{ ok: true; email: string | null } | { ok: false; status: number; error: string }> {
  try {
    const supabase = getServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, status: 401, error: "no autenticado" };
    let allowed: string[] | null = null;
    try {
      const { data } = await supabase.from("dashboard_access").select("dashboard_path");
      allowed = allowedFromRows(data as { dashboard_path: string }[] | null);
    } catch { allowed = null; }
    if (!isPathAllowed("/alerts", allowed)) return { ok: false, status: 403, error: "Tu usuario no tiene acceso a Alertas y reportes." };
    return { ok: true, email: user.email ?? null };
  } catch {
    return { ok: false, status: 401, error: "no autenticado" };
  }
}
