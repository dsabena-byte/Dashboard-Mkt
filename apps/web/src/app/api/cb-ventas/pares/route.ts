import { NextResponse } from "next/server";
import { cors, noAutorizado, preflight, secretoOk } from "@/lib/cb-ventas/ingesta-auth";
import { leerCuadroBasico } from "@/lib/cb-ventas/server";
import { paresCB } from "@/lib/cb-ventas/core";

// GET → pares "CLIENTE_NORMALIZADO|SKU" del cuadro básico (modelo + homólogos) para que el Office Script
// filtre el Excel ANTES de mandar (reemplaza /api/cb-pairs de la app vieja). Header x-refresh-secret.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const OPTIONS = () => preflight();

export async function GET(request: Request) {
  if (!secretoOk(request)) return noAutorizado();
  try {
    const { cuadroBasico } = await leerCuadroBasico(undefined, { todos: true });
    const pairs = paresCB(cuadroBasico);
    return cors(NextResponse.json({ ok: true, count: pairs.length, pairs }));
  } catch (e) {
    console.error("[cb-ventas/pares]", e instanceof Error ? e.message : e);
    return cors(NextResponse.json({ ok: false, error: "No se pudo leer el cuadro básico" }, { status: 500 }));
  }
}
