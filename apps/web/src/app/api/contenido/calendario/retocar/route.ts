import { NextResponse } from "next/server";
import { sbAdmin } from "@/lib/supabase-admin";
import { retocarImagen } from "@/lib/contenido-generar";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const TABLE = "contenido_calendario";

interface CalRow {
  id: string;
  imagen_url: string | null;
  imagen_versiones: string[] | null;
}

// POST /api/contenido/calendario/retocar { id, instruccion }
// Edita la imagen actual de la pieza aplicando el cambio pedido (retoque
// iterativo con nano-banana/edit), apilando la versión previa en
// imagen_versiones para poder revertir.
export async function POST(request: Request) {
  try {
    const { id, instruccion } = (await request.json()) as { id?: string; instruccion?: string };
    if (!id) return NextResponse.json({ ok: false, error: "Falta id." }, { status: 400 });
    if (!instruccion || !instruccion.trim()) return NextResponse.json({ ok: false, error: "Falta la instrucción de retoque." }, { status: 400 });

    // 1) Cargar la pieza y su imagen actual.
    const rowRes = await sbAdmin(`${TABLE}?id=eq.${id}&select=id,imagen_url,imagen_versiones`, { method: "GET" });
    if (!rowRes.ok) return NextResponse.json({ ok: false, error: `read ${rowRes.status}` }, { status: 500 });
    const row = ((await rowRes.json()) as CalRow[])[0];
    if (!row) return NextResponse.json({ ok: false, error: "Entrada no encontrada." }, { status: 404 });
    if (!row.imagen_url) return NextResponse.json({ ok: false, error: "No hay imagen para retocar (generá o subí una primero)." }, { status: 400 });

    // 2) Editar la imagen actual.
    const nueva = await retocarImagen(row.imagen_url, instruccion);

    // 3) Guardar: nueva imagen + versión previa apilada.
    const versiones = Array.isArray(row.imagen_versiones) ? row.imagen_versiones : [];
    const now = new Date().toISOString();
    const patchFull = {
      imagen_url: nueva,
      imagen_versiones: [...versiones, row.imagen_url],
      estado: "generado",
      updated_at: now,
    };
    let upd = await sbAdmin(`${TABLE}?id=eq.${id}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(patchFull),
    });
    // Fallback si la columna imagen_versiones aún no existe (migración no aplicada):
    // el retoque igual se aplica, solo sin historial.
    if (!upd.ok) {
      upd = await sbAdmin(`${TABLE}?id=eq.${id}`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ imagen_url: nueva, estado: "generado", updated_at: now }),
      });
    }
    if (!upd.ok) return NextResponse.json({ ok: false, error: `save ${upd.status}: ${(await upd.text()).slice(0, 300)}` }, { status: 500 });
    const saved = (await upd.json()) as unknown[];
    return NextResponse.json({ ok: true, item: saved[0] ?? null });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
