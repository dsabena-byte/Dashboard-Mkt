import { NextResponse } from "next/server";
import { guardarFacturacion } from "@/lib/presupuesto-server";
import { conUsuario, soloEditor } from "../_auth";
import { exigirEdicion } from "@/lib/usuarios-server";

// Facturación mensual de la empresa (USD). PUT {cambios: [{mes: "YYYY-MM-01", facturacion|null}]}. Solo editores.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PUT(req: Request) {
  return conUsuario(async (u) => {
    const deny = soloEditor(u);
    if (deny) return deny;
    const sinPermiso = await exigirEdicion("marketing");
    if (sinPermiso) return sinPermiso;
    const b = (await req.json().catch(() => ({}))) as { cambios?: { mes?: string; facturacion?: number | null }[] };
    const cambios = (b.cambios ?? []).slice(0, 120);
    for (const c of cambios) {
      if (!c.mes || !/^20\d{2}-(0[1-9]|1[0-2])-01$/.test(c.mes)) return NextResponse.json({ error: `Mes inválido: ${c.mes ?? ""}` }, { status: 400 });
      if (c.facturacion != null && !(Number(c.facturacion) > 0)) return NextResponse.json({ error: `Facturación inválida en ${c.mes}.` }, { status: 400 });
    }
    const n = await guardarFacturacion(cambios.map((c) => ({ mes: c.mes!, facturacion: c.facturacion == null ? null : Number(c.facturacion) })), u.email);
    return NextResponse.json({ ok: true, cambios: n });
  });
}
