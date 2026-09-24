// ============================================================================
// Señales de los tableros PROPIOS de Drean (no existen en BIP): Trade (Cuadro Básico y
// Floor Share), Influencia/UGC, Mercado (GfK), Salud de Marca (Kantar), Mkt Canal,
// Performance-Conversión (ecommerce) e Inversión de Marketing (BGT).
// Puro y client-safe: recibe los datos YA leídos de fuentes baratas/precalculadas
// (trade_monthly, fs_precomputed, mercado_share, constantes Kantar, meta_paid_creatives UGC,
// ugc_piece_analysis, mkt_canal_acciones, ga4_purchases/ads_cost diarios, cuatrimestres BGT).
// Umbrales relativos a la propia data (meta, meses previos, mediana del set) como en BIP.
// ============================================================================
import { type Signal, type SignalDash, sortSignals, median, sum, avg, deltaPct, fInt, fNum, fPct, fDelta, fMoney, clip, r2 } from "./types";

const MES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
type S12 = (number | null)[];
const pts = (xs: S12) => xs.map((v, i) => ({ v, i })).filter((x): x is { v: number; i: number } => x.v != null && Number.isFinite(x.v));
const mk = (out: Signal[], dash: SignalDash) => (s: Omit<Signal, "dash">) => out.push({ ...s, dash });

// ─────────────────────────── PAUTA: calidad de datos (OMD) ───────────────────────────
/** Avisos del adaptador de pauta (filas OMD con inversión y sin performance cargada). */
export function computePautaDataSignals(warnings: string[] | undefined): Signal[] {
  if (!warnings?.length) return [];
  return [{
    key: "pauta_omd_sin_performance", dash: "performance", tipo: "info", prioridad: "media",
    titulo: `${warnings.length} línea${warnings.length > 1 ? "s" : ""} del plan OMD con inversión y sin impresiones cargadas`,
    descripcion: `${warnings.slice(0, 4).join(" · ")}${warnings.length > 4 ? " …" : ""}. Quedan fuera de las métricas de eficiencia (CPM/CTR) hasta que se cargue el reporte mensual de OMD.`,
    acciones: ["Cargar la performance del reporte OMD del mes (impresiones/alcance/clics)", "Validar que la inversión cargada sea ejecución y no plan"],
    datos: { lineas: warnings.slice(0, 10) },
  }];
}

// ─────────────────────────── TRADE: CUADRO BÁSICO ───────────────────────────
export interface CbSignalInput {
  /** % Cumplimiento CB por mes (trade_monthly), solo meses cerrados. */
  cb: S12;
  /** Meta mensual (plan "Cuadros Básicos"). */
  meta: S12;
  /** Objetivo fijo del tablero (fallback cuando no hay meta cargada). */
  objetivo?: number;
}
export function computeCbSignals(inp: CbSignalInput): Signal[] {
  const out: Signal[] = [];
  const S = mk(out, "cuadros-basicos");
  const p = pts(inp.cb);
  const last = p[p.length - 1];
  if (!last) return out;
  const metaMes = inp.meta[last.i] ?? inp.objetivo ?? null;
  if (metaMes) {
    const gap = last.v - metaMes;
    if (gap <= -3) S({
      key: "cb_below_meta", tipo: "alerta", prioridad: gap <= -8 ? "alta" : "media",
      titulo: `Cuadro Básico ${MES[last.i]}: ${fPct(last.v, 1)} vs meta ${fPct(metaMes, 0)} (${gap.toFixed(1)} pp)`,
      descripcion: `Cumplimiento del surtido obligatorio en las tiendas relevadas (trade_monthly). ${p.length >= 2 ? `Mes previo: ${fPct(p[p.length - 2]!.v, 1)}.` : ""}`,
      acciones: ["Revisar en el tab de Tiendas cuáles bajan el promedio (quiebres de Infaltables)", "Priorizar reposición de los modelos Infaltables con más faltantes", "Coordinar con la fuerza de ventas las cadenas por debajo del objetivo"],
      datos: { mes: MES[last.i], cb: r2(last.v), meta: metaMes, gapPp: r2(gap) },
      impacto: { metrica: "Puntos de CB hasta la meta", valor: r2(-gap), unidad: "pp" },
    });
    else if (gap >= 5) S({
      key: "cb_above_meta", tipo: "info", prioridad: "baja",
      titulo: `Cuadro Básico ${MES[last.i]}: ${fPct(last.v, 1)}, ${gap.toFixed(1)} pp sobre la meta`,
      descripcion: "Si se sostiene 3 meses, conviene recalibrar la meta o mover el foco a Floor Share.",
      acciones: ["Sostener la rutina de reposición", "Evaluar subir la meta del próximo cuatrimestre"],
      datos: { mes: MES[last.i], cb: r2(last.v), meta: metaMes },
    });
  }
  if (p.length >= 4) {
    const base = p.slice(-4, -1);
    const b = avg(base.map((x) => x.v));
    const d = last.v - b;
    if (d <= -4) S({
      key: "cb_trend_down", tipo: "alerta", prioridad: d <= -8 ? "alta" : "media",
      titulo: `El Cuadro Básico cayó ${Math.abs(d).toFixed(1)} pp vs el promedio de los 3 meses previos`,
      descripcion: `${MES[last.i]} ${fPct(last.v, 1)} vs ${base.map((x) => `${MES[x.i]} ${fPct(x.v, 1)}`).join(", ")}.`,
      acciones: ["Cruzar con quiebres de stock / cambios de surtido del mes", "Revisar si cambió el universo de tiendas relevadas"],
      datos: { mes: MES[last.i], cb: r2(last.v), promedio3m: r2(b), deltaPp: r2(d) },
    });
    else if (d >= 4) S({
      key: "cb_trend_up", tipo: "info", prioridad: "baja",
      titulo: `El Cuadro Básico mejoró ${d.toFixed(1)} pp vs los 3 meses previos`,
      descripcion: `${MES[last.i]} ${fPct(last.v, 1)} vs promedio ${fPct(b, 1)}.`,
      acciones: ["Identificar qué cadenas explican la mejora y replicar la rutina"],
      datos: { cb: r2(last.v), promedio3m: r2(b) },
    });
  }
  return sortSignals(out);
}

// ─────────────────────────── TRADE: FLOOR SHARE ───────────────────────────
export interface FsSignalInput {
  /** Share Drean por categoría (trade_monthly), meses cerrados. Claves: Lavado / Refrigeración / Cocción. */
  fsCat: Record<string, S12>;
  metaCat: Record<string, S12>;
  objetivo?: Record<string, number>;
  /** Vista precalculada (fs_precomputed): share por categoría×marca y por cliente. */
  catBrand?: { marca: string; share: number; unidades?: number; categoria: string }[];
  byCliente?: { cliente: string; total: { share: number; drean_units: number; total_units: number } }[];
  overallShare?: number | null;
}
const FS_CAT_KEY: Record<string, string> = { Lavado: "lavado", "Refrigeración": "refri", "Cocción": "coccion" };
export function computeFsSignals(inp: FsSignalInput): Signal[] {
  const out: Signal[] = [];
  const S = mk(out, "floor-share");
  for (const [cat, serie] of Object.entries(inp.fsCat)) {
    const p = pts(serie);
    const last = p[p.length - 1];
    if (!last) continue;
    const meta = inp.metaCat[cat]?.[last.i] ?? inp.objetivo?.[cat] ?? null;
    const k = (s: string) => `fs_${s}_${FS_CAT_KEY[cat] ?? cat}`;
    if (meta) {
      const gap = last.v - meta;
      if (gap <= -2) S({
        key: k("below_meta"), tipo: "alerta", prioridad: gap <= -5 ? "alta" : "media",
        titulo: `Floor Share ${cat} ${MES[last.i]}: ${fPct(last.v, 1)} vs meta ${fPct(meta, 1)} (${gap.toFixed(1)} pp)`,
        descripcion: `Share de exhibición de Drean en góndola (unidades exhibidas Drean ÷ total relevado).`,
        acciones: [`Negociar exhibición adicional de ${cat} en las cadenas de mayor volumen`, "Revisar qué marca ganó espacio (ranking por categoría)"],
        datos: { categoria: cat, mes: MES[last.i], share: r2(last.v), meta: r2(meta), gapPp: r2(gap) },
        impacto: { metrica: "Puntos de share de góndola hasta la meta", valor: r2(-gap), unidad: "pp" },
      });
    }
    if (p.length >= 4) {
      const b = avg(p.slice(-4, -1).map((x) => x.v));
      const d = last.v - b;
      if (Math.abs(d) >= 1.5) S({
        key: k(d < 0 ? "trend_down" : "trend_up"), tipo: d < 0 ? "alerta" : "info", prioridad: d <= -3 ? "alta" : d < 0 ? "media" : "baja",
        titulo: `Floor Share ${cat}: ${d > 0 ? "+" : ""}${d.toFixed(1)} pp vs el promedio de los 3 meses previos (${fPct(last.v, 1)})`,
        descripcion: `Promedio previo ${fPct(b, 1)}.`,
        acciones: d < 0 ? ["Ver qué cadenas/tiendas explican la caída (tab por cliente)", "Chequear stock de exhibición y material POP"] : ["Sostener lo que explica la suba (acuerdos de exhibición, lanzamientos)"],
        datos: { categoria: cat, share: r2(last.v), promedio3m: r2(b), deltaPp: r2(d) },
      });
    }
  }
  // Líder de góndola por categoría (vista precalculada).
  const cats = [...new Set((inp.catBrand ?? []).map((r) => r.categoria))];
  for (const c of cats) {
    const rows = (inp.catBrand ?? []).filter((r) => r.categoria === c).sort((a, b) => b.share - a.share);
    const own = rows.find((r) => /drean/i.test(r.marca));
    const rival = rows.find((r) => !/drean/i.test(r.marca));
    if (!own || !rival) continue;
    if (rival.share > own.share) S({
      key: `fs_leader_lost_${c}`, tipo: "alerta", prioridad: rival.share - own.share >= 3 ? "alta" : "media",
      titulo: `${rival.marca} lidera la góndola de ${c}: ${fPct(rival.share, 1)} vs ${fPct(own.share, 1)} de Drean`,
      descripcion: `Ranking de exhibición (período del relevamiento precalculado): ${rows.slice(0, 4).map((r) => `${r.marca} ${fPct(r.share, 1)}`).join(" · ")}.`,
      acciones: [`Revisar qué cadenas concentran la exhibición de ${rival.marca}`, "Negociar exhibición en las cadenas donde Drean vende más"],
      datos: { categoria: c, drean: r2(own.share), lider: { marca: rival.marca, share: r2(rival.share) } },
    });
    else if (own.share - rival.share < 2) S({
      key: `fs_leader_tight_${c}`, tipo: "info", prioridad: "media",
      titulo: `Góndola de ${c}: Drean lidera por solo ${(own.share - rival.share).toFixed(1)} pp sobre ${rival.marca}`,
      descripcion: `${fPct(own.share, 1)} vs ${fPct(rival.share, 1)}.`,
      acciones: ["Blindar la exhibición en las cadenas top antes de que el 2° pase adelante"],
      datos: { categoria: c, drean: r2(own.share), segundo: { marca: rival.marca, share: r2(rival.share) } },
    });
  }
  // Clientes (cadenas) con mucho volumen relevado y share Drean bajo.
  const cl = (inp.byCliente ?? []).filter((r) => r.total.total_units > 0);
  if (cl.length >= 5) {
    const ref = inp.overallShare ?? median(cl.map((r) => r.total.share));
    const medUnits = median(cl.map((r) => r.total.total_units));
    const low = cl.filter((r) => r.total.total_units >= medUnits && r.total.share <= ref * 0.7)
      .sort((a, b) => b.total.total_units - a.total.total_units).slice(0, 4);
    if (low.length) S({
      key: "fs_clientes_bajo_share", tipo: "oportunidad", prioridad: "media",
      titulo: `${low.length} cadena${low.length > 1 ? "s" : ""} con mucho volumen de góndola y share Drean ≤ 70% del promedio (${fPct(ref, 1)})`,
      descripcion: low.map((r) => `${clip(r.cliente, 30)}: ${fPct(r.total.share, 1)} (${fInt(r.total.total_units)} u. relevadas)`).join(" · "),
      acciones: ["Priorizar estas cadenas en la negociación de exhibición", "Revisar surtido (Cuadro Básico) en esas cadenas"],
      datos: { referencia: r2(ref), cadenas: low.map((r) => ({ cliente: r.cliente, share: r2(r.total.share), unidades: r.total.total_units })) },
      impacto: { metrica: "Unidades Drean exhibidas si llegaran al promedio", valor: Math.round(sum(low.map((r) => (ref / 100) * r.total.total_units - r.total.drean_units))), unidad: "unidades" },
    });
  }
  return sortSignals(out);
}

// ─────────────────────────── INFLUENCIA / UGC ───────────────────────────
export interface UgcPiece {
  id: string; nombre: string; permalink: string | null;
  spend: number; impresiones: number; clicks: number;
  reactions: number; comments: number; shares: number; saves: number;
  vbase: number; p50: number;
  analysis?: { credibilidad?: string | null; intencion?: string | null; percepcion?: string | null } | null;
}
export interface UgcSignalInput { pieces: UgcPiece[]; brandCpm?: number | null; brandEr?: number | null }
const erOf = (p: UgcPiece) => (p.impresiones > 0 ? ((p.reactions + p.comments + p.shares + p.saves) / p.impresiones) * 100 : 0);
export function computeUgcSignals(inp: UgcSignalInput): Signal[] {
  const out: Signal[] = [];
  const S = mk(out, "influencia");
  const ps = inp.pieces.filter((p) => p.spend > 0 && p.impresiones >= 3000);
  const tot = sum(ps.map((p) => p.spend));
  if (ps.length >= 4 && tot > 0) {
    const medEr = median(ps.map(erOf));
    const sh = (p: UgcPiece) => (p.spend / tot) * 100;
    const star = [...ps].sort((a, b) => erOf(b) - erOf(a))[0]!;
    if (medEr > 0 && erOf(star) >= medEr * 2 && sh(star) < 15) S({
      key: `ugc_piece_star_${star.id}`, tipo: "oportunidad", prioridad: "media",
      titulo: `Pieza UGC con interacción ${(erOf(star) / medEr).toFixed(1)}× la mediana y solo ${fPct(sh(star), 0)} de la inversión UGC`,
      descripcion: `"${clip(star.nombre, 60)}": ${fPct(erOf(star), 2)} de interacciones (reacciones+comentarios+compartidos+guardados) sobre impresiones vs mediana ${fPct(medEr, 2)}. ${fMoney(star.spend)} invertidos.`,
      acciones: ["Subirle presupuesto o duplicarla en las campañas de consideración", "Pedir al creador variantes con el mismo ángulo"],
      datos: { pieza: star.nombre, permalink: star.permalink, er: r2(erOf(star)), medianaEr: r2(medEr), share: r2(sh(star)) },
    });
    const cara = ps.filter((p) => sh(p) >= 10 && erOf(p) <= medEr * 0.5).sort((a, b) => b.spend - a.spend)[0];
    if (cara) S({
      key: `ugc_piece_costly_${cara.id}`, tipo: "alerta", prioridad: "media",
      titulo: `Pieza UGC con ${fPct(sh(cara), 0)} de la inversión e interacción a la mitad de la mediana`,
      descripcion: `"${clip(cara.nombre, 60)}": ER ${fPct(erOf(cara), 2)} vs mediana ${fPct(medEr, 2)} (${fMoney(cara.spend)}).`,
      acciones: ["Rotarla por las piezas UGC de mejor interacción", "Revisar el hook y el encaje producto-creador"],
      datos: { pieza: cara.nombre, er: r2(erOf(cara)), medianaEr: r2(medEr), inversion: Math.round(cara.spend) },
    });
    const vid = ps.filter((p) => p.vbase > 0);
    if (vid.length >= 4) {
      const vtr = (p: UgcPiece) => (p.p50 / p.vbase) * 100;
      const medV = median(vid.map(vtr));
      const weak = vid.filter((p) => vtr(p) <= medV * 0.6 && sh(p) >= 5).sort((a, b) => b.spend - a.spend)[0];
      if (weak) S({
        key: `ugc_vtr_low_${weak.id}`, tipo: "alerta", prioridad: "media",
        titulo: `Video UGC con VTR≥50% de ${fPct(vtr(weak), 1)} (mediana UGC ${fPct(medV, 1)})`,
        descripcion: `"${clip(weak.nombre, 60)}" pierde a la audiencia antes de la mitad. ${fMoney(weak.spend)} invertidos.`,
        acciones: ["Reeditar los primeros 3 segundos con el producto visible", "Probar un corte más corto"],
        datos: { pieza: weak.nombre, vtr50: r2(vtr(weak)), mediana: r2(medV) },
      });
    }
  }
  // UGC vs pauta de marca (misma plataforma Meta).
  if (tot > 0 && inp.brandCpm && inp.brandEr != null) {
    const impr = sum(ps.map((p) => p.impresiones));
    const cpm = impr ? (tot / impr) * 1000 : 0;
    const er = impr ? (sum(ps.map((p) => p.reactions + p.comments + p.shares + p.saves)) / impr) * 100 : 0;
    if (cpm > 0 && er >= inp.brandEr * 1.5) S({
      key: "ugc_vs_brand_engagement", tipo: "oportunidad", prioridad: "media",
      titulo: `El UGC genera ${(er / (inp.brandEr || 1)).toFixed(1)}× la interacción por impresión de la pauta de marca en Meta`,
      descripcion: `UGC: ER ${fPct(er, 2)} con CPM ${fMoney(cpm)}; pauta de marca (Meta, sin UGC): ER ${fPct(inp.brandEr, 2)} con CPM ${fMoney(inp.brandCpm)}.`,
      acciones: ["Usar piezas UGC como creativos de consideración en las campañas de marca", "Medir el efecto en VTR y clicks antes de escalar"],
      datos: { ugc: { er: r2(er), cpm: r2(cpm) }, marca: { er: r2(inp.brandEr), cpm: r2(inp.brandCpm) } },
    });
  }
  // Lectura cualitativa (ugc_piece_analysis): percepción negativa con inversión.
  const neg = inp.pieces.filter((p) => /negativ|baja/i.test(p.analysis?.percepcion ?? "") && p.spend > 0).sort((a, b) => b.spend - a.spend);
  if (neg.length) S({
    key: "ugc_percepcion_negativa", tipo: "alerta", prioridad: neg.length >= 3 ? "alta" : "media",
    titulo: `${neg.length} pieza${neg.length > 1 ? "s" : ""} UGC con percepción de marca negativa/baja en el análisis de comentarios`,
    descripcion: neg.slice(0, 3).map((p) => `"${clip(p.nombre, 40)}" (${fMoney(p.spend)})`).join(" · ") + ". El análisis ya calibra con guardados/compartidos/VTR (no es solo por pocos comentarios).",
    acciones: ["Leer los comentarios de esas piezas en el tab de análisis", "Pausar la amplificación si la crítica es sobre el producto"],
    datos: { piezas: neg.slice(0, 5).map((p) => ({ pieza: p.nombre, inversion: Math.round(p.spend), percepcion: p.analysis?.percepcion })) },
  });
  const altas = inp.pieces.filter((p) => /alta/i.test(p.analysis?.intencion ?? "") && p.spend > 0);
  if (altas.length && tot > 0) {
    const sh = (sum(altas.map((p) => p.spend)) / tot) * 100;
    if (sh < 30) S({
      key: "ugc_intencion_alta_subinvertida", tipo: "oportunidad", prioridad: "media",
      titulo: `Las piezas UGC con intención de compra ALTA reciben solo el ${fPct(sh, 0)} de la inversión UGC`,
      descripcion: `${altas.length} pieza${altas.length > 1 ? "s" : ""} con intención alta según el análisis de comentarios: ${altas.slice(0, 3).map((p) => `"${clip(p.nombre, 35)}"`).join(", ")}.`,
      acciones: ["Reasignar presupuesto UGC hacia esas piezas", "Usarlas en retargeting / consideración"],
      datos: { piezas: altas.length, shareInversion: r2(sh) },
    });
  }
  return sortSignals(out);
}

// ─────────────────────────── MERCADO (GfK) ───────────────────────────
export interface MercadoRowLite { mes: string; categoria: string; segmento: string; marca: string; unit_share: number | null; value_share: number | null }
export function computeMercadoSignals(rows: MercadoRowLite[], ownBrand = "DREAN"): Signal[] {
  const out: Signal[] = [];
  const S = mk(out, "mercado");
  const isOwn = (m: string) => m.trim().toUpperCase() === ownBrand;
  const cats = [...new Set(rows.map((r) => r.categoria))];
  for (const cat of cats) {
    const tot = rows.filter((r) => r.categoria === cat && r.segmento === "Total");
    const meses = [...new Set(tot.map((r) => r.mes))].sort();
    const last = meses[meses.length - 1];
    if (!last) continue;
    const k = (s: string) => `mercado_${s}_${cat}`.replace(/\s+/g, "_");
    const cur = tot.filter((r) => r.mes === last && r.value_share != null && !/others|tradebrands/i.test(r.marca)).sort((a, b) => (b.value_share ?? 0) - (a.value_share ?? 0));
    const own = cur.find((r) => isOwn(r.marca));
    const leader = cur.find((r) => !isOwn(r.marca));
    const ml = last.slice(0, 7);
    if (own && leader) {
      if ((leader.value_share ?? 0) > (own.value_share ?? 0)) S({
        key: k("leader_gap"), tipo: "alerta", prioridad: (leader.value_share ?? 0) - (own.value_share ?? 0) >= 3 ? "alta" : "media",
        titulo: `${cat} (${ml}): ${leader.marca} lidera en valor con ${fPct(leader.value_share ?? 0, 1)} vs ${fPct(own.value_share ?? 0, 1)} de Drean`,
        descripcion: `Ranking value share: ${cur.slice(0, 4).map((r) => `${r.marca} ${fPct(r.value_share ?? 0, 1)}`).join(" · ")}. Unit share Drean ${fPct(own.unit_share ?? 0, 1)}.`,
        acciones: ["Ver en qué segmento (High/Mid/Low) pierde Drean", "Cruzar con Floor Share y Share of Search de la categoría"],
        datos: { categoria: cat, mes: ml, drean: { value: own.value_share, unit: own.unit_share }, lider: { marca: leader.marca, value: leader.value_share } },
      });
      else if ((own.value_share ?? 0) - (leader.value_share ?? 0) < 2) S({
        key: k("leader_tight"), tipo: "info", prioridad: "media",
        titulo: `${cat} (${ml}): Drean lidera en valor por solo ${((own.value_share ?? 0) - (leader.value_share ?? 0)).toFixed(1)} pp sobre ${leader.marca}`,
        descripcion: `${fPct(own.value_share ?? 0, 1)} vs ${fPct(leader.value_share ?? 0, 1)}.`,
        acciones: ["Vigilar el segmento donde crece el 2°"],
        datos: { categoria: cat, drean: own.value_share, segundo: { marca: leader.marca, value: leader.value_share } },
      });
      // Valor vs unidades: vende más barato que su volumen.
      const vs = own.value_share ?? 0, us = own.unit_share ?? 0;
      if (us > 0 && vs < us * 0.9) S({
        key: k("value_below_units"), tipo: "info", prioridad: "baja",
        titulo: `${cat}: Drean tiene ${fPct(us, 1)} de las unidades pero ${fPct(vs, 1)} del valor (precio medio por debajo del mercado)`,
        descripcion: "El mix vendido se concentra en segmentos/modelos de menor precio que el promedio de la categoría.",
        acciones: ["Revisar el share en el segmento High (premium)", "Evaluar comunicación de producto de mayor valor"],
        datos: { categoria: cat, unitShare: us, valueShare: vs },
      });
    }
    // Tendencia 3m (value share propio).
    const serie = meses.map((m) => tot.find((r) => r.mes === m && isOwn(r.marca))?.value_share ?? null);
    const p = pts(serie);
    if (p.length >= 4) {
      const lv = p[p.length - 1]!.v, b = avg(p.slice(-4, -1).map((x) => x.v));
      const d = lv - b;
      if (Math.abs(d) >= 1.5) S({
        key: k(d < 0 ? "share_down" : "share_up"), tipo: d < 0 ? "alerta" : "info", prioridad: d <= -3 ? "alta" : d < 0 ? "media" : "baja",
        titulo: `${cat}: el value share de Drean ${d < 0 ? "cayó" : "subió"} ${Math.abs(d).toFixed(1)} pp vs el promedio de los 3 meses previos (${fPct(lv, 1)})`,
        descripcion: `Promedio previo ${fPct(b, 1)} (GfK mensual).`,
        acciones: d < 0 ? ["Identificar qué marca ganó el share (ranking del mes)", "Cruzar con inversión en pauta y exhibición del período"] : ["Identificar qué palanca lo explica y sostenerla"],
        datos: { categoria: cat, share: r2(lv), promedio3m: r2(b), deltaPp: r2(d) },
      });
    }
    // Segmento débil: share del segmento ≤ 60% del share total.
    if (own?.value_share) {
      for (const seg of ["High", "Mid", "Low"]) {
        const r = rows.find((x) => x.categoria === cat && x.segmento === seg && x.mes === last && isOwn(x.marca));
        if (r?.value_share != null && r.value_share <= own.value_share * 0.6) S({
          key: k(`segment_weak_${seg}`), tipo: "oportunidad", prioridad: seg === "High" ? "media" : "baja",
          titulo: `${cat} · segmento ${seg}: Drean tiene ${fPct(r.value_share, 1)} vs ${fPct(own.value_share, 1)} en el total de la categoría`,
          descripcion: `El segmento ${seg} es donde Drean está más sub-representado (${ml}).`,
          acciones: [`Revisar el portfolio y la comunicación para el segmento ${seg}`, "Cruzar con el share de góndola del segmento"],
          datos: { categoria: cat, segmento: seg, shareSegmento: r.value_share, shareTotal: own.value_share },
        });
      }
    }
  }
  return sortSignals(out);
}

// ─────────────────────────── SALUD DE MARCA (Kantar) ───────────────────────────
export interface KantarVals { tom: number | null; som: number | null; int: number | null; poder: number | null }
export interface SaludSignalInput {
  /** Por categoría (Lavado/Refrigeración/Cocción): marca → ola → valores. */
  kantar: Record<string, Record<string, Record<string, KantarVals>>>;
  waves: string[]; // orden cronológico
  ownBrand?: string;
  /** Value share GfK MAT de Drean por categoría y mes "YYYY-MM" (para el cruce share ↔ equity). */
  shareMat?: Record<string, Record<string, number>>;
}
const DIM_LBL: Record<keyof KantarVals, string> = { tom: "Top of Mind", som: "Share of Mind", int: "Intención de compra", poder: "Poder de Marca" };
const WAVE_MES: Record<string, string> = { nov: "11", jun: "06" };
const waveYm = (w: string) => { const [m, y] = w.split("-"); return `20${y}-${WAVE_MES[m ?? ""] ?? "01"}`; };
export function computeSaludSignals(inp: SaludSignalInput): Signal[] {
  const out: Signal[] = [];
  const S = mk(out, "salud-marca");
  const own = inp.ownBrand ?? "Drean";
  for (const [cat, byBrand] of Object.entries(inp.kantar)) {
    const mine = byBrand[own];
    if (!mine) continue;
    const ws = inp.waves.filter((w) => mine[w] && Object.values(mine[w]!).some((v) => v != null));
    const last = ws[ws.length - 1], prev = ws[ws.length - 2];
    if (!last) continue;
    const k = (s: string) => `salud_${s}_${cat}`.replace(/\s+/g, "_");
    for (const dim of ["tom", "som", "int", "poder"] as (keyof KantarVals)[]) {
      const cur = mine[last]?.[dim], pv = prev ? mine[prev]?.[dim] : null;
      if (cur == null || pv == null) continue;
      const d = cur - pv;
      if (Math.abs(d) >= 3) S({
        key: k(`${dim}_${d < 0 ? "down" : "up"}`), tipo: d < 0 ? "alerta" : "info", prioridad: d <= -5 ? "alta" : d < 0 ? "media" : "baja",
        titulo: `${cat}: ${DIM_LBL[dim]} de Drean ${d < 0 ? "cayó" : "subió"} ${Math.abs(d).toFixed(1)} pts (${prev} ${fPct(pv, 1)} → ${last} ${fPct(cur, 1)})`,
        descripcion: "Kantar (ola vs ola). Es el resultado estratégico que miden los objetivos TOM/SOM/Intención/Poder del Mapa.",
        acciones: d < 0 ? ["Revisar la presión de medios de awareness de la categoría entre olas", "Cruzar con share of search y alcance de pauta del período"] : ["Identificar qué acciones del período lo explican"],
        datos: { categoria: cat, dimension: dim, olaPrevia: prev, previo: pv, ola: last, actual: cur, deltaPts: r2(d) },
      });
    }
    // Brecha vs el competidor mejor posicionado en TOM (misma ola).
    const rivals = Object.entries(byBrand).filter(([b]) => b !== own).map(([b, v]) => ({ marca: b, tom: v[last]?.tom ?? null })).filter((x) => x.tom != null) as { marca: string; tom: number }[];
    const top = rivals.sort((a, b) => b.tom - a.tom)[0];
    const myTom = mine[last]?.tom;
    if (top && myTom != null && top.tom > myTom) S({
      key: k("tom_leader_gap"), tipo: "alerta", prioridad: "alta",
      titulo: `${cat}: ${top.marca} supera a Drean en Top of Mind (${fPct(top.tom, 0)} vs ${fPct(myTom, 0)}, ${last})`,
      descripcion: "Perder el primer lugar en la mente del consumidor anticipa pérdida de share.",
      acciones: ["Aumentar la presión de awareness (video/alcance) en la categoría", "Revisar la consistencia del mensaje de marca"],
      datos: { categoria: cat, ola: last, drean: myTom, lider: top },
    });
    // CRUCE share ↔ equity: el share de mercado sube mientras el TOM cae (o al revés).
    const sm = inp.shareMat?.[cat];
    if (sm && prev) {
      const sL = sm[waveYm(last)], sP = sm[waveYm(prev)];
      const tL = mine[last]?.tom, tP = mine[prev]?.tom;
      if (sL != null && sP != null && tL != null && tP != null) {
        const dS = sL - sP, dT = tL - tP;
        if (dT <= -3 && dS >= 0.5) {
          out.push({
            dash: "salud-marca", cruce: true,
            key: k("cruce_share_up_tom_down"), tipo: "alerta", prioridad: "alta",
            titulo: `${cat}: el share de mercado sube (+${dS.toFixed(1)} pp) pero el Top of Mind cae (${dT.toFixed(1)} pts) entre ${prev} y ${last}`,
            descripcion: "La venta se sostiene por precio/distribución mientras la marca pierde lugar en la mente: el equity se está consumiendo y el share es vulnerable a mediano plazo.",
            acciones: ["Reforzar inversión de awareness en la categoría (no solo conversión)", "Monitorear share of search como indicador adelantado"],
            datos: { categoria: cat, shareMatPrevio: sP, shareMatActual: sL, tomPrevio: tP, tomActual: tL },
          });
        } else if (dT >= 3 && dS <= -0.5) {
          out.push({
            dash: "salud-marca", cruce: true,
            key: k("cruce_tom_up_share_down"), tipo: "oportunidad", prioridad: "media",
            titulo: `${cat}: el Top of Mind sube (+${dT.toFixed(1)} pts) pero el share de mercado cae (${dS.toFixed(1)} pp)`,
            descripcion: "La marca gana mente pero no convierte en venta: el cuello está en precio, surtido o góndola.",
            acciones: ["Revisar Floor Share y Cuadro Básico de la categoría", "Revisar precio relativo (índice de precio GfK)"],
            datos: { categoria: cat, shareMatPrevio: sP, shareMatActual: sL, tomPrevio: tP, tomActual: tL },
          });
        }
      }
    }
  }
  return sortSignals(out);
}

// ─────────────────────────── MKT CANAL (retailers) ───────────────────────────
export interface MktCanalRowLite { cliente: string | null; accion: string | null; mes: string | null; plataforma: string | null; impresiones: number | null; clics: number | null; conversiones: number | null; ingresos: number | null; inversion: number | null }
export function computeMktCanalSignals(rows: MktCanalRowLite[]): Signal[] {
  const out: Signal[] = [];
  const S = mk(out, "mkt-canal");
  const acc = new Map<string, { cliente: string; accion: string; plataforma: string; impr: number; clics: number; inv: number; ing: number; conv: number }>();
  for (const r of rows) {
    const key = `${r.cliente}|${r.accion}|${r.plataforma}`;
    const e = acc.get(key) ?? { cliente: r.cliente ?? "—", accion: r.accion ?? "—", plataforma: r.plataforma ?? "—", impr: 0, clics: 0, inv: 0, ing: 0, conv: 0 };
    e.impr += r.impresiones ?? 0; e.clics += r.clics ?? 0; e.inv += r.inversion ?? 0; e.ing += r.ingresos ?? 0; e.conv += r.conversiones ?? 0;
    acc.set(key, e);
  }
  const all = [...acc.values()].filter((a) => a.impr >= 10_000);
  const ctr = (a: { impr: number; clics: number }) => (a.impr ? (a.clics / a.impr) * 100 : 0);
  for (const plat of [...new Set(all.map((a) => a.plataforma))]) {
    const g = all.filter((a) => a.plataforma === plat);
    if (g.length < 3) continue;
    const med = median(g.map(ctr));
    const best = [...g].sort((a, b) => ctr(b) - ctr(a))[0]!;
    const worst = [...g].sort((a, b) => ctr(a) - ctr(b))[0]!;
    if (med > 0 && ctr(best) >= med * 1.8) S({
      key: `mktcanal_best_${plat}_${best.cliente}`.replace(/\s+/g, "_"), tipo: "oportunidad", prioridad: "media",
      titulo: `${best.cliente} · "${clip(best.accion, 40)}" (${plat}): CTR ${fPct(ctr(best), 2)}, ${(ctr(best) / med).toFixed(1)}× la mediana de las acciones en ${plat}`,
      descripcion: `${fNum(best.impr)} impresiones y ${fNum(best.clics)} clics. Mediana ${fPct(med, 2)} sobre ${g.length} acciones.`,
      acciones: ["Replicar la mecánica/creatividad en otros retailers", "Negociar más inventario con ese retailer"],
      datos: { cliente: best.cliente, accion: best.accion, plataforma: plat, ctr: r2(ctr(best)), mediana: r2(med) },
    });
    if (med > 0 && worst !== best && ctr(worst) <= med * 0.4) S({
      key: `mktcanal_worst_${plat}_${worst.cliente}`.replace(/\s+/g, "_"), tipo: "alerta", prioridad: "baja",
      titulo: `${worst.cliente} · "${clip(worst.accion, 40)}" (${plat}): CTR ${fPct(ctr(worst), 2)} vs mediana ${fPct(med, 2)}`,
      descripcion: `${fNum(worst.impr)} impresiones, ${fNum(worst.clics)} clics.`,
      acciones: ["Revisar creatividad y segmentación con el retailer antes de renovar"],
      datos: { cliente: worst.cliente, accion: worst.accion, plataforma: plat, ctr: r2(ctr(worst)), mediana: r2(med) },
    });
  }
  // ROAS (solo donde el retailer informa inversión e ingresos).
  const roas = [...acc.values()].filter((a) => a.inv > 0 && a.ing > 0);
  if (roas.length >= 3) {
    const r = (a: { inv: number; ing: number }) => a.ing / a.inv;
    const med = median(roas.map(r));
    const low = roas.filter((a) => r(a) <= med * 0.5).sort((a, b) => b.inv - a.inv)[0];
    if (low) S({
      key: `mktcanal_roas_low_${low.cliente}`.replace(/\s+/g, "_"), tipo: "alerta", prioridad: "media",
      titulo: `${low.cliente} · "${clip(low.accion, 40)}": ROAS ${r(low).toFixed(1)}x vs mediana ${med.toFixed(1)}x`,
      descripcion: `Inversión ${fMoney(low.inv)}, ingresos ${fMoney(low.ing)}.`,
      acciones: ["Reasignar a las acciones con ROAS sobre la mediana"],
      datos: { cliente: low.cliente, accion: low.accion, roas: r2(r(low)), mediana: r2(med) },
    });
  }
  const conDatos = rows.filter((x) => (x.impresiones ?? 0) > 0).length;
  const sinInv = rows.filter((x) => (x.impresiones ?? 0) > 0 && !(x.inversion ?? 0)).length;
  if (conDatos >= 5 && sinInv / conDatos >= 0.5) S({
    key: "mktcanal_sin_inversion", tipo: "info", prioridad: "baja",
    titulo: `${fPct((sinInv / conDatos) * 100, 0)} de las acciones en retailers no informan inversión ni ingresos`,
    descripcion: "Sin esos datos no se puede calcular ROAS ni comparar eficiencia entre retailers; solo CTR.",
    acciones: ["Pedir a los retailers inversión e ingresos atribuidos en el reporte de cierre de cada acción"],
    datos: { acciones: conDatos, sinInversion: sinInv },
  });
  return sortSignals(out);
}

// ─────────────────────────── PERFORMANCE-CONVERSIÓN (ecommerce inhouse) ───────────────────────────
export interface ConvMes { mesIdx: number; costo: number; compras: number; ingresos: number; clicks: number }
export interface ConvCampania { campania: string; costo: number; compras: number; ingresos: number }
export interface ConvSignalInput { mensual: ConvMes[]; campanias: ConvCampania[] }
export function computeConversionSignals(inp: ConvSignalInput): Signal[] {
  const out: Signal[] = [];
  const S = mk(out, "performance-conversion");
  const mo = inp.mensual.filter((m) => m.costo > 0).sort((a, b) => a.mesIdx - b.mesIdx);
  if (mo.length >= 4) {
    const last = mo[mo.length - 1]!, base = mo.slice(-4, -1);
    const roas = (m: ConvMes) => (m.costo ? m.ingresos / m.costo : 0);
    const cpa = (m: ConvMes) => (m.compras ? m.costo / m.compras : 0);
    const dR = deltaPct(roas(last), avg(base.map(roas)));
    if (dR != null && dR <= -20) S({
      key: "conv_roas_drop", tipo: "alerta", prioridad: dR <= -35 ? "alta" : "media",
      titulo: `${MES[last.mesIdx]}: el ROAS de la pauta de ecommerce bajó ${fDelta(dR)} (${roas(last).toFixed(1)}x vs ${avg(base.map(roas)).toFixed(1)}x)`,
      descripcion: `Costo ${fMoney(last.costo)}, ${fInt(last.compras)} compras, ingresos ${fMoney(last.ingresos)} (GA4, campañas inhouse).`,
      acciones: ["Revisar qué campañas explican la caída (tabla por campaña)", "Chequear precio/stock de los productos más vendidos"],
      datos: { mes: MES[last.mesIdx], roas: r2(roas(last)), promedio3m: r2(avg(base.map(roas))), deltaPct: r2(dR) },
    });
    else if (dR != null && dR >= 20) S({
      key: "conv_roas_up", tipo: "info", prioridad: "baja",
      titulo: `${MES[last.mesIdx]}: el ROAS mejoró ${fDelta(dR)} (${roas(last).toFixed(1)}x)`,
      descripcion: `Promedio previo ${avg(base.map(roas)).toFixed(1)}x.`,
      acciones: ["Evaluar escalar presupuesto mientras el ROAS se sostenga"],
      datos: { roas: r2(roas(last)), deltaPct: r2(dR) },
    });
    const dC = deltaPct(cpa(last), avg(base.map(cpa)));
    if (dC != null && dC >= 25 && last.compras > 0) S({
      key: "conv_cpa_up", tipo: "alerta", prioridad: "media",
      titulo: `${MES[last.mesIdx]}: el costo por compra subió ${fDelta(dC)} (${fMoney(cpa(last))})`,
      descripcion: `Promedio de los 3 meses previos ${fMoney(avg(base.map(cpa)))}.`,
      acciones: ["Revisar términos de búsqueda y audiencias de las campañas más caras"],
      datos: { cpa: r2(cpa(last)), promedio3m: r2(avg(base.map(cpa))), deltaPct: r2(dC) },
    });
  }
  const cs = inp.campanias.filter((c) => c.costo > 0);
  const tot = sum(cs.map((c) => c.costo));
  if (cs.length >= 3 && tot > 0) {
    const roas = (c: ConvCampania) => c.ingresos / c.costo;
    const med = median(cs.map(roas));
    const sh = (c: ConvCampania) => (c.costo / tot) * 100;
    const worst = cs.filter((c) => sh(c) >= 10 && roas(c) <= med * 0.5).sort((a, b) => b.costo - a.costo)[0];
    const best = cs.filter((c) => sh(c) < 15 && roas(c) >= med * 1.8 && c.compras >= 3).sort((a, b) => roas(b) - roas(a))[0];
    if (worst && best) {
      const mover = worst.costo * 0.2;
      S({
        key: "conv_realloc", tipo: "oportunidad", prioridad: "alta",
        titulo: `Mover ${fMoney(mover)} de "${clip(worst.campania, 35)}" (ROAS ${roas(worst).toFixed(1)}x) a "${clip(best.campania, 35)}" (${roas(best).toFixed(1)}x)`,
        descripcion: `Ingreso adicional estimado ≈${fMoney(mover * (roas(best) - roas(worst)))} con el mismo costo (supuesto: ROAS marginal estable). Mediana de ROAS por campaña ${med.toFixed(1)}x.`,
        acciones: [`Reducir "${clip(worst.campania, 35)}" 20%`, `Escalar "${clip(best.campania, 35)}" y controlar el ROAS semanal`],
        datos: { desde: { campania: worst.campania, roas: r2(roas(worst)), costo: Math.round(worst.costo) }, hacia: { campania: best.campania, roas: r2(roas(best)), costo: Math.round(best.costo) } },
        impacto: { metrica: "Ingresos adicionales estimados", valor: Math.round(mover * (roas(best) - roas(worst))), unidad: "$" },
      });
    } else if (worst) S({
      key: "conv_campaign_low_roas", tipo: "alerta", prioridad: "media",
      titulo: `"${clip(worst.campania, 45)}" concentra ${fPct(sh(worst), 0)} del costo con ROAS ${roas(worst).toFixed(1)}x (mediana ${med.toFixed(1)}x)`,
      descripcion: `Costo ${fMoney(worst.costo)}, ingresos ${fMoney(worst.ingresos)}.`,
      acciones: ["Revisar segmentación/pujas o pausar"],
      datos: { campania: worst.campania, roas: r2(roas(worst)), mediana: r2(med) },
    });
  }
  return sortSignals(out);
}

// ─────────────────────────── INVERSIÓN DE MARKETING (BGT) ───────────────────────────
export interface CuatriLite { id: string; label: string; estado: string; bgtAvailable: boolean; bgtLabel: string; coverage: string | null; bgtVal: number; realVal: number; desvio: number | null; invFact: number | null; evaluable: boolean }
export function computeInversionSignals(cuatris: CuatriLite[], opts: { maxDesvio: number; maxInvFact: number }): Signal[] {
  const out: Signal[] = [];
  const S = mk(out, "funnel");
  const usd = (v: number) => fMoney(v, "USD");
  for (const c of cuatris) {
    if (!c.evaluable) continue;
    const per = `${c.id} (${c.coverage ?? c.label})`;
    if (!c.bgtAvailable) {
      if (c.estado !== "futuro") S({
        key: `inv_bgt_missing_${c.id}`, tipo: "info", prioridad: "media",
        titulo: `${per}: la versión de presupuesto "${c.bgtLabel}" no está cargada`,
        descripcion: `Real ejecutado ${usd(c.realVal)} sin BGT vigente contra qué compararlo.`,
        acciones: ["Cargar la versión de BGT en SharePoint para que sincronice"],
        datos: { cuatrimestre: c.id, version: c.bgtLabel },
      });
      continue;
    }
    if (c.desvio != null && c.desvio >= opts.maxDesvio) S({
      key: `inv_sobre_ejecucion_${c.id}`, tipo: "alerta", prioridad: c.desvio >= opts.maxDesvio * 2 ? "alta" : "media",
      titulo: `${per}: sobre-ejecución de ${fPct(c.desvio, 1)} vs ${c.bgtLabel} (tope ${fPct(opts.maxDesvio, 0)})`,
      descripcion: `Real ${usd(c.realVal)} vs BGT ${usd(c.bgtVal)}.`,
      acciones: ["Ver en el comparador qué cuentas/conceptos explican el desvío", "Ajustar el plan de los meses que quedan del cuatrimestre"],
      datos: { cuatrimestre: c.id, real: Math.round(c.realVal), bgt: Math.round(c.bgtVal), desvioPct: r2(c.desvio) },
      impacto: { metrica: "Sobre-ejecución vs BGT", valor: Math.round(c.realVal - c.bgtVal), unidad: "USD" },
    });
    else if (c.desvio != null && c.desvio <= -15) S({
      key: `inv_sub_ejecucion_${c.id}`, tipo: "info", prioridad: "media",
      titulo: `${per}: sub-ejecución de ${fPct(Math.abs(c.desvio), 1)} vs ${c.bgtLabel}`,
      descripcion: `Real ${usd(c.realVal)} vs BGT ${usd(c.bgtVal)}. Presupuesto disponible que puede ir a la mayor palanca del Seguimiento.`,
      acciones: ["Confirmar si es timing (facturas pendientes) o ahorro real", "Reasignar a los KPIs con más brecha"],
      datos: { cuatrimestre: c.id, real: Math.round(c.realVal), bgt: Math.round(c.bgtVal), desvioPct: r2(c.desvio) },
    });
    if (c.invFact != null && c.invFact > opts.maxInvFact) S({
      key: `inv_fact_alta_${c.id}`, tipo: "alerta", prioridad: "media",
      titulo: `${per}: Inversión/Facturación ${fPct(c.invFact, 2)} (tope ${fPct(opts.maxInvFact, 1)})`,
      descripcion: `La inversión de marketing crece más rápido que la facturación del período.`,
      acciones: ["Revisar el ritmo de inversión vs la venta del cuatrimestre"],
      datos: { cuatrimestre: c.id, invFact: r2(c.invFact), tope: opts.maxInvFact },
    });
  }
  return sortSignals(out);
}
