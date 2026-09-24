import { NextResponse } from "next/server";
import { buildAlertItems } from "@/lib/alerts";
import { alertasUser } from "../_lib/auth";

// "Qué te avisaríamos hoy": las alertas candidatas de hoy (señales + desvíos de KPIs + competencia).
// Se pide desde el cliente al abrir /alerts (el cómputo NO corre en el render de la página).
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET() {
  const u = await alertasUser();
  if (!u.ok) return NextResponse.json({ error: u.error }, { status: u.status });
  try {
    const items = await buildAlertItems();
    return NextResponse.json({ items: items.slice(0, 40), total: items.length });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message, items: [] }, { status: 500 });
  }
}
