import { NextResponse } from "next/server";
import { sbAdmin } from "@/lib/supabase-admin";
import { generarPiezas } from "@/lib/contenido-generar";
import type { FalSizeKey } from "@/lib/fal-client";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const TABLE = "contenido_calendario";

interface CalRow {
  id: string;
  pilar: string | null;
  categoria: string | null;
  modelo: string | null;
  formato: string | null;
  aspecto: string | null;
  detalles: string | null;
}

// POST /api/contenido/calendario/generar { id } → genera la pieza y la guarda.
export async function POST(request: Request) {
  try {
    const { id } = (await request.json()) as { id?: string };
    if (!id) return NextResponse.json({ ok: false, error: "Falta id." }, { status: 400 });

    // 1) Cargar la entrada.
    const rowRes = await sbAdmin(`${TABLE}?id=eq.${id}&select=*`, { method: "GET" });
    if (!rowRes.ok) return NextResponse.json({ ok: false, error: `read ${rowRes.status}` }, { status: 500 });
    const rows = (await rowRes.json()) as CalRow[];
    const row = rows[0];
    if (!row) return NextResponse.json({ ok: false, error: "Entrada no encontrada." }, { status: 404 });

    // 2) Generar una pieza con los parámetros de la entrada.
    const result = await generarPiezas({
      pilar: row.pilar ?? undefined,
      categoria: row.categoria ?? undefined,
      modelo: row.modelo ?? undefined,
      productoReal: !!row.modelo,
      formato: row.formato ?? undefined,
      aspecto: (row.aspecto as FalSizeKey) ?? "vertical",
      detalles: row.detalles ?? undefined,
      cantidad: 1,
    });
    const pieza = result.piezas[0];
    if (!result.ok || !pieza || pieza.error) {
      return NextResponse.json({ ok: false, error: pieza?.error ?? "Falló la generación." }, { status: 500 });
    }

    // 3) Guardar el contenido generado en la entrada.
    const patch = {
      imagen_url: pieza.imagen,
      caption: pieza.caption,
      hashtags: pieza.hashtags,
      mensaje_clave: pieza.mensaje_clave,
      bajada: pieza.bajada,
      image_prompt: pieza.image_prompt,
      estado: "generado",
      updated_at: new Date().toISOString(),
    };
    const upd = await sbAdmin(`${TABLE}?id=eq.${id}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(patch),
    });
    if (!upd.ok) return NextResponse.json({ ok: false, error: `save ${upd.status}: ${(await upd.text()).slice(0, 300)}` }, { status: 500 });
    const saved = (await upd.json()) as unknown[];
    return NextResponse.json({ ok: true, item: saved[0] ?? null });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
