import "server-only";
// Mapa Trade cruzado (pedido del user 27-oct-2026): CB Trade, Floor Share y exhibición especial en el MISMO mapa, en los dos tableros. Cada
// tienda geocodificada es un punto (clave = id de tr_tiendas, viene en "label@id|lat|lon|prov"); el resto se agrupa por
// zona. El tablero base manda sus filtros; el otro toma período y equipo (meses, semanas, supervisor, promotor) y, si el
// base filtra cliente/tienda/categoría, se recorta a las tiendas que quedaron en el base.
import { getCbRowsFast, enriquecerCb, getFloorShareRowsFast, getFsPrecomputed, enriquecerFs } from "@/lib/cb-mirror";
import { computeCbView, isCbDefault, type CbView } from "@/lib/cb-view";
import { computeFsView, isFsDefault, type FsView } from "@/lib/fs-view";
import { getTrPrecalc, trEstado, getTrExhibiciones, getTrContactos, trAll } from "@/lib/trade-db";
import { getCbVentasDatos } from "@/lib/cb-ventas/server";
import { calcularPorcentajes, OBJETIVO_SELLIN } from "@/lib/cb-ventas/metrics";
import { hoyAR, vigenteEnFecha } from "@/lib/cb-ventas/vigencia";
import { crearEnriquecedorFs } from "@/lib/fs-enrich";
import type { ExhibicionTienda } from "@/components/trade/exhibicion-fotos";
import { getFsObjetivosAnio, mesRefFs, MESES_FS } from "@/lib/fs-objetivos";
import { CATEGORIA_PESOS } from "@/lib/categorias";
import type { CbFilter } from "@/lib/cb-queries";
import type { FloorShareFilter } from "@/lib/floor-share-queries";
import type { MapaMetrica, MapaPunto } from "@/components/trade/mapa-zonas";

const OBJ_CB = 80;
const N_MET = 9; // CB Trade ×3 · FS ×4 · exhibición especial · CB Sell In
const normN = (s: string | null | undefined) =>
  (s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

/** CB Sell In (CB Ventas, compras FC + BO) por cliente/razón social, con las mismas fórmulas y alcance del tablero /cb-ventas.
 *  null = el usuario no ve CB Ventas o no hay datos. */
async function cbSellInPorCliente(): Promise<Map<string, [number, number]> | null> {
  const d = await getCbVentasDatos().catch(() => null);
  if (d?.estado !== "ok" || !d.cuadroBasico.length) return null;
  const hoy = hoyAR();
  const ctx = { hayFiltroMes: false, mesEnCurso: Number(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires", month: "numeric" }).format(new Date(d.ventas.generatedAt))) };
  const porCli = new Map<string, typeof d.cuadroBasico>();
  for (const i of d.cuadroBasico) if (vigenteEnFecha(i, hoy)) porCli.set(i.cliente, [...(porCli.get(i.cliente) ?? []), i]);
  const out = new Map<string, [number, number]>();
  for (const [cli, its] of porCli) { const p = calcularPorcentajes(its, d.ventas.rows, ctx); out.set(normN(cli), [p.cumplidosCB, p.totalCB]); }
  return out;
}

export async function cargarCbView(filter: CbFilter): Promise<CbView> {
  let view: CbView | null = null;
  if (isCbDefault(filter) && (await trEstado()).cb != null) view = await getTrPrecalc<CbView>("cb_default");
  if (view && (!view.byPromotor || !view.byZona)) view = null; // precálculo viejo → se recalcula
  return view ?? computeCbView(await enriquecerCb(await getCbRowsFast()), filter);
}

export async function cargarFsView(filter: FloorShareFilter): Promise<FsView> {
  let view: FsView | null = isFsDefault(filter) ? await getFsPrecomputed() : null;
  if (view && (!view.byPromotor || !view.byZona)) view = null;
  return view ?? computeFsView(await enriquecerFs(await getFloorShareRowsFast([])), filter);
}

export type FsObj = { general: number; lavado: number; refri: number; coccion: number; anio: number; mesIdx: number };
/** Meta de Floor Share del mes de referencia (mes filtrado o el de la última semana) + general ponderado por categoría. */
export async function objetivosFs(v: FsView, f: FloorShareFilter): Promise<FsObj> {
  const sems = f.semanas?.length ? f.semanas : v.weekly.length ? v.weekly.map((w) => w.semana) : v.options.semanas;
  const mesesFiltro = (f.meses ?? []).map((m) => MESES_FS.indexOf(m)).filter((i) => i >= 0);
  const { anio, mesIdx } = mesRefFs(Math.max(0, ...sems), mesesFiltro.length ? Math.max(...mesesFiltro) : undefined);
  const o = (await getFsObjetivosAnio(anio))[mesIdx]!;
  const p = CATEGORIA_PESOS as Record<string, number>;
  const items: Array<[number, number]> = [[o.lavado, p.Lavado ?? 0], [o.refrigeracion, p["Refrigeración"] ?? 0], [o.coccion, p["Cocción"] ?? 0]];
  const wsum = items.reduce((s, [, w]) => s + w, 0) || 1;
  return { general: items.reduce((s, [x, w]) => s + x * w, 0) / wsum, lavado: o.lavado, refri: o.refrigeracion, coccion: o.coccion, anio, mesIdx };
}

const idDe = (zona: string) => { const i = zona.lastIndexOf("@"); return i < 0 ? null : zona.slice(i + 1).split("|")[0]!; };
const comun = <T extends { meses?: string[]; semanas?: number[]; supervisores?: string[]; promotores?: string[] }>(f: T) =>
  ({ meses: f.meses, semanas: f.semanas, supervisores: f.supervisores, promotores: f.promotores });

/** Puntos del mapa con CB (CB, Infaltables, Estratégico) + Floor Share (general y por categoría). */
export async function mapaTrade(base: { cb: CbView; cbFilter: CbFilter } | { fs: FsView; fsFilter: FloorShareFilter }): Promise<{ puntos: MapaPunto[]; metricas: MapaMetrica[]; nota: string | null }> {
  let cb: CbView | null, fs: FsView | null, recorte: "cb" | "fs" | null = null;
  if ("cb" in base) {
    cb = base.cb;
    fs = await cargarFsView(comun(base.cbFilter)).catch(() => null);
    if (base.cbFilter.clientes?.length || base.cbFilter.tiendas?.length || base.cbFilter.divisiones?.length) recorte = "cb";
  } else {
    fs = base.fs;
    cb = await cargarCbView(comun(base.fsFilter)).catch(() => null);
    if (base.fsFilter.clientes?.length || base.fsFilter.tiendas?.length || base.fsFilter.categorias?.length) recorte = "fs";
  }
  const obj = fs ? await objetivosFs(fs, "fs" in base ? base.fsFilter : comun(base.cbFilter)) : null;
  const vacio: [number, number] = [0, 0];
  const out = new Map<string, MapaPunto>();
  const poner = (zona: string, tiendas: number, desde: number, vals: Array<[number, number]>) => {
    const k = idDe(zona) ?? `zona:${zona}`;
    const p = out.get(k) ?? { zona, tiendas: 0, vals: Array.from({ length: N_MET }, () => vacio) };
    p.tiendas = Math.max(p.tiendas, tiendas);
    vals.forEach((v, i) => { p.vals[desde + i] = v; });
    out.set(k, p);
  };
  for (const z of cb?.byZona ?? []) poner(z.zona, z.tiendas, 0, [z.cb, z.inf, z.est]);
  for (const z of fs?.byZona ?? []) poner(z.cliente, z.tiendas, 3, [z.total, z.lavado, z.refri, z.coccion].map((b) => [b.drean_units, b.total_units] as [number, number]));
  // Con filtro de cliente/tienda/categoría en el tablero base, solo quedan las tiendas que el base mostró.
  const delBase = new Set((recorte === "cb" ? cb?.byZona?.map((z) => z.zona) : recorte === "fs" ? fs?.byZona?.map((z) => z.cliente) : [])?.map((z) => idDe(z) ?? `zona:${z}`) ?? []);
  const puntos = [...out].filter(([k]) => !recorte || delBase.has(k)).map(([, p]) => p);

  // Exhibición especial / activación WOW (tr_exhibiciones): sí/no por tienda + ficha con el mueble y las fotos. Las de
  // tiendas fuera del relevamiento de Trade son puntos propios (solo con esta variable), salvo que haya filtro de tiendas.
  const exh = await getTrExhibiciones();
  const porTienda = new Map<string, typeof exh>();
  for (const e of exh) if (e.tienda_id != null) porTienda.set(String(e.tienda_id), [...(porTienda.get(String(e.tienda_id)) ?? []), e]);
  const detalle = (es: typeof exh) => es.flatMap((e) => [
    { label: `Exhibición${e.anio ? ` ${e.anio}` : ""}`, valor: e.exhibidor ?? "sin detalle" },
    ...(e.fotos?.length ? [{ label: "Fotos", valor: "", fotos: e.fotos }]
      : e.link_fotos?.startsWith("http") ? [{ label: "Fotos", valor: "ver en Drive", href: e.link_fotos }] : []),
  ]);
  // CB Sell In: tienda → cadena → cliente SAP (tr_cadenas.cliente) → % CB Ventas de ese cliente (el mismo para todas sus tiendas).
  const [sellIn, tiendasCad, cadenas] = await Promise.all([
    cbSellInPorCliente(),
    trAll<{ id: number; cadena: string }>("tr_tiendas?select=id,cadena").catch(() => []),
    trAll<{ clave: string; cliente: string | null }>("tr_cadenas?select=clave,cliente", "clave").catch(() => []),
  ]);
  const cliDeCadena = new Map(cadenas.filter((c) => c.cliente).map((c) => [c.clave, c.cliente!]));
  const cliDeTienda = new Map(tiendasCad.map((t) => [String(t.id), cliDeCadena.get(t.cadena) ?? null]));
  for (const p of puntos) {
    const id = idDe(p.zona);
    if (!id) continue;
    const cli = cliDeTienda.get(id);
    const v = cli ? sellIn?.get(normN(cli)) : undefined;
    if (cli && v) { p.vals[8] = v; p.cuenta = cli; p.detalle = [{ label: "Cliente (CB Sell In)", valor: cli }, ...(p.detalle ?? [])]; }
  }
  for (const p of puntos) {
    const id = idDe(p.zona);
    if (!id) continue; // burbujas de zona: sin dato de exhibición
    const es = porTienda.get(id) ?? [];
    p.vals[7] = [es.length ? 1 : 0, 1];
    if (es.length) p.detalle = [...(p.detalle ?? []), ...detalle(es)];
  }
  const filtraTiendas = recorte || ("cb" in base ? base.cbFilter : base.fsFilter).promotores?.length || ("cb" in base ? base.cbFilter : base.fsFilter).supervisores?.length;
  if (!filtraTiendas) {
    const enMapa = new Set(puntos.map((p) => idDe(p.zona)));
    for (const e of exh) {
      if (e.lat == null || e.lon == null || (e.tienda_id != null && enMapa.has(String(e.tienda_id)))) continue;
      const vals: Array<[number, number]> = Array.from({ length: N_MET }, () => vacio);
      vals[7] = [1, 1];
      puntos.push({ zona: `${e.cliente ?? ""} — ${e.direccion ?? e.ciudad ?? ""} (fuera del relevamiento)@x${e.id}|${e.lat}|${e.lon}|`, tiendas: 1, vals, detalle: detalle([e]) });
    }
  }
  const r1 = (x: number) => Number(x.toFixed(1));
  return {
    puntos,
    metricas: [
      { label: "CB Trade", obj: OBJ_CB }, { label: "CB Trade Infaltables", obj: OBJ_CB }, { label: "CB Trade Estratégico", obj: OBJ_CB },
      { label: "FS general", obj: r1(obj?.general ?? 0) }, { label: "FS Lavado", obj: obj?.lavado ?? 0 },
      { label: "FS Refrigeración", obj: obj?.refri ?? 0 }, { label: "FS Cocción", obj: obj?.coccion ?? 0 },
      { label: "Exhibición especial", obj: 100, binaria: true },
      { label: "CB Sell In (ventas)", obj: OBJETIVO_SELLIN, porCuenta: true },
    ],
    nota: [
      !fs ? "Floor Share no disponible." : !cb ? "Cuadro Básico no disponible." : obj ? `Meta FS de ${MESES_FS[obj.mesIdx]} ${obj.anio}.` : null,
      "CB Trade = presencia del SKU en la góndola de cada tienda (relevamiento). CB Sell In = compras del cliente (facturas + pedidos, CB Ventas): es por cliente, cada tienda muestra el de su cliente.",
      sellIn ? null : "CB Sell In no disponible (sin acceso a CB Ventas o sin datos).",
    ].filter(Boolean).join(" "),
  };
}

/** Exhibiciones de las tiendas filtradas (mismo cruce tienda → tr_tiendas que el mapa: número + nombre del maestro). */
export async function exhibicionesDeTiendas(tiendas: Array<{ numero: string; nombre: string; label: string }>): Promise<ExhibicionTienda[]> {
  if (!tiendas.length) return [];
  const [contactos, exh] = await Promise.all([getTrContactos().catch(() => []), getTrExhibiciones()]);
  const enr = crearEnriquecedorFs(contactos);
  const porId = new Map<string, string>();
  for (const t of tiendas) { const id = enr(t.numero, t.nombre)?.geo?.split("|")[0]; if (id) porId.set(id, t.label); }
  return exh.filter((e) => e.tienda_id != null && porId.has(String(e.tienda_id)))
    .sort((a, b) => (b.anio ?? 0) - (a.anio ?? 0))
    .map((e) => ({ id: e.id, tienda: porId.get(String(e.tienda_id))!, anio: e.anio, exhibidor: e.exhibidor, fotos: e.fotos ?? [], link: e.link_fotos }));
}
