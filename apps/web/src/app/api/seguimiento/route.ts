import { NextResponse } from "next/server";
import { getSeguimientoCompleto } from "@/lib/objetivos-por-categoria";

// Versión COMPLETA del Seguimiento (con CB + Floor Share). La página pinta primero
// sin trade (rápido) y el cliente pide acá el dato completo, que llega después sin
// bloquear la vista. Paga los ~26s de paginar la tabla CB, pero en background.

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const maxDuration = 60;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const anio = Number(searchParams.get("anio")) || new Date().getUTCFullYear();
  try {
    const data = await getSeguimientoCompleto(anio, false);
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
