import { NextResponse } from "next/server";
import { exigirEdicion, getMiPerfil } from "@/lib/usuarios-server";
import { auditarCbv, svc } from "@/lib/cb-ventas/server";
import { CATEGORIAS, limpiarHomologos, TIPOLOGIAS } from "@/lib/cb-ventas/core";
import { hoyAR, planEdicion } from "@/lib/cb-ventas/vigencia";
import type { Categoria, TipoCB, Tipologia } from "@/lib/cb-ventas/types";

// Edición puntual de CB Ventas (solo quien edita el área trade: es_editor o admin). Todo queda en vt_auditoria.
//   cliente_guardar { cliente, tipologia, vendedor, gerencia, peso (0..1), id_sap } · cliente_borrar { cliente }
//   catalogo_agregar { tipologia, cliente|null, categoria, tipo, modelo, homologos[] }
//   catalogo_guardar { id, tipo, modelo, homologos[] } · catalogo_borrar { id }
// Catálogo con VIGENCIA (0140): lo que ya valió en un mes pasado nunca se pisa ni se borra; se cierra al fin del mes
// anterior y el cambio nace el 1º de este mes (lib/cb-ventas/vigencia.ts). Ya no hay subida de CSV (pedido del dueño).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const err = (error: string, status = 400) => NextResponse.json({ error }, { status });
const TIPOS: TipoCB[] = ["INFALTABLE", "ESTRATEGICO"];
const SIN_VIGENCIA = "Falta correr la migración 0140_cb_ventas_vigencia.sql: sin ella, editar el cuadro básico cambiaría los meses pasados.";
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

  if (accion.startsWith("catalogo_")) {
    // Vigencia (0140): sin las columnas, editar cambiaría TODOS los meses pasados → se bloquea hasta correrla.
    const probe = await s.from("vt_cb_catalogo").select("vigente_desde").limit(1);
    if (probe.error) return err(probe.error.code === "42703" ? SIN_VIGENCIA : probe.error.message, probe.error.code === "42703" ? 409 : 500);
    const hoy = hoyAR();
    const nuevoDesde = `${hoy.slice(0, 7)}-01`;
    const homs = (modelo: string) => limpiarHomologos(modelo, Array.isArray(b.homologos) ? b.homologos.map((h) => txt(h, 80)) : []);
    const ahora = new Date().toISOString();

    if (accion === "catalogo_agregar") {
      const tipologia = txt(b.tipologia) as Tipologia;
      const categoria = txt(b.categoria) as Categoria;
      const tipo = txt(b.tipo) as TipoCB;
      const modelo = txt(b.modelo, 80);
      if (!TIPOLOGIAS.includes(tipologia) || !CATEGORIAS.includes(categoria) || !TIPOS.includes(tipo) || !modelo) {
        return err("Completá categoría, tipo y el código del modelo.");
      }
      const cliente = txt(b.cliente) || null;
      let dup = s.from("vt_cb_catalogo").select("id").eq("tipologia", tipologia).eq("modelo", modelo).is("vigente_hasta", null);
      dup = cliente ? dup.eq("cliente", cliente) : dup.is("cliente", null);
      const { data: ya } = await dup.limit(1);
      if (ya?.length) return err(`${modelo} ya está en este cuadro básico.`);
      // Nace el 1º de este mes: los meses pasados no lo tenían.
      const fila = { tipologia, cliente, categoria, tipo, modelo, homologos: homs(modelo), orden: 100000, vigente_desde: nuevoDesde, updated_at: ahora, updated_by: actor };
      const { data, error } = await s.from("vt_cb_catalogo").insert(fila).select("id").single();
      if (error) return err(error.message, 500);
      await auditarCbv(s, actor, "catalogo", "alta", null, { id: (data as { id: number }).id, ...fila });
      return NextResponse.json({ ok: true });
    }

    if (accion === "catalogo_guardar" || accion === "catalogo_borrar") {
      const id = Number(b.id);
      const { data: antes } = await s.from("vt_cb_catalogo").select("*").eq("id", id).maybeSingle();
      if (!antes) return err("Ese renglón no existe.", 404);
      const row = antes as Record<string, unknown> & { vigente_desde: string | null; vigente_hasta: string | null };
      if (row.vigente_hasta) return err("Ese renglón ya no está vigente (es historia): no se edita.");
      const plan = planEdicion({ desde: row.vigente_desde }, hoy);

      if (accion === "catalogo_borrar") {
        // Nació este mes → se borra. Si ya valió en un mes pasado → se cierra al fin del mes anterior (la historia queda).
        const r = plan.modo === "en_lugar"
          ? await s.from("vt_cb_catalogo").delete().eq("id", id)
          : await s.from("vt_cb_catalogo").update({ vigente_hasta: plan.hasta, updated_at: ahora, updated_by: actor }).eq("id", id);
        if (r.error) return err(r.error.message, 500);
        await auditarCbv(s, actor, "catalogo", "baja", antes, plan.modo === "en_lugar" ? null : { ...row, vigente_hasta: plan.hasta });
        return NextResponse.json({ ok: true });
      }

      const tipo = txt(b.tipo) as TipoCB;
      const modelo = txt(b.modelo, 80);
      if (!TIPOS.includes(tipo) || !modelo) return err("El modelo no puede quedar vacío y el tipo es Infaltable o Estratégico.");
      const cambios = { tipo, modelo, homologos: homs(modelo), updated_at: ahora, updated_by: actor };
      if (plan.modo === "en_lugar") {
        const { error } = await s.from("vt_cb_catalogo").update(cambios).eq("id", id);
        if (error) return err(error.message, 500);
        await auditarCbv(s, actor, "catalogo", "editar", antes, { ...row, ...cambios });
        return NextResponse.json({ ok: true });
      }
      // Primero la versión nueva (desde el 1º de este mes) y después se cierra la vieja; si el cierre falla, se deshace.
      const nueva = { tipologia: row.tipologia, cliente: row.cliente, categoria: row.categoria, orden: row.orden, ...cambios, vigente_desde: plan.desde, vigente_hasta: null };
      const ins = await s.from("vt_cb_catalogo").insert(nueva).select("id").single();
      if (ins.error) return err(ins.error.message, 500);
      const cierre = await s.from("vt_cb_catalogo").update({ vigente_hasta: plan.hasta }).eq("id", id);
      if (cierre.error) {
        await s.from("vt_cb_catalogo").delete().eq("id", (ins.data as { id: number }).id);
        return err(cierre.error.message, 500);
      }
      await auditarCbv(s, actor, "catalogo", "editar", antes, { cerrado: { id, vigente_hasta: plan.hasta }, nuevo: { id: (ins.data as { id: number }).id, ...nueva } });
      return NextResponse.json({ ok: true });
    }
  }

  return err("Acción desconocida.");
}
