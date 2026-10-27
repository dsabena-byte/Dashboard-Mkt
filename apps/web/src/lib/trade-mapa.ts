import "server-only";
// Mapa Trade cruzado (pedido del user 27-oct-2026): CB Trade y Floor Share en el MISMO mapa, en los dos tableros. Cada
// tienda geocodificada es un punto (clave = id de tr_tiendas, viene en "label@id|lat|lon|prov"); el resto se agrupa por
// zona. El tablero base manda sus filtros; el otro toma período y equipo (meses, semanas, supervisor, promotor) y, si el
// base filtra cliente/tienda/categoría, se recorta a las tiendas que quedaron en el base.
import { getCbRowsFast, enriquecerCb, getFloorShareRowsFast, getFsPrecomputed, enriquecerFs } from "@/lib/cb-mirror";
import { computeCbView, isCbDefault, type CbView } from "@/lib/cb-view";
import { computeFsView, isFsDefault, type FsView } from "@/lib/fs-view";
import { getTrPrecalc, trEstado } from "@/lib/trade-db";
import { getFsObjetivosAnio, mesRefFs, MESES_FS } from "@/lib/fs-objetivos";
import { CATEGORIA_PESOS } from "@/lib/categorias";
import type { CbFilter } from "@/lib/cb-queries";
import type { FloorShareFilter } from "@/lib/floor-share-queries";
import type { MapaMetrica, MapaPunto } from "@/components/trade/mapa-zonas";

const OBJ_CB = 80;

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
    const p = out.get(k) ?? { zona, tiendas: 0, vals: Array.from({ length: 7 }, () => vacio) };
    p.tiendas = Math.max(p.tiendas, tiendas);
    vals.forEach((v, i) => { p.vals[desde + i] = v; });
    out.set(k, p);
  };
  for (const z of cb?.byZona ?? []) poner(z.zona, z.tiendas, 0, [z.cb, z.inf, z.est]);
  for (const z of fs?.byZona ?? []) poner(z.cliente, z.tiendas, 3, [z.total, z.lavado, z.refri, z.coccion].map((b) => [b.drean_units, b.total_units] as [number, number]));
  // Con filtro de cliente/tienda/categoría en el tablero base, solo quedan las tiendas que el base mostró.
  const delBase = new Set((recorte === "cb" ? cb?.byZona?.map((z) => z.zona) : recorte === "fs" ? fs?.byZona?.map((z) => z.cliente) : [])?.map((z) => idDe(z) ?? `zona:${z}`) ?? []);
  const puntos = [...out].filter(([k]) => !recorte || delBase.has(k)).map(([, p]) => p);
  const r1 = (x: number) => Number(x.toFixed(1));
  return {
    puntos,
    metricas: [
      { label: "CB", obj: OBJ_CB }, { label: "CB Infaltables", obj: OBJ_CB }, { label: "CB Estratégico", obj: OBJ_CB },
      { label: "FS general", obj: r1(obj?.general ?? 0) }, { label: "FS Lavado", obj: obj?.lavado ?? 0 },
      { label: "FS Refrigeración", obj: obj?.refri ?? 0 }, { label: "FS Cocción", obj: obj?.coccion ?? 0 },
    ],
    nota: !fs ? "Floor Share no disponible." : !cb ? "Cuadro Básico no disponible." : obj ? `Meta FS de ${MESES_FS[obj.mesIdx]} ${obj.anio}.` : null,
  };
}
