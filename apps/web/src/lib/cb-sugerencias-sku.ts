// "Sugerencias de SKUs" del CB de Trade (27-oct-2026, pedido del user): con la exhibición semanal de SKUs por tienda
// (tr_exhibicion_sku, mínimo 4 semanas = un mes) busca SKUs que NO están en el cuadro básico del grupo (cliente o
// tipología) pero sí están exhibidos en sus tiendas, y estima cuánto subiría el % CB si se SUMAN al CB (una posición
// más por tienda, cumplida donde ya está exhibido). Solo agregar, nunca reemplazar: el CB de Trade no tiene homólogos.
// `acumPct` = % CB sumando ese SKU y todos los de arriba en la lista (orden de mayor a menor aporte). PURO, sin I/O.
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
  /** % CB del grupo sumando solo este SKU, y sumando este y todos los anteriores de la lista. */
  pct: number; acumPct: number;
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
  exh: ExhSkuRow[], cb: CbSkuRow[], grupoDe: (tienda: string, cliente: string | null) => string, opts: { top?: number } = {},
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
  const cbT = new Map<string, { label: string; cliente: string | null; skus: Map<string, { t: number; r: number }> }>();
  for (const r of cb) {
    const k = claveTienda(r.tienda);
    if (r.semana !== ult.get(k) || !(r.target_cb > 0) || !semT.has(k)) continue; // sin exhibición no se puede sugerir
    if (!cbT.has(k)) cbT.set(k, { label: r.tienda, cliente: r.cliente, skus: new Map() });
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
    for (const k of ks) for (const s of exT.get(k)!.keys()) if (!cbSet.has(s) && presente(k, s)) cand.set(s, (cand.get(s) ?? 0) + 1);
    const N = ks.length, pct = R / T;
    // Sumar un SKU sube el % solo si está exhibido en una proporción de tiendas mayor al % que hay: de mayor a menor
    // exhibición, se agregan mientras sigan subiendo el % acumulado (después de eso lo bajarían).
    const sugerencias: SkuSugerido[] = [];
    let r = R, t = T;
    for (const [c, n] of [...cand].sort((a, b) => b[1] - a[1])) {
      if (n / N <= r / t || sugerencias.length >= (opts.top ?? 40)) break;
      r += n; t += N;
      const ic = info.get(c)!;
      sugerencias.push({ sku: c, descripcion: ic.desc, categoria: ic.cat, segmento: ic.seg, tiendasExh: n, tiendas: N, pct: ((R + n) / (T + N)) * 100, acumPct: (r / t) * 100 });
    }
    out.push({ grupo, tiendas: N, target: T, real: R, pct: pct * 100, sugerencias });
  }
  return out.sort((a, b) => a.pct - b.pct);
}
