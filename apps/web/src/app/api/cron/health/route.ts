import { NextResponse } from "next/server";
import { getHealth } from "@/lib/monitoreo-queries";

export const dynamic = "force-dynamic";

// Estado de frescura de todos los procesos de datos. Lo consume el watchdog
// (GitHub Action) para decidir si abre alerta. `ok:false` si hay algún crítico.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const rows = await getHealth();
    const processes = rows.map((r) => ({
      id: r.proc.id,
      proceso: r.proc.proceso,
      conexion: r.proc.conexion,
      cadenciaH: r.proc.cadenciaH,
      estado: r.estado,
      ageH: r.ageH == null ? null : Math.round(r.ageH),
      lastUpdate: r.date,
    }));
    // Solo consideramos "desvío" lo crítico (atrasado es tolerancia, sindato es no medible).
    const desvios = processes.filter((p) => p.estado === "critico");
    return NextResponse.json({
      ok: desvios.length === 0,
      generatedAt: new Date().toISOString(),
      total: processes.length,
      criticos: desvios.length,
      desvios,
      processes,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
