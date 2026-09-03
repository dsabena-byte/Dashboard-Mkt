import { NextResponse } from "next/server";

// Precalcula la distribución mensual de usuarios web por categoría en
// web_monthly_by_category. Lee la vista lenta vw_drean_web_by_category (~8.8s) UNA
// vez acá, en background, para que el ingreso a Seguimiento Objetivos no la pague.

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function env(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Env var ${key} no configurada`);
  return v;
}

interface DiaCatRow { fecha: string; categoria: string | null; usuarios: number | null; sesiones: number | null; conversiones: number | null }

// Lee la vista con paginación por Range (supera 1000 filas/año).
async function fetchAll(url: string, key: string, query: string): Promise<DiaCatRow[]> {
  const out: DiaCatRow[] = [];
  const page = 1000;
  for (let from = 0; from < 200_000; from += page) {
    const res = await fetch(`${url}/rest/v1/${query}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Range: `${from}-${from + page - 1}` },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`vw_drean_web_by_category ${res.status}: ${await res.text()}`);
    const rows = (await res.json()) as DiaCatRow[];
    out.push(...rows);
    if (rows.length < page) break;
  }
  return out;
}

async function supabaseUpsert(url: string, key: string, table: string, rows: unknown[], onConflict: string): Promise<string> {
  if (rows.length === 0) return "sin data";
  const res = await fetch(`${url}/rest/v1/${table}?on_conflict=${onConflict}`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(rows),
  });
  if (!res.ok) return `error ${res.status}: ${await res.text()}`;
  return `${rows.length} filas OK`;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = env("NEXT_PUBLIC_SUPABASE_URL");
    const key = env("SUPABASE_SERVICE_ROLE_KEY");
    const year = new Date().getUTCFullYear();

    const rows = await fetchAll(url, key, `vw_drean_web_by_category?fecha=gte.${year}-01-01&fecha=lte.${year}-12-31&select=fecha,categoria,usuarios,sesiones,conversiones`);

    // Agrega por (mes, categoría).
    const agg = new Map<string, { mes: string; categoria: string; usuarios: number; sesiones: number; conversiones: number }>();
    for (const r of rows) {
      if (!r.fecha || !r.categoria) continue;
      const mes = `${r.fecha.slice(0, 7)}-01`;
      const k = `${mes}|${r.categoria}`;
      const e = agg.get(k) ?? { mes, categoria: r.categoria, usuarios: 0, sesiones: 0, conversiones: 0 };
      e.usuarios += r.usuarios ?? 0; e.sesiones += r.sesiones ?? 0; e.conversiones += r.conversiones ?? 0;
      agg.set(k, e);
    }
    const now = new Date().toISOString();
    const out = [...agg.values()].map((e) => ({ ...e, updated_at: now }));

    const upsert = await supabaseUpsert(url, key, "web_monthly_by_category", out, "mes,categoria");
    return NextResponse.json({ ok: true, dias_leidos: rows.length, filas_upsert: out.length, upsert });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
