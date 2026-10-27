// "Sugerencias de SKUs" del CB de Trade (27-oct-2026, pedido del user): con la exhibición semanal de SKUs por tienda
// (tr_exhibicion_sku, mínimo 4 semanas = un mes) busca SKUs que NO están en el cuadro básico del grupo (cliente o
// tipología) pero sí están exhibidos en sus tiendas, y estima cuánto subiría el % CB si se SUMAN al CB (una posición
// más por tienda, cumplida donde ya está exhibido). Solo agregar, nunca reemplazar: el CB de Trade no tiene homólogos.
// No se sugiere un SKU que ya es HOMÓLOGO de uno del CB según el catálogo de CB Ventas (27-oct, pedido del user: un
// lavarropas frontal 6 kg con otro código ya está en el CB) → `homologosExcluidos`.
// `acumPct` = % CB sumando ese SKU y todos los de arriba en la lista (orden de mayor a menor aporte). PURO, sin I/O.
// Test: `npx tsx scripts/trade-carga.test.ts`.

export type ExhSkuRow = {
  semana: number; tienda: string; sku: string; division: string | null; categoria: string | null;
  subcategoria: string | null; descripcion: string | null; estatus_pdv: string | null;
};
export type CbSkuRow = { semana: number; tienda: string; cliente: string | null; sku: string; target_cb: number; real_cb: number; division?: string | null };

/** Categoría del tablero desde la división (LAVADO Y SECADO / REFRIGERACIÓN / COCCIÓN). */
export const areaDe = (div: string | null | undefined) => {
  const d = (div ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  return d.startsWith("LAVADO") ? "Lavado" : d.startsWith("REFRIG") ? "Refrigeración" : d.startsWith("COCC") ? "Cocción" : "Otros";
};

export type SkuSugerido = {
  sku: string; descripcion: string; area: string; categoria: string; segmento: string;
  /** tiendas del grupo donde está exhibido (≥ la mitad de las semanas relevadas) / tiendas del grupo */
  tiendasExh: number; tiendas: number;
  /** % CB del grupo sumando solo este SKU, y sumando este y todos los anteriores de la lista. */
  pct: number; acumPct: number;
};
export type GrupoSku = {
  grupo: string; tiendas: number; target: number; real: number; pct: number; sugerencias: SkuSugerido[];
  /** SKUs exhibidos fuera del CB que no se sugieren porque son homólogos de uno que ya está (`de`). */
  homologosExcluidos: { sku: string; de: string }[];
  /** CB actual del grupo (última semana del período): por SKU, posiciones cumplidas / total. */
  cb: { sku: string; descripcion: string; area: string; cumple: number; total: number }[];
  /** SKUs que el usuario sacó de las sugerencias de este grupo (no se vuelven a sugerir). */
  descartados: string[];
};

/** Clave para comparar códigos: sin ceros a la izquierda, mayúsculas, "·" = ".", sin espacios de más. */
export const claveSku = (s: string) => s.trim().toUpperCase().replace(/·/g, ".").replace(/\s+/g, " ").replace(/^0+(?=.)/, "");

/** Cocinas (27-oct, definición del user): CD55xx se reemplazó por CD56xx; "02" = sin luz ni encendido eléctrico y "03" = con
 *  luz y encendido (cada una en blanco/inox/negro); CD5614/CD5617 = las más especificadas de 56 cm; 60 cm y 76 cm son distintas.
 *  Para las cocinas manda esta regla y NO el catálogo de Ventas (que junta 60 con 76). Otras cocinas → sin familia. */
export function familiaCocina(sku: string): string | null {
  const k = claveSku(sku);
  if (!k.startsWith("CD")) return null;
  const m = k.match(/^CD5[56](02|03)/);
  if (m) return `CD56${m[1]}`;
  if (/^CD550[57]/.test(k)) return "CD5603"; // CD5505/CD5507: similares a la 03 (user 27-oct)
  if (/^CD56(14|17)/.test(k)) return "CD5614";
  return `sola:${k}`;
}

/** Grupos de equivalencia del catálogo de CB Ventas: cada renglón = modelo + sus homólogos. */
export function equivalencias(renglones: { modelo: string; homologos: string[] | null }[]): Map<string, Set<string>> {
  const eq = new Map<string, Set<string>>();
  for (const r of renglones) {
    if (familiaCocina(r.modelo)) continue; // las cocinas van por familiaCocina
    const ks = [r.modelo, ...(r.homologos ?? [])].filter(Boolean).map(claveSku);
    for (const k of ks) { if (!eq.has(k)) eq.set(k, new Set()); for (const o of ks) if (o !== k) eq.get(k)!.add(o); }
  }
  return eq;
}

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
  exh: ExhSkuRow[], cb: CbSkuRow[], grupoDe: (tienda: string, cliente: string | null) => string, opts: { top?: number; equivalentes?: Map<string, Set<string>>; descartados?: (grupo: string) => Set<string>; nombres?: Map<string, string> } = {},
): GrupoSku[] {
  // Exhibición: semanas relevadas por tienda y semanas en que cada SKU estuvo exhibido (no "Retirada").
  const semT = new Map<string, Set<number>>(), exT = new Map<string, Map<string, Set<number>>>();
  const info = new Map<string, { desc: string; cat: string; seg: string; area: string }>();
  for (const r of exh) {
    const k = claveTienda(r.tienda);
    if (!semT.has(k)) { semT.set(k, new Set()); exT.set(k, new Map()); }
    semT.get(k)!.add(r.semana);
    if (!info.has(r.sku)) info.set(r.sku, { desc: r.descripcion ?? r.sku, cat: r.categoria ?? r.division ?? "", seg: segmento(r.subcategoria), area: areaDe(r.division) });
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
  const divCb = new Map<string, string | null | undefined>();
  for (const r of cb) {
    const k = claveTienda(r.tienda);
    if (r.semana !== ult.get(k) || !(r.target_cb > 0) || !semT.has(k)) continue; // sin exhibición no se puede sugerir
    if (!cbT.has(k)) cbT.set(k, { label: r.tienda, cliente: r.cliente, skus: new Map() });
    cbT.get(k)!.skus.set(r.sku, { t: r.target_cb, r: Math.min(r.real_cb, r.target_cb) });
    if (!divCb.get(r.sku)) divCb.set(r.sku, r.division);
  }

  const grupos = new Map<string, string[]>();
  for (const [k, v] of cbT) { const g = grupoDe(v.label, v.cliente); grupos.set(g, [...(grupos.get(g) ?? []), k]); }

  const out: GrupoSku[] = [];
  for (const [grupo, ks] of grupos) {
    let T = 0, R = 0;
    const cbSet = new Set<string>(), porSku = new Map<string, { t: number; r: number }>();
    for (const k of ks) for (const [s, v] of cbT.get(k)!.skus) {
      T += v.t; R += v.r; cbSet.add(s);
      const a = porSku.get(s) ?? { t: 0, r: 0 }; a.t += v.t; a.r += v.r; porSku.set(s, a);
    }
    if (!T) continue;
    // SKU del CB por clave; un candidato equivalente (homólogo) a alguno ya está cubierto.
    const enCb = new Map<string, string>();
    for (const s of cbSet) enCb.set(claveSku(s), s);
    const famCb = new Map<string, string>();
    for (const s of cbSet) { const f = familiaCocina(s); if (f) famCb.set(f, s); }
    const homDe = (c: string) => {
      const f = familiaCocina(c);
      if (f) return famCb.get(f) ?? null;
      for (const e of opts.equivalentes?.get(claveSku(c)) ?? []) { const s = enCb.get(e); if (s) return s; }
      return null;
    };
    const fuera = opts.descartados?.(grupo) ?? new Set<string>();
    const cand = new Map<string, number>(), excl = new Map<string, string>();
    for (const k of ks) for (const s of exT.get(k)!.keys()) {
      if (cbSet.has(s) || enCb.has(claveSku(s)) || fuera.has(s) || !presente(k, s)) continue;
      const de = homDe(s);
      if (de) excl.set(s, de); else cand.set(s, (cand.get(s) ?? 0) + 1);
    }
    const N = ks.length, pct = R / T;
    // Sumar un SKU sube el % solo si está exhibido en una proporción de tiendas mayor al % que hay: de mayor a menor
    // exhibición, se agregan mientras sigan subiendo el % acumulado (después de eso lo bajarían).
    const sugerencias: SkuSugerido[] = [];
    let r = R, t = T;
    for (const [c, n] of [...cand].sort((a, b) => b[1] - a[1])) {
      if (n / N <= r / t || sugerencias.length >= (opts.top ?? 40)) break;
      r += n; t += N;
      const ic = info.get(c)!;
      sugerencias.push({ sku: c, descripcion: ic.desc, area: ic.area, categoria: ic.cat, segmento: ic.seg, tiendasExh: n, tiendas: N, pct: ((R + n) / (T + N)) * 100, acumPct: (r / t) * 100 });
    }
    const cbAct = [...porSku].map(([sku, v]) => ({
      sku, descripcion: opts.nombres?.get(sku) ?? info.get(sku)?.desc ?? sku,
      area: divCb.get(sku) ? areaDe(divCb.get(sku)) : info.get(sku)?.area ?? "Otros", cumple: v.r, total: v.t,
    })).sort((a, b) => a.area.localeCompare(b.area) || a.sku.localeCompare(b.sku));
    out.push({
      grupo, tiendas: N, target: T, real: R, pct: pct * 100, sugerencias, cb: cbAct, descartados: [...fuera],
      homologosExcluidos: [...excl].map(([sku, de]) => ({ sku, de })),
    });
  }
  return out.sort((a, b) => a.pct - b.pct);
}
