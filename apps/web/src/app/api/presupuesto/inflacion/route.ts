import { NextResponse } from "next/server";
import { guardarInflaciones } from "@/lib/presupuesto-server";
import { tipoDeVersion } from "@/lib/presupuesto-core";
import { conUsuario, soloEditor } from "../_auth";

// Inflación % por versión (BGT / 4+8 / 8+4 / REAL) y mes, como el tipo de cambio. PUT {cambios: [{version, mes, pct|null}]}.
// Solo editores. La REAL la trae sola el cron inflacion-indec; acá se puede corregir.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PUT(req: Request) {
  return conUsuario(async (u) => {
    const deny = soloEditor(u);
    if (deny) return deny;
    const b = (await req.json().catch(() => ({}))) as { cambios?: { version?: string; mes?: number; pct?: number | null }[] };
    const cambios = (b.cambios ?? []).slice(0, 500);
    for (const c of cambios) {
      if (!c.version || !tipoDeVersion(c.version)) return NextResponse.json({ error: `Versión inválida: ${c.version ?? ""}` }, { status: 400 });
      if (!c.mes || c.mes < 1 || c.mes > 12) return NextResponse.json({ error: "Mes inválido." }, { status: 400 });
      if (c.pct != null && !(Number(c.pct) > -50 && Number(c.pct) < 100)) return NextResponse.json({ error: `Inflación inválida en ${c.version} (se carga en %, ej. 2,0).` }, { status: 400 });
    }
    const n = await guardarInflaciones(cambios.map((c) => ({ version: c.version!.trim(), mes: c.mes!, pct: c.pct == null ? null : Number(c.pct) })), u.email);
    return NextResponse.json({ ok: true, cambios: n });
  });
}
