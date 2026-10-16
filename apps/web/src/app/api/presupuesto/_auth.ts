import { NextResponse } from "next/server";
import { PresupuestoError, usuarioPresupuesto, type UsuarioPpto } from "@/lib/presupuesto-server";
import type { Version } from "@/lib/presupuesto-core";

/** REAL lo carga cualquiera con acceso a /funnel; los presupuestos y tipos de cambio, solo los editores. */
export const puedeVersion = (u: UsuarioPpto) => (v: Pick<Version, "tipo">) => (v.tipo === "REAL" ? u.puedeReal : u.editor);

export async function conUsuario(fn: (u: UsuarioPpto) => Promise<Response>): Promise<Response> {
  try {
    const u = await usuarioPresupuesto();
    if (!u) return NextResponse.json({ error: "no autenticado" }, { status: 401 });
    if (!u.puedeReal && !u.editor) return NextResponse.json({ error: "Tu usuario no tiene acceso a Inversión de Marketing." }, { status: 403 });
    return await fn(u);
  } catch (e) {
    if (e instanceof PresupuestoError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("[presupuesto]", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}

export const soloEditor = (u: UsuarioPpto) =>
  u.editor ? null : NextResponse.json({ error: "Solo los editores del presupuesto pueden hacer esto." }, { status: 403 });
