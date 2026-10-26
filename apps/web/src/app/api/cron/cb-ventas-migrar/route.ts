import { NextResponse } from "next/server";
import { decodeCsv, expandirCatalogo, parseCatalogo, parseClasificacion } from "@/lib/cb-ventas/core";
import { PATRON_CB, PATRON_CLASIF, ultimoCsvDrive } from "@/lib/cb-ventas/fuentes-viejas";
import { leerCatalogo, leerClientes, svc } from "@/lib/cb-ventas/server";

// Siembra vt_clientes y vt_cb_catalogo desde los MISMOS CSV de Drive que lee hoy la app vieja (/ventas):
// el Clasificacion-clientes-*.csv y el Cuadros Basicos-*-hom.csv más recientes de la carpeta cuadro-basico-ventas.
// Idempotente: reemplaza ambas tablas por el contenido de los CSV. `?dry=1` = solo cuenta, no escribe.
// Las ventas NO se copian: llegan solas con la próxima corrida del Office Script (es reemplazo total, igual que antes).
// Auth: Authorization: Bearer CRON_SECRET. Env: GOOGLE_SERVICE_ACCOUNT_JSON + DRIVE_CB_FOLDER_ID (las de la app vieja).
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const dry = new URL(request.url).searchParams.get("dry") === "1";
  try {
    const [fCb, fCl] = await Promise.all([ultimoCsvDrive(PATRON_CB), ultimoCsvDrive(PATRON_CLASIF)]);
    if (!fCb || !fCl) return NextResponse.json({ ok: false, error: "No encontré los CSV (Cuadros Basicos* y Clasificacion-clientes*) en Drive." }, { status: 500 });
    const clasificacion = parseClasificacion(decodeCsv(fCl.bytes));
    const catalogo = parseCatalogo(decodeCsv(fCb.bytes));
    const items = expandirCatalogo(catalogo, clasificacion);
    const resumen = {
      archivos: { cuadroBasico: fCb.name, clasificacion: fCl.name },
      clientes: clasificacion.length,
      clientesRepetidos: clasificacion.length - new Set(clasificacion.map((c) => c.cliente)).size,
      renglonesCatalogo: catalogo.length,
      itemsPorCliente: items.length,
      infaltables: items.filter((i) => i.tipo === "INFALTABLE").length,
      estrategicos: items.filter((i) => i.tipo === "ESTRATEGICO").length,
    };
    if (dry) return NextResponse.json({ ok: true, dry: true, ...resumen });

    const s = svc();
    const now = new Date().toISOString();
    const vistos = new Set<string>();
    const rows = clasificacion
      .filter((c) => c.cliente && !vistos.has(c.cliente) && vistos.add(c.cliente))
      .map((c, i) => ({ cliente: c.cliente, id_sap: c.id || null, tipologia: c.tipologia, vendedor: c.vendedor, gerencia: c.gerente, peso: c.pesoFacturacion, orden: i, updated_at: now, updated_by: "migracion" }));
    const [antesCl, antesCat] = await Promise.all([leerClientes(s), leerCatalogo(s)]);
    const up = await s.from("vt_clientes").upsert(rows, { onConflict: "cliente" });
    if (up.error) throw new Error(up.error.message);
    const salen = antesCl.filter((a) => !vistos.has(a.cliente)).map((a) => a.cliente);
    if (salen.length) { const d = await s.from("vt_clientes").delete().in("cliente", salen); if (d.error) throw new Error(d.error.message); }
    const ins = await s.from("vt_cb_catalogo").insert(catalogo.map((r) => ({ ...r, updated_at: now, updated_by: "migracion" })));
    if (ins.error) throw new Error(ins.error.message);
    const ids = antesCat.map((a) => a.id!);
    for (let i = 0; i < ids.length; i += 500) { const d = await s.from("vt_cb_catalogo").delete().in("id", ids.slice(i, i + 500)); if (d.error) throw new Error(d.error.message); }
    await s.from("vt_auditoria").insert({ actor_email: "migracion", entidad: "migracion", accion: "sembrar_desde_drive", antes: { clientes: antesCl.length, catalogo: antesCat.length }, despues: resumen });
    return NextResponse.json({ ok: true, ...resumen, escritos: { clientes: rows.length, catalogo: catalogo.length, clientesBorrados: salen.length, catalogoAnteriorBorrado: ids.length } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[cb-ventas-migrar]", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
