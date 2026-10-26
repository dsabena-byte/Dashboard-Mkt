import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@dashboard/db";
import { getSiteOrigin } from "@/lib/auth/supabase-auth";
import { PASSWORD_PATH } from "@/lib/auth/safe-next";
import { sendEmail } from "@/lib/notify";
import { esAdminActual, selectUsuarios } from "@/lib/usuarios-server";
import { emailValido, esColumnaInexistente, esGrupo, esTablaInexistente, GRUPOS, parseCsvUsuarios, type UsuarioRow } from "@/lib/usuarios-core";

// Administración de usuarios (/usuarios, migración 0136). Solo admins (sin la tabla: solo el admin inicial).
//   GET                                   → { legacy, usuarios }
//   POST { accion: "guardar", ... }       → alta o edición (email, nombre, grupos, es_editor, edita_marketing, es_admin, vendedor, gerencia)
//   POST { accion: "invitar" | "resetear", email } → manda el link para elegir la clave (nunca automático)
//   POST { accion: "activo", email, activo }       → desactivar / reactivar (también bloquea el login)
//   POST { accion: "importar", csv, confirmar? }   → vista previa o alta de los nuevos (sin invitar)
// Todo cambio queda en usuarios_auditoria. Service role SOLO después de validar que es admin.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Sin tipos generados para estas tablas (0136): cliente sin tipar.
type Svc = SupabaseClient;
const err = (error: string, status = 400) => NextResponse.json({ error }, { status });
const SIN_TABLA = "Falta correr la migración 0136_usuarios.sql en el SQL Editor de Supabase.";
const SIN_0137 = "Para dar el permiso «Edita Marketing» falta correr la migración 0137_usuarios_edicion.sql en el SQL Editor de Supabase.";

async function auditar(svc: Svc, actor: string, email: string, accion: string, antes: unknown, despues: unknown) {
  const { error } = await svc.from("usuarios_auditoria").insert({ actor_email: actor, email, accion, antes, despues });
  if (error) console.error("[usuarios] auditoría:", error.message);
}

async function leer(svc: Svc, email: string): Promise<UsuarioRow | null> {
  const { data } = await selectUsuarios((cols) => svc.from("usuarios").select(cols).eq("email", email).maybeSingle());
  return (data as UsuarioRow | null) ?? null;
}

/** Usuario de Auth por email (el equipo es chico: una página alcanza; se recorre por las dudas). */
async function authUserId(svc: Svc, email: string): Promise<string | null> {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await svc.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(error.message);
    const u = data.users.find((x) => x.email?.toLowerCase() === email);
    if (u) return u.id;
    if (data.users.length < 1000) return null;
  }
  return null;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function mailHtml(nombre: string | null, grupos: string, link: string, reset: boolean): string {
  const saludo = nombre ? `Hola ${esc(nombre.split(" ")[0]!)},` : "Hola,";
  const cuerpo = reset
    ? "Te mandamos un link para que elijas una clave nueva para el tablero de Drean."
    : `Te dieron acceso al tablero de Drean${grupos ? ` (${esc(grupos)})` : ""}. Solo falta que elijas tu clave.`;
  return `<div style="font-family:Arial,sans-serif;font-size:15px;color:#0f172a;line-height:1.5;max-width:520px">
<p>${saludo}</p><p>${cuerpo}</p>
<p style="margin:24px 0"><a href="${link}" style="background:#1e40af;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">Elegir mi clave</a></p>
<p style="color:#64748b;font-size:13px">El link vence pronto y sirve una sola vez. Si no te anda, pedile otro al administrador.</p>
<p>¡Gracias y que lo disfrutes!</p></div>`;
}

export async function GET() {
  const admin = await esAdminActual();
  if (!admin) return err("No encontrado", 404);
  if (admin.legacy) return NextResponse.json({ legacy: true, usuarios: [] });
  const svc = createServiceClient() as unknown as Svc;
  const { data, error, status } = await selectUsuarios((cols) => svc.from("usuarios").select(cols).order("email"));
  if (error) {
    if (esTablaInexistente(error, status)) return NextResponse.json({ legacy: true, usuarios: [] });
    console.error("[usuarios] GET:", error.message);
    return err("No se pudo leer la lista de usuarios.", 500);
  }
  return NextResponse.json({ legacy: false, usuarios: data ?? [] });
}

export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin || origin !== new URL(req.url).origin) return err("Origen inválido", 403);
  const admin = await esAdminActual();
  if (!admin) return err("No encontrado", 404);
  if (admin.legacy) return err(SIN_TABLA, 409);
  const b = ((await req.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;
  const accion = String(b.accion ?? "");
  const email = String(b.email ?? "").trim().toLowerCase();
  const svc = createServiceClient() as unknown as Svc;
  const actor = admin.email;

  if (accion === "importar") {
    const { filas, errores } = parseCsvUsuarios(String(b.csv ?? "").slice(0, 500_000));
    if (filas.length > 2000) return err("Máximo 2.000 filas por importación.");
    const { data: existentes } = await svc.from("usuarios").select("email").in("email", filas.map((f) => f.email));
    const ya = new Set(((existentes ?? []) as { email: string }[]).map((r) => r.email));
    const nuevos = filas.filter((f) => !ya.has(f.email));
    if (b.confirmar !== true) return NextResponse.json({ nuevos, existentes: [...ya], errores });
    if (nuevos.length) {
      const { error } = await svc.from("usuarios").upsert(
        nuevos.map((f) => ({ ...f, creado_por: actor })),
        { onConflict: "email", ignoreDuplicates: true },
      );
      if (error) { console.error("[usuarios] importar:", error.message); return err("No se pudo importar.", 500); }
      await auditar(svc, actor, "*", "importar", null, { emails: nuevos.map((f) => f.email) });
    }
    return NextResponse.json({ ok: true, importados: nuevos.length });
  }

  if (!emailValido(email)) return err("Email inválido.");
  const antes = await leer(svc, email);

  if (accion === "guardar") {
    const grupos = Array.isArray(b.grupos) ? b.grupos : [];
    if (!grupos.every(esGrupo)) return err(`Grupos válidos: ${GRUPOS.map((g) => g.id).join(", ")}.`);
    const txt = (v: unknown, max = 120) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
    const esAdmin = b.es_admin === true;
    if (email === actor && antes?.es_admin && !esAdmin) return err("No podés sacarte el permiso de administrador a vos mismo.");
    const ventas = grupos.includes("ventas");
    const fila = {
      email,
      nombre: txt(b.nombre),
      grupos: [...new Set(grupos)],
      es_admin: esAdmin,
      es_editor: b.es_editor === true,
      edita_marketing: b.edita_marketing === true,
      vendedor: ventas ? txt(b.vendedor) : null,
      gerencia: ventas ? txt(b.gerencia) : null,
      updated_at: new Date().toISOString(),
      ...(antes ? {} : { creado_por: actor, activo: true }),
    };
    let { error } = await svc.from("usuarios").upsert(fila, { onConflict: "email" });
    if (esColumnaInexistente(error)) {
      if (fila.edita_marketing) return err(SIN_0137, 409);
      const { edita_marketing: _sin0137, ...resto } = fila; // sin 0137: se guarda el resto igual
      ({ error } = await svc.from("usuarios").upsert(resto, { onConflict: "email" }));
    }
    if (error) { console.error("[usuarios] guardar:", error.message); return err("No se pudo guardar.", 500); }
    await auditar(svc, actor, email, antes ? "editar" : "alta", antes, fila);
    return NextResponse.json({ ok: true });
  }

  if (!antes) return err("Ese usuario no está en la lista.", 404);

  if (accion === "activo") {
    const activo = b.activo === true;
    if (email === actor && !activo) return err("No podés desactivarte a vos mismo.");
    try {
      const id = await authUserId(svc, email);
      if (id) {
        const { error } = await svc.auth.admin.updateUserById(id, { ban_duration: activo ? "none" : "876000h" });
        if (error) throw new Error(error.message);
      }
    } catch (e) {
      console.error("[usuarios] ban:", e instanceof Error ? e.message : e);
      return err("No se pudo bloquear/desbloquear el ingreso. Probá de nuevo.", 500);
    }
    const { error } = await svc.from("usuarios").update({ activo, updated_at: new Date().toISOString() }).eq("email", email);
    if (error) { console.error("[usuarios] activo:", error.message); return err("No se pudo guardar.", 500); }
    await auditar(svc, actor, email, activo ? "reactivar" : "desactivar", { activo: antes.activo }, { activo });
    return NextResponse.json({ ok: true });
  }

  if (accion === "invitar" || accion === "resetear") {
    if (!antes.activo) return err("El usuario está desactivado: reactivalo primero.");
    // Invitación crea la cuenta si no existe; si ya existe, va un link de recuperación (mismo efecto: elegir clave).
    let tipo: "invite" | "recovery" = accion === "invitar" ? "invite" : "recovery";
    let r = await svc.auth.admin.generateLink({ type: tipo, email });
    if (r.error && tipo === "invite" && /already|registered|exists/i.test(r.error.message)) {
      tipo = "recovery";
      r = await svc.auth.admin.generateLink({ type: tipo, email });
    }
    const hash = r.data?.properties?.hashed_token;
    if (r.error || !hash) {
      console.error("[usuarios] generateLink:", r.error?.message);
      return err("No se pudo generar el link. Probá de nuevo.", 500);
    }
    const link = `${getSiteOrigin()}/auth/callback?token_hash=${encodeURIComponent(hash)}&type=${tipo}&next=${encodeURIComponent(PASSWORD_PATH)}`;
    const grupos = antes.grupos.map((g) => GRUPOS.find((x) => x.id === g)?.label ?? g).join(", ");
    const reset = accion === "resetear";
    const env = await sendEmail(email, reset ? "Elegí tu clave nueva · Tablero Drean" : "Tu acceso al tablero de Drean", mailHtml(antes.nombre, grupos, link, reset));
    await auditar(svc, actor, email, reset ? "resetear_clave" : "invitar", null, { tipo, enviado: env.ok, error: env.error ?? null });
    if (!env.ok) return err(`No se pudo mandar el mail (${env.error}).`, 502);
    return NextResponse.json({ ok: true });
  }

  return err("Acción desconocida.");
}
