import { NextResponse } from "next/server";
import { sbAdmin } from "@/lib/supabase-admin";
import { CAT_GENERAL } from "@/lib/metas";
import { auditar } from "@/lib/presupuesto-server";
import { calcPlan, PLAN_META_KPIS, sanearPlan } from "@/lib/plan-medios-anual";
import { getInflacionMes, getPlanAnual, getRefMeses, guardarPlanAnual } from "@/lib/plan-medios-anual-server";
import { conUsuario, soloEditor } from "../presupuesto/_auth";

// Plan de Medios anual. Solo los editores del presupuesto (bgt_editores).
//  PUT  {anio, config} → guarda el plan.
//  POST {anio}         → escribe las metas mensuales "Pauta Mkt" de ese año calculadas desde el plan GUARDADO
//                        (se recalcula acá: no se confía en números del navegador).
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const anioOk = (a: unknown) => Number.isInteger(a) && (a as number) >= 2024 && (a as number) <= 2035;
const UNIDAD: Record<string, string> = { "Inversión": "$", "Frecuencia": "x", "VTR (≥50%)": "%" };

export async function PUT(req: Request) {
  return conUsuario(async (u) => {
    const deny = soloEditor(u);
    if (deny) return deny;
    const b = (await req.json().catch(() => ({}))) as { anio?: unknown; config?: unknown };
    if (!anioOk(b.anio)) return NextResponse.json({ error: "Año inválido" }, { status: 400 });
    await guardarPlanAnual(sanearPlan(b.config, b.anio as number), u.email);
    return NextResponse.json({ ok: true });
  });
}

export async function POST(req: Request) {
  return conUsuario(async (u) => {
    const deny = soloEditor(u);
    if (deny) return deny;
    const b = (await req.json().catch(() => ({}))) as { anio?: unknown };
    if (!anioOk(b.anio)) return NextResponse.json({ error: "Año inválido" }, { status: 400 });
    const anio = b.anio as number;
    const plan = await getPlanAnual(anio);
    if (!plan.guardado) return NextResponse.json({ error: "Guardá el plan antes de usarlo como metas." }, { status: 400 });
    const [refMeses, infl] = await Promise.all([getRefMeses(), getInflacionMes()]);
    const { metas } = calcPlan(plan.config, refMeses, infl);
    const now = new Date().toISOString();
    const valores = PLAN_META_KPIS.flatMap((kpi) => metas[kpi].map((valor, i) => ({ plan: "Pauta Mkt", kpi, categoria: CAT_GENERAL, anio, mes: i + 1, valor, updated_at: now })));
    // Config solo para los KPIs que no la tienen (no pisa dirección/umbrales que el user ya ajustó).
    const cfgRes = await sbAdmin(`kpi_meta_config?plan=eq.${encodeURIComponent("Pauta Mkt")}&categoria=eq.${CAT_GENERAL}&select=kpi`, { method: "GET" });
    const conCfg = new Set(cfgRes.ok ? ((await cfgRes.json()) as { kpi: string }[]).map((r) => r.kpi) : []);
    const cfgNueva = PLAN_META_KPIS.filter((k) => !conCfg.has(k)).map((kpi) => ({
      plan: "Pauta Mkt", kpi, categoria: CAT_GENERAL, unidad: UNIDAD[kpi] ?? null, direccion: "up", referencia: "interno",
      frecuencia: "mensual", agregacion: "mensual", umbral_verde: 100, umbral_amarillo: 90, notas: null, updated_at: now,
    }));
    for (const [tabla, rows] of [["kpi_meta_config", cfgNueva], ["kpi_meta_valores", valores]] as const) {
      if (!rows.length) continue;
      const r = await sbAdmin(tabla, { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(rows) });
      if (!r.ok) return NextResponse.json({ error: `${tabla}: ${(await r.text()).slice(0, 200)}` }, { status: 500 });
    }
    await auditar([{ usuario: u.email, entidad: "plan_medios", accion: "metas", version: `Plan de Medios ${anio}`, clave: null, antes: null, despues: metas }]).catch(() => undefined);
    return NextResponse.json({ ok: true, metas });
  });
}
