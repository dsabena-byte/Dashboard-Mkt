import "server-only";
import { sbAdmin } from "@/lib/supabase-admin";
import { calcularProvision, categoriaDeSku, CUENTA_AACC, liquidadoDeInversion, resumenMeses, type Acuerdo, type LineaInversion, type Liquidacion, type FactCliente, type FilaProvision, type MesResumen } from "@/lib/aacc-core";

// AACC de Mkt Canal: lecturas/escrituras por REST con service key (las rutas validan sesión y permisos antes).
// Tablas: aacc_acuerdos · aacc_provision_mensual (0146) · liquidado = bgt_lineas (Inversión, cuenta de AACC con recepción) + mkt_canal_aacc (provisión real, 0131) + vt_facturacion (0147) / tr_skus.

export class AaccError extends Error { constructor(msg: string, public status = 500) { super(msg); } }

async function get<T>(path: string): Promise<T[]> {
  const out: T[] = [];
  for (let off = 0; off < 200_000; off += 1000) {
    const r = await sbAdmin(`${path}${path.includes("?") ? "&" : "?"}limit=1000&offset=${off}`, { method: "GET" });
    if (!r.ok) {
      const t = await r.text();
      if (/PGRST205|42P01|does not exist|42703/.test(t)) throw new AaccError("Falta correr la migración 0146_aacc_provision.sql en Supabase.", 503);
      throw new AaccError(`Supabase ${r.status}: ${t.slice(0, 200)}`);
    }
    const rows = (await r.json()) as T[];
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return out;
}

async function write(path: string, method: string, body?: unknown, prefer = "return=minimal") {
  const r = await sbAdmin(path, { method, headers: { Prefer: prefer }, body: body === undefined ? undefined : JSON.stringify(body) });
  if (!r.ok) throw new AaccError(`Supabase ${r.status}: ${(await r.text()).slice(0, 200)}`);
}

const mesKey = (anio: number, mes: number) => `${anio}-${String(mes + 1).padStart(2, "0")}`;

export async function listAcuerdos(anio: number): Promise<Acuerdo[]> {
  const rows = await get<Acuerdo>(`aacc_acuerdos?select=anio,cliente,razon_social,cliente_sap,proveedor,tipo,pct,categorias,montos,orden&anio=eq.${anio}&order=orden.asc,cliente.asc`);
  return rows.map((r) => ({ ...r, proveedor: r.proveedor ?? null, pct: r.pct == null ? null : Number(r.pct), montos: Array.from({ length: 12 }, (_, i) => Number(r.montos?.[i] ?? 0)) }));
}

export async function guardarAcuerdos(anio: number, acuerdos: Acuerdo[], email: string) {
  const actuales = await listAcuerdos(anio);
  const nuevos = new Set(acuerdos.map((a) => a.cliente));
  for (const a of actuales) if (!nuevos.has(a.cliente)) await write(`aacc_acuerdos?anio=eq.${anio}&cliente=eq.${encodeURIComponent(a.cliente)}`, "DELETE");
  if (acuerdos.length)
    await write("aacc_acuerdos?on_conflict=anio,cliente", "POST", acuerdos.map((a, i) => ({ ...a, anio, orden: i, updated_at: new Date().toISOString(), updated_by: email })), "resolution=merge-duplicates,return=minimal");
}

/** Facturación FC de un mes calendario por cliente y categoría (null = la base todavía no tiene el importe en $). */
export async function facturacionMes(anio: number, mes: number, clientes: string[]): Promise<Record<string, FactCliente> | null> {
  if (!clientes.length) return {};
  const desde = `${mesKey(anio, mes)}-01`;
  const hasta = mes === 11 ? `${anio + 1}-01-01` : `${mesKey(anio, mes + 1)}-01`;
  const lista = clientes.map((c) => `"${c.replace(/"/g, "")}"`).join(",");
  let ventas: { cliente: string; sku: string; categoria: string | null; importe: number }[];
  try {
    // vt_facturacion = todos los renglones FC con $ (los manda el Office Script); fecha = fecha real de la factura.
    ventas = await get(`vt_facturacion?select=cliente,sku,categoria,importe&fecha=gte.${desde}&fecha=lt.${hasta}&cliente=in.(${encodeURIComponent(lista)})&order=id.asc`);
    if (!ventas.length) {
      const r = await sbAdmin("vt_facturacion?select=id&limit=1", { method: "GET" });
      if (!r.ok || !((await r.json()) as unknown[]).length) return null; // todavía nunca llegó la facturación en $
    }
  } catch (e) {
    if (e instanceof AaccError && e.status === 503) return null;
    throw e;
  }
  const skus = await get<{ sku: string; division: string | null; categoria: string | null }>("tr_skus?select=sku,division,categoria&order=sku.asc");
  const cat = new Map(skus.map((s) => [s.sku.replace(/^0+/, ""), categoriaDeSku(s.division, s.categoria)]));
  const out: Record<string, FactCliente> = {};
  for (const v of ventas) {
    // Categoría: el «Grupo de artículos» del Excel; si no vino, el maestro de SKUs.
    const c = (v.categoria ? categoriaDeSku(v.categoria, v.categoria) : cat.get(v.sku.replace(/^0+/, ""))) ?? "sin_categoria";
    const f = (out[v.cliente] ??= {});
    f[c] = (f[c] ?? 0) + Number(v.importe ?? 0);
  }
  return out;
}

export async function calcularMes(anio: number, mes: number): Promise<{ filas: FilaProvision[]; sinImporte: boolean }> {
  const acuerdos = await listAcuerdos(anio);
  const sap = [...new Set(acuerdos.filter((a) => a.tipo === "pct" && a.cliente_sap).map((a) => a.cliente_sap!))];
  const fact = await facturacionMes(anio, mes, sap);
  return { filas: calcularProvision(acuerdos, mes, fact), sinImporte: fact == null };
}

export interface AaccDatos {
  anio: number;
  acuerdos: Acuerdo[];
  resumen: MesResumen[];
  mensual: { mes: string; cliente: string; razon_social: string; categorias: string | null; acuerdo: string | null; facturacion: number | null; aacc: number; generado_at: string; generado_por: string | null }[];
  real: { mes: string; cliente: string; razon_social: string; categoria: string | null; aacc: number }[];
  liquidado: Liquidacion[];
  destinatarios: { para: string[]; cc: string[] };
}

export async function getAaccDatos(anio: number): Promise<AaccDatos> {
  const [acuerdos, mensual, real, liquidado, dest] = await Promise.all([
    listAcuerdos(anio),
    get<AaccDatos["mensual"][number]>(`aacc_provision_mensual?select=mes,cliente,razon_social,categorias,acuerdo,facturacion,aacc,generado_at,generado_por&mes=like.${anio}-*&order=mes.asc,cliente.asc`),
    get<AaccDatos["real"][number]>(`mkt_canal_aacc?select=mes,cliente,razon_social,categoria,aacc&mes=like.${anio}-*&order=mes.asc,cliente.asc`),
    get<LineaInversion>(`bgt_lineas?select=mes,proveedor,nro_proveedor,nro_recepcion,factura,ars&version=eq.${encodeURIComponent(`REAL ${anio}`)}&cuenta=eq.${CUENTA_AACC}&order=id.asc`),
    getDestinatarios(),
  ]);
  const num = <T extends { aacc?: number; monto?: number }>(xs: T[]) => xs.map((x) => ({ ...x, ...(x.aacc != null && { aacc: Number(x.aacc) }), ...(x.monto != null && { monto: Number(x.monto) }) }));
  const m = num(mensual), r = num(real), l = liquidadoDeInversion(anio, liquidado, acuerdos);
  const idx = (mes: string) => Number(mes.slice(5, 7)) - 1;
  const sum = (xs: { mes: string }[], val: (x: never) => number) => { const a = Array(12).fill(0) as number[]; for (const x of xs) a[idx(x.mes)] = (a[idx(x.mes)] ?? 0) + val(x as never); return a; };
  const tieneReal = Array.from({ length: 12 }, (_, i) => r.some((x) => idx(x.mes) === i));
  const tieneMensual = Array.from({ length: 12 }, (_, i) => m.some((x) => idx(x.mes) === i));
  const sumMensual = sum(m, (x: { aacc: number }) => x.aacc);
  const resumen = resumenMeses({
    real: sum(r, (x: { aacc: number }) => x.aacc),
    mensual: sumMensual.map((v, i) => (tieneMensual[i] ? v : null)),
    liquidado: sum(l, (x: Liquidacion) => x.monto),
    tieneReal,
  });
  return { anio, acuerdos, resumen, mensual: m as AaccDatos["mensual"], real: r as AaccDatos["real"], liquidado: l, destinatarios: dest };
}

/** Foto de la provisión mensual: reemplaza la del mes (la del botón «Generar provisión»). */
export async function guardarMensual(anio: number, mes: number, filas: FilaProvision[], email: string) {
  const k = mesKey(anio, mes);
  await write(`aacc_provision_mensual?mes=eq.${k}`, "DELETE");
  if (filas.length)
    await write("aacc_provision_mensual", "POST", filas.map((f) => ({ mes: k, cliente: f.cliente, razon_social: f.razon_social, categorias: f.categorias, acuerdo: f.acuerdo, facturacion: f.facturacion, aacc: f.aacc, generado_por: email })));
}

/** Provisión real de un mes cerrado: reemplaza las filas de ese mes en mkt_canal_aacc (la usa también la sección Inversión = AACC). */
export async function guardarReal(anio: number, mes: number, filas: FilaProvision[]) {
  const k = mesKey(anio, mes);
  await write(`mkt_canal_aacc?mes=eq.${k}`, "DELETE");
  const conMonto = filas.filter((f) => f.aacc > 0);
  if (conMonto.length)
    await write("mkt_canal_aacc", "POST", conMonto.map((f) => ({ cliente: f.cliente, razon_social: f.razon_social, categoria: f.categorias, mes: k, aacc: f.aacc })));
}


// Destinatarios del mail: en tr_config (clave/valor genérico) para no versionar emails en el repo público.
export async function getDestinatarios(): Promise<{ para: string[]; cc: string[] }> {
  const r = await sbAdmin("tr_config?select=valor&clave=eq.aacc_destinatarios", { method: "GET" });
  const rows = r.ok ? ((await r.json()) as { valor: { para?: string[]; cc?: string[] } }[]) : [];
  return { para: rows[0]?.valor?.para ?? [], cc: rows[0]?.valor?.cc ?? [] };
}
export async function guardarDestinatarios(d: { para: string[]; cc: string[] }) {
  await write("tr_config?on_conflict=clave", "POST", { clave: "aacc_destinatarios", valor: d }, "resolution=merge-duplicates,return=minimal");
}
