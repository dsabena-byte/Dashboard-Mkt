import { NextResponse } from "next/server";
import { getSeguimientoKpis } from "@/lib/objetivos-kpis";
import { histParaPronostico } from "@/lib/objetivos-pronostico";

// Historia real de los KPIs de un plan (año en curso + año anterior) para "Sugerir metas" del
// MetaPanel (lib/stats/sugerir, portado de BIP sep-2026). Se pide A DEMANDA (al tocar el botón),
// nunca en el render. Reusa el Seguimiento (mismas definiciones que las cards y el scorecard).
// Plan del MetaPanel → plan del Seguimiento (IG se carga como "Redes Sociales" y se mide como "Instagram").

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const maxDuration = 60;

const PLAN_SEG: Record<string, string> = { "Redes Sociales": "Instagram" };

export async function GET(req: Request) {
  const url = new URL(req.url);
  const plan = url.searchParams.get("plan") ?? "";
  const anio = Number(url.searchParams.get("anio")) || new Date().getUTCFullYear();
  if (!plan) return NextResponse.json({ error: "Falta plan" }, { status: 400 });
  try {
    const planSeg = PLAN_SEG[plan] ?? plan;
    const kpis = (await getSeguimientoKpis(anio)).filter((k) => k.plan === planSeg);
    return NextResponse.json({
      anio,
      kpis: kpis.map((k) => ({ kpi: k.kpi, tipo: k.tipo, direccion: k.direccion, unidad: k.unit, realM: k.realM, histM: histParaPronostico(k.histM) })),
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e), kpis: [] }, { status: 500 });
  }
}
