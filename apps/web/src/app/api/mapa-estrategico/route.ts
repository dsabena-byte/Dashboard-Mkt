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

// GET /api/mapa-estrategico → { objetivos, planes, source }.
// source="db" = config real guardada; "seed" = tabla vacía o inexistente (migración
// sin correr) → el cliente puede preferir su draft local antes de pisar con el seed.
export async function GET() {
  const seed = { ...MAPA_CONFIG_SEED, source: "seed" as const };
  const req = rest("mapa_estrategico?id=eq.1&select=objetivos,planes");
  const res = await fetch(req.href, { headers: req.headers, cache: "no-store" });
  if (!res.ok) return NextResponse.json(seed);
  const rows = (await res.json()) as Row[];
  const row = rows[0];
  if (!row || !Array.isArray(row.objetivos) || row.objetivos.length === 0) {
    return NextResponse.json(seed);
  }
  return NextResponse.json({ objetivos: row.objetivos, planes: row.planes ?? [], source: "db" as const });
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
