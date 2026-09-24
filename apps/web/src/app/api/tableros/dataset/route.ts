import { NextResponse } from "next/server";
import { canUseTableros, getDataset, TablerosMissingError } from "@/lib/tableros-server";

// Columnas + filas de una planilla (el motor agrega en el cliente). Tope defensivo 100k filas.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  if (!(await canUseTableros()) && !(await canUseTableros("/salud-marca"))) return NextResponse.json({ error: "sin acceso" }, { status: 403 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "falta id" }, { status: 400 });
  try {
    const ds = await getDataset(id);
    if (!ds) return NextResponse.json({ error: "planilla no encontrada" }, { status: 404 });
    return NextResponse.json({ id: ds.id, name: ds.name, columns: ds.columns, rows: ds.rows.slice(0, 100_000) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: e instanceof TablerosMissingError ? 503 : 500 });
  }
}
