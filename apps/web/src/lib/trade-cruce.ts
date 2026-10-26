// Cruce CB de Trade × Floor Share por tienda (port de cuadros-basicos/lib/analisis-trade.ts, la vista /trade).
// PURO. Estado actual = semana más reciente de cada tienda×SKU (CB) y de cada tienda×categoría×marca (FS).
//   CB: % = Σreal / Σtarget (real recortado a target). FS: share Drean = unidades Drean / Σ unidades de todas las
//   marcas (las tablas no guardan la fila "Total" del archivo; el viejo legacy usaba la suma como respaldo).
//   Cuadrantes: Falta surtido (CB bajo/FS bajo) · Ejecución góndola (CB alto/FS bajo) · Sostener · Frágil.
//   "FS si reponés" = ESTIMACIÓN: cada SKU repuesto suma (uds Drean ÷ SKUs presentes) unidades y desplaza competencia.

export const CB_OBJETIVO = 80;
const DREAN = "drean";

export type Cuadrante = "sostener" | "ejecucion" | "surtido" | "fragil" | "sinFS";
export interface CruceCbRow { semana: number; tienda: string; numero_tienda: string | null; sku: string; cliente: string; division: string; target_cb: number; real_cb: number; target_inf: number; real_inf: number; tipo_sku: string | null }
export interface CruceFsRow { semana: number; categoria: string; numero_tienda: string; nombre_tienda: string; marca: string; unidades: number }
export interface SkuFaltante { sku: string; tienda: string; categoria: string; tipo: string }

export interface Segmento {
  nombre: string; tipo: "cadena" | "promotor" | "supervisor" | "tienda";
  cadena?: string; promotor?: string; supervisor?: string; numero?: string;
  pctCB: number; realCB: number; targetCB: number; pctInf: number;
  fsShare: number | null; fsTarget: number | null; dreanUnits: number; totalUnits: number;
  cuadrante: Cuadrante; skusFaltantes: SkuFaltante[]; upliftPp: number | null; fsShareProyectado: number | null; tiendas: number;
}
export interface CruceTrade {
  global: { pctCB: number; realCB: number; targetCB: number; fsShare: number | null; fsTarget: number | null; dreanUnits: number; totalUnits: number; tiendas: number; tiendasConFS: number };
  matriz: Record<Cuadrante, number>;
  cadenas: Segmento[]; promotores: Segmento[]; supervisores: Segmento[]; tiendas: Segmento[];
  categorias: { categoria: string; fsShare: number | null; fsTarget: number | null; pctCB: number; dreanUnits: number; totalUnits: number }[];
  cobertura: { tiendasCB: number; tiendasFS: number; tiendasAmbas: number };
}

const catKey = (s: string) => {
  const v = (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
  if (v.includes("lav") || v.includes("seca")) return "lavado";
  if (v.includes("refri") || v.includes("frio")) return "refrigeracion";
  if (v.includes("cocc") || v.includes("cocin")) return "coccion";
  return v;
};
const numDe = (r: CruceCbRow) => r.numero_tienda || (r.tienda.match(/^\s*(\d+)\s*[-–]/)?.[1] ?? "");

type CBAcc = { targetCB: number; realCB: number; targetInf: number; realInf: number; faltantes: SkuFaltante[]; presentes: number };
type FSAcc = { drean: number; total: number; porCat: Map<string, { drean: number; total: number }> };
const nCB = (): CBAcc => ({ targetCB: 0, realCB: 0, targetInf: 0, realInf: 0, faltantes: [], presentes: 0 });
const nFS = (): FSAcc => ({ drean: 0, total: 0, porCat: new Map() });
const pct = (r: number, t: number) => (t > 0 ? Math.min(100, Math.round((r / t) * 100)) : 0);
const r1 = (x: number) => Math.round(x * 10) / 10;

function sumCB(a: CBAcc, b: CBAcc) {
  a.targetCB += b.targetCB; a.realCB += b.realCB; a.targetInf += b.targetInf; a.realInf += b.realInf;
  a.presentes += b.presentes; a.faltantes.push(...b.faltantes);
}
function sumFS(a: FSAcc, b: FSAcc) {
  a.drean += b.drean; a.total += b.total;
  for (const [k, v] of b.porCat) { const c = a.porCat.get(k) ?? { drean: 0, total: 0 }; c.drean += v.drean; c.total += v.total; a.porCat.set(k, c); }
}

export function construirCruce(
  cb: CruceCbRow[], fs: CruceFsRow[], objetivos: Record<string, number>,
  maps: { cadena: Map<string, string>; promotor: Map<string, string>; supervisor: Map<string, string> },
): CruceTrade {
  const objDe = (c: string) => objetivos[catKey(c)] ?? null;
  // último estado
  const lastCb = new Map<string, CruceCbRow>();
  for (const r of cb) {
    if ((r.target_cb || 0) <= 0) continue;
    const k = `${numDe(r)}||${catKey(r.division)}||${r.sku}`;
    const p = lastCb.get(k); if (!p || r.semana > p.semana) lastCb.set(k, r);
  }
  const lastFs = new Map<string, CruceFsRow>();
  for (const r of fs) {
    const k = `${r.numero_tienda}||${catKey(r.categoria)}||${r.marca}`;
    const p = lastFs.get(k); if (!p || r.semana > p.semana) lastFs.set(k, r);
  }

  const cbT = new Map<string, CBAcc>(), fsT = new Map<string, FSAcc>(), nombre = new Map<string, string>();
  const cadena = new Map(maps.cadena);
  for (const r of lastCb.values()) {
    const n = numDe(r); if (!n) continue;
    if (!nombre.has(n)) nombre.set(n, r.tienda);
    if (!cadena.has(n) && r.cliente) cadena.set(n, r.cliente);
    const a = cbT.get(n) ?? nCB(); cbT.set(n, a);
    const t = r.target_cb || 0, rr = Math.min(r.real_cb || 0, t);
    a.targetCB += t; a.realCB += rr;
    a.targetInf += r.target_inf || 0; a.realInf += Math.min(r.real_inf || 0, r.target_inf || 0);
    if (rr >= t) a.presentes++; else a.faltantes.push({ sku: r.sku, tienda: r.tienda, categoria: r.division, tipo: r.tipo_sku ?? "" });
  }
  for (const r of lastFs.values()) {
    const n = r.numero_tienda; if (!n) continue;
    if (!nombre.has(n)) nombre.set(n, `${n} - ${r.nombre_tienda}`);
    const a = fsT.get(n) ?? nFS(); fsT.set(n, a);
    const ck = catKey(r.categoria), c = a.porCat.get(ck) ?? { drean: 0, total: 0 }; a.porCat.set(ck, c);
    const u = r.unidades || 0;
    a.total += u; c.total += u;
    if ((r.marca || "").trim().toLowerCase() === DREAN) { a.drean += u; c.drean += u; }
  }

  const seg = (nom: string, tipo: Segmento["tipo"], c: CBAcc, f: FSAcc, tiendas: number, extra: Partial<Segmento> = {}): Segmento => {
    let share: number | null = null, target: number | null = null;
    if (f.total > 0) {
      share = (f.drean / f.total) * 100;
      let tw = 0, w = 0;
      for (const [ck, v] of f.porCat) { const o = objDe(ck); if (o != null && v.total > 0) { tw += o * v.total; w += v.total; } }
      target = w > 0 ? tw / w : null;
    }
    let up: number | null = null, proy: number | null = null;
    if (f.total > 0 && f.drean > 0 && c.presentes > 0 && c.faltantes.length > 0) {
      const add = (f.drean / c.presentes) * c.faltantes.length;
      const nuevo = ((f.drean + add) / (f.total + add)) * 100;
      up = r1(nuevo - (f.drean / f.total) * 100); proy = r1(nuevo);
    }
    const pctCB = pct(c.realCB, c.targetCB);
    const cuadrante: Cuadrante = share == null || target == null ? "sinFS"
      : pctCB >= CB_OBJETIVO ? (share >= target ? "sostener" : "ejecucion") : (share >= target ? "fragil" : "surtido");
    return {
      nombre: nom, tipo, ...extra, pctCB, realCB: c.realCB, targetCB: c.targetCB, pctInf: pct(c.realInf, c.targetInf),
      fsShare: share == null ? null : r1(share), fsTarget: target == null ? null : r1(target),
      dreanUnits: Math.round(f.drean), totalUnits: Math.round(f.total), cuadrante, skusFaltantes: c.faltantes,
      upliftPp: up, fsShareProyectado: proy, tiendas,
    };
  };

  const todas = new Set([...cbT.keys(), ...fsT.keys()]);
  const tiendas: Segmento[] = [];
  for (const n of todas) {
    const c = cbT.get(n) ?? nCB(), f = fsT.get(n) ?? nFS();
    if (c.targetCB === 0 && f.total === 0) continue;
    tiendas.push(seg(nombre.get(n) || n, "tienda", c, f, 1, {
      numero: n, cadena: cadena.get(n), promotor: maps.promotor.get(n), supervisor: maps.supervisor.get(n),
    }));
  }
  const rollup = (tipo: Segmento["tipo"], key: Map<string, string>, sin: string): Segmento[] => {
    const g = new Map<string, { c: CBAcc; f: FSAcc; n: Set<string> }>();
    for (const n of todas) {
      const k = key.get(n) || sin;
      const e = g.get(k) ?? { c: nCB(), f: nFS(), n: new Set<string>() }; g.set(k, e);
      e.n.add(n);
      const c = cbT.get(n); if (c) sumCB(e.c, c);
      const f = fsT.get(n); if (f) sumFS(e.f, f);
    }
    return [...g].filter(([, e]) => e.c.targetCB > 0 || e.f.total > 0).map(([k, e]) => seg(k, tipo, e.c, e.f, e.n.size));
  };

  const gc = nCB(), gf = nFS();
  for (const c of cbT.values()) sumCB(gc, c);
  for (const f of fsT.values()) sumFS(gf, f);
  const g = seg("Total", "cadena", gc, gf, todas.size);
  const cbCat = new Map<string, { t: number; r: number }>();
  for (const r of lastCb.values()) { const k = catKey(r.division); const c = cbCat.get(k) ?? { t: 0, r: 0 }; c.t += r.target_cb || 0; c.r += Math.min(r.real_cb || 0, r.target_cb || 0); cbCat.set(k, c); }
  const matriz: Record<Cuadrante, number> = { sostener: 0, ejecucion: 0, surtido: 0, fragil: 0, sinFS: 0 };
  for (const t of tiendas) matriz[t.cuadrante]++;
  let ambas = 0; for (const n of cbT.keys()) if (fsT.has(n)) ambas++;
  return {
    global: { pctCB: g.pctCB, realCB: g.realCB, targetCB: g.targetCB, fsShare: g.fsShare, fsTarget: g.fsTarget, dreanUnits: g.dreanUnits, totalUnits: g.totalUnits, tiendas: todas.size, tiendasConFS: fsT.size },
    matriz,
    cadenas: rollup("cadena", cadena, "Sin cadena"),
    promotores: rollup("promotor", maps.promotor, "Sin promotor"),
    supervisores: rollup("supervisor", maps.supervisor, "Sin supervisor"),
    tiendas,
    categorias: [...gf.porCat].map(([ck, v]) => ({
      categoria: ck, fsShare: v.total > 0 ? r1((v.drean / v.total) * 100) : null, fsTarget: objDe(ck),
      pctCB: cbCat.has(ck) ? pct(cbCat.get(ck)!.r, cbCat.get(ck)!.t) : 0, dreanUnits: Math.round(v.drean), totalUnits: Math.round(v.total),
    })),
    cobertura: { tiendasCB: cbT.size, tiendasFS: fsT.size, tiendasAmbas: ambas },
  };
}
