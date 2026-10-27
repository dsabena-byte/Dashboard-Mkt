import { NextResponse } from "next/server";
import { exigirEdicion, getMiPerfil, puedeVerTablero } from "@/lib/usuarios-server";
import { trAll, trJson, trRest, trRpc, trUpsert, esFaltaTabla, TradeDbError } from "@/lib/trade-db";
import { refrescarDerivados } from "@/lib/trade-derivados";
import { CATEGORIAS_FS, faltantes, normClave, validarFila, type Cargado, type FilaCb, type FilaTienda, type TipoCarga } from "@/lib/trade-carga-core";

// "Cargar datos" de Trade (pestaña de /cuadros-basicos). El navegador parsea el CSV (trade-carga-core) y sube
// las filas por partes a una carga en estado "subiendo"; "confirmar" reemplaza la semana (+categoría) en UNA
// transacción (función tr_confirmar_carga, 0138) y recalcula los precálculos. Escribir = exigirEdicion("trade").
//   GET                         → últimas cargas, qué hay cargado, qué falta, maestros (para avisar desconocidos)
//   POST {accion:"iniciar"}     → {tipo, archivo, anio, semana, categoria} → {carga_id}
//   POST {accion:"filas"}       → {carga_id, filas[≤3000]} (cada fila se valida acá)
//   POST {accion:"confirmar"}   → {carga_id, nuevas:{cadenas, tiendas, skus}, alias:[{de, a}]}
//   POST {accion:"tiendas"}     → {archivo, filas} maestro Tienda-promotor-supervisor (upsert + reasignaciones)
//   DELETE ?id=                 → deshacer esa carga (solo la última de su semana)
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const err = (e: unknown) => {
  if (esFaltaTabla(e)) return NextResponse.json({ error: "Falta correr la migración 0138_trade.sql." }, { status: 503 });
  const msg = e instanceof Error ? e.message : String(e);
  console.error("[trade/carga]", msg);
  return NextResponse.json({ error: msg.replace(/^rpc\/\w+: \d+ /, "") }, { status: e instanceof TradeDbError && e.status < 500 ? 400 : 500 });
};
const email = async () => (await getMiPerfil().catch(() => null))?.user?.email?.toLowerCase() ?? null;
const hoy = () => new Date().toISOString().slice(0, 10);

interface CargaRow { id: number; tipo: TipoCarga; archivo: string | null; anio: number | null; semana: number | null; categoria: string | null; filas: number; estado: string; usuario: string | null; created_at: string }

export async function GET() {
  if (!(await puedeVerTablero("cuadros-basicos"))) return NextResponse.json({ error: "Sin acceso" }, { status: 403 });
  try {
    const [cargas, cargado, cadenas, tiendas, skus] = await Promise.all([
      trJson<CargaRow[]>("tr_cargas?select=id,tipo,archivo,anio,semana,categoria,filas,estado,usuario,created_at&estado=neq.subiendo&order=id.desc&limit=25"),
      trAll<Cargado>("vw_tr_cargado?select=anio,semana,tipo,categoria,filas", "anio,semana,tipo,categoria"),
      trAll<{ clave: string; alias: string[] }>("tr_cadenas?select=clave,alias"),
      trAll<{ cadena: string; numero: string }>("tr_tiendas?select=cadena,numero"),
      trAll<{ sku: string }>("tr_skus?select=sku", "sku"),
    ]);
    const mapaCad: Record<string, string> = {};
    for (const c of cadenas) { mapaCad[c.clave] = c.clave; for (const a of c.alias ?? []) mapaCad[a] = c.clave; }
    return NextResponse.json({
      cargas, cargado, faltantes: faltantes(cargado),
      maestros: { cadenas: mapaCad, tiendas: tiendas.map((t) => `${t.cadena}|${t.numero}`), numeros: [...new Set(tiendas.map((t) => t.numero))], skus: skus.map((s) => s.sku) },
    });
  } catch (e) { return err(e); }
}

export async function POST(req: Request) {
  const no = await exigirEdicion("trade");
  if (no) return no;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Pedido inválido" }, { status: 400 });
  const usuario = await email();
  try {
    if (body.accion === "iniciar") {
      const tipo = body.tipo as TipoCarga;
      if (!["cb", "fs", "u3"].includes(tipo)) return NextResponse.json({ error: "Tipo inválido" }, { status: 400 });
      const anio = tipo === "u3" ? null : Number(body.anio), semana = tipo === "u3" ? null : Number(body.semana);
      const categoria = tipo === "fs" ? String(body.categoria ?? "") : null;
      if (tipo !== "u3" && (!Number.isInteger(anio) || anio! < 2024 || anio! > 2100 || !Number.isInteger(semana) || semana! < 1 || semana! > 53))
        return NextResponse.json({ error: "Año o semana inválidos" }, { status: 400 });
      if (tipo === "fs" && !CATEGORIAS_FS.includes(categoria as never)) return NextResponse.json({ error: "Elegí la categoría del Floor Share" }, { status: 400 });
      const archivo = String(body.archivo ?? "").slice(0, 200);
      const res = await trRest("tr_cargas?select=id", {
        method: "POST", prefer: "return=representation",
        body: JSON.stringify([{ tipo, anio, semana, categoria, archivo, usuario, estado: "subiendo" }]),
      });
      const [row] = (await res.json()) as Array<{ id: number }>;
      return NextResponse.json({ carga_id: row!.id });
    }

    const cargaId = Number(body.carga_id);
    const carga = Number.isInteger(cargaId) ? (await trJson<CargaRow[]>(`tr_cargas?id=eq.${cargaId}&select=id,tipo,estado,usuario,anio,semana,categoria`))[0] : undefined;

    if (body.accion === "filas") {
      if (!carga || carga.estado !== "subiendo" || carga.usuario !== usuario) return NextResponse.json({ error: "Carga no encontrada" }, { status: 404 });
      const filas = Array.isArray(body.filas) ? body.filas : [];
      if (!filas.length || filas.length > 3000) return NextResponse.json({ error: "Mandá entre 1 y 3000 filas por parte" }, { status: 400 });
      for (let i = 0; i < filas.length; i++) {
        const m = validarFila(carga.tipo, filas[i]);
        if (m) return NextResponse.json({ error: `Fila ${i + 1}: ${m}` }, { status: 400 });
      }
      if (carga.tipo === "cb") await completarDivision(filas as FilaCb[]);
      await trRest("tr_carga_filas", { method: "POST", prefer: "return=minimal", body: JSON.stringify(filas.map((fila) => ({ carga_id: cargaId, fila }))) });
      return NextResponse.json({ ok: true, recibidas: filas.length });
    }

    if (body.accion === "confirmar") {
      if (!carga || carga.estado !== "subiendo" || carga.usuario !== usuario) return NextResponse.json({ error: "Carga no encontrada" }, { status: 404 });
      const nuevas = (body.nuevas ?? {}) as { cadenas?: unknown; tiendas?: unknown; skus?: unknown };
      await altaMaestros(nuevas, Array.isArray(body.alias) ? body.alias : [], usuario);
      const r = await trRpc<{ filas: number; reemplazadas: number }>("tr_confirmar_carga", { p_carga_id: cargaId });
      const derivados = await refrescarDerivados().catch((e) => ({ error: e instanceof Error ? e.message : String(e) }));
      return NextResponse.json({ ok: true, ...r, derivados });
    }

    if (body.accion === "tiendas") {
      const filas = (Array.isArray(body.filas) ? body.filas : []) as FilaTienda[];
      if (!filas.length || filas.length > 5000) return NextResponse.json({ error: "El archivo no tiene tiendas" }, { status: 400 });
      for (let i = 0; i < filas.length; i++) { const m = validarFila("tiendas", filas[i]); if (m) return NextResponse.json({ error: `Fila ${i + 1}: ${m}` }, { status: 400 }); }
      const r = await cargarTiendas(filas, Array.isArray(body.alias) ? body.alias : [], usuario);
      await trRest("tr_cargas", { method: "POST", prefer: "return=minimal", body: JSON.stringify([{ tipo: "tiendas", archivo: String(body.archivo ?? "").slice(0, 200), filas: filas.length, estado: "ok", usuario, detalle: r, confirmada_at: new Date().toISOString() }]) });
      return NextResponse.json({ ok: true, ...r });
    }
    return NextResponse.json({ error: "Acción desconocida" }, { status: 400 });
  } catch (e) { return err(e); }
}

// Fila de CB sin división (pasó con 1 fila de la sem 38: salía una 4ª categoría vacía) → la del maestro de SKUs.
async function completarDivision(filas: FilaCb[]): Promise<void> {
  const sin = [...new Set(filas.filter((f) => !f.division?.trim() && f.sku).map((f) => f.sku))];
  if (!sin.length) return;
  const q = sin.map((x) => `"${x.replace(/"/g, '\\"')}"`).join(",");
  const skus = await trJson<Array<{ sku: string; division: string | null }>>(`tr_skus?select=sku,division&sku=in.(${encodeURIComponent(q)})`);
  const div = new Map(skus.filter((x) => x.division).map((x) => [x.sku, x.division!]));
  for (const f of filas) if (!f.division?.trim() && div.has(f.sku)) f.division = div.get(f.sku)!;
}

export async function DELETE(req: Request) {
  const no = await exigirEdicion("trade");
  if (no) return no;
  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Falta el id" }, { status: 400 });
  try {
    const r = await trRpc<{ restauradas: number }>("tr_deshacer_carga", { p_carga_id: id });
    await trRest("tr_auditoria", { method: "POST", prefer: "return=minimal", body: JSON.stringify([{ usuario: await email(), entidad: "carga", clave: String(id), antes: { estado: "ok" }, despues: { estado: "deshecha", ...r } }]) });
    const derivados = await refrescarDerivados().catch((e) => ({ error: e instanceof Error ? e.message : String(e) }));
    return NextResponse.json({ ok: true, ...r, derivados });
  } catch (e) { return err(e); }
}

// ───────────── maestros ─────────────
type Alias = { de: string; a: string };
const strs = (v: unknown, max = 2000): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.length <= 200).slice(0, max) : []);

/** Cadenas/tiendas/SKUs que el archivo trae y no existían (el usuario los vio en la vista previa). ignore-duplicates. */
async function altaMaestros(nuevas: { cadenas?: unknown; tiendas?: unknown; skus?: unknown }, alias: unknown[], usuario: string | null) {
  await aplicarAlias(alias, usuario);
  const cadenas = strs(nuevas.cadenas);
  if (cadenas.length) await trUpsert("tr_cadenas", cadenas.map((n) => ({ clave: normClave(n), nombre: n.trim() })), "clave", true);
  const tiendas = (Array.isArray(nuevas.tiendas) ? nuevas.tiendas : []).slice(0, 5000)
    .filter((t): t is { cadena: string; numero: string; nombre: string } => !!t && typeof t === "object" && typeof (t as Record<string, unknown>).numero === "string")
    .map((t) => ({ cadena: normClave(String(t.cadena ?? "")), numero: t.numero.slice(0, 20), nombre: String(t.nombre ?? "").slice(0, 200) }));
  if (tiendas.length) await trUpsert("tr_tiendas", tiendas, "cadena,numero", true);
  const skus = (Array.isArray(nuevas.skus) ? nuevas.skus : []).slice(0, 5000)
    .filter((s): s is Record<string, unknown> => !!s && typeof s === "object" && typeof (s as Record<string, unknown>).sku === "string")
    .map((s) => ({ sku: String(s.sku).slice(0, 80), descripcion: typeof s.descripcion === "string" ? s.descripcion.slice(0, 200) : null, division: typeof s.division === "string" ? s.division.slice(0, 80) : null, marca: typeof s.marca === "string" ? s.marca.slice(0, 80) : null }));
  if (skus.length) await trUpsert("tr_skus", skus, "sku", true);
}

/** "Esta cadena del archivo es la misma que …": suma la grafía como alias de la cadena existente. */
async function aplicarAlias(alias: unknown[], usuario: string | null) {
  for (const x of alias.slice(0, 200) as Alias[]) {
    if (!x || typeof x.de !== "string" || typeof x.a !== "string") continue;
    const de = normClave(x.de), a = normClave(x.a);
    if (!de || !a || de === a) continue;
    const [c] = await trJson<Array<{ alias: string[] }>>(`tr_cadenas?clave=eq.${encodeURIComponent(a)}&select=alias`);
    if (!c || c.alias.includes(de)) continue;
    await trRest(`tr_cadenas?clave=eq.${encodeURIComponent(a)}`, { method: "PATCH", prefer: "return=minimal", body: JSON.stringify({ alias: [...c.alias, de], updated_at: new Date().toISOString() }) });
    await trRest("tr_auditoria", { method: "POST", prefer: "return=minimal", body: JSON.stringify([{ usuario, entidad: "cadena_alias", clave: a, antes: c.alias, despues: [...c.alias, de] }]) });
  }
}

/** Tienda-promotor-supervisor: actualiza datos de la tienda y, si cambió el promotor/supervisor, cierra la asignación vigente y abre otra desde hoy. */
async function cargarTiendas(filas: FilaTienda[], alias: unknown[], usuario: string | null) {
  await aplicarAlias(alias, usuario);
  const cad = await trAll<{ clave: string; alias: string[] }>("tr_cadenas?select=clave,alias");
  const canon = new Map<string, string>();
  for (const c of cad) { canon.set(c.clave, c.clave); for (const a of c.alias ?? []) canon.set(a, c.clave); }
  const claveDe = (n: string) => canon.get(normClave(n)) ?? normClave(n);
  const nuevasCad = [...new Set(filas.map((f) => f.cadena).filter((n) => n && !canon.has(normClave(n))))];
  if (nuevasCad.length) await trUpsert("tr_cadenas", nuevasCad.map((n) => ({ clave: normClave(n), nombre: n.trim() })), "clave", true);
  await trUpsert("tr_tiendas", filas.map((f) => ({
    cadena: claveDe(f.cadena), numero: f.numero, nombre: f.nombre, segmentacion: f.segmentacion, provincia: f.provincia, localidad: f.localidad,
    activa: true, updated_at: new Date().toISOString(),
  })), "cadena,numero");
  const personas = new Map<string, string>();
  for (const f of filas) { if (f.promotor) personas.set(f.promotor, "promotor"); if (f.supervisor) personas.set(f.supervisor, personas.get(f.supervisor) === "promotor" ? "ambos" : "supervisor"); }
  if (personas.size) await trUpsert("tr_personas", [...personas].map(([nombre, rol]) => ({ nombre, rol })), "nombre", true);

  const ids = new Map((await trAll<{ id: number; cadena: string; numero: string }>("tr_tiendas?select=id,cadena,numero")).map((t) => [`${t.cadena}|${t.numero}`, t.id]));
  const vig = new Map((await trAll<{ id: number; tienda_id: number; promotor: string | null; supervisor: string | null }>("tr_tienda_asignacion?select=id,tienda_id,promotor,supervisor&hasta=is.null")).map((a) => [a.tienda_id, a]));
  const cerrar: number[] = [];
  const abrir: Record<string, unknown>[] = [];
  for (const f of filas) {
    const id = ids.get(`${claveDe(f.cadena)}|${f.numero}`);
    if (!id || (!f.promotor && !f.supervisor)) continue;
    const v = vig.get(id);
    if (v && v.promotor === f.promotor && v.supervisor === f.supervisor) continue;
    if (v) cerrar.push(v.id);
    abrir.push({ tienda_id: id, promotor: f.promotor, supervisor: f.supervisor, desde: hoy(), origen: "archivo tiendas" });
  }
  for (let i = 0; i < cerrar.length; i += 200) await trRest(`tr_tienda_asignacion?id=in.(${cerrar.slice(i, i + 200).join(",")})`, { method: "PATCH", prefer: "return=minimal", body: JSON.stringify({ hasta: hoy() }) });
  for (let i = 0; i < abrir.length; i += 500) await trRest("tr_tienda_asignacion", { method: "POST", prefer: "return=minimal", body: JSON.stringify(abrir.slice(i, i + 500)) });
  return { tiendas: filas.length, cadenas_nuevas: nuevasCad.length, reasignadas: abrir.length };
}
