import { NextResponse } from "next/server";
import { getUmbrales, saveUmbrales } from "@/lib/alerts";
import { alertasUser } from "../_lib/auth";

// Umbrales propios de alertas ("avisame si el CPM supera $X o las sesiones caen 20%") — columna
// alert_prefs.umbrales (migración 0119). Se validan con cleanUmbrales (máx. 10, métricas conocidas).
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const u = await alertasUser();
  if (!u.ok) return NextResponse.json({ error: u.error }, { status: u.status });
  return NextResponse.json(await getUmbrales());
}

export async function POST(req: Request) {
  const u = await alertasUser();
  if (!u.ok) return NextResponse.json({ error: u.error }, { status: u.status });
  const b = (await req.json().catch(() => ({}))) as { umbrales?: unknown };
  try {
    return NextResponse.json({ ok: true, umbrales: await saveUmbrales(b.umbrales, u.email) });
  } catch (e) {
    const msg = (e as Error).message;
    return NextResponse.json({ error: msg }, { status: /migración/.test(msg) ? 503 : 500 });
  }
}
