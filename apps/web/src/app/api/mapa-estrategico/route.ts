import { NextResponse } from "next/server";
import { MAPA_CONFIG_SEED, type MapaConfig, type Objetivo, type Plan } from "@/lib/mapa-estrategico-config";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

// Acceso por REST directo con la service key (mismo patrón que /api/metas).
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

interface Row { objetivos: Objetivo[]; planes: Plan[] }

// GET /api/mapa-estrategico → { objetivos, planes }. Si la tabla está vacía, devuelve el seed.
export async function GET() {
  const req = rest("mapa_estrategico?id=eq.1&select=objetivos,planes");
  const res = await fetch(req.href, { headers: req.headers, cache: "no-store" });
  // Si la tabla aún no existe (migración sin correr) o falla, caemos al seed.
  if (!res.ok) return NextResponse.json(MAPA_CONFIG_SEED satisfies MapaConfig);
  const rows = (await res.json()) as Row[];
  const row = rows[0];
  if (!row || !Array.isArray(row.objetivos) || row.objetivos.length === 0) {
    return NextResponse.json(MAPA_CONFIG_SEED satisfies MapaConfig);
  }
  return NextResponse.json({ objetivos: row.objetivos, planes: row.planes ?? [] } satisfies MapaConfig);
}

// POST /api/mapa-estrategico → upsert de la config (singleton id=1).
export async function POST(request: Request) {
  let body: Partial<MapaConfig>;
  try {
    body = (await request.json()) as Partial<MapaConfig>;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (!Array.isArray(body.objetivos) || !Array.isArray(body.planes)) {
    return NextResponse.json({ error: "Falta objetivos/planes" }, { status: 400 });
  }
  const req = rest("mapa_estrategico");
  const res = await fetch(req.href, {
    method: "POST",
    headers: { ...req.headers, Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify([{ id: 1, objetivos: body.objetivos, planes: body.planes, updated_at: new Date().toISOString() }]),
  });
  if (!res.ok) return NextResponse.json({ error: await res.text() }, { status: 500 });
  return NextResponse.json({ ok: true });
}
