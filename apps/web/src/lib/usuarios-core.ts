// Usuarios y grupos del tablero (migración 0136). PURO y client-safe: lo usan el middleware (edge),
// el server y la pantalla /usuarios. `null` = sin restricción (ve todos los tableros), array = solo esos.
import { ALWAYS_ALLOWED_PATHS } from "./dashboard-access";

export type Grupo = "marketing" | "trade" | "ventas";

export const GRUPOS: { id: Grupo; label: string }[] = [
  { id: "marketing", label: "Marketing" },
  { id: "trade", label: "Trade" },
  { id: "ventas", label: "Ventas" },
];

/** Tableros de cada grupo (null = todos). */
export const GRUPO_RUTAS: Record<Grupo, string[] | null> = {
  marketing: null,
  trade: ["/cuadros-basicos", "/floor-share"],
  ventas: ["/cb-ventas"],
};

export interface UsuarioRow {
  email: string;
  nombre: string | null;
  grupos: string[];
  es_admin: boolean;
  es_editor: boolean;
  vendedor: string | null;
  gerencia: string | null;
  activo: boolean;
  ultimo_acceso: string | null;
  creado_por?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export const esGrupo = (g: unknown): g is Grupo => GRUPOS.some((x) => x.id === g);

/** Rutas que puede ver: admin o marketing → null (todo); si no, la unión de sus grupos (+ /guia); sin grupos → []. */
export function rutasPermitidas(row: Pick<UsuarioRow, "grupos" | "es_admin">): string[] | null {
  if (row.es_admin) return null;
  const grupos = (row.grupos ?? []).filter(esGrupo);
  if (grupos.some((g) => GRUPO_RUTAS[g] === null)) return null;
  const rutas = [...new Set(grupos.flatMap((g) => GRUPO_RUTAS[g] ?? []))];
  return rutas.length ? [...rutas, ...ALWAYS_ALLOWED_PATHS] : [];
}

/**
 * APIs que puede llamar un usuario RESTRINGIDO (lo que usan las pantallas de Trade/Ventas: copiloto,
 * Diagnóstico, anotaciones, Mis acciones y metas del MetaPanel). Cada una vuelve a chequear el tablero.
 * El resto de /api → 403.
 */
export const API_PERMITIDAS_RESTRINGIDOS = ["/api/chat", "/api/insights", "/api/anotaciones", "/api/recomendaciones", "/api/metas"];

export function apiPermitida(pathname: string, rutas: string[] | null): boolean {
  if (rutas === null) return true;
  if (!rutas.length) return false;
  return API_PERMITIDAS_RESTRINGIDOS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** La tabla todavía no existe (no se corrió 0136) → modo legacy (regla vieja). */
export function esTablaInexistente(err: { code?: string | null; message?: string | null } | null | undefined, status?: number): boolean {
  if (!err) return false;
  return err.code === "PGRST205" || err.code === "42P01" || status === 404 || /does not exist|schema cache/i.test(err.message ?? "");
}

/** Único admin mientras no se corre 0136 (ya figura en la memoria pública del repo). */
export const ADMIN_LEGACY = "dsabena@gmail.com";

export const emailValido = (e: string) => /^[^\s@;,]+@[^\s@;,]+\.[^\s@;,]+$/.test(e);

export type EstadoUsuario = "activo" | "invitado" | "desactivado";
export function estadoDe(u: Pick<UsuarioRow, "activo" | "ultimo_acceso">): EstadoUsuario {
  if (!u.activo) return "desactivado";
  return u.ultimo_acceso ? "activo" : "invitado";
}

export interface FilaImport { email: string; nombre: string | null; grupos: Grupo[]; vendedor: string | null }

/** CSV del usuarios.csv viejo: email;nombre;rol;vendedor (también , o tab). Rol VENDEDOR → ventas; el resto sin grupo. */
export function parseCsvUsuarios(texto: string): { filas: FilaImport[]; errores: string[] } {
  const filas: FilaImport[] = [];
  const errores: string[] = [];
  const vistos = new Set<string>();
  const lineas = texto.replace(/^﻿/, "").split(/\r?\n/);
  lineas.forEach((linea, i) => {
    if (!linea.trim()) return;
    const sep = linea.includes(";") ? ";" : linea.includes("\t") ? "\t" : ",";
    const c = linea.split(sep).map((x) => x.trim().replace(/^"|"$/g, "").trim());
    const email = (c[0] ?? "").toLowerCase();
    if (i === 0 && email === "email") return; // encabezado
    if (!emailValido(email)) { errores.push(`Fila ${i + 1}: email inválido (${c[0] || "vacío"}).`); return; }
    if (vistos.has(email)) { errores.push(`Fila ${i + 1}: ${email} repetido.`); return; }
    vistos.add(email);
    const vendedorRol = (c[2] ?? "").toUpperCase() === "VENDEDOR";
    filas.push({
      email,
      nombre: c[1] || null,
      grupos: vendedorRol ? ["ventas"] : [],
      vendedor: vendedorRol ? c[3] || null : null,
    });
  });
  return { filas, errores };
}
