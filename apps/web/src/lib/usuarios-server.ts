import "server-only";
import { cache } from "react";
import type { User } from "@supabase/supabase-js";
import { getServerSupabase } from "@/lib/supabase-server";
import { isPathAllowed } from "@/lib/dashboard-access";
import { ADMIN_LEGACY, esTablaInexistente, rutasPermitidas, type UsuarioRow } from "@/lib/usuarios-core";

// Perfil del usuario logueado (tabla usuarios, 0136). Se lee con la sesión (RLS: solo su fila).
//   legacy = la tabla no existe todavía → se mantiene lo de antes (regla de dominio + ve todo).
//   error  = otra falla de la consulta → se CIERRA el acceso (no ve nada).
export type EstadoPerfil = "ok" | "legacy" | "error";
export interface MiPerfil { user: User | null; estado: EstadoPerfil; row: UsuarioRow | null }

export const COLS_USUARIO = "email,nombre,grupos,es_admin,es_editor,vendedor,gerencia,activo,ultimo_acceso,creado_por,created_at,updated_at";

export const getMiPerfil = cache(async (): Promise<MiPerfil> => {
  const supabase = getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return { user: user ?? null, estado: "ok", row: null };
  const { data, error, status } = await supabase.from("usuarios").select(COLS_USUARIO).eq("email", user.email.toLowerCase()).maybeSingle();
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
  if (p.estado === "legacy") return email === ADMIN_LEGACY ? { email, legacy: true } : null;
  return p.estado === "ok" && p.row?.activo && p.row.es_admin ? { email, legacy: false } : null;
}

/** Para las APIs que reciben el tablero por parámetro (Diagnóstico, señales): `dash` = slug de la ruta. */
export async function puedeVerTablero(dash: string): Promise<boolean> {
  return isPathAllowed("/" + dash, await getAllowedPaths());
}
