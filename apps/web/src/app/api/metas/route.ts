import { NextResponse } from "next/server";
import {
  CAT_GENERAL,
  type MetaConfig,
  type MetaValor,
  type MetasPayload,
} from "@/lib/metas";
import { exigirEdicion, getAllowedPaths } from "@/lib/usuarios-server";
import { isPathAllowed } from "@/lib/dashboard-access";

// Plan de metas → tablero que lo muestra. Un usuario restringido (Trade/Ventas) solo toca los planes de sus tableros.
// Estos planes son del área "trade" (editan es_editor/admin); el resto, "marketing" (edita_marketing/admin).
const PLAN_TABLERO: Record<string, string> = { "Cuadros Básicos": "/cuadros-basicos", "Floor Share": "/floor-share" };
async function puedePlan(plan: string): Promise<boolean> {
  const allowed = await getAllowedPaths();
  if (allowed === null) return true;
  const ruta = PLAN_TABLERO[plan];
  return !!ruta && isPathAllowed(ruta, allowed);
}

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

// Acceso por REST directo con la service key (mismo patrón que el resto del repo:
// el cliente tipado de supabase-js no cubre estas tablas nuevas).
function env(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Env var ${key} no configurada`);
  return v;
}

function rest(path: string) {
  const url = env("NEXT_PUBLIC_SUPABASE_URL");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  return {
    href: `${url}/rest/v1/${path}`,
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
  };
}

interface CfgRow {
  plan: string; kpi: string; categoria: string; unidad: string | null;
  direccion: string; referencia: string; frecuencia: string; agregacion: string;
  umbral_verde: number | string; umbral_amarillo: number | string; notas: string | null;
}
interface ValRow {
  plan: string; kpi: string; categoria: string; anio: number; mes: number; valor: number | string | null;
}

const oneOf = <T extends string>(v: string, allowed: readonly T[], fallback: T): T =>
  (allowed as readonly string[]).includes(v) ? (v as T) : fallback;

// GET /api/metas?plan=<plan> → { config, valores } para ese plan.
export async function GET(request: Request) {
  const plan = new URL(request.url).searchParams.get("plan");
  if (!plan) return NextResponse.json({ error: "Falta ?plan=" }, { status: 400 });
  if (!(await puedePlan(plan))) return NextResponse.json({ error: "Sin acceso" }, { status: 403 });

  const filter = `plan=eq.${encodeURIComponent(plan)}&select=*`;
  const cfgReq = rest(`kpi_meta_config?${filter}`);
  const valReq = rest(`kpi_meta_valores?${filter}`);
  const [cfgRes, valRes] = await Promise.all([
    fetch(cfgReq.href, { headers: cfgReq.headers, cache: "no-store" }),
    fetch(valReq.href, { headers: valReq.headers, cache: "no-store" }),
  ]);
  if (!cfgRes.ok) return NextResponse.json({ error: `config: ${await cfgRes.text()}` }, { status: 500 });
  if (!valRes.ok) return NextResponse.json({ error: `valores: ${await valRes.text()}` }, { status: 500 });

  const cfgRows = (await cfgRes.json()) as CfgRow[];
  const valRows = (await valRes.json()) as ValRow[];

  const config: MetaConfig[] = cfgRows.map((r) => ({
    plan: r.plan,
    kpi: r.kpi,
    categoria: r.categoria,
    unidad: r.unidad,
    direccion: r.direccion === "down" ? "down" : "up",
    referencia: oneOf(r.referencia, ["interno", "mercado", "periodo"] as const, "interno"),
    frecuencia: oneOf(r.frecuencia, ["mensual", "semanal", "trimestral"] as const, "mensual"),
    agregacion: oneOf(r.agregacion, ["mensual", "U3M", "U4M", "MAT", "YTD"] as const, "mensual"),
    umbralVerde: Number(r.umbral_verde),
    umbralAmarillo: Number(r.umbral_amarillo),
    notas: r.notas,
  }));
  const valores: MetaValor[] = valRows.map((r) => ({
    plan: r.plan,
    kpi: r.kpi,
    categoria: r.categoria,
    anio: r.anio,
    mes: r.mes,
    valor: r.valor == null ? null : Number(r.valor),
  }));

  return NextResponse.json({ config, valores } satisfies MetasPayload);
}

// POST /api/metas → upsert de config y/o valores.
export async function POST(request: Request) {
  let body: Partial<MetasPayload>;
  try {
    body = (await request.json()) as Partial<MetasPayload>;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const now = new Date().toISOString();

  async function upsert(table: string, rows: unknown[]): Promise<string | null> {
    if (!rows.length) return null;
    const req = rest(table);
    const res = await fetch(req.href, {
      method: "POST",
      headers: { ...req.headers, Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify(rows),
    });
    return res.ok ? null : `${table}: ${await res.text()}`;
  }

  const cfgRows = (body.config ?? []).map((c) => ({
    plan: c.plan, kpi: c.kpi, categoria: c.categoria || CAT_GENERAL,
    unidad: c.unidad, direccion: c.direccion, referencia: c.referencia,
    frecuencia: c.frecuencia, agregacion: c.agregacion,
    umbral_verde: c.umbralVerde, umbral_amarillo: c.umbralAmarillo,
    notas: c.notas, updated_at: now,
  }));
  const valRows = (body.valores ?? []).map((v) => ({
    plan: v.plan, kpi: v.kpi, categoria: v.categoria || CAT_GENERAL,
    anio: v.anio, mes: v.mes, valor: v.valor, updated_at: now,
  }));

  for (const plan of new Set([...cfgRows, ...valRows].map((r) => String(r.plan ?? "")))) {
    if (!(await puedePlan(plan))) return NextResponse.json({ error: "Sin acceso a ese plan" }, { status: 403 });
    const sinPermiso = await exigirEdicion(plan in PLAN_TABLERO ? "trade" : "marketing");
    if (sinPermiso) return sinPermiso;
  }

  const errCfg = await upsert("kpi_meta_config", cfgRows);
  if (errCfg) return NextResponse.json({ error: errCfg }, { status: 500 });
  const errVal = await upsert("kpi_meta_valores", valRows);
  if (errVal) return NextResponse.json({ error: errVal }, { status: 500 });

  return NextResponse.json({ ok: true });
}
