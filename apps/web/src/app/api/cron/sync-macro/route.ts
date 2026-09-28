import { NextResponse } from "next/server";
import { runMacroSync } from "@/lib/macro-sync";

// Cron del dólar (oficial BCRA + MEP) → tabla indices_macro (migración 0110). Alimenta la opción USD
// del selector "$ / USD" de Plan de Medios. Ya no baja IPC (sin ajuste por inflación, 28-sep-2026).
// Gateado por CRON_SECRET (si existe). ?desde=YYYY-MM-DD = backfill (default: últimos ~25 meses).
// Workflow: .github/workflows/sync-macro.yml (días 2 y 16).
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const desde = new URL(request.url).searchParams.get("desde");
  const r = await runMacroSync({ desde: desde && /^\d{4}-\d{2}-\d{2}$/.test(desde) ? desde : undefined });
  return NextResponse.json(r, { status: r.ok ? 200 : 502 });
}
