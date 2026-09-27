import { NextResponse } from "next/server";
import { syncSeoAudit } from "@/lib/seo-audit";

// Cron: auditoría técnica SEO/GEO + Core Web Vitals de drean.com.ar → seo_audit_snapshot (id=1,
// migración 0117). Lo dispara .github/workflows/seo-audit.yml (semanal, lunes + manual).
// Gated por CRON_SECRET. Sin GOOGLE_PSI_KEY corre igual (PSI con cuota compartida; la UI avisa).
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const t0 = Date.now();
    const { data, persisted, keptPrevious } = await syncSeoAudit();
    return NextResponse.json({
      ok: data.ok && persisted,
      persisted,
      keptPrevious,
      hint: !persisted && !keptPrevious ? "No se pudo guardar: ¿corriste la migración 0117_web_calidad_seo_audit.sql?" : undefined,
      error: data.ok ? undefined : data.error,
      paginas: data.paginas?.length ?? 0,
      issues: data.issues?.length ?? 0,
      salud: data.salud ?? null,
      cwv: data.cwv?.length ?? 0,
      psiKey: data.psiKey ?? false,
      ms: Date.now() - t0,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
