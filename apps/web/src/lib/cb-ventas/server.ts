import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@dashboard/db";
import { getMiPerfil, puedeVerTablero } from "@/lib/usuarios-server";
import { esTablaInexistente } from "@/lib/usuarios-core";
import { aplicarAlcance, expandirCatalogo, type Alcance, type CatalogoRow } from "./core";
import type { ClasificacionCliente, CuadroBasicoItem, VentaRow, VentasFile } from "./types";

// CB Ventas · lectura de la base (migración 0139). Service role SOLO después de validar sesión/tablero;
// el alcance (vendedor / gerencia) se aplica ACÁ, antes de mandar nada al navegador.

export const SIN_TABLA_CBV = "Falta correr la migración 0139_cb_ventas.sql en el SQL Editor de Supabase.";

export const svc = () => createServiceClient() as unknown as SupabaseClient;

type Res<T> = { data: T[] | null; error: { code?: string; message: string } | null; status: number };

/** Todas las filas (PostgREST corta en 1000), orden estable por la columna dada. */
async function todas<T>(q: (from: number, to: number) => PromiseLike<Res<T>>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error, status } = await q(from, from + 999);
    if (error) throw Object.assign(new Error(error.message), { code: error.code, status });
    out.push(...(data ?? []));
    if ((data ?? []).length < 1000) return out;
  }
}

export interface ClienteDb { cliente: string; id_sap: string | null; tipologia: ClasificacionCliente["tipologia"]; vendedor: string; gerencia: string; peso: number; orden: number }
interface VentaDb { documento: string; cliente: string; sku: string; tipo: "FC" | "BO"; unidades: number | string; fecha: string; mes: number; vendedor: string; fecha_factura: string | null; canal: string | null }

export const aClasificacion = (c: ClienteDb): ClasificacionCliente => ({
  id: c.id_sap ?? "", cliente: c.cliente, pesoFacturacion: Number(c.peso), tipologia: c.tipologia, vendedor: c.vendedor, gerente: c.gerencia,
});

export async function leerClientes(s = svc()): Promise<ClienteDb[]> {
  return todas<ClienteDb>((a, b) => s.from("vt_clientes").select("*").order("orden").order("cliente").range(a, b));
}

export async function leerCatalogo(s = svc()): Promise<CatalogoRow[]> {
  return todas<CatalogoRow>((a, b) =>
    s.from("vt_cb_catalogo").select("id,tipologia,cliente,tipo,categoria,modelo,homologos,orden").order("orden").order("id").range(a, b));
}

/** Cuadro básico por cliente (lo usan el tablero, la ingesta y los pares del Office Script). */
export async function leerCuadroBasico(s = svc()): Promise<{ cuadroBasico: CuadroBasicoItem[]; clasificacion: ClasificacionCliente[] }> {
  const [clientes, catalogo] = await Promise.all([leerClientes(s), leerCatalogo(s)]);
  const clasificacion = clientes.map(aClasificacion);
  return { cuadroBasico: expandirCatalogo(catalogo, clasificacion), clasificacion };
}

async function leerVentas(s: SupabaseClient): Promise<VentasFile> {
  const [rows, ing] = await Promise.all([
    todas<VentaDb>((a, b) => s.from("vt_ventas").select("documento,cliente,sku,tipo,unidades,fecha,mes,vendedor,fecha_factura,canal").order("id").range(a, b)),
    s.from("vt_ingestas").select("generated_at").order("id", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const generatedAt = (ing.data as { generated_at: string } | null)?.generated_at ?? null;
  return {
    generatedAt: generatedAt ?? new Date().toISOString(),
    source: generatedAt ? "sharepoint" : "dummy",
    rows: rows.map((r): VentaRow => ({
      documentoVentas: r.documento,
      cliente: r.cliente,
      sku: r.sku,
      tipo: r.tipo,
      unidades: Number(r.unidades),
      fecha: r.fecha,
      mes: r.mes,
      vendedor: r.vendedor,
      ...(r.fecha_factura ? { fechaFactura: r.fecha_factura } : {}),
      ...(r.canal === "FOB" ? { canal: "FOB" as const } : {}),
    })),
  };
}

/** Alcance del usuario logueado: admin / marketing / sin vendedor ni gerencia → todo. */
export async function alcanceActual(): Promise<Alcance> {
  const p = await getMiPerfil().catch(() => null);
  const row = p?.estado === "ok" ? p.row : null;
  if (!row || row.es_admin || row.grupos.includes("marketing")) return { vendedor: null, gerencia: null };
  return { vendedor: row.vendedor?.trim() || null, gerencia: row.gerencia?.trim() || null };
}

export type CbVentasDatos =
  | { estado: "ok"; cuadroBasico: CuadroBasicoItem[]; clasificacion: ClasificacionCliente[]; ventas: VentasFile; alcance: Alcance }
  | { estado: "sin_tabla" | "sin_acceso" | "error"; mensaje: string };

/** Datos del tablero YA recortados al alcance del usuario. */
export async function getCbVentasDatos(): Promise<CbVentasDatos> {
  if (!(await puedeVerTablero("cb-ventas"))) return { estado: "sin_acceso", mensaje: "No tenés acceso a CB Ventas." };
  try {
    const s = svc();
    const [{ cuadroBasico, clasificacion }, ventas, alcance] = await Promise.all([leerCuadroBasico(s), leerVentas(s), alcanceActual()]);
    return { estado: "ok", ...aplicarAlcance({ cuadroBasico, clasificacion, ventas }, alcance), alcance };
  } catch (e) {
    const err = e as { code?: string; message?: string; status?: number };
    if (esTablaInexistente(err, err.status)) return { estado: "sin_tabla", mensaje: SIN_TABLA_CBV };
    console.error("[cb-ventas] lectura:", err.message);
    return { estado: "error", mensaje: "No se pudieron leer los datos de CB Ventas." };
  }
}

export async function auditarCbv(s: SupabaseClient, actor: string | null, entidad: string, accion: string, antes: unknown, despues: unknown) {
  const { error } = await s.from("vt_auditoria").insert({ actor_email: actor, entidad, accion, antes, despues });
  if (error) console.error("[cb-ventas] auditoría:", error.message);
}
