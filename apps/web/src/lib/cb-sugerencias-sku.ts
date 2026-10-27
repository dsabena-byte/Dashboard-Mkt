// "Sugerencias de SKUs" del CB de Trade (27-oct-2026, pedido del user): con la exhibición semanal de SKUs por tienda
// (tr_exhibicion_sku, mínimo 4 semanas = un mes) busca SKUs que NO están en el cuadro básico del grupo (cliente o
// tipología) pero sí están exhibidos en sus tiendas, y estima cuánto subiría el % CB:
//   • como homólogo de un SKU del CB de la misma categoría (cuenta en las tiendas donde ese SKU falta y el sugerido está);
//   • como SKU nuevo del CB (suma una posición por tienda y la cumple donde ya está exhibido).
// Cada fila se estima por separado (no se suman: dos sugeridos pueden cubrir el mismo faltante). PURO, sin I/O.
// Test: `npx tsx scripts/trade-carga.test.ts`.

export type ExhSkuRow = {
  semana: number; tienda: string; sku: string; division: string | null; categoria: string | null;
  subcategoria: string | null; descripcion: string | null; estatus_pdv: string | null;
};
export type CbSkuRow = { semana: number; tienda: string; cliente: string | null; sku: string; target_cb: number; real_cb: number };

export type SkuSugerido = {
  sku: string; descripcion: string; categoria: string; segmento: string;
  /** tiendas del grupo donde está exhibido (≥ la mitad de las semanas relevadas) / tiendas del grupo */
  tiendasExh: number; tiendas: number;
  /** Solo del mismo segmento o del mismo tipo con otra capacidad (no carga superior por frontal, cíclica por no frost…). */
  homologo: { de: string; mismoSegmento: boolean; recupera: number; deltaPp: number } | null;
  nuevoDeltaPp: number;
};
export type GrupoSku = { grupo: string; tiendas: number; target: number; real: number; pct: number; sugerencias: SkuSugerido[] };

const COLOR = new Set(["BLANCO", "BLANCA", "GRIS", "GRAY", "GREY", "INOXIDABLE", "INOX", "NEGRO", "NEGRA", "SILVER", "PLATA", "ACERO", "BLACK", "WHITE"]);
const norm = (s: string | null | undefined) =>
  (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9,. ]/g, " ").replace(/\s+/g, " ").trim();
/** "325 - FAVA MAR DEL PLATA" y "325 - Fava Mar del Plata" = la misma tienda. */
export const claveTienda = (t: string) => {
  const m = t.match(/^\s*0*(\d+)\s*[-–]\s*(.+)$/);
  return m ? `${m[1]}|${norm(m[2])}` : `|${norm(t)}`;
};
/** Segmento = subcategoría sin colores, primeras 3 partes: "56 cm - Piso - Gas", "Automática Carga Frontal - 8 kg - Europeo". */
export const segmento = (sub: string | null | undefined) =>
  (sub ?? "").split(" - ").map((p) => p.trim()).filter((p) => p && !COLOR.has(norm(p))).slice(0, 3).join(" - ");

/** Tipo = segmento sin la capacidad/medida: "Automática Carga Frontal - Europeo", "2 puertas - Cíclico". */
export const tipoProducto = (seg: string) =>
  seg.split(" - ").filter((p) => !/^\d+([.,]\d+)?\s*(kg|cm|l|lts|litros)?$/i.test(p.trim())).join(" - ");

export function calcularSugerenciasSku(
  exh: ExhSkuRow[], cb: CbSkuRow[], grupoDe: (tienda: string, cliente: string | null) => string,
  opts: { top?: number; catalogo?: (tienda: string, cliente: string | null) => Iterable<string> } = {},
): GrupoSku[] {
  // Exhibición: semanas relevadas por tienda y semanas en que cada SKU estuvo exhibido (no "Retirada").
  const semT = new Map<string, Set<number>>(), exT = new Map<string, Map<string, Set<number>>>();
  const info = new Map<string, { desc: string; cat: string; seg: string }>();
  for (const r of exh) {
    const k = claveTienda(r.tienda);
    if (!semT.has(k)) { semT.set(k, new Set()); exT.set(k, new Map()); }
    semT.get(k)!.add(r.semana);
    if (!info.has(r.sku)) info.set(r.sku, { desc: r.descripcion ?? r.sku, cat: r.categoria ?? r.division ?? "", seg: segmento(r.subcategoria) });
    if (/retirad/i.test(r.estatus_pdv ?? "")) continue;
    const m = exT.get(k)!;
    if (!m.has(r.sku)) m.set(r.sku, new Set());
    m.get(r.sku)!.add(r.semana);
  }
  const presente = (k: string, sku: string) => (exT.get(k)?.get(sku)?.size ?? 0) * 2 >= (semT.get(k)?.size ?? Infinity);

  // CB: la última semana de cada tienda dentro de lo que se pasó.
  const ult = new Map<string, number>();
  for (const r of cb) { const k = claveTienda(r.tienda); ult.set(k, Math.max(ult.get(k) ?? 0, r.semana)); }
  const cbT = new Map<string, { label: string; cliente: string | null; skus: Map<string, { t: number; r: number }>; hom: Set<string> }>();
  for (const r of cb) {
    const k = claveTienda(r.tienda);
    if (r.semana !== ult.get(k) || !(r.target_cb > 0) || !semT.has(k)) continue; // sin exhibición no se puede sugerir
    // hom = SKUs del catálogo CB del cliente (modelos y homólogos): ya son CB aunque la planilla semanal no los mida.
    if (!cbT.has(k)) cbT.set(k, { label: r.tienda, cliente: r.cliente, skus: new Map(), hom: new Set(opts.catalogo?.(r.tienda, r.cliente) ?? []) });
    cbT.get(k)!.skus.set(r.sku, { t: r.target_cb, r: Math.min(r.real_cb, r.target_cb) });
  }

  const grupos = new Map<string, string[]>();
  for (const [k, v] of cbT) { const g = grupoDe(v.label, v.cliente); grupos.set(g, [...(grupos.get(g) ?? []), k]); }

  const out: GrupoSku[] = [];
  for (const [grupo, ks] of grupos) {
    let T = 0, R = 0;
    const cbSet = new Set<string>();
    for (const k of ks) for (const [s, v] of cbT.get(k)!.skus) { T += v.t; R += v.r; cbSet.add(s); }
    if (!T) continue;
    const cand = new Map<string, number>();
    for (const k of ks) for (const s of exT.get(k)!.keys()) if (!cbSet.has(s) && !cbT.get(k)!.hom.has(s) && presente(k, s)) cand.set(s, (cand.get(s) ?? 0) + 1);
    const N = ks.length, pct = R / T;
    const sugerencias: SkuSugerido[] = [];
    for (const [c, n] of cand) {
      const ic = info.get(c)!;
      let homologo: SkuSugerido["homologo"] = null;
      for (const s of cbSet) {
        const is = info.get(s);
        if (!is || is.cat !== ic.cat) continue;
        const mismo = !!ic.seg && ic.seg === is.seg;
        if (!mismo && (!ic.seg || tipoProducto(ic.seg) !== tipoProducto(is.seg))) continue;
        let rec = 0;
        for (const k of ks) { const v = cbT.get(k)!.skus.get(s); if (v && v.r < v.t && !cbT.get(k)!.hom.has(c) && presente(k, c)) rec += v.t - v.r; }
        if (!rec) continue;
        if (!homologo || (mismo && !homologo.mismoSegmento) || (mismo === homologo.mismoSegmento && rec > homologo.recupera))
          homologo = { de: s, mismoSegmento: mismo, recupera: rec, deltaPp: (rec / T) * 100 };
      }
      const nuevoDeltaPp = Math.max(0, ((R + n) / (T + N) - pct) * 100);
      if (!homologo && nuevoDeltaPp < 0.05) continue;
      sugerencias.push({ sku: c, descripcion: ic.desc, categoria: ic.cat, segmento: ic.seg, tiendasExh: n, tiendas: N, homologo, nuevoDeltaPp });
    }
    const mejor = (s: SkuSugerido) => Math.max(s.homologo?.deltaPp ?? 0, s.nuevoDeltaPp);
    sugerencias.sort((a, b) => mejor(b) - mejor(a) || b.tiendasExh - a.tiendasExh);
    out.push({ grupo, tiendas: N, target: T, real: R, pct: pct * 100, sugerencias: sugerencias.slice(0, opts.top ?? 40) });
  }
  return out.sort((a, b) => a.pct - b.pct);
}
