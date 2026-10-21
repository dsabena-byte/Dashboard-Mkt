import { NextResponse } from "next/server";
import { guardarInflacion } from "@/lib/presupuesto-server";
import { conUsuario, soloEditor } from "../_auth";

// Inflación mensual (%). PUT {cambios: [{mes: "YYYY-MM-01", pct|null}]}. Solo editores.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PUT(req: Request) {
  return conUsuario(async (u) => {
    const deny = soloEditor(u);
    if (deny) return deny;
    const b = (await req.json().catch(() => ({}))) as { cambios?: { mes?: string; pct?: number | null }[] };
    const cambios = (b.cambios ?? []).slice(0, 120);
    for (const c of cambios) {
      if (!c.mes || !/^20\d{2}-(0[1-9]|1[0-2])-01$/.test(c.mes)) return NextResponse.json({ error: `Mes inválido: ${c.mes ?? ""}` }, { status: 400 });
      if (c.pct != null && !(Number(c.pct) > -50 && Number(c.pct) < 100)) return NextResponse.json({ error: `Inflación inválida en ${c.mes} (se carga en %, ej. 2,0).` }, { status: 400 });
    }
    const n = await guardarInflacion(cambios.map((c) => ({ mes: c.mes!, pct: c.pct == null ? null : Number(c.pct) })), u.email);
    return NextResponse.json({ ok: true, cambios: n });
  });
}
