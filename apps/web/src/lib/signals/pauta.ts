// Señales de PLAN DE MEDIOS (Meta Ads + Google Ads). Port de pauta-insights + el motor
// inline de Drean (eficiencia por medio, CPM efectivo por VTR, reasignación con ganancia
// cuantificada, frecuencia, CTR bajo, video desperdiciado) + la spec de alertas
// (docs/alertas-plan-medios.md de Drean): CPCV como métrica madre, benchmark = lo MEJOR propio
// (cuartil superior), outliers vs la mediana del bucket (3× / 8×), gasto sin resultados y
// ritmo de gasto. Lo que la spec pide y la data de BIP no trae (días activos por pieza →
// burst/burn rate; presupuesto plan → sobre/sub-ejecución) queda afuera a propósito.
// Medios OFFLINE (planilla): las reglas de arriba corren SOLO sobre campañas digitales (las filas
// offline no tienen impresiones/clicks/VTR); las offline tienen su bloque (offlineSignals): CPM de
// contactos vs mediana, concentración en un medio, costo por GRP fuera de rango, meses con offline
// sin soporte digital y share offline vs el histórico propio.
// Puro y client-safe (lo usa también el tab Insights de /performance sin IA).
import type { PautaFull, CampaignRow, CreativeRow, PautaMonth } from "./model";
import { type Signal, sortSignals, median, quantile, sum, avg, deltaPct, fInt, fNum, fPct, fDelta, fMoney, clip, r2 } from "./types";

export type Rol = "Awareness" | "Consideración" | "Conversión";
// Mismo criterio que el tablero (performance-tabs rolDe): objetivo de Meta o tipo de campaña de Google.
export function rolDe(obj: string | null | undefined): Rol {
  const o = (obj ?? "").toUpperCase();
  if (/SALE|CONVERSION|CATALOG|LEAD|PURCHASE|PERFORMANCE_MAX|SHOPPING/.test(o)) return "Conversión";
  if (/AWARENESS|REACH|BRAND|VIDEO|VIEW|DISPLAY/.test(o)) return "Awareness";
  return "Consideración";
}
export const medioDe = (c: { medio?: string }) => c.medio ?? "Meta";
const invDig = (m: PautaMonth) => Math.max(0, m.inv - (m.invOff ?? 0));
const isSearch = (c: CampaignRow) => /SEARCH/i.test(c.objective ?? "");
const cpcvOf = (c: { spend: number; p100: number }) => (c.p100 > 0 ? c.spend / c.p100 : 0);

export interface MedioAgg { medio: string; spend: number; impressions: number; clicks: number; reach: number; p50: number; p100: number; vbase: number; cpm: number; cpc: number; ctr: number; vtr50: number; cpcv: number; campañas: number }
export function aggBy(camps: CampaignRow[], keyOf: (c: CampaignRow) => string): MedioAgg[] {
  const m = new Map<string, MedioAgg>();
  for (const c of camps) {
    const k = keyOf(c);
    const a = m.get(k) ?? { medio: k, spend: 0, impressions: 0, clicks: 0, reach: 0, p50: 0, p100: 0, vbase: 0, cpm: 0, cpc: 0, ctr: 0, vtr50: 0, cpcv: 0, campañas: 0 };
    a.spend += c.spend; a.impressions += c.impressions; a.clicks += c.clicks; a.reach += c.reach; a.p50 += c.p50; a.p100 += c.p100; a.vbase += c.vbase; a.campañas++;
    m.set(k, a);
  }
  return [...m.values()].map((a) => ({ ...a, cpm: a.impressions ? (a.spend / a.impressions) * 1000 : 0, cpc: a.clicks ? a.spend / a.clicks : 0, ctr: a.impressions ? (a.clicks / a.impressions) * 100 : 0, vtr50: a.vbase ? (a.p50 / a.vbase) * 100 : 0, cpcv: a.p100 ? a.spend / a.p100 : 0 })).sort((a, b) => b.spend - a.spend);
}

export function computePautaSignals(pauta: PautaFull | null | undefined, opts?: { now?: Date }): Signal[] {
  const out: Signal[] = [];
  if (!pauta || pauta.ok === false) return out;
  const S = (s: Omit<Signal, "dash">) => out.push({ ...s, dash: "performance" });
  const cur = pauta.currency;
  const $ = (v: number) => fMoney(v, cur);
  const now = opts?.now ?? new Date();
  offlineSignals(pauta, S, now);
  // Con monedas distintas, las reglas que comparan montos corren solo sobre Meta (la moneda del tablero).
  // Solo DIGITAL: las filas offline no tienen impresiones/clicks/VTR.
  const camps = (pauta.byCampaign ?? []).filter((c) => !c.offline && c.spend > 0 && (!pauta.mixedCurrency || medioDe(c) === "Meta"));
  const total = sum(camps.map((c) => c.spend));
  if (!camps.length || total <= 0) return sortSignals(out);
  const share = (c: { spend: number }) => (c.spend / total) * 100;
  const sig = (c: CampaignRow) => share(c) >= 2; // campañas con peso suficiente para opinar
  const tag = (c: CampaignRow) => `${medioDe(c)} · ${rolDe(c.objective)}`;

  // ── 1. VIDEO — CPCV (costo por vista completa) como métrica madre ──
  const vid = camps.filter((c) => c.vbase > 0 && c.p100 > 0 && sig(c));
  if (vid.length >= 3) {
    const cpcvs = vid.map(cpcvOf);
    const med = median(cpcvs);
    const best = quantile(cpcvs, 0.25); // benchmark = cuartil más eficiente propio
    for (const c of vid) {
      const x = cpcvOf(c) / med;
      if (x >= 3) S({
        key: `pauta_cpcv_outlier_${c.id}`, tipo: "alerta", prioridad: x >= 8 ? "alta" : "media",
        titulo: `"${clip(c.name, 50)}": cada vista completa cuesta ${x.toFixed(1)}× la mediana (CPCV ${$(cpcvOf(c))})`,
        descripcion: `${tag(c)}. Invirtió ${$(c.spend)} (${fPct(share(c), 0)} del total) para ${fInt(c.p100)} vistas completas; VTR ${fPct(c.vtr100, 1)}. Mediana de CPCV de tus campañas de video: ${$(med)}; el cuartil más eficiente: ${$(best)}.`,
        acciones: ["Revisar formato (¿salteable?, duración) y el hook de los primeros segundos", "Bajar presupuesto y moverlo a las campañas de CPCV más bajo", "Si el video es forzado y completa poco, revisar el tagging / tráfico inválido"],
        datos: { campaña: c.name, medio: medioDe(c), rol: rolDe(c.objective), cpcv: r2(cpcvOf(c)), medianaCpcv: r2(med), benchmarkP25: r2(best), inversion: Math.round(c.spend), vistasCompletas: c.p100 },
        impacto: { metrica: "Vistas completas adicionales al costo mediano", valor: Math.round(c.spend / med - c.p100), unidad: "vistas completas" },
      });
    }
    // Reasignación (port Drean): peor → mejor CPCV, mover 30%.
    const byEff = [...vid].sort((a, b) => cpcvOf(a) - cpcvOf(b));
    const b = byEff[0]!, w = byEff[byEff.length - 1]!;
    if (w !== b && cpcvOf(w) > cpcvOf(b) * 1.5) {
      const mover = w.spend * 0.3;
      const gain = mover / cpcvOf(b) - mover / cpcvOf(w);
      S({
        key: "pauta_realloc_video", tipo: "oportunidad", prioridad: "alta",
        titulo: `Mover ${$(mover)} de "${clip(w.name, 40)}" a "${clip(b.name, 40)}" suma ≈${fNum(gain)} vistas completas al mismo costo`,
        descripcion: `CPCV ${$(cpcvOf(w))} vs ${$(cpcvOf(b))} (${(cpcvOf(w) / cpcvOf(b)).toFixed(1)}× más caro). "${clip(w.name, 40)}" concentra ${fPct(share(w), 0)} de la inversión. Supuesto: el costo marginal se mantiene (validar inventario/audiencia antes de escalar).`,
        acciones: [`Reducir "${clip(w.name, 40)}" un 30%`, `Subir "${clip(b.name, 40)}" en ${$(mover)} y monitorear que el CPCV no se degrade`],
        datos: { desde: { campaña: w.name, cpcv: r2(cpcvOf(w)), inversion: Math.round(w.spend) }, hacia: { campaña: b.name, cpcv: r2(cpcvOf(b)), inversion: Math.round(b.spend) }, mover: Math.round(mover) },
        impacto: { metrica: "Vistas completas adicionales", valor: Math.round(gain), unidad: "vistas completas" },
      });
    }
    // Escalables: CPCV en el cuartil más eficiente y < 12% del gasto.
    for (const c of vid) if (cpcvOf(c) <= best && share(c) < 12 && c !== b) S({
      key: `pauta_scalable_video_${c.id}`, tipo: "oportunidad", prioridad: "media",
      titulo: `"${clip(c.name, 50)}": video eficiente (CPCV ${$(cpcvOf(c))}) con solo ${fPct(share(c), 0)} de la inversión`,
      descripcion: `Está en el cuartil más eficiente de tus campañas de video (VTR ${fPct(c.vtr100, 1)}). Hay margen para escalar.`,
      acciones: ["Subir el presupuesto 30-50% por etapas", "Vigilar frecuencia y CPCV al escalar"],
      datos: { campaña: c.name, cpcv: r2(cpcvOf(c)), share: r2(share(c)) },
      impacto: { metrica: "Vistas completas adicionales con +50% de inversión", valor: Math.round(c.p100 * 0.5), unidad: "vistas completas" },
    });
    // Hook débil: retención al 25% muy por debajo de las demás.
    const ret = vid.filter((c) => c.p25 > 0).map((c) => ({ c, r: c.p25 / c.vbase }));
    if (ret.length >= 3) {
      const mr = median(ret.map((x) => x.r));
      const weak = ret.filter((x) => x.r <= mr * 0.5).sort((a, b) => b.c.spend - a.c.spend)[0];
      if (weak) S({
        key: `pauta_hook_weak_${weak.c.id}`, tipo: "alerta", prioridad: "media",
        titulo: `"${clip(weak.c.name, 50)}": solo ${fPct(weak.r * 100, 0)} llega al 25% del video (mediana ${fPct(mr * 100, 0)})`,
        descripcion: "La caída ocurre antes del primer cuarto: el problema es el hook/apertura, no la duración.",
        acciones: ["Reeditar los primeros 2-3 segundos (producto/beneficio al inicio)", "Probar versiones más cortas"],
        datos: { campaña: weak.c.name, retencion25: r2(weak.r * 100), mediana: r2(mr * 100) },
      });
    }
  }

  // ── 2. Video desperdiciado (total) ──
  const t = pauta.totals;
  const vbase = t.vbase ?? 0;
  if (vbase > 0 && t.p50 >= 0) {
    const vtr50 = (t.p50 / vbase) * 100;
    if (vtr50 < 50) {
      const vidSpend = sum(camps.filter((c) => c.vbase > 0).map((c) => c.spend));
      S({
        key: "pauta_video_waste", tipo: "alerta", prioridad: vtr50 < 30 ? "alta" : "media",
        titulo: `${fPct(100 - vtr50, 0)} de las impresiones de video no llega a la mitad`,
        descripcion: `VTR≥50% total ${fPct(vtr50, 1)} sobre ${fNum(vbase)} impresiones de video. Aproximadamente ${$(vidSpend * (1 - vtr50 / 100))} de la inversión en video se va en impresiones que no se ven hasta la mitad.`,
        acciones: ["Priorizar formatos cortos o no salteables", "Mover presupuesto a las campañas de mejor VTR", "Revisar los primeros segundos de las piezas con peor retención"],
        datos: { vtr50: r2(vtr50), impresionesVideo: vbase, inversionVideo: Math.round(vidSpend) },
        impacto: { metrica: "Inversión en video que no llega al 50%", valor: Math.round(vidSpend * (1 - vtr50 / 100)), unidad: cur ?? "$" },
      });
    }
  }

  // ── 3. CPM fuera de rango dentro de su medio × rol (Awareness) ──
  const aw = camps.filter((c) => rolDe(c.objective) === "Awareness" && c.impressions > 0 && sig(c));
  for (const [k, group] of groupBy(aw, (c) => medioDe(c))) {
    if (group.length < 3) continue;
    const med = median(group.map((c) => c.cpm));
    for (const c of group) {
      const d = deltaPct(c.cpm, med) ?? 0;
      if (d > 25) S({
        key: `pauta_cpm_outlier_${c.id}`, tipo: "alerta", prioridad: d > 50 ? "alta" : "media",
        titulo: `"${clip(c.name, 50)}": CPM ${$(c.cpm)}, ${fDelta(d)} sobre la mediana de Awareness en ${k}`,
        descripcion: `Invirtió ${$(c.spend)} para ${fNum(c.impressions)} impresiones. Mediana de CPM de tus campañas de Awareness en ${k}: ${$(med)}.`,
        acciones: ["Revisar segmentación (audiencias muy chicas encarecen el CPM)", "Revisar ubicaciones y calidad del creativo", "Mover parte del presupuesto a las campañas de CPM más bajo"],
        datos: { campaña: c.name, medio: k, cpm: r2(c.cpm), medianaCpm: r2(med), inversion: Math.round(c.spend) },
        impacto: { metrica: "Impresiones adicionales al CPM mediano", valor: Math.round((c.spend / med) * 1000 - c.impressions), unidad: "impresiones" },
      });
    }
  }

  // ── 4. Clicks: reasignación entre campañas de Consideración (CPC) ──
  const cons = camps.filter((c) => rolDe(c.objective) === "Consideración" && c.clicks >= 100 && share(c) >= 3);
  if (cons.length >= 2) {
    const byCpc = [...cons].sort((a, b) => a.cpc - b.cpc);
    const b = byCpc[0]!, w = byCpc[byCpc.length - 1]!;
    if (w.cpc > b.cpc * 1.5) {
      const mover = w.spend * 0.3;
      const gain = mover / b.cpc - mover / w.cpc;
      S({
        key: "pauta_realloc_clicks", tipo: "oportunidad", prioridad: "alta",
        titulo: `Mover ${$(mover)} de "${clip(w.name, 40)}" a "${clip(b.name, 40)}" suma ≈${fNum(gain)} clicks`,
        descripcion: `CPC ${$(w.cpc)} (${medioDe(w)}) vs ${$(b.cpc)} (${medioDe(b)}) — ${(w.cpc / b.cpc).toFixed(1)}× más caro. Supuesto: costo marginal estable; validar calidad del tráfico (conversión en la web) antes de mover.`,
        acciones: [`Reducir "${clip(w.name, 40)}" un 30%`, `Escalar "${clip(b.name, 40)}" y controlar CPC y tasa de conversión en la web`],
        datos: { desde: { campaña: w.name, cpc: r2(w.cpc), ctr: r2(w.ctr) }, hacia: { campaña: b.name, cpc: r2(b.cpc), ctr: r2(b.ctr) }, mover: Math.round(mover) },
        impacto: { metrica: "Clicks adicionales", valor: Math.round(gain), unidad: "clicks" },
      });
    }
    const p25 = quantile(cons.map((c) => c.cpc), 0.25);
    for (const c of cons) if (c.cpc <= p25 && share(c) < 12 && c !== b) S({
      key: `pauta_scalable_clicks_${c.id}`, tipo: "oportunidad", prioridad: "media",
      titulo: `"${clip(c.name, 50)}": CPC ${$(c.cpc)} (cuartil más eficiente) con solo ${fPct(share(c), 0)} de la inversión`,
      descripcion: `CTR ${fPct(c.ctr, 2)}. Candidata a escalar.`,
      acciones: ["Subir presupuesto 30-50% por etapas", "Controlar que el CPC no suba más de 20%"],
      datos: { campaña: c.name, cpc: r2(c.cpc), share: r2(share(c)) },
      impacto: { metrica: "Clicks adicionales con +50% de inversión", valor: Math.round(c.clicks * 0.5), unidad: "clicks" },
    });
  }

  // ── 5. CTR bajo (tráfico): Search < 2%; resto de Consideración < 0,6% (🔴 < 0,3%) ──
  for (const c of camps) {
    if (c.impressions < 10_000 || rolDe(c.objective) !== "Consideración") continue;
    const lim = isSearch(c) ? 2 : 0.6;
    if (c.ctr < lim) S({
      key: `pauta_ctr_low_${c.id}`, tipo: "alerta", prioridad: (!isSearch(c) && c.ctr < 0.3) || (isSearch(c) && c.ctr < 1) ? "alta" : "media",
      titulo: `"${clip(c.name, 50)}": CTR ${fPct(c.ctr, 2)} en una campaña de tráfico (referencia ≥ ${fPct(lim, 1)})`,
      descripcion: `${fNum(c.impressions)} impresiones y ${fInt(c.clicks)} clicks. ${isSearch(c) ? "En Search un CTR bajo indica keywords/anuncios poco relevantes." : "Creativo o segmentación con poca afinidad."}`,
      acciones: isSearch(c) ? ["Revisar términos de búsqueda y negativas", "Mejorar la relevancia de los anuncios (títulos con la keyword)"] : ["A/B test de creativo y copy", "Acotar la segmentación", "Probar otro formato (carrusel / video corto)"],
      datos: { campaña: c.name, medio: medioDe(c), ctr: r2(c.ctr), referencia: lim, impresiones: c.impressions },
    });
  }

  // ── 6. Frecuencia (saturación): Awareness/Consideración > 4 (🔴 > 6); Conversión > 8 ──
  for (const c of camps) {
    if (!(c.reach > 0) || !(c.frequency > 0) || !sig(c)) continue;
    const rol = rolDe(c.objective);
    const [lim, alto] = rol === "Conversión" ? [8, 12] : [4, 6];
    if (c.frequency > lim) S({
      key: `pauta_frequency_high_${c.id}`, tipo: "alerta", prioridad: c.frequency > alto ? "alta" : "media",
      titulo: `"${clip(c.name, 50)}": frecuencia ${c.frequency.toFixed(1)} — riesgo de saturación`,
      descripcion: `${rol}: cada persona alcanzada vio el aviso ${c.frequency.toFixed(1)} veces en promedio (${fNum(c.reach)} de alcance). Rendimientos decrecientes y posible rechazo.`,
      acciones: ["Ampliar la audiencia o sumar exclusiones", "Rotar creativos (variantes con otros hooks)", "Poner tope de frecuencia"],
      datos: { campaña: c.name, frecuencia: r2(c.frequency), alcance: c.reach, rol },
      impacto: { metrica: `Impresiones por encima de frecuencia ${lim}`, valor: Math.round(c.impressions - c.reach * lim), unidad: "impresiones" },
    });
  }

  // ── 7. Gasto sin resultados (mal configurada) ──
  for (const c of camps) {
    if (share(c) < 1) continue;
    if (c.clicks === 0 && c.p100 === 0 && (c.reach === 0 || c.impressions < 1000)) S({
      key: `pauta_spend_no_results_${c.id}`, tipo: "alerta", prioridad: "alta",
      titulo: `"${clip(c.name, 50)}" gastó ${$(c.spend)} sin clicks ni vistas completas`,
      descripcion: `${fNum(c.impressions)} impresiones, 0 clicks, 0 vistas completas. Probable error de configuración (tracking, ubicaciones o puja).`,
      acciones: ["Revisar la configuración de la campaña y el píxel/etiquetas", "Pausar hasta corregir"],
      datos: { campaña: c.name, inversion: Math.round(c.spend), impresiones: c.impressions },
      impacto: { metrica: "Inversión sin resultado medible", valor: Math.round(c.spend), unidad: cur ?? "$" },
    });
  }

  // ── 8. Meta vs Google (misma moneda): eficiencia por medio ──
  if (!pauta.mixedCurrency) {
    const byMedio = aggBy(camps, medioDe);
    const meta = byMedio.find((m) => m.medio === "Meta"), goog = byMedio.find((m) => m.medio === "Google");
    if (meta && goog && meta.clicks >= 100 && goog.clicks >= 100) {
      const [hi, lo] = meta.cpc > goog.cpc ? [meta, goog] : [goog, meta];
      if (hi.cpc >= lo.cpc * 1.5) {
        const mover = hi.spend * 0.2;
        S({
          key: "pauta_medio_cpc_gap", tipo: "oportunidad", prioridad: "media",
          titulo: `${lo.medio} trae clicks ${(hi.cpc / lo.cpc).toFixed(1)}× más baratos que ${hi.medio} (CPC ${$(lo.cpc)} vs ${$(hi.cpc)})`,
          descripcion: `${hi.medio}: ${$(hi.spend)} y ${fNum(hi.clicks)} clicks (CTR ${fPct(hi.ctr, 2)}). ${lo.medio}: ${$(lo.spend)} y ${fNum(lo.clicks)} clicks (CTR ${fPct(lo.ctr, 2)}). Ojo: el rol de cada medio no es el mismo (Search capta demanda; Meta la genera) — comparar también la conversión en la web.`,
          acciones: [`Si el objetivo es tráfico, mover ~20% (${$(mover)}) de ${hi.medio} a ${lo.medio}`, "Cruzar con la tasa de conversión por canal en Web antes de decidir"],
          datos: { medios: byMedio.map((m) => ({ medio: m.medio, inversion: Math.round(m.spend), cpm: r2(m.cpm), cpc: r2(m.cpc), ctr: r2(m.ctr), cpcv: r2(m.cpcv) })) },
          impacto: { metrica: "Clicks adicionales (20% reasignado)", valor: Math.round(mover / lo.cpc - mover / hi.cpc), unidad: "clicks" },
        });
      }
    }
  }

  // ── 9. Concentración del presupuesto ──
  if (camps.length >= 3) {
    const sorted = [...camps].sort((a, b) => b.spend - a.spend);
    const top = sorted[0]!;
    if (share(top) > 50) S({
      key: "pauta_budget_concentration", tipo: "alerta", prioridad: "media",
      titulo: `"${clip(top.name, 50)}" concentra ${fPct(share(top), 0)} de la inversión`,
      descripcion: `Dependencia de una sola campaña: si se fatiga o encarece, arrastra todo el plan. Las otras ${camps.length - 1} campañas suman ${fPct(100 - share(top), 0)}.`,
      acciones: ["Diversificar con 1-2 campañas de prueba (otros formatos/audiencias)", "Monitorear frecuencia y CPM de la campaña principal semana a semana"],
      datos: { campaña: top.name, share: r2(share(top)), campañas: camps.length },
    });
  }

  // ── 10. Mensual: costo (CPM) y ritmo del mes en curso — sobre la inversión DIGITAL ──
  // Drean: el CPM usa solo la inversión de medios con impresiones informadas (invConImpr).
  const mo = [...(pauta.monthly ?? [])].sort((a, b) => a.mesIdx - b.mesIdx).map((m) => ({ ...m, inv: m.invConImpr ?? invDig(m) }));
  const closed = mo.filter((m) => m.mesIdx < now.getMonth() && m.impr > 0);
  if (closed.length >= 4) {
    const last = closed[closed.length - 1]!, base = closed.slice(-4, -1);
    const cpm = (m: typeof last) => (m.impr ? (m.inv / m.impr) * 1000 : 0);
    const d = deltaPct(cpm(last), avg(base.map(cpm))) ?? 0;
    if (d >= 25) S({
      key: "pauta_cpm_inflation", tipo: "alerta", prioridad: d >= 50 ? "alta" : "media",
      titulo: `${last.mes}: el CPM subió ${fDelta(d)} vs el promedio de los 3 meses previos (${$(cpm(last))})`,
      descripcion: `Promedio previo ${$(avg(base.map(cpm)))}. Con la misma inversión se compran menos impresiones.`,
      acciones: ["Revisar si cambió el mix de objetivos/medios del mes", "Ampliar audiencias o renovar creativos (fatiga eleva el CPM)", "Considerar estacionalidad (subasta más cara)"],
      datos: { mes: last.mes, cpm: r2(cpm(last)), promedio3m: r2(avg(base.map(cpm))), deltaPct: r2(d) },
      impacto: { metrica: "Impresiones perdidas vs CPM previo", valor: Math.round((last.inv / avg(base.map(cpm))) * 1000 - last.impr), unidad: "impresiones" },
    });
    else if (d <= -20) S({
      key: "pauta_cpm_improved", tipo: "info", prioridad: "baja",
      titulo: `${last.mes}: el CPM bajó ${fDelta(d)} vs los 3 meses previos`,
      descripcion: `CPM ${$(cpm(last))} vs ${$(avg(base.map(cpm)))}. Momento eficiente para comprar alcance.`,
      acciones: ["Evaluar adelantar inversión mientras el costo está bajo"],
      datos: { mes: last.mes, cpm: r2(cpm(last)), deltaPct: r2(d) },
    });
  }
  const curM = mo.find((m) => m.mesIdx === now.getMonth());
  const lastClosed = mo.filter((m) => m.mesIdx < now.getMonth() && m.inv > 0).slice(-3);
  if (curM && lastClosed.length >= 2 && now.getDate() >= 7) {
    const daysIn = (i: number) => new Date(now.getFullYear(), i + 1, 0).getDate();
    const ratePrev = avg(lastClosed.map((m) => m.inv / daysIn(m.mesIdx)));
    const rateCur = curM.inv / now.getDate();
    const x = ratePrev ? rateCur / ratePrev : 0;
    const proy = rateCur * daysIn(now.getMonth());
    if (x >= 1.3 || (x > 0 && x <= 0.7)) S({
      key: x >= 1.3 ? "pauta_pacing_fast" : "pauta_pacing_slow", tipo: x >= 1.3 ? "alerta" : "info", prioridad: "media",
      titulo: `Ritmo de gasto del mes: ${$(rateCur)}/día, ${x.toFixed(1)}× el de los últimos meses`,
      descripcion: `A este ritmo el mes cierra en ≈${$(proy)} (promedio diario previo ${$(ratePrev)}). ${x >= 1.3 ? "Si no es una campaña planificada, revisar presupuestos diarios." : "Posible sub-ejecución: validar si es intencional."}`,
      acciones: x >= 1.3 ? ["Revisar presupuestos diarios y campañas nuevas", "Confirmar que el aumento responde al plan"] : ["Confirmar si hay campañas pausadas o rechazadas"],
      datos: { gastoDiario: r2(rateCur), gastoDiarioPrevio: r2(ratePrev), proyeccionMes: Math.round(proy) },
    });
  }

  // ── 11. Piezas (top creativos de Meta) ──
  const cr = (pauta.topCreatives ?? []).filter((c) => c.impressions >= 5000 && c.spend > 0);
  if (cr.length >= 4) {
    const crTot = sum(cr.map((c) => c.spend));
    const medCtr = median(cr.map((c) => c.ctr));
    const star = [...cr].sort((a, b) => b.ctr - a.ctr)[0]!;
    if (medCtr > 0 && star.ctr >= medCtr * 2 && star.spend / crTot < 0.15) S({
      key: `pauta_creative_star_${star.id}`, tipo: "oportunidad", prioridad: "media",
      titulo: `Pieza con CTR ${fPct(star.ctr, 2)} (${(star.ctr / medCtr).toFixed(1)}× la mediana) y poca inversión`,
      descripcion: `"${clip(star.name, 60)}": ${$(star.spend)} (${fPct((star.spend / crTot) * 100, 0)} de las piezas top).`,
      acciones: ["Darle más presupuesto o duplicarla en otras campañas", "Producir variantes con el mismo ángulo"],
      datos: creativeData(star, medCtr),
    });
    const fat = cr.filter((c) => c.frequency > 5 && c.spend / crTot >= 0.05).sort((a, b) => b.frequency - a.frequency)[0];
    if (fat) S({
      key: `pauta_creative_fatigue_${fat.id}`, tipo: "alerta", prioridad: "media",
      titulo: `Pieza con frecuencia ${fat.frequency.toFixed(1)}: riesgo de fatiga creativa`,
      descripcion: `"${clip(fat.name, 60)}": ${$(fat.spend)}, CTR ${fPct(fat.ctr, 2)}.`,
      acciones: ["Rotar la pieza con variantes nuevas", "Ampliar la audiencia de su conjunto de anuncios"],
      datos: creativeData(fat, medCtr),
    });
    const cara = cr.filter((c) => c.spend / crTot >= 0.08 && c.ctr <= medCtr * 0.5).sort((a, b) => b.spend - a.spend)[0];
    if (cara) S({
      key: `pauta_creative_costly_${cara.id}`, tipo: "alerta", prioridad: "media",
      titulo: `Pieza con ${fPct((cara.spend / crTot) * 100, 0)} de la inversión y CTR ${fPct(cara.ctr, 2)} (mitad de la mediana)`,
      descripcion: `"${clip(cara.name, 60)}": ${$(cara.spend)} para ${fNum(cara.impressions)} impresiones.${cara.vtr100 > 0 ? ` VTR ${fPct(cara.vtr100, 1)}.` : ""} Si su rol es awareness puede ser aceptable; si busca tráfico, no.`,
      acciones: ["Confirmar el objetivo de la pieza", "Si es de tráfico: pausar o reemplazar por la de mejor CTR"],
      datos: creativeData(cara, medCtr),
    });
  }

  return sortSignals(out);
}

// ── Medios OFFLINE (planilla) ────────────────────────────────────────────────
function offlineSignals(pauta: PautaFull, S: (s: Omit<Signal, "dash">) => void, now: Date) {
  const off = pauta.offline;
  if (!off || !off.byMedio.length || off.totals.spend <= 0) return;
  const oc = off.currency ?? pauta.currency;
  const $ = (v: number) => fMoney(v, oc);
  const sameCur = !pauta.mixedCurrency || (off.currency ?? pauta.currency) === pauta.currency;
  const offTotal = off.totals.spend;
  const rows = (pauta.byCampaign ?? []).filter((c) => c.offline && c.spend > 0);
  const digCamps = (pauta.byCampaign ?? []).filter((c) => !c.offline && c.spend > 0);
  const hasDigital = digCamps.length > 0 || (pauta.monthly ?? []).some((m) => invDig(m) > 0);

  // 1. CPM de contactos por soporte vs la mediana de su medio.
  for (const [medio, group] of groupBy(rows.filter((c) => (c.contactos ?? 0) > 0 && (c.cpmContactos ?? 0) > 0), (c) => c.medio ?? "Otro")) {
    if (group.length < 3) continue;
    const med = median(group.map((c) => c.cpmContactos ?? 0));
    for (const c of group) {
      const x = med > 0 ? (c.cpmContactos ?? 0) / med : 0;
      if (x >= 1.5 && c.spend / offTotal >= 0.02) S({
        key: `pauta_off_cpm_${c.id}`, tipo: "alerta", prioridad: x >= 2.5 ? "alta" : "media",
        titulo: `${medio} · "${clip(c.name, 50)}": mil contactos cuestan ${x.toFixed(1)}× la mediana del medio (${$(c.cpmContactos ?? 0)})`,
        descripcion: `Invirtió ${$(c.spend)} para ${fNum(c.contactos ?? 0)} contactos. Mediana de CPM de contactos en ${medio}: ${$(med)}. Si el soporte no aporta una audiencia distinta (target, región, afinidad), está caro.`,
        acciones: ["Renegociar tarifa o bonificación con el medio", "Mover parte a los soportes de CPM más bajo del mismo medio", "Validar que los contactos informados sean del target y no totales"],
        datos: { medio, soporte: c.name, cpmContactos: r2(c.cpmContactos ?? 0), medianaMedio: r2(med), inversion: Math.round(c.spend), contactos: c.contactos ?? 0 },
        impacto: { metrica: "Contactos adicionales al CPM mediano", valor: Math.round((c.spend / med) * 1000 - (c.contactos ?? 0)), unidad: "contactos" },
      });
    }
  }

  // 1b. CPM por medio vs la mediana de tus medios (offline por contactos, digital por impresiones).
  const medioCpm = off.byMedio.filter((m) => (m.cpmContactos ?? 0) > 0 && m.spend / offTotal >= 0.05).map((m) => ({ medio: m.medio, cpm: m.cpmContactos!, spend: m.spend, offline: true }));
  if (sameCur) for (const m of aggBy(digCamps, medioDe)) if (m.impressions > 0) medioCpm.push({ medio: m.medio, cpm: m.cpm, spend: m.spend, offline: false });
  if (medioCpm.length >= 3) {
    const med = median(medioCpm.map((m) => m.cpm));
    const caro = medioCpm.filter((m) => m.offline && m.cpm >= med * 2).sort((a, b) => b.spend - a.spend)[0];
    if (caro) S({
      key: `pauta_off_medio_cpm_${caro.medio}`, tipo: "alerta", prioridad: "media",
      titulo: `${caro.medio}: el CPM de contactos (${$(caro.cpm)}) es ${(caro.cpm / med).toFixed(1)}× la mediana de tus medios`,
      descripcion: `Mediana de CPM entre tus medios: ${$(med)}. Ojo: un contacto offline y una impresión digital no son idénticos (visibilidad, atención, cobertura del target); la comparación marca el orden de magnitud, no reemplaza el rol de cada medio.`,
      acciones: ["Confirmar qué aporta ese medio que los demás no (alcance incremental, target, cobertura regional)", "Negociar tarifa o probar un mix con más peso en los medios de menor costo por contacto"],
      datos: { medios: medioCpm.map((m) => ({ medio: m.medio, cpm: r2(m.cpm), inversion: Math.round(m.spend), tipo: m.offline ? "offline" : "online" })), mediana: r2(med) },
    });
  }

  // 2. Concentración en un medio (online + offline, misma moneda).
  const shares = [...off.byMedio.map((m) => ({ medio: m.medio, spend: m.spend }))];
  if (sameCur) for (const m of aggBy(digCamps, medioDe)) shares.push({ medio: m.medio, spend: m.spend });
  const tot = sum(shares.map((m) => m.spend));
  if (shares.length >= 2 && tot > 0) {
    const top = [...shares].sort((a, b) => b.spend - a.spend)[0]!;
    const sh = (top.spend / tot) * 100;
    if (sh > 60) S({
      key: "pauta_off_medio_concentration", tipo: "alerta", prioridad: sh > 80 ? "alta" : "media",
      titulo: `${top.medio} concentra ${fPct(sh, 0)} de la inversión en medios`,
      descripcion: `${$(top.spend)} de ${$(tot)} (${shares.length} medios con inversión). Depender de un medio expone el plan a su costo y a su techo de alcance: pasado cierto punto, más inversión en el mismo medio repite a las mismas personas.`,
      acciones: ["Evaluar un medio complementario que sume alcance incremental", "Revisar la curva de alcance del medio principal antes de subirle más presupuesto"],
      datos: { medios: shares.map((m) => ({ medio: m.medio, inversion: Math.round(m.spend), share: r2((m.spend / tot) * 100) })) },
    });
  }

  // 3. Costo por GRP (CPP) fuera de rango dentro del mismo medio (TV / radio).
  for (const [medio, group] of groupBy(rows.filter((c) => (c.grps ?? 0) > 0 && (c.cpp ?? 0) > 0), (c) => c.medio ?? "Otro")) {
    if (group.length < 3) continue;
    const med = median(group.map((c) => c.cpp ?? 0));
    const worst = group.filter((c) => (c.cpp ?? 0) >= med * 1.5).sort((a, b) => b.spend - a.spend)[0];
    if (worst) S({
      key: `pauta_off_cpp_${worst.id}`, tipo: "alerta", prioridad: (worst.cpp ?? 0) >= med * 2.5 ? "alta" : "media",
      titulo: `${medio} · "${clip(worst.name, 50)}": costo por GRP ${$(worst.cpp ?? 0)}, ${((worst.cpp ?? 0) / med).toFixed(1)}× la mediana del medio`,
      descripcion: `${fNum(worst.grps ?? 0)} GRPs por ${$(worst.spend)}. Mediana de costo por GRP en ${medio}: ${$(med)}. Un CPP alto se justifica solo si ese soporte llega a un target que los demás no cubren (franja, programa, región).`,
      acciones: ["Revisar franja/programas: el prime time encarece el punto", "Pedir la curva de alcance del soporte: si solo suma frecuencia, bajarlo", "Negociar bonificación o paquetes"],
      datos: { medio, soporte: worst.name, cpp: r2(worst.cpp ?? 0), medianaCpp: r2(med), grps: r2(worst.grps ?? 0), inversion: Math.round(worst.spend) },
      impacto: { metrica: "GRPs adicionales al CPP mediano", valor: Math.round(worst.spend / med - (worst.grps ?? 0)), unidad: "GRPs" },
    });
  }

  // 4. Meses con inversión offline y sin actividad digital (falta de soporte digital).
  if (hasDigital) {
    const digByMonth = new Map((pauta.monthly ?? []).map((m) => [m.mesIdx, invDig(m)]));
    const huecos = off.meses.map((k) => Number(k.slice(5, 7)) - 1).filter((i) => i <= now.getMonth() && (digByMonth.get(i) ?? 0) <= 0);
    if (huecos.length) {
      const MES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
      S({
        key: "pauta_off_sin_digital", tipo: "alerta", prioridad: "media",
        titulo: `${huecos.length === 1 ? "Un mes" : `${huecos.length} meses`} con medios offline y sin pauta digital (${huecos.map((i) => MES[i]).join(", ")})`,
        descripcion: "La TV, la radio o la vía pública generan interés que la gente busca después (búsquedas de marca, visitas, redes). Sin pauta digital activa en esos meses, esa demanda no se captura ni se re-impacta.",
        acciones: ["Acompañar cada flight offline con búsqueda de marca y remarketing", "Cruzar esos meses con las búsquedas y el tráfico directo en Web para ver el efecto"],
        datos: { meses: huecos.map((i) => MES[i]) },
      });
    }
  }

  // 5. Share offline del último mes cerrado vs el promedio propio.
  if (sameCur && !pauta.mixedCurrency) {
    const closed = (pauta.monthly ?? []).filter((m) => m.mesIdx < now.getMonth() && m.inv > 0).sort((a, b) => a.mesIdx - b.mesIdx);
    if (closed.length >= 4) {
      const shareOf = (m: PautaMonth) => ((m.invOff ?? 0) / m.inv) * 100;
      const last = closed[closed.length - 1]!;
      const base = avg(closed.slice(0, -1).map(shareOf));
      const d = shareOf(last) - base;
      if (Math.abs(d) >= 15) S({
        key: "pauta_off_share_shift", tipo: "info", prioridad: "baja",
        titulo: `${last.mes}: el offline fue ${fPct(shareOf(last), 0)} de la inversión (promedio previo ${fPct(base, 0)})`,
        descripcion: `El mix se movió ${d > 0 ? "hacia" : "fuera de"} los medios offline ${Math.abs(d).toFixed(0)} puntos. Si no fue planificado, revisá si el cambio respondió a un objetivo (lanzamiento, estacionalidad) y cómo se movieron alcance y búsquedas ese mes.`,
        acciones: ["Confirmar que el cambio de mix responde al plan", "Comparar alcance, búsquedas de marca y tráfico de ese mes contra los anteriores"],
        datos: { mes: last.mes, shareOffline: r2(shareOf(last)), promedioPrevio: r2(base) },
      });
    }
  }
}

function creativeData(c: CreativeRow, medCtr: number) {
  return { pieza: c.name, id: c.id, permalink: c.permalink, inversion: Math.round(c.spend), impresiones: c.impressions, ctr: r2(c.ctr), medianaCtr: r2(medCtr), frecuencia: r2(c.frequency), vtr100: r2(c.vtr100) };
}
function groupBy<T>(xs: T[], k: (x: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const x of xs) { const key = k(x); m.set(key, [...(m.get(key) ?? []), x]); }
  return m;
}
