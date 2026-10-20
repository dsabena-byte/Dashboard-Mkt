import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase-server";
import { allowedFromRows, isPathAllowed } from "@/lib/dashboard-access";
import { checkRateLimit } from "@/lib/chat/rate-limit";
import { claveFila, sanearFilas } from "@/lib/mkt-canal-core";
import { extraerReporte, filasExistentes, guardarFilas } from "@/lib/mkt-canal-server";

// Mkt Canal · subir reporte de un retailer.
//   POST multipart {archivo, cliente?} → la IA lee el archivo → { filas, antes, errores, notas } (NO escribe).
//   PUT  { filas }                     → valida y guarda (upsert por cliente·acción·mes·plataforma).
// Exige sesión y acceso a /mkt-canal (dashboard_access).
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;
const MAX_BYTES = 10 * 1024 * 1024;

async function usuario(): Promise<string | null> {
  try {
    const supabase = getServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data } = await supabase.from("dashboard_access").select("dashboard_path");
    return isPathAllowed("/mkt-canal", allowedFromRows(data as { dashboard_path: string }[] | null)) ? (user.email ?? user.id) : "";
  } catch { return null; }
}

const err = (e: unknown) => {
  const status = (e as { status?: number })?.status ?? 500;
  if (status === 500) console.error("[mkt-canal]", e);
  return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status });
};

export async function POST(req: Request) {
  const u = await usuario();
  if (u === null) return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  if (!u) return NextResponse.json({ error: "Tu usuario no tiene acceso a Mkt Canal." }, { status: 403 });
  const rl = checkRateLimit(`mkt-canal:${u}`);
  if (!rl.ok) return NextResponse.json({ error: `Demasiados archivos seguidos. Probá en ${rl.retryInSec} s.` }, { status: 429 });
  const fd = await req.formData().catch(() => null);
  const file = fd?.get("archivo");
  if (!(file instanceof File)) return NextResponse.json({ error: "Elegí un archivo." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "El archivo pesa más de 10 MB." }, { status: 400 });
  try {
    const r = await extraerReporte(file, String(fd?.get("cliente") ?? "").trim().slice(0, 60) || undefined);
    const antes = await filasExistentes(r.filas);
    return NextResponse.json({ ...r, antes: Object.fromEntries(r.filas.filter((f) => antes.has(claveFila(f))).map((f) => [claveFila(f), antes.get(claveFila(f))])) });
  } catch (e) { return err(e); }
}

export async function PUT(req: Request) {
  const u = await usuario();
  if (u === null) return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  if (!u) return NextResponse.json({ error: "Tu usuario no tiene acceso a Mkt Canal." }, { status: 403 });
  const body = await req.json().catch(() => null);
  const { filas, errores } = sanearFilas(body?.filas);
  if (errores.length) return NextResponse.json({ error: "Corregí las filas marcadas antes de guardar.", errores }, { status: 400 });
  if (!filas.length) return NextResponse.json({ error: "No hay filas para guardar." }, { status: 400 });
  try { return NextResponse.json({ ok: true, ...(await guardarFilas(filas)) }); } catch (e) { return err(e); }
}
