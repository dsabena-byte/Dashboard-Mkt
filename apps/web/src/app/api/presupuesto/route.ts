import { NextResponse } from "next/server";
import { listAuditoria, listCatalogo, listFacturacion, listLineas, listTc, listVersiones, setCerrada } from "@/lib/presupuesto-server";
import { conUsuario, soloEditor } from "./_auth";

// Presupuesto cargado desde el tablero (migración 0125).
// GET ?version=REAL 2026 → versiones, TC, catálogo, renglones de esa versión y permisos del usuario.
// GET ?historial=1[&version=] → últimos movimientos. POST {accion: "cerrar"|"abrir", version} (editores).
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  return conUsuario(async (u) => {
    const sp = new URL(req.url).searchParams;
    const version = sp.get("version") ?? "";
    if (sp.get("historial")) return NextResponse.json({ movimientos: await listAuditoria({ version: version || undefined, limit: 300 }) });
    const [versiones, tcs, catalogo, facturacion] = await Promise.all([listVersiones(), listTc(), listCatalogo(), listFacturacion()]);
    const lineas = version && versiones.some((v) => v.nombre === version) ? await listLineas(version) : [];
    return NextResponse.json({
      usuario: { email: u.email, editor: u.editor, puedeReal: u.puedeReal },
      versiones, tcs: tcs.map((t) => ({ ...t, tc: Number(t.tc) })), catalogo, lineas, facturacion,
    });
  });
}

export async function POST(req: Request) {
  return conUsuario(async (u) => {
    const deny = soloEditor(u);
    if (deny) return deny;
    const b = (await req.json().catch(() => ({}))) as { accion?: string; version?: string };
    if (!b.version || (b.accion !== "cerrar" && b.accion !== "abrir")) return NextResponse.json({ error: "pedido inválido" }, { status: 400 });
    await setCerrada(b.version, b.accion === "cerrar", u.email);
    return NextResponse.json({ ok: true });
  });
}
