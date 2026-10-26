import { NextResponse } from "next/server";
import { getCbSupabase } from "@/lib/supabase-cb";
import { trAll, trUpsert, trRest } from "@/lib/trade-db";
import { refrescarDerivados } from "@/lib/trade-derivados";
import { esMarcaBasura, normClave, normCategoria, splitTienda } from "@/lib/trade-carga-core";

// Migración ÚNICA del proyecto Supabase CB → tablas tr_* del principal (0138). Idempotente (upserts por clave
// natural; los maestros con ignore-duplicates para no pisar ediciones). Por partes, para que cada llamada entre en
// maxDuration (workflow trade-migrar.yml las llama en orden):
//   ?parte=maestros   cadenas (+cliente de cb_cadena_alias), tiendas, promotores/supervisores, SKUs
//   ?parte=cb         cuadro_basico_semanal → tr_cb_semanal (año = ?anio, default 2026: el CB no guarda año)
//   ?parte=u3         reporte_existencia → tr_existencias
//   ?parte=fs_periodos lista de períodos de floor_share   ·   ?parte=fs&periodo=2026-W14  uno por vez
//   ?parte=derivados  precálculos (cb_default, fs_precomputed, trade_monthly) desde tr_*
//   ?parte=verificar&que=cb|fs|u3   conteos y sumas por (año, semana, categoría) origen vs destino
// ?dry=1 = calcula sin escribir. Filas basura de FS (columnas del CB cargadas como marcas, caso 42-Coccion) se excluyen.
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Row = Record<string, unknown>;

async function leerCb(table: string, select: string, filtro?: (q: any) => any): Promise<Row[]> {
  const sb = getCbSupabase();
  const base = () => { let q = sb.from(table).select(select, { count: "exact" }); if (filtro) q = filtro(q); return q; };
  const first = await base().range(0, 999);
  if (first.error) throw new Error(`${table}: ${first.error.message}`);
  const all: Row[] = [...((first.data ?? []) as unknown as Row[])];
  const total = first.count ?? all.length;
  const offs: number[] = [];
  for (let o = 1000; o < total; o += 1000) offs.push(o);
  for (let i = 0; i < offs.length; i += 8) {
    const res = await Promise.all(offs.slice(i, i + 8).map((o) => base().range(o, o + 999)));
    for (const r of res) { if (r.error) throw new Error(`${table}: ${r.error.message}`); all.push(...((r.data ?? []) as unknown as Row[])); }
  }
  if (all.length !== total) throw new Error(`${table}: leí ${all.length} de ${total} filas (¿cambió durante la lectura?)`);
  return all;
}

const s = (v: unknown) => (v == null ? null : String(v).trim() || null);

/** Grupos FS con mayoría de "marcas" que son columnas del CB = archivo mal subido → se excluye el grupo entero. */
function filtrarBasuraFs(rows: Row[]): { ok: Row[]; basura: number } {
  const g = new Map<string, { n: number; b: number }>();
  for (const r of rows) { const k = `${r.periodo}|${r.categoria}`; const e = g.get(k) ?? { n: 0, b: 0 }; e.n++; if (esMarcaBasura(String(r.marca ?? ""))) e.b++; g.set(k, e); }
  const ok = rows.filter((r) => { const e = g.get(`${r.periodo}|${r.categoria}`)!; return !esMarcaBasura(String(r.marca ?? "")) && e.b / e.n < 0.5; });
  return { ok, basura: rows.length - ok.length };
}

const fsDestino = (r: Row) => {
  const periodo = String(r.periodo);
  const mW = periodo.match(/^(\d{4})-W(\d{1,2})$/), mM = periodo.match(/^(\d{4})-(\d{2})$/);
  return {
    anio: Number((mW ?? mM)?.[1] ?? 2026), semana: r.semana ?? (mW ? Number(mW[2]) : null), mes: mM ? Number(mM[2]) : null,
    periodo, categoria: normCategoria(String(r.categoria)) ?? String(r.categoria), numero_tienda: String(r.numero_tienda ?? ""),
    nombre_tienda: String(r.nombre_tienda ?? ""), marca: String(r.marca), unidades: Number(r.unidades ?? 0), pct_raw: r.pct_raw == null ? null : Number(r.pct_raw),
  };
};

async function maestros(dry: boolean) {
  const [contactos, alias, cb, u3] = await Promise.all([
    leerCb("contactos", "numero_tienda,nombre_tienda,cadena,promotor,supervisor,updated_at"),
    leerCb("cb_cadena_alias", "cadena_reporte,cliente_homologos"),
    leerCb("cuadro_basico_semanal", "tienda,cliente,sku,division"),
    leerCb("reporte_existencia", "numero_tienda,tienda,cadena,canal,sku,descripcion,division,categoria,marca"),
  ]);
  const cadenas = new Map<string, { clave: string; nombre: string; cliente: string | null }>();
  const addCad = (n: unknown) => { const raw = s(n); if (!raw) return ""; const k = normClave(raw); if (!cadenas.has(k)) cadenas.set(k, { clave: k, nombre: raw, cliente: null }); return k; };
  const tiendas = new Map<string, Row>();
  const addT = (cad: string, numero: string | null, nombre: string | null, canal: string | null = null) => {
    if (!numero) return;
    const k = `${cad}|${numero}`; const t = tiendas.get(k);
    if (!t) tiendas.set(k, { cadena: cad, numero, nombre, canal });
    else { t.nombre ??= nombre; t.canal ??= canal; }
  };
  for (const c of contactos) addT(addCad(c.cadena), s(c.numero_tienda), s(c.nombre_tienda));
  for (const r of cb) { const st = splitTienda(String(r.tienda ?? "")); addT(addCad(r.cliente), st?.numero || null, st?.nombre ?? null); }
  for (const r of u3) addT(addCad(r.cadena), s(r.numero_tienda), s(r.tienda), s(r.canal));
  for (const a of alias) { const k = addCad(a.cadena_reporte); if (k) cadenas.get(k)!.cliente = s(a.cliente_homologos); }

  const personas = new Map<string, string>();
  for (const c of contactos) {
    const p = s(c.promotor), sv = s(c.supervisor);
    if (p) personas.set(p, personas.get(p) === "supervisor" ? "ambos" : "promotor");
    if (sv) personas.set(sv, personas.get(sv) && personas.get(sv) !== "supervisor" ? "ambos" : "supervisor");
  }
  const skus = new Map<string, Row>();
  for (const r of cb) { const k = s(r.sku); if (k && !skus.has(k)) skus.set(k, { sku: k, division: s(r.division) }); }
  for (const r of u3) {
    const k = s(r.sku); if (!k) continue;
    const e = skus.get(k) ?? { sku: k }; skus.set(k, e);
    e.descripcion ??= s(r.descripcion); e.division ??= s(r.division); e.categoria ??= s(r.categoria); e.marca ??= s(r.marca);
  }
  const res = { cadenas: cadenas.size, tiendas: tiendas.size, personas: personas.size, skus: skus.size, asignaciones: 0 };
  if (dry) return res;
  await trUpsert("tr_cadenas", [...cadenas.values()], "clave", true);
  // cliente de cb_cadena_alias: solo si la cadena todavía no tiene uno (no pisa ediciones)
  for (const c of cadenas.values()) if (c.cliente) await trRest(`tr_cadenas?clave=eq.${encodeURIComponent(c.clave)}&cliente=is.null`, { method: "PATCH", body: JSON.stringify({ cliente: c.cliente }), prefer: "return=minimal" });
  await trUpsert("tr_tiendas", [...tiendas.values()], "cadena,numero", true);
  await trUpsert("tr_personas", [...personas].map(([nombre, rol]) => ({ nombre, rol })), "nombre", true);
  await trUpsert("tr_skus", [...skus.values()].map((x) => ({ descripcion: null, division: null, categoria: null, marca: null, ...x })), "sku", true);

  const ids = new Map((await trAll<{ id: number; cadena: string; numero: string }>("tr_tiendas?select=id,cadena,numero")).map((t) => [`${t.cadena}|${t.numero}`, t.id]));
  const conAsig = new Set((await trAll<{ tienda_id: number }>("tr_tienda_asignacion?select=tienda_id")).map((a) => a.tienda_id));
  const asig = contactos.flatMap((c) => {
    const id = ids.get(`${normClave(String(c.cadena ?? ""))}|${s(c.numero_tienda)}`);
    if (!id || conAsig.has(id) || (!s(c.promotor) && !s(c.supervisor))) return [];
    conAsig.add(id);
    return [{ tienda_id: id, promotor: s(c.promotor), supervisor: s(c.supervisor), desde: String(c.updated_at ?? "").slice(0, 10) || new Date().toISOString().slice(0, 10), origen: "migración contactos" }];
  });
  for (let i = 0; i < asig.length; i += 500) await trRest("tr_tienda_asignacion", { method: "POST", body: JSON.stringify(asig.slice(i, i + 500)), prefer: "return=minimal" });
  res.asignaciones = asig.length;
  return res;
}

async function migrarCb(anio: number, dry: boolean) {
  const rows = await leerCb("cuadro_basico_semanal", "semana,tienda,sku,cliente,division,target_cb,real_cb,target_inf,real_inf,tipo_sku");
  const dest = rows.map((r) => ({
    anio, semana: r.semana, tienda: r.tienda, numero_tienda: splitTienda(String(r.tienda))?.numero || null, sku: r.sku,
    cliente: r.cliente ?? null, division: r.division ?? null, target_cb: r.target_cb ?? 0, real_cb: r.real_cb ?? 0,
    target_inf: r.target_inf ?? 0, real_inf: r.real_inf ?? 0, tipo_sku: r.tipo_sku ?? null,
  }));
  if (!dry) await trUpsert("tr_cb_semanal", dest, "anio,semana,tienda,sku");
  return { filas: dest.length };
}

async function migrarU3(dry: boolean) {
  const rows = await leerCb("reporte_existencia", "id,fecha_captura,numero_tienda,tienda,cadena,canal,division,categoria,subcategoria,marca,sku,descripcion,existencia,estado");
  if (!dry) await trUpsert("tr_existencias", rows.map((r) => ({ ...r, existencia: r.existencia ?? 0 })), "id");
  return { filas: rows.length };
}

const PERIODOS = [
  ...Array.from({ length: 12 }, (_, i) => `2026-${String(i + 1).padStart(2, "0")}`),
  ...Array.from({ length: 53 }, (_, i) => `2026-W${String(i + 1).padStart(2, "0")}`),
];
async function fsPeriodos(): Promise<string[]> {
  const sb = getCbSupabase();
  const out: string[] = [];
  for (let i = 0; i < PERIODOS.length; i += 8) {
    const res = await Promise.all(PERIODOS.slice(i, i + 8).map(async (p) => {
      const { count, error } = await sb.from("floor_share").select("periodo", { count: "exact", head: true }).eq("periodo", p);
      if (error) throw new Error(`floor_share: ${error.message}`);
      return (count ?? 0) > 0 ? p : null;
    }));
    out.push(...res.filter((x): x is string => !!x));
  }
  return out;
}

async function migrarFs(periodo: string, dry: boolean) {
  const rows = await leerCb("floor_share", "periodo,semana,categoria,numero_tienda,nombre_tienda,marca,unidades,pct_raw", (q) => q.eq("periodo", periodo));
  const { ok, basura } = filtrarBasuraFs(rows);
  const dest = ok.map(fsDestino);
  if (!dry) await trUpsert("tr_floor_share", dest, "periodo,categoria,numero_tienda,nombre_tienda,marca");
  return { periodo, filas: dest.length, basura_excluida: basura };
}

type Agg = Map<string, number[]>;
const agregar = (rows: Row[], key: (r: Row) => string, vals: (r: Row) => number[]): Agg => {
  const m: Agg = new Map();
  for (const r of rows) { const k = key(r), v = vals(r), a = m.get(k) ?? [0, ...v.map(() => 0)]; a[0]!++; v.forEach((x, i) => (a[i + 1]! += x)); m.set(k, a); }
  return m;
};
function comparar(o: Agg, d: Agg) {
  const claves = [...new Set([...o.keys(), ...d.keys()])].sort();
  const dif = claves.filter((k) => JSON.stringify(o.get(k) ?? null) !== JSON.stringify(d.get(k) ?? null))
    .map((k) => ({ grupo: k, origen: o.get(k) ?? null, destino: d.get(k) ?? null }));
  return { grupos: claves.length, iguales: claves.length - dif.length, diferencias: dif };
}

async function verificar(que: string, anio: number) {
  const n = (v: unknown) => Number(v ?? 0);
  if (que === "cb") {
    const sel = "semana,division,target_cb,real_cb,target_inf,real_inf";
    const key = (r: Row) => `${anio}|${r.semana}|${r.division ?? ""}`;
    const vals = (r: Row) => [n(r.target_cb), n(r.real_cb), n(r.target_inf), n(r.real_inf)];
    const [o, d] = await Promise.all([leerCb("cuadro_basico_semanal", sel), trAll<Row>(`tr_cb_semanal?select=${sel}&anio=eq.${anio}`)]);
    return { columnas: "año|semana|división → [filas, Σtarget_cb, Σreal_cb, Σtarget_inf, Σreal_inf]", ...comparar(agregar(o, key, vals), agregar(d, key, vals)) };
  }
  if (que === "fs") {
    const periodos = await fsPeriodos();
    const o: Row[] = [];
    for (const p of periodos) o.push(...filtrarBasuraFs(await leerCb("floor_share", "periodo,categoria,marca,unidades", (q) => q.eq("periodo", p))).ok);
    const d = await trAll<Row>("tr_floor_share?select=periodo,categoria,unidades");
    const key = (r: Row) => `${r.periodo}|${normCategoria(String(r.categoria)) ?? r.categoria}`;
    return { columnas: "período|categoría → [filas, Σunidades] (origen sin filas basura)", ...comparar(agregar(o, key, (r) => [n(r.unidades)]), agregar(d, key, (r) => [n(r.unidades)])) };
  }
  const [o, d] = await Promise.all([leerCb("reporte_existencia", "fecha_captura,existencia"), trAll<Row>("tr_existencias?select=fecha_captura,existencia")]);
  const key = (r: Row) => String(r.fecha_captura ?? "");
  return { columnas: "fecha de captura → [filas, Σexistencia]", ...comparar(agregar(o, key, (r) => [n(r.existencia)]), agregar(d, key, (r) => [n(r.existencia)])) };
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const sp = new URL(request.url).searchParams;
  const parte = sp.get("parte") ?? "";
  const dry = sp.get("dry") === "1";
  const anio = Number(sp.get("anio") ?? 2026);
  const t0 = Date.now();
  try {
    let r: unknown;
    if (parte === "maestros") r = await maestros(dry);
    else if (parte === "cb") r = await migrarCb(anio, dry);
    else if (parte === "u3") r = await migrarU3(dry);
    else if (parte === "fs_periodos") r = { periodos: await fsPeriodos() };
    else if (parte === "fs") {
      const p = sp.get("periodo") ?? "";
      if (!/^\d{4}-(W\d{2}|\d{2})$/.test(p)) return NextResponse.json({ ok: false, error: "periodo inválido (2026-W14 o 2026-01)" }, { status: 400 });
      r = await migrarFs(p, dry);
    } else if (parte === "derivados") r = dry ? { dry: true } : await refrescarDerivados();
    else if (parte === "verificar") {
      const v = await verificar(sp.get("que") ?? "cb", anio);
      return NextResponse.json({ ok: v.diferencias.length === 0, parte, ...v, ms: Date.now() - t0 });
    } else return NextResponse.json({ ok: false, error: "parte = maestros | cb | u3 | fs_periodos | fs | derivados | verificar" }, { status: 400 });
    return NextResponse.json({ ok: true, parte, dry, resultado: r, ms: Date.now() - t0 });
  } catch (e) {
    console.error("[trade-migrar]", parte, e);
    return NextResponse.json({ ok: false, parte, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
