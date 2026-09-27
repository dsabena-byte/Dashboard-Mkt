// ============================================================================
// "¿Por qué se movió?" — descomposición de una variación en contribuciones que SUMAN EXACTO el
// total (Shapley de 2 factores = punto medio). Puro.
//  · Suma de componentes (medio/categoría/canal): Δtotal = Σ Δcomponente.
//  · Producto volumen × tasa (ej. impresiones = inversión × impresiones por $):
//      ΔY = ΔV·(T₀+T₁)/2  [efecto volumen]  +  ΔT·(V₀+V₁)/2  [efecto tasa]
//  · Componentes con driver (cada uno volumen × tasa): lo anterior por componente.
//  · Tasa agregada por segmentos (ej. conversión por canal) r = Σ pₖ·rₖ:
//      Δr = Σ Δpₖ·r̄ₖ  [efecto mix]  +  Σ p̄ₖ·Δrₖ  [efecto tasa]
//    Un segmento que aparece/desaparece toma la tasa del otro período (todo va a mix).
// ============================================================================

const pct = (part: number, tot: number) => (tot ? (part / tot) * 100 : null);

export interface Contribucion { nombre: string; antes: number; despues: number; delta: number; pctDelTotal: number | null }
export interface DescompSuma { antes: number; despues: number; total: number; variacionPct: number | null; contribuciones: Contribucion[] }

export function descomponerSuma(items: { nombre: string; antes: number | null; despues: number | null }[]): DescompSuma {
  const rows = items.map((x) => ({ nombre: x.nombre, antes: x.antes ?? 0, despues: x.despues ?? 0 }));
  const antes = rows.reduce((a, x) => a + x.antes, 0), despues = rows.reduce((a, x) => a + x.despues, 0);
  const total = despues - antes;
  const contribuciones = rows.map((x) => ({ ...x, delta: x.despues - x.antes, pctDelTotal: pct(x.despues - x.antes, total) }))
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  return { antes, despues, total, variacionPct: antes ? (total / Math.abs(antes)) * 100 : null, contribuciones };
}

export interface DescompProducto {
  antes: number; despues: number; total: number; variacionPct: number | null;
  efectoVolumen: number; efectoTasa: number;
  /** Contribuciones en puntos porcentuales de la variación (suman variacionPct). */
  ptsVolumen: number | null; ptsTasa: number | null;
}

/** Y = volumen × tasa. Si no se pasa la tasa, se deduce como Y/volumen. */
export function descomponerProducto(antes: { volumen: number; tasa: number }, despues: { volumen: number; tasa: number }): DescompProducto {
  const y0 = antes.volumen * antes.tasa, y1 = despues.volumen * despues.tasa;
  const eV = (despues.volumen - antes.volumen) * (antes.tasa + despues.tasa) / 2;
  const eT = (despues.tasa - antes.tasa) * (antes.volumen + despues.volumen) / 2;
  const b = Math.abs(y0);
  return { antes: y0, despues: y1, total: y1 - y0, variacionPct: b ? ((y1 - y0) / b) * 100 : null, efectoVolumen: eV, efectoTasa: eT, ptsVolumen: b ? (eV / b) * 100 : null, ptsTasa: b ? (eT / b) * 100 : null };
}

/** Descompone un resultado Y y su driver V (Y = V × Y/V): p. ej. clicks vs impresiones → CTR. */
export function descomponerConDriver(y0: number, y1: number, v0: number, v1: number): DescompProducto | null {
  if (!(v0 > 0) || !(v1 > 0)) return null;
  return descomponerProducto({ volumen: v0, tasa: y0 / v0 }, { volumen: v1, tasa: y1 / v1 });
}

export interface ContribDriver { nombre: string; delta: number; efectoVolumen: number; efectoTasa: number; pctDelTotal: number | null }
export interface DescompDriver { antes: number; despues: number; total: number; variacionPct: number | null; efectoVolumen: number; efectoTasa: number; componentes: ContribDriver[] }

/** Suma de componentes, cada uno = base × valor/base (ej. por medio: inversión × impresiones por $). */
export function descomponerComponentesConDriver(items: { nombre: string; antes: { base: number; valor: number }; despues: { base: number; valor: number } }[]): DescompDriver {
  const comps = items.map((x) => {
    const a = x.antes, d = x.despues;
    const delta = d.valor - a.valor;
    // Aparece o desaparece: no hay tasa en un período → todo es efecto volumen.
    if (!(a.base > 0) || !(d.base > 0)) return { nombre: x.nombre, delta, efectoVolumen: delta, efectoTasa: 0 };
    const r = descomponerProducto({ volumen: a.base, tasa: a.valor / a.base }, { volumen: d.base, tasa: d.valor / d.base });
    return { nombre: x.nombre, delta, efectoVolumen: r.efectoVolumen, efectoTasa: r.efectoTasa };
  });
  const antes = items.reduce((s, x) => s + x.antes.valor, 0), despues = items.reduce((s, x) => s + x.despues.valor, 0), total = despues - antes;
  return {
    antes, despues, total, variacionPct: antes ? (total / Math.abs(antes)) * 100 : null,
    efectoVolumen: comps.reduce((s, c) => s + c.efectoVolumen, 0), efectoTasa: comps.reduce((s, c) => s + c.efectoTasa, 0),
    componentes: comps.map((c) => ({ ...c, pctDelTotal: pct(c.delta, total) })).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)),
  };
}

export interface SegmentoTasa { nombre: string; numAntes: number; denAntes: number; numDespues: number; denDespues: number }
export interface ContribTasa { nombre: string; mix: number; tasa: number; total: number }
export interface DescompTasa { tasaAntes: number; tasaDespues: number; total: number; efectoMix: number; efectoTasa: number; segmentos: ContribTasa[] }

/** Tasa agregada r = Σnum/Σden por segmentos: efecto mix + efecto tasa (exacto). null si algún total es 0. */
export function descomponerTasa(segs: SegmentoTasa[], escala = 1): DescompTasa | null {
  const D0 = segs.reduce((s, x) => s + x.denAntes, 0), D1 = segs.reduce((s, x) => s + x.denDespues, 0);
  if (!(D0 > 0) || !(D1 > 0)) return null;
  const rows = segs.map((x) => {
    const p0 = x.denAntes / D0, p1 = x.denDespues / D1;
    let r0 = x.denAntes > 0 ? x.numAntes / x.denAntes : NaN, r1 = x.denDespues > 0 ? x.numDespues / x.denDespues : NaN;
    if (!Number.isFinite(r0)) r0 = Number.isFinite(r1) ? r1 : 0;
    if (!Number.isFinite(r1)) r1 = r0;
    const mix = (p1 - p0) * ((r0 + r1) / 2) * escala, tasa = ((p0 + p1) / 2) * (r1 - r0) * escala;
    return { nombre: x.nombre, mix, tasa, total: mix + tasa };
  });
  const t0 = (segs.reduce((s, x) => s + x.numAntes, 0) / D0) * escala, t1 = (segs.reduce((s, x) => s + x.numDespues, 0) / D1) * escala;
  return {
    tasaAntes: t0, tasaDespues: t1, total: t1 - t0,
    efectoMix: rows.reduce((s, r) => s + r.mix, 0), efectoTasa: rows.reduce((s, r) => s + r.tasa, 0),
    segmentos: rows.sort((a, b) => Math.abs(b.total) - Math.abs(a.total)),
  };
}
