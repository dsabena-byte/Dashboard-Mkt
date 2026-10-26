import { NextResponse } from "next/server";
import { exigirEdicion, getMiPerfil, puedeVerTablero } from "@/lib/usuarios-server";
import { auditar, esFaltaTabla, trAll, trJson, trRest, trUpsert } from "@/lib/trade-db";
import { normClave } from "@/lib/trade-carga-core";
import { refrescarDerivados } from "@/lib/trade-derivados";

// Edición puntual de los maestros de Trade (pestañas de /cuadros-basicos). Todo cambio queda en tr_auditoria.
//   GET ?entidad=tiendas|cadenas|skus|objetivos
//   PATCH {entidad:"tienda", id, cambios} · {entidad:"tienda_alta", ...} · {entidad:"asignacion", tienda_id, promotor, supervisor, desde}
//         {entidad:"cadena", clave, cambios} · {entidad:"cadena_unir", de, a} · {entidad:"sku", sku, cambios} · {entidad:"objetivos", valor}
export const dynamic = "force-dynamic";

const err = (e: unknown) => esFaltaTabla(e)
  ? NextResponse.json({ error: "Falta correr la migración 0138_trade.sql." }, { status: 503 })
  : NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
const bad = (m: string) => NextResponse.json({ error: m }, { status: 400 });
const now = () => new Date().toISOString();

/** Solo campos permitidos, texto ≤ max (vacío = null). */
function limpiar(c: unknown, campos: string[], max = 200): Record<string, string | boolean | null> | null {
  if (!c || typeof c !== "object") return null;
  const out: Record<string, string | boolean | null> = {};
  for (const [k, v] of Object.entries(c as Record<string, unknown>)) {
    if (!campos.includes(k)) continue;
    if (k === "activa") { if (typeof v !== "boolean") return null; out[k] = v; continue; }
    if (v != null && (typeof v !== "string" || v.length > max)) return null;
    out[k] = typeof v === "string" ? v.trim() || null : null;
  }
  return Object.keys(out).length ? out : null;
}

export async function GET(req: Request) {
  if (!(await puedeVerTablero("cuadros-basicos"))) return NextResponse.json({ error: "Sin acceso" }, { status: 403 });
  const entidad = new URL(req.url).searchParams.get("entidad");
  try {
    if (entidad === "tiendas") {
      const [tiendas, asig, cadenas, u3] = await Promise.all([
        trAll<Record<string, unknown>>("tr_tiendas?select=id,cadena,numero,nombre,segmentacion,provincia,localidad,canal,activa"),
        trAll<{ tienda_id: number; promotor: string | null; supervisor: string | null; desde: string }>("tr_tienda_asignacion?select=tienda_id,promotor,supervisor,desde&hasta=is.null"),
        trAll<{ clave: string; nombre: string; alias: string[] }>("tr_cadenas?select=clave,nombre,alias"),
        trAll<{ cadena: string | null; numero_tienda: string | null; promotor: string | null; supervisor: string | null; fecha_captura: string | null }>(
          "tr_existencias?select=cadena,numero_tienda,promotor,supervisor,fecha_captura&promotor=not.is.null"),
      ]);
      const canon = new Map<string, string>();
      for (const c of cadenas) { canon.set(c.clave, c.clave); for (const a of c.alias ?? []) canon.set(a, c.clave); }
      // Último U3: quién cubre cada tienda (cadena + número) → sugerencia si difiere de la asignación vigente.
      const ultimo = new Map<string, { promotor: string | null; supervisor: string | null; fecha: string }>();
      for (const r of u3) {
        if (!r.numero_tienda) continue;
        const k = `${canon.get(normClave(r.cadena)) ?? normClave(r.cadena)}|${r.numero_tienda}`;
        const f = r.fecha_captura ?? "";
        if ((ultimo.get(k)?.fecha ?? "") <= f) ultimo.set(k, { promotor: r.promotor, supervisor: r.supervisor, fecha: f });
      }
      const va = new Map(asig.map((a) => [a.tienda_id, a]));
      return NextResponse.json({
        cadenas: cadenas.map((c) => ({ clave: c.clave, nombre: c.nombre })),
        personas: (await trAll<{ nombre: string; rol: string }>("tr_personas?select=nombre,rol&activa=is.true", "nombre")),
        tiendas: tiendas.map((t) => {
          const a = va.get(t.id as number);
          const u = ultimo.get(`${t.cadena}|${t.numero}`);
          const sug = u && (u.promotor !== (a?.promotor ?? null) || (u.supervisor && u.supervisor !== (a?.supervisor ?? null))) ? u : null;
          return { ...t, promotor: a?.promotor ?? null, supervisor: a?.supervisor ?? null, desde: a?.desde ?? null, sugerencia: sug };
        }),
      });
    }
    if (entidad === "cadenas") {
      const [cadenas, tiendas] = await Promise.all([
        trAll<Record<string, unknown>>("tr_cadenas?select=id,clave,nombre,cliente,alias,activa"),
        trAll<{ cadena: string }>("tr_tiendas?select=cadena"),
      ]);
      const n = new Map<string, number>();
      for (const t of tiendas) n.set(t.cadena, (n.get(t.cadena) ?? 0) + 1);
      return NextResponse.json({ cadenas: cadenas.map((c) => ({ ...c, tiendas: n.get(c.clave as string) ?? 0 })) });
    }
    if (entidad === "skus") return NextResponse.json({ skus: await trAll("tr_skus?select=sku,descripcion,nombre_comercial,division,categoria,marca,ean", "sku") });
    if (entidad === "objetivos") {
      const [r] = await trJson<Array<{ valor: unknown; updated_at: string; updated_by: string | null }>>("tr_config?clave=eq.fs_objetivos&select=valor,updated_at,updated_by");
      return NextResponse.json({ objetivos: r ?? null });
    }
    return bad("entidad = tiendas | cadenas | skus | objetivos");
  } catch (e) { return err(e); }
}

export async function PATCH(req: Request) {
  const no = await exigirEdicion("trade");
  if (no) return no;
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b) return bad("Pedido inválido");
  const usuario = (await getMiPerfil().catch(() => null))?.user?.email?.toLowerCase() ?? null;
  try {
    switch (b.entidad) {
      case "tienda": {
        const id = Number(b.id);
        const c = limpiar(b.cambios, ["nombre", "segmentacion", "provincia", "localidad", "canal", "cadena", "activa"]);
        if (!Number.isInteger(id) || !c) return bad("Cambios inválidos");
        if (typeof c.cadena === "string") c.cadena = normClave(c.cadena);
        const [antes] = await trJson<Record<string, unknown>[]>(`tr_tiendas?id=eq.${id}`);
        if (!antes) return bad("La tienda no existe");
        await trRest(`tr_tiendas?id=eq.${id}`, { method: "PATCH", prefer: "return=minimal", body: JSON.stringify({ ...c, updated_at: now() }) });
        await auditar(usuario, "tienda", String(id), antes, c);
        return NextResponse.json({ ok: true });
      }
      case "tienda_alta": {
        const c = limpiar(b, ["cadena", "numero", "nombre", "segmentacion", "provincia", "localidad", "canal"]);
        if (!c?.numero || !c.nombre || !/^\d{1,8}$/.test(String(c.numero))) return bad("Completá número (solo dígitos) y nombre");
        const fila = { ...c, cadena: normClave(String(c.cadena ?? "")) };
        await trRest("tr_tiendas", { method: "POST", prefer: "return=minimal", body: JSON.stringify([fila]) });
        await auditar(usuario, "tienda_alta", `${fila.cadena}|${c.numero}`, null, fila);
        return NextResponse.json({ ok: true });
      }
      case "asignacion": {
        const id = Number(b.tienda_id);
        const p = typeof b.promotor === "string" ? b.promotor.trim().slice(0, 120) || null : null;
        const s = typeof b.supervisor === "string" ? b.supervisor.trim().slice(0, 120) || null : null;
        const desde = typeof b.desde === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.desde) ? b.desde : now().slice(0, 10);
        if (!Number.isInteger(id) || (!p && !s)) return bad("Elegí promotor o supervisor");
        const personas = [p && { nombre: p, rol: "promotor" }, s && { nombre: s, rol: "supervisor" }].filter(Boolean);
        await trUpsert("tr_personas", personas, "nombre", true);
        const vig = await trJson<Record<string, unknown>[]>(`tr_tienda_asignacion?tienda_id=eq.${id}&hasta=is.null`);
        await trRest(`tr_tienda_asignacion?tienda_id=eq.${id}&hasta=is.null`, { method: "PATCH", prefer: "return=minimal", body: JSON.stringify({ hasta: desde }) });
        const nueva = { tienda_id: id, promotor: p, supervisor: s, desde, origen: "edición" };
        await trRest("tr_tienda_asignacion", { method: "POST", prefer: "return=minimal", body: JSON.stringify([nueva]) });
        await auditar(usuario, "asignacion", String(id), vig, nueva);
        return NextResponse.json({ ok: true });
      }
      case "cadena": {
        const clave = String(b.clave ?? "");
        const c = limpiar(b.cambios, ["nombre", "cliente", "activa"]);
        if (!clave || !c) return bad("Cambios inválidos");
        const [antes] = await trJson<Record<string, unknown>[]>(`tr_cadenas?clave=eq.${encodeURIComponent(clave)}`);
        if (!antes) return bad("La cadena no existe");
        await trRest(`tr_cadenas?clave=eq.${encodeURIComponent(clave)}`, { method: "PATCH", prefer: "return=minimal", body: JSON.stringify({ ...c, updated_at: now() }) });
        await auditar(usuario, "cadena", clave, antes, c);
        return NextResponse.json({ ok: true });
      }
      case "cadena_unir": {
        // "CHANGO MAS" = "Chango Mas": las tiendas de `de` pasan a `a` (las que chocan por número quedan y se avisan),
        // `de` queda como alias de `a` (las próximas cargas la reconocen) y se desactiva.
        const de = String(b.de ?? ""), a = String(b.a ?? "");
        if (!de || !a || de === a) return bad("Elegí dos cadenas distintas");
        const [cd, ca] = await Promise.all([
          trJson<Array<{ alias: string[] }>>(`tr_cadenas?clave=eq.${encodeURIComponent(de)}&select=alias`),
          trJson<Array<{ alias: string[] }>>(`tr_cadenas?clave=eq.${encodeURIComponent(a)}&select=alias`),
        ]);
        if (!cd[0] || !ca[0]) return bad("Alguna de las cadenas no existe");
        const [td, ta] = await Promise.all([
          trAll<{ id: number; numero: string }>(`tr_tiendas?select=id,numero&cadena=eq.${encodeURIComponent(de)}`),
          trAll<{ numero: string }>(`tr_tiendas?select=numero&cadena=eq.${encodeURIComponent(a)}`),
        ]);
        const ocupados = new Set(ta.map((t) => t.numero));
        const mover = td.filter((t) => !ocupados.has(t.numero)).map((t) => t.id);
        if (mover.length) await trRest(`tr_tiendas?id=in.(${mover.join(",")})`, { method: "PATCH", prefer: "return=minimal", body: JSON.stringify({ cadena: a, updated_at: now() }) });
        const alias = [...new Set([...ca[0].alias, de, ...cd[0].alias])];
        await trRest(`tr_cadenas?clave=eq.${encodeURIComponent(a)}`, { method: "PATCH", prefer: "return=minimal", body: JSON.stringify({ alias, updated_at: now() }) });
        await trRest(`tr_cadenas?clave=eq.${encodeURIComponent(de)}`, { method: "PATCH", prefer: "return=minimal", body: JSON.stringify({ activa: false, alias: [], updated_at: now() }) });
        await auditar(usuario, "cadena_unir", `${de} → ${a}`, { de, tiendas: td.length }, { a, movidas: mover.length, quedaron: td.length - mover.length });
        return NextResponse.json({ ok: true, movidas: mover.length, quedaron: td.length - mover.length });
      }
      case "sku": {
        const sku = String(b.sku ?? "");
        const c = limpiar(b.cambios, ["descripcion", "nombre_comercial", "division", "categoria", "marca", "ean"]);
        if (!sku || !c) return bad("Cambios inválidos");
        const [antes] = await trJson<Record<string, unknown>[]>(`tr_skus?sku=eq.${encodeURIComponent(sku)}`);
        if (!antes) return bad("El SKU no existe");
        await trRest(`tr_skus?sku=eq.${encodeURIComponent(sku)}`, { method: "PATCH", prefer: "return=minimal", body: JSON.stringify({ ...c, updated_at: now() }) });
        await auditar(usuario, "sku", sku, antes, c);
        return NextResponse.json({ ok: true });
      }
      case "objetivos": {
        const v = b.valor as Record<string, unknown> | null;
        const ok = (x: unknown) => typeof x === "number" && x > 0 && x <= 100;
        if (!v || !ok(v.lavado) || !ok(v.refrigeracion) || !ok(v.coccion)) return bad("Cada objetivo tiene que ser un % entre 0 y 100");
        const valor = { lavado: v.lavado, refrigeracion: v.refrigeracion, coccion: v.coccion };
        const [antes] = await trJson<Array<{ valor: unknown }>>("tr_config?clave=eq.fs_objetivos&select=valor");
        await trUpsert("tr_config", [{ clave: "fs_objetivos", valor, updated_at: now(), updated_by: usuario }], "clave");
        await auditar(usuario, "fs_objetivos", "fs_objetivos", antes?.valor ?? null, valor);
        await refrescarDerivados().catch(() => null); // el cruce CB × FS usa los objetivos
        return NextResponse.json({ ok: true });
      }
    }
    return bad("Entidad desconocida");
  } catch (e) { return err(e); }
}
