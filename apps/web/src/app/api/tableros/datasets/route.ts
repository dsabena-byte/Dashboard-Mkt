import { NextResponse } from "next/server";
import { canUseTableros, insertDataset, listDatasets, MAX_DATASET_ROWS, parseSpreadsheet, removeDataset, TablerosMissingError } from "@/lib/tableros-server";

// Planillas de Mis tableros.
//   GET                → lista (id, nombre, filas)
//   POST (form "file") → sube un Excel/CSV (primera hoja; fila 1 = encabezados)
//   DELETE { id }      → la quita (si ningún tablero ni la config de Kantar la usa)
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BYTES = 4 * 1024 * 1024; // límite de body de Vercel ≈ 4,5 MB

function errRes(e: unknown) {
  return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: e instanceof TablerosMissingError ? 503 : 500 });
}
const denied = () => NextResponse.json({ error: "Tu usuario no tiene acceso a Mis tableros." }, { status: 403 });

export async function GET() {
  if (!(await canUseTableros())) return denied();
  try { return NextResponse.json({ datasets: await listDatasets() }); } catch (e) { return errRes(e); }
}

export async function POST(req: Request) {
  if (!(await canUseTableros())) return denied();
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "falta el archivo" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "El archivo supera 4 MB. Sacale hojas/columnas que no uses o subilo como CSV." }, { status: 413 });
  let parsed: Awaited<ReturnType<typeof parseSpreadsheet>>;
  try {
    parsed = await parseSpreadsheet(Buffer.from(await file.arrayBuffer()));
  } catch (e) {
    return NextResponse.json({ error: `No se pudo leer el archivo: ${(e as Error).message}` }, { status: 400 });
  }
  if (!parsed.columns.length) return NextResponse.json({ error: "La primera fila (encabezados) está vacía." }, { status: 400 });
  try {
    const { id } = await insertDataset({ name: file.name, columns: parsed.columns, rows: parsed.rows, source: { type: "upload", file: file.name } });
    return NextResponse.json({ ok: true, id, name: file.name, rows: parsed.rows.length, ...(parsed.truncated ? { aviso: `Se guardaron las primeras ${MAX_DATASET_ROWS.toLocaleString("es-AR")} filas.` } : {}) });
  } catch (e) { return errRes(e); }
}

export async function DELETE(req: Request) {
  if (!(await canUseTableros())) return denied();
  const { id } = (await req.json().catch(() => ({}))) as { id?: string };
  if (!id) return NextResponse.json({ error: "falta id" }, { status: 400 });
  try {
    const r = await removeDataset(id);
    return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: r.error }, { status: 409 });
  } catch (e) { return errRes(e); }
}
