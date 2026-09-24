import { NextResponse } from "next/server";
import { syncSearchConsole } from "@/lib/search-console";

// Cron: Google Search Console (drean.com.ar) → search_console_snapshot (id=1).
// Lo dispara .github/workflows/search-console-sync.yml (semanal + manual). Gated por
// CRON_SECRET (mismo patrón que los demás crons). Respuesta:
//  · ok:true  → snapshot guardado. Incluye los casos de CONFIGURACIÓN (no_scope /
//               api_disabled / no_site / no_creds): no son fallas del cron, la UI de
//               /seo-search los explica (y reintentar no los arregla).
//  · ok:false → error transitorio de Google (se conserva el snapshot bueno previo) o no se
//               pudo persistir (migración 0107 no corrida).
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { data, persisted, keptPrevious } = await syncSearchConsole();
    const configIssue = !data.ok && data.code !== "error";
    return NextResponse.json({
      ok: persisted && (data.ok || configIssue),
      persisted,
      keptPrevious,
      estado: data.ok ? "ok" : data.code,
      error: data.ok ? undefined : data.error,
      hint: !persisted && !keptPrevious ? "No se pudo guardar: ¿corriste la migración 0107_search_console.sql?" : undefined,
      site: data.site ?? null,
      sites: data.ok ? undefined : data.sites,
      meses: data.monthly?.length ?? 0,
      queries: data.queries?.length ?? 0,
      pages: data.pages?.length ?? 0,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
