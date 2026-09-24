import { NextResponse } from "next/server";
import { canUseTableros, insertDataset, TablerosMissingError } from "@/lib/tableros-server";
import { getSheetsAccess, readGoogleSheet, spreadsheetIdFrom } from "@/lib/google-sheets";

// Google Sheets → planilla de Mis tableros (copia de la 1ª hoja).
//   GET          → { state: "ok" | "no_scope" | "no_env" | "error" } (¿el token tiene scope de Sheets?)
//   POST { url } → lee la planilla y la guarda en tableros_datasets
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  if (!(await canUseTableros())) return NextResponse.json({ state: "error", detail: "sin acceso" }, { status: 403 });
  const a = await getSheetsAccess();
  return NextResponse.json(a.state === "ok" ? { state: "ok" } : a);
}

export async function POST(req: Request) {
  if (!(await canUseTableros())) return NextResponse.json({ error: "sin acceso" }, { status: 403 });
  const { url, name } = (await req.json().catch(() => ({}))) as { url?: string; name?: string };
  const id = spreadsheetIdFrom(String(url ?? ""));
  if (!id) return NextResponse.json({ error: "Pegá el link completo de la planilla de Google Sheets." }, { status: 400 });
  const a = await getSheetsAccess();
  if (a.state !== "ok") {
    const msg = a.state === "no_scope" ? "La cuenta Google del dashboard no tiene permiso de lectura de Sheets (no_scope). Subí la planilla como archivo." : a.state === "no_env" ? "Google no está configurado en este entorno." : `No se pudo acceder a Google (${a.detail ?? "error"}).`;
    return NextResponse.json({ error: msg, state: a.state }, { status: 400 });
  }
  try {
    const s = await readGoogleSheet(a.token, id);
    if (!s.columns.length) return NextResponse.json({ error: "La primera fila (encabezados) está vacía." }, { status: 400 });
    const nm = (name?.trim() || s.title).slice(0, 200);
    const ins = await insertDataset({ name: nm, columns: s.columns, rows: s.rows, source: { type: "google_sheet", spreadsheetId: id } });
    return NextResponse.json({ ok: true, id: ins.id, name: nm, rows: s.rows.length });
  } catch (e) {
    const status = e instanceof TablerosMissingError ? 503 : 400;
    return NextResponse.json({ error: `No se pudo leer la planilla: ${(e as Error).message}` }, { status });
  }
}
