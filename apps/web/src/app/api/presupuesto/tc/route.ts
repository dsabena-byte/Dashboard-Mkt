import { NextResponse } from "next/server";
import { guardarTcs } from "@/lib/presupuesto-server";
import { tipoDeVersion } from "@/lib/presupuesto-core";
import { conUsuario, soloEditor } from "../_auth";

// Tipos de cambio por versión y mes (los pasa finanzas). PUT {cambios: [{version, mes, tc|null}]}. Solo editores.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PUT(req: Request) {
  return conUsuario(async (u) => {
    const deny = soloEditor(u);
    if (deny) return deny;
    const b = (await req.json().catch(() => ({}))) as { cambios?: { version?: string; mes?: number; tc?: number | null }[] };
    const cambios = (b.cambios ?? []).slice(0, 500);
    for (const c of cambios) {
      if (!c.version || !tipoDeVersion(c.version)) return NextResponse.json({ error: `Versión inválida: ${c.version ?? ""}` }, { status: 400 });
      if (!c.mes || c.mes < 1 || c.mes > 12) return NextResponse.json({ error: "Mes inválido." }, { status: 400 });
      if (c.tc != null && !(Number(c.tc) > 0)) return NextResponse.json({ error: `Tipo de cambio inválido en ${c.version}.` }, { status: 400 });
    }
    const n = await guardarTcs(cambios.map((c) => ({ version: c.version!.trim(), mes: c.mes!, tc: c.tc == null ? null : Number(c.tc) })), u.email);
    return NextResponse.json({ ok: true, cambios: n });
  });
}
