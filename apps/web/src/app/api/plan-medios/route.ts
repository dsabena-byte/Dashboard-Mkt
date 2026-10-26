import { NextResponse } from "next/server";
import { sbAdmin } from "@/lib/supabase-admin";
import { CAT_GENERAL } from "@/lib/metas";
import { auditar } from "@/lib/presupuesto-server";
import { calcInversion, calcPlan, PLAN_META_KPIS, sanearPlan } from "@/lib/plan-medios-anual";
import { getInflacionMes, getPlanAnual, getRefMeses, guardarPlanAnual } from "@/lib/plan-medios-anual-server";
import { PLANES_OTROS, proyectarOtros, sanearOtros } from "@/lib/plan-otros-kpis";
import { sanearCanal } from "@/lib/plan-canal";
import { getHistOtros } from "@/lib/plan-otros-kpis-server";
import { conUsuario, soloEditor } from "../presupuesto/_auth";
import { exigirEdicion } from "@/lib/usuarios-server";

// Plan de Medios anual. Solo los editores del presupuesto (bgt_editores).
//  PUT  {anio, config} → guarda el plan (sin tocar `otros`: eso se edita en las pestañas "Plan anual" de cada tablero).
//  PATCH {anio, otros?, canal?} → guarda solo el calendario/ambición de Web, Redes y SEO y/o el plan de Mkt Canal.
//  POST {anio}         → escribe las metas mensuales "Pauta Mkt" de ese año calculadas desde el plan GUARDADO
//                        (se recalcula acá: no se confía en números del navegador).
//  POST {anio, plan}   → idem para Web / Redes Sociales / Facebook / Mercado y competencia (sección 6 del plan).
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const anioOk = (a: unknown) => Number.isInteger(a) && (a as number) >= 2024 && (a as number) <= 2035;
const UNIDAD: Record<string, string> = { "Inversión": "$", "Frecuencia": "x", "VTR (≥50%)": "%" };

export async function PUT(req: Request) {
  return conUsuario(async (u) => {
    const deny = soloEditor(u);
    if (deny) return deny;
    const sinPermiso = await exigirEdicion("marketing");
    if (sinPermiso) return sinPermiso;
    const b = (await req.json().catch(() => ({}))) as { anio?: unknown; config?: unknown };
    if (!anioOk(b.anio)) return NextResponse.json({ error: "Año inválido" }, { status: 400 });
    const cfg = sanearPlan(b.config, b.anio as number);
    const guardado = (await getPlanAnual(b.anio as number)).config;
    cfg.otros = guardado.otros;
    cfg.canal = guardado.canal;
    await guardarPlanAnual(cfg, u.email);
    return NextResponse.json({ ok: true });
  });
}

export async function PATCH(req: Request) {
  return conUsuario(async (u) => {
    const deny = soloEditor(u);
    if (deny) return deny;
    const sinPermiso = await exigirEdicion("marketing");
    if (sinPermiso) return sinPermiso;
    const b = (await req.json().catch(() => ({}))) as { anio?: unknown; otros?: unknown; canal?: unknown };
    if (!anioOk(b.anio)) return NextResponse.json({ error: "Año inválido" }, { status: 400 });
    const plan = await getPlanAnual(b.anio as number);
    await guardarPlanAnual({
      ...plan.config,
      ...(b.otros !== undefined ? { otros: sanearOtros(b.otros) } : {}),
      ...(b.canal !== undefined ? { canal: sanearCanal(b.canal) } : {}),
    }, u.email);
    return NextResponse.json({ ok: true });
  });
}

export async function POST(req: Request) {
  return conUsuario(async (u) => {
    const deny = soloEditor(u);
    if (deny) return deny;
    const sinPermiso = await exigirEdicion("marketing");
    if (sinPermiso) return sinPermiso;
    const b = (await req.json().catch(() => ({}))) as { anio?: unknown; plan?: unknown };
    if (!anioOk(b.anio)) return NextResponse.json({ error: "Año inválido" }, { status: 400 });
    const anio = b.anio as number;
    const plan = await getPlanAnual(anio);
    if (!plan.guardado) return NextResponse.json({ error: "Guardá el plan antes de usarlo como metas." }, { status: 400 });
    let metaPlan = "Pauta Mkt";
    let filas: { kpi: string; unidad: string | null; direccion: string; valores: (number | null)[]; porCat?: Record<string, number[]> }[];
    if (b.plan != null) {
      if (!PLANES_OTROS.some((p) => p.plan === b.plan)) return NextResponse.json({ error: "Plan inválido" }, { status: 400 });
      metaPlan = b.plan as string;
      const { infl } = await getInflacionMes();
      const invPlan = calcInversion(plan.config, infl).total;
      const proy = proyectarOtros(plan.config.otros, await getHistOtros(anio), anio, invPlan)[metaPlan] ?? [];
      if (!proy.length) return NextResponse.json({ error: "No hay datos reales para proyectar este tablero." }, { status: 400 });
      filas = proy.map((k) => ({ kpi: k.kpi, unidad: k.unidad || null, direccion: k.direccion, valores: k.valores, porCat: k.porCat }));
    } else {
      const [refMeses, { infl }] = await Promise.all([getRefMeses(), getInflacionMes()]);
      const { metas } = calcPlan(plan.config, refMeses, infl);
      filas = PLAN_META_KPIS.map((kpi) => ({ kpi, unidad: UNIDAD[kpi] ?? null, direccion: "up", valores: metas[kpi] }));
    }
    const metas = Object.fromEntries(filas.map((f) => [f.kpi, f.valores]));
    const now = new Date().toISOString();
    // Total + una fila por categoría (Lavado / Refrigeración / Cocción / Brand) en los KPIs que la tienen.
    const valores = filas.flatMap((f) => [[CAT_GENERAL, f.valores] as const, ...Object.entries(f.porCat ?? {})].flatMap(([categoria, vs]) =>
      vs.map((valor, i) => ({ plan: metaPlan, kpi: f.kpi, categoria, anio, mes: i + 1, valor, updated_at: now }))));
    // Config solo para los KPIs que no la tienen (no pisa dirección/umbrales que el user ya ajustó).
    const cfgRes = await sbAdmin(`kpi_meta_config?plan=eq.${encodeURIComponent(metaPlan)}&categoria=eq.${CAT_GENERAL}&select=kpi`, { method: "GET" });
    const conCfg = new Set(cfgRes.ok ? ((await cfgRes.json()) as { kpi: string }[]).map((r) => r.kpi) : []);
    const cfgNueva = filas.filter((f) => !conCfg.has(f.kpi)).map(({ kpi, unidad, direccion }) => ({
      plan: metaPlan, kpi, categoria: CAT_GENERAL, unidad, direccion, referencia: "interno",
      frecuencia: "mensual", agregacion: "mensual", umbral_verde: 100, umbral_amarillo: 90, notas: null, updated_at: now,
    }));
    for (const [tabla, rows] of [["kpi_meta_config", cfgNueva], ["kpi_meta_valores", valores]] as const) {
      if (!rows.length) continue;
      const r = await sbAdmin(tabla, { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(rows) });
      if (!r.ok) return NextResponse.json({ error: `${tabla}: ${(await r.text()).slice(0, 200)}` }, { status: 500 });
    }
    await auditar([{ usuario: u.email, entidad: "plan_medios", accion: "metas", version: `Plan de Medios ${anio}`, clave: metaPlan, antes: null, despues: metas }]).catch(() => undefined);
    return NextResponse.json({ ok: true, metas });
  });
}
