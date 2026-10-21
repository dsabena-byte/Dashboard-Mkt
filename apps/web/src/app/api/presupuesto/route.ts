import { NextResponse } from "next/server";
import { listAuditoria, listCatalogo, listFacturacion, listInflacion, listLineas, listTc, listVersiones, setCerrada } from "@/lib/presupuesto-server";
import { ANIO_MINIMO } from "@/lib/presupuesto-core";
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
    const [todas, todosTc, catalogo, todaFact, todaInfl] = await Promise.all([listVersiones(), listTc(), listCatalogo(), listFacturacion(), listInflacion()]);
    const versiones = todas.filter((v) => v.anio >= ANIO_MINIMO);
    const tcs = todosTc.filter((t) => versiones.some((v) => v.nombre === t.version));
    const facturacion = todaFact.filter((f) => Number(f.mes.slice(0, 4)) >= ANIO_MINIMO);
    const inflacion = todaInfl.filter((f) => Number(f.mes.slice(0, 4)) >= ANIO_MINIMO);
    const lineas = version && versiones.some((v) => v.nombre === version) ? await listLineas(version) : [];
    return NextResponse.json({
      usuario: { email: u.email, editor: u.editor, puedeReal: u.puedeReal },
      versiones, tcs: tcs.map((t) => ({ ...t, tc: Number(t.tc) })), catalogo, lineas, facturacion, inflacion,
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
