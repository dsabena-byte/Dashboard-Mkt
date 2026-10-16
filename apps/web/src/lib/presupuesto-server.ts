import "server-only";
import { sbAdmin } from "@/lib/supabase-admin";
import { getServerSupabase } from "@/lib/supabase-server";
import { allowedFromRows, isPathAllowed } from "@/lib/dashboard-access";
import {
  agregarParaTablero, camposCambiados, tipoDeVersion,
  type FilaAgregada, type ItemCatalogo, type Linea, type LineaIn, type Tc, type Version,
} from "@/lib/presupuesto-core";

// Presupuesto de Marketing cargado desde el tablero (migración 0125). REST con la service key; toda
// escritura deja su fila en bgt_auditoria con el email de quien la hizo. Fail-safe sin la migración.

const MISSING_RE = /relation|does not exist|schema cache|PGRST205|42P01|Could not find the table/i;
export const MIGRACION_PRESUPUESTO = "Falta correr la migración 0125_presupuesto.sql en el SQL Editor de Supabase.";
const PAGE = 1000;

export class PresupuestoError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

async function err(res: Response, what: string): Promise<never> {
  const t = await res.text().catch(() => "");
  if (res.status === 404 || MISSING_RE.test(t)) throw new PresupuestoError(MIGRACION_PRESUPUESTO, 503);
  throw new PresupuestoError(`${what}: ${t.slice(0, 300)}`, 500);
}

async function getAll<T>(path: string): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const res = await sbAdmin(path, { method: "GET", headers: { Range: `${from}-${from + PAGE - 1}`, "Range-Unit": "items" } });
    if (!res.ok) await err(res, "No se pudo leer");
    const rows = (await res.json()) as T[];
    out.push(...rows);
    if (rows.length < PAGE) return out;
  }
}

// ---------- usuario y permisos ----------
export interface UsuarioPpto { email: string; puedeReal: boolean; editor: boolean }

/** Sesión + permisos: REAL = quien ve /funnel; presupuestos y tipos de cambio = bgt_editores. */
export async function usuarioPresupuesto(): Promise<UsuarioPpto | null> {
  const supabase = getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return null;
  let allowed: string[] | null = null;
  try { const { data } = await supabase.from("dashboard_access").select("dashboard_path"); allowed = allowedFromRows(data as { dashboard_path: string }[] | null); } catch { allowed = null; }
  let editor = false;
  try {
    const res = await sbAdmin(`bgt_editores?select=email&email=eq.${encodeURIComponent(user.email.toLowerCase())}`, { method: "GET" });
    editor = res.ok && ((await res.json()) as unknown[]).length > 0;
  } catch { editor = false; }
  return { email: user.email.toLowerCase(), puedeReal: isPathAllowed("/funnel", allowed), editor };
}

// ---------- lecturas ----------
const LINEA_COLS = "id,version,mes,ceco,cuenta,nombre_cta,concepto,nro_proveedor,proveedor,detalle,solped,oc,nro_recepcion,nro_doc_contable,fecha_contabilizacion,factura,provision,ars,origen,created_at,created_by,updated_at,updated_by";

export const listVersiones = () => getAll<Version>("bgt_versiones?select=nombre,tipo,anio,cerrada&order=anio.desc,nombre.asc");
export const listTc = () => getAll<Tc>("bgt_tc?select=version,mes,tc&order=version.asc,mes.asc");
export const listCatalogo = () => getAll<ItemCatalogo>("bgt_catalogo?select=tipo,clave,nombre&order=tipo.asc,nombre.asc");

export async function listLineas(version: string): Promise<Linea[]> {
  const rows = await getAll<Linea>(`bgt_lineas?select=${LINEA_COLS}&version=eq.${encodeURIComponent(version)}&order=mes.asc,created_at.asc,id.asc`);
  return rows.map((r) => ({ ...r, ars: Number(r.ars) }));
}

export interface Movimiento { id: number; at: string; usuario: string | null; entidad: string; accion: string; version: string | null; clave: string | null; antes: unknown; despues: unknown }
export async function listAuditoria(opts: { version?: string; limit?: number } = {}): Promise<Movimiento[]> {
  const lim = Math.min(Math.max(opts.limit ?? 200, 1), 1000);
  const f = opts.version ? `&version=eq.${encodeURIComponent(opts.version)}` : "";
  const res = await sbAdmin(`bgt_auditoria?select=id,at,usuario,entidad,accion,version,clave,antes,despues&order=at.desc,id.desc&limit=${lim}${f}`, { method: "GET" });
  if (!res.ok) await err(res, "No se pudo leer el historial");
  return (await res.json()) as Movimiento[];
}

// ---------- auditoría ----------
async function auditar(rows: Omit<Movimiento, "id" | "at">[]): Promise<void> {
  for (let i = 0; i < rows.length; i += 500) {
    const res = await sbAdmin("bgt_auditoria", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify(rows.slice(i, i + 500)) });
    if (!res.ok) await err(res, "No se pudo registrar el historial");
  }
}

// ---------- versiones ----------
export async function asegurarVersiones(nombres: string[], usuario: string): Promise<void> {
  const existentes = new Set((await listVersiones()).map((v) => v.nombre));
  const nuevas = [...new Set(nombres)].filter((n) => !existentes.has(n)).map((n) => {
    const t = tipoDeVersion(n);
    if (!t) throw new PresupuestoError(`"${n}" no tiene año (ej. "BGT 2027").`);
    return { nombre: n, tipo: t.tipo, anio: t.anio, created_by: usuario };
  });
  if (!nuevas.length) return;
  const res = await sbAdmin("bgt_versiones?on_conflict=nombre", { method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=minimal" }, body: JSON.stringify(nuevas) });
  if (!res.ok) await err(res, "No se pudo crear la versión");
  await auditar(nuevas.map((v) => ({ usuario, entidad: "version", accion: "alta", version: v.nombre, clave: null, antes: null, despues: { tipo: v.tipo, anio: v.anio } })));
}

export async function setCerrada(version: string, cerrada: boolean, usuario: string): Promise<void> {
  const res = await sbAdmin(`bgt_versiones?nombre=eq.${encodeURIComponent(version)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ cerrada }) });
  if (!res.ok) await err(res, "No se pudo actualizar la versión");
  await auditar([{ usuario, entidad: "version", accion: cerrada ? "cierre" : "apertura", version, clave: null, antes: { cerrada: !cerrada }, despues: { cerrada } }]);
}

async function versionAbierta(version: string): Promise<Version> {
  const v = (await listVersiones()).find((x) => x.nombre === version);
  if (!v) throw new PresupuestoError(`No existe el presupuesto "${version}".`, 404);
  if (v.cerrada) throw new PresupuestoError(`${version} está cerrada: no se puede modificar.`, 409);
  return v;
}

// ---------- tipos de cambio ----------
/** Guarda (o borra, con tc null) tipos de cambio. Cada cambio queda en el historial. */
export async function guardarTcs(cambios: { version: string; mes: number; tc: number | null }[], usuario: string): Promise<number> {
  if (!cambios.length) return 0;
  await asegurarVersiones(cambios.map((c) => c.version), usuario);
  const antes = new Map((await listTc()).map((t) => [`${t.version}|${t.mes}`, Number(t.tc)]));
  const cerradas = new Set((await listVersiones()).filter((v) => v.cerrada).map((v) => v.nombre));
  const reales = cambios.filter((c) => (antes.get(`${c.version}|${c.mes}`) ?? null) !== c.tc);
  const bloqueada = reales.find((c) => cerradas.has(c.version));
  if (bloqueada) throw new PresupuestoError(`${bloqueada.version} está cerrada: no se pueden cambiar sus tipos de cambio.`, 409);
  const upserts = reales.filter((c) => c.tc != null).map((c) => ({ version: c.version, mes: c.mes, tc: c.tc, updated_by: usuario, updated_at: new Date().toISOString() }));
  if (upserts.length) {
    const res = await sbAdmin("bgt_tc?on_conflict=version,mes", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(upserts) });
    if (!res.ok) await err(res, "No se pudieron guardar los tipos de cambio");
  }
  for (const c of reales.filter((x) => x.tc == null)) {
    const res = await sbAdmin(`bgt_tc?version=eq.${encodeURIComponent(c.version)}&mes=eq.${c.mes}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
    if (!res.ok) await err(res, "No se pudo borrar el tipo de cambio");
  }
  await auditar(reales.map((c) => {
    const a = antes.get(`${c.version}|${c.mes}`) ?? null;
    return { usuario, entidad: "tc", accion: a == null ? "alta" : c.tc == null ? "baja" : "cambio", version: c.version, clave: String(c.mes), antes: a == null ? null : { tc: a }, despues: c.tc == null ? null : { tc: c.tc } };
  }));
  return reales.length;
}

// ---------- renglones ----------
const CAMPOS: (keyof LineaIn)[] = ["version", "mes", "ceco", "cuenta", "nombre_cta", "concepto", "nro_proveedor", "proveedor", "detalle", "solped", "oc", "nro_recepcion", "nro_doc_contable", "fecha_contabilizacion", "factura", "provision", "ars"];
const soloCampos = (l: Partial<LineaIn>) => Object.fromEntries(CAMPOS.filter((k) => k in l).map((k) => [k, l[k] ?? null])) as Partial<LineaIn>;

async function insertar(lineas: LineaIn[], origen: Linea["origen"], usuario: string): Promise<Linea[]> {
  const out: Linea[] = [];
  for (let i = 0; i < lineas.length; i += 500) {
    const body = lineas.slice(i, i + 500).map((l) => ({ ...soloCampos(l), origen, created_by: usuario, updated_by: usuario }));
    const res = await sbAdmin(`bgt_lineas?select=${LINEA_COLS}`, { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(body) });
    if (!res.ok) {
      if (out.length) await borrarIds(out.map((l) => l.id)); // deshace lo insertado en esta llamada
      await err(res, "No se pudieron guardar los renglones");
    }
    out.push(...((await res.json()) as Linea[]));
  }
  return out;
}

async function borrarIds(ids: string[]): Promise<void> {
  for (let i = 0; i < ids.length; i += 200) {
    const res = await sbAdmin(`bgt_lineas?id=in.(${ids.slice(i, i + 200).join(",")})`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
    if (!res.ok) await err(res, "No se pudieron borrar los renglones");
  }
}

async function getLinea(id: string): Promise<Linea | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const res = await sbAdmin(`bgt_lineas?id=eq.${id}&select=${LINEA_COLS}`, { method: "GET" });
  if (!res.ok) await err(res, "No se pudo leer el renglón");
  const r = ((await res.json()) as Linea[])[0];
  return r ? { ...r, ars: Number(r.ars) } : null;
}

export async function crearLineas(lineas: LineaIn[], usuario: string): Promise<Linea[]> {
  for (const v of new Set(lineas.map((l) => l.version))) await versionAbierta(v);
  const creadas = await insertar(lineas, "manual", usuario);
  await auditar(creadas.map((l) => ({ usuario, entidad: "linea", accion: "alta", version: l.version, clave: l.id, antes: null, despues: soloCampos(l) })));
  return creadas;
}

/** Edita un renglón; devuelve el renglón nuevo. Solo registra los campos que cambiaron. */
export async function editarLinea(id: string, patch: Partial<LineaIn>, usuario: string, versionPermitida: (v: Version) => boolean): Promise<Linea> {
  const antes = await getLinea(id);
  if (!antes) throw new PresupuestoError("Ese renglón ya no existe.", 404);
  const v = await versionAbierta(antes.version);
  if (!versionPermitida(v)) throw new PresupuestoError("Tu usuario no puede modificar ese presupuesto.", 403);
  if (patch.version && patch.version !== antes.version) {
    const v2 = await versionAbierta(patch.version);
    if (!versionPermitida(v2)) throw new PresupuestoError("Tu usuario no puede mover renglones a ese presupuesto.", 403);
  }
  const cambios = camposCambiados(antes, soloCampos(patch));
  if (!Object.keys(cambios).length) return antes;
  const body = { ...Object.fromEntries(Object.entries(cambios).map(([k, c]) => [k, c!.despues])), updated_by: usuario, updated_at: new Date().toISOString() };
  const res = await sbAdmin(`bgt_lineas?id=eq.${id}&select=${LINEA_COLS}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(body) });
  if (!res.ok) await err(res, "No se pudo guardar el cambio");
  const nueva = ((await res.json()) as Linea[])[0]!;
  await auditar([{
    usuario, entidad: "linea", accion: "cambio", version: nueva.version, clave: id,
    antes: Object.fromEntries(Object.entries(cambios).map(([k, c]) => [k, c!.antes])),
    despues: Object.fromEntries(Object.entries(cambios).map(([k, c]) => [k, c!.despues])),
  }]);
  return { ...nueva, ars: Number(nueva.ars) };
}

export async function borrarLinea(id: string, usuario: string, versionPermitida: (v: Version) => boolean): Promise<void> {
  const antes = await getLinea(id);
  if (!antes) return;
  const v = await versionAbierta(antes.version);
  if (!versionPermitida(v)) throw new PresupuestoError("Tu usuario no puede modificar ese presupuesto.", 403);
  await borrarIds([id]);
  await auditar([{ usuario, entidad: "linea", accion: "baja", version: antes.version, clave: id, antes: soloCampos(antes), despues: null }]);
}

// ---------- importación de la planilla ----------
/**
 * Reemplaza los renglones de las versiones que trae la planilla (todas las demás quedan igual). Seguro ante
 * fallas: primero inserta lo nuevo y recién después borra lo anterior; si el insert falla, no se borra nada.
 */
export async function importarPlanilla(lineas: LineaIn[], catalogo: ItemCatalogo[], usuario: string): Promise<{ versiones: Record<string, { antes: number; despues: number; renglones: number }> }> {
  const versiones = [...new Set(lineas.map((l) => l.version))];
  await asegurarVersiones(versiones, usuario);
  const cerradas = (await listVersiones()).filter((v) => v.cerrada && versiones.includes(v.nombre));
  if (cerradas.length) throw new PresupuestoError(`No se puede importar sobre versiones cerradas: ${cerradas.map((v) => v.nombre).join(", ")}.`, 409);

  const previos = new Map<string, { ids: string[]; total: number }>();
  for (const v of versiones) {
    const ls = await getAll<{ id: string; ars: number }>(`bgt_lineas?select=id,ars&version=eq.${encodeURIComponent(v)}&order=id.asc`);
    previos.set(v, { ids: ls.map((l) => l.id), total: ls.reduce((s, l) => s + Number(l.ars), 0) });
  }
  await insertar(lineas, "import", usuario);
  await borrarIds([...previos.values()].flatMap((p) => p.ids));

  if (catalogo.length) {
    const res = await sbAdmin("bgt_catalogo?on_conflict=tipo,clave", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(catalogo) });
    if (!res.ok) await err(res, "No se pudo guardar el catálogo");
  }
  const resumen: Record<string, { antes: number; despues: number; renglones: number }> = {};
  for (const v of versiones) {
    const ls = lineas.filter((l) => l.version === v);
    resumen[v] = { antes: previos.get(v)?.total ?? 0, despues: ls.reduce((s, l) => s + l.ars, 0), renglones: ls.length };
  }
  await auditar(versiones.map((v) => ({ usuario, entidad: "importacion", accion: "importacion", version: v, clave: null, antes: { total_ars: resumen[v]!.antes, renglones: previos.get(v)?.ids.length ?? 0 }, despues: { total_ars: resumen[v]!.despues, renglones: resumen[v]!.renglones } })));
  return { versiones: resumen };
}

export async function agregarAlCatalogo(items: ItemCatalogo[]): Promise<void> {
  if (!items.length) return;
  const res = await sbAdmin("bgt_catalogo?on_conflict=tipo,clave", { method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=minimal" }, body: JSON.stringify(items) });
  if (!res.ok) await err(res, "No se pudo actualizar el catálogo");
}

// ---------- lectura para el tablero /funnel ----------
export interface DatosTablero { rows: FilaAgregada[]; versiones: string[]; faltaTc: { version: string; mes: number }[]; updatedAt: string | null }

/** Lo cargado en el tablero, con la forma del tablero. null si la migración no corrió o no hay nada cargado. */
export async function getDatosTablero(): Promise<DatosTablero | null> {
  try {
    const [versiones, tcs] = await Promise.all([listVersiones(), listTc()]);
    if (!versiones.length) return null;
    const lineas = await getAll<{ version: string; mes: number; nombre_cta: string; concepto: string; ars: number; updated_at: string }>(
      "bgt_lineas?select=version,mes,nombre_cta,concepto,ars,updated_at&order=id.asc",
    );
    if (!lineas.length) return null;
    const norm = lineas.map((l) => ({ ...l, ars: Number(l.ars) }));
    const { rows, faltaTc } = agregarParaTablero(norm, versiones, tcs.map((t) => ({ ...t, tc: Number(t.tc) })));
    const updatedAt = norm.reduce<string | null>((m, l) => (!m || l.updated_at > m ? l.updated_at : m), null);
    return { rows, versiones: [...new Set(norm.map((l) => l.version))], faltaTc, updatedAt };
  } catch {
    return null;
  }
}
