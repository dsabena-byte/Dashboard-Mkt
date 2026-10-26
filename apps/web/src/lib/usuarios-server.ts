import "server-only";
import { cache } from "react";
import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { getServerSupabase } from "@/lib/supabase-server";
import { isPathAllowed } from "@/lib/dashboard-access";
import {
  ADMIN_LEGACY,
  esColumnaInexistente,
  esTablaInexistente,
  puedeEditar,
  rutasPermitidas,
  type AreaEdicion,
  type UsuarioRow,
} from "@/lib/usuarios-core";

// Perfil del usuario logueado (tabla usuarios, 0136). Se lee con la sesión (RLS: solo su fila).
//   legacy = la tabla no existe todavía → se mantiene lo de antes (regla de dominio + ve todo).
//   error  = otra falla de la consulta → se CIERRA el acceso (no ve nada).
export type EstadoPerfil = "ok" | "legacy" | "error";
export interface MiPerfil { user: User | null; estado: EstadoPerfil; row: UsuarioRow | null }

export const COLS_USUARIO = "email,nombre,grupos,es_admin,es_editor,vendedor,gerencia,activo,ultimo_acceso,creado_por,created_at,updated_at";

type Res = { data: unknown; error: { code?: string; message: string } | null; status: number };
let avisoSin0137 = false;
/**
 * Corre el select con `edita_marketing` (0137); si la columna todavía no existe, repite sin ella
 * (edita_marketing queda false) para no romper las lecturas. Avisa una vez en el log.
 */
export async function selectUsuarios<T extends Res>(run: (cols: string) => PromiseLike<T>): Promise<T> {
  const r = await run(`${COLS_USUARIO},edita_marketing`);
  if (!esColumnaInexistente(r.error)) return r;
  if (!avisoSin0137) { avisoSin0137 = true; console.warn("[usuarios] falta la migración 0137 (edita_marketing): nadie edita Marketing salvo los admins."); }
  return run(COLS_USUARIO);
}

export const getMiPerfil = cache(async (): Promise<MiPerfil> => {
  const supabase = getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return { user: user ?? null, estado: "ok", row: null };
  const email = user.email.toLowerCase();
  const { data, error, status } = await selectUsuarios((cols) => supabase.from("usuarios").select(cols).eq("email", email).maybeSingle());
  if (error) {
    if (esTablaInexistente(error, status)) return { user, estado: "legacy", row: null };
    console.error("[usuarios] no se pudo leer el perfil:", status, error.message);
    return { user, estado: "error", row: null };
  }
  return { user, estado: "ok", row: (data as UsuarioRow | null) ?? null };
});

/** Tableros permitidos del usuario logueado: null = todos; [] = ninguno (sin sesión, sin fila, inactivo o error). */
export async function getAllowedPaths(): Promise<string[] | null> {
  try {
    const p = await getMiPerfil();
    if (!p.user) return [];
    if (p.estado === "legacy") return null;
    if (p.estado === "error" || !p.row?.activo) return [];
    return rutasPermitidas(p.row);
  } catch (e) {
    console.error("[usuarios] getAllowedPaths:", e instanceof Error ? e.message : e);
    return [];
  }
}

/** Admin de /usuarios. Sin la tabla (legacy) solo el admin inicial. */
export async function esAdminActual(): Promise<{ email: string; legacy: boolean } | null> {
  const p = await getMiPerfil().catch(() => null);
  const email = p?.user?.email?.toLowerCase();
  if (!p || !email) return null;
  if (p.estado === "legacy") return ADMIN_LEGACY && email === ADMIN_LEGACY ? { email, legacy: true } : null;
  return p.estado === "ok" && p.row?.activo && p.row.es_admin ? { email, legacy: false } : null;
}

/** Para las APIs que reciben el tablero por parámetro (Diagnóstico, señales): `dash` = slug de la ruta. */
export async function puedeVerTablero(dash: string): Promise<boolean> {
  return isPathAllowed("/" + dash, await getAllowedPaths());
}

export const SIN_PERMISO_EDICION = "No tenés permiso para editar esto. Pedíselo al administrador.";

/** ¿El usuario logueado puede editar el área? Legacy (sin la tabla 0136) → sí, como antes. */
export async function puedeEditarActual(area: AreaEdicion): Promise<boolean> {
  const p = await getMiPerfil().catch(() => null);
  if (!p?.user) return false;
  if (p.estado === "legacy") return true;
  return p.estado === "ok" && puedeEditar(p.row, area);
}

/**
 * Para route handlers que ESCRIBEN o gastan: null si puede, si no la respuesta 403 lista para devolver.
 * Uso: `const no = await exigirEdicion("marketing"); if (no) return no;`
 */
export async function exigirEdicion(area: AreaEdicion): Promise<NextResponse | null> {
  return (await puedeEditarActual(area)) ? null : NextResponse.json({ error: SIN_PERMISO_EDICION }, { status: 403 });
}
