import { NextResponse } from "next/server";
import { sbAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const TABLE = "contenido_calendario";

// Columnas que el cliente puede setear (evita que mande basura).
const WRITABLE = new Set([
  "fecha", "hora", "pilar", "categoria", "modelo", "formato", "aspecto", "detalles",
  "imagen_url", "video_url", "caption", "hashtags", "mensaje_clave", "bajada", "image_prompt",
  "estado", "aprobado", "redes", "notas", "con_placa",
]);

function pick(body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(body)) if (WRITABLE.has(k)) out[k] = body[k];
  return out;
}

// GET /api/contenido/calendario?desde=YYYY-MM-DD&hasta=YYYY-MM-DD
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const desde = url.searchParams.get("desde");
    const hasta = url.searchParams.get("hasta");
    let q = `${TABLE}?select=*&order=fecha.asc,hora.asc.nullsfirst`;
    if (desde) q += `&fecha=gte.${desde}`;
    if (hasta) q += `&fecha=lte.${hasta}`;
    const res = await sbAdmin(q, { method: "GET" });
    if (!res.ok) return NextResponse.json({ ok: false, error: `read ${res.status}: ${(await res.text()).slice(0, 300)}` }, { status: 500 });
    return NextResponse.json({ ok: true, items: await res.json() });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

// POST /api/contenido/calendario  → crea (sin id) o actualiza (con id) una entrada.
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const id = typeof body.id === "string" ? body.id : null;
    const data = pick(body);
    if (!id && !data.fecha) return NextResponse.json({ ok: false, error: "Falta fecha." }, { status: 400 });
    data.updated_at = new Date().toISOString();

    let res: Response;
    if (id) {
      res = await sbAdmin(`${TABLE}?id=eq.${id}`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(data),
      });
    } else {
      res = await sbAdmin(TABLE, {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(data),
      });
    }
    if (!res.ok) return NextResponse.json({ ok: false, error: `write ${res.status}: ${(await res.text()).slice(0, 300)}` }, { status: 500 });
    const rows = (await res.json()) as unknown[];
    return NextResponse.json({ ok: true, item: rows[0] ?? null });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

// DELETE /api/contenido/calendario?id=UUID
export async function DELETE(request: Request) {
  try {
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return NextResponse.json({ ok: false, error: "Falta id." }, { status: 400 });
    const res = await sbAdmin(`${TABLE}?id=eq.${id}`, { method: "DELETE" });
    if (!res.ok) return NextResponse.json({ ok: false, error: `delete ${res.status}` }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
