import { NextResponse } from "next/server";
import { syncAdLibraryBrand, adLibraryEnabled } from "@/lib/ad-library";
import { adLibraryBrands } from "@/lib/ad-library-shared";

// Cron SEMANAL (lunes): Pauta de la competencia (Biblioteca de anuncios de Meta vía Apify).
// Gateado por CRON_SECRET. Fan-out por marca (cada corrida de Apify puede tardar minutos):
//   ?list=1      → devuelve las marcas a sincronizar (el workflow itera)
//   ?marca=<m>   → sincroniza UNA marca (recomendado, hasta 300 s)
//   (sin params) → recorre todas en serie con presupuesto de tiempo y devuelve las pendientes.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

const BUDGET_MS = 240_000;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const u = new URL(req.url);
  const brands = adLibraryBrands().map((b) => b.marca);
  if (u.searchParams.get("list") === "1") return NextResponse.json({ ok: true, brands });
  if (!adLibraryEnabled()) return NextResponse.json({ ok: true, skipped: "APIFY_API_TOKEN no configurado", results: [] });

  const only = u.searchParams.get("marca");
  const list = only ? [only] : brands;
  const t0 = Date.now();
  const results: unknown[] = [];
  const pendientes: string[] = [];
  for (const marca of list) {
    if (!only && Date.now() - t0 > BUDGET_MS) { pendientes.push(marca); continue; }
    try { results.push(await syncAdLibraryBrand(marca)); }
    catch (e) { results.push({ marca, ok: false, error: (e as Error).message }); }
  }
  // ok=false solo si NINGUNA marca se pudo guardar (una marca caída conserva su snapshot anterior).
  const guardadas = results.filter((r) => (r as { ads?: number }).ads !== undefined).length;
  return NextResponse.json({ ok: guardadas > 0 || results.length === 0, count: results.length, results, pendientes });
}
