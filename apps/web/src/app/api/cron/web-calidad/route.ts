import { NextResponse } from "next/server";
import { syncWebCalidad } from "@/lib/web-calidad-server";

// Cron: calidad del dato WEB → web_calidad_snapshot (id=1, migración 0117). Reportes GA4 de
// embudo / tráfico desde IA / landings (últimos 28 días vs previos) + tráfico IA mensual y chequeo
// de consent desde Supabase (pagina web_traffic de google/cpc: pesado, por eso vive acá y no en el
// render de /web). Lo dispara .github/workflows/web-cat-agg.yml (1x/día + manual). Gated por CRON_SECRET.
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const t0 = Date.now();
    const { data, persisted } = await syncWebCalidad();
    return NextResponse.json({
      ok: persisted,
      persisted,
      hint: persisted ? undefined : "No se pudo guardar: ¿corriste la migración 0117_web_calidad_seo_audit.sql?",
      ga4: data.ga4 ? { ok: data.ga4.ok, periodo: data.ga4.periodo, fallidos: data.ga4.failed, error: data.ga4.error } : null,
      iaMeses: data.iaMensual.length,
      consentMeses: data.consent ? Object.keys(data.consent.clicks).length : 0,
      errores: data.errores,
      ms: Date.now() - t0,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
