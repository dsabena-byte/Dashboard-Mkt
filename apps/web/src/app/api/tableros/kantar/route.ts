import { NextResponse } from "next/server";
import { canUseTableros, deleteReservedConfig, getDataset, saveReservedConfig, TablerosMissingError } from "@/lib/tableros-server";
import { buildKantarOverlay, KANTAR_CFG_SLUG, sanitizeKantarConfig } from "@/lib/kantar-sheet-core";
import { missingFields } from "@/lib/research-core";
import { KANTAR_CONST } from "@/lib/kantar-sheet";

// Kantar por planilla (opcional) → /salud-marca.
//   POST { datasetId, mapping, catMap } → guarda la config (fila reservada `cfg-kantar` de `tableros`)
//   DELETE                              → la quita (vuelven los valores fijos del código)
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function errRes(e: unknown) {
  return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: e instanceof TablerosMissingError ? 503 : 500 });
}

export async function POST(req: Request) {
  if (!(await canUseTableros())) return NextResponse.json({ error: "sin acceso" }, { status: 403 });
  const cfg = sanitizeKantarConfig(await req.json().catch(() => null));
  if (!cfg) return NextResponse.json({ error: "config inválida" }, { status: 400 });
  const faltan = missingFields("salud", cfg.mapping);
  if (faltan.length) return NextResponse.json({ error: `Falta mapear: ${faltan.join(", ")}.` }, { status: 400 });
  try {
    const ds = await getDataset(cfg.datasetId);
    if (!ds) return NextResponse.json({ error: "planilla no encontrada" }, { status: 404 });
    const { report } = buildKantarOverlay(ds.columns, ds.rows, cfg, KANTAR_CONST);
    if (!report.celdas) return NextResponse.json({ error: "Con este mapeo la planilla no aporta ningún valor para las olas medidas (nov-23 a nov-25). Revisá la columna de ola y las categorías." }, { status: 400 });
    await saveReservedConfig(KANTAR_CFG_SLUG, "Kantar por planilla", cfg);
    return NextResponse.json({ ok: true, report });
  } catch (e) { return errRes(e); }
}

export async function DELETE() {
  if (!(await canUseTableros())) return NextResponse.json({ error: "sin acceso" }, { status: 403 });
  try { await deleteReservedConfig(KANTAR_CFG_SLUG); return NextResponse.json({ ok: true }); } catch (e) { return errRes(e); }
}
