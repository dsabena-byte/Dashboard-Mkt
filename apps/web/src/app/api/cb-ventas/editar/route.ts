import { NextResponse } from "next/server";
import { exigirEdicion, getMiPerfil } from "@/lib/usuarios-server";
import { auditarCbv, leerCatalogo, leerClientes, svc } from "@/lib/cb-ventas/server";
import { CATEGORIAS, limpiarHomologos, parseCatalogo, parseClasificacion, TIPOLOGIAS } from "@/lib/cb-ventas/core";
import type { Categoria, TipoCB, Tipologia } from "@/lib/cb-ventas/types";

// Edición puntual de CB Ventas (solo quien edita el área trade: es_editor o admin). Todo queda en vt_auditoria.
//   cliente_guardar { cliente, tipologia, vendedor, gerencia, peso (0..1), id_sap } · cliente_borrar { cliente }
//   clientes_csv { csv, confirmar? }   → Clasificacion-clientes-*.csv: vista previa o reemplazo de la lista
//   catalogo_agregar { tipologia, cliente|null, categoria, tipo, modelo, homologos[] }
//   catalogo_guardar { id, tipo, modelo, homologos[] } · catalogo_borrar { id }
//   catalogo_csv { csv, confirmar? }   → Cuadros Basicos-*-hom.csv: vista previa o reemplazo del catálogo
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const err = (error: string, status = 400) => NextResponse.json({ error }, { status });
const txt = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function POST(request: Request) {
  const no = await exigirEdicion("trade");
  if (no) return no;
  const actor = (await getMiPerfil()).user?.email?.toLowerCase() ?? null;
  let b: Record<string, unknown>;
  try {
    b = (await request.json()) as Record<string, unknown>;
  } catch {
    return err("JSON inválido");
  }
  const s = svc();
  const accion = txt(b.accion, 40);

  if (accion === "cliente_guardar") {
    const cliente = txt(b.cliente);
    const tipologia = txt(b.tipologia) as Tipologia;
    const peso = Number(b.peso ?? 0);
    if (!cliente) return err("Falta la razón social.");
    if (!TIPOLOGIAS.includes(tipologia)) return err("Tipología inválida.");
    if (!Number.isFinite(peso) || peso < 0 || peso > 1) return err("El peso va entre 0 y 100%.");
    const { data: antes } = await s.from("vt_clientes").select("*").eq("cliente", cliente).maybeSingle();
    const fila = {
      cliente, tipologia, peso, vendedor: txt(b.vendedor), gerencia: txt(b.gerencia), id_sap: txt(b.id_sap, 40) || null,
      orden: (antes as { orden?: number } | null)?.orden ?? 100000, updated_at: new Date().toISOString(), updated_by: actor,
    };
    const { error } = await s.from("vt_clientes").upsert(fila, { onConflict: "cliente" });
    if (error) return err(error.message, 500);
    await auditarCbv(s, actor, "cliente", antes ? "editar" : "alta", antes, fila);
    return NextResponse.json({ ok: true });
  }

  if (accion === "cliente_borrar") {
    const cliente = txt(b.cliente);
    const { data: antes } = await s.from("vt_clientes").select("*").eq("cliente", cliente).maybeSingle();
    if (!antes) return err("Ese cliente no existe.", 404);
    const { error } = await s.from("vt_clientes").delete().eq("cliente", cliente);
    if (error) return err(error.message, 500);
    await auditarCbv(s, actor, "cliente", "baja", antes, null);
    return NextResponse.json({ ok: true });
  }

  if (accion === "clientes_csv") {
    const filas = parseClasificacion(txt(b.csv, 2_000_000));
    const vistos = new Set<string>();
    const unicas = filas.filter((f) => f.cliente && !vistos.has(f.cliente) && vistos.add(f.cliente));
    if (!unicas.length) return err("No encontré clientes con tipología válida (columnas ID, CLIENTE, PESO FACTURACION, TIPOLOGIA, VENDEDOR, GERENCIA).");
    const antes = await leerClientes(s);
    const resumen = { filas: unicas.length, repetidos: filas.length - unicas.length, antes: antes.length, nuevos: unicas.filter((f) => !antes.some((a) => a.cliente === f.cliente)).length, salen: antes.filter((a) => !vistos.has(a.cliente)).length };
    if (b.confirmar !== true) return NextResponse.json({ ok: true, vistaPrevia: resumen });
    const now = new Date().toISOString();
    const rows = unicas.map((f, i) => ({ cliente: f.cliente, id_sap: f.id || null, tipologia: f.tipologia, vendedor: f.vendedor, gerencia: f.gerente, peso: f.pesoFacturacion, orden: i, updated_at: now, updated_by: actor }));
    const up = await s.from("vt_clientes").upsert(rows, { onConflict: "cliente" });
    if (up.error) return err(up.error.message, 500);
    const salen = antes.filter((a) => !vistos.has(a.cliente)).map((a) => a.cliente);
    if (salen.length) {
      const del = await s.from("vt_clientes").delete().in("cliente", salen);
      if (del.error) return err(del.error.message, 500);
    }
    await auditarCbv(s, actor, "clientes", "importar_csv", { filas: antes.length }, resumen);
    return NextResponse.json({ ok: true, resumen });
  }

  if (accion === "catalogo_agregar") {
    const tipologia = txt(b.tipologia) as Tipologia;
    const categoria = txt(b.categoria) as Categoria;
    const tipo = txt(b.tipo) as TipoCB;
    const modelo = txt(b.modelo, 80);
    if (!TIPOLOGIAS.includes(tipologia) || !CATEGORIAS.includes(categoria) || !["INFALTABLE", "ESTRATEGICO"].includes(tipo) || !modelo) {
      return err("Completá tipología, categoría, tipo y modelo.");
    }
    const homologos = limpiarHomologos(modelo, Array.isArray(b.homologos) ? b.homologos.map((h) => txt(h, 80)) : []);
    const fila = { tipologia, cliente: txt(b.cliente) || null, categoria, tipo, modelo, homologos, orden: 100000, updated_at: new Date().toISOString(), updated_by: actor };
    const { data, error } = await s.from("vt_cb_catalogo").insert(fila).select("id").single();
    if (error) return err(error.message, 500);
    await auditarCbv(s, actor, "catalogo", "alta", null, { id: (data as { id: number }).id, ...fila });
    return NextResponse.json({ ok: true });
  }

  if (accion === "catalogo_guardar" || accion === "catalogo_borrar") {
    const id = Number(b.id);
    const { data: antes } = await s.from("vt_cb_catalogo").select("*").eq("id", id).maybeSingle();
    if (!antes) return err("Ese renglón no existe.", 404);
    if (accion === "catalogo_borrar") {
      const { error } = await s.from("vt_cb_catalogo").delete().eq("id", id);
      if (error) return err(error.message, 500);
      await auditarCbv(s, actor, "catalogo", "baja", antes, null);
      return NextResponse.json({ ok: true });
    }
    const tipo = txt(b.tipo) as TipoCB;
    const modelo = txt(b.modelo, 80);
    if (!["INFALTABLE", "ESTRATEGICO"].includes(tipo) || !modelo) return err("Tipo o modelo inválido.");
    const cambios = { tipo, modelo, homologos: limpiarHomologos(modelo, Array.isArray(b.homologos) ? b.homologos.map((h) => txt(h, 80)) : []), updated_at: new Date().toISOString(), updated_by: actor };
    const { error } = await s.from("vt_cb_catalogo").update(cambios).eq("id", id);
    if (error) return err(error.message, 500);
    await auditarCbv(s, actor, "catalogo", "editar", antes, { ...antes, ...cambios });
    return NextResponse.json({ ok: true });
  }

  if (accion === "catalogo_csv") {
    const filas = parseCatalogo(txt(b.csv, 2_000_000));
    if (!filas.length) return err("No encontré renglones válidos (columnas TIPOLOGIA, CLIENTE, CUADRO BASICO, CATEGORIA, MODELO, HOMOLOGO 1…).");
    const antes = await leerCatalogo(s);
    const resumen = { renglones: filas.length, antes: antes.length, clientes: new Set(filas.map((f) => f.cliente ?? `(${f.tipologia})`)).size, modelos: new Set(filas.map((f) => f.modelo)).size };
    if (b.confirmar !== true) return NextResponse.json({ ok: true, vistaPrevia: resumen });
    const now = new Date().toISOString();
    // Primero se inserta lo nuevo y después se borra lo viejo: si algo falla, nunca queda vacío.
    const ins = await s.from("vt_cb_catalogo").insert(filas.map((f) => ({ ...f, updated_at: now, updated_by: actor })));
    if (ins.error) return err(ins.error.message, 500);
    if (antes.length) {
      const ids = antes.map((a) => a.id!);
      for (let i = 0; i < ids.length; i += 500) {
        const del = await s.from("vt_cb_catalogo").delete().in("id", ids.slice(i, i + 500));
        if (del.error) return err(`Se cargó el catálogo nuevo pero no se pudo borrar el anterior: ${del.error.message}`, 500);
      }
    }
    await auditarCbv(s, actor, "catalogo", "importar_csv", { renglones: antes.length }, resumen);
    return NextResponse.json({ ok: true, resumen });
  }

  return err("Acción desconocida.");
}
